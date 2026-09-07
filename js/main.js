/* Main game loop, camera, rendering, food chain combat, and wiring */
(function () {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  let W, H, dpr;

  const world = World.generate();
  let player = Player.create();
  let rivals = [];
  let orbs = World.generateOrbs();
  let foods = World.generateFood();
  let projectiles = [];
  let particles = [];
  let texts = [];
  let drops = [];
  let camera = { x: 0, y: 0 };

  const MAX_ORBS = 140;
  const MAX_FOOD = 90;
  const MAX_RIVALS = 8;

  let gameState = 'menu'; // menu | playing
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
    xp: document.getElementById('xp-val'),
    killFeed: document.getElementById('kill-feed'),
    vignette: document.getElementById('vignette'),
    evoNotice: document.getElementById('evo-notice'),
    evoNoticeIcon: document.getElementById('evo-notice-icon'),
    evoNoticeName: document.getElementById('evo-notice-name')
  };

  const menu = document.getElementById('menu');
  const startBtn = document.getElementById('start-btn');

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

  function pickRivalStage() {
    const base = player.stageIdx;
    const offset = Math.floor(Math.random() * 5) - 2; // -2..+2 around player
    return Math.max(0, Math.min(Stages.stageCount() - 1, base + offset));
  }

  function initWorld() {
    orbs = World.generateOrbs();
    foods = World.generateFood();
    rivals = [];
    for (let i = 0; i < MAX_RIVALS; i++) {
      rivals.push(Entities.makeRival(world, pickRivalStage()));
    }
    projectiles = [];
    particles = [];
    texts = [];
    drops = [];
  }

  function startGame() {
    player = Player.create();
    initWorld();
    camera.x = Math.max(0, player.x - W / 2);
    camera.y = 0;
    gameState = 'playing';
    stateTime = 0;
    AudioSys.init();
    AudioSys.resume();
    updateHUD();
    menu.classList.add('hidden');
  }

  /* ---------- Background / world rendering ---------- */
  const stars = [];
  for (let i = 0; i < 140; i++) {
    stars.push({
      x: Math.random() * World.WORLD_WIDTH,
      y: Math.random() * 900,
      r: Math.random() * 1.6 + 0.3,
      tw: Math.random() * Math.PI * 2
    });
  }

  const clouds = [];
  for (let i = 0; i < 30; i++) {
    clouds.push({
      x: Math.random() * World.WORLD_WIDTH,
      y: 120 + Math.random() * 420,
      w: 160 + Math.random() * 260,
      spd: 4 + Math.random() * 12,
      o: 0.05 + Math.random() * 0.08
    });
  }

  function drawBackground(t) {
    const b = World.biomeAt(camera.x + W / 2);

    // Biome-tinted sky
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, b.skyTop);
    g.addColorStop(0.55, b.skyMid);
    g.addColorStop(1, b.skyLow);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Far stars
    ctx.fillStyle = '#ffffff';
    for (const s of stars) {
      const sx = ((s.x - camera.x * 0.15) % (W + 50));
      const px = sx < 0 ? sx + W + 50 : sx;
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + s.tw));
      ctx.globalAlpha = tw * 0.7;
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
      ctx.fillStyle = '#55628a';
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(px + i * c.w * 0.25, c.y, (c.w / 2) * (0.5 + i * 0.1), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function visibleBiomes() {
    const x0 = camera.x - 60;
    const x1 = camera.x + W + 60;
    const out = [];
    for (const b of World.BIOMES) {
      if (b.end < x0 || b.start > x1) continue;
      out.push(b);
    }
    return out;
  }

  function drawGround() {
    for (const b of visibleBiomes()) {
      const rx0 = Math.max(b.start, camera.x - 60);
      const rx1 = Math.min(b.end, camera.x + W + 60);
      if (rx1 <= rx0) continue;
      const px = rx0 - camera.x;
      const pw = rx1 - rx0;

      // ground body (billowed top edge for terrain feel)
      ctx.fillStyle = b.ground;
      ctx.beginPath();
      ctx.moveTo(px, World.GROUND_Y - camera.y);
      for (let x = rx0; x <= rx1; x += 40) {
        const bump = Math.sin(x * 0.01) * 10 + Math.sin(x * 0.004) * 18;
        ctx.lineTo(x - camera.x, World.GROUND_Y + bump - camera.y);
      }
      ctx.lineTo(px + pw, H + 200 - camera.y);
      ctx.lineTo(px, H + 200 - camera.y);
      ctx.closePath();
      ctx.fill();

      // highlight strip near top
      ctx.fillStyle = b.groundHi;
      ctx.fillRect(px, World.GROUND_Y - camera.y, pw, 6);
    }
  }

  function drawDecor() {
    for (const d of world.decor) {
      if (d.x < camera.x - 120 || d.x > camera.x + W + 120) continue;
      const px = d.x - camera.x;
      const py = d.y - camera.y;
      const sway = Math.sin(d.seed + stateTime * 1.2) * 2;
      const k = d.kind;

      if (k === 'tree' || k === 'dead') {
        ctx.fillStyle = k === 'dead' ? '#5a3c2a' : '#4a3320';
        ctx.fillRect(px - 5, py - d.h * 0.55, 10, d.h * 0.55 + 20);
        if (k === 'tree') {
          const h = d.h;
          ctx.fillStyle = '#1f5c2e';
          for (let i = 0; i < 3; i++) {
            const cx = px + sway * (i + 1) * 0.3;
            const cy = py - h * (0.5 + i * 0.18);
            const rr = d.w * (0.5 + i * 0.16);
            ctx.beginPath();
            ctx.arc(cx, cy, rr, 0, Math.PI * 2);
            ctx.fill();
          }
        } else {
          ctx.strokeStyle = '#5a3c2a';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(px, py - d.h * 0.4);
          ctx.lineTo(px + d.w * 0.5, py - d.h * 0.7);
          ctx.moveTo(px, py - d.h * 0.3);
          ctx.lineTo(px - d.w * 0.5, py - d.h * 0.55);
          ctx.stroke();
        }
      } else if (k === 'cactus') {
        ctx.fillStyle = '#2e7d32';
        const th = d.h * 0.75;
        ctx.fillRect(px - 8, py - th, 16, th + 14);
        ctx.fillRect(px - 20, py - th * 0.75, 9, th * 0.5);
        ctx.fillRect(px + 12, py - th * 0.6, 9, th * 0.4);
      } else if (k === 'pine') {
        ctx.fillStyle = '#3d2b1f';
        ctx.fillRect(px - 4, py - d.h * 0.5, 8, d.h * 0.5 + 12);
        ctx.fillStyle = '#1d4d2a';
        for (let i = 0; i < 3; i++) {
          const tw = d.w * (0.9 - i * 0.22);
          const ty = py - d.h * (0.3 + i * 0.22);
          ctx.beginPath();
          ctx.moveTo(px, ty - d.h * 0.28);
          ctx.lineTo(px - tw / 2, ty);
          ctx.lineTo(px + tw / 2, ty);
          ctx.closePath();
          ctx.fill();
        }
      } else if (k === 'rock') {
        ctx.fillStyle = '#1b2b3a';
        ctx.beginPath();
        ctx.arc(px + sway, py - 10, d.w * 0.5, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
      } else if (k === 'pillar') {
        ctx.fillStyle = '#4a1f38';
        ctx.fillRect(px - 10, py - d.h, 20, d.h + 16);
        ctx.fillStyle = '#6b2a50';
        ctx.beginPath();
        ctx.ellipse(px, py - d.h, 16, 6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawWorld(t) {
    drawGround();
    drawDecor();
  }

  /* ---------- Entity rendering ---------- */
  function drawFood(f) {
    const px = f.x - camera.x;
    const py = f.y - camera.y;
    const pulse = 1 + 0.12 * Math.sin(stateTime * 3 + f.pulse);
    const r = f.r * pulse;

    const grad = ctx.createRadialGradient(px, py, 0, px, py, r * 2.6);
    grad.addColorStop(0, f.glow + '55');
    grad.addColorStop(1, f.glow + '00');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px, py, r * 2.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = f.color;
    ctx.shadowColor = f.glow;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // small detail blob
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.arc(px - r * 0.3, py - r * 0.3, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawOrb(o, t) {
    const px = o.x - camera.x;
    const py = o.y - camera.y;
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
    const shouldBlink = isPlayer && player.invuln > 0 && Math.sin(stateTime * 22) > -0.2;
    if (shouldBlink) ctx.globalAlpha = 0.45;

    const px = c.x - camera.x;
    const py = c.y - camera.y;
    if (px < -80 || px > W + 80) { ctx.globalAlpha = 1; return; }

    const color = Stages.colorAt(c.stageIdx);
    const r = c.r;

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

    ctx.strokeStyle = Stages.colorAt(c.stageIdx, 0.5);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, r * 0.55, 0, Math.PI * 2);
    ctx.stroke();

    // Eyes
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

    ctx.globalAlpha = 1;

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
    const py = p.y - camera.y;
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
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
      ctx.arc(p.x - camera.x, p.y - camera.y, p.r, 0, Math.PI * 2);
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
      ctx.fillText(t.text, t.x - camera.x, t.y - camera.y);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  function render(t) {
    ctx.clearRect(0, 0, W, H);
    drawBackground(t);
    drawWorld(t);

    for (const o of orbs) if (!o.taken) drawOrb(o, t);
    for (const f of foods) if (!f.taken) drawFood(f);

    for (const r of rivals) if (r.alive) drawCreature(r, t, false);
    for (const p of projectiles) drawProjectile(p);
    drawCreature(player, t, true);
    drawParticles(particles);
    drawTexts();
  }

  /* ---------- Game logic ---------- */
  function spawnEvoNotice() {
    hud.evoNoticeIcon.textContent = Stages.stageAt(player.stageIdx).icon;
    hud.evoNoticeName.textContent = Stages.stageAt(player.stageIdx).name;
    const el = hud.evoNotice;
    el.classList.add('hidden');
    void el.offsetWidth;
    el.classList.remove('hidden');
    clearTimeout(spawnEvoNotice._to);
    spawnEvoNotice._to = setTimeout(() => el.classList.add('hidden'), 2400);
  }

  function addKillFeed(msg) {
    const el = document.createElement('div');
    el.className = 'kill-msg';
    el.textContent = msg;
    hud.killFeed.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  function gainRivalXp(r, amount) {
    r.xp += amount;
    const cap = Math.min(player.stageIdx + 5, Stages.stageCount() - 1);
    let grew = false;
    while (r.stageIdx < cap) {
      const need = Stages.stageAt(r.stageIdx).xp;
      if (r.xp < need) break;
      r.xp -= need;
      Entities.applyStage(r, r.stageIdx + 1);
      grew = true;
    }
    if (grew) {
      r.flash = 1;
      texts.push(Entities.makeFloatingText(r.x, r.y, r.name + '!', Stages.colorAt(r.stageIdx), true));
    }
  }

  // killer: 'player' object or a rival object
  function killRival(r, killer) {
    r.alive = false;
    const col = Stages.colorAt(r.stageIdx);
    particles.push(...Entities.makeParticles(r.x, r.y, col, 24));

    if (killer === player) {
      player.kills++;
      const gain = 8 + r.stageIdx * 4;
      const evolved = Player.gainEvo(player, gain);
      AudioSys.sfx.kill();
      texts.push(Entities.makeFloatingText(r.x, r.y, '+' + gain + ' XP', '#7bff5c', true));
      addKillFeed('You devoured ' + r.icon + ' ' + r.name);
      if (evolved) spawnEvoNotice();
      if (Math.random() < 0.45) {
        orbs.push({ x: r.x, y: r.y, r: 9, pulse: 0, taken: false, xp: 3 });
      }
    } else if (killer) {
      const gain = 8 + r.stageIdx * 4;
      gainRivalXp(killer, gain);
      texts.push(Entities.makeFloatingText(r.x, r.y, r.icon + ' eaten', '#ffd27a', false));
      addKillFeed(killer.icon + ' ' + killer.name + ' devoured ' + r.icon + ' ' + r.name);
    }
  }

  function playerDeath(killerName) {
    if (!player.alive) return;
    shake = 1;
    AudioSys.sfx.gameover();
    particles.push(...Entities.makeParticles(player.x, player.y, '#ff5c5c', 26));
    texts.push(Entities.makeFloatingText(player.x, player.y, 'YOU WERE DEVOURED', '#ff5c5c', true));
    addKillFeed('You were devoured by ' + killerName + ' — respawned with half XP');
    Player.respawn(player, world);
    camera.x = Math.max(0, player.x - W / 2);
    texts.push(Entities.makeFloatingText(player.x, player.y, 'half XP kept', '#ffd700', true));
    updateHUD();
  }

  function handleCollisions() {
    // -- Player eats food --
    const eatDst = player.r + 6;
    for (const f of foods) {
      if (f.taken) continue;
      if (Math.hypot(player.x - f.x, player.y - f.y) < eatDst + f.r) {
        f.taken = true;
        AudioSys.sfx.eat();
        const evolved = Player.gainEvo(player, f.xp);
        texts.push(Entities.makeFloatingText(f.x, f.y, '+' + f.xp + ' XP', f.glow));
        particles.push(...Entities.makeParticles(f.x, f.y, f.glow, 8));
        if (evolved) spawnEvoNotice();
      }
    }

    // -- Player eats orbs --
    for (const o of orbs) {
      if (o.taken) continue;
      if (Math.hypot(player.x - o.x, player.y - o.y) < eatDst + o.r) {
        o.taken = true;
        AudioSys.sfx.eat();
        const evolved = Player.gainEvo(player, o.xp);
        particles.push(...Entities.makeParticles(o.x, o.y, '#00d5ff', 10));
        if (evolved) spawnEvoNotice();
      }
    }

    // -- Rivals eat food --
    for (const r of rivals) {
      if (!r.alive || r.stageIdx >= Stages.stageCount() - 1) continue;
      for (const f of foods) {
        if (f.taken) continue;
        if (Math.hypot(r.x - f.x, r.y - f.y) < r.r + 4 + f.r) {
          f.taken = true;
          gainRivalXp(r, f.xp);
        }
      }
    }

    // -- Projectiles --
    for (const p of projectiles) {
      if (!p.alive) continue;
      if (p.fromPlayer) {
        for (const r of rivals) {
          if (!r.alive) continue;
          if (Math.hypot(p.x - r.x, p.y - r.y) < r.r + 5) {
            p.alive = false;
            r.hp -= p.dmg;
            r.flash = 0.1;
            AudioSys.sfx.hit();
            particles.push(...Entities.makeParticles(p.x, p.y, r.hp > 0 ? '#ff8888' : '#ffffff', 8));
            if (r.hp <= 0) killRival(r, player);
            break;
          }
        }
      } else {
        const shooter = p.srcRival;
        // rival fire can hurt the player
        if (Math.hypot(p.x - player.x, p.y - player.y) < player.r + 5) {
          p.alive = false;
          const died = Player.takeDamage(player, p.dmg, world);
          hud.vignette.classList.add('damaged');
          setTimeout(() => hud.vignette.classList.remove('damaged'), 160);
          particles.push(...Entities.makeParticles(p.x, p.y, '#ff5c5c', 10));
          texts.push(Entities.makeFloatingText(p.x, p.y, '-' + p.dmg, '#ff5c5c'));
          if (died && shooter) playerDeath(shooter.name);
          else if (died) playerDeath('a bitter rival');
          continue;
        }
        // and prey rivals of the shooter
        if (shooter && shooter.alive) {
          for (const r of rivals) {
            if (!r.alive || r === shooter) continue;
            if (r.stageIdx > shooter.stageIdx) continue; // only prey (lower/equal chain)
            if (Math.hypot(p.x - r.x, p.y - r.y) < r.r + 5) {
              p.alive = false;
              r.hp -= p.dmg;
              r.flash = 0.1;
              particles.push(...Entities.makeParticles(p.x, p.y, '#ff8888', 6));
              if (r.hp <= 0) killRival(r, shooter);
              break;
            }
          }
        }
      }
    }

    // -- Contact eating (player ↔ rivals) --
    for (const r of rivals) {
      if (!r.alive) continue;
      const d = Math.hypot(player.x - r.x, player.y - r.y);
      if (d < player.r + r.r) {
        if (Stages.canEat(player.stageIdx, r.stageIdx)) {
          killRival(r, player);
        } else if (Stages.canEat(r.stageIdx, player.stageIdx)) {
          playerDeath(r.name);
          break;
        }
      }
    }

    // -- Rivals eat each other (higher rank eats lower) --
    for (let i = 0; i < rivals.length; i++) {
      const a = rivals[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < rivals.length; j++) {
        const b = rivals[j];
        if (!b.alive) continue;
        if (Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r) {
          if (a.stageIdx > b.stageIdx) killRival(b, a);
          else if (b.stageIdx > a.stageIdx) killRival(a, b);
        }
      }
    }
  }

  function respawnRivals() {
    while (rivals.filter(r => r.alive).length < MAX_RIVALS) {
      rivals.push(Entities.makeRival(world, pickRivalStage()));
    }
  }

  function update(dt, t) {
    if (gameState !== 'playing') return;
    stateTime += dt;

    Player.update(player, dt, Input, world);

    if (Input.wasClicked() || Input.wasPressed('Space')) {
      const proj = Player.tryShoot(player, Input, world);
      if (proj) projectiles.push(proj);
    }

    const ctxAI = { player, rivals, foods };
    for (const r of rivals) {
      if (!r.alive) continue;
      const target = Entities.updateRival(r, dt, world, ctxAI);
      if (target) {
        const ang = Math.atan2(target.y - r.y, target.x - r.x);
        projectiles.push(Entities.makeProjectile(r.x, r.y - 10, ang, r.dmg, 320, false, Stages.colorAt(r.stageIdx), r));
      }
    }

    World.respawnOrb(orbs, MAX_ORBS);
    World.respawnFood(foods, MAX_FOOD);

    handleCollisions();

    rivals = rivals.filter(r => r.alive);
    respawnRivals();

    projectiles = projectiles.filter(p => p.alive && Entities.updateProj(p, dt, world));
    particles = particles.filter(p => Entities.updateParticle(p, dt));
    texts = texts.filter(t => Entities.updateText(t, dt));

    // Camera
    const targetX = player.x - W / 2;
    const targetY = Math.max(-180, Math.min(0, player.y - H / 2.4));
    camera.x += (targetX - camera.x) * Math.min(1, dt * 6);
    camera.y += (targetY - camera.y) * Math.min(1, dt * 6);
    camera.x = Math.max(0, Math.min(world.WORLD_WIDTH - W, camera.x));

    if (shake > 0) {
      shake = Math.max(0, shake - dt);
      camera.x += (Math.random() - 0.5) * shake * 14;
      camera.y += (Math.random() - 0.5) * shake * 14;
    }

    updateHUD();
  }

  function updateHUD() {
    const p = player;
    const hpPct = Math.max(0, p.hp / p.maxHp) * 100;
    hud.healthFill.style.width = hpPct + '%';
    hud.healthLabel.textContent = Math.ceil(p.hp) + ' / ' + p.maxHp;

    const cur = Stages.stageAt(p.stageIdx);
    const atMax = p.stageIdx >= Stages.stageCount() - 1;
    const evoPct = atMax ? 100 : Math.min(100, (p.evo / cur.xp) * 100);
    hud.evoFill.style.width = evoPct + '%';
    hud.evoLabel.textContent = atMax ? 'GOD MODE' : 'EVO ' + Math.floor(p.evo) + ' / ' + cur.xp;

    hud.stageName.textContent = cur.name;
    hud.stageIcon.textContent = cur.icon;
    hud.score.textContent = p.score;
    hud.kills.textContent = p.kills;
    hud.stages.textContent = p.stageIdx + 1;
    hud.xp.textContent = p.xp;

    if (atMax) hud.stageName.style.color = '#ffd700';
    else hud.stageName.style.color = '#d8c9ff';
  }

  /* ---------- Loop ---------- */
  let lastT = 0;
  function loop(t) {
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
    lastT = t;

    update(dt, t / 1000);
    render(t / 1000);

    Input.endFrame();

    if (Math.random() < 0.008) AudioSys.sfx.ambientWind();

    requestAnimationFrame(loop);
  }

  /* ---------- Events ---------- */
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && gameState === 'playing') {
      gameState = 'menu';
      menu.classList.remove('hidden');
    }
    if (e.code === 'KeyM') {
      AudioSys.setMuted(!AudioSys.muted);
    }
  });

  startBtn.addEventListener('click', startGame);

  window.addEventListener('resize', resize);

  /* ---------- Boot ---------- */
  Input.init();
  resize();
  requestAnimationFrame(loop);

  // Test-only diagnostics (enabled with ?test=1)
  if (location.search.indexOf('test=1') !== -1) {
    window.__game = {
      get player() { return player; },
      get state() { return gameState; },
      get world() { return world; },
      get rivalsCount() { return rivals.length; },
      get rivals() { return rivals; },
      get foodsCount() { return foods.filter(f => !f.taken).length; }
    };
  }
})();