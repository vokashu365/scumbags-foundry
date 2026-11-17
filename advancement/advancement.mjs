/**
 * Развитие персонажа: распределение опыта по навыкам и очкам развития архетипов с автоматическим подсчётом.
 *
 * Правила (кор-механика, разделы 11–12):
 * - на старте 1000 XP на навыки, потолок навыка при создании — 6, дальше — 10;
 * - уровень навыка N стоит N × 10 XP, поднять навык с 0 до N — 5 × N × (N + 1);
 * - базовые навыки стоят на 2 бесплатно, родной язык — 4, английский — не ниже 2 бесплатно;
 * - три очка развития бесплатно (схема 3-0 или 2-1), каждое следующее — 100 XP;
 * - характеристики при создании: 25 очков, каждая от 2 до 10.
 * Бюджет = 1000 + опыт, полученный в игре (поле «Опыт» на листе).
 */
import { SCUMBAGS } from "../module/config.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;
const L = key => game.i18n.localize(key);
const F = (key, data) => game.i18n.format(key, data);

export const ADV = {
  startXP: 1000, startCap: 6, maxLevel: 10, pointCost: 100, freePoints: 3,
  statPoints: 25, statMin: 2, statMax: 10
};

/** Сколько стоит поднять навык с 0 до уровня l. */
export const skillCost = l => 5 * l * (l + 1);

const ENGLISH = /^(английский|english)$/i;

/** Бесплатный уровень языка: родной — 4, английский — 2, остальные — 0. */
export function languageBase(slot) {
  if ( slot.native ) return 4;
  return ENGLISH.test(String(slot.name ?? "").trim()) ? 2 : 0;
}

/** Черновик из данных актёра (простые объекты, чтобы править без записи в документ). */
export function draftFrom(actor) {
  const s = actor.system;
  const copy = obj => foundry.utils.deepClone(obj);
  const archetypes = {};
  for ( const key of SCUMBAGS.archetypes ) {
    const a = s.archetypes[key];
    archetypes[key] = Object.fromEntries(Object.entries(a.active ? (a.nodes ?? {}) : {}).filter(([, v]) => v === true));
  }
  return {
    stats: copy(s.stats),
    skills: Object.fromEntries(Object.entries(s.skills).map(([k, v]) => [k, v.level])),
    languages: copy(s.languages), sciences: copy(s.sciences), instruments: copy(s.instruments),
    archetypes, earned: s.xp ?? 0,
    creation: (s.xp ?? 0) === 0
  };
}

