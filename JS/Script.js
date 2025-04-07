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

const fishFrames = [];
const totalFrames = 30;
let loadedFrames = 0;
let structuredDecorations = [];

let camOffset = { x: 0, y: 0 };

const shieldIcon = new Image();
shieldIcon.src = "../Assets/images/Shield.png";

let seaweedImagesLoaded = 0;

const seaweedImage1 = new Image();
seaweedImage1.src = "../Assets/Images/Sea_Weed1.png";
seaweedImage1.onload = checkSeaweedImagesLoaded;

const seaweedImage2 = new Image();
seaweedImage2.src = "../Assets/Images/Sea_Weed2.png";
seaweedImage2.onload = checkSeaweedImagesLoaded;

const seaweedImage3 = new Image();
seaweedImage3.src = "../Assets/Images/Sea_Weed3.png";
seaweedImage3.onload = checkSeaweedImagesLoaded;

function checkSeaweedImagesLoaded() {
  seaweedImagesLoaded++;
  if (seaweedImagesLoaded === 3 && loadedFrames === totalFrames) {
    startGame(); // start pas als planten én visjes geladen zijn
  }
}

for (let i = 100; i <= 129; i++) {
  const img = new Image();
  img.src = `../Assets/Images/Guppy_${i}.gif`;
  img.onload = () => {
    loadedFrames++;
    if (loadedFrames === totalFrames && seaweedImagesLoaded === 3) {
      startGame();    
    }
  };
  fishFrames.push(img);
}

let currentFrame = 0;
let frameDelay = 80; // Animatiesnelheid (ms per frame)
let lastFrameUpdate = Date.now();

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
  generateStructuredDecorations();
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

  // Bovenlaag zand
  walls.push({ x: 0, y: 0, w: WORLD_WIDTH, h: 200, color: "#E5C07B" });

  // --- Onderlaag (bodemstructuur)
  walls.push({ x: 0, y: WORLD_HEIGHT - 400, w: WORLD_WIDTH, h: 400, color: "#A67C52" });

  // ⛔ NIET meer: blokwalls links/rechts – we tekenen die straks visueel!
}

function generateBorders() {
  walls.push({ x: 0, y: 0, w: WORLD_WIDTH, h: 100 }); // Top
  walls.push({ x: 0, y: WORLD_HEIGHT - 100, w: WORLD_WIDTH, h: 100 }); // Bottom
  walls.push({ x: 0, y: 0, w: 100, h: WORLD_HEIGHT }); // Left
  walls.push({ x: WORLD_WIDTH - 100, y: 0, w: 100, h: WORLD_HEIGHT }); // Right
}

function generateStructuredDecorations() {
  structuredDecorations = [];

  const points = [
    // Throughout the whole map
    { x: 200, y: 300 }, { x: 300, y: 700 }, { x: 180, y: 1300 }, { x: 250, y: 1800 },
    { x: 300, y: 2300 }, { x: 250, y: 2800 }, { x: 300, y: 3300 },
    { x: 3800, y: 400 }, { x: 3700, y: 900 }, { x: 3850, y: 1600 },
    { x: 3700, y: 2400 }, { x: 3800, y: 3000 }, { x: 3750, y: 3700 }, { x: 3900, y: 4500 },
    { x: 1250, y: 1100 }, { x: 2050, y: 2000 }, { x: 1650, y: 3100 },
    { x: 2250, y: 3900 }, { x: 1450, y: 4800 }
  ];

  const imgs = [seaweedImage1, seaweedImage2, seaweedImage3];

  for (let i = 0; i < points.length; i++) {
    structuredDecorations.push({
      x: points[i].x,
      y: points[i].y,
      img: imgs[i % imgs.length]
    });
  }
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

  // === Richting vector
  let dx = 0;
  let dy = 0;

  if (keys["ArrowLeft"]) dx -= 1;
  if (keys["ArrowRight"]) dx += 1;
  if (keys["ArrowUp"]) dy -= 1;
  if (keys["ArrowDown"]) dy += 1;

  const length = Math.hypot(dx, dy);
  if (length > 0) {
    dx /= length;
    dy /= length;
  }

  const newX = player.x + dx * player.speed;
  const newY = player.y + dy * player.speed;

  let testX = { ...player, x: newX };
  let testY = { ...player, y: newY };

  let collidedX = walls.some(w => rectCircleColliding(testX, w));
  let collidedY = walls.some(w => rectCircleColliding(testY, w));

  const oldX = player.x;
  const oldY = player.y;

  if (!collidedX) player.x = newX;
  if (!collidedY) player.y = newY;

  // Smooth camera offset
  const offsetStrength = 80;
  const lerpSpeed = 0.025;
  const targetOffset = { x: dx * offsetStrength, y: dy * offsetStrength };
  camOffset.x += (targetOffset.x - camOffset.x) * lerpSpeed;
  camOffset.y += (targetOffset.y - camOffset.y) * lerpSpeed;

  player.x = Math.max(player.size, Math.min(WORLD_WIDTH - player.size, player.x));
  player.y = Math.max(player.size, Math.min(WORLD_HEIGHT - player.size, player.y));

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

    if (!player.skills.invisible && dist < 500) {
      if (e.type === "fish") {
        // Vlucht weg als speler dichtbij is
        const fleeAngle = Math.atan2(e.y - player.y, e.x - player.x);
        let da = fleeAngle - e.angle;
        if (da > Math.PI) da -= 2 * Math.PI;
        if (da < -Math.PI) da += 2 * Math.PI;
        e.angle += da * 0.05;
    
        e.x += Math.cos(e.angle) * e.speed * 0.6;
        e.y += Math.sin(e.angle) * e.speed * 0.6;
    
      } else if (e.type === "shark") {
        if (player.size < e.size) {
          // Alleen aanvallen als speler kleiner is
          const chaseAngle = Math.atan2(player.y - e.y, player.x - e.x);
          let da = chaseAngle - e.angle;
          if (da > Math.PI) da -= 2 * Math.PI;
          if (da < -Math.PI) da += 2 * Math.PI;
          e.angle += da * 0.07;
    
          e.x += Math.cos(e.angle) * e.speed * 0.9;
          e.y += Math.sin(e.angle) * e.speed * 0.9;
        } else {
          // Speler is te groot → vluchten
          const fleeAngle = Math.atan2(e.y - player.y, e.x - player.x);
          let da = fleeAngle - e.angle;
          if (da > Math.PI) da -= 2 * Math.PI;
          if (da < -Math.PI) da += 2 * Math.PI;
          e.angle += da * 0.05;
    
          e.x += Math.cos(e.angle) * e.speed * 0.5;
          e.y += Math.sin(e.angle) * e.speed * 0.5;
        }
      }
    } else {
      // Idle gedrag met lichte bochtjes
      e.angle += Math.sin(Date.now() / 600 + i) * 0.01;
      e.x += Math.cos(e.angle) * e.speed * 0.4;
      e.y += Math.sin(e.angle) * e.speed * 0.4;
    }
    
    // === Slimme muur-bounce
    // === Detecteer muren rondom de vijand
let avoidanceAngle = 0;
let nearbyWall = false;

for (let wall of walls) {
  // Check of vijand dichtbij de muur is (binnen 50 pixels)
  const closestX = Math.max(wall.x, Math.min(e.x, wall.x + wall.w));
  const closestY = Math.max(wall.y, Math.min(e.y, wall.y + wall.h));
  const distToWall = Math.hypot(e.x - closestX, e.y - closestY);

  if (distToWall < e.size + 20) {
    nearbyWall = true;

    // Bereken afstotingsrichting vanaf muur
    const angleFromWall = Math.atan2(e.y - closestY, e.x - closestX);
    avoidanceAngle += angleFromWall;
  }
}

if (nearbyWall) {
  // Gemiddelde afstotingshoek gebruiken
  avoidanceAngle /= 1;

  // Mix met huidige richting → glijd weg
  let da = avoidanceAngle - e.angle;
  if (da > Math.PI) da -= 2 * Math.PI;
  if (da < -Math.PI) da += 2 * Math.PI;
  e.angle += da * 0.1; // zachte correctie
}
  }
  // === Motion trail
  if (player.skills.speedBoost) {
    playerTrail.unshift({
      x: player.x,
      y: player.y,
      angle: player.angle,
      frame: currentFrame,
      time: Date.now()
    });
    if (playerTrail.length > 12) playerTrail.pop();
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
  const density = 10;

  for (let i = 0; i < layers; i++) {
    const depth = 0.2 + i * 0.15;

    for (let j = 0; j < density; j++) {
      const seed = j + i * 100;

      const baseX = (seededRandom(seed * 999) * WORLD_WIDTH);
      const baseY = (seededRandom(seed * 123) * WORLD_HEIGHT);

      // Wiggle: zeewier wiebelt (lichte draaiing, niet positie)
      const sway = Math.sin(Date.now() / (1200 + i * 300) + seed) * 0.2;

      const wiggleX = Math.sin(Date.now() / (1000 + i * 500) + seed) * 10;
      const wiggleY = Math.cos(Date.now() / (1200 + i * 400) + seed) * 8;

      const x = baseX + wiggleX;
      const y = baseY + wiggleY;

      const plantX = x - camX * depth;
      const plantY = y - camY * depth;

      const imgIndex = Math.floor(seededRandom(seed) * 3);
      const plantImage = [seaweedImage1, seaweedImage2, seaweedImage3][imgIndex];

      const scale = 0.5 + i * 0.2;
      const size = 200 * scale;

      ctx.save();
      ctx.translate(plantX, plantY);
      ctx.rotate(sway); // zacht wiegen
      ctx.globalAlpha = 0.45 + i * 0.15;
      ctx.shadowColor = "rgba(0, 255, 100, 0.15)";
      ctx.shadowBlur = 10;
      ctx.drawImage(plantImage, -size / 2, -size / 2, size, size);
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }
}

function seededRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
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

function drawStructuredDecorations() {
  for (let d of structuredDecorations) {
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.globalAlpha = 0.7;
    ctx.drawImage(d.img, -30, -30, 80, 80);
    ctx.restore();
  }
}

function drawRockWalls() {
  ctx.save();
  ctx.fillStyle = "#3c3c3c"; // Donkergrijze rots

  // Linker grillige wand
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 1000);
  ctx.lineTo(100, 1300);
  ctx.lineTo(50, 1800);
  ctx.lineTo(150, 2200);
  ctx.lineTo(80, 2800);
  ctx.lineTo(180, 3400);
  ctx.lineTo(100, 4200);
  ctx.lineTo(200, 5000);
  ctx.lineTo(0, 6000);
  ctx.lineTo(0, 0);
  ctx.closePath();
  ctx.fill();

  // Rechter grillige wand
  ctx.beginPath();
  ctx.moveTo(WORLD_WIDTH, 0);
  ctx.lineTo(WORLD_WIDTH, 1000);
  ctx.lineTo(WORLD_WIDTH - 100, 1300);
  ctx.lineTo(WORLD_WIDTH - 50, 1800);
  ctx.lineTo(WORLD_WIDTH - 150, 2200);
  ctx.lineTo(WORLD_WIDTH - 80, 2800);
  ctx.lineTo(WORLD_WIDTH - 180, 3400);
  ctx.lineTo(WORLD_WIDTH - 100, 4200);
  ctx.lineTo(WORLD_WIDTH - 200, 5000);
  ctx.lineTo(WORLD_WIDTH, 6000);
  ctx.lineTo(WORLD_WIDTH, 0);
  ctx.closePath();
  ctx.fill();

  // Centrale kloof (smalle diepe inkeping)
  ctx.beginPath();
  ctx.moveTo(WORLD_WIDTH / 2 - 250, 1000);
  ctx.lineTo(WORLD_WIDTH / 2 - 100, 1500);
  ctx.lineTo(WORLD_WIDTH / 2 - 180, 2200);
  ctx.lineTo(WORLD_WIDTH / 2 - 120, 3000);
  ctx.lineTo(WORLD_WIDTH / 2 - 150, 4000);
  ctx.lineTo(WORLD_WIDTH / 2, 4600);
  ctx.lineTo(WORLD_WIDTH / 2 + 150, 4000);
  ctx.lineTo(WORLD_WIDTH / 2 + 120, 3000);
  ctx.lineTo(WORLD_WIDTH / 2 + 180, 2200);
  ctx.lineTo(WORLD_WIDTH / 2 + 100, 1500);
  ctx.lineTo(WORLD_WIDTH / 2 + 250, 1000);
  ctx.lineTo(WORLD_WIDTH / 2 + 250, 6000);
  ctx.lineTo(WORLD_WIDTH / 2 - 250, 6000);
  ctx.closePath();
  ctx.fill();

  // Zand bovenaan
  ctx.fillStyle = "#e5c07b";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 120);
  ctx.lineTo(WORLD_WIDTH / 2 - 400, 160);
  ctx.lineTo(WORLD_WIDTH / 2 + 400, 160);
  ctx.lineTo(WORLD_WIDTH, 120);
  ctx.lineTo(WORLD_WIDTH, 0);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
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
  if (!player.skills.speedBoost || playerTrail.length === 0) return;

  ctx.save();
  for (let i = playerTrail.length - 1; i >= 0; i--) {
    const ghost = playerTrail[i];
    const age = 1 - i / playerTrail.length;
    const frame = fishFrames[ghost.frame];
    if (!frame.complete) continue;

    ctx.save();
    ctx.translate(ghost.x, ghost.y);
    let flip = (Math.cos(ghost.angle) < 0) ? -1 : 1;
    ctx.scale(flip, 1);
    ctx.globalAlpha = 0.05 * age;

    const scale = 3.5;
    ctx.drawImage(
      frame,
      -player.size * scale,
      -player.size * scale,
      player.size * 2 * scale,
      player.size * 2 * scale
    );

    // Bubbels
    ctx.beginPath();
    ctx.arc(0, 0, 3 + Math.random() * 3, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    ctx.fill();

    ctx.restore();
  }
  ctx.restore();
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);

  let flip = (Math.cos(player.angle) < 0) ? -1 : 1;
  ctx.scale(flip, 1);

  const imageScaleFactor = 3.5;

  // === Transparantie als onzichtbaar actief is
  if (player.skills.invisible) {
    const shimmer = 0.3 + Math.sin(Date.now() / 150) * 0.2; // beetje shimmer effect
    ctx.globalAlpha = shimmer;
  }

  ctx.drawImage(
    fishFrames[currentFrame],
    -player.size * imageScaleFactor,
    -player.size * imageScaleFactor,
    player.size * 2 * imageScaleFactor,
    player.size * 2 * imageScaleFactor
  );

  ctx.restore();

  // Frames updaten
  const now = Date.now();
  if (now - lastFrameUpdate > frameDelay) {
    currentFrame = (currentFrame + 1) % totalFrames;
    lastFrameUpdate = now;
  }
}

function drawShield() {
  if (!player.skills.shield) return;

  const time = Date.now();

  ctx.save();
  ctx.translate(player.x, player.y);

  // === Glowing, draaiende cirkels achter vis
  for (let i = 0; i < 3; i++) {
    const pulse = Math.sin((time + i * 300) / 300) * 4;
    const radius = player.size * (1.8 + i * 0.2) + pulse;
    const rotation = ((time / 1000) * (0.2 + i * 0.1)) % (2 * Math.PI);

    ctx.save();
    ctx.rotate(rotation);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(0, 180, 255, ${0.15 + i * 0.1})`;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 25;
    ctx.shadowColor = "rgba(0, 200, 255, 0.4)";
    ctx.stroke();
    ctx.restore();
  }

  // === Icoontje in het midden van speler
  if (shieldIcon.complete && shieldIcon.naturalWidth !== 0) {
    const iconSize = player.size * 1.2;
    ctx.globalAlpha = 0.95;
    ctx.shadowBlur = 10;
    ctx.shadowColor = "rgba(0, 200, 255, 0.5)";
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      shieldIcon,
      -iconSize / 2,
      -iconSize / 2,
      iconSize,
      iconSize
    );
  }

  ctx.restore();
}

function drawDepthFog(camX, camY, zoom) {
  const darkness = Math.min(1, player.y / WORLD_HEIGHT);
  ctx.fillStyle = `rgba(0, 0, 0, ${darkness * 0.6})`;
  ctx.fillRect(camX, camY, canvas.width / zoom, canvas.height / zoom);
}

function drawSpotlight() {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  // Gewoon in het midden van de hitbox — géén angle of offset
  const x = player.x;
  const y = player.y;

  const spotlight = ctx.createRadialGradient(
    x, y, 0,
    x, y, 250
  );
  spotlight.addColorStop(0, "rgba(255,255,200,0.25)");
  spotlight.addColorStop(1, "rgba(0,0,0,0)");

  ctx.fillStyle = spotlight;
  ctx.fillRect(x - 250, y - 250, 500, 500);

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

  const camX = player.x + camOffset.x - (canvas.width / 2) / zoom;
  const camY = player.y + camOffset.y - (canvas.height / 2) / zoom;
  
  ctx.save();
  ctx.setTransform(zoom, 0, 0, zoom, -camX * zoom, -camY * zoom);

  drawWaterDistortion(camX, camY, zoom);
  drawBackground(camX, camY, zoom);
  drawParallaxPlants(camX, camY, zoom);
  drawAmbientLights();
  drawWalls();
  drawRockWalls(); // ← tekent de uitstekende randen
  drawStructuredDecorations();
  drawEnemies();
  drawPlayerTrail();
  drawPlayer();
  drawShield();
  drawSpotlight();
  drawDepthFog(camX, camY, zoom);

  ctx.restore(); // einde camera

  drawSpeedOverlay();
  drawVignette();
  drawHUD();
}

function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}
