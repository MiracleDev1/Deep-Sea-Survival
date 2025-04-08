// === Canvas setup
const canvas = document.getElementById("gameCanvas"); // Haalt het canvas-element uit de HTML
const ctx = canvas.getContext("2d"); // Haalt de 2D context op om op te tekenen
canvas.width = window.innerWidth; // Maakt canvas net zo breed als het scherm
canvas.height = window.innerHeight; // Maakt canvas net zo hoog als het scherm

// === Wereld setup
const WORLD_WIDTH = 4000; // Totale breedte van de spelwereld (buiten canvas)
const WORLD_HEIGHT = 6000; // Totale hoogte van de spelwereld

let currentZoom = 1; // Huidig zoomniveau (camera)
let streakOffset = 0; // Offset voor motion blur of andere visuele effecten
let playerTrail = []; // Houdt posities bij voor trail-effect achter speler

let isGameRunning = false; // Spel loopt of niet
let isPaused = false; // Pauzestand van het spel

const fishFrames = []; // Hierin worden alle animatieframes van de vis geladen
const totalFrames = 30; // Aantal frames dat moet worden geladen
let loadedFrames = 0; // Hoeveel frames zijn daadwerkelijk geladen?
let structuredDecorations = []; // Hierin worden decoratieve objecten (zoals planten) opgeslagen
let particles = [];
let stunnedUntil = 0;

let camOffset = { x: 0, y: 0 }; // Verschuiving van camera ten opzichte van speler

let damageEffect = {
  active: false,
  time: 0,
  duration: 400, // in ms
  intensity: 15
};

let cameraShake = {
  x: 0,
  y: 0
};

const shieldIcon = new Image(); // Nieuw image-object voor het schild
shieldIcon.src = "../Assets/images/Shield.png"; // Laadt de afbeelding van het schild

let seaweedImagesLoaded = 0; // Houdt bij hoeveel zeegras-afbeeldingen geladen zijn

// Maak een Image object voor het eerste zeewierafbeelding
const seaweedImage1 = new Image();
seaweedImage1.src = "../Assets/Images/Sea_Weed1.png"; // Pad naar de afbeelding
seaweedImage1.onload = checkSeaweedImagesLoaded; // Wanneer de afbeelding is geladen, roep de functie checkSeaweedImagesLoaded aan

// Maak een Image object voor het tweede zeewierafbeelding
const seaweedImage2 = new Image();
seaweedImage2.src = "../Assets/Images/Sea_Weed2.png"; // Pad naar de afbeelding
seaweedImage2.onload = checkSeaweedImagesLoaded; // Wanneer de afbeelding is geladen, roep de functie checkSeaweedImagesLoaded aan

// Maak een Image object voor het derde zeewierafbeelding
const seaweedImage3 = new Image();
seaweedImage3.src = "../Assets/Images/Sea_Weed3.png"; // Pad naar de afbeelding
seaweedImage3.onload = checkSeaweedImagesLoaded; // Wanneer de afbeelding is geladen, roep de functie checkSeaweedImagesLoaded aan

const rockTexture = new Image();
rockTexture.src = '../Assets/Images/rock_texture.png'; // zorg dat deze in dezelfde map zit

let rockPattern = null;
rockTexture.onload = () => {
  const patternCanvas = document.createElement('canvas');
  patternCanvas.width = rockTexture.width;
  patternCanvas.height = rockTexture.height;
  const patternCtx = patternCanvas.getContext('2d');
  patternCtx.drawImage(rockTexture, 0, 0);
  rockPattern = ctx.createPattern(patternCanvas, 'repeat');
};

function spawnParticle(type, x, y, options = {}) {
  const base = {
    x,
    y,
    vx: (Math.random() - 0.5) * 2,
    vy: (Math.random() - 0.5) * 2,
    size: 20,
    life: 60,
    maxLife: 60,
    rotation: Math.random() * Math.PI * 2,
    type,
    ...options
  };
  particles.push(base);
}

// Functie om te controleren of alle zeewierafbeeldingen zijn geladen
function checkSeaweedImagesLoaded() {
  seaweedImagesLoaded++; // Verhoog de teller voor de geladen zeewierafbeeldingen
  if (seaweedImagesLoaded === 3 && loadedFrames === totalFrames) { // Als zowel alle zeewier als visafbeeldingen geladen zijn
    startGame(); // Start het spel wanneer alles klaar is
  }
}

// Laad de guppy (vis) afbeeldingen, van frame 100 tot 129
for (let i = 100; i <= 129; i++) {
  const img = new Image(); // Maak een nieuw Image object voor elke frame
  img.src = `../Assets/Images/Guppy_${i}.gif`; // Pad naar het specifieke guppy afbeelding bestand
  img.onload = () => {
    loadedFrames++; // Verhoog de teller wanneer de afbeelding is geladen
    // Controleer of alle frames en zeewierafbeeldingen geladen zijn om het spel te starten
    if (loadedFrames === totalFrames && seaweedImagesLoaded === 3) {
      startGame(); // Start het spel wanneer alles geladen is
    }
  };
  fishFrames.push(img); // Voeg de afbeelding toe aan de fishFrames array om de visframes op te slaan
}

// Animatie-gerelateerde variabelen
let currentFrame = 0; // Houd het huidige frame bij in de animatie
let frameDelay = 80; // Animatiesnelheid in milliseconden per frame
let lastFrameUpdate = Date.now(); // Sla de huidige tijd op voor het bijwerken van de frames

// === Speler object ===
let player = {
  x: WORLD_WIDTH / 2, // Beginpositie van de speler in de x-richting
  y: 300, // Beginpositie van de speler in de y-richting
  size: 25, // Grootte van de speler
  speed: 3, // Snelheid van de speler
  score: 0, // Score van de speler
  coins: 0, // Aantal verzamelde munten
  health: 3, // Gezondheid van de speler (levens)
  angle: 0, // Draaihoek van de speler
  skills: { // Speciale vaardigheden van de speler
    speedBoost: false, // Versnellingsboost
    invisible: false, // Onzichtbaarheid
    shield: false // Schild
  },
  cooldowns: { // Cooldowns voor de vaardigheden
    speedBoost: 0, // Cooldown voor snelheidboost
    invisible: 0, // Cooldown voor onzichtbaarheid
    shield: 0 // Cooldown voor schild
  }
};

// Variabelen voor toetsinvoer en andere objecten
let keys = {}; // Object voor het bijhouden van toetsinvoer
let enemies = [], walls = []; // Lijsten voor vijanden en muren

// === CAMERA WEERGAVE LOGICA ===
let camX, camY, camWidth, camHeight; // Coördinaten en afmetingen van de camera

// Functie om te controleren of iets zichtbaar is binnen de camerapositie
function isVisible(x, y, size = 0) {
  return (
    x + size > camX && // Het object bevindt zich rechts van de camera
    x - size < camX + camWidth && // Het object bevindt zich links van de camera
    y + size > camY && // Het object bevindt zich onder de camera
    y - size < camY + camHeight // Het object bevindt zich boven de camera
  );
}

// Ambient licht (lichtbronnen)
let ambientLights = [];
for (let i = 0; i < 80; i++) {
  ambientLights.push({
    x: Math.random() * WORLD_WIDTH, // Willekeurige x-positie
    y: Math.random() * WORLD_HEIGHT, // Willekeurige y-positie
    baseRadius: Math.random() * 3 + 2, // Willekeurige straal voor het licht
    pulseOffset: Math.random() * 1000, // Willekeurige pulsatie offset
    opacity: Math.random() * 0.3 + 0.2, // Willekeurige doorzichtigheid van het licht
    speed: Math.random() * 0.5 + 0.2 // Willekeurige snelheid van de lichtpulsatie
  });
}

// Fog particles (neveldeeltjes)
let fogParticles = [];
for (let i = 0; i < 100; i++) {
  fogParticles.push({
    x: Math.random() * WORLD_WIDTH, // Willekeurige x-positie voor het deeltje
    y: Math.random() * WORLD_HEIGHT, // Willekeurige y-positie voor het deeltje
    radius: 100 + Math.random() * 200, // Willekeurige straal van het deeltje
    opacity: 0.02 + Math.random() * 0.02 // Willekeurige doorzichtigheid van het deeltje
  });
}

// Labels en sneltoetsen voor vaardigheden
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

// === Toetsinvoer ===
document.addEventListener("keydown", e => {
  keys[e.key] = true; // Registreer dat de toets is ingedrukt
  // Activeer de vaardigheden bij het indrukken van de specifieke toetsen
  if (e.key === 'v') activateSkill("speedBoost");
  if (e.key === 'b') activateSkill("invisible");
  if (e.key === 'f') activateSkill("shield");
  if (e.key === "Escape") { // Pauzeer of hervat het spel bij Escape
    if (isGameRunning && !isPaused) pauseGame();
    else if (isPaused) resumeGame();
  }
});
document.addEventListener("keyup", e => keys[e.key] = false); // Registreer dat de toets is losgelaten

