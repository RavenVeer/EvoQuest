/* Evolution stages — the core progression system */
const Stages = (() => {
  // Each stage: name, icon, base radius, growth, maxHealth, attack damage,
  // shoot rate, move speed, and the evolution points (xp) required.
  const STAGES = [
    { name: 'Amoeba',      icon: '🦠', r: 16,  maxHp: 50,  dmg: 8,  rate: 0.7, speed: 2.6,  xp: 8 },
    { name: 'Tadpole',     icon: '🐟', r: 19,  maxHp: 65,  dmg: 11, rate: 0.75,speed: 2.9,  xp: 18 },
    { name: 'Pufferfish',  icon: '🐡', r: 22,  maxHp: 85,  dmg: 14, rate: 0.8, speed: 2.9,  xp: 30 },
    { name: 'Crawler',     icon: '🦎', r: 24,  maxHp: 110, dmg: 18, rate: 0.85,speed: 3.1,  xp: 45 },
    { name: 'Raptor',      icon: '🦅', r: 27,  maxHp: 140, dmg: 23, rate: 0.9, speed: 3.3,  xp: 62 },
    { name: 'Werewolf',    icon: '🐺', r: 31,  maxHp: 180, dmg: 30, rate: 0.95,speed: 3.5,  xp: 82 },
    { name: 'Dragon',      icon: '🐉', r: 36,  maxHp: 230, dmg: 38, rate: 1.0, speed: 3.6,  xp: 105 },
    { name: 'Titan',       icon: '🤖', r: 42,  maxHp: 300, dmg: 48, rate: 1.1, speed: 3.6,  xp: 130 },
    { name: 'Behemoth',    icon: '👹', r: 50,  maxHp: 400, dmg: 62, rate: 1.2, speed: 3.7,  xp: 160 },
    { name: 'Colossus',    icon: '🗿', r: 60,  maxHp: 540, dmg: 80, rate: 1.3, speed: 3.8,  xp: 195 },
    { name: 'GOD',         icon: '👑', r: 72,  maxHp: 740, dmg: 104,rate: 1.5, speed: 4.0,  xp: Infinity }
  ];

  // Color palette per stage, used for aura / rendering
  const COLORS = [
    '#7bff5c', '#00d5ff', '#ffb347', '#ff5c8a', '#b347ff',
    '#ff4d4d', '#ffaa00', '#00ffcc', '#e60073', '#ffd700', '#ffffff'
  ];

  function stageAt(index) {
    return STAGES[Math.max(0, Math.min(STAGES.length - 1, index))];
  }

  function colorAt(index, alpha = 1) {
    const c = COLORS[Math.max(0, Math.min(COLORS.length - 1, index))];
    if (alpha === 1) return c;
    const r = parseInt(c.slice(1, 3), 16);
    const g = parseInt(c.slice(3, 5), 16);
    const b = parseInt(c.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function stageCount() { return STAGES.length; }

  return { STAGES, stageAt, colorAt, stageCount };
})();
