/** Scumbags («Подонки») — система для Foundry VTT 12–14. */
import { SCUMBAGS } from "./module/config.mjs";
import { actorModels, itemModels } from "./module/data.mjs";
import { ScumbagsActor, ScumbagsItem } from "./module/documents.mjs";
import { registerSheets, CharacterSheet } from "./module/sheets.mjs";
import * as rolls from "./module/rolls.mjs";

Hooks.once("init", () => {
  console.log("Scumbags | init");
  CONFIG.SCUMBAGS = SCUMBAGS;
  game.scumbags = { config: SCUMBAGS, rolls };

  CONFIG.Actor.documentClass = ScumbagsActor;
  CONFIG.Item.documentClass = ScumbagsItem;
  Object.assign(CONFIG.Actor.dataModels, actorModels);
  Object.assign(CONFIG.Item.dataModels, itemModels);

  // Полоска жетона — ПЗ персонажа, NPC и транспорта.
  CONFIG.Actor.trackableAttributes = {
    character: { bar: ["hp"], value: ["luck.value", "wanted", "xp"] },
    npc: { bar: ["hp"], value: [] },
    vehicle: { bar: ["hp", "armor"], value: ["speed"] },
    business: { bar: [], value: [] }
  };

  // Инициатива: Рефлексы + d10 (+4 за «Реакцию»); при ничьей первым ходит тот, у кого Рефлексы выше.
  CONFIG.Combat.initiative = { formula: "1d10 + @stats.reflexes + @initBonus + (@stats.reflexes / 100)", decimals: 2 };

  registerSheets();

  const preload = foundry.applications?.handlebars?.loadTemplates ?? loadTemplates;
  preload([`${SCUMBAGS.path}/templates/fields.hbs`, `${SCUMBAGS.path}/templates/item-row.hbs`]);

  // Кнопки на карточках бросков в чате.
  const hook = game.release.generation >= 13 ? "renderChatMessageHTML" : "renderChatMessage";
  Hooks.on(hook, (message, html) => rolls.activateChatCard(message, html instanceof HTMLElement ? html : html[0]));
});

Hooks.once("ready", () => {
  // Игрок просит мастера нанести урон жетону, которым сам не владеет.
  game.socket.on("system.scumbags", message => rolls.onSocket(message));
});

/** Транспорт показан на листе владельца: изменился — перерисовать открытые листы персонажей. */
function refreshCharacterSheets(actor) {
  if ( actor.type !== "vehicle" ) return;
  for ( const app of foundry.applications.instances.values() ) {
    if ( (app instanceof CharacterSheet) && app.rendered ) app.render();
  }
}
Hooks.on("updateActor", refreshCharacterSheets);
Hooks.on("createActor", refreshCharacterSheets);
Hooks.on("deleteActor", refreshCharacterSheets);
