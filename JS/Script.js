// === Canvas setup
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// === Wereld setup
const WORLD_WIDTH = 4000;
const WORLD_HEIGHT = 6000;

let currentZoom = 1;
let streakOffset = 0;
let playerTrail = []; // Voor motion blur trail effect

let isGameRunning = false;
let isPaused = false;

let player = {
  x: WORLD_WIDTH / 2,
  y: 300,
  size: 25,
  speed: 3,
  score: 0,
  coins: 0,
  health: 3,
  angle: 0,
  skills: {
    speedBoost: false,
    invisible: false,
    shield: false
  },
  cooldowns: {
    speedBoost: 0,
    invisible: 0,
    shield: 0
  }
};

let keys = {};
let enemies = [], walls = [];

// === CAMERA VIEW LOGIC ===
let camX, camY, camWidth, camHeight;

function isVisible(x, y, size = 0) {
  return (
    x + size > camX &&
    x - size < camX + camWidth &&
    y + size > camY &&
    y - size < camY + camHeight
  );
}

let ambientLights = [];
for (let i = 0; i < 80; i++) {
  ambientLights.push({
    x: Math.random() * WORLD_WIDTH,
    y: Math.random() * WORLD_HEIGHT,
    baseRadius: Math.random() * 3 + 2,
    pulseOffset: Math.random() * 1000,
    opacity: Math.random() * 0.3 + 0.2,
    speed: Math.random() * 0.5 + 0.2
  });
}

let fogParticles = [];
for (let i = 0; i < 100; i++) {
  fogParticles.push({
    x: Math.random() * WORLD_WIDTH,
    y: Math.random() * WORLD_HEIGHT,
    radius: 100 + Math.random() * 200,
    opacity: 0.02 + Math.random() * 0.02
  });
}

const skillLabels = {
  speedBoost: "Snelheid",
  invisible: "Onzichtbaar",
  shield: "Schild"
};
const skillHotkeys = {
  speedBoost: "V",
  invisible: "B",
  shield: "F"
};

// === Input
document.addEventListener("keydown", e => {
  keys[e.key] = true;
  if (e.key === 'v') activateSkill("speedBoost");
  if (e.key === 'b') activateSkill("invisible");
  if (e.key === 'f') activateSkill("shield");
  if (e.key === "Escape") {
    if (isGameRunning && !isPaused) pauseGame();
    else if (isPaused) resumeGame();
  }
});
document.addEventListener("keyup", e => keys[e.key] = false);

// === Game Start
function startGame() {
  const menu = document.getElementById("menu");
  if (menu) menu.style.display = "none";

  isGameRunning = true;
  generateWalls();
  generateBorders();
  for (let i = 0; i < 30; i++) spawnEnemy();

  // Zorg dat speler niet in een muur zit
  while (walls.some(w => rectCircleColliding(player, w))) {
    player.x = Math.random() * (WORLD_WIDTH - 100) + 50;
    player.y = Math.random() * (WORLD_HEIGHT - 100) + 50;
  }

  gameLoop();
}

function goToMainMenu() {
  window.location.href = "index.html";
}

function pauseGame() {
  isPaused = true;
  document.getElementById("pauseMenu").style.display = "flex";
}
function resumeGame() {
  isPaused = false;
  document.getElementById("pauseMenu").style.display = "none";
}
function goToMainMenu() {
  window.location.reload();
}

// === Skill logic
function activateSkill(skill) {
  const now = Date.now();
  if (player.cooldowns[skill] > now) return;

  player.cooldowns[skill] = now + 5000;
  player.skills[skill] = true;

  switch (skill) {
    case "speedBoost":
      player.speed *= 2;
      setTimeout(() => {
        player.speed /= 2;
        player.skills.speedBoost = false;
      }, 3000);
      break;
    case "invisible":
      setTimeout(() => player.skills.invisible = false, 3000);
      break;
    case "shield":
      setTimeout(() => player.skills.shield = false, 3000);
      break;
  }
}

function updateCooldownUI() {
  const now = Date.now();
  const updateBtn = (id, skill) => {
    const btn = document.getElementById(id);
    const remaining = player.cooldowns[skill] - now;
    if (remaining > 0) {
      btn.innerText = `${skillLabels[skill]} (${Math.ceil(remaining / 1000)}s)`;
      btn.disabled = true;
      btn.style.opacity = "0.5";
    } else {
      btn.innerText = `${skillLabels[skill]} (${skillHotkeys[skill]})`;
      btn.disabled = false;
      btn.style.opacity = "1";
    }
  };
  updateBtn("speedBtn", "speedBoost");
  updateBtn("invisBtn", "invisible");
  updateBtn("shieldBtn", "shield");
}

// === Wereld en vijanden
function generateWalls() {
  walls = [];
  for (let i = 0; i < 40; i++) {
    walls.push({
      x: Math.random() * (WORLD_WIDTH - 300),
      y: Math.random() * (WORLD_HEIGHT - 300),
      w: 150 + Math.random() * 150,
      h: 150 + Math.random() * 150,
      color: "#2e2e2e"
    });
  }
}

function generateBorders() {
  walls.push({ x: 0, y: 0, w: WORLD_WIDTH, h: 100 }); // Top
  walls.push({ x: 0, y: WORLD_HEIGHT - 100, w: WORLD_WIDTH, h: 100 }); // Bottom
  walls.push({ x: 0, y: 0, w: 100, h: WORLD_HEIGHT }); // Left
  walls.push({ x: WORLD_WIDTH - 100, y: 0, w: 100, h: WORLD_HEIGHT }); // Right
}

function spawnEnemy() {
  let tries = 0;
  while (tries < 50) {
    const x = Math.random() * WORLD_WIDTH;
    const y = Math.random() * WORLD_HEIGHT;
    const dist = Math.hypot(x - player.x, y - player.y);
    if (dist < 400) { tries++; continue; }

    const tempEnemy = { x, y, size: 30 };
    const collides = walls.some(w => rectCircleColliding(tempEnemy, w));
    if (collides) { tries++; continue; }

    let size = 15;
    let color = "lime";
    let type = "fish";

    if (y > 4000) { size = 50; color = "crimson"; type = "shark"; }
    else if (y > 2500) { size = 30; color = "purple"; }
    else { size = 15 + Math.random() * 10; }

    enemies.push({ x, y, size, color, type, speed: 1 + Math.random(), angle: Math.random() * Math.PI * 2 });
    break;
  }
}

function rectCircleColliding(circ, rect) {
  const distX = Math.abs(circ.x - rect.x - rect.w / 2);
  const distY = Math.abs(circ.y - rect.y - rect.h / 2);
  if (distX > (rect.w / 2 + circ.size)) return false;
  if (distY > (rect.h / 2 + circ.size)) return false;
  if (distX <= (rect.w / 2)) return true;
  if (distY <= (rect.h / 2)) return true;
  const dx = distX - rect.w / 2;
  const dy = distY - rect.h / 2;
  return dx * dx + dy * dy <= (circ.size * circ.size);
}

// === Game logic
function update() {
  if (!isGameRunning || isPaused) return;

  // === Richting vector berekenen
  let dx = 0;
  let dy = 0;
  if (keys["ArrowLeft"]) dx -= 1;
  if (keys["ArrowRight"]) dx += 1;
  if (keys["ArrowUp"]) dy -= 1;
  if (keys["ArrowDown"]) dy += 1;

  // === Normaliseren zodat diagonaal niet sneller is
  const length = Math.hypot(dx, dy);
  if (length > 0) {
    dx /= length;
    dy /= length;
  }

  // === Nieuwe positie berekenen
  const newX = player.x + dx * player.speed;
  const newY = player.y + dy * player.speed;

  // === Collision check voor X en Y apart
  let testX = { ...player, x: newX };
  let testY = { ...player, y: newY };

  let collidedX = walls.some(w => rectCircleColliding(testX, w));
  let collidedY = walls.some(w => rectCircleColliding(testY, w));

  const oldX = player.x;
  const oldY = player.y;

  if (!collidedX) player.x = newX;
  if (!collidedY) player.y = newY;

  // === Clamp binnen wereld
  player.x = Math.max(player.size, Math.min(WORLD_WIDTH - player.size, player.x));
  player.y = Math.max(player.size, Math.min(WORLD_HEIGHT - player.size, player.y));

  // === Richting bijwerken alleen als speler beweegt
  const dxMoved = player.x - oldX;
  const dyMoved = player.y - oldY;
  if (dxMoved !== 0 || dyMoved !== 0) {
    player.angle = Math.atan2(dyMoved, dxMoved);
  }

  // === Vijand updates
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    const dist = Math.hypot(player.x - e.x, player.y - e.y);
    const dirX = (player.x - e.x) / dist;
    const dirY = (player.y - e.y) / dist;
    const oldX = e.x, oldY = e.y;

    if (!player.skills.invisible && dist < 400) {
      if (e.type === "fish") {
        e.x -= dirX * e.speed;
        e.y -= dirY * e.speed;
      } else {
        e.x += dirX * e.speed;
        e.y += dirY * e.speed;
      }
    } else {
      e.x += Math.cos(e.angle) * e.speed * 0.5;
      e.y += Math.sin(e.angle) * e.speed * 0.5;
    }

    for (let wall of walls) {
      if (rectCircleColliding(e, wall)) {
        e.x = oldX;
        e.y = oldY;
        e.angle += Math.PI;
      }
    }

    // === Botsing speler vs vijand
    if (dist < player.size + e.size) {
      if (player.size >= e.size) {
        player.score++;
        player.coins += 5;
        player.size += 1.5;
        enemies.splice(i, 1);
        spawnEnemy();
      } else if (e.type === "shark" && !player.skills.shield) {
        player.health--;
        enemies.splice(i, 1);
        spawnEnemy();
        if (player.health <= 0) {
          alert("Game Over! Score: " + player.score);
          window.location.reload();
        }
      }
    }
  }

  // === Motion blur trail
  const visibleLeft = player.x > (player.x - canvas.width / 2) - 300;
  const visibleRight = player.x < (player.x + canvas.width / 2) + 300;
  const visibleTop = player.y > (player.y - canvas.height / 2) - 300;
  const visibleBottom = player.y < (player.y + canvas.height / 2) + 300;

  if (player.skills.speedBoost && visibleLeft && visibleRight && visibleTop && visibleBottom) {
    playerTrail.unshift({
      x: player.x,
      y: player.y,
      size: player.size,
      angle: player.angle,
      time: Date.now()
    });
    if (playerTrail.length > 10) playerTrail.pop();
  }
}

function drawWaterDistortion(camX, camY, zoom) {
  ctx.save();
  ctx.globalAlpha = 0.08;
  const waveSize = 20;
  const xOffset = Math.sin(Date.now() / 700) * waveSize;
  const yOffset = Math.cos(Date.now() / 900) * waveSize;
  ctx.translate(xOffset, yOffset);
  ctx.fillStyle = "#1a2e40";
  ctx.fillRect(camX, camY, canvas.width / zoom, canvas.height / zoom);
  ctx.restore();
}

function drawBackground(camX, camY, zoom) {
  ctx.clearRect(camX, camY, canvas.width / zoom, canvas.height / zoom);
  ctx.fillStyle = "#0b1e2c";
  ctx.fillRect(camX, camY, canvas.width / zoom, canvas.height / zoom);
}

function drawParallaxPlants(camX, camY, zoom) {
  const layers = 3;
  for (let i = 0; i < layers; i++) {
    const depth = 0.2 + i * 0.15;
    const density = 20;
    for (let j = 0; j < density; j++) {
      const x = (j * 500 + Math.sin(Date.now() / (1000 + i * 500) + j) * 100) % WORLD_WIDTH;
      const y = (j * 400 + Math.cos(Date.now() / (1200 + i * 400) + j) * 100) % WORLD_HEIGHT;
      const plantX = x - camX * depth;
      const plantY = y - camY * depth;
      ctx.beginPath();
      ctx.arc(plantX, plantY, 30 - i * 6, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(30, 80, 60, ${0.05 + i * 0.05})`;
      ctx.fill();
    }
  }
}

function drawAmbientLights() {
  for (let light of ambientLights) {
    light.y += light.speed;
    if (light.y > WORLD_HEIGHT) light.y = 0;

    const pulse = Math.sin((Date.now() + light.pulseOffset) / 1000) * 1.5;
    const radius = light.baseRadius + pulse;

    ctx.beginPath();
    ctx.arc(light.x, light.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(173,216,230,${light.opacity})`;
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#add8e6";
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}

function drawWalls() {
  for (let wall of walls) {
    ctx.fillStyle = wall.color;
    ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
  }
}

function drawEnemies() {
  for (let e of enemies) {
    ctx.shadowBlur = 15;
    ctx.shadowColor = e.color;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
    ctx.fillStyle = e.color;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

function drawPlayerTrail() {
  if (player.skills.speedBoost) {
    for (let i = 1; i < playerTrail.length; i++) {
      const ghost = playerTrail[i];
      const age = i / playerTrail.length;
      ctx.beginPath();
      ctx.arc(ghost.x, ghost.y, ghost.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,165,0,${0.08 * (1 - age)})`;
      ctx.fill();
    }
  }
}

function drawPlayer() {
  ctx.shadowBlur = 20;
  ctx.shadowColor = "orange";
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.size, 0, Math.PI * 2);
  if (player.skills.invisible) {
    const pulse = 0.2 + Math.sin(Date.now() / 200) * 0.1;
    ctx.fillStyle = `rgba(255,165,0,${pulse})`;
  } else {
    ctx.fillStyle = "orange";
  }
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawShield() {
  if (player.skills.shield) {
    const pulse = Math.sin(Date.now() / 200) * 5;
    const shieldRadius = player.size + 15 + pulse;
    ctx.beginPath();
    ctx.arc(player.x, player.y, shieldRadius, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(0,150,255,0.5)";
    ctx.lineWidth = 4;
    ctx.stroke();
  }
}

function drawDepthFog(camX, camY, zoom) {
  const darkness = Math.min(1, player.y / WORLD_HEIGHT);
  ctx.fillStyle = `rgba(0, 0, 0, ${darkness * 0.6})`;
  ctx.fillRect(camX, camY, canvas.width / zoom, canvas.height / zoom);
}

function drawSpotlight() {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const spotlight = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 300);
  spotlight.addColorStop(0, "rgba(255,255,200,0.3)");
  spotlight.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = spotlight;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

function drawBeamCone() {
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(player.angle);
  const coneGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 350);
  coneGradient.addColorStop(0, "rgba(255, 255, 180, 0.25)");
  coneGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = coneGradient;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(200, -100);
  ctx.lineTo(200, 100);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawSpeedOverlay() {
  if (player.skills.speedBoost) {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const streak = ctx.createRadialGradient(centerX, centerY, 100, centerX, centerY, 800);
    streak.addColorStop(0, "rgba(0,0,0,0)");
    streak.addColorStop(1, "rgba(0,0,0,0.2)");
    ctx.fillStyle = streak;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function drawVignette() {
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  ctx.save();
  const vignette = ctx.createRadialGradient(centerX, centerY, canvas.width / 3, centerX, centerY, canvas.width / 1.2);
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.7)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

function drawHUD() {
  document.getElementById("scoreText").innerText = player.score;
  document.getElementById("health").innerText = player.health;
  document.getElementById("coins").innerText = player.coins;
  updateCooldownUI();
}

function draw() {
  if (!isGameRunning || isPaused) return;

  // === Smooth zoom
  let targetZoom = player.skills.speedBoost ? 0.85 : 1;
  currentZoom += (targetZoom - currentZoom) * 0.08;
  const zoom = currentZoom;

  const camX = player.x - (canvas.width / 2) / zoom;
  const camY = player.y - (canvas.height / 2) / zoom;

  ctx.save();
  ctx.setTransform(zoom, 0, 0, zoom, -camX * zoom, -camY * zoom);

  drawWaterDistortion(camX, camY, zoom);
  drawBackground(camX, camY, zoom);
  drawParallaxPlants(camX, camY, zoom);
  drawAmbientLights();
  drawWalls();
  drawEnemies();
  drawPlayerTrail();
  drawPlayer();
  drawShield();
  drawDepthFog(camX, camY, zoom);

  ctx.restore(); // einde camera

  drawSpotlight();
  drawBeamCone();
  drawSpeedOverlay();
  drawVignette();
  drawHUD();
}

function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}
