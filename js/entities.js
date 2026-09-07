/* Entities: rivals (NPCs) with food-chain AI, projectiles, particles, floating text */
const Entities = (() => {

  function makeRival(world, stageIdx) {
    const s = Stages.stageAt(stageIdx);
    const biome = World.biomeForStage(stageIdx);
    const x = biome ? biome.start + 120 + Math.random() * Math.max(40, biome.end - biome.start - 240) : 300 + Math.random() * (world.WORLD_WIDTH - 600);
    return {
      type: 'rival',
      stageIdx,
      rank: stageIdx,
      name: s.name,
      icon: s.icon,
      x,
      y: 150 + Math.random() * (world.GROUND_Y - 280),
      vx: 0,
      vy: 0,
      r: s.r,
      maxHp: s.maxHp,
      hp: s.maxHp,
      dmg: s.dmg,
      rate: s.rate,
      speed: s.speed,
      xp: 0,                   // rival XP — lets them evolve up the chain too
      cd: Math.random() * 1.5,
      alive: true,
      homeBiomeX: biome ? (biome.start + biome.end) / 2 : world.WORLD_WIDTH / 2,
      flash: 0,
      decide: Math.random() * 2,
      mood: 0                  // 0 wander/hunt-food, 1 hunting prey, 2 fleeing
    };
  }

  // Refresh stats when a rival evolves a stage
  function applyStage(r, idx) {
    const s = Stages.stageAt(idx);
    r.stageIdx = idx;
    r.rank = idx;
    r.name = s.name;
    r.icon = s.icon;
    r.r = s.r;
    r.maxHp = s.maxHp;
    r.hp = s.maxHp;
    r.dmg = s.dmg;
    r.rate = s.rate;
    r.speed = s.speed;
  }

  // ctx: { player, rivals, foods }
  function updateRival(r, dt, world, ctx) {
    if (!r.alive) return null;

    const scan = [{ e: ctx.player, rank: ctx.player.stageIdx }];
    for (const rr of ctx.rivals) {
      if (rr !== r && rr.alive) scan.push({ e: rr, rank: rr.stageIdx });
    }

    let nearestThreat = null, ndThreat = Infinity;
    let nearestPrey = null, ndPrey = Infinity;
    let nearestFood = null, ndFood = Infinity;

    for (const s of scan) {
      const dx = s.e.x - r.x, dy = s.e.y - r.y;
      const d = Math.hypot(dx, dy);
      if (s.rank > r.rank && d < ndThreat && d < 620) { nearestThreat = s.e; ndThreat = d; }
      if (s.rank <= r.rank && d < ndPrey && d < 600) { nearestPrey = s.e; ndPrey = d; }
    }
    for (const f of ctx.foods) {
      if (f.taken) continue;
      const d = Math.hypot(f.x - r.x, f.y - r.y);
      if (d < ndFood && d < 420) { nearestFood = f; ndFood = d; }
    }

    r.decide -= dt;
    const fleeing = nearestThreat && (r.mood === 2 || ndThreat < 300);
    let fleeingNow = false;
    if (fleeing) {
      if (r.decide <= 0) { r.decide = 0.6 + Math.random() * 0.8; }
      else fleeingNow = true;
      r.mood = 2;
    } else {
      if (nearestPrey && ndPrey < 460) {
        r.mood = 1;
      } else if (nearestFood && r.mood !== 1) {
        r.mood = 0;
      } else if (nearestPrey) {
        r.mood = 1;
      }
    }

    // Steering: blend behavioral vectors (chase / flee / seek food / wander-home)
    let tx = 0, ty = 0, active = 0;
    if (fleeing) {
      const dx = r.x - nearestThreat.x, dy = r.y - nearestThreat.y;
      const d = Math.hypot(dx, dy) || 1;
      tx = dx / d; ty = dy / d * 0.6;
      active = 1.6;
    } else if (r.mood === 1 && nearestPrey) {
      const dx = nearestPrey.x - r.x, dy = nearestPrey.y - r.y;
      const d = Math.hypot(dx, dy) || 1;
      tx = dx / d; ty = dy / d * 0.55;
      active = 1.25;
    } else if (r.mood === 0 && nearestFood) {
      const dx = nearestFood.x - r.x, dy = nearestFood.y - r.y;
      const d = Math.hypot(dx, dy) || 1;
      tx = dx / d; ty = dy / d * 0.4;
      active = 0.9;
    } else {
      // Wander near home biome
      const dxHome = r.homeBiomeX - r.x;
      const drift = Math.sin(r.x * 0.004 + r.stageIdx) * 0.5;
      tx = drift + dxHome * 0.0006;
      ty = Math.sin(r.x * 0.003 + r.stageIdx) * 0.3 - (r.y - 320) / 600;
      active = 0.55;
    }

    if (fleeingNow) {
      // hard run: reduce wander smoothing
      active = 1.6;
    }

    // Hover baseline toward mid-screen height
    const hover = (310 - r.y) / 500;
    const ax = tx * active * r.speed;
    const ay = (ty * active + hover) * r.speed;

    r.vx += (ax - r.vx) * Math.min(1, dt * 3.2);
    r.vy += (ay - r.vy) * Math.min(1, dt * 3.2);

    r.x += r.vx * dt * 90;
    r.y += r.vy * dt * 90;

    // Bounds
    if (r.x < 40) { r.x = 40; r.vx = Math.abs(r.vx); }
    if (r.x > world.WORLD_WIDTH - 40) { r.x = world.WORLD_WIDTH - 40; r.vx = -Math.abs(r.vx); }
    if (r.y < world.CEIL_Y + 24) { r.y = world.CEIL_Y + 24; r.vy = Math.abs(r.vy); }
    if (r.y > world.GROUND_Y - 20) { r.y = world.GROUND_Y - 20; r.vy = -Math.abs(r.vy); }

    // Shooting: only when hunting (not fleeing) and prey is in range
    r.cd -= dt;
    r.flash = Math.max(0, r.flash - dt);
    if (nearestPrey && r.mood > 0 && !fleeing && ndPrey < 520 && r.cd <= 0) {
      r.cd = 1 / r.rate;
      return nearestPrey;
    }
    return null;
  }

  function makeProjectile(x, y, ang, dmg, speed, fromPlayer, stageColor, srcRival) {
    return {
      type: 'proj',
      x, y,
      ang,
      speed,
      dmg,
      fromPlayer,
      srcRival: srcRival || null,
      color: stageColor || '#7bff5c',
      life: 2.2,
      alive: true
    };
  }

  function makeParticles(x, y, color, count = 12) {
    const ps = [];
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 140;
      ps.push({
        type: 'particle',
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.4 + Math.random() * 0.6,
        maxLife: 1,
        color,
        r: 2 + Math.random() * 3
      });
    }
    return ps;
  }

  function makeFloatingText(x, y, text, color, big = false) {
    return {
      type: 'text',
      x, y,
      text,
      color,
      life: big ? 1.4 : 0.9,
      maxLife: big ? 1.4 : 0.9,
      big
    };
  }

  function updateParticle(p, dt) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 1 - dt * 1.5;
    p.vy *= 1 - dt * 1.5;
    return p.life > 0;
  }

  function updateText(t, dt) {
    t.life -= dt;
    t.y -= 30 * dt;
    return t.life > 0;
  }

  function updateProj(p, dt, world) {
    p.life -= dt;
    p.x += Math.cos(p.ang) * p.speed * dt;
    p.y += Math.sin(p.ang) * p.speed * dt;
    if (p.y > world.GROUND_Y - 4 || p.y < world.CEIL_Y || p.x < 0 || p.x > world.WORLD_WIDTH) p.alive = false;
    return p.alive && p.life > 0;
  }

  return {
    makeRival, applyStage, updateRival,
    makeProjectile, updateProj,
    makeParticles, updateParticle,
    makeFloatingText, updateText
  };
})();