/** Модели данных актёров и предметов. */
import { SCUMBAGS } from "./config.mjs";

const f = foundry.data.fields;
const num = (initial = 0, opts = {}) => new f.NumberField({ required: true, nullable: false, integer: true, initial, ...opts });
const str = (initial = "") => new f.StringField({ required: true, blank: true, initial });
const bool = (initial = false) => new f.BooleanField({ required: true, initial });
const pick = (choices, initial) => new f.StringField({ required: true, blank: !initial, initial: initial ?? "", choices: initial ? choices : ["", ...choices] });
const pool = (value = 0, max = 0) => new f.SchemaField({ value: num(value, { min: 0 }), max: num(max, { min: 0 }) });
const money = () => new f.NumberField({ required: true, nullable: true, integer: true, initial: null, min: 0 });
const statBlock = () => new f.SchemaField(Object.fromEntries(SCUMBAGS.stats.map(s => [s, num(5, { min: 1, max: 10 })])));
// языки: родной даёт 4 бесплатно (поле native)
const langBlock = keys => new f.SchemaField(Object.fromEntries(keys.map(k => [k, new f.SchemaField({
  name: str(), level: num(0, { min: 0, max: 10 }), native: bool()
})])));
const slotBlock = keys => new f.SchemaField(Object.fromEntries(keys.map(k => [k, new f.SchemaField({ name: str(), level: num(0, { min: 0, max: 10 }) })])));
const skillBlock = () => new f.SchemaField(Object.fromEntries(Object.entries(SCUMBAGS.skills).map(([k, v]) =>
  [k, new f.SchemaField({ level: num(v.base ?? 0, { min: 0, max: 10 }) })])));
const priceBlock = () => new f.SchemaField({ official: money(), black: money() });

/** Итог навыка: характеристика + уровень. */
function prepareSkills(sys) {
  for ( const [k, s] of Object.entries(sys.skills) ) {
    s.stat = SCUMBAGS.skills[k].stat;
    s.total = sys.stats[s.stat] + s.level;
  }
}

/* -------------------------------------------- */
/*  Актёры                                      */
/* -------------------------------------------- */

export class CharacterData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      alias: str(), concept: str(), origin: str(), appearance: str(), player: str(),
      stats: statBlock(),
      luck: new f.SchemaField({ value: num(2, { min: 0 }) }),
      hp: new f.SchemaField({ value: num(20, { min: 0 }), bonus: num(0) }),
      conditions: new f.SchemaField({ seriousWound: bool(), unconscious: bool(), dying: num(0, { min: 0, max: 3 }) }),
      injuries: new f.SchemaField({ armL: bool(), armR: bool(), legL: bool(), legR: bool() }),
      wanted: num(0, { min: 0, max: 5 }),
      reputation: num(0, { min: -2, max: 2 }),
      xp: num(0, { min: 0 }),
      skills: skillBlock(),
      languages: langBlock(SCUMBAGS.customSkills.languages.slots),
      sciences: slotBlock(SCUMBAGS.customSkills.sciences.slots),
      instruments: slotBlock(SCUMBAGS.customSkills.instruments.slots),
      archetypes: new f.SchemaField(Object.fromEntries(SCUMBAGS.archetypes.map(a => [a, new f.SchemaField({
        active: bool(), nodes: new f.ObjectField(), used: new f.ObjectField()
      })]))),
      money: new f.SchemaField({ cash: num(0), card: num(0), housing: str(), lifestyle: str(), debts: str() }),
      law: new f.SchemaField({
        fbiAssigned: bool(), fbiTemper: str(), fbiEvidence: num(0, { min: 0, max: 5 }), record: str(),
        gunLicense: bool(), fakeId: str()
      }),
      contacts: str(), notes: str(),
      bio: new f.SchemaField({
        main: str(), goals: str(), childhood: str(), story: str(), friends: str(), enemies: str(), lovers: str()
      }),
      followers: num(0, { min: 0 }),
      precinctTrust: num(0, { min: 0, max: 3 })
    };
  }

  /** Взята ли способность: узел отмечен в древе добавленного архетипа. */
  hasAbility(archetype, node) {
    const a = this.archetypes[archetype];
    return !!a?.active && (a.nodes?.[node] === true);
  }

  prepareDerivedData() {
    const st = this.stats;
    // «Железное тело» (Боевик 7Б): +10 к максимуму ПЗ.
    this.hp.max = 10 + (st.muscle * 2) + this.hp.bonus + (this.hasAbility("enforcer", "7b") ? 10 : 0);
    // «Фартовый» и «Величайшая афера» (Мошенник 5 и 10): третье и четвёртое очко Фарта.
    this.luck.max = 2 + (this.hasAbility("grifter", "5a") ? 1 : 0) + (this.hasAbility("grifter", "10a") ? 1 : 0);
    // «Реакция» (Боевик 3): +4 к Инициативе.
    this.initBonus = this.hasAbility("enforcer", "3a") ? 4 : 0;
    Object.assign(this, SCUMBAGS.physique(st.muscle));
    prepareSkills(this);
    for ( const [group, cfg] of Object.entries(SCUMBAGS.customSkills) ) {
      for ( const s of Object.values(this[group]) ) s.total = st[cfg.stat] + s.level;
    }
    // Броня — с надетых предметов: по каждой зоне берётся лучший.
    const armor = { body: null, head: null, shield: null };
    for ( const item of this.parent?.items ?? [] ) {
      if ( (item.type !== "armor") || !item.system.equipped ) continue;
      for ( const loc of Object.keys(armor) ) {
        const a = item.system[loc];
        if ( !a?.max ) continue;
        if ( !armor[loc] || (a.value > armor[loc].value) ) armor[loc] = { value: a.value, max: a.max, itemId: item.id, name: item.name };
      }
    }
    this.armor = armor;
    // Уровень архетипа — число отмеченных способностей.
    for ( const key of SCUMBAGS.archetypes ) {
      const a = this.archetypes[key];
      const ids = SCUMBAGS.trees[key].rows.flatMap(r => r.nodes);
      a.level = a.active ? ids.filter(id => a.nodes?.[id] === true).length : 0;
    }
  }
}

export class NpcData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      stats: statBlock(),
      hp: new f.SchemaField({ value: num(15, { min: 0 }) }),
      skills: skillBlock(),
      conditions: new f.SchemaField({ seriousWound: bool() }),
      armor: new f.SchemaField({ body: pool(), head: pool(), shield: pool() }),
      armorNote: str(),
      cash: num(0), card: num(0), reputation: num(0, { min: -2, max: 2 }),
      gear: str(), notes: str()
    };
  }

  hasAbility() { return false; }

  prepareDerivedData() {
    this.hp.max = 10 + this.stats.muscle;
    this.initBonus = 0;
    Object.assign(this, SCUMBAGS.physique(this.stats.muscle));
    prepareSkills(this);
  }
}

export class VehicleData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: str(), price: priceBlock(), owner: str(),
      vclass: pick(SCUMBAGS.vehicleClasses, "cars"),
      speed: num(1, { min: 0, max: 5 }), handling: num(0, { min: -2, max: 2 }),
      hp: pool(30, 30), armor: pool(), seats: num(4, { min: 1 }),
      properties: str(), mods: str(),
      status: pick(SCUMBAGS.vehicleStatus, "own"), reported: bool(), plate: str(), registeredTo: str(),
      tires: new f.SchemaField({ fl: bool(), fr: bool(), rl: bool(), rr: bool() }),
      spare: bool(true), tracker: bool(),
      nitro: num(0, { min: 0 }), spikes: num(0, { min: 0, max: 2 }), rockets: num(0, { min: 0, max: 2 })
    };
  }
}

export class BusinessData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      kind: pick(SCUMBAGS.businessKinds, "business"),
      owner: str(), type: str(), location: str(),
      reputation: num(0, { min: -2, max: 2 }), profit: num(0), total: num(0), launders: num(0), special: str(),
      risk: num(0, { min: 0, max: 3 }), income: num(0), manager: str(), share: num(0, { min: 0, max: 100 }), problem: str(),
      notes: str()
    };
  }
}

/* -------------------------------------------- */
/*  Предметы                                    */
/* -------------------------------------------- */

const common = () => ({ description: str(), price: priceBlock(), quantity: num(1, { min: 0 }) });

export class WeaponData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...common(),
      category: pick(SCUMBAGS.weaponCategories, "pistols"),
      rangeClass: pick(SCUMBAGS.rangeClasses),
      skill: pick(Object.keys(SCUMBAGS.skills), "handguns"),
      damage: str("2d6"), damageAlt: str(),
      strength: bool(),
      magazine: pool(),
      ammoKind: pick(SCUMBAGS.ammoKinds),
      loadedName: str(), loadedHalf: bool(), loadedEffect: str(), loadedDice: num(0),
      quality: pick(SCUMBAGS.qualities, "normal"),
      wear: num(0, { min: 0, max: 3 }),
      properties: str(),
      minMuscle: num(0, { min: 0, max: 10 }),
      legal: pick(SCUMBAGS.legal),
      equipped: bool()
    };
  }

  /** Оружие без магазина патроны не тратит. */
  get usesAmmo() { return this.magazine.max > 0; }
  get isAuto() { return /автоогонь|full.?auto/i.test(this.properties); }
  get isMelee() { return this.category === "melee"; }
  /** Осечка: Ширпотреб или Обычное с тремя метками износа. */
  get jams() { return (this.quality === "cheap") || ((this.quality === "normal") && (this.wear >= 3)); }
  /** Половина брони: холодное оружие, Бронебойное оружие и бронебойные патроны. */
  get halfArmor() {
    if ( this.isMelee && /\dd6/i.test(this.damage) ) return true;
    return /бронебойн|armou?r.?piercing/i.test(this.properties) || this.loadedHalf;
  }
}

export class ArmorData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...common(),
      armorClass: str(),
      body: pool(), head: pool(), shield: pool(),
      requires: str(), penalty: str(), visible: str(),
      equipped: bool()
    };
  }
}

export class AmmoData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    // diceMod: резиновые пули — на один кубик урона меньше.
    return { ...common(), kind: pick(SCUMBAGS.ammoKinds, "pistol"), halfArmor: bool(), diceMod: num(0), effect: str() };
  }
}

export class ModData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...common(), target: pick(SCUMBAGS.modTargets, "weapon"), appliesTo: str(), effect: str(), installed: bool(),
      // На каком оружии актёра стоит модификация и что она даёт броску атаки.
      attachedTo: str(), attackBonus: num(0),
      // Дистанции, на которых бонус действует: номера столбцов таблицы дистанций, −1 — без ограничения.
      rangeMin: num(-1, { min: -1, max: 7 }), rangeMax: num(-1, { min: -1, max: 7 })
    };
  }

  /** Действует ли бонус на выбранной дистанции (null — дистанция не выбрана). */
  inRange(band) {
    if ( (this.rangeMin < 0) && (this.rangeMax < 0) ) return true;
    if ( band === null ) return false;
    return ((this.rangeMin < 0) || (band >= this.rangeMin)) && ((this.rangeMax < 0) || (band <= this.rangeMax));
  }
}

export class GearData extends foundry.abstract.TypeDataModel {
  static defineSchema() { return { ...common(), category: pick(SCUMBAGS.gearCategories, "other"), effect: str() }; }
}

/** Эффект на персонаже: опьянение, ранение и т. п. Модификатор идёт к подходящим броскам. */
export class EffectData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return { description: str(), mod: num(0), target: str("all"), active: bool(true) };
  }

  /** Действует ли эффект на бросок: all, attack, stat:<ключ>, skill:<ключ>. */
  applies(ctx) {
    const t = this.target;
    if ( t === "all" ) return true;
    if ( t === "attack" ) return ctx.kind === "attack";
    if ( t.startsWith("stat:") ) return ctx.stat === t.slice(5);
    if ( t.startsWith("skill:") ) return ctx.skill === t.slice(6);
    return false;
  }
}

export const actorModels = { character: CharacterData, npc: NpcData, vehicle: VehicleData, business: BusinessData };
export const itemModels = {
  weapon: WeaponData, armor: ArmorData, ammo: AmmoData, mod: ModData, gear: GearData, effect: EffectData
};
