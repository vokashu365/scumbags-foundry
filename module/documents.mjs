/** Классы документов: картинки по умолчанию, урон по цели, броски. */
import { SCUMBAGS } from "./config.mjs";
import * as rolls from "./rolls.mjs";

export class ScumbagsActor extends Actor {
  /** Силуэт вместо «загадочного человека»; жетон — силуэт на залитом круге. */
  static getDefaultArtwork(actorData) {
    const type = actorData?.type;
    const img = SCUMBAGS.silhouettes.actor[type] ?? SCUMBAGS.silhouettes.actor.character;
    return { img, texture: { src: SCUMBAGS.tokens[type] ?? img } };
  }

  /** @override */
  async _preCreate(data, options, user) {
    const allowed = await super._preCreate(data, options, user);
    if ( allowed === false ) return false;
    const given = data.prototypeToken ?? {};
    const proto = {};
    const linked = (this.type === "character") || (this.type === "vehicle");
    if ( linked && !("actorLink" in given) ) proto.actorLink = true;
    if ( (this.type === "character") && !("disposition" in given) ) proto.disposition = CONST.TOKEN_DISPOSITIONS.FRIENDLY;
    if ( (this.type === "vehicle") && !("disposition" in given) ) proto.disposition = CONST.TOKEN_DISPOSITIONS.NEUTRAL;
    if ( (this.type !== "business") && !("bar1" in given) ) {
      proto.bar1 = { attribute: "hp" };
      proto.displayBars = CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER;
    }
    if ( Object.keys(proto).length ) this.updateSource({ prototypeToken: proto });
  }

  /** @override */
  async _preUpdate(changed, options, user) {
    const allowed = await super._preUpdate(changed, options, user);
    if ( allowed === false ) return false;
    if ( this.type === "character" ) this._enforceTree(changed);
    if ( ("name" in changed) && (changed.name !== this.name) ) options.sbOldName = this.name;
  }

  /** Транспорт записан на персонажа по имени: переименовали персонажа — переписываем и машины. */
  _onUpdate(changed, options, userId) {
    super._onUpdate(changed, options, userId);
    if ( (this.type !== "character") || !options.sbOldName || (game.user.id !== userId) ) return;
    for ( const v of game.actors ) {
      if ( (v.type === "vehicle") && (v.system.owner === options.sbOldName) && v.isOwner ) v.update({ "system.owner": this.name });
    }
  }

  /**
   * Правило древа: развилка «ИЛИ» закрывает второй путь.
   * Отметили один узел развилки — второй и все узлы его пути выше снимаются.
   */
  _enforceTree(changed) {
    for ( const [key, data] of Object.entries(changed.system?.archetypes ?? {}) ) {
      const nodes = data?.nodes;
      const tree = SCUMBAGS.trees[key];
      const fork = tree?.rows.find(r => r.fork === "or");
      if ( !nodes || !fork ) continue;
      const current = this.system.archetypes[key].nodes ?? {};
      for ( const id of fork.nodes ) {
        if ( (nodes[id] !== true) || (current[id] === true) ) continue;
        const other = fork.nodes.find(n => n !== id);
        const side = other.slice(-1);
        nodes[other] = false;
        for ( const r of tree.rows ) {
          if ( (r.n > fork.n) && (r.fork === "path") ) for ( const n of r.nodes ) if ( n.endsWith(side) ) nodes[n] = false;
        }
      }
    }
  }

  /** Данные для формул: у транспорта и бизнеса нет характеристик, инициатива не должна ломаться. */
  getRollData() {
    const data = { ...this.system };
    data.initBonus ??= 0;
    data.stats ??= { muscle: 0, reflexes: 0, brains: 0, cool: 0 };
    return data;
  }

  /* -------------------------------------------- */

  /**
   * Броня цели в зоне попадания: значение и способ снять единицу.
   * Персонаж носит броню предметами, у NPC и транспорта она записана числом.
   */
  getArmor(location = "body") {
    const sys = this.system;
    if ( this.type === "character" ) {
      const a = sys.armor?.[location];
      const item = a ? this.items.get(a.itemId) : null;
      if ( !item ) return { value: 0, wear: null };
      return { value: a.value, wear: () => item.update({ [`system.${location}.value`]: Math.max(0, a.value - 1) }) };
    }
    if ( this.type === "npc" ) {
      const value = sys.armor[location]?.value ?? 0;
      return { value, wear: () => this.update({ [`system.armor.${location}.value`]: Math.max(0, value - 1) }) };
    }
    if ( this.type === "vehicle" ) {
      const value = sys.armor.value;
      return { value, wear: () => this.update({ "system.armor.value": Math.max(0, value - 1) }) };
    }
    return { value: 0, wear: null };
  }

  /**
   * Нанести урон: броня поглощает, попадание снимает минимум 1 ПЗ, броня после попадания теряет 1.
   * @param {object} o
   * @param {number} o.amount       Урон броска
   * @param {"body"|"head"} [o.location]
   * @param {boolean} [o.half]      Игнорировать половину брони (остаток округляется вверх)
   * @param {boolean} [o.double]    Урон ×2 — прицельное попадание в голову
   */
  async applyDamage({ amount, location = "body", half = false, double = false }) {
    if ( !("hp" in this.system) ) return null;
    const armor = this.getArmor(location);
    const soak = half ? Math.ceil(armor.value / 2) : armor.value;
    const taken = Math.max(1, (amount * (double ? 2 : 1)) - soak);
    const hp0 = this.system.hp.value;
    const hp1 = Math.max(0, hp0 - taken);
    await this.update({ "system.hp.value": hp1 });
    if ( armor.value > 0 ) await armor.wear?.();
    return { name: this.name, taken, soak, hp0, hp1, armor0: armor.value, armor1: Math.max(0, armor.value - (armor.value > 0 ? 1 : 0)) };
  }

  /* -------------------------------------------- */

  rollStat(stat, options) { return rolls.rollSkill(this, { stat, ...options }); }
  rollSkill(key, options) { return rolls.rollSkill(this, { key, ...options }); }
  rollCustomSkill(group, slot, options) { return rolls.rollSkill(this, { custom: { group, slot }, ...options }); }
  rollAttack(item, options) { return rolls.rollAttack(this, item, options); }
  rollDamage(item, options) { return rolls.rollDamage(this, item, options); }
  reloadWeapon(item, options) { return rolls.reloadWeapon(this, item, options); }
}

export class ScumbagsItem extends Item {
  /** Силуэт по типу и категории предмета. */
  static getDefaultArtwork(itemData) {
    return { img: SCUMBAGS.itemSilhouette(itemData?.type, itemData?.system ?? {}) };
  }

  /** Пока своя картинка не выбрана, силуэт следует за категорией. */
  async _preUpdate(changed, options, user) {
    const allowed = await super._preUpdate(changed, options, user);
    if ( allowed === false ) return false;
    const sys = changed.system ?? {};
    if ( ("img" in changed) || !SCUMBAGS.isSilhouette(this.img) ) return;
    if ( !("category" in sys) && !("target" in sys) ) return;
    const img = SCUMBAGS.itemSilhouette(this.type, {
      category: sys.category ?? this.system.category, target: sys.target ?? this.system.target
    });
    if ( img !== this.img ) changed.img = img;
  }
}
