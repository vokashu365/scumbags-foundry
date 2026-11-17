/** Листы актёров и предметов (ApplicationV2; одна сборка для Foundry 12–14). */
import { SCUMBAGS } from "./config.mjs";
import * as rolls from "./rolls.mjs";
import { openAdvancement, freeXP } from "../advancement/advancement.mjs";

const { HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;
const { ActorSheetV2, ItemSheetV2 } = foundry.applications.sheets;
const TPL = `${SCUMBAGS.path}/templates`;
const L = key => game.i18n.localize(key);
const gen = () => game.release.generation;
const choices = (keys, prefix, blank = null) => ({
  ...(blank === null ? {} : { "": blank }), ...Object.fromEntries(keys.map(k => [k, L(`${prefix}.${k}`)]))
});
const pips = (n, value) => Array.from({ length: n }, (_, i) => ({ value: i + 1, on: i < value }));
const usd = n => (n === null || n === undefined) ? "—" : `$${Number(n).toLocaleString("ru-RU").replace(/ /g, " ")}`;
const signed = n => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");

/** Описание поля для шаблона fields.hbs. Значение читается из документа по имени поля. */
function fieldKit(doc) {
  const val = name => foundry.utils.getProperty(doc, name);
  const make = (kind, name, label, extra = {}) => ({
    name, label: L(label), value: val(name), [`is${kind}`]: true, ...extra
  });
  return {
    text: (name, label, extra) => make("Text", name, label, extra),
    num: (name, label, extra = {}) => make("Number", name, label, { hasMin: "min" in extra, hasMax: "max" in extra, ...extra }),
    sel: (name, label, options, extra) => make("Select", name, label, { options, ...extra }),
    chk: (name, label, extra) => make("Check", name, label, { cls: "check", ...extra }),
    area: (name, label, rows = 3, extra = {}) => make("Area", name, label, { rows, cls: "wide", ...extra }),
    pool: (name, label, extra) => make("Pool", name, label, extra)
  };
}

const repOptions = () => Object.fromEntries([-2, -1, 0, 1, 2].map(n => [n, `${signed(n)} · ${L(`SCUMBAGS.Reputation.${n + 2}`)}`]));

/** На что действует эффект: все броски, атаки, характеристика или навык. */
function effectTargets() {
  const out = { all: L("SCUMBAGS.Effect.all"), attack: L("SCUMBAGS.Effect.attack"), none: L("SCUMBAGS.Effect.none") };
  for ( const s of SCUMBAGS.stats ) out[`stat:${s}`] = `${L("SCUMBAGS.Roll.Stat")}: ${L(`SCUMBAGS.Stat.${s}`)}`;
  for ( const s of Object.keys(SCUMBAGS.skills) ) out[`skill:${s}`] = L(`SCUMBAGS.Skill.${s}`);
  return out;
}

/* -------------------------------------------- */
/*  Общие действия                              */
/* -------------------------------------------- */

function itemOf(sheet, target) {
  const id = target.closest("[data-item-id]")?.dataset.itemId;
  return sheet.document.items?.get(id) ?? null;
}

function editImage(event, target) {
  if ( !this.isEditable ) return;
  const field = target.dataset.edit || "img";
  const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
  const picker = new FP({
    type: "image", current: foundry.utils.getProperty(this.document, field),
    callback: path => this.document.update({ [field]: path })
  });
  return picker.browse();
}

async function itemCreate(event, target) {
  const type = target.dataset.type;
  const system = {};
  for ( const k of ["category", "target"] ) if ( target.dataset[k] ) system[k] = target.dataset[k];
  const [item] = await this.document.createEmbeddedDocuments("Item", [{ name: L(`TYPES.Item.${type}`), type, system }]);
  item?.sheet.render(true);
}

function itemEdit(event, target) { itemOf(this, target)?.sheet.render(true); }

async function confirmDelete(name) {
  return DialogV2.confirm({
    window: { title: L("SCUMBAGS.Item.Delete") },
    content: `<p>${game.i18n.format("SCUMBAGS.Item.DeleteConfirm", { name: rolls.esc(name) })}</p>`,
    rejectClose: false
  });
}

async function itemDelete(event, target) {
  const item = itemOf(this, target);
  if ( !item ) return;
  if ( !event.shiftKey && !(await confirmDelete(item.name)) ) return;
  return item.delete();
}

function itemToggle(event, target) {
  const item = itemOf(this, target);
  const field = target.dataset.field;
  return item?.update({ [field]: !foundry.utils.getProperty(item, field) });
}

/** Ряд меток: щелчок по метке ставит её значение, по уже последней — снимает одну. */
function setPips(event, target) {
  if ( !this.isEditable ) return;
  const doc = itemOf(this, target) ?? this.document;
  const field = target.dataset.field;
  const n = Number(target.dataset.value);
  const current = Number(foundry.utils.getProperty(doc, field)) || 0;
  return doc.update({ [field]: current === n ? n - 1 : n });
}

/** Переключатель состояния самого листа (режим правки и т. п.). */
function uiToggle(event, target) {
  const key = target.dataset.key;
  this._ui[key] = !this._ui[key];
  return this.render();
}

const fast = event => event.shiftKey;
function rollStat(event, target) { return this.actor.rollStat(target.dataset.stat, { fast: fast(event) }); }
function rollSkill(event, target) { return this.actor.rollSkill(target.dataset.skill, { fast: fast(event) }); }
function rollCustom(event, target) { return this.actor.rollCustomSkill(target.dataset.group, target.dataset.slot, { fast: fast(event) }); }
function rollAttack(event, target) { return rolls.rollAttack(this.actor, itemOf(this, target), { fast: fast(event) }); }
function rollDamage(event, target) { return rolls.rollDamage(this.actor, itemOf(this, target), { fast: fast(event) }); }
function rollProblem() { return rolls.rollProblem(this.actor); }
function reload(event, target) { return rolls.reloadWeapon(this.actor, itemOf(this, target), { fast: fast(event) }); }
function openActor(event, target) { return game.actors.get(target.closest("[data-actor-id]")?.dataset.actorId)?.sheet.render(true); }

function advancement() { return openAdvancement(this.actor); }

function archAdd(event, target) {
  const key = target.closest(".sb-archadd")?.querySelector("select")?.value;
  if ( key ) return this.actor.update({ [`system.archetypes.${key}.active`]: true });
}

async function archRemove(event, target) {
  const key = target.dataset.arch;
  if ( !(await confirmDelete(L(`SCUMBAGS.Archetype.${key}`))) ) return;
  return this.actor.update({ [`system.archetypes.${key}.active`]: false });
}

/* -------------------------------------------- */
/*  Основа листа                                */
/* -------------------------------------------- */

/** Бросать и менять может только владелец документа: наблюдатель лист только смотрит. */
function owned(fn) {
  return function(event, target) {
    if ( !this.document.isOwner ) return ui.notifications.warn(L("SCUMBAGS.Warn.NotYours"));
    return fn.call(this, event, target);
  };
}

function SheetMixin(Base) {
  return class ScumbagsSheet extends HandlebarsApplicationMixin(Base) {
    static DEFAULT_OPTIONS = {
      classes: ["scumbags", "sb-sheet"],
      window: { resizable: true },
      position: { height: "auto" },
      form: { submitOnChange: true, closeOnSubmit: false },
      actions: {
        sbEditImage: editImage, itemEdit, uiToggle, openActor, setPips,
        ...Object.fromEntries(Object.entries({
          itemCreate, itemDelete, itemToggle, reload, rollStat, rollSkill, rollCustom, rollAttack, rollDamage, rollProblem,
          archAdd, archRemove, advancement
        }).map(([name, fn]) => [name, owned(fn)]))
      }
    };

    /** Какие типы предметов можно бросить на этот лист. */
    static DROP_TYPES = [];

    /** Состояние интерфейса листа: раскрытые блоки, режим правки. */
    _ui = {};

    /** @override */
    async _onRender(context, options) {
      await super._onRender(context, options);
      const root = this.element;
      // Поля, привязанные к предметам актёра: меняют предмет, а не актёра.
      for ( const el of root.querySelectorAll("[data-item-id] [data-field]:is(input, select)") ) {
        el.addEventListener("change", event => {
          event.stopPropagation();
          const item = itemOf(this, el);
          const value = el.type === "checkbox" ? el.checked : el.type === "number" ? Number(el.value) || 0 : el.value;
          item?.update({ [el.dataset.field]: value });
        });
      }
      // Раскрытые блоки запоминаются между перерисовками.
      for ( const d of root.querySelectorAll("details[data-ui]") ) {
        d.addEventListener("toggle", () => { this._ui[d.dataset.ui] = d.open; this._keepOnScreen(); });
      }
      if ( !this.isEditable ) {
        for ( const el of root.querySelectorAll("input, select, textarea") ) el.disabled = true;
      }
      // В Foundry 12 у листов V2 нет встроенного перетаскивания.
      else if ( (gen() < 13) && this.document.items ) {
        new DragDrop({
          dragSelector: ".draggable", dropSelector: null,
          callbacks: { dragstart: this._sbDragStart.bind(this), drop: this._sbDrop.bind(this) }
        }).bind(root);
      }
      this._keepOnScreen();
    }

    /** Лист растёт по содержимому; если вылез за нижний край — поднимаем. */
    _keepOnScreen() {
      requestAnimationFrame(() => {
        const el = this.element;
        if ( !el?.isConnected ) return;
        const rect = el.getBoundingClientRect();
        const over = rect.bottom - (window.innerHeight - 8);
        if ( over > 0 ) this.setPosition({ top: Math.max(4, rect.top - over) });
      });
    }

    /** @override */
    changeTab(tab, group, options) {
      super.changeTab(tab, group, options);
      this._keepOnScreen();
    }

    _sbDragStart(event) {
      const item = itemOf(this, event.currentTarget);
      if ( item ) event.dataTransfer.setData("text/plain", JSON.stringify(item.toDragData()));
    }

    async _sbDrop(event) {
      const data = TextEditor.getDragEventData(event);
      if ( data?.type === "Item" ) return this._onDropItem(event, await Item.implementation.fromDropData(data));
      if ( data?.type === "Actor" ) return this._onDropActor(event, await Actor.implementation.fromDropData(data));
    }

    /** Бросили предмет на лист: копируем его актёру, если тип подходит. */
    async _onDropItem(event, item) {
      if ( !this.document.isOwner || !item ) return null;
      if ( this.document.uuid === item.parent?.uuid ) return null;
      if ( !this.constructor.DROP_TYPES.includes(item.type) ) {
        ui.notifications.warn(L("SCUMBAGS.Warn.DropType"));
        return null;
      }
      const [created] = await this.document.createEmbeddedDocuments("Item", [item.toObject()]);
      return created ?? null;
    }

    async _onDropActor() { return null; }
  };
}

/* -------------------------------------------- */
/*  Строки предметов                            */
/* -------------------------------------------- */

function weaponRow(actor, item) {
  const s = item.system;
  const skill = SCUMBAGS.skills[s.skill];
  const bonus = actor.system.stats[skill.stat] + actor.system.skills[s.skill].level;
  const damage = [s.damage, s.damageAlt].filter(Boolean).join(" / ") || (s.strength ? L("SCUMBAGS.Weapon.StrengthOnly") : "—");
  const mods = actor.items.filter(i => (i.type === "mod") && (i.system.attachedTo === item.id)).map(i => i.name);
  const sub = [
    L(`SCUMBAGS.Skill.${s.skill}`), s.quality !== "none" ? L(`SCUMBAGS.Quality.${s.quality}`) : null,
    s.legal ? L(`SCUMBAGS.Legal.${s.legal}`) : null, s.properties || null, ...mods
  ].filter(Boolean).join(" · ");
  return {
    id: item.id, name: item.name, img: item.img, sub, damage, bonus: signed(bonus),
    usesAmmo: s.usesAmmo, mag: s.magazine.value, magMax: s.magazine.max, loaded: s.loadedName,
    empty: s.usesAmmo && !s.magazine.value, hasQuality: s.quality !== "none", wear: pips(3, s.wear), equipped: s.equipped
  };
}

function plainRow(item) {
  const s = item.system;
  const row = { id: item.id, name: item.name, img: item.img, qty: s.quantity, hasQty: true, sub: "" };
  if ( item.type === "armor" ) {
    row.hasQty = false;
    row.equipped = s.equipped;
    row.toggle = { field: "system.equipped", icon: "fa-shirt", title: L("SCUMBAGS.Item.Equipped") };
    row.pools = ["body", "head", "shield"].filter(k => s[k].max).map(k => ({
      label: L(`SCUMBAGS.Armor.${k}`), field: `system.${k}.value`, value: s[k].value, max: s[k].max
    }));
    row.sub = [s.armorClass, s.penalty].filter(Boolean).join(" · ");
  }
  else if ( item.type === "mod" ) {
    row.sub = [L(`SCUMBAGS.ModTarget.${s.target}`), s.effect].filter(Boolean).join(" · ");
    const weapons = (s.target === "weapon") && (item.parent?.type !== "vehicle") ? item.parent?.items.filter(i => i.type === "weapon") : null;
    if ( weapons ) {
      // Модификация оружия ставится на конкретный ствол владельца.
      row.attach = { value: s.attachedTo, title: L("SCUMBAGS.Mod.AttachedTo"), options: { "": L("SCUMBAGS.Mod.NotAttached"), ...Object.fromEntries(weapons.map(w => [w.id, w.name])) } };
    }
    else {
      row.equipped = s.installed;
      row.toggle = { field: "system.installed", icon: "fa-wrench", title: L("SCUMBAGS.Mod.Installed") };
    }
  }
  else if ( item.type === "ammo" ) row.sub = [L(`SCUMBAGS.AmmoKind.${s.kind}`), s.effect].filter(Boolean).join(" · ");
  else row.sub = s.effect ?? "";
  return row;
}

function effectRow(item) {
  const s = item.system;
  return {
    id: item.id, name: item.name, active: s.active, mod: s.mod ? signed(s.mod) : "",
    target: s.mod ? (effectTargets()[s.target] ?? "") : "", description: s.description
  };
}

const byType = (actor, type) => actor.items.filter(i => i.type === type).sort((a, b) => a.sort - b.sort);

function skillRows(sys, { compact = false } = {}) {
  const abbr = k => L(`SCUMBAGS.StatAbbr.${k}`);
  const row = key => ({
    key, label: L(`SCUMBAGS.Skill.${key}`), abbr: abbr(sys.skills[key].stat), level: sys.skills[key].level,
    total: sys.skills[key].total, untrained: !sys.skills[key].level
  });
  const custom = group => (compact || !sys[group]) ? [] : SCUMBAGS.customSkills[group].slots.map(slot => ({
    custom: true, group, slot, name: sys[group][slot].name, level: sys[group][slot].level, total: sys[group][slot].total,
    abbr: abbr(SCUMBAGS.customSkills[group].stat), placeholder: L(`SCUMBAGS.Custom.${group}`), untrained: !sys[group][slot].level
  }));
  return SCUMBAGS.skillColumns.map(col => col.map(g => {
    const named = g.skills.map(row);
    const extra = (g.custom ?? []).flatMap(custom);
    return { label: L(`SCUMBAGS.SkillGroup.${g.id}`), rows: g.id === "music" ? [...extra, ...named] : [...named, ...extra] };
  }));
}

/* -------------------------------------------- */
/*  Лист персонажа                              */
/* -------------------------------------------- */

export class CharacterSheet extends SheetMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = { classes: ["sb-character"], position: { width: 1120 } };
  static PARTS = { sheet: { template: `${TPL}/character.hbs`, scrollable: [".sb-body"] } };
  static DROP_TYPES = ["weapon", "armor", "ammo", "mod", "gear", "effect"];

  tabGroups = { primary: "skills" };

  /** Транспорт привязывается к персонажу именем владельца. */
  async _onDropActor(event, actor) {
    if ( !this.isEditable || (actor?.type !== "vehicle") ) return null;
    // Из компендиума машина сначала попадает в мир, уже записанная на персонажа.
    if ( actor.pack ) {
      const data = actor.toObject();
      data.system.owner = this.actor.name;
      return Actor.implementation.create(data);
    }
    if ( !actor.isOwner ) return null;
    await actor.update({ "system.owner": this.actor.name });
    return actor;
  }

  /** Древо архетипа: уровни, развилки, способности с отметками. */
  _tree(key) {
    const tree = SCUMBAGS.trees[key], a = this.actor.system.archetypes[key];
    const fork = tree.rows.find(r => r.fork === "or");
    // После развилки «ИЛИ» открыт только выбранный путь.
    const closed = id => !!fork && (fork.nodes.find(n => n.endsWith(id.slice(-1))) !== undefined)
      && (a.nodes?.[fork.nodes.find(n => n.endsWith(id.slice(-1)))] !== true);
    return {
      key, label: L(`SCUMBAGS.Archetype.${key}`), level: a.level,
      pathA: L(`SCUMBAGS.Path.${key}.a`), pathB: L(`SCUMBAGS.Path.${key}.b`),
      rows: tree.rows.map(r => ({
        n: r.n, single: r.nodes.length === 1,
        fork: r.fork === "and" ? L("SCUMBAGS.Tree.And") : r.fork === "or" ? L("SCUMBAGS.Tree.Or") : "",
        isOr: r.fork === "or",
        nodes: r.nodes.map(id => ({
          name: L(`SCUMBAGS.Tree.${key}.${id}.name`), desc: L(`SCUMBAGS.Tree.${key}.${id}.desc`),
          field: `system.archetypes.${key}.nodes.${id}`, checked: a.nodes?.[id] === true,
          disabled: !!fork && (r.fork === "path") && (r.n > fork.n) && closed(id),
          refresh: tree.refresh[id] ? L(`SCUMBAGS.Refresh.${tree.refresh[id]}`) : "",
          usedField: `system.archetypes.${key}.used.${id}`, used: a.used?.[id] === true
        }))
      })),
      followers: key === "media" ? { value: this.actor.system.followers } : null,
      trust: key === "lawman" ? pips(3, this.actor.system.precinctTrust) : null
    };
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor, sys = actor.system, F = fieldKit(actor);
    const tab = this.tabGroups.primary;
    const active = SCUMBAGS.archetypes.filter(k => sys.archetypes[k].active);
    const rest = SCUMBAGS.archetypes.filter(k => !sys.archetypes[k].active);
    const effects = byType(actor, "effect").map(effectRow);
    return Object.assign(context, {
      actor, system: sys, editable: this.isEditable, ui: this._ui, freeXP: freeXP(actor),
      tabs: ["skills", "archetypes", "gear", "bio"].map(id => ({ id, label: L(`SCUMBAGS.Tab.${id}`), active: tab === id })),
      on: { skills: tab === "skills", archetypes: tab === "archetypes", gear: tab === "gear", bio: tab === "bio" },
      stats: SCUMBAGS.stats.map(k => ({ key: k, label: L(`SCUMBAGS.Stat.${k}`), value: sys.stats[k] })),
      wanted: pips(5, sys.wanted), luck: pips(sys.luck.max, sys.luck.value), dying: pips(3, sys.conditions.dying),
      repOptions: repOptions(),
      armor: ["body", "head", "shield"].map(k => ({ key: k, label: L(`SCUMBAGS.Armor.${k}`), ...(sys.armor[k] ?? {}), has: !!sys.armor[k] })),
      injuries: ["armL", "armR", "legL", "legR"].map(k => ({ name: `system.injuries.${k}`, label: L(`SCUMBAGS.Injury.${k}`), value: sys.injuries[k] })),
      effects, effectsOn: effects.filter(e => e.active).length,
      columns: skillRows(sys),
      trees: active.map(k => this._tree(k)),
      archOptions: rest.length ? choices(rest, "SCUMBAGS.Archetype") : null,
      weapons: byType(actor, "weapon").map(i => weaponRow(actor, i)),
      armorItems: byType(actor, "armor").map(plainRow),
      ammo: [...byType(actor, "ammo"), ...byType(actor, "mod")].map(plainRow),
      gear: byType(actor, "gear").map(plainRow),
      vehicles: game.actors.filter(a => (a.type === "vehicle") && a.system.owner && (a.system.owner === actor.name)).map(v => ({
        id: v.id, name: v.name, img: v.img, speed: v.system.speed, handling: signed(v.system.handling),
        hp: v.system.hp.value, hpMax: v.system.hp.max, armor: v.system.armor.value,
        sub: [L(`SCUMBAGS.VehicleClass.${v.system.vclass}`), L(`SCUMBAGS.VehicleStatus.${v.system.status}`), v.system.properties].filter(Boolean).join(" · ")
      })),
      money: [{ label: L("SCUMBAGS.Sheet.Housing"), fields: [
        F.text("system.money.housing", "SCUMBAGS.Sheet.Housing", { cls: "half" }), F.text("system.money.lifestyle", "SCUMBAGS.Sheet.Lifestyle", { cls: "half" }),
        F.area("system.money.debts", "SCUMBAGS.Sheet.Debts", 2)
      ] }],
      bio: [
        { label: L("SCUMBAGS.Sheet.Identity"), fields: [
          F.text("system.concept", "SCUMBAGS.Sheet.Concept"), F.text("system.origin", "SCUMBAGS.Sheet.Origin"),
          F.text("system.player", "SCUMBAGS.Sheet.Player"), F.area("system.appearance", "SCUMBAGS.Sheet.Appearance", 2)
        ] },
        { label: L("SCUMBAGS.Sheet.Biography"), fields: [
          F.area("system.bio.main", "SCUMBAGS.Sheet.BioMain", 2, { cls: "half" }), F.area("system.bio.goals", "SCUMBAGS.Sheet.BioGoals", 2, { cls: "half" }),
          F.area("system.bio.childhood", "SCUMBAGS.Sheet.BioChildhood", 4), F.area("system.bio.story", "SCUMBAGS.Sheet.BioStory", 6)
        ] },
        { label: L("SCUMBAGS.Sheet.People"), fields: [
          F.area("system.bio.friends", "SCUMBAGS.Sheet.Friends", 3, { cls: "third" }),
          F.area("system.bio.enemies", "SCUMBAGS.Sheet.Enemies", 3, { cls: "third" }),
          F.area("system.bio.lovers", "SCUMBAGS.Sheet.Lovers", 3, { cls: "third" }),
          F.area("system.contacts", "SCUMBAGS.Sheet.Contacts", 3)
        ] },
        { label: L("SCUMBAGS.Sheet.Law"), fields: [
          F.chk("system.law.fbiAssigned", "SCUMBAGS.Sheet.FbiAssigned"), F.text("system.law.fbiTemper", "SCUMBAGS.Sheet.FbiTemper"),
          { pips: pips(5, sys.law.fbiEvidence), field: "system.law.fbiEvidence", label: L("SCUMBAGS.Sheet.FbiEvidence"), sq: true },
          F.text("system.law.record", "SCUMBAGS.Sheet.Record"), F.chk("system.law.gunLicense", "SCUMBAGS.Sheet.GunLicense"),
          F.text("system.law.fakeId", "SCUMBAGS.Sheet.FakeId")
        ] },
        { label: L("SCUMBAGS.Sheet.Notes"), fields: [F.area("system.notes", "SCUMBAGS.Sheet.Notes", 4)] }
      ]
    });
  }
}

/* -------------------------------------------- */
/*  Лист NPC                                    */
/* -------------------------------------------- */

export class NpcSheet extends SheetMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = { classes: ["sb-npc"], position: { width: 640 } };
  static PARTS = { sheet: { template: `${TPL}/npc.hbs`, scrollable: [".sb-body"] } };
  static DROP_TYPES = ["weapon", "armor", "ammo", "mod", "gear", "effect"];

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor, sys = actor.system, F = fieldKit(actor);
    const chips = Object.keys(SCUMBAGS.skills).filter(k => sys.skills[k].level > 0).map(k => ({
      key: k, label: L(`SCUMBAGS.Skill.${k}`), level: sys.skills[k].level, total: signed(sys.skills[k].total)
    })).sort((a, b) => a.label.localeCompare(b.label));
    return Object.assign(context, {
      actor, system: sys, editable: this.isEditable, ui: this._ui,
      stats: SCUMBAGS.stats.map(k => ({ key: k, label: L(`SCUMBAGS.Stat.${k}`), value: sys.stats[k] })),
      chips, columns: this._ui.skills ? skillRows(sys, { compact: true }) : null,
      weapons: byType(actor, "weapon").map(i => weaponRow(actor, i)),
      other: actor.items.filter(i => !["weapon", "effect"].includes(i.type)).map(plainRow),
      effects: byType(actor, "effect").map(effectRow),
      armor: ["body", "head", "shield"].map(k => ({ key: k, label: L(`SCUMBAGS.Armor.${k}`), value: sys.armor[k].value, max: sys.armor[k].max })),
      groups: [
        { label: L("SCUMBAGS.Sheet.Notes"), fields: [
          F.text("system.armorNote", "SCUMBAGS.Npc.ArmorNote", { cls: "half" }),
          F.sel("system.reputation", "SCUMBAGS.Sheet.Reputation", repOptions(), { cls: "half" }),
          F.area("system.gear", "SCUMBAGS.Npc.Gear", 2), F.area("system.notes", "SCUMBAGS.Npc.Special", 2),
          F.num("system.cash", "SCUMBAGS.Sheet.Cash", { cls: "half" }), F.num("system.card", "SCUMBAGS.Sheet.Card", { cls: "half" })
        ] }
      ]
    });
  }
}

