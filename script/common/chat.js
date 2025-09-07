// systems/dark-heresy-1e/script/common/chat.js
import { commonRoll, combatRoll, damageRoll } from "./roll.js";
import { prepareCommonRoll } from "./dialog.js";
import DarkHeresyUtil from "./util.js";

/**
 * Attach listeners to the ChatLog root (HTMLElement). v12 uses native DOM, not jQuery.
 * We use a single delegated click handler like jQuery's old .on().
 */
export function chatListeners(rootEl) {
  const handler = (ev) => {
    // Buttons inside chat cards
    if (ev.target.closest(".invoke-test"))   return onTestClick(ev);
    if (ev.target.closest(".invoke-damage")) return onDamageClick(ev);
    if (ev.target.closest(".reload-Weapon")) return onReloadClick(ev);

    // Toggle dice details when clicking the background (your old showRolls behavior)
    if (ev.target.closest(".dark-heresy.chat.roll .background.border")) {
      return onChatRollClick(ev);
    }
  };

  // Avoid double-binding
  rootEl.removeEventListener("click", rootEl.__dh_clickHandler);
  rootEl.__dh_clickHandler = handler;
  rootEl.addEventListener("click", handler);
}

/**
 * Context menu entries for chat messages (v12 signature is (chatLog, options)).
 * Push entries onto options; don't try to bind DOM listeners here.
 */
export function addChatMessageContextOptions(chatLog, options) {
  const canApply = (li) => {
    const msg = game.messages.get(li.dataset.messageId);
    return msg?.getRollData()?.isDamageRoll && msg?.isContentVisible && canvas.tokens.controlled.length > 0;
  };

  options.push({
    name: game.i18n.localize("CHAT.CONTEXT.APPLY_DAMAGE"),
    icon: '<i class="fas fa-user-minus"></i>',
    condition: canApply,
    callback: (li) => applyChatCardDamageFromLi(li)
  });

  const canReroll = (li) => {
    const msg = game.messages.get(li.dataset.messageId);
    const actor = game.actors.get(msg?.getRollData()?.ownerId);
    return !!(msg?.isRoll && !msg.getRollData()?.isDamageRoll && msg?.isContentVisible && actor?.fate?.value > 0);
  };

  options.push({
    name: game.i18n.localize("CHAT.CONTEXT.REROLL"),
    icon: '<i class="fa-solid fa-repeat"></i>',
    condition: canReroll,
    callback: (li) => {
      const msg = game.messages.get(li.dataset.messageId);
      if (msg) rerollTest(msg.getRollData());
    }
  });

  return options;
}

/**
 * Optional extra context entry: toggle the roll details visibility.
 * (Keeps parity with your old "showRolls" helper name.)
 */
export function showRolls(chatLog, options) {
  options.push({
    name: game.i18n.localize("CHAT.CONTEXT.TOGGLE_ROLLS") ?? "Toggle Rolls",
    icon: '<i class="fa-solid fa-dice"></i>',
    condition: (li) => !!li.dataset.messageId,
    callback: (li) => {
      const details = document.querySelector(
        `.message[data-message-id="${li.dataset.messageId}"] .dice-rolls`
      );
      if (!details) return;
      const visible = getComputedStyle(details).display !== "none";
      details.style.display = visible ? "none" : "block";
    }
  });
}

/**
 * Read damage rows from the message DOM and apply to selected tokens.
 */
function applyChatCardDamageFromLi(li, multiplier = 1) {
  const msgEl = document.querySelector(`.message[data-message-id="${li.dataset.messageId}"]`);
  if (!msgEl) return;

  const amount = Array.from(msgEl.querySelectorAll(".damage-total"));
  const location = Array.from(msgEl.querySelectorAll(".damage-location"));
  const penetration = Array.from(msgEl.querySelectorAll(".damage-penetration"));
  const type = Array.from(msgEl.querySelectorAll(".damage-type"));
  const righteousFury = Array.from(msgEl.querySelectorAll(".damage-righteous-fury"));

  const len = Math.max(amount.length, location.length, penetration.length, type.length, righteousFury.length);
  const damages = [];
  for (let i = 0; i < len; i++) {
    damages.push({
      amount: Number((amount[i]?.textContent ?? "0").trim()) * multiplier,
      location: location[i]?.dataset?.location ?? "",
      penetration: Number((penetration[i]?.textContent ?? "0").trim()),
      type: (type[i]?.textContent ?? "").trim(),
      righteousFury: (righteousFury[i]?.textContent ?? "").trim()
    });
  }

  return Promise.all(
    canvas.tokens.controlled.map(t => t.actor?.applyDamage(damages))
  );
}

/**
 * Reroll using prior rollData; spend Fate if available.
 */
function rerollTest(rollData) {
  const actor = game.actors.get(rollData.ownerId);
  if (!actor) return;

  // Spend Fate (adjust if your data model differs)
  actor.update({ "system.fate.value": (actor.fate?.value ?? actor.system?.fate?.value ?? 0) - 1 });

  // Reset old damage block so failures don't show stale UI
  delete rollData.damages;

  rollData.isReRoll = true;
  if (rollData.isCombatRoll) {
    // Reinject regex-dependent props that get lost in message flags
    rollData.attributeBoni = actor.attributeBoni;
    return combatRoll(rollData);
  } else {
    return commonRoll(rollData);
  }
}

/**
 * Roll a Test (Evasion) for the currently selected actor, launched from a chat card.
 */
function onTestClick(ev) {
  const actor = game.macro.getActor?.();
  const msgId = ev.currentTarget.closest(".message")?.dataset.messageId;
  const msg = msgId ? game.messages.get(msgId) : null;
  const rollData = msg?.getRollData();

  if (!actor || !rollData) {
    ui.notifications?.warn(game.i18n.localize("NOTIFICATION.MACRO_ACTOR_NOT_FOUND"));
    return;
  }

  const evasions = {
    dodge: DarkHeresyUtil.createSkillRollData(actor, "dodge"),
    parry: DarkHeresyUtil.createSkillRollData(actor, "parry"),
    deny:  DarkHeresyUtil.createCharacteristicRollData(actor, "willpower"),
    selected: "dodge"
  };

  rollData.evasions = evasions;
  rollData.isEvasion = true;
  rollData.isDamageRoll = false;
  rollData.isCombatRoll = false;
  if (rollData.psy) rollData.psy.display = false;
  rollData.name = game.i18n.localize("DIALOG.EVASION");

  prepareCommonRoll(rollData);
}

/**
 * Roll damage from the chat card.
 */
function onDamageClick(ev) {
  const msgId = ev.currentTarget.closest(".message")?.dataset.messageId;
  const msg = msgId ? game.messages.get(msgId) : null;
  const rollData = msg?.getRollData();
  if (!rollData) return;

  rollData.isEvasion = false;
  rollData.isCombatRoll = false;
  rollData.isDamageRoll = true;

  return damageRoll(rollData);
}

/**
 * Reload the associated weapon (ignoring inventory ammo).
 */
async function onReloadClick(ev) {
  const msgId = ev.currentTarget.closest(".message")?.dataset.messageId;
  const msg = msgId ? game.messages.get(msgId) : null;
  const rollData = msg?.getRollData();
  if (!rollData) return;

  const weapon = game.actors.get(rollData.ownerId)?.items?.get(rollData.itemId);
  if (weapon) await weapon.update({ "system.clip.value": rollData.clip?.max ?? 0 });
}

/**
 * Toggle visibility of the dice roll details inside the clicked message.
 */
function onChatRollClick(event) {
  event.preventDefault();
  const messageEl = event.currentTarget.closest(".message") ?? event.target.closest(".message");
  const tip = messageEl?.querySelector(".dice-rolls");
  if (!tip) return;

  const visible = getComputedStyle(tip).display !== "none";
  tip.style.display = visible ? "none" : "block";
}
