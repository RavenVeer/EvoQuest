/* Main game loop, camera, rendering, and wiring everything together */
(function () {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  let W, H, dpr;

  const world = World.generate();
  let player = Player.create();
  let rivals = [];
  let orbs = World.generateOrbs();
  let projectiles = [];
  let particles = [];
  let texts = [];
  let camera = { x: 0, y: 0 };

  const MAX_ORBS = 200;
  const MAX_RIVALS = 7;

  let gameState = 'menu'; // menu | playing | gameover
  let stateTime = 0;
  let shake = 0;

  const hud = {
    healthFill: document.getElementById('health-fill'),
    healthLabel: document.getElementById('health-label'),
    evoFill: document.getElementById('evo-fill'),
    evoLabel: document.getElementById('evo-label'),
    stageName: document.getElementById('stage-name'),
    stageIcon: document.getElementById('stage-icon'),
    score: document.getElementById('score-val'),
    kills: document.getElementById('kills-val'),
    stages: document.getElementById('stages-val'),
    killFeed: document.getElementById('kill-feed'),
    vignette: document.getElementById('vignette'),
    evoNotice: document.getElementById('evo-notice'),
    evoNoticeIcon: document.getElementById('evo-notice-icon'),
    evoNoticeName: document.getElementById('evo-notice-name')
  };

  const menu = document.getElementById('menu');
  const gameover = document.getElementById('gameover');
  const startBtn = document.getElementById('start-btn');
  const restartBtn = document.getElementById('restart-btn');
  const goStats = document.getElementById('go-stats');

  /* ---------- Setup / restart ---------- */
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function initWorld() {
    orbs = World.generateOrbs();
    rivals = [];
    for (let i = 0; i < MAX_RIVALS; i++) {
      rivals.push(Entities.makeRival(world, 2));
    }
    projectiles = [];
    particles = [];
    texts = [];
  }

  function startGame() {
    player = Player.create();
    initWorld();
    camera.x = player.x - W / 2;
    camera.y = 0;
    gameState = 'playing';
    stateTime = 0;
    AudioSys.init();
    AudioSys.resume();
    updateHUD();
    menu.classList.add('hidden');
    gameover.classList.add('hidden');
  }

  function restart() {
    startGame();
  }

  // Parallax starfield / background
  const stars = [];
  for (let i = 0; i < 120; i++) {
    stars.push({
      x: Math.random() * 12000,
      y: Math.random() * 900,
      r: Math.random() * 1.6 + 0.3,
      tw: Math.random() * Math.PI * 2
    });
  }

  const clouds = [];
  for (let i = 0; i < 30; i++) {
    clouds.push({
      x: Math.random() * 12000,
      y: 120 + Math.random() * 420,
      w: 160 + Math.random() * 260,
      spd: 4 + Math.random() * 12,
      o: 0.05 + Math.random() * 0.08
    });
  }

  function drawBackground(t) {
    // Sky gradient
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#05070f');
    g.addColorStop(0.55, '#0e1733');
    g.addColorStop(1, '#1a2440');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Far stars
    ctx.fillStyle = '#ffffff';
    for (const s of stars) {
      const sx = (s.x - camera.x * 0.15) % (W + 50);
      const px = sx < 0 ? sx + W + 50 : sx;
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + s.tw));
      ctx.globalAlpha = tw * 0.8;
      ctx.beginPath();
      ctx.arc(px, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Drifting clouds
    for (const c of clouds) {
      c.x += c.spd * 0.016;
      if (c.x - camera.x * 0.3 > W + 400) c.x = camera.x * 0.3 - 400;
      const px = c.x - camera.x * 0.3;
      ctx.globalAlpha = c.o;
      ctx.fillStyle = '#2c3a63';
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(px + i * c.w * 0.25, c.y, (c.w / 2) * (0.5 + i * 0.1), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawWorld(t) {
    // Terrain silhouette (ground)
    ctx.save();
    ctx.fillStyle = '#1a1f33';
    ctx.strokeStyle = '#33406a';
    ctx.lineWidth = 3;

    const startX = Math.max(0, camera.x - 100);
    const endX = Math.min(world.WORLD_WIDTH, camera.x + W + 100);

    ctx.beginPath();
    ctx.moveTo(startX - camera.x, world.GROUND_Y - camera.y);
    for (let x = startX; x <= endX; x += 40) {
      const bump = Math.sin(x * 0.01) * 14 + Math.sin(x * 0.004) * 26 + Math.cos(x * 0.002) * 20;
      ctx.lineTo(x - camera.x, world.GROUND_Y + bump - camera.y);
    }
    ctx.lineTo(endX - camera.x, H + 200 - camera.y);
    ctx.lineTo(startX - camera.x, H + 200 - camera.y);
    ctx.closePath();
    ctx.fill();

    // floating platforms
    ctx.fillStyle = '#2a3354';
    for (const p of world.platforms) {
      if (p.x + p.w < camera.x - 50 || p.x > camera.x + W + 50) continue;
      ctx.fillRect(p.x - camera.x, p.y - camera.y, p.w, p.h);
      ctx.fillStyle = '#3a4a7a';
      ctx.fillRect(p.x - camera.x, p.y - camera.y, p.w, 5);
      ctx.fillStyle = '#2a3354';
    }
    ctx.restore();
  }

  function drawOrb(o, t) {
    const px = o.x - camera.x;
    const py = o.y;
    const pulse = 1 + 0.15 * Math.sin(t * 3 + o.pulse);
    const r = o.r * pulse;
    const grad = ctx.createRadialGradient(px, py, 0, px, py, r * 2.4);
    grad.addColorStop(0, 'rgba(0,213,255,0.45)');
    grad.addColorStop(0.4, 'rgba(0,160,255,0.25)');
    grad.addColorStop(1, 'rgba(0,160,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px, py, r * 2.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#aef2ff';
    ctx.shadowColor = '#00d5ff';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.arc(px - r * 0.3, py - r * 0.3, r * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawCreature(c, t, isPlayer) {
    const px = c.x - camera.x;
    const py = c.y;
    if (px < -80 || px > W + 80) return;

    const color = Stages.colorAt(c.stageIdx);
    const r = c.r;

    // Flashing when hit
    ctx.save();
    if (c.flash > 0) {
      ctx.filter = 'brightness(2.2)';
    }

    // Aura ring
    ctx.strokeStyle = Stages.colorAt(c.stageIdx, 0.35);
    ctx.lineWidth = 3;
    ctx.shadowColor = color;
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.arc(px, py, r + 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Body
    const grad = ctx.createRadialGradient(px - r * 0.3, py - r * 0.4, r * 0.2, px, py, r);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.45, color);
    grad.addColorStop(1, Stages.colorAt(c.stageIdx, 1));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();

    // Inner detail
    ctx.strokeStyle = Stages.colorAt(c.stageIdx, 0.5);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, r * 0.55, 0, Math.PI * 2);
    ctx.stroke();

    // Eyes (always face right by default, or toward mouse for player)
    let eyeDx = 1, eyeDy = 0;
    if (isPlayer) {
      const ang = Math.atan2(Input.mouse.y - H / 2 - 22, Input.mouse.x - W / 2);
      eyeDx = Math.cos(ang);
      eyeDy = Math.sin(ang);
    }
    const ex = eyeDx * r * 0.5;
    const ey = eyeDy * r * 0.5;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(px + ex, py + ey - r * 0.1, r * 0.28, 0, Math.PI * 2);
    ctx.arc(px + ex, py + ey + r * 0.1, r * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0a0e1a';
    ctx.beginPath();
    ctx.arc(px + ex + eyeDx * r * 0.1, py + ey - r * 0.1 + eyeDy * r * 0.1, r * 0.13, 0, Math.PI * 2);
    ctx.arc(px + ex + eyeDx * r * 0.1, py + ey + r * 0.1 + eyeDy * r * 0.1, r * 0.13, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // HP bar over NPCs
    if (!isPlayer && c.hp < c.maxHp) {
      const bw = r * 2;
      const bx = px - bw / 2;
      const by = py - r - 16;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(bx, by, bw, 5);
      ctx.fillStyle = '#ff5c5c';
      ctx.fillRect(bx, by, bw * Math.max(0, c.hp / c.maxHp), 5);
    }
  }

  function drawProjectile(p) {
    const px = p.x - camera.x;
    const py = p.y;
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // trail line
    ctx.strokeStyle = p.color;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px - Math.cos(p.ang) * 16, py - Math.sin(p.ang) * 16);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawParticles(ps) {
    for (const p of ps) {
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x - camera.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawTexts() {
    ctx.textAlign = 'center';
    for (const t of texts) {
      const a = Math.min(1, t.life / (t.maxLife * 0.5));
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = t.color;
      ctx.shadowColor = t.color;
      ctx.shadowBlur = 8;
      ctx.font = (t.big ? 'bold 22px' : 'bold 15px') + ' Segoe UI, sans-serif';
      ctx.fillText(t.text, t.x - camera.x, t.y);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  function render(t) {
    ctx.clearRect(0, 0, W, H);
    drawBackground(t);
    drawWorld(t);

    // Orbs
    for (const o of orbs) {
      if (!o.taken) drawOrb(o, t);
    }

    // Rivals beneath particles
    for (const r of rivals) if (r.alive) drawCreature(r, t, false);
    for (const p of projectiles) drawProjectile(p);
    drawCreature(player, t, true);
    drawParticles(particles);
    drawTexts();
  }

  /* ---------- Game logic update ---------- */
  function handleCollisions() {
    const eatDst = player.r + 8;

    // Player eats orbs
    for (const o of orbs) {
      if (o.taken) continue;
      if (Math.hypot(player.x - o.x, player.y - o.y) < eatDst + o.r) {
        o.taken = true;
        AudioSys.sfx.eat();
        const evolved = Player.gainEvo(player, 3);
        particles.push(...Entities.makeParticles(o.x, o.y, '#00d5ff', 10));
        if (evolved) {
          spawnEvoNotice();
        }
      }
    }

    // Projectile collisions
    for (const p of projectiles) {
      if (!p.alive) continue;
      if (p.fromPlayer) {
        // hit rivals
        for (const r of rivals) {
          if (!r.alive) continue;
          if (Math.hypot(p.x - r.x, p.y - r.y) < r.r + 5) {
            p.alive = false;
            r.hp -= p.dmg;
            r.flash = 0.1;
            AudioSys.sfx.hit();
            particles.push(...Entities.makeParticles(p.x, p.y, r.hp > 0 ? '#ff8888' : '#ffffff', 8));
            if (r.hp <= 0) {
              killRival(r, p.fromPlayer);
            }
            break;
          }
        }
        // hit player's own feet? no
      } else {
        // rival projectile hits player
        if (Math.hypot(p.x - player.x, p.y - player.y) < player.r + 5) {
          p.alive = false;
          Player.takeDamage(player, p.dmg, world);
          hud.vignette.classList.add('damaged');
          setTimeout(() => hud.vignette.classList.remove('damaged'), 160);
          particles.push(...Entities.makeParticles(p.x, p.y, '#ff5c5c', 10));
          texts.push(Entities.makeFloatingText(p.x, p.y, '-' + p.dmg, '#ff5c5c'));
        }
      }
    }

    // Contact damage / kill
    for (const r of rivals) {
      if (!r.alive) continue;
      const d = Math.hypot(player.x - r.x, player.y - r.y);
      if (d < player.r + r.r) {
        if (player.r > r.r * 1.15) {
          // bigger eats smaller
          killRival(r, true);
        }
      }
    }
  }

  function killRival(r, byPlayer) {
    r.alive = false;
    particles.push(...Entities.makeParticles(r.x, r.y, Stages.colorAt(r.stageIdx), 24));
    if (byPlayer) {
      player.kills++;
      const gain = 8 + r.stageIdx * 4;
      const evolved = Player.gainEvo(player, gain);
      AudioSys.sfx.kill();
      texts.push(Entities.makeFloatingText(r.x, r.y, '+' + gain + ' EVO', '#7bff5c', true));
      addKillFeed('You defeated ' + r.name + ' ' + r.icon);
      if (evolved) spawnEvoNotice();
      // chance to drop an orb
      drops.push({ x: r.x, y: r.y, timer: 0.6 });
    }
  }

  // Orbs dropped by killed rivals that remain edible for a moment
  const drops = [];

  function spawnEvoNotice() {
    hud.evoNoticeIcon.textContent = Stages.stageAt(player.stageIdx).icon;
    hud.evoNoticeName.textContent = Stages.stageAt(player.stageIdx).name;
    // restart the animation by removing/re-adding the element
    const el = hud.evoNotice;
    el.classList.add('hidden');
    void el.offsetWidth; // force reflow to restart animation
    el.classList.remove('hidden');
    clearTimeout(spawnEvoNotice._to);
    spawnEvoNotice._to = setTimeout(() => el.classList.add('hidden'), 2400);
  }

  function addKillFeed(msg) {
    const el = document.createElement('div');
    el.className = 'kill-msg';
    el.textContent = msg;
    hud.killFeed.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  function respawnRivals() {
    const alive = rivals.filter(r => r.alive);
    while (alive.length < MAX_RIVALS) {
      const nr = Entities.makeRival(world, player.stageIdx);
      rivals.push(nr);
      alive.push(nr);
    }
  }

  function update(dt, t) {
    if (gameState !== 'playing') return;
    stateTime += dt;

    Player.update(player, dt, Input, world);

    // Shooting
    if (Input.wasClicked() || Input.wasPressed('Space')) {
      const proj = Player.tryShoot(player, Input, world);
      if (proj) projectiles.push(proj);
    }

    // Rivals
    for (const r of rivals) {
      if (!r.alive) continue;
      const wantsShoot = Entities.updateRival(r, dt, world, player);
      if (wantsShoot) {
        const ang = Math.atan2(player.y - r.y, player.x - r.x);
        projectiles.push(Entities.makeProjectile(r.x, r.y - 10, ang, r.dmg, 320, false, Stages.colorAt(r.stageIdx)));
      }
    }

    // Orbs refresh
    World.respawnOrb(orbs, MAX_ORBS);

    // Drops
    for (const d of drops.slice()) {
      d.timer -= dt;
      if (d.timer <= 0) {
        orbs.push({ x: d.x, y: d.y, r: 9, pulse: 0, taken: false });
        drops.splice(drops.indexOf(d), 1);
      }
    }

    handleCollisions();

    // Clean up dead rivals & replace
    rivals = rivals.filter(r => r.alive);
    respawnRivals();

    // Update projectiles
    for (const p of projectiles) {
      if (!Entities.updateProj(p, dt, world)) {
        // expired — small puff
        p.alive = false;
      }
    }
    projectiles = projectiles.filter(p => p.alive);

    // Particles & texts
    particles = particles.filter(p => p.type === 'particle' ? Entities.updateParticle(p, dt) : true);
    texts = texts.filter(t => Entities.updateText(t, dt));

    // Camera follows player
    const targetX = player.x - W / 2;
    const targetY = Math.max(-160, Math.min(0, player.y - H / 2.4));
    camera.x += (targetX - camera.x) * Math.min(1, dt * 6);
    camera.y += (targetY - camera.y) * Math.min(1, dt * 6);
    camera.x = Math.max(0, Math.min(world.WORLD_WIDTH - W, camera.x));

    // Camera shake
    if (shake > 0) {
      shake = Math.max(0, shake - dt);
      const sx = (Math.random() - 0.5) * shake * 14;
      const sy = (Math.random() - 0.5) * shake * 14;
      camera.x += sx;
      camera.y += sy;
    }

    updateHUD();

    // Check game over
    if (!player.alive) {
      gameState = 'gameover';
      goStats.innerHTML =
        'Final Score: <b>' + player.score + '</b><br>' +
        'Creatures Devoured: <b>' + player.kills + '</b><br>' +
        'Evolution Stage: <b>' + Stages.stageAt(player.stageIdx).name + ' ' + Stages.stageAt(player.stageIdx).icon + '</b>';
      gameover.classList.remove('hidden');
      shake = 1;
    }
  }

  function updateHUD() {
    const p = player;
    const hpPct = Math.max(0, p.hp / p.maxHp) * 100;
    hud.healthFill.style.width = hpPct + '%';
    hud.healthLabel.textContent = Math.ceil(p.hp) + ' / ' + p.maxHp;

    const cur = Stages.stageAt(p.stageIdx);
    const evoPct = p.stageIdx >= Stages.stageCount() - 1 ? 100 : Math.min(100, (p.evo / cur.xp) * 100);
    hud.evoFill.style.width = evoPct + '%';
    hud.evoLabel.textContent = 'EVO ' + Math.floor(evoPct) + '%';

    hud.stageName.textContent = cur.name;
    hud.stageIcon.textContent = cur.icon;
    hud.score.textContent = p.score;
    hud.kills.textContent = p.kills;
    hud.stages.textContent = p.stageIdx + 1;

    if (p.stageIdx >= Stages.stageCount() - 1) {
      hud.stageName.style.color = '#ffd700';
      hud.evoLabel.textContent = 'GOD MODE';
    }
  }

  /* ---------- Loop ---------- */
  let lastT = 0;
  function loop(t) {
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
    lastT = t;

    update(dt, t / 1000);
    render(t / 1000);

    Input.endFrame();

    // Ambient occasional wind
    if (Math.random() < 0.01) AudioSys.sfx.ambientWind();

    requestAnimationFrame(loop);
  }

  /* ---------- Events ---------- */
  function keyHandler(e) {
    // Escape returns to menu from playing
    if (e.code === 'Escape' && gameState === 'playing') {
      gameState = 'menu';
      menu.classList.remove('hidden');
    }
    // M toggles mute
    if (e.code === 'KeyM') {
      AudioSys.setMuted(!AudioSys.muted);
    }
  }
  window.addEventListener('keydown', keyHandler);

  startBtn.addEventListener('click', startGame);
  restartBtn.addEventListener('click', restart);

  window.addEventListener('resize', resize);

  /* ---------- Boot ---------- */
  resize();
  requestAnimationFrame(loop);
})();