/* -------------------------------------------- */
/*  Лист транспорта (техпаспорт)                */
/* -------------------------------------------- */

export class VehicleSheet extends SheetMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = { classes: ["sb-vehicle"], position: { width: 640 } };
  static PARTS = { sheet: { template: `${TPL}/vehicle.hbs`, scrollable: [".sb-body"] } };
  static DROP_TYPES = ["mod", "weapon", "gear"];

  tabGroups = { primary: "info" };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor, sys = actor.system, F = fieldKit(actor);
    const tab = this.tabGroups.primary;
    return Object.assign(context, {
      actor, system: sys, editable: this.isEditable, ui: this._ui,
      tabs: ["info", "settings"].map(id => ({ id, label: L(`SCUMBAGS.Tab.${id}`), active: tab === id })),
      on: { info: tab === "info", settings: tab === "settings" },
      classLabel: L(`SCUMBAGS.VehicleClass.${sys.vclass}`), statusLabel: L(`SCUMBAGS.VehicleStatus.${sys.status}`),
      handling: signed(sys.handling), priceOfficial: usd(sys.price.official), priceBlack: usd(sys.price.black),
      tires: ["fl", "fr", "rl", "rr"].map(k => ({ name: `system.tires.${k}`, label: L(`SCUMBAGS.Vehicle.Tire${k.toUpperCase()}`), value: sys.tires[k] })),
      items: actor.items.map(plainRow),
      groups: [
        { label: L("SCUMBAGS.Vehicle.Passport"), fields: [
          F.sel("system.vclass", "SCUMBAGS.Vehicle.Class", choices(SCUMBAGS.vehicleClasses, "SCUMBAGS.VehicleClass")),
          F.num("system.speed", "SCUMBAGS.Vehicle.Speed", { min: 0, max: 5 }),
          F.num("system.handling", "SCUMBAGS.Vehicle.Handling", { min: -2, max: 2 }),
          // Текущие ПЗ и броня правятся на вкладке «Информация»; здесь только максимум, иначе поле в форме дважды.
          F.num("system.hp.max", "SCUMBAGS.Vehicle.HPMax", { min: 0 }), F.num("system.armor.max", "SCUMBAGS.Vehicle.ArmorMax", { min: 0 }),
          F.num("system.seats", "SCUMBAGS.Vehicle.Seats", { min: 1 }),
          F.area("system.properties", "SCUMBAGS.Vehicle.Properties", 2), F.area("system.mods", "SCUMBAGS.Vehicle.Mods", 2)
        ] },
        { label: L("SCUMBAGS.Vehicle.Papers"), fields: [
          F.text("system.owner", "SCUMBAGS.Vehicle.Owner"),
          F.sel("system.status", "SCUMBAGS.Vehicle.Status", choices(SCUMBAGS.vehicleStatus, "SCUMBAGS.VehicleStatus")),
          F.text("system.plate", "SCUMBAGS.Vehicle.Plate"), F.text("system.registeredTo", "SCUMBAGS.Vehicle.RegisteredTo"),
          F.chk("system.reported", "SCUMBAGS.Vehicle.Reported"), F.chk("system.tracker", "SCUMBAGS.Vehicle.Tracker")
        ] },
        { label: L("SCUMBAGS.Vehicle.Consumables"), fields: [
          F.chk("system.spare", "SCUMBAGS.Vehicle.Spare"), F.num("system.nitro", "SCUMBAGS.Vehicle.Nitro", { min: 0 }),
          F.num("system.spikes", "SCUMBAGS.Vehicle.Spikes", { min: 0, max: 2 }), F.num("system.rockets", "SCUMBAGS.Vehicle.Rockets", { min: 0, max: 2 })
        ] },
        { label: L("SCUMBAGS.Item.Trade"), fields: [
          F.num("system.price.official", "SCUMBAGS.Item.PriceOfficial", { min: 0 }), F.num("system.price.black", "SCUMBAGS.Item.PriceBlack", { min: 0 })
        ] }
      ]
    });
  }
}

/* -------------------------------------------- */
/*  Лист бизнеса и подпольного предприятия      */
/* -------------------------------------------- */

export class BusinessSheet extends SheetMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = { classes: ["sb-business"], position: { width: 580 } };
  static PARTS = { sheet: { template: `${TPL}/business.hbs`, scrollable: [".sb-body"] } };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor, sys = actor.system, F = fieldKit(actor);
    const legal = sys.kind === "business";
    const groups = [{ label: L("SCUMBAGS.Business.About"), fields: [
      F.sel("system.kind", "SCUMBAGS.Business.Kind", choices(SCUMBAGS.businessKinds, "SCUMBAGS.BusinessKind")),
      F.text("system.type", "SCUMBAGS.Business.Type"), F.text("system.owner", "SCUMBAGS.Business.Owner"),
      F.text("system.location", "SCUMBAGS.Business.Location")
    ] }];
    if ( legal ) groups.push({ label: L("SCUMBAGS.BusinessKind.business"), fields: [
      F.sel("system.reputation", "SCUMBAGS.Sheet.Reputation", repOptions()), F.num("system.profit", "SCUMBAGS.Business.Profit"),
      F.num("system.total", "SCUMBAGS.Business.Total"), F.num("system.launders", "SCUMBAGS.Business.Launders"),
      F.area("system.special", "SCUMBAGS.Business.Special", 2)
    ] });
    else groups.push({ label: L("SCUMBAGS.BusinessKind.enterprise"), fields: [
      F.num("system.risk", "SCUMBAGS.Business.Risk", { min: 0, max: 3 }), F.num("system.income", "SCUMBAGS.Business.Income"),
      F.text("system.manager", "SCUMBAGS.Business.Manager"), F.num("system.share", "SCUMBAGS.Business.Share", { min: 0, max: 100 }),
      F.num("system.total", "SCUMBAGS.Business.Total"), F.area("system.problem", "SCUMBAGS.Business.Problem", 2)
    ] });
    groups.push({ label: L("SCUMBAGS.Sheet.Notes"), fields: [F.area("system.notes", "SCUMBAGS.Sheet.Notes", 4)] });
    return Object.assign(context, {
      actor, system: sys, editable: this.isEditable, groups, legal, kindLabel: L(`SCUMBAGS.BusinessKind.${sys.kind}`)
    });
  }
}

/* -------------------------------------------- */
/*  Лист предмета                               */
/* -------------------------------------------- */

export class ScumbagsItemSheet extends SheetMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = { classes: ["sb-item-sheet"], position: { width: 560 } };
  static PARTS = { sheet: { template: `${TPL}/item.hbs`, scrollable: [".sb-body"] } };

  tabGroups = { primary: "info" };

  /** Короткая сводка для вкладки «Информация». */
  _facts(item) {
    const s = item.system, fact = (label, value) => ({ label: L(label), value });
    switch ( item.type ) {
      case "weapon": return [
        fact("SCUMBAGS.Weapon.Damage", [s.damage, s.damageAlt].filter(Boolean).join(" / ") || (s.strength ? L("SCUMBAGS.Weapon.StrengthOnly") : "—")),
        s.usesAmmo ? fact("SCUMBAGS.Weapon.Magazine", `${s.magazine.value} / ${s.magazine.max}${s.loadedName ? ` · ${s.loadedName}` : ""}`) : null,
        s.quality !== "none" ? fact("SCUMBAGS.Weapon.Quality", L(`SCUMBAGS.Quality.${s.quality}`)) : null,
        fact("SCUMBAGS.Weapon.Skill", L(`SCUMBAGS.Skill.${s.skill}`)),
        s.properties ? fact("SCUMBAGS.Weapon.Properties", s.properties) : null
      ];
      case "armor": return [
        ...["body", "head", "shield"].filter(k => s[k].max).map(k => fact(`SCUMBAGS.Armor.${k}`, `${s[k].value} / ${s[k].max}`)),
        s.armorClass ? fact("SCUMBAGS.ArmorItem.Class", s.armorClass) : null,
        s.requires ? fact("SCUMBAGS.ArmorItem.Requires", s.requires) : null,
        s.penalty ? fact("SCUMBAGS.ArmorItem.Penalty", s.penalty) : null,
        s.visible ? fact("SCUMBAGS.ArmorItem.Visible", s.visible) : null
      ];
      case "ammo": return [
        fact("SCUMBAGS.Ammo.Kind", L(`SCUMBAGS.AmmoKind.${s.kind}`)), s.effect ? fact("SCUMBAGS.Item.Effect", s.effect) : null,
        fact("SCUMBAGS.Item.Quantity", s.quantity)
      ];
      case "mod": return [
        fact("SCUMBAGS.Mod.Target", L(`SCUMBAGS.ModTarget.${s.target}`)), s.appliesTo ? fact("SCUMBAGS.Mod.AppliesTo", s.appliesTo) : null,
        s.effect ? fact("SCUMBAGS.Item.Effect", s.effect) : null
      ];
      case "gear": return [
        fact("SCUMBAGS.Gear.Category", L(`SCUMBAGS.GearCategory.${s.category}`)), s.effect ? fact("SCUMBAGS.Item.Effect", s.effect) : null,
        fact("SCUMBAGS.Item.Quantity", s.quantity)
      ];
      case "effect": return [
        s.mod ? fact("SCUMBAGS.Roll.Modifier", signed(s.mod)) : null, fact("SCUMBAGS.Effect.Target", effectTargets()[s.target] ?? "")
      ];
    }
    return [];
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item = this.document, sys = item.system, F = fieldKit(item);
    const main = { label: L(`TYPES.Item.${item.type}`), fields: [] };
    switch ( item.type ) {
      case "weapon":
        main.fields.push(
          F.sel("system.category", "SCUMBAGS.Weapon.Category", choices(SCUMBAGS.weaponCategories, "SCUMBAGS.WeaponCategory")),
          F.sel("system.skill", "SCUMBAGS.Weapon.Skill", choices(Object.keys(SCUMBAGS.skills), "SCUMBAGS.Skill")),
          F.sel("system.rangeClass", "SCUMBAGS.Weapon.RangeClass", choices(SCUMBAGS.rangeClasses, "SCUMBAGS.RangeClass", L("SCUMBAGS.Weapon.NoRangeClass"))),
          F.text("system.damage", "SCUMBAGS.Weapon.Damage"), F.text("system.damageAlt", "SCUMBAGS.Weapon.DamageAlt"),
          F.chk("system.strength", "SCUMBAGS.Weapon.Strength"),
          F.pool("system.magazine", "SCUMBAGS.Weapon.Magazine"),
          F.sel("system.ammoKind", "SCUMBAGS.Weapon.AmmoKind", choices(SCUMBAGS.ammoKinds, "SCUMBAGS.AmmoKind", "—")),
          F.text("system.loadedName", "SCUMBAGS.Weapon.Loaded"),
          F.sel("system.quality", "SCUMBAGS.Weapon.Quality", choices(SCUMBAGS.qualities, "SCUMBAGS.Quality")),
          F.num("system.wear", "SCUMBAGS.Weapon.Wear", { min: 0, max: 3 }),
          F.num("system.minMuscle", "SCUMBAGS.Weapon.MinMuscle", { min: 0, max: 10 }),
          F.sel("system.legal", "SCUMBAGS.Weapon.Legal", choices(SCUMBAGS.legal, "SCUMBAGS.Legal", "—")),
          F.chk("system.equipped", "SCUMBAGS.Item.Equipped"), F.chk("system.loadedHalf", "SCUMBAGS.Weapon.LoadedHalf"),
          F.area("system.properties", "SCUMBAGS.Weapon.Properties", 2));
        break;
      case "armor":
        main.fields.push(
          F.text("system.armorClass", "SCUMBAGS.ArmorItem.Class"), F.chk("system.equipped", "SCUMBAGS.Item.Equipped"),
          F.text("system.visible", "SCUMBAGS.ArmorItem.Visible"),
          F.pool("system.body", "SCUMBAGS.Armor.body"), F.pool("system.head", "SCUMBAGS.Armor.head"),
          F.pool("system.shield", "SCUMBAGS.Armor.shield"),
          F.text("system.requires", "SCUMBAGS.ArmorItem.Requires", { cls: "half" }), F.text("system.penalty", "SCUMBAGS.ArmorItem.Penalty", { cls: "half" }));
        break;
      case "ammo":
        main.fields.push(
          F.sel("system.kind", "SCUMBAGS.Ammo.Kind", choices(SCUMBAGS.ammoKinds, "SCUMBAGS.AmmoKind")),
          F.chk("system.halfArmor", "SCUMBAGS.Ammo.HalfArmor"),
          F.num("system.diceMod", "SCUMBAGS.Ammo.DiceMod", { min: -3, max: 3 }), F.area("system.effect", "SCUMBAGS.Item.Effect", 2));
        break;
      case "mod":
        main.fields.push(
          F.sel("system.target", "SCUMBAGS.Mod.Target", choices(SCUMBAGS.modTargets, "SCUMBAGS.ModTarget")),
          F.text("system.appliesTo", "SCUMBAGS.Mod.AppliesTo"), F.chk("system.installed", "SCUMBAGS.Mod.Installed"),
          F.area("system.effect", "SCUMBAGS.Item.Effect", 3));
        if ( sys.target === "weapon" ) {
          const bands = { ...Object.fromEntries(SCUMBAGS.rangeBands.map((b, i) => [i, L(`SCUMBAGS.Range.${b}`)])), "-1": L("SCUMBAGS.Mod.AnyRange") };
          main.fields.push(
            F.num("system.attackBonus", "SCUMBAGS.Mod.AttackBonus"),
            F.sel("system.rangeMin", "SCUMBAGS.Mod.RangeMin", bands), F.sel("system.rangeMax", "SCUMBAGS.Mod.RangeMax", bands));
        }
        break;
      case "gear":
        main.fields.push(
          F.sel("system.category", "SCUMBAGS.Gear.Category", choices(SCUMBAGS.gearCategories, "SCUMBAGS.GearCategory")),
          F.area("system.effect", "SCUMBAGS.Item.Effect", 3));
        break;
      case "effect":
        main.fields.push(
          F.num("system.mod", "SCUMBAGS.Roll.Modifier"), F.sel("system.target", "SCUMBAGS.Effect.Target", effectTargets()),
          F.chk("system.active", "SCUMBAGS.Effect.Active"));
        break;
    }
    const groups = [main];
    const priced = item.type !== "effect";
    if ( priced ) groups.push({ label: L("SCUMBAGS.Item.Trade"), fields: [
      F.num("system.price.official", "SCUMBAGS.Item.PriceOfficial", { min: 0 }),
      F.num("system.price.black", "SCUMBAGS.Item.PriceBlack", { min: 0 }),
      F.num("system.quantity", "SCUMBAGS.Item.Quantity", { min: 0 })
    ] });
    const tab = this.tabGroups.primary;
    return Object.assign(context, {
      item, system: sys, editable: this.isEditable, ui: this._ui, groups, typeLabel: L(`TYPES.Item.${item.type}`),
      tabs: ["info", "settings"].map(id => ({ id, label: L(`SCUMBAGS.Tab.${id}`), active: tab === id })),
      on: { info: tab === "info", settings: tab === "settings" },
      facts: this._facts(item).filter(Boolean),
      priced, priceOfficial: priced ? usd(sys.price.official) : "", priceBlack: priced ? usd(sys.price.black) : ""
    });
  }
}

/** Регистрация листов: общий код для Foundry 12 и 13+. */
export function registerSheets() {
  const coll = foundry.documents?.collections ?? {};
  const ActorsC = coll.Actors ?? Actors;
  const ItemsC = coll.Items ?? Items;
  // В Foundry 12 это глобальные классы (не свойства globalThis).
  const v1 = foundry.appv1?.sheets ?? { ActorSheet, ItemSheet };
  ActorsC.unregisterSheet("core", v1.ActorSheet);
  ItemsC.unregisterSheet("core", v1.ItemSheet);
  if ( gen() >= 13 ) {
    ActorsC.unregisterSheet("core", ActorSheetV2);
    ItemsC.unregisterSheet("core", ItemSheetV2);
  }
  const reg = (C, cls, types, label) => C.registerSheet("scumbags", cls, { types, makeDefault: true, label });
  reg(ActorsC, CharacterSheet, ["character"], "SCUMBAGS.SheetName.character");
  reg(ActorsC, NpcSheet, ["npc"], "SCUMBAGS.SheetName.npc");
  reg(ActorsC, VehicleSheet, ["vehicle"], "SCUMBAGS.SheetName.vehicle");
  reg(ActorsC, BusinessSheet, ["business"], "SCUMBAGS.SheetName.business");
  reg(ItemsC, ScumbagsItemSheet, Object.keys(CONFIG.Item.dataModels), "SCUMBAGS.SheetName.item");
}
