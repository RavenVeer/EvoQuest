/* Evolution stages — the food chain: rank = index, each stage is prey to higher ranks */
const Stages = (() => {
  // biome: preferred biome for spawning (global = anywhere)
  const STAGES = [
    { name: 'Bacterium',  icon: '🦠', biome: 'global', r: 14, maxHp: 40,  dmg: 5,  rate: 0.70, speed: 2.5, xp: 6 },
    { name: 'Amoeba',     icon: '🧫', biome: 'global', r: 16, maxHp: 50,  dmg: 7,  rate: 0.72, speed: 2.6, xp: 10 },
    { name: 'Worm',       icon: '🪱', biome: 'swamp',  r: 18, maxHp: 62,  dmg: 9,  rate: 0.74, speed: 2.7, xp: 15 },
    { name: 'Insect',     icon: '🐛', biome: 'forest', r: 20, maxHp: 76,  dmg: 12, rate: 0.76, speed: 2.8, xp: 22 },
    { name: 'Fish',       icon: '🐟', biome: 'water',  r: 22, maxHp: 92,  dmg: 15, rate: 0.78, speed: 2.9, xp: 30 },
    { name: 'Frog',       icon: '🐸', biome: 'swamp',  r: 24, maxHp: 110, dmg: 19, rate: 0.80, speed: 3.0, xp: 40 },
    { name: 'Mouse',      icon: '🐭', biome: 'forest', r: 26, maxHp: 130, dmg: 23, rate: 0.82, speed: 3.1, xp: 52 },
    { name: 'Rabbit',     icon: '🐰', biome: 'tundra', r: 28, maxHp: 152, dmg: 28, rate: 0.85, speed: 3.2, xp: 66 },
    { name: 'Snake',      icon: '🐍', biome: 'desert', r: 31, maxHp: 176, dmg: 34, rate: 0.90, speed: 3.3, xp: 82 },
    { name: 'Fox',        icon: '🦊', biome: 'forest', r: 34, maxHp: 204, dmg: 41, rate: 0.92, speed: 3.4, xp: 100 },
    { name: 'Wolf',       icon: '🐺', biome: 'tundra', r: 37, maxHp: 236, dmg: 49, rate: 0.95, speed: 3.5, xp: 120 },
    { name: 'Bear',       icon: '🐻', biome: 'forest', r: 41, maxHp: 274, dmg: 59, rate: 0.97, speed: 3.5, xp: 144 },
    { name: 'Crocodile',  icon: '🐊', biome: 'swamp',  r: 45, maxHp: 318, dmg: 70, rate: 1.00, speed: 3.6, xp: 170 },
    { name: 'Shark',      icon: '🦈', biome: 'water',  r: 50, maxHp: 368, dmg: 83, rate: 1.05, speed: 3.7, xp: 198 },
    { name: 'Lion',       icon: '🦁', biome: 'desert', r: 56, maxHp: 424, dmg: 98, rate: 1.10, speed: 3.8, xp: 228 },
    { name: 'Dragon',     icon: '🐉', biome: 'apex',   r: 63, maxHp: 488, dmg: 114, rate: 1.20, speed: 4.0, xp: 260 },
    { name: 'GOD',        icon: '👑', biome: 'apex',   r: 72, maxHp: 560, dmg: 132, rate: 1.40, speed: 4.2, xp: Infinity }
  ];

  const COLORS = [
    '#9bff7a', '#7bff5c', '#8aa36a', '#ffd24d', '#5cd8ff',
    '#7dff9a', '#b08aff', '#ffffff', '#9dffd0', '#ff9a5c',
    '#c9c9ff', '#8a5c3c', '#66dd88', '#4d9dff', '#ffd29a',
    '#ff5c5c', '#ffd700'
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

  // Total XP required to reach stage `idx` (from stage 0)
  function cumulativeXp(idx) {
    let s = 0;
    const n = Math.min(idx, STAGES.length - 1);
    for (let i = 0; i < n; i++) s += STAGES[i].xp;
    return s;
  }

  // Derive { stageIdx, evoProgress } from a total-XP amount.
  // Used when respawning with half XP so the stage stays consistent.
  function stageFromXp(totalXp) {
    let idx = 0;
    let t = totalXp;
    const n = STAGES.length;
    for (let i = 0; i < n - 1; i++) {
      if (t >= STAGES[i].xp) { t -= STAGES[i].xp; idx++; }
      else break;
    }
    return { stageIdx: idx, evo: t };
  }

  // True if `attacker` (by rank) can eat `victim` on the food chain
  function canEat(attackerRank, victimRank) {
    return attackerRank >= victimRank;
  }

  return { STAGES, stageAt, colorAt, stageCount, canEat, cumulativeXp, stageFromXp };
})();