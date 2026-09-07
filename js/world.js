/* World generation: terrain, platforms, and edible orbs spread across the map */
const World = (() => {
  const WORLD_WIDTH = 9000;   // total horizontal scroll distance
  const GROUND_Y = 700;       // ground surface (in world coords)
  const CEIL_Y = 40;          // top boundary

  function generate() {
    const platforms = [];
    // Ground segments with variable height bumps
    const seeds = [];
    for (let i = 0; i <= 30; i++) {
      seeds.push({
        x: i * 300,
        y: GROUND_Y + (i % 3 === 0 ? -40 : 0) + (Math.random() * 30 - 15)
      });
    }
    // Floating platforms: stable ledges for a flying creature
    for (let i = 0; i < 45; i++) {
      platforms.push({
        x: 150 + Math.random() * (WORLD_WIDTH - 300),
        y: 180 + Math.random() * 400,
        w: 120 + Math.random() * 160,
        h: 28
      });
    }
    return { platforms, seeds, WORLD_WIDTH, GROUND_Y, CEIL_Y };
  }

  // Orbs (the "non-player items" you eat to evolve) scattered across the whole map
  function generateOrbs(count = 170) {
    const orbs = [];
    for (let i = 0; i < count; i++) {
      orbs.push({
        x: 60 + Math.random() * (WORLD_WIDTH - 120),
        y: 90 + Math.random() * (GROUND_Y - 140),
        r: 7 + Math.random() * 4,
        pulse: Math.random() * Math.PI * 2,
        taken: false
      });
    }
    return orbs;
  }

  // Occasionally spawn new orbs to keep the map populated
  function respawnOrb(orbs, maxCount) {
    if (orbs.filter(o => !o.taken).length < maxCount) {
      orbs.push({
        x: 60 + Math.random() * (WORLD_WIDTH - 120),
        y: 90 + Math.random() * (GROUND_Y - 140),
        r: 7 + Math.random() * 5,
        pulse: 0,
        taken: false
      });
    }
  }

  return { WORLD_WIDTH, GROUND_Y, CEIL_Y, generate, generateOrbs, respawnOrb };
})();
