/* Player: flying physics (light gravity), evolution progression, XP, half-XP respawn */
const Player = (() => {

  const GRAV = 750;          // lighter gravity = floatier flight
  const THRUST = 1900;
  const ACCEL = 1100;

  function create() {
    const s = Stages.stageAt(0);
    return {
      type: 'player',
      x: 400,
      y: 300,
      vx: 0,
      vy: 0,
      stageIdx: 0,
      r: s.r,
      maxHp: s.maxHp,
      hp: s.maxHp,
      dmg: s.dmg,
      rate: s.rate,
      speed: s.speed,
      evo: 0,            // XP progress toward next stage
      xp: 0,             // lifetime XP (used for half-XP respawn)
      score: 0,
      kills: 0,
      cd: 0,
      dashCd: 0,
      dashing: 0,
      dashDx: 0,
      dashDy: 0,
      flash: 0,
      invuln: 0,
      alive: true
    };
  }

  function applyStage(p, idx) {
    p.stageIdx = idx;
    const s = Stages.stageAt(idx);
    const newMax = s.maxHp;
    const heal = Math.max(newMax * 0.4, newMax - p.hp);
    p.maxHp = newMax;
    p.hp = Math.min(p.hp + heal, newMax);
    p.r = s.r;
    p.dmg = s.dmg;
    p.rate = s.rate;
    p.speed = s.speed;
  }

  function update(p, dt, input, world) {
    if (!p.alive) return;

    // --- Input / physics ---
    if (input.isDown('KeyW')) {
      p.vy -= THRUST * dt;
    }

    let moveX = 0;
    if (input.isDown('KeyA')) moveX -= 1;
    if (input.isDown('KeyD')) moveX += 1;

    // Dashing overrides movement
    if (p.dashing > 0) {
      p.dashing -= dt;
      p.x += p.dashDx * dt;
      p.y += p.dashDy * dt;
      if (p.x < 30) p.x = 30;
      if (p.x > world.WORLD_WIDTH - 30) p.x = world.WORLD_WIDTH - 30;
      if (p.y < world.CEIL_Y) p.y = world.CEIL_Y;
      if (p.y > world.GROUND_Y - 20) { p.y = world.GROUND_Y - 20; p.dashing = 0; }
    } else {
      p.vx += moveX * ACCEL * dt;
      p.vy += GRAV * dt;
      p.vx *= 1 - Math.min(1, dt * 3);
      p.vy = Math.max(-900, Math.min(900, p.vy));

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (p.x < 30) { p.x = 30; p.vx = Math.max(0, p.vx); }
      if (p.x > world.WORLD_WIDTH - 30) { p.x = world.WORLD_WIDTH - 30; p.vx = Math.min(0, p.vx); }
      if (p.y < world.CEIL_Y) { p.y = world.CEIL_Y; p.vy = Math.max(0, p.vy); }
      if (p.y > world.GROUND_Y - 20) { p.y = world.GROUND_Y - 20; p.vy = 0; }
    }

    // --- Cooldowns / timers ---
    p.cd -= dt;
    p.dashCd -= dt;
    p.flash = Math.max(0, p.flash - dt);
    p.invuln = Math.max(0, p.invuln - dt);

    // --- Dash ---
    if (input.wasPressed('KeyE') && p.dashCd <= 0) {
      p.dashCd = 1.6;
      p.dashing = 0.18;
      const ang = Math.atan2(input.mouse.y - window.innerHeight / 2, input.mouse.x - window.innerWidth / 2);
      p.dashDx = Math.cos(ang) * 1400;
      p.dashDy = Math.sin(ang) * 1400;
      AudioSys.sfx.dash();
    }
  }

  // Returns a projectile if a shot was fired this frame
  function tryShoot(p, input, world) {
    if (!p.alive || p.cd > 0) return null;
    p.cd = 1 / p.rate;
    const ang = Math.atan2(
      input.mouse.y - window.innerHeight / 2,
      input.mouse.x - window.innerWidth / 2
    );
    const speed = 460 + p.stageIdx * 22;
    AudioSys.sfx.shoot();
    return Entities.makeProjectile(
      p.x, p.y - 10, ang, p.dmg, speed, true, Stages.colorAt(p.stageIdx)
    );
  }

  // Advance exactly one stage
  function evolve(p) {
    if (p.stageIdx >= Stages.stageCount() - 1) return false;
    p.stageIdx++;
    applyStage(p, p.stageIdx);
    AudioSys.sfx.evolve();
    return true;
  }

  function gainEvo(p, amount) {
    p.evo += amount;
    p.xp += amount;
    p.score += Math.round(amount);
    let evolved = false;
    while (p.evo >= Stages.stageAt(p.stageIdx).xp && p.stageIdx < Stages.stageCount() - 1) {
      p.evo -= Stages.stageAt(p.stageIdx).xp;
      evolve(p);
      evolved = true;
    }
    return evolved;
  }

  function takeDamage(p, dmg, world) {
    if (!p.alive || p.invuln > 0) return false;
    p.hp -= dmg;
    p.flash = 0.15;
    AudioSys.sfx.hurt();
    if (p.hp <= 0) {
      p.hp = 0;
      p.alive = false;
      return true;
    }
    return false;
  }

  // Respawn after being devoured: keep exactly half of lifetime XP,
  // and rebuild stage/progress from that amount.
  function respawn(p, world) {
    const half = Math.floor(p.xp * 0.5);
    const { stageIdx, evo } = Stages.stageFromXp(half);
    p.xp = half;
    applyStage(p, stageIdx);
    p.evo = evo;
    p.hp = p.maxHp;
    p.x = 400;
    p.y = 300;
    p.vx = 0;
    p.vy = 0;
    p.dashing = 0;
    p.cd = 0;
    p.invuln = 2.5;
    p.alive = true;
  }

  return { create, update, tryShoot, gainEvo, takeDamage, applyStage, evolve, respawn };
})();