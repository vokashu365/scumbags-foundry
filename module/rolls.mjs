/** Броски: d10 + характеристика + навык против сложности, атаки, урон по цели, перезарядка. */
import { SCUMBAGS } from "./config.mjs";

const L = key => game.i18n.localize(key);
const F = (key, data) => game.i18n.format(key, data);
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const signed = n => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`);
const abilityName = (arch, node) => `«${L(`SCUMBAGS.Tree.${arch}.${node}.name`)}»`;

/** Режим сообщения (публично, шёпотом мастеру и т. д.) — как выбрано в чате. */
function applyMode(data) {
  const cls = ChatMessage.implementation;
  if ( game.release.generation >= 14 ) cls.applyMode(data);
  else cls.applyRollMode(data, game.settings.get("core", "rollMode"));
  return data;
}

/* -------------------------------------------- */
/*  Модификаторы: состояние, эффекты, способности */
/* -------------------------------------------- */

/**
 * Модификаторы, которые система добавляет сама.
 * @param {Actor} actor
 * @param {object} ctx  {kind: "stat"|"skill"|"attack", stat, skill, weapon, flags: {aimed, burst, peeking, idol, …}}
 * @returns {{label: string, value: number}[]}
 */
export function autoMods(actor, ctx) {
  const sys = actor.system, flags = ctx.flags ?? {}, mods = [];
  if ( sys.conditions?.seriousWound ) mods.push({ label: L("SCUMBAGS.Cond.seriousWound"), value: SCUMBAGS.seriousWoundMod });
  for ( const e of actor.items ) {
    if ( (e.type === "effect") && e.system.active && e.system.mod && e.system.applies(ctx) ) mods.push({ label: e.name, value: e.system.mod });
  }
  const has = (a, n) => sys.hasAbility?.(a, n);
  if ( ctx.kind === "attack" ) {
    const w = ctx.weapon;
    if ( w?.minMuscle && (sys.stats.muscle < w.minMuscle) ) mods.push({ label: F("SCUMBAGS.Roll.NeedsMuscle", { n: w.minMuscle }), value: SCUMBAGS.minMuscleMod });
    if ( flags.aimed && has("enforcer", "1a") ) mods.push({ label: abilityName("enforcer", "1a"), value: 4 });
    if ( flags.burst && has("enforcer", "4a") ) mods.push({ label: abilityName("enforcer", "4a"), value: 4 });
    if ( flags.peeking && has("enforcer", "5a") ) mods.push({ label: abilityName("enforcer", "5a"), value: 4 });
  }
  if ( (ctx.skill === "persuasion") && flags.idol && has("media", "8b") ) mods.push({ label: abilityName("media", "8b"), value: 4 });
  return mods;
}

/** Способности, которые сдвигают сложность на ступень вниз. */
function dcShift(actor, ctx) {
  const has = (a, n) => actor.system.hasAbility?.(a, n);
  if ( (ctx.kind === "attack") && ctx.byRange && has("enforcer", "8a") ) return { steps: -1, label: abilityName("enforcer", "8a") };
  if ( (ctx.skill === "computers") && has("tech", "5b") ) return { steps: -1, label: abilityName("tech", "5b") };
  return null;
}

/* -------------------------------------------- */
/*  Карточки в чате                             */
/* -------------------------------------------- */

/** Кубик с числом внутри: d10 — ромб, d6 — квадрат. Десятка жёлтая, единица красная. */
function dieIcon(value, { faces = 10, cls = "", label = null } = {}) {
  const tone = (faces === 10) && (value === 10) ? " hi" : (faces === 10) && (value === 1) ? " lo" : "";
  // Форма рисуется стилями: чат вычищает из сообщений SVG.
  return `<span class="sb-d d${faces}${tone} ${cls}" title="d${faces}: ${value}"><b>${label ?? value}</b></span>`;
}

const detailRow = (label, value, cls = "") => `<div class="sb-drow2 ${cls}"><span>${esc(label)}</span><b>${value}</b></div>`;

/**
 * Бросок проверки. Десятка взрывается один раз, единица вычитает второй d10.
 * @param {object} o
 * @param {Actor} o.actor
 * @param {string} o.title            Что проверяем
 * @param {string} [o.subtitle]
 * @param {{label: string, value: number}[]} o.parts  Слагаемые к d10
 * @param {number|null} [o.dc]        Сложность; null — без заявленной сложности
 * @param {string[]} [o.notes]
 * @param {object} [o.weapon]         {uuid, quality, jams} — для единицы на атаке
 * @param {boolean} [o.luck]          Показывать ли кнопку переброса за Фарт
 */
export async function rollCheck({ actor, title, subtitle = "", parts = [], dc = null, notes = [], weapon = null, luck = true }) {
  const first = await new Roll("1d10").evaluate();
  const rolls = [first];
  const die = first.total;
  let extra = 0;
  if ( (die === 10) || (die === 1) ) {
    const second = await new Roll("1d10").evaluate();
    rolls.push(second);
    extra = die === 10 ? second.total : -second.total;
  }
  parts = parts.filter(p => Number(p.value));
  const total = die + extra + parts.reduce((sum, p) => sum + Number(p.value), 0);
  const success = dc ? total >= dc : null;
  const out = [...notes];
  let buttons = "";
  if ( weapon && (die === 1) && (weapon.quality !== "none") ) {
    if ( weapon.jams ) out.push(L("SCUMBAGS.Roll.Jam"));
    else if ( weapon.quality === "normal" ) {
      out.push(L("SCUMBAGS.Roll.Wear"));
      buttons += `<button type="button" class="sb-card-btn" data-sb-action="wear" data-uuid="${esc(weapon.uuid)}">${L("SCUMBAGS.Roll.WearButton")}</button>`;
    }
  }
  if ( luck && (actor?.type === "character") ) buttons += `<button type="button" class="sb-card-btn" data-sb-action="luck">${L("SCUMBAGS.Roll.LuckButton")}</button>`;
  const dice = dieIcon(die) + (extra ? dieIcon(Math.abs(extra), { cls: "x", label: signed(extra) }) : "");
  const detail = detailRow("d10", die) + (extra ? detailRow(L(extra > 0 ? "SCUMBAGS.Roll.Explode" : "SCUMBAGS.Roll.Implode"), signed(extra)) : "")
    + parts.map(p => detailRow(p.label, signed(Number(p.value)))).join("") + detailRow(L("SCUMBAGS.Roll.Total"), total, "sum");
  const content = `<div class="sb-card">
    <div class="sb-card-h"><span class="sb-card-t">${esc(title)}</span>${subtitle ? `<span class="sb-card-s">${esc(subtitle)}</span>` : ""}</div>
    <div class="sb-card-main" data-sb-toggle title="${esc(L("SCUMBAGS.Roll.ShowDetail"))}"><span class="sb-dice">${dice}</span><span class="sb-total">${total}</span></div>
    ${dc ? `<div class="sb-card-res ${success ? "ok" : "no"}"><span>${L("SCUMBAGS.Roll.DC")} ${dc}</span><b>${L(success ? "SCUMBAGS.Roll.Success" : "SCUMBAGS.Roll.Failure")}</b></div>` : ""}
    <div class="sb-card-detail">${detail}</div>
    ${out.map(n => `<div class="sb-card-note">${esc(n)}</div>`).join("")}${buttons}
  </div>`;
  const flags = { scumbags: { check: { actorUuid: actor?.uuid ?? null, title, subtitle, parts, dc, notes, weapon } } };
  await ChatMessage.create(applyMode({ speaker: ChatMessage.getSpeaker({ actor }), content, rolls, sound: CONFIG.sounds.dice, flags }));
  return { die, extra, total, success };
}

/** Кнопки и раскрытие расчёта на карточках в чате. */
export function activateChatCard(message, html) {
  for ( const main of html.querySelectorAll("[data-sb-toggle]") ) {
    main.addEventListener("click", () => main.closest(".sb-card")?.classList.toggle("open"));
  }
  const check = message.flags?.scumbags?.check;
  const damage = message.flags?.scumbags?.damage;
  for ( const button of html.querySelectorAll("[data-sb-action]") ) {
    const action = button.dataset.sbAction;
    const actor = (check ?? damage)?.actorUuid ? fromUuidSync((check ?? damage).actorUuid) : null;
    if ( (action !== "apply") && !actor?.isOwner ) { button.remove(); continue; }
    button.addEventListener("click", async event => {
      event.preventDefault();
      if ( action === "luck" ) {
        const left = actor.system.luck?.value ?? 0;
        if ( left <= 0 ) return ui.notifications.warn(L("SCUMBAGS.Warn.NoLuck"));
        await actor.update({ "system.luck.value": left - 1 });
        await rollCheck({ ...check, actor, luck: false, notes: [...(check.notes ?? []), L("SCUMBAGS.Roll.LuckReroll")] });
      }
      else if ( action === "wear" ) {
        const item = fromUuidSync(button.dataset.uuid);
        if ( !item ) return;
        await item.update({ "system.wear": Math.min(3, item.system.wear + 1) });
        ui.notifications.info(F("SCUMBAGS.Roll.WearDone", { name: item.name, wear: item.system.wear }));
      }
      else if ( action === "apply" ) await applyDamageToTargets(damage);
    });
  }
}

/* -------------------------------------------- */
/*  Диалоги                                     */
/* -------------------------------------------- */

function readForm(form) {
  const out = {};
  for ( const el of form.elements ) {
    if ( !el.name ) continue;
    out[el.name] = el.type === "checkbox" ? el.checked : el.value;
  }
  return out;
}

/**
 * Диалог броска. onChange(form) вызывается при открытии и при каждом изменении поля
 * и возвращает HTML строки «сумма модификаторов».
 */
async function prompt(title, content, { onChange = null, label = "SCUMBAGS.Roll.Roll", icon = "fa-solid fa-dice-d10" } = {}) {
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title },
    classes: ["scumbags", "sb-dialog"],
    content,
    buttons: [
      { action: "roll", label: L(label), icon, default: true, callback: (event, button) => readForm(button.form) },
      { action: "cancel", label: L("SCUMBAGS.Cancel"), icon: "fa-solid fa-xmark" }
    ],
    render: (event, arg) => {
      if ( !onChange ) return;
      const root = arg?.element ?? arg;
      const form = root.querySelector("form") ?? root;
      const target = root.querySelector("[data-sb-sum]");
      const refresh = () => { if ( target ) target.innerHTML = onChange(readForm(form), form); };
      form.addEventListener("change", refresh);
      form.addEventListener("input", refresh);
      refresh();
    },
    rejectClose: false
  });
  return (result && (typeof result === "object")) ? result : null;
}

const option = (value, label, selected = false) => `<option value="${esc(value)}"${selected ? " selected" : ""}>${esc(label)}</option>`;
const row = (label, control) => `<div class="sb-drow"><label>${esc(label)}</label>${control}</div>`;
const check = (name, label, value, checked = false) => `<label class="sb-dcheck"><input type="checkbox" name="${name}"${checked ? " checked" : ""}><span>${esc(label)}</span><b>${value}</b></label>`;
const statOptions = current => SCUMBAGS.stats.map(s => option(s, L(`SCUMBAGS.Stat.${s}`), s === current)).join("");
const dcOptions = (blank = L("SCUMBAGS.Roll.NoDC")) => option("", blank) + SCUMBAGS.dc.map(d => option(d, `${d} — ${L(`SCUMBAGS.DC.${d}`)}`)).join("");
const modInput = () => `<input type="number" name="mod" value="0" step="1">`;
const sumBox = () => `<div class="sb-dsum" data-sb-sum></div>`;

/** Строка «сумма модификаторов»: из чего складывается прибавка к d10. */
function sumLine(parts) {
  const shown = parts.filter(p => Number(p.value));
  const total = shown.reduce((s, p) => s + Number(p.value), 0);
  const list = shown.map(p => `<span class="sb-chip">${esc(p.label)} ${signed(Number(p.value))}</span>`).join("");
  return `<div class="sb-dsum-h"><span>${L("SCUMBAGS.Roll.SumLine")}</span><b>${signed(total)}</b></div><div class="sb-dsum-l">${list}</div>`;
}

/* -------------------------------------------- */
/*  Проверки навыков и характеристик            */
/* -------------------------------------------- */

/** Проверка характеристики или навыка. */
export async function rollSkill(actor, { key = null, custom = null, stat = null, fast = false } = {}) {
  const sys = actor.system;
  let title, level = 0, defStat = stat;
  if ( key ) {
    title = L(`SCUMBAGS.Skill.${key}`);
    level = sys.skills[key].level;
    defStat ??= SCUMBAGS.skills[key].stat;
  }
  else if ( custom ) {
    const slot = sys[custom.group][custom.slot];
    title = slot.name || L(`SCUMBAGS.Custom.${custom.group}`);
    level = slot.level;
    defStat ??= SCUMBAGS.customSkills[custom.group].stat;
  }
  else title = L(`SCUMBAGS.Stat.${stat}`);
  const skilled = !!(key || custom);
  const idol = (key === "persuasion") && sys.hasAbility?.("media", "8b");
  const build = form => {
    const ctx = { kind: skilled ? "skill" : "stat", skill: key, stat: form.stat, flags: { idol: !!form.m_idol } };
    const parts = [{ label: L(`SCUMBAGS.Stat.${form.stat}`), value: sys.stats[form.stat] }];
    if ( skilled ) parts.push({ label: L("SCUMBAGS.Roll.Skill"), value: level });
    parts.push(...autoMods(actor, ctx), { label: L("SCUMBAGS.Roll.Modifier"), value: Number(form.mod) || 0 });
    return { ctx, parts };
  };
  let form = { stat: defStat, mod: 0, dc: "" };
  if ( !fast ) {
    const extra = idol ? `<div class="sb-dchecks open">${check("m_idol", L("SCUMBAGS.Roll.Idol"), "+4")}</div>` : "";
    form = await prompt(title, `<div class="sb-dform">${row(L("SCUMBAGS.Roll.Stat"), `<select name="stat">${statOptions(defStat)}</select>`)}${row(L("SCUMBAGS.Roll.DC"), `<select name="dc">${dcOptions()}</select>`)}${row(L("SCUMBAGS.Roll.Modifier"), modInput())}${extra}${sumBox()}</div>`,
      { onChange: f => sumLine(build(f).parts) });
    if ( !form ) return null;
  }
  const { ctx, parts } = build(form);
  let dc = Number(form.dc) || null;
  const notes = [];
  const shift = dc ? dcShift(actor, ctx) : null;
  if ( shift ) {
    const lower = SCUMBAGS.dcStep(dc, shift.steps);
    if ( lower !== dc ) notes.push(F("SCUMBAGS.Roll.DCShift", { name: shift.label, from: dc, to: lower }));
    dc = lower;
  }
  return rollCheck({ actor, title, subtitle: skilled && !level ? L("SCUMBAGS.Roll.Untrained") : "", parts, dc, notes });
}

/* -------------------------------------------- */
/*  Атака                                       */
/* -------------------------------------------- */

/** Атака оружием: Рефлексы + навык оружия + d10. Дистанция по умолчанию не выбрана. */
export async function rollAttack(actor, item, { fast = false } = {}) {
  const sys = item.system;
  if ( sys.usesAmmo && (sys.magazine.value <= 0) ) return ui.notifications.warn(F("SCUMBAGS.Warn.Empty", { name: item.name }));
  const table = SCUMBAGS.rangeDC[sys.rangeClass];
  const skill = SCUMBAGS.skills[sys.skill];
  const modKeys = ["aimed", sys.isAuto ? "burst" : null, "peeking", "sprinted", "prone", "dark", "passenger", "driver", "dual"].filter(Boolean);
  // Модификации, которые стоят на этом оружии и дают бонус к атаке (прицел, целеуказатель).
  const scopes = actor.items.filter(i => (i.type === "mod") && (i.system.attachedTo === item.id) && i.system.attackBonus);
  let lastRange;
  const build = form => {
    const flags = Object.fromEntries(modKeys.map(k => [k, !!form[`m_${k}`]]));
    const band = (form.range === "") || (form.range === undefined) ? null : Number(form.range);
    const ctx = { kind: "attack", stat: skill.stat, skill: sys.skill, weapon: sys, flags, byRange: band !== null };
    const parts = [
      { label: L(`SCUMBAGS.Stat.${skill.stat}`), value: actor.system.stats[skill.stat] },
      { label: L(`SCUMBAGS.Skill.${sys.skill}`), value: actor.system.skills[sys.skill].level }
    ];
    for ( const k of modKeys ) if ( flags[k] ) parts.push({ label: L(`SCUMBAGS.AttackMod.${k}`), value: SCUMBAGS.attackMods[k] });
    for ( const m of scopes ) if ( form[`x_${m.id}`] ) parts.push({ label: m.name, value: m.system.attackBonus });
    parts.push(...autoMods(actor, ctx), { label: L("SCUMBAGS.Roll.Modifier"), value: Number(form.mod) || 0 });
    return { ctx, parts, flags, band };
  };
  let form = { range: "", dc: "", mod: 0 };
  if ( !fast ) {
    let ranges = option("", L(sys.isMelee ? "SCUMBAGS.Roll.Melee" : "SCUMBAGS.Roll.NoRange"), true);
    if ( table ) ranges += table.map((dc, i) => dc ? option(i, `${L(`SCUMBAGS.Range.${SCUMBAGS.rangeBands[i]}`)} — ${L("SCUMBAGS.Roll.DC")} ${dc}`) : "").join("");
    const checks = modKeys.map(k => check(`m_${k}`, L(`SCUMBAGS.AttackMod.${k}`), signed(SCUMBAGS.attackMods[k]))).join("");
    const scopeChecks = scopes.length ? `<div class="sb-dchecks open"><span class="sb-dtitle">${L("SCUMBAGS.Roll.WeaponMods")}</span>${scopes.map(m => check(`x_${m.id}`, m.name, signed(m.system.attackBonus), m.system.inRange(null))).join("")}</div>` : "";
    form = await prompt(F("SCUMBAGS.Roll.AttackWith", { name: item.name }),
      `<div class="sb-dform">${table ? row(L("SCUMBAGS.Roll.Range"), `<select name="range">${ranges}</select>`) : ""}${row(L("SCUMBAGS.Roll.DCManual"), `<select name="dc">${dcOptions("—")}</select>`)}${row(L("SCUMBAGS.Roll.Modifier"), modInput())}${scopeChecks}<details class="sb-dmods"><summary>${L("SCUMBAGS.Roll.Situational")}</summary><div class="sb-dchecks">${checks}</div></details>${sumBox()}</div>`,
      {
        onChange: (f, el) => {
          // Сменили дистанцию — галочки модификаций встают по своим дистанциям (прицел — от 51 м).
          if ( el && (f.range !== lastRange) ) {
            lastRange = f.range;
            const band = (f.range === "") || (f.range === undefined) ? null : Number(f.range);
            for ( const m of scopes ) {
              const box = el.querySelector(`input[name="x_${m.id}"]`);
              if ( !box ) continue;
              box.checked = m.system.inRange(band);
              f[`x_${m.id}`] = box.checked;
            }
          }
          return sumLine(build(f).parts);
        }
      });
    if ( !form ) return null;
  }
  const { ctx, parts, flags, band } = build(form);
  const notes = [];
  let dc = Number(form.dc) || null;
  if ( !dc && (band !== null) ) {
    dc = table?.[band] ?? null;
    const shift = dc ? dcShift(actor, ctx) : null;
    if ( shift ) {
      const lower = SCUMBAGS.dcStep(dc, shift.steps);
      if ( lower !== dc ) notes.push(F("SCUMBAGS.Roll.DCShift", { name: shift.label, from: dc, to: lower }));
      dc = lower;
    }
  }
  const spend = flags.burst ? SCUMBAGS.burstAmmo : 1;
  if ( sys.usesAmmo && (sys.magazine.value < spend) ) return ui.notifications.warn(F("SCUMBAGS.Warn.NotEnoughAmmo", { name: item.name, n: spend }));
  if ( sys.properties ) notes.push(sys.properties);
  if ( sys.loadedName ) notes.push(F("SCUMBAGS.Roll.LoadedWith", { name: sys.loadedName }) + (sys.loadedEffect ? `. ${sys.loadedEffect}` : ""));
  const subtitle = [band !== null ? L(`SCUMBAGS.Range.${SCUMBAGS.rangeBands[band]}`) : null, flags.aimed ? L("SCUMBAGS.Roll.Aimed") : null,
    flags.burst ? L("SCUMBAGS.AttackMod.burst") : null].filter(Boolean).join(" · ");
  const result = await rollCheck({
    actor, title: F("SCUMBAGS.Roll.AttackWith", { name: item.name }), subtitle, parts, dc, notes,
    weapon: { uuid: item.uuid, quality: sys.quality, jams: sys.jams }
  });
  // Осечка у Ширпотреба — выстрела не было, патрон на месте.
  const jammed = (result.die === 1) && (sys.quality !== "none") && sys.jams;
  if ( sys.usesAmmo && !jammed ) await item.update({ "system.magazine.value": Math.max(0, sys.magazine.value - spend) });
  return result;
}

/* -------------------------------------------- */
/*  Урон                                        */
/* -------------------------------------------- */

/** Число кубиков d6 в строке урона. */
const diceOf = s => { const m = /(\d+)\s*d\s*6/i.exec(s ?? ""); return m ? Number(m[1]) : 0; };

/** Бросок урона оружия. Карточка умеет нанести урон выбранной цели. */
export async function rollDamage(actor, item, { fast = false } = {}) {
  const sys = item.system;
  const has = (a, n) => actor.system.hasAbility?.(a, n);
  let main = diceOf(sys.damage);
  const alt = diceOf(sys.damageAlt);
  const notes = [];
  // «Всё — оружие» (Боевик 4Б): лёгкое оружие ближнего боя бьёт как среднее.
  if ( sys.isMelee && (main === 1) && has("enforcer", "4b") ) {
    main = 2;
    notes.push(abilityName("enforcer", "4b"));
  }
  const back = sys.isMelee && has("enforcer", "5b");
  let form = { mode: "main", burst: false, back: false, dice: 0, mod: 0 };
  if ( !fast ) {
    const modes = option("main", `${main}d6`, true) + (alt ? option("alt", sys.damageAlt) : "");
    const checks = (sys.isAuto ? check("burst", L("SCUMBAGS.AttackMod.burst"), "+1d6") : "")
      + (back ? check("back", abilityName("enforcer", "5b"), "×2") : "");
    form = await prompt(F("SCUMBAGS.Roll.DamageOf", { name: item.name }),
      `<div class="sb-dform">${main || alt ? row(L("SCUMBAGS.Roll.DamageMode"), `<select name="mode">${modes}</select>`) : ""}${row(L("SCUMBAGS.Roll.ExtraDice"), `<input type="number" name="dice" value="0" step="1">`)}${row(L("SCUMBAGS.Roll.Modifier"), modInput())}${checks ? `<div class="sb-dchecks open">${checks}</div>` : ""}</div>`);
    if ( !form ) return null;
  }
  const base = form.mode === "alt" ? alt : main;
  // Патроны в магазине могут менять число кубиков (резиновые — на один меньше).
  const dice = base + (base ? sys.loadedDice : 0) + (form.burst ? 1 : 0) + (Number(form.dice) || 0);
  const strength = sys.strength ? (actor.system.strengthBonus ?? 0) : 0;
  const flat = Number(form.mod) || 0;
  if ( (dice <= 0) && !strength && !flat ) return ui.notifications.warn(F("SCUMBAGS.Warn.NoDamage", { name: item.name }));
  const formula = [dice > 0 ? `${dice}d6` : null, (strength + flat) ? String(strength + flat) : null].filter(Boolean).join(" + ").replace("+ -", "- ");
  const roll = await new Roll(formula).evaluate();
  const total = Math.max(0, roll.total) * (form.back ? 2 : 1);
  const results = roll.dice.flatMap(d => d.results.map(r => r.result));
  const half = sys.halfArmor;
  if ( half ) notes.push(L("SCUMBAGS.Roll.HalfArmor"));
  if ( sys.properties ) notes.push(sys.properties);
  if ( sys.loadedName ) notes.push(F("SCUMBAGS.Roll.LoadedWith", { name: sys.loadedName }) + (sys.loadedEffect ? `. ${sys.loadedEffect}` : ""));
  const detail = (results.length ? detailRow(`${results.length}d6`, results.join(" + ")) : "")
    + (strength ? detailRow(L("SCUMBAGS.Sheet.StrengthBonus"), signed(strength)) : "")
    + (flat ? detailRow(L("SCUMBAGS.Roll.Modifier"), signed(flat)) : "")
    + (form.back ? detailRow(abilityName("enforcer", "5b"), "×2") : "")
    + detailRow(L("SCUMBAGS.Roll.Total"), total, "sum");
  const subtitle = [L("SCUMBAGS.Roll.Damage"), form.burst ? L("SCUMBAGS.AttackMod.burst") : null].filter(Boolean).join(" · ");
  const content = `<div class="sb-card dmg">
    <div class="sb-card-h"><span class="sb-card-t">${esc(item.name)}</span><span class="sb-card-s">${esc(subtitle)}</span></div>
    <div class="sb-card-main" data-sb-toggle title="${esc(L("SCUMBAGS.Roll.ShowDetail"))}"><span class="sb-dice">${results.map(r => dieIcon(r, { faces: 6 })).join("")}</span><span class="sb-total">${total}</span></div>
    <div class="sb-card-detail">${detail}</div>
    ${notes.map(n => `<div class="sb-card-note">${esc(n)}</div>`).join("")}
    <button type="button" class="sb-card-btn" data-sb-action="apply">${L("SCUMBAGS.Roll.ApplyButton")}</button>
  </div>`;
  const flags = { scumbags: { damage: { actorUuid: actor.uuid, total, half, name: item.name } } };
  await ChatMessage.create(applyMode({ speaker: ChatMessage.getSpeaker({ actor }), content, rolls: [roll], sound: CONFIG.sounds.dice, flags }));
  return { total, half };
}

/**
 * Нанести урон жетонам и написать итог в чат.
 * Выполняет тот, у кого есть права на цели: их владелец или мастер (по запросу игрока).
 */
async function applyDamageNow({ tokenUuids, damage, location, half, by }) {
  const lines = [];
  const head = location === "head";
  for ( const uuid of tokenUuids ) {
    const token = fromUuidSync(uuid);
    const actor = token?.actor;
    if ( !actor?.isOwner ) continue;
    const r = await actor.applyDamage({ amount: damage.total, location: head ? "head" : "body", half, double: head });
    if ( !r ) continue;
    lines.push(`<div class="sb-card-note"><b>${esc(token.name)}</b>: ${F("SCUMBAGS.Roll.Applied", { taken: r.taken, soak: r.soak, hp0: r.hp0, hp1: r.hp1 })}${r.armor0 ? ` ${F("SCUMBAGS.Roll.ArmorWorn", { a0: r.armor0, a1: r.armor1 })}` : ""}${r.hp1 <= 0 ? ` <b>${L("SCUMBAGS.Roll.Down")}</b>` : ""}</div>`);
  }
  if ( !lines.length ) return;
  const content = `<div class="sb-card"><div class="sb-card-h"><span class="sb-card-t">${L("SCUMBAGS.Roll.AppliedTitle")}</span><span class="sb-card-s">${esc(damage.name ?? "")} · ${damage.total}${head ? ` · ${L("SCUMBAGS.Armor.head")} ×2` : ""}</span></div>${lines.join("")}</div>`;
  await ChatMessage.create({ speaker: { alias: by }, content });
}

/** Нанести урон с карточки: цели — отмеченные (T) жетоны, иначе выделенные. Чужим жетонам урон наносит мастер. */
export async function applyDamageToTargets(damage) {
  if ( !damage ) return;
  let tokens = [...game.user.targets];
  if ( !tokens.length ) tokens = canvas.tokens?.controlled ?? [];
  if ( !tokens.length ) return ui.notifications.warn(L("SCUMBAGS.Warn.NoTarget"));
  const names = tokens.map(t => t.name).join(", ");
  const form = await prompt(F("SCUMBAGS.Roll.ApplyTitle", { n: damage.total }),
    `<div class="sb-dform"><p class="sb-dnote">${esc(F("SCUMBAGS.Roll.ApplyTo", { names }))}</p>${row(L("SCUMBAGS.Roll.Location"), `<select name="location">${option("body", L("SCUMBAGS.Armor.body"), true)}${option("head", L("SCUMBAGS.Roll.HeadDouble"))}</select>`)}<div class="sb-dchecks open">${check("half", L("SCUMBAGS.Roll.HalfArmor"), "½", !!damage.half)}</div></div>`,
    { label: "SCUMBAGS.Roll.ApplyConfirm", icon: "fa-solid fa-burst" });
  if ( !form ) return;
  const request = {
    tokenUuids: tokens.map(t => t.document.uuid), damage: { total: damage.total, name: damage.name },
    location: form.location, half: !!form.half, by: game.user.name
  };
  if ( tokens.every(t => t.actor?.isOwner) ) return applyDamageNow(request);
  if ( !game.users.activeGM ) return ui.notifications.warn(L("SCUMBAGS.Warn.NoGM"));
  game.socket.emit("system.scumbags", { type: "applyDamage", request });
  ui.notifications.info(L("SCUMBAGS.Roll.SentToGM"));
}

/** Запросы игроков, которые выполняет клиент мастера. */
export function onSocket(message) {
  if ( game.user !== game.users.activeGM ) return;
  if ( message?.type === "applyDamage" ) return applyDamageNow(message.request);
}

/* -------------------------------------------- */
/*  Перезарядка                                 */
/* -------------------------------------------- */

/** Зарядить оружие: выбрать, какими патронами. Остаток прежних возвращается в запас. */
export async function reloadWeapon(actor, item, { fast = false } = {}) {
  const sys = item.system;
  if ( !sys.usesAmmo ) return;
  const fits = i => (i.type === "ammo") && (i.system.quantity > 0) && (!sys.ammoKind || (i.system.kind === "any") || (i.system.kind === sys.ammoKind));
  const ammo = actor.items.filter(fits);
  let choice = ammo.find(a => a.name === sys.loadedName)?.id ?? ammo[0]?.id ?? "";
  // Быстрая перезарядка персонажа без подходящих патронов — не бесконечный магазин.
  if ( fast && !choice && (actor.type === "character") ) return ui.notifications.warn(F("SCUMBAGS.Warn.NoAmmo", { name: item.name }));
  if ( !fast ) {
    const options = ammo.map(a => option(a.id, `${a.name} — ${a.system.quantity}`, a.id === choice)).join("") + option("", L("SCUMBAGS.Roll.ReloadFree"), !choice);
    const form = await prompt(F("SCUMBAGS.Roll.ReloadTitle", { name: item.name }),
      `<div class="sb-dform">${ammo.length ? "" : `<p class="sb-dnote">${L("SCUMBAGS.Roll.ReloadNone")}</p>`}${row(L("SCUMBAGS.Roll.ReloadWith"), `<select name="ammo">${options}</select>`)}</div>`,
      { label: "SCUMBAGS.Weapon.Reload", icon: "fa-solid fa-rotate" });
    if ( !form ) return;
    choice = form.ammo;
  }
  // Вернуть в запас то, что осталось в магазине.
  if ( (sys.magazine.value > 0) && sys.loadedName ) {
    const prev = actor.items.find(i => (i.type === "ammo") && (i.name === sys.loadedName));
    if ( prev ) await prev.update({ "system.quantity": prev.system.quantity + sys.magazine.value });
  }
  const picked = choice ? actor.items.get(choice) : null;
  if ( !picked ) {
    return item.update({
      "system.magazine.value": sys.magazine.max, "system.loadedName": "", "system.loadedHalf": false,
      "system.loadedEffect": "", "system.loadedDice": 0
    });
  }
  const n = Math.min(sys.magazine.max, picked.system.quantity);
  await picked.update({ "system.quantity": picked.system.quantity - n });
  return item.update({
    "system.magazine.value": n, "system.loadedName": picked.name, "system.loadedHalf": picked.system.halfArmor,
    "system.loadedEffect": picked.system.effect, "system.loadedDice": picked.system.diceMod
  });
}

/* -------------------------------------------- */
/*  Бизнес                                      */
/* -------------------------------------------- */

/** Проблема предприятия: d10 + риск по таблице из 13 строк. */
export async function rollProblem(actor) {
  const risk = actor.system.risk;
  const roll = await new Roll("1d10 + @risk", { risk }).evaluate();
  const die = roll.dice[0].results[0].result;
  const n = Math.min(SCUMBAGS.problemRows, Math.max(1, roll.total));
  const problem = L(`SCUMBAGS.Problem.${n}.problem`);
  const content = `<div class="sb-card">
    <div class="sb-card-h"><span class="sb-card-t">${esc(actor.name)}</span><span class="sb-card-s">${L("SCUMBAGS.Business.ProblemRoll")}</span></div>
    <div class="sb-card-main" data-sb-toggle><span class="sb-dice">${dieIcon(die)}</span><span class="sb-total">${roll.total}</span></div>
    <div class="sb-card-detail">${detailRow("d10", die)}${detailRow(L("SCUMBAGS.Business.Risk"), signed(risk))}${detailRow(L("SCUMBAGS.Roll.Total"), roll.total, "sum")}</div>
    <div class="sb-card-note"><b>${n}. ${esc(problem)}</b><br>${esc(L(`SCUMBAGS.Problem.${n}.solve`))}</div>
  </div>`;
  await ChatMessage.create(applyMode({ speaker: ChatMessage.getSpeaker({ actor }), content, rolls: [roll], sound: CONFIG.sounds.dice }));
  if ( actor.isOwner ) await actor.update({ "system.problem": problem });
  return n;
}
