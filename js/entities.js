/* Entities: rivals (NPCs), projectiles, particles, orbs */
const Entities = (() => {

  function makeRival(world, playerStageIdx) {
    // Rivals spawn at a lower stage than the player's current, scaled over time
    const stageIdx = Math.max(0, playerStageIdx - 1 - Math.floor(Math.random() * 2));
    const s = Stages.stageAt(stageIdx);
    const x = 200 + Math.random() * (world.WORLD_WIDTH - 400);
    return {
      type: 'rival',
      stageIdx,
      name: Stages.stageAt(stageIdx).name,
      icon: s.icon,
      x,
      y: 150 + Math.random() * (world.GROUND_Y - 250),
      vx: 0,
      vy: 0,
      r: s.r,
      maxHp: s.maxHp,
      hp: s.maxHp,
      dmg: s.dmg,
      rate: s.rate,
      speed: s.speed,
      cd: Math.random() * 1.5,
      alive: true,
      wander: 0,
      wanderDir: Math.random() < 0.5 ? -1 : 1,
      flash: 0
    };
  }

  function updateRival(r, dt, world, player) {
    // Wander / chase behavior
    const dx = player.x - r.x;
    const dy = player.y - r.y;
    const dist = Math.hypot(dx, dy);
    const aggro = dist < 450;

    r.wander -= dt;
    if (r.wander <= 0) {
      r.wander = 1.5 + Math.random() * 2;
      r.wanderDir = Math.random() < 0.5 ? -1 : 1;
    }

    let ax = 0;
    if (aggro) {
      ax = (dx / dist) * r.speed * 2.2;
    } else {
      ax = r.wanderDir * r.speed * 0.8;
    }
    r.vx += ax * dt * 6;
    r.vx *= 1 - Math.min(1, dt * 4);

    // Float / pseudo gravity with small hover thrust to stay aloft
    const hover = dist < 260 ? -dy / (dist || 1) : (r.y > 300 ? -0.4 : 0.6);
    r.vy += hover * r.speed * dt * 5;
    r.vy = Math.max(-r.speed, Math.min(r.speed, r.vy));
    r.y += r.vy * dt * 60;
    r.x += r.vx * dt * 60;

    // Keep in bounds
    if (r.x < 40) { r.x = 40; r.vx *= -0.5; }
    if (r.x > world.WORLD_WIDTH - 40) { r.x = world.WORLD_WIDTH - 40; r.vx *= -0.5; }
    if (r.y < world.CEIL_Y + 20) r.y = world.CEIL_Y + 20;
    if (r.y > world.GROUND_Y - 15) { r.y = world.GROUND_Y - 15; r.vy = 0; }

    // Shooting cooldown
    r.cd -= dt;
    if (r.cd <= 0 && aggro) {
      r.cd = 1 / r.rate;
      return true; // wants to shoot
    }
    r.flash = Math.max(0, r.flash - dt);
    return false;
  }

  function makeProjectile(x, y, ang, dmg, speed, fromPlayer, stageColor) {
    return {
      type: 'proj',
      x, y,
      ang,
      speed,
      dmg,
      fromPlayer,
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
    if (p.y > world.GROUND_Y || p.y < world.CEIL_Y || p.x < 0 || p.x > world.WORLD_WIDTH) p.alive = false;
    return p.alive && p.life > 0;
  }

  return {
    makeRival, updateRival,
    makeProjectile, updateProj,
    makeParticles, updateParticle,
    makeFloatingText, updateText
  };
})();
