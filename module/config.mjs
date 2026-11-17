/** Константы системы. Все числа — из дизайн-документов «Подонков». */
import { TREES } from "./trees.mjs";

export const SCUMBAGS = {};

SCUMBAGS.id = "scumbags";
SCUMBAGS.path = "systems/scumbags";

SCUMBAGS.stats = ["muscle", "reflexes", "brains", "cool"];

/** Навык → характеристика и базовый уровень (кор-механика, раздел 4). */
SCUMBAGS.skills = {
  awareness: { stat: "brains", base: 2 }, concentration: { stat: "cool", base: 2 }, tailing: { stat: "brains" },
  athletics: { stat: "muscle", base: 2 }, endurance: { stat: "muscle" }, flexibility: { stat: "reflexes" },
  stealth: { stat: "reflexes", base: 2 },
  driving: { stat: "reflexes", base: 2 }, piloting: { stat: "reflexes" }, boating: { stat: "reflexes" },
  riding: { stat: "reflexes" },
  brawling: { stat: "reflexes", base: 2 }, meleeWeapons: { stat: "reflexes" }, dodge: { stat: "reflexes", base: 2 },
  handguns: { stat: "reflexes" }, automatics: { stat: "reflexes" }, sniper: { stat: "reflexes" },
  heavy: { stat: "reflexes" }, throwing: { stat: "reflexes" }, archery: { stat: "reflexes" },
  gambling: { stat: "brains" }, business: { stat: "brains" }, accounting: { stat: "brains" },
  deduction: { stat: "brains" }, computers: { stat: "brains" }, forensics: { stat: "brains" },
  streetwise: { stat: "cool" }, medicine: { stat: "brains" }, research: { stat: "brains" }, tactics: { stat: "brains" },
  performance: { stat: "cool" }, composition: { stat: "brains" },
  intimidation: { stat: "cool" }, deception: { stat: "cool" }, insight: { stat: "brains", base: 2 },
  trading: { stat: "cool" }, persuasion: { stat: "cool", base: 2 },
  aircraftTech: { stat: "brains" }, autoTech: { stat: "brains" }, lockpicking: { stat: "brains" },
  demolitions: { stat: "brains" }, thievery: { stat: "reflexes" }, techKnowledge: { stat: "brains" },
  marineTech: { stat: "brains" }, gunsmith: { stat: "brains" }, forgery: { stat: "brains" },
  photoFilm: { stat: "brains" }, acting: { stat: "cool" }, writing: { stat: "brains" }, artCraft: { stat: "reflexes" }
};

/** Раскладка навыков по колонкам листа. custom — слоты языков, наук и инструментов. */
SCUMBAGS.skillColumns = [
  [
    { id: "perception", skills: ["awareness", "concentration", "tailing"] },
    { id: "body", skills: ["athletics", "endurance", "flexibility", "stealth"] },
    { id: "control", skills: ["driving", "piloting", "boating", "riding"] },
    { id: "melee", skills: ["brawling", "meleeWeapons", "dodge"] }
  ],
  [
    { id: "ranged", skills: ["handguns", "automatics", "sniper", "heavy", "throwing", "archery"] },
    { id: "social", skills: ["intimidation", "deception", "insight", "trading", "persuasion"] },
    { id: "art", skills: ["photoFilm", "acting", "writing", "artCraft"] }
  ],
  [
    {
      id: "education",
      skills: ["gambling", "business", "accounting", "deduction", "computers", "forensics", "streetwise", "medicine",
        "research", "tactics"],
      custom: ["languages", "sciences"]
    }
  ],
  [
    {
      id: "technical",
      skills: ["aircraftTech", "autoTech", "lockpicking", "demolitions", "thievery", "techKnowledge", "marineTech",
        "gunsmith", "forgery"]
    },
    { id: "music", custom: ["instruments"], skills: ["performance", "composition"] }
  ]
];

/** Слоты «своих» навыков: ключ поля → {слоты, характеристика}. */
SCUMBAGS.customSkills = {
  languages: { slots: ["l1", "l2", "l3", "l4"], stat: "brains" },
  sciences: { slots: ["s1", "s2", "s3"], stat: "brains" },
  instruments: { slots: ["i1", "i2", "i3"], stat: "reflexes" }
};

/** Шкала сложности (кор-механика, раздел 2). 15 — редкая промежуточная. */
SCUMBAGS.dc = [9, 13, 15, 17, 21, 27];
SCUMBAGS.dcLadder = [9, 13, 17, 21, 27];

/** Сложность на несколько ступеней ниже или выше по общей шкале. */
SCUMBAGS.dcStep = function(dc, steps) {
  const i = SCUMBAGS.dcLadder.indexOf(dc);
  if ( (i < 0) || !steps ) return dc;
  return SCUMBAGS.dcLadder[Math.min(SCUMBAGS.dcLadder.length - 1, Math.max(0, i + steps))];
};

/** Сложность стрельбы по дистанции (кор-механика, бой). null — оружие так далеко не бьёт. */
SCUMBAGS.rangeBands = ["r4", "r12", "r24", "r50", "r200", "r400", "r1000", "r2000"];
SCUMBAGS.rangeDC = {
  pistols: [9, 13, 17, 21, 27, null, null, null],
  shotguns: [13, 13, 17, 21, 27, null, null, null],
  smg: [13, 13, 17, 21, 27, null, null, null],
  rifles: [17, 13, 13, 17, 21, 27, null, null],
  mg: [17, 13, 13, 17, 21, 27, null, null],
  sniper: [27, 21, 17, 13, 13, 17, 21, 27],
  launchers: [21, 13, 13, 17, 21, 27, null, null],
  throwing: [9, 13, 17, null, null, null, null, null],
  bows: [13, 13, 13, 17, 21, null, null, null]
};

/** Модификаторы атаки (кор-механика, бой). */
SCUMBAGS.attackMods = {
  aimed: -8, burst: -4, peeking: -4, sprinted: -2, prone: -2, dark: -4, passenger: -2, driver: -4, dual: -4
};
SCUMBAGS.seriousWoundMod = -4;
SCUMBAGS.minMuscleMod = -4;
SCUMBAGS.burstAmmo = 10;

SCUMBAGS.weaponCategories = ["melee", "pistols", "shotguns", "smg", "rifles", "sniper", "heavy", "explosives", "bows",
  "nonlethal", "unique"];
SCUMBAGS.rangeClasses = ["pistols", "shotguns", "smg", "rifles", "mg", "sniper", "launchers", "throwing", "bows"];
SCUMBAGS.qualities = ["none", "cheap", "normal", "fine"];
SCUMBAGS.legal = ["registered", "illegal"];
SCUMBAGS.ammoKinds = ["pistol", "rifle", "shotgun", "arrow", "sniper", "heavy", "grenade", "rocket", "any"];
SCUMBAGS.gearCategories = ["medicine", "tools", "electronics", "surveillance", "disguise", "job", "other"];
SCUMBAGS.vehicleClasses = ["cars", "sports", "suvs", "vans", "bikes", "service", "boats", "helicopters", "planes"];
SCUMBAGS.vehicleStatus = ["own", "stolen", "replated"];
SCUMBAGS.archetypes = ["enforcer", "grifter", "tech", "media", "lawman"];
SCUMBAGS.refresh = ["constant", "fight", "session", "week", "month", "job", "target", "trust"];
SCUMBAGS.businessKinds = ["business", "enterprise"];
SCUMBAGS.modTargets = ["weapon", "vehicle"];

/** Древа архетипов: строки, развилки и частота способностей (создаётся tools/extract.py). */
SCUMBAGS.trees = TREES;

/** Силуэты по умолчанию (папка silhouettes в корне системы). */
const S = `${SCUMBAGS.path}/silhouettes`;
SCUMBAGS.silhouettes = {
  actor: {
    character: `${S}/portrait.png`, npc: `${S}/portrait.png`, vehicle: `${S}/car.png`, business: `${S}/type_business.png`
  },
  item: {
    weapon: `${S}/type_05_pistols.png`, armor: `${S}/type_armor.png`, ammo: `${S}/type_ammo.png`,
    mod: `${S}/type_15_mods.png`, gear: `${S}/backpack.png`, effect: `${S}/type_medicine_alt.png`
  },
  weapon: {
    melee: `${S}/type_04_melee.png`, pistols: `${S}/type_05_pistols.png`, shotguns: `${S}/type_06_shotguns.png`,
    smg: `${S}/type_07_smg.png`, rifles: `${S}/type_08_rifles.png`, sniper: `${S}/type_09_sniper.png`,
    heavy: `${S}/type_10_heavy.png`, explosives: `${S}/type_11_explosives.png`, bows: `${S}/type_12_bows.png`,
    nonlethal: `${S}/type_13_nonlethal.png`, unique: `${S}/type_14_unique.png`
  },
  gear: {
    medicine: `${S}/type_medicine_alt.png`, tools: `${S}/type_tools.png`, electronics: `${S}/type_electronics_alt.png`,
    surveillance: `${S}/type_surveillance.png`, disguise: `${S}/type_disguise.png`, job: `${S}/backpack.png`,
    other: `${S}/backpack.png`
  },
  mod: { weapon: `${S}/type_15_mods.png`, vehicle: `${S}/type_tools.png` }
};

/** Жетоны по умолчанию: силуэт на залитом круге. */
SCUMBAGS.tokens = {
  character: `${SCUMBAGS.path}/assets/ui/token-default.webp`,
  npc: `${SCUMBAGS.path}/assets/ui/token-default.webp`,
  vehicle: `${S}/car.png`,
  business: `${S}/type_business.png`
};

/** Картинка по умолчанию для предмета данного типа и категории. */
SCUMBAGS.itemSilhouette = function(type, system = {}) {
  const s = SCUMBAGS.silhouettes;
  if ( type === "weapon" ) return s.weapon[system.category] ?? s.item.weapon;
  if ( type === "gear" ) return s.gear[system.category] ?? s.item.gear;
  if ( type === "mod" ) return s.mod[system.target] ?? s.item.mod;
  return s.item[type] ?? s.item.gear;
};

SCUMBAGS.isSilhouette = img => !img || img.startsWith(`${S}/`) || img.startsWith("icons/svg/");

/** Бонус силы, передвижение и спринт по ступеням Мускулов (кор-механика, раздел 3). */
SCUMBAGS.physique = function(muscle) {
  if ( muscle <= 4 ) return { strengthBonus: 1, move: 10, sprint: 20 };
  if ( muscle <= 7 ) return { strengthBonus: 2, move: 12, sprint: 24 };
  return { strengthBonus: 3, move: 14, sprint: 28 };
};

/** Таблица проблем предприятий: d10 + риск, строки 1–13. */
SCUMBAGS.problemRows = 13;
