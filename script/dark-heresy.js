// systems/dark-heresy-1e/script/dark-heresy.js
import { DarkHeresyActor } from "./common/actor.js";
import { DarkHeresyItem } from "./common/item.js";
import { AcolyteSheet } from "./sheet/actor/acolyte.js";
import { NpcSheet } from "./sheet/actor/npc.js";
import { WeaponSheet } from "./sheet/weapon.js";
import { AmmunitionSheet } from "./sheet/ammunition.js";
import { WeaponModificationSheet } from "./sheet/weapon-modification.js";
import { ArmourSheet } from "./sheet/armour.js";
import { ForceFieldSheet } from "./sheet/force-field.js";
import { CyberneticSheet } from "./sheet/cybernetic.js";
import { DrugSheet } from "./sheet/drug.js";
import { GearSheet } from "./sheet/gear.js";
import { ToolSheet } from "./sheet/tool.js";
import { CriticalInjurySheet } from "./sheet/critical-injury.js";
import { MalignancySheet } from "./sheet/malignancy.js";
import { MentalDisorderSheet } from "./sheet/mental-disorder.js";
import { MutationSheet } from "./sheet/mutation.js";
import { PsychicPowerSheet } from "./sheet/psychic-power.js";
import { TalentSheet } from "./sheet/talent.js";
import { SpecialAbilitySheet } from "./sheet/special-ability.js";
import { TraitSheet } from "./sheet/trait.js";
import { AptitudeSheet } from "./sheet/aptitude.js";
import { initializeHandlebars } from "./common/handlebars.js";
import { migrateWorld } from "./common/migration.js";
import { prepareCommonRoll, prepareCombatRoll, preparePsychicPowerRoll } from "./common/dialog.js";
import { commonRoll, combatRoll } from "./common/roll.js";
import { chatListeners } from "./common/chat.js";
import DhMacroUtil from "./common/macro.js";
import Dh from "./common/config.js";

// Helpers (chat context menu builders, etc.)
import * as chat from "./common/chat.js";

Hooks.once("init", () => {
  // Initiative & document classes
  CONFIG.Combat.initiative = { formula: "@initiative.base + @initiative.bonus", decimals: 0 };
  CONFIG.Actor.documentClass = DarkHeresyActor;
  CONFIG.Item.documentClass = DarkHeresyItem;

  // Font (ok to leave empty font list if you just need the name available in editors)
  CONFIG.fontDefinitions["Caslon Antique"] = { editor: true, fonts: [] };

  // System namespace
  game.darkHeresy = {
    config: Dh,
    testInit: { prepareCommonRoll, prepareCombatRoll, preparePsychicPowerRoll },
    tests: { commonRoll, combatRoll }
  };

  // Macro helper
  game.macro = DhMacroUtil;

  // Register sheets (kept scope "dark-heresy" to avoid breaking existing data/css)
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("dark-heresy", AcolyteSheet, { types: ["acolyte"], makeDefault: true });
  Actors.registerSheet("dark-heresy", NpcSheet, { types: ["npc"], makeDefault: true });

  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("dark-heresy", WeaponSheet, { types: ["weapon"], makeDefault: true });
  Items.registerSheet("dark-heresy", AmmunitionSheet, { types: ["ammunition"], makeDefault: true });
  Items.registerSheet("dark-heresy", WeaponModificationSheet, { types: ["weaponModification"], makeDefault: true });
  Items.registerSheet("dark-heresy", ArmourSheet, { types: ["armour"], makeDefault: true });
  Items.registerSheet("dark-heresy", ForceFieldSheet, { types: ["forceField"], makeDefault: true });
  Items.registerSheet("dark-heresy", CyberneticSheet, { types: ["cybernetic"], makeDefault: true });
  Items.registerSheet("dark-heresy", DrugSheet, { types: ["drug"], makeDefault: true });
  Items.registerSheet("dark-heresy", GearSheet, { types: ["gear"], makeDefault: true });
  Items.registerSheet("dark-heresy", ToolSheet, { types: ["tool"], makeDefault: true });
  Items.registerSheet("dark-heresy", CriticalInjurySheet, { types: ["criticalInjury"], makeDefault: true });
  Items.registerSheet("dark-heresy", MalignancySheet, { types: ["malignancy"], makeDefault: true });
  Items.registerSheet("dark-heresy", MentalDisorderSheet, { types: ["mentalDisorder"], makeDefault: true });
  Items.registerSheet("dark-heresy", MutationSheet, { types: ["mutation"], makeDefault: true });
  Items.registerSheet("dark-heresy", PsychicPowerSheet, { types: ["psychicPower"], makeDefault: true });
  Items.registerSheet("dark-heresy", TalentSheet, { types: ["talent"], makeDefault: true });
  Items.registerSheet("dark-heresy", SpecialAbilitySheet, { types: ["specialAbility"], makeDefault: true });
  Items.registerSheet("dark-heresy", TraitSheet, { types: ["trait"], makeDefault: true });
  Items.registerSheet("dark-heresy", AptitudeSheet, { types: ["aptitude"], makeDefault: true });

  // Handlebars helpers/partials
  initializeHandlebars();

  // Settings (kept namespace "dark-heresy" for backward compatibility)
  game.settings.register("dark-heresy", "worldSchemaVersion", {
    name: "World Version",
    hint: "Used to automatically upgrade worlds data when the system is upgraded.",
    scope: "world",
    config: true,
    default: 0,
    type: Number
  });

  game.settings.register("dark-heresy", "autoCalcXPCosts", {
    name: "Calculate XP Costs",
    hint: "If enabled, calculate XP costs automatically.",
    scope: "world",
    config: true,
    default: false,
    type: Boolean
  });

  game.settings.register("dark-heresy", "useSpraytemplate", {
    name: "Use Template with Spray Weapons",
    hint: "If enabled, Spray Weapons will require the user to put down a template before the roll is made. Templates are NOT removed automatically",
    scope: "client",
    config: true,
    default: true,
    type: Boolean
  });
});

Hooks.once("ready", () => {
  // Migrations
  migrateWorld();

  // Expose roll data helper on ChatMessage (used by your chat card logic)
  // v12-safe: documentClass is still available
  CONFIG.ChatMessage.documentClass.prototype.getRollData = function () {
    return this.getFlag("dark-heresy", "rollData");
  };
});

/* -------------------------------------------- */
/*  Other Hooks (v12 DOM, no jQuery)            */
/* -------------------------------------------- */

// Attach listeners to ChatLog DOM each render (v12: html is an HTMLElement)
Hooks.on("renderChatLog", (chatLog, html) => {
  chatListeners(html);
});

// Build chat context menu entries (new signature: (chatLog, options))
Hooks.on("getChatLogEntryContext", (chatLog, options) => {
  chat.addChatMessageContextOptions?.(chatLog, options);
  chat.showRolls?.(chatLog, options);
});

// Create a macro when dropping on the hotbar
Hooks.on("hotbarDrop", (bar, data, slot) => {
  if (data.type === "Item" || data.type === "Actor") {
    DhMacroUtil.createMacro(data, slot);
    return false;
  }
  return true;
});

// Example sheet render hook using native DOM APIs
Hooks.on("renderDarkHeresySheet", (sheet, html /* HTMLElement */, data) => {
  const disable = game.settings.get("dark-heresy", "autoCalcXPCosts");
  html.querySelectorAll("input.cost").forEach((i) => (i.disabled = disable));
  html
    .querySelectorAll(":not(.psychic-power) > input.item-cost")
    .forEach((i) => (i.disabled = disable));
});