// === Spel Starten ===
function startGame() {
  const menu = document.getElementById("menu"); // Verberg het hoofdmenu als het spel begint
  if (menu) menu.style.display = "none";

  isGameRunning = true; // Het spel is gestart

  generateWalls(); // Genereer muren
  generateBorders(); // Genereer grenzen
  for (let i = 0; i < 30; i++) spawnEnemy(); // Genereer vijanden

  // Zorg ervoor dat de speler niet in een muur zit bij de start
  while (walls.some(w => rectCircleColliding(player, w))) {
    player.x = Math.random() * (WORLD_WIDTH - 100) + 50; // Nieuwe willekeurige x-positie
    player.y = Math.random() * (WORLD_HEIGHT - 100) + 50; // Nieuwe willekeurige y-positie
  }

  gameLoop(); // Start de game loop
}

function goToMainMenu() {
  window.location.href = "index.html"; // Ga naar het hoofdmenu
}

function pauseGame() {
  isPaused = true; // Zet de game op pauze
  document.getElementById("pauseMenu").style.display = "flex"; // Toon het pauzemenu
}

function resumeGame() {
  isPaused = false; // Hervat het spel
  document.getElementById("pauseMenu").style.display = "none"; // Verberg het pauzemenu
}

function goToMainMenu() {
  window.location.reload(); // Herlaad de pagina (terug naar het menu)
}

// === Vaardigheden Logica ===
function activateSkill(skill) {
  const now = Date.now(); // Verkrijg de huidige tijd
  if (player.cooldowns[skill] > now) return; // Controleer of de vaardigheid al in cooldown is

  player.cooldowns[skill] = now + 5000; // Stel de cooldown in voor de vaardigheid
  player.skills[skill] = true; // Activeer de vaardigheid

  switch (skill) {
    case "speedBoost":
      player.speed *= 2; // Verhoog de snelheid van de speler
      setTimeout(() => {
        player.speed /= 2; // Zet de snelheid terug naar normaal na 3 seconden
        player.skills.speedBoost = false; // De vaardigheid is niet meer actief
      }, 3000);
      break;
    case "invisible":
      setTimeout(() => player.skills.invisible = false, 3000); // De onzichtbaarheid eindigt na 3 seconden
      break;
    case "shield":
      setTimeout(() => player.skills.shield = false, 3000); // Het schild eindigt na 3 seconden
      break;
  }
}

// Update de UI voor de cooldowns van vaardigheden
function updateCooldownUI() {
  const now = Date.now(); // Verkrijg de huidige tijd
  const updateBtn = (id, skill) => {
    const btn = document.getElementById(id);
    const remaining = player.cooldowns[skill] - now; // Bereken de resterende tijd voor de cooldown
    if (remaining > 0) {
      btn.innerText = `${skillLabels[skill]} (${Math.ceil(remaining / 1000)}s)`; // Toon de resterende tijd
      btn.disabled = true; // Zet de knop uit
      btn.style.opacity = "0.5"; // Maak de knop doorzichtig
    } else {
      btn.innerText = `${skillLabels[skill]} (${skillHotkeys[skill]})`; // Toon de sneltoets
      btn.disabled = false; // Zet de knop aan
      btn.style.opacity = "1"; // Zet de knop volledig zichtbaar
    }
  };
  updateBtn("speedBtn", "speedBoost"); // Update de knop voor de snelheid
  updateBtn("invisBtn", "invisible"); // Update de knop voor onzichtbaarheid
  updateBtn("shieldBtn", "shield"); // Update de knop voor het schild
}


// === Wereld en vijanden ===

// Genereer de muren van de wereld
function generateWalls() {
  walls = []; // Reset de muren

  // Bovenlaag zand (bovenste deel van de wereld)
  walls.push({ x: 0, y: 0, w: WORLD_WIDTH, h: 200, color: "#E5C07B" });

  // Onderlaag (bodemstructuur)
  walls.push({ x: 0, y: WORLD_HEIGHT - 400, w: WORLD_WIDTH, h: 400, color: "#A67C52" });

  // ⛔ Geen blokmuren meer links/rechts – we tekenen die straks visueel!
}

// Genereer de grenzen van de wereld (randmuren)
function generateBorders() {
  walls.push({ x: 0, y: 0, w: WORLD_WIDTH, h: 100 }); // Bovenkant
  walls.push({ x: 0, y: WORLD_HEIGHT - 100, w: WORLD_WIDTH, h: 100 }); // Onderkant
  walls.push({ x: 0, y: 0, w: 100, h: WORLD_HEIGHT }); // Linkerkant
  walls.push({ x: WORLD_WIDTH - 100, y: 0, w: 100, h: WORLD_HEIGHT }); // Rechterkant
}

// Genereer vijanden op willekeurige posities
function spawnEnemy() {
  let tries = 0; // Aantal pogingen om een vijand te plaatsen
  while (tries < 50) { // Probeer maximaal 50 keer om een vijand te plaatsen
    const x = Math.random() * WORLD_WIDTH; // Willekeurige x-positie
    const y = Math.random() * WORLD_HEIGHT; // Willekeurige y-positie
    const dist = Math.hypot(x - player.x, y - player.y); // Bereken de afstand tot de speler
    if (dist < 400) { tries++; continue; } // Als de vijand te dichtbij is, probeer opnieuw

    const tempEnemy = { x, y, size: 30 }; // Nieuwe tijdelijke vijand
    const collides = walls.some(w => rectCircleColliding(tempEnemy, w)); // Controleer of de vijand met een muur collidet
    if (collides) { tries++; continue; } // Als er een botsing is, probeer opnieuw

    // Bepaal de grootte, kleur en type van de vijand
    let size = 15;
    let color = "lime"; 
    let type = "fish";

    if (y > 4000) { size = 50; color = "crimson"; type = "shark"; } // Grote haai als de y-positie hoog is
    else if (y > 2500) { size = 30; color = "purple"; } // Middelgrote vis
    else { size = 15 + Math.random() * 10; } // Kleine vis

    // Voeg de vijand toe aan de vijandenlijst
    enemies.push({ x, y, size, color, type, speed: 1 + Math.random(), angle: Math.random() * Math.PI * 2 });
    break; // Stop met proberen als de vijand succesvol is geplaatst
  }
}

// Controleer of een cirkel en rechthoek met elkaar botsen
function rectCircleColliding(circ, rect) {
  const distX = Math.abs(circ.x - rect.x - rect.w / 2); // Bereken de afstand in de x-richting
  const distY = Math.abs(circ.y - rect.y - rect.h / 2); // Bereken de afstand in de y-richting
  if (distX > (rect.w / 2 + circ.size)) return false; // Geen botsing als afstand te groot is
  if (distY > (rect.h / 2 + circ.size)) return false; // Geen botsing als afstand te groot is
  if (distX <= (rect.w / 2)) return true; // Botsing als de x-afstand binnen de rechthoek is
  if (distY <= (rect.h / 2)) return true; // Botsing als de y-afstand binnen de rechthoek is
  const dx = distX - rect.w / 2; // Bereken de afstand tussen de cirkel en rechthoek in de x-richting
  const dy = distY - rect.h / 2; // Bereken de afstand tussen de cirkel en rechthoek in de y-richting
  return dx * dx + dy * dy <= (circ.size * circ.size); // Controleer op botsing
}

function triggerDamageEffect() {
  damageEffect.active = true;
  damageEffect.time = Date.now();

  // Je kan hier ook geluid of andere effecten starten
}

function update() {
  if (!isGameRunning || isPaused) return;

  // === Richting vector voor de beweging van de speler ===
  let dx = 0, dy = 0;

  if (keys["ArrowLeft"] || keys["a"]) dx -= 1;
  if (keys["ArrowRight"] || keys["d"]) dx += 1;
  if (keys["ArrowUp"] || keys["w"]) dy -= 1;
  if (keys["ArrowDown"] || keys["s"]) dy += 1;

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

  // === Vijanden updates ===
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    const dist = Math.hypot(player.x - e.x, player.y - e.y);
    const dirX = (player.x - e.x) / dist;
    const dirY = (player.y - e.y) / dist;

    if (!player.skills.invisible && dist < 500) {
      if (e.type === "fish") {
        const fleeAngle = Math.atan2(e.y - player.y, e.x - player.x);
        let da = fleeAngle - e.angle;
        if (da > Math.PI) da -= 2 * Math.PI;
        if (da < -Math.PI) da += 2 * Math.PI;
        e.angle += da * 0.05;
        e.x += Math.cos(e.angle) * e.speed * 0.6;
        e.y += Math.sin(e.angle) * e.speed * 0.6;
      } else if (e.type === "shark") {
        if (player.size < e.size) {
          const chaseAngle = Math.atan2(player.y - e.y, player.x - e.x);
          let da = chaseAngle - e.angle;
          if (da > Math.PI) da -= 2 * Math.PI;
          if (da < -Math.PI) da += 2 * Math.PI;
          e.angle += da * 0.07;
          e.x += Math.cos(e.angle) * e.speed * 0.9;
          e.y += Math.sin(e.angle) * e.speed * 0.9;
        } else {
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
      e.angle += Math.sin(Date.now() / 600 + i) * 0.01;
      e.x += Math.cos(e.angle) * e.speed * 0.4;
      e.y += Math.sin(e.angle) * e.speed * 0.4;
    }

    // === Muur-ontwijking
    let avoidanceAngle = 0;
    let nearbyWall = false;

    for (let wall of walls) {
      const closestX = Math.max(wall.x, Math.min(e.x, wall.x + wall.w));
      const closestY = Math.max(wall.y, Math.min(e.y, wall.y + wall.h));
      const distToWall = Math.hypot(e.x - closestX, e.y - closestY);

      if (distToWall < e.size + 20) {
        nearbyWall = true;
        const angleFromWall = Math.atan2(e.y - closestY, e.x - closestX);
        avoidanceAngle += angleFromWall;
      }
    }

    if (nearbyWall) {
      let da = avoidanceAngle - e.angle;
      if (da > Math.PI) da -= 2 * Math.PI;
      if (da < -Math.PI) da += 2 * Math.PI;
      e.angle += da * 0.1;
    }

    // === Opeten logica
    if (dist < player.size + e.size * 0.6) {
      if (player.size > e.size) {
        player.size += e.size * 0.1;
        player.score += 1;
        triggerEffect("enemyPop", e.x, e.y);
      } else {
        applyDamage(1);
        triggerEffect("damageBurst", player.x, player.y);
      }
      enemies.splice(i, 1);      
    }
  }

  // === Particles updaten
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy -= 0.02; // lichte opwaartse beweging
    p.life--;
    if (p.life <= 0) particles.splice(i, 1);
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
function applyDamage(amount) {
  player.health -= amount;

  // Alleen particles, geen shake!
  for (let i = 0; i < 8; i++) {
    spawnParticle("heart", player.x, player.y, {
      vx: (Math.random() - 0.5) * 3,
      vy: (Math.random() - 0.5) * 3,
      size: 18 + Math.random() * 10,
      rotation: Math.random() * Math.PI * 2,
      color: ["#ff5555", "#ff9999", "#ffffff"][Math.floor(Math.random() * 3)]
    });
  }

  if (player.health <= 0) {
    isGameRunning = false;
    setTimeout(() => {
      alert("Game Over!");
      goToMainMenu();
    }, 300);
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
  const density = 14;
  const baseIntensity = 2.4; // veel sterker nu

  for (let i = 0; i < layers; i++) {
    const depth = 0.2 + i * 0.2; // grotere stappen voor extremere lagen
    const intensity = baseIntensity + i * 0.5; // per laag heftiger

    for (let j = 0; j < density; j++) {
      const seed = j + i * 100;

      const baseX = seededRandom(seed * 999) * WORLD_WIDTH;
      const baseY = seededRandom(seed * 123) * WORLD_HEIGHT;

      const wiggleX = Math.sin(Date.now() / (1000 + i * 500) + seed) * (10 * (1 - depth));
      const wiggleY = Math.cos(Date.now() / (1200 + i * 400) + seed) * (8 * (1 - depth));
      const sway = Math.sin(Date.now() / (1300 + i * 300) + seed) * 0.4;

      const x = baseX + wiggleX - camX * depth * intensity;
      const y = baseY + wiggleY - camY * depth * intensity;

      // Afstand tot camera check (optioneel, voor zichtbereik optimalisatie)
      if (x < camX - 500 || x > camX + canvas.width / zoom + 500 ||
          y < camY - 500 || y > camY + canvas.height / zoom + 500) continue;

      const imgIndex = Math.floor(seededRandom(seed) * 3);
      const plantImage = [seaweedImage1, seaweedImage2, seaweedImage3][imgIndex];

      const scale = (0.6 + i * 0.2) * (1 - depth * 1.3); // kleinere planten per diepte
      const size = 200 * scale;

      const alpha = (0.45 + i * 0.15) * (1 - depth * 1.2); // fade sneller weg
      const blur = (scale < 0.35) ? 10 + 30 * (1 - scale) : 0;

      const tintGreen = 80 + depth * 100;
      const tintBlue = 120 + depth * 160;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(sway);
      ctx.globalAlpha = Math.max(0, alpha);

      if (blur > 0) {
        ctx.shadowColor = `rgba(0, ${tintGreen}, ${tintBlue}, 0.25)`;
        ctx.shadowBlur = blur;
      }

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
    ctx.fillStyle = wall.color || "#444";
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

function drawMapStructure() {
  ctx.save();

  // 🌊 Water achtergrond
  const gradient = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
  gradient.addColorStop(0, "#6ecdf5");
  gradient.addColorStop(0.4, "#0077be");
  gradient.addColorStop(1, "#001f3f");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  // 🌊 Golvende zandbovenkant
  ctx.fillStyle = "#e0c26b";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 100);
  ctx.bezierCurveTo(200, 30, 400, 170, 600, 100);
  ctx.bezierCurveTo(800, 30, 1000, 170, WORLD_WIDTH, 100);
  ctx.lineTo(WORLD_WIDTH, 0);
  ctx.closePath();
  ctx.fill();

  // Helperfunctie
  function rockGradient(x1, x2) {
    const grad = ctx.createLinearGradient(x1, 0, x2, 0);
    grad.addColorStop(0, "#3a3a3a");
    grad.addColorStop(1, "#1e1e1e");
    return grad;
  }

  // 🪨 Linkerwand
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, 100);
  ctx.lineTo(0, WORLD_HEIGHT);
  ctx.lineTo(50, WORLD_HEIGHT - 180);
  ctx.lineTo(120, WORLD_HEIGHT - 360);
  ctx.lineTo(80, WORLD_HEIGHT - 540);
  ctx.lineTo(200, WORLD_HEIGHT - 720);
  ctx.lineTo(100, WORLD_HEIGHT - 920);
  ctx.lineTo(240, WORLD_HEIGHT - 1220);
  ctx.lineTo(180, WORLD_HEIGHT - 1520);
  ctx.lineTo(280, WORLD_HEIGHT - 1820);
  ctx.lineTo(200, WORLD_HEIGHT - 2120);
  ctx.lineTo(400, WORLD_HEIGHT - 2520);
  ctx.lineTo(250, WORLD_HEIGHT - 2920);
  ctx.lineTo(500, WORLD_HEIGHT - 3320);
  ctx.lineTo(300, WORLD_HEIGHT - 3720);
  ctx.lineTo(500, WORLD_HEIGHT - 4120);
  ctx.lineTo(200, WORLD_HEIGHT - 4520);
  ctx.lineTo(600, WORLD_HEIGHT - 4920);
  ctx.lineTo(600, 100);
  ctx.lineTo(400, 90);
  ctx.lineTo(300, 130);
  ctx.lineTo(200, 100);
  ctx.lineTo(100, 110);
  ctx.lineTo(0, 100);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = rockGradient(0, 600);
  ctx.fill();
  if (rockPattern) {
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = rockPattern;
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // 🪨 Rechterwand
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(WORLD_WIDTH, 100);
  ctx.lineTo(WORLD_WIDTH, WORLD_HEIGHT);
  ctx.lineTo(WORLD_WIDTH - 50, WORLD_HEIGHT - 200);
  ctx.lineTo(WORLD_WIDTH - 120, WORLD_HEIGHT - 400);
  ctx.lineTo(WORLD_WIDTH - 80, WORLD_HEIGHT - 600);
  ctx.lineTo(WORLD_WIDTH - 200, WORLD_HEIGHT - 800);
  ctx.lineTo(WORLD_WIDTH - 100, WORLD_HEIGHT - 1000);
  ctx.lineTo(WORLD_WIDTH - 240, WORLD_HEIGHT - 1300);
  ctx.lineTo(WORLD_WIDTH - 180, WORLD_HEIGHT - 1600);
  ctx.lineTo(WORLD_WIDTH - 280, WORLD_HEIGHT - 1900);
  ctx.lineTo(WORLD_WIDTH - 200, WORLD_HEIGHT - 2200);
  ctx.lineTo(WORLD_WIDTH - 400, WORLD_HEIGHT - 2600);
  ctx.lineTo(WORLD_WIDTH - 250, WORLD_HEIGHT - 3000);
  ctx.lineTo(WORLD_WIDTH - 500, WORLD_HEIGHT - 3400);
  ctx.lineTo(WORLD_WIDTH - 300, WORLD_HEIGHT - 3800);
  ctx.lineTo(WORLD_WIDTH - 500, WORLD_HEIGHT - 4200);
  ctx.lineTo(WORLD_WIDTH - 200, WORLD_HEIGHT - 4600);
  ctx.lineTo(WORLD_WIDTH - 600, WORLD_HEIGHT - 5000);
  ctx.lineTo(WORLD_WIDTH - 600, 100);
  ctx.lineTo(WORLD_WIDTH - 400, 80);
  ctx.lineTo(WORLD_WIDTH - 300, 120);
  ctx.lineTo(WORLD_WIDTH - 200, 90);
  ctx.lineTo(WORLD_WIDTH - 100, 100);
  ctx.lineTo(WORLD_WIDTH, 100);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = rockGradient(WORLD_WIDTH - 600, WORLD_WIDTH);
  ctx.fill();
  if (rockPattern) {
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = rockPattern;
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // ⛰️ Centrale wand
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(WORLD_WIDTH / 2 - 800, WORLD_HEIGHT);
  ctx.lineTo(WORLD_WIDTH / 2 - 770, WORLD_HEIGHT - 100);
  ctx.lineTo(WORLD_WIDTH / 2 - 740, WORLD_HEIGHT - 300);
  ctx.lineTo(WORLD_WIDTH / 2 - 700, WORLD_HEIGHT - 500);
  ctx.lineTo(WORLD_WIDTH / 2 - 680, WORLD_HEIGHT - 700);
  ctx.lineTo(WORLD_WIDTH / 2 - 710, WORLD_HEIGHT - 850);
  ctx.lineTo(WORLD_WIDTH / 2 - 620, WORLD_HEIGHT - 1100);
  ctx.lineTo(WORLD_WIDTH / 2 - 590, WORLD_HEIGHT - 1300);
  ctx.lineTo(WORLD_WIDTH / 2 - 640, WORLD_HEIGHT - 1500);
  ctx.lineTo(WORLD_WIDTH / 2 - 540, WORLD_HEIGHT - 1700);
  ctx.lineTo(WORLD_WIDTH / 2 - 440, WORLD_HEIGHT - 1900);
  ctx.lineTo(WORLD_WIDTH / 2 - 380, WORLD_HEIGHT - 2100);
  ctx.lineTo(WORLD_WIDTH / 2 - 340, WORLD_HEIGHT - 2300);
  ctx.lineTo(WORLD_WIDTH / 2 - 290, WORLD_HEIGHT - 2500);
  ctx.lineTo(WORLD_WIDTH / 2 - 250, WORLD_HEIGHT - 2600);
  ctx.lineTo(WORLD_WIDTH / 2 - 200, WORLD_HEIGHT - 2800);
  ctx.lineTo(WORLD_WIDTH / 2 - 120, WORLD_HEIGHT - 2820);
  ctx.lineTo(WORLD_WIDTH / 2 - 20,  WORLD_HEIGHT - 2830);
  ctx.lineTo(WORLD_WIDTH / 2 + 100, WORLD_HEIGHT - 2800);
  ctx.lineTo(WORLD_WIDTH / 2 + 140, WORLD_HEIGHT - 2700);
  ctx.lineTo(WORLD_WIDTH / 2 + 180, WORLD_HEIGHT - 2500);
  ctx.lineTo(WORLD_WIDTH / 2 + 150, WORLD_HEIGHT - 2300);
  ctx.lineTo(WORLD_WIDTH / 2 + 250, WORLD_HEIGHT - 2100);
  ctx.lineTo(WORLD_WIDTH / 2 + 210, WORLD_HEIGHT - 1900);
  ctx.lineTo(WORLD_WIDTH / 2 + 320, WORLD_HEIGHT - 1700);
  ctx.lineTo(WORLD_WIDTH / 2 + 300, WORLD_HEIGHT - 1500);
  ctx.lineTo(WORLD_WIDTH / 2 + 380, WORLD_HEIGHT - 1300);
  ctx.lineTo(WORLD_WIDTH / 2 + 420, WORLD_HEIGHT - 1100);
  ctx.lineTo(WORLD_WIDTH / 2 + 390, WORLD_HEIGHT - 900);
  ctx.lineTo(WORLD_WIDTH / 2 + 450, WORLD_HEIGHT - 700);
  ctx.lineTo(WORLD_WIDTH / 2 + 430, WORLD_HEIGHT - 500);
  ctx.lineTo(WORLD_WIDTH / 2 + 500, WORLD_HEIGHT - 300);
  ctx.lineTo(WORLD_WIDTH / 2 + 550, WORLD_HEIGHT - 100);
  ctx.lineTo(WORLD_WIDTH / 2 + 580, WORLD_HEIGHT);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = rockGradient(WORLD_WIDTH / 2 - 600, WORLD_WIDTH / 2 + 600);
  ctx.fill();
  if (rockPattern) {
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = rockPattern;
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // 💰 Schatkist
  ctx.fillStyle = "#b56c20";
  const chestW = 45, chestH = 30;
  ctx.fillRect(WORLD_WIDTH / 2 - chestW / 2, WORLD_HEIGHT - chestH - 500, chestW, chestH);
  ctx.strokeStyle = "#000";
  ctx.strokeRect(WORLD_WIDTH / 2 - chestW / 2, WORLD_HEIGHT - chestH - 500, chestW, chestH);

  ctx.restore();
}

function drawCaveInterior() {
  ctx.save();
  ctx.fillStyle = "#1f1f1f";

  const left = WORLD_WIDTH / 2 - 120;
  const right = WORLD_WIDTH / 2 + 120;

  ctx.beginPath();
  ctx.moveTo(left, 1600);
  ctx.lineTo(left - 30, 2400);
  ctx.lineTo(left, 3200);
  ctx.lineTo(left + 20, 4200);
  ctx.lineTo(left, 6000);

  ctx.lineTo(right, 6000);
  ctx.lineTo(right - 20, 4200);
  ctx.lineTo(right, 3200);
  ctx.lineTo(right + 30, 2400);
  ctx.lineTo(right, 1600);

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

  // === Camera shake effect
  let shakeX = 0, shakeY = 0;
  if (damageEffect.active) {
    const elapsed = Date.now() - damageEffect.time;
    if (elapsed < damageEffect.duration) {
      const shake = damageEffect.intensity * (1 - elapsed / damageEffect.duration);
      shakeX = (Math.random() - 0.5) * shake;
      shakeY = (Math.random() - 0.5) * shake;
    } else {
      damageEffect.active = false;
    }
  }
  cameraShake.x = shakeX;
  cameraShake.y = shakeY;

  // === Camera coördinaten
  const camX = player.x - (canvas.width / 2) / zoom + camOffset.x + cameraShake.x;
  const camY = player.y - (canvas.height / 2) / zoom + camOffset.y + cameraShake.y;

  // === Game wereld tekenen (onder invloed van zoom & camera)
  ctx.save();
  ctx.setTransform(zoom, 0, 0, zoom, -camX * zoom, -camY * zoom);

  drawWaterDistortion(camX, camY, zoom);
  drawBackground(camX, camY, zoom);
  drawAmbientLights();
  drawCaveInterior();
  drawMapStructure();
  drawParallaxPlants(camX, camY, zoom);
  drawStructuredDecorations();

  drawEnemies();
  drawPlayerTrail();
  drawPlayer();
  drawShield();
  drawSpotlight();
  drawDepthFog(camX, camY, zoom);

  // === Particles tekenen (nu binnen camera!)
  for (let p of particles) {
    const alpha = p.life / p.maxLife;
    ctx.globalAlpha = alpha;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);

    switch (p.type) {
      case "heart":
      ctx.fillStyle = p.color || "red";
      ctx.font = `${p.size}px Arial`;
      ctx.fillText("❤", 0, 0);

      // Na een paar frames omvormen naar brekende stukjes
      if (p.life < p.maxLife - 10 && !p.exploded) {
        p.exploded = true;

        const bloodColors = ["#8B0000", "#a10000", "#660000"];
        const baseColor = bloodColors[Math.floor(Math.random() * bloodColors.length)];

        for (let i = 0; i < 6; i++) {
          spawnParticle("heartBreak", p.x, p.y, {
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2,
            size: 6 + Math.random() * 4,
            rotation: Math.random() * Math.PI * 2,
            color: baseColor,
            life: 20,
            maxLife: 20
          });
        }
      }
      break;

    case "heartBreak":
      ctx.fillStyle = p.color || "#8B0000"; // Donker bloedrood
      ctx.beginPath();
      ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
      ctx.fill();
      break;

      case "star":
        ctx.fillStyle = p.color || "white";
        ctx.font = `${p.size}px Arial`;
        ctx.fillText("✧", 0, 0);
        break;

      case "dot":
        ctx.fillStyle = p.color || "rgba(255,255,255,0.2)";
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
        break;

      case "bubble":
        ctx.strokeStyle = p.color || "rgba(200,200,255,0.3)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.stroke();
        break;

      case "xp":
        ctx.fillStyle = p.color || "#88f";
        ctx.font = `${p.size}px Arial`;
        ctx.fillText("+XP", 0, 0);
        break;

      case "smoke":
        ctx.fillStyle = p.color || "rgba(100,100,100,0.4)";
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
        break;
    }

    ctx.restore();
  }
  ctx.globalAlpha = 1;
  ctx.restore(); // einde wereld

  drawSpeedOverlay();
  drawVignette();
  drawHUD();
}

function triggerEffect(type, x, y) {
  switch (type) {
    case "damageBurst":
      // Verwijder: triggerDamageEffect(); ← geen shake meer

      for (let i = 0; i < 8; i++) {
        spawnParticle("heart", x, y, {
          vx: (Math.random() - 0.5) * 3,
          vy: (Math.random() - 0.5) * 3,
          size: 18 + Math.random() * 10,
          rotation: Math.random() * Math.PI * 2,
          color: ["#ff5555", "#ff9999", "#ffffff"][Math.floor(Math.random() * 3)]
        });
      }
      break;

    case "coinPickup":
      for (let i = 0; i < 6; i++) {
        spawnParticle("star", x, y, {
          size: 10 + Math.random() * 8,
          color: "gold",
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2
        });
      }
      break;

    case "enemyPop":
      for (let i = 0; i < 10; i++) {
        spawnParticle("dot", x, y, {
          size: 3 + Math.random() * 5,
          color: "rgba(255, 0, 0, 0.5)",
          vx: (Math.random() - 0.5) * 5,
          vy: (Math.random() - 0.5) * 5
        });
      }
      break;

    // Voeg hier makkelijk nieuwe effecten toe
  }
}

function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}