/** Подсчёт: что сколько стоит, сколько осталось, что нарушает правила. */
export function tally(d) {
  const cap = d.creation ? ADV.startCap : ADV.maxLevel;
  const problems = [];
  let skillsXP = 0;
  for ( const [key, level] of Object.entries(d.skills) ) {
    const base = SCUMBAGS.skills[key]?.base ?? 0;
    if ( level < base ) problems.push(F("SCUMBAGS.Adv.BelowBase", { name: L(`SCUMBAGS.Skill.${key}`), base }));
    else skillsXP += skillCost(level) - skillCost(base);
    if ( level > cap ) problems.push(F("SCUMBAGS.Adv.OverCap", { name: L(`SCUMBAGS.Skill.${key}`), cap }));
  }
  let natives = 0, english = false;
  for ( const slot of Object.values(d.languages) ) {
    if ( !slot.name?.trim() && !slot.level ) continue;
    const base = languageBase(slot);
    if ( slot.native ) natives++;
    if ( ENGLISH.test(String(slot.name ?? "").trim()) && (slot.level >= 2) ) english = true;
    skillsXP += Math.max(0, skillCost(slot.level) - skillCost(base));
    if ( slot.level < base ) problems.push(F("SCUMBAGS.Adv.LangBelowBase", { name: slot.name || "?", base }));
    if ( slot.level > Math.max(cap, slot.native ? 4 : 0) ) problems.push(F("SCUMBAGS.Adv.OverCap", { name: slot.name || "?", cap }));
  }
  for ( const group of ["sciences", "instruments"] ) {
    for ( const slot of Object.values(d[group]) ) {
      skillsXP += skillCost(slot.level);
      if ( slot.level && !slot.name?.trim() ) problems.push(L(`SCUMBAGS.Adv.NoName.${group}`));
      if ( slot.level > cap ) problems.push(F("SCUMBAGS.Adv.OverCap", { name: slot.name || "?", cap }));
    }
  }
  if ( natives !== 1 ) problems.push(L("SCUMBAGS.Adv.OneNative"));
  if ( !english ) problems.push(L("SCUMBAGS.Adv.English"));

  const counts = Object.fromEntries(SCUMBAGS.archetypes.map(k => [k, Object.values(d.archetypes[k]).filter(v => v === true).length]));
  const points = Object.values(counts).reduce((a, b) => a + b, 0);
  const extra = Math.max(0, points - ADV.freePoints);
  const pointsXP = extra * ADV.pointCost;
  if ( d.creation ) {
    const used = Object.values(counts).filter(n => n > 0).sort((a, b) => b - a);
    if ( (points === ADV.freePoints) && !["3", "2,1"].includes(used.join(",")) ) problems.push(L("SCUMBAGS.Adv.Scheme"));
    const sum = SCUMBAGS.stats.reduce((a, k) => a + d.stats[k], 0);
    if ( sum !== ADV.statPoints ) problems.push(F("SCUMBAGS.Adv.StatSum", { sum, need: ADV.statPoints }));
  }
  const budget = ADV.startXP + d.earned;
  const spent = skillsXP + pointsXP;
  if ( spent > budget ) problems.push(F("SCUMBAGS.Adv.Over", { n: spent - budget }));
  return {
    cap, budget, spent, left: budget - spent, skillsXP, pointsXP, points, extra,
    freeLeft: Math.max(0, ADV.freePoints - points), counts,
    statSum: SCUMBAGS.stats.reduce((a, k) => a + d.stats[k], 0), problems
  };
}

/** Свободный опыт персонажа — для листа. */
export function freeXP(actor) {
  return tally(draftFrom(actor)).left;
}

/** Древо: уровень открыт, если взят узел предыдущего; «ИЛИ» закрывает второй путь. Лишнее снимается. */
function normalizeTree(key, nodes) {
  const tree = SCUMBAGS.trees[key];
  const fork = tree.rows.find(r => r.fork === "or");
  const side = fork ? fork.nodes.find(id => nodes[id])?.slice(-1) : null;
  let open = true;
  for ( const row of tree.rows ) {
    for ( const id of row.nodes ) {
      const offPath = fork && side && (row.n >= fork.n) && (row.fork === "or" || row.fork === "path") && !id.endsWith(side);
      if ( !open || offPath ) delete nodes[id];
    }
    if ( !row.nodes.some(id => nodes[id]) ) open = false;
  }
}

/* -------------------------------------------- */

export class AdvancementApp extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this.actor = options.actor;
    this.draft = draftFrom(this.actor);
    this.tab = this.draft.creation ? "stats" : "skills";
    this.arch = SCUMBAGS.archetypes.find(k => Object.keys(this.draft.archetypes[k]).length) ?? "enforcer";
  }

  static DEFAULT_OPTIONS = {
    classes: ["scumbags", "sb-sheet", "sb-adv"],
    window: { resizable: true, icon: "fa-solid fa-arrow-trend-up" },
    position: { width: 1060, height: "auto" },
    actions: {
      inc: AdvancementApp.#inc, dec: AdvancementApp.#dec, node: AdvancementApp.#node, advTab: AdvancementApp.#tab,
      arch: AdvancementApp.#arch, reset: AdvancementApp.#reset, apply: AdvancementApp.#apply, cancel: AdvancementApp.#cancel
    }
  };

  static PARTS = { main: { template: `${SCUMBAGS.path}/advancement/advancement.hbs`, scrollable: [".adv-body"] } };

  get title() { return F("SCUMBAGS.Adv.Title", { name: this.actor.name }); }

  /** @override */
  async _prepareContext() {
    const d = this.draft, t = tally(d);
    const abbr = k => L(`SCUMBAGS.StatAbbr.${k}`);
    const levelRow = (level, base, max) => ({ level, canDec: level > base, canInc: level < max });
    const columns = SCUMBAGS.skillColumns.map(col => col.map(g => {
      const named = (g.skills ?? []).map(key => {
        const base = SCUMBAGS.skills[key].base ?? 0, level = d.skills[key];
        return {
          kind: "skill", key, label: L(`SCUMBAGS.Skill.${key}`), abbr: abbr(SCUMBAGS.skills[key].stat), base,
          cost: Math.max(0, skillCost(level) - skillCost(base)), next: level < t.cap ? (level + 1) * 10 : null,
          ...levelRow(level, base, t.cap), raised: level > base
        };
      });
      const custom = (g.custom ?? []).flatMap(group => SCUMBAGS.customSkills[group].slots.map(slot => {
        const s = d[group][slot];
        const base = group === "languages" ? languageBase(s) : 0;
        const max = Math.max(t.cap, group === "languages" && s.native ? 4 : 0);
        return {
          kind: "custom", custom: true, group, slot, name: s.name, native: !!s.native, isLang: group === "languages",
          placeholder: L(`SCUMBAGS.Custom.${group}`), abbr: abbr(SCUMBAGS.customSkills[group].stat), base,
          cost: Math.max(0, skillCost(s.level) - skillCost(base)), next: s.level < max ? (s.level + 1) * 10 : null,
          ...levelRow(s.level, base, max), raised: s.level > base
        };
      }));
      return { label: L(`SCUMBAGS.SkillGroup.${g.id}`), rows: g.id === "music" ? [...custom, ...named] : [...named, ...custom] };
    }));
    const tree = SCUMBAGS.trees[this.arch];
    const nodes = d.archetypes[this.arch];
    const fork = tree.rows.find(r => r.fork === "or");
    const side = fork ? fork.nodes.find(id => nodes[id])?.slice(-1) : null;
    let open = true;
    const rows = tree.rows.map(r => {
      const row = {
        n: r.n, fork: r.fork === "and" ? L("SCUMBAGS.Tree.And") : r.fork === "or" ? L("SCUMBAGS.Tree.Or") : "",
        nodes: r.nodes.map(id => {
          const taken = nodes[id] === true;
          const closed = fork && side && (r.n >= fork.n) && (r.fork === "or" || r.fork === "path") && !id.endsWith(side);
          return {
            id, taken, disabled: !taken && (!open || closed),
            name: L(`SCUMBAGS.Tree.${this.arch}.${id}.name`), desc: L(`SCUMBAGS.Tree.${this.arch}.${id}.desc`)
          };
        })
      };
      if ( !r.nodes.some(id => nodes[id]) ) open = false;
      return row;
    });
    return {
      d, t, ok: !t.problems.length, overBudget: t.left < 0,
      tabs: ["stats", "skills", "archetypes"].map(id => ({ id, label: L(`SCUMBAGS.Adv.Tab.${id}`), active: this.tab === id })),
      on: { stats: this.tab === "stats", skills: this.tab === "skills", archetypes: this.tab === "archetypes" },
      stats: SCUMBAGS.stats.map(k => ({
        key: k, label: L(`SCUMBAGS.Stat.${k}`), value: d.stats[k],
        canDec: d.creation && d.stats[k] > ADV.statMin, canInc: d.creation && d.stats[k] < ADV.statMax
      })),
      statsLeft: ADV.statPoints - t.statSum,
      hpMax: 10 + d.stats.muscle * 2,
      columns,
      archList: SCUMBAGS.archetypes.map(k => ({ key: k, label: L(`SCUMBAGS.Archetype.${k}`), count: t.counts[k], active: k === this.arch })),
      archLabel: L(`SCUMBAGS.Archetype.${this.arch}`), rows
    };
  }

  /** @override */
  async _onRender(context, options) {
    await super._onRender(context, options);
    const root = this.element;
    for ( const el of root.querySelectorAll("[data-draft]") ) {
      el.addEventListener("change", () => {
        const path = el.dataset.draft;
        const value = el.type === "checkbox" ? el.checked : el.type === "number" ? (Number(el.value) || 0) : el.value;
        if ( path.endsWith(".native") && value ) {
          // родной язык один: отметили новый — с остальных флажок снимается
          for ( const s of Object.values(this.draft.languages) ) s.native = false;
        }
        foundry.utils.setProperty(this.draft, path, value);
        // родной язык и английский сразу встают на свой бесплатный уровень
        const m = /^languages\.(\w+)\./.exec(path);
        if ( m ) {
          const slot = this.draft.languages[m[1]];
          slot.level = Math.max(slot.level, languageBase(slot));
        }
        this.render();
      });
    }
  }

  _change(target, delta) {
    const d = this.draft, t = tally(d);
    const { kind, key, group, slot } = target.dataset;
    if ( kind === "stat" ) {
      d.stats[key] = Math.clamp(d.stats[key] + delta, ADV.statMin, ADV.statMax);
    }
    else if ( kind === "skill" ) {
      const base = SCUMBAGS.skills[key].base ?? 0;
      d.skills[key] = Math.clamp(d.skills[key] + delta, base, t.cap);
    }
    else {
      const s = d[group][slot];
      const base = group === "languages" ? languageBase(s) : 0;
      const max = Math.max(t.cap, group === "languages" && s.native ? 4 : 0);
      s.level = Math.clamp(s.level + delta, base, max);
    }
    this.render();
  }

  static #inc(event, target) { this._change(target, event.shiftKey ? 2 : 1); }
  static #dec(event, target) { this._change(target, event.shiftKey ? -2 : -1); }
  static #tab(event, target) { this.tab = target.dataset.tab; this.render(); }
  static #arch(event, target) { this.arch = target.dataset.arch; this.render(); }

  static #node(event, target) {
    const nodes = this.draft.archetypes[this.arch];
    const id = target.dataset.node;
    if ( nodes[id] ) delete nodes[id];
    else {
      nodes[id] = true;
      // развилка «ИЛИ»: второй узел снимается
      const row = SCUMBAGS.trees[this.arch].rows.find(r => r.nodes.includes(id));
      if ( row.fork === "or" ) for ( const other of row.nodes ) if ( other !== id ) delete nodes[other];
    }
    normalizeTree(this.arch, nodes);
    this.render();
  }

  static #reset() {
    const d = this.draft;
    for ( const key of Object.keys(d.skills) ) d.skills[key] = SCUMBAGS.skills[key].base ?? 0;
    for ( const s of Object.values(d.languages) ) s.level = languageBase(s);
    for ( const group of ["sciences", "instruments"] ) for ( const s of Object.values(d[group]) ) s.level = 0;
    for ( const key of SCUMBAGS.archetypes ) d.archetypes[key] = {};
    this.render();
  }

  static #cancel() { this.close(); }

  static async #apply() {
    const d = this.draft, t = tally(d);
    if ( t.left < 0 ) return ui.notifications.warn(F("SCUMBAGS.Adv.Over", { n: -t.left }));
    const update = {
      "system.stats": d.stats,
      "system.languages": d.languages, "system.sciences": d.sciences, "system.instruments": d.instruments
    };
    for ( const [key, level] of Object.entries(d.skills) ) update[`system.skills.${key}.level`] = level;
    for ( const key of SCUMBAGS.archetypes ) {
      const all = SCUMBAGS.trees[key].rows.flatMap(r => r.nodes);
      const taken = all.filter(id => d.archetypes[key][id]);
      update[`system.archetypes.${key}.nodes`] = Object.fromEntries(all.map(id => [id, taken.includes(id)]));
      update[`system.archetypes.${key}.active`] = taken.length > 0 || this.actor.system.archetypes[key].active;
    }
    await this.actor.update(update);
    if ( t.problems.length ) ui.notifications.warn(F("SCUMBAGS.Adv.SavedWithProblems", { n: t.problems.length }));
    else ui.notifications.info(L("SCUMBAGS.Adv.Saved"));
    this.close();
  }
}

/** Открыть окно развития персонажа (одно на актёра). */
export function openAdvancement(actor) {
  const id = `scumbags-adv-${actor.id}`;
  const open = foundry.applications.instances.get(id);
  if ( open ) return open.bringToFront?.() ?? open.render(true);
  return new AdvancementApp({ actor, id }).render(true);
}
