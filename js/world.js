/* World generation: biomes, decor (trees/cacti/pines), edible food, and energy orbs */
const World = (() => {
  const WORLD_WIDTH = 12000;
  const GROUND_Y = 700;
  const CEIL_Y = 40;

  // Horizontal biome bands. key is used for spawn/visual matching.
  const BIOMES = [
    { key: 'forest', name: 'Forest',    start: 0,     end: 2000,  food: 'cherry',    ground: '#162b1c', groundHi: '#254a2e', skyTop: '#050f07', skyMid: '#0c2416', skyLow: '#123523', decor: 'tree' },
    { key: 'swamp',  name: 'Boglands',  start: 2000,  end: 3400,  food: 'mushroom',  ground: '#262b17', groundHi: '#3a3f24', skyTop: '#0b0c06', skyMid: '#161a0a', skyLow: '#202612', decor: 'dead' },
    { key: 'water',  name: 'Deepwater', start: 3400,  end: 5400,  food: 'fish',      ground: '#0e2030', groundHi: '#16354e', skyTop: '#03090f', skyMid: '#0a1a29', skyLow: '#122c40', decor: 'rock' },
    { key: 'desert', name: 'The Dunes', start: 5400,  end: 7400,  food: 'cactus',    ground: '#5a4722', groundHi: '#7a6030', skyTop: '#170e02', skyMid: '#3a2410', skyLow: '#5a3a16', decor: 'cactus' },
    { key: 'tundra', name: 'Frost',     start: 7400,  end: 9200,  food: 'snowberry', ground: '#94a4b8', groundHi: '#c4d4e4', skyTop: '#0b1018', skyMid: '#1e2c40', skyLow: '#33455e', decor: 'pine' },
    { key: 'forest', name: 'Forest',    start: 9200,  end: 10600, food: 'cherry',    ground: '#162b1c', groundHi: '#254a2e', skyTop: '#050f07', skyMid: '#0c2416', skyLow: '#123523', decor: 'tree' },
    { key: 'apex',   name: 'Crimson Lair', start: 10600, end: 12000, food: 'ember',  ground: '#2a1520', groundHi: '#4a2138', skyTop: '#120410', skyMid: '#260e20', skyLow: '#3a1430', decor: 'pillar' }
  ];

  function biomeAt(x) {
    for (const b of BIOMES) {
      if (x >= b.start && x < b.end) return b;
    }
    return BIOMES[0];
  }

  // Pick a biome for spawning a creature of a given stage
  function biomeForStage(stageIdx) {
    const s = Stages.stageAt(stageIdx);
    if (!s || !s.biome || s.biome === 'global') {
      return BIOMES[Math.floor(Math.random() * BIOMES.length)];
    }
    const candidates = BIOMES.filter(b => b.key === s.biome);
    return candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : BIOMES[0];
  }

  function generate() {
    // Decor objects (visual only)
    const decor = [];
    for (const b of BIOMES) {
      const span = b.end - b.start;
      const kind = b.decor;
      let count = Math.round(span / 260);
      for (let i = 0; i < count; i++) {
        decor.push({
          kind,
          x: b.start + 60 + Math.random() * (span - 120),
          y: GROUND_Y + (Math.random() * 30 - 15),
          h: 40 + Math.random() * 70,
          w: 30 + Math.random() * 40,
          seed: Math.random() * Math.PI * 2
        });
      }
    }
    return { decor, WORLD_WIDTH, GROUND_Y, CEIL_Y, BIOMES };
  }

  // Energy orbs — the classic evolution pickups
  function generateOrbs(count = 130) {
    const orbs = [];
    for (let i = 0; i < count; i++) {
      orbs.push(makeOrb());
    }
    return orbs;
  }

  function makeOrb() {
    return {
      x: 60 + Math.random() * (WORLD_WIDTH - 120),
      y: 90 + Math.random() * (GROUND_Y - 160),
      r: 7 + Math.random() * 4,
      pulse: Math.random() * Math.PI * 2,
      taken: false,
      xp: 2 + Math.floor(Math.random() * 3)   // 2-4 xp
    };
  }

  function respawnOrb(orbs, maxCount) {
    if (orbs.filter(o => !o.taken).length < maxCount) {
      orbs.push(makeOrb());
    }
  }

  // Edible food by biome type
  const FOOD_STYLES = {
    cherry:     { color: '#ff5c7a', glow: '#ff2d5e', xp: 1, name: 'Cherry' },
    mushroom:   { color: '#d8b06a', glow: '#8a6a3a', xp: 2, name: 'Fungus' },
    fish:       { color: '#5cd8ff', glow: '#2da4ff', xp: 2, name: 'Minnow' },
    cactus:     { color: '#ff7ad9', glow: '#ff3d9a', xp: 2, name: 'Prickly pear' },
    snowberry:  { color: '#e8f4ff', glow: '#b0d4ff', xp: 1, name: 'Snowberry' },
    ember:      { color: '#ff9a3c', glow: '#ff5c1a', xp: 3, name: 'Ember fruit' }
  };

  function makeFood(type, x, y, fromSeeded = false) {
    const st = FOOD_STYLES[type] || FOOD_STYLES.cherry;
    return {
      type: 'food',
      kind: type,
      x, y,
      r: 6 + Math.random() * 3,
      pulse: Math.random() * Math.PI * 2,
      color: st.color,
      glow: st.glow,
      xp: st.xp,
      name: st.name,
      taken: false,
      wob: Math.random() * 10
    };
  }

  function generateFood(count = 90) {
    const foods = [];
    for (let i = 0; i < count; i++) foods.push(randomFood());
    return foods;
  }

  function randomFood() {
    const b = BIOMES[Math.floor(Math.random() * BIOMES.length)];
    return makeFood(b.food, b.start + 50 + Math.random() * (b.end - b.start - 100), foodY(b));
  }

  function foodY(b) {
    if (b.key === 'water') return 260 + Math.random() * 240;
    return GROUND_Y - 30 - Math.random() * 60;
  }

  function respawnFood(foods, maxCount) {
    if (foods.filter(f => !f.taken).length < maxCount) {
      foods.push(randomFood());
    }
  }

  function foodStyle(kind) { return FOOD_STYLES[kind]; }

  return {
    WORLD_WIDTH, GROUND_Y, CEIL_Y, BIOMES,
    generate, biomeAt, biomeForStage,
    generateOrbs, makeOrb, respawnOrb,
    generateFood, randomFood, makeFood, respawnFood, foodStyle
  };
})();