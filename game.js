import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/* ==========================================================================
   CHARACTERS CONFIGURATION (END-FIELD OPERATOR ROSTER)
   ========================================================================== */
const CHARACTERS = {
  shiroko: {
    id: 'shiroko',
    name: 'Sunaookami Shiroko',
    sub: 'Abydos Sec-Ops • Foreclosure Task Force',
    role: 'VANGUARD // SPEED & ASSAULT',
    code: 'OPERATOR: BA-01',
    file: 'Shiroko.glb',
    avatarClass: 'avatar-shiroko',
    avatarLetter: 'S',
    specs: {
      'AGILITY': 'RANK A+',
      'DPS': 'RANK S',
      'TECH': 'BURST'
    },
    scale: 1.0,
    modelRotationY: 0.0,
    yOffset: 0.0,
    cameraHeight: 0.85,
    cameraDist: 3.4,
    anims: {
      idle: 'Normal_Idle',
      run: 'Move_Ing',
      jump: 'Move_Jump',
      attack: 'Normal_Attack_Ing'
    },
    attackDuration: 0.80,
    attackCancelTime: 0.38,
    attackRecoverTime: 0.68,
    attackCooldown: 0.55
  },
  drdoom: {
    id: 'drdoom',
    name: 'Doctor Doom',
    sub: 'Latverian Empire • Monarch & Supreme Sorcerer',
    role: 'RULER // TECHNO-MAGIC CASTER',
    code: 'OPERATOR: M-07',
    file: 'DrDoom.glb',
    avatarClass: 'avatar-doom',
    avatarLetter: 'D',
    specs: {
      'POWER': 'RANK EX',
      'DEFENSE': 'RANK S+',
      'MAGIC': 'ARCANE'
    },
    scale: 2.45,
    modelRotationY: -Math.PI / 2,
    yOffset: 0.0,
    cameraHeight: 1.15,
    cameraDist: 3.6,
    canFly: true,
    anims: {
      idle: 'idle',
      run: 'walk',
      jump: 'jump_start',
      attack: 'attack_light1',
      fly_idle: 'fly_idle',
      fly_slow: 'fly_slow',
      fly_fast: 'fly_fast'
    },
    attackDuration: 0.87,
    attackCancelTime: 0.40,
    attackRecoverTime: 0.72,
    attackCooldown: 0.60
  }
};

/* ==========================================================================
   GAME ENGINE & STATE
   ========================================================================== */
const state = {
  // Current Active Character
  currentCharId: 'shiroko',

  // Loading
  isLoaded: false,

  // Character
  character: null,
  mixer: null,
  actions: {},
  currentAction: null,
  currentAnimName: 'idle',

  // Movement & Physics
  pos: new THREE.Vector3(0, 0, 0),
  vel: new THREE.Vector3(0, 0, 0),
  targetRotation: Math.PI,
  isGrounded: true,
  isSprinting: false,
  isAttacking: false,
  attackTimer: 0,
  attackCooldown: 0,
  stamina: 100,
  maxStamina: 100,
  jumpCooldown: 0,
  jumpCooldownDuration: 0.5,

  // Camera (Genshin Orbit TPS)
  yaw: 0,              // Horizontal angle (radians)
  pitch: 0.32,         // Vertical angle (radians)
  distance: 3.4,       // Distance from player
  minDistance: 1.5,
  maxDistance: 7.5,
  isPointerLocked: false,
  isMouseDown: false,
  lastMouseX: 0,
  lastMouseY: 0,

  // World & Platforms
  colliders: [],
  crystals: [],

  // Day/Night
  isSunset: false,

  // Flight State (Doctor Doom Levitation Skill)
  isFlying: false,
  lastSpaceTime: 0,
  thrusterGroup: null
};

// Controls input map
const keys = {
  w: false,
  a: false,
  s: false,
  d: false,
  shift: false,
  space: false,
  x: false,
  control: false
};

/* ==========================================================================
   DOM ELEMENTS
   ========================================================================== */
const canvas = document.getElementById('game-canvas');
const loadingScreen = document.getElementById('loading-screen');
const loadingProgress = document.getElementById('loading-progress');
const loadingTitle = document.getElementById('loading-title');
const flightHud = document.getElementById('flight-hud');
const btnCharMenu = document.getElementById('btn-char-menu');
const charModal = document.getElementById('char-modal');
const btnCloseModal = document.getElementById('btn-close-modal');
const operatorList = document.getElementById('operator-list');

/* ==========================================================================
   THREE.JS SETUP
   ========================================================================== */
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance'
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const bgDay = new THREE.Color(0xf1f5f9);
const bgSunset = new THREE.Color(0xfde68a);
scene.background = bgDay.clone();
scene.fog = new THREE.FogExp2(0xf1f5f9, 0.012);

// Camera
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 300);
camera.position.set(0, 2, 4);

/* ==========================================================================
   LIGHTING SETUP (CLEAN DEV WORLD)
   ========================================================================== */
const hemiLight = new THREE.HemisphereLight(0xffffff, 0xcfd8dc, 1.2);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight(0xfff8ee, 1.8);
sunLight.position.set(25, 45, 20);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 100;
const d = 35;
sunLight.shadow.camera.left = -d;
sunLight.shadow.camera.right = d;
sunLight.shadow.camera.top = d;
sunLight.shadow.camera.bottom = -d;
sunLight.shadow.bias = -0.0003;
scene.add(sunLight);

// Soft fill light
const fillLight = new THREE.DirectionalLight(0x7dd3fc, 0.6);
fillLight.position.set(-20, 20, -20);
scene.add(fillLight);

/* ==========================================================================
   AUDIO SYNTHESIZER (WEB AUDIO API - NO EXTERNAL FILES NEEDED)
   ========================================================================== */
let audioCtx = null;
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function playStepSound() {
  if (!audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(80, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.06);
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.06);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.06);
  } catch (e) {}
}

function playJumpSound() {
  if (!audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(380, audioCtx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
  } catch (e) {}
}

function playSingleShot(delay) {
  if (!audioCtx) return;
  const t = audioCtx.currentTime + delay;
  try {
    // 1. Noise buffer for weapon blast
    const bufferSize = Math.floor(audioCtx.sampleRate * 0.08);
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (audioCtx.sampleRate * 0.016));
    }
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;

    // Filter noise
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, t);
    filter.Q.setValueAtTime(1.8, t);

    // Noise Gain envelope
    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.22, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(audioCtx.destination);
    noise.start(t);

    // 2. Punch oscillator for mechanical kick
    const osc = audioCtx.createOscillator();
    const oscGain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.06);
    oscGain.gain.setValueAtTime(0.25, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    osc.connect(oscGain);
    oscGain.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.06);
  } catch (e) {}
}

function playDoomBlastSound() {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const t = audioCtx.currentTime;
  try {
    // 1. Deep techno-magic hum
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(90, t);
    osc1.frequency.exponentialRampToValueAtTime(340, t + 0.08);
    osc1.frequency.exponentialRampToValueAtTime(45, t + 0.32);
    gain1.gain.setValueAtTime(0.3, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start(t);
    osc1.stop(t + 0.32);

    // 2. High-energy plasma discharge
    const bufferSize = Math.floor(audioCtx.sampleRate * 0.18);
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (audioCtx.sampleRate * 0.035));
    }
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(900, t);
    filter.Q.setValueAtTime(2.2, t);
    const nGain = audioCtx.createGain();
    nGain.gain.setValueAtTime(0.35, t);
    nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(audioCtx.destination);
    noise.start(t);
  } catch (e) {}
}

function playDeploySound() {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const t = audioCtx.currentTime;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.08);
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.linearRampToValueAtTime(0.001, t + 0.12);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.12);
  } catch (e) {}
}

function playAttackSound() {
  if (state.currentCharId === 'drdoom') {
    playDoomBlastSound();
  } else {
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    // 3-Round burst with 90ms spacing (Shiroko White Fang 465)
    playSingleShot(0.0);
    playSingleShot(0.09);
    playSingleShot(0.18);
  }
}

function playFlightLaunchSound() {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  try {
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const filter = audioCtx.createBiquadFilter();
    const gain = audioCtx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(480, t + 0.35);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, t);
    filter.frequency.exponentialRampToValueAtTime(2600, t + 0.35);
    filter.Q.value = 5;

    gain.gain.setValueAtTime(0.22, t);
    gain.gain.linearRampToValueAtTime(0.001, t + 0.45);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(t);
    osc.stop(t + 0.45);
  } catch (e) {}
}

function playFlightDeactivateSound() {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  try {
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(340, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.28);

    gain.gain.setValueAtTime(0.18, t);
    gain.gain.linearRampToValueAtTime(0.001, t + 0.28);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(t);
    osc.stop(t + 0.28);
  } catch (e) {}
}

/* ==========================================================================
   PROCEDURAL CHECKERED DEV GRID TEXTURE
   ========================================================================== */
function createDevGridTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Fill base checkered pattern (soft light squares)
  const tileSize = 256;
  for (let x = 0; x < 512; x += tileSize) {
    for (let y = 0; y < 512; y += tileSize) {
      const isEven = (x / tileSize + y / tileSize) % 2 === 0;
      ctx.fillStyle = isEven ? '#ffffff' : '#f1f5f9';
      ctx.fillRect(x, y, tileSize, tileSize);
    }
  }

  // Inner subdivision grid (1m lines)
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 512; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  // Major outer border / accent lines (5m lines)
  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 5;
  ctx.strokeRect(0, 0, 512, 512);

  // Subtle coordinate marker dot in corners
  ctx.fillStyle = '#0284c7';
  ctx.beginPath();
  ctx.arc(12, 12, 4, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

/* ==========================================================================
   BUILD DEV ENVIRONMENT & PLATFORM KOTAK-KOTAK
   ========================================================================== */
function buildDevWorld() {
  const gridTex = createDevGridTexture();
  gridTex.repeat.set(60, 60);

  // 1. Main Flat Ground
  const floorGeo = new THREE.PlaneGeometry(160, 160);
  const floorMat = new THREE.MeshStandardMaterial({
    map: gridTex,
    roughness: 0.8,
    metalness: 0.1
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Add floor to colliders
  state.colliders.push({
    minX: -80, maxX: 80,
    minY: -0.1, maxY: 0,
    minZ: -80, maxZ: 80,
    isFloor: true
  });

  // Spawn Ring Marker
  const ringGeo = new THREE.RingGeometry(1.4, 1.5, 32);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x0284c7, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.01;
  scene.add(ring);

  // 2. Helper to add prototype box platforms
  function addDevPlatform(x, y, z, width, height, depth, color = 0xffffff, accentColor = 0x0284c7) {
    const geo = new THREE.BoxGeometry(width, height, depth);
    
    // Texture for top/sides
    const blockTex = createDevGridTexture();
    blockTex.repeat.set(Math.max(1, Math.round(width)), Math.max(1, Math.round(depth)));

    const mat = new THREE.MeshStandardMaterial({
      color: color,
      map: blockTex,
      roughness: 0.6,
      metalness: 0.15
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y + height / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    // Subtle edge highlight (Cyber dev style)
    const edges = new THREE.EdgesGeometry(geo);
    const lineMat = new THREE.LineBasicMaterial({ color: accentColor, linewidth: 2 });
    const wireframe = new THREE.LineSegments(edges, lineMat);
    mesh.add(wireframe);

    // Register collider
    state.colliders.push({
      minX: x - width / 2,
      maxX: x + width / 2,
      minY: y,
      maxY: y + height,
      minZ: z - depth / 2,
      maxZ: z + depth / 2,
      isFloor: false
    });

    return mesh;
  }

  // A. Staircase Platforms (Testing jump & parkour)
  // Step 1
  addDevPlatform(6, 0, -4, 3, 0.45, 3, 0xffffff, 0x0284c7);
  // Step 2
  addDevPlatform(6, 0.45, -7, 3, 0.45, 3, 0xffffff, 0x0284c7);
  // Step 3
  addDevPlatform(6, 0.90, -10, 3, 0.45, 3, 0xffffff, 0x0284c7);
  // Step 4: Big High Terrace (6m x 6m, 1.35m height)
  addDevPlatform(6, 0, -16, 7, 1.35, 7, 0xf8fafc, 0x38bdf8);
  // Small tower on terrace
  addDevPlatform(6, 1.35, -17.5, 2.5, 1.0, 2.5, 0xe0f2fe, 0x0284c7);

  // B. Low Hurdles / Obstacle Course
  addDevPlatform(-6, 0, -5, 5, 0.5, 1, 0xffffff, 0x64748b);
  addDevPlatform(-6, 0, -9, 5, 0.75, 1, 0xffffff, 0x64748b);
  addDevPlatform(-6, 0, -13, 5, 1.0, 1, 0xffffff, 0x64748b);

  // C. Wide Testing Stage on the Right
  addDevPlatform(16, 0, 4, 10, 0.8, 10, 0xffffff, 0x0ea5e9);
  addDevPlatform(16, 0.8, 4, 4, 0.8, 4, 0xf0f9ff, 0x0284c7);

  // D. Floating Stepping Stones (Parkour across abyss)
  addDevPlatform(-14, 0.8, 2, 2.5, 0.4, 2.5, 0xffffff, 0x0284c7);
  addDevPlatform(-14, 1.4, 7, 2.5, 0.4, 2.5, 0xffffff, 0x0284c7);
  addDevPlatform(-14, 2.0, 12, 2.5, 0.4, 2.5, 0xffffff, 0x0284c7);
  addDevPlatform(-14, 2.6, 17, 4, 0.5, 4, 0xf8fafc, 0x38bdf8);

  // E. Floating Collectible Energy Crystals (Anime / Blue Archive Pyroxene style)
  function addEnergyCrystal(x, y, z) {
    const geo = new THREE.OctahedronGeometry(0.35, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.8
    });
    const crystal = new THREE.Mesh(geo, mat);
    crystal.position.set(x, y, z);
    crystal.castShadow = true;
    scene.add(crystal);
    state.crystals.push({ mesh: crystal, baseY: y, seed: Math.random() * 10 });
  }

  addEnergyCrystal(6, 2.8, -17.5);
  addEnergyCrystal(16, 2.1, 4);
  addEnergyCrystal(-14, 3.6, 17);
  addEnergyCrystal(0, 1.0, -8);
}

/* ==========================================================================
   DOCTOR DOOM SPECIAL SKILL: LEVITATION / FLIGHT CONTROLLER
   ========================================================================== */
function createFlightThrusters() {
  const group = new THREE.Group();

  // Emerald green thruster rings beneath boots
  const ringGeo = new THREE.RingGeometry(0.08, 0.22, 32);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x10b981,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85
  });

  const leftRing = new THREE.Mesh(ringGeo, ringMat);
  leftRing.rotation.x = Math.PI / 2;
  leftRing.position.set(-0.20, 0.06, 0);

  const rightRing = new THREE.Mesh(ringGeo, ringMat.clone());
  rightRing.rotation.x = Math.PI / 2;
  rightRing.position.set(0.20, 0.06, 0);

  // Outer arcane seal
  const sealGeo = new THREE.RingGeometry(0.32, 0.40, 36);
  const sealMat = new THREE.MeshBasicMaterial({
    color: 0x34d399,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.6
  });
  const seal = new THREE.Mesh(sealGeo, sealMat);
  seal.rotation.x = Math.PI / 2;
  seal.position.set(0, 0.03, 0);

  group.add(leftRing);
  group.add(rightRing);
  group.add(seal);
  group.visible = false;
  return group;
}

function updateFlightHud() {
  if (!flightHud) return;
  if (state.isFlying) {
    flightHud.classList.remove('hidden');
  } else {
    flightHud.classList.add('hidden');
  }
}

function enterFlight() {
  const char = CHARACTERS[state.currentCharId];
  if (!char || !char.canFly || state.isFlying) return;

  state.isFlying = true;
  state.isGrounded = false;
  state.jumpCooldown = 0;
  state.vel.y = Math.max(state.vel.y, 4.5); // Lift off into hover
  state.pos.y = Math.max(state.pos.y, 0.5);

  if (state.thrusterGroup) {
    state.thrusterGroup.visible = true;
  }

  updateFlightHud();
  switchAnimation('fly_idle', 0.25);
  playFlightLaunchSound();
}

function exitFlight() {
  if (!state.isFlying) return;
  state.isFlying = false;
  state.vel.y = 0;

  if (state.thrusterGroup) {
    state.thrusterGroup.visible = false;
  }

  updateFlightHud();
  switchAnimation(state.isGrounded ? 'idle' : 'jump', 0.25);
  playFlightDeactivateSound();
}

function toggleFlight() {
  if (state.isFlying) {
    exitFlight();
  } else {
    enterFlight();
  }
}

/* ==========================================================================
   LOAD CHARACTER 3D MODEL & ANIMATIONS (MULTI-OPERATOR SUPPORT)
   ========================================================================== */
function loadCharacter(charId = 'shiroko') {
  const char = CHARACTERS[charId] || CHARACTERS.shiroko;
  state.currentCharId = char.id;

  // Show loading overlay
  if (loadingScreen) {
    loadingScreen.style.display = 'flex';
    loadingScreen.style.opacity = '1';
    if (loadingProgress) loadingProgress.style.width = '0%';
    if (loadingTitle) loadingTitle.textContent = `Menyiapkan ${char.name}...`;
  }

  // Remove existing model & stop mixer
  if (state.character) {
    scene.remove(state.character);
    state.character = null;
  }
  if (state.thrusterGroup) {
    state.thrusterGroup = null;
  }
  state.isFlying = false;
  updateFlightHud();

  if (state.mixer) {
    state.mixer.stopAllAction();
    state.mixer = null;
  }
  state.actions = {};
  state.currentAction = null;

  const loader = new GLTFLoader();
  loader.load(
    char.file,
    (gltf) => {
      // Create root container group for physics & orientation
      const rootGroup = new THREE.Group();
      rootGroup.position.copy(state.pos);
      rootGroup.rotation.y = state.targetRotation;

      // Add loaded model as child with character-specific scale and local rotation offset
      const model = gltf.scene;
      model.scale.setScalar(char.scale);
      model.rotation.y = char.modelRotationY;
      model.position.y = char.yOffset;

      model.traverse((child) => {
        if (child.isMesh || child.isSkinnedMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          child.frustumCulled = false; // Prevents SkinnedMesh from vanishing at camera angles
          if (child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach(mat => {
              mat.roughness = char.id === 'drdoom' ? 0.45 : 0.65;
              mat.metalness = char.id === 'drdoom' ? 0.35 : 0.1;
            });
          }
        }
      });

      // Special thrusters for flying characters (Doctor Doom)
      if (char.canFly) {
        state.thrusterGroup = createFlightThrusters();
        rootGroup.add(state.thrusterGroup);
      }

      rootGroup.add(model);
      state.character = rootGroup;
      scene.add(state.character);

      // Animation Setup
      state.mixer = new THREE.AnimationMixer(model);
      const clips = gltf.animations;

      if (clips && clips.length > 0) {
        for (const [key, clipName] of Object.entries(char.anims)) {
          const clip = clips.find(c => c.name === clipName);
          if (clip) {
            state.actions[key] = state.mixer.clipAction(clip);
          }
        }

        // Jump & Attack play once and clamp at final frame (no bind pose flicker)
        if (state.actions['jump']) {
          state.actions['jump'].setLoop(THREE.LoopOnce, 1);
          state.actions['jump'].clampWhenFinished = true;
        }
        if (state.actions['attack']) {
          state.actions['attack'].setLoop(THREE.LoopOnce, 1);
          state.actions['attack'].clampWhenFinished = true;
        }
        // Flight animations loop continuously
        ['fly_idle', 'fly_slow', 'fly_fast'].forEach(k => {
          if (state.actions[k]) {
            state.actions[k].setLoop(THREE.LoopRepeat);
          }
        });

        // Start in idle
        state.currentAction = state.actions['idle'] || Object.values(state.actions)[0];
        state.currentAction.play();
        state.currentAnimName = 'idle';
      }

      state.isLoaded = true;
      state.isAttacking = false;
      state.attackTimer = 0;

      // Update operator modal UI if open
      renderOperatorRoster();

      // Hide loading screen
      if (loadingProgress) loadingProgress.style.width = '100%';
      setTimeout(() => {
        if (loadingScreen) {
          loadingScreen.style.opacity = '0';
          setTimeout(() => {
            loadingScreen.style.display = 'none';
          }, 400);
        }
      }, 300);
    },
    (xhr) => {
      if (xhr.total > 0 && loadingProgress) {
        const pct = Math.round((xhr.loaded / xhr.total) * 100);
        loadingProgress.style.width = `${pct}%`;
      }
    },
    (err) => {
      console.error(`Failed to load ${char.file}:`, err);
      if (loadingScreen) {
        loadingScreen.innerHTML = `<div style="color:#ef4444;font-weight:600;">Gagal memuat ${char.name}: ${err.message}</div>`;
      }
    }
  );
}

/* ==========================================================================
   ANIMATION TRANSITION HELPER (SMOOTH CROSSFADE - NO BIND POSE)
   ========================================================================== */
function switchAnimation(name, duration = 0.2) {
  if (state.currentAnimName === name || !state.actions[name]) return;

  const prev = state.currentAction;
  const next = state.actions[name];

  state.currentAnimName = name;
  state.currentAction = next;

  if (prev && prev !== next) {
    // Reset and enable target action
    next.reset();
    next.enabled = true;
    next.setEffectiveTimeScale(1);
    next.setEffectiveWeight(1);
    next.play();

    // Smoothly cross-fade from previous action
    prev.crossFadeTo(next, duration, true);
  } else {
    next.reset();
    next.enabled = true;
    next.setEffectiveTimeScale(1);
    next.setEffectiveWeight(1);
    next.play();
  }
}

/* ==========================================================================
   INPUT HANDLING (KEYBOARD & MOUSE)
   ========================================================================== */
function handleSpacePress() {
  const now = performance.now() / 1000;
  const char = CHARACTERS[state.currentCharId];

  // Special double-space flight skill (Doctor Doom)
  if (char && char.canFly) {
    if (now - state.lastSpaceTime < 0.40) {
      // Double Space detected! Toggle flight
      toggleFlight();
      state.lastSpaceTime = 0;
      return;
    }
    state.lastSpaceTime = now;
  }

  // Standard jump if not flying
  if (!state.isFlying) {
    triggerJump();
  }
}

window.addEventListener('keydown', (e) => {
  initAudio();
  const k = e.key.toLowerCase();

  if (k === 'w') keys.w = true;
  if (k === 'a') keys.a = true;
  if (k === 's') keys.s = true;
  if (k === 'd') keys.d = true;
  if (k === 'x') keys.x = true;
  if (e.key === 'Control') keys.control = true;
  if (e.shiftKey) keys.shift = true;
  if (e.code === 'Space') {
    e.preventDefault();
    keys.space = true;
    if (!e.repeat) {
      handleSpacePress();
    }
  }
  if (k === 'r') {
    resetCharacterPosition();
  }
  if (k === 't') {
    toggleDayNight();
  }
  if (k === 'c') {
    toggleCharModal();
  }
  if (e.key === 'Escape') {
    closeCharModal();
  }
  if (k === 'j') {
    triggerAttack();
  }
});

window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'w') keys.w = false;
  if (k === 'a') keys.a = false;
  if (k === 's') keys.s = false;
  if (k === 'd') keys.d = false;
  if (k === 'x') keys.x = false;
  if (e.key === 'Control') keys.control = false;
  if (e.code === 'Space') keys.space = false;
  if (!e.shiftKey) keys.shift = false;
});

// Clear keys when window loses focus (Mencegah karakter jalan sendiri saat Alt+Tab)
window.addEventListener('blur', () => {
  keys.w = false;
  keys.a = false;
  keys.s = false;
  keys.d = false;
  keys.x = false;
  keys.control = false;
  keys.shift = false;
  keys.space = false;
  state.isMouseDown = false;
});

// Pointer Lock Controls (Genshin Native PC style)
canvas.addEventListener('click', () => {
  initAudio();
  if (!state.isPointerLocked) {
    canvas.requestPointerLock();
  } else if (!state.isAttacking) {
    triggerAttack();
  }
});

document.addEventListener('pointerlockchange', () => {
  state.isPointerLocked = (document.pointerLockElement === canvas);
  document.body.classList.toggle('pointer-locked', state.isPointerLocked);
});

// Mouse Movement for Camera Orbit
window.addEventListener('mousemove', (e) => {
  const sensitivity = 0.003;

  if (state.isPointerLocked) {
    state.yaw -= e.movementX * sensitivity;
    state.pitch += e.movementY * sensitivity;
  } else if (state.isMouseDown) {
    const dx = e.clientX - state.lastMouseX;
    const dy = e.clientY - state.lastMouseY;
    state.yaw -= dx * sensitivity;
    state.pitch += dy * sensitivity;
    state.lastMouseX = e.clientX;
    state.lastMouseY = e.clientY;
  }

  // Clamp vertical pitch (Genshin: can't look completely upside down)
  state.pitch = THREE.MathUtils.clamp(state.pitch, -0.15, 1.25);
});

// Fallback click-and-drag camera control
canvas.addEventListener('mousedown', (e) => {
  if (!state.isPointerLocked) {
    state.isMouseDown = true;
    state.lastMouseX = e.clientX;
    state.lastMouseY = e.clientY;
  }
});

window.addEventListener('mouseup', () => {
  state.isMouseDown = false;
});

// Mouse Scroll Zoom
window.addEventListener('wheel', (e) => {
  state.distance = THREE.MathUtils.clamp(
    state.distance + e.deltaY * 0.003,
    state.minDistance,
    state.maxDistance
  );
}, { passive: true });

// Jump Action dengan Cooldown 0.5 Detik setelah menyentuh tanah
function triggerJump() {
  if (state.isGrounded && state.jumpCooldown <= 0 && !state.isAttacking) {
    state.vel.y = 8.2;
    state.isGrounded = false;
    state.jumpCooldown = state.jumpCooldownDuration;
    switchAnimation('jump', 0.15);
    playJumpSound();
  }
}

// Attack Action (Combo strike / burst fire)
function triggerAttack() {
  const char = CHARACTERS[state.currentCharId] || CHARACTERS.shiroko;
  if (state.actions['attack'] && !state.isAttacking && state.isGrounded && state.attackCooldown <= 0) {
    state.isAttacking = true;
    state.attackTimer = 0;
    state.attackCooldown = char.attackCooldown || 0.55;

    // Hadapkan karakter ke arah bidikan kamera secara presisi
    state.targetRotation = Math.atan2(-Math.sin(state.yaw), -Math.cos(state.yaw));
    if (state.character) {
      state.character.rotation.y = state.targetRotation;
    }

    // Kurangi geseran horizontal saat menembak
    state.vel.x *= 0.15;
    state.vel.z *= 0.15;

    switchAnimation('attack', 0.1);
    playAttackSound();
  }
}

// Reset Position
function resetCharacterPosition() {
  if (state.isFlying) {
    exitFlight();
  }
  state.pos.set(0, 0.1, 0);
  state.vel.set(0, 0, 0);
  state.targetRotation = Math.PI;
  state.jumpCooldown = 0;
  state.isAttacking = false;
  state.attackTimer = 0;
  if (state.character) {
    state.character.position.copy(state.pos);
    state.character.rotation.y = Math.PI;
  }
}

/* ==========================================================================
   ARKNIGHTS: ENDFIELD OPERATOR MODAL SYSTEM
   ========================================================================== */
function renderOperatorRoster() {
  if (!operatorList) return;
  operatorList.innerHTML = '';

  Object.values(CHARACTERS).forEach((char) => {
    const isActive = state.currentCharId === char.id;
    const card = document.createElement('div');
    card.className = `operator-card ${isActive ? 'active' : ''}`;

    const specHtml = Object.entries(char.specs).map(([k, v]) => `
      <div class="spec-item">
        <span class="spec-k">${k}</span>
        <span class="spec-v">${v}</span>
      </div>
    `).join('');

    card.innerHTML = `
      <div class="card-header-row">
        <span class="operator-code">${char.code}</span>
        <span class="operator-status-badge">${isActive ? '● DEPLOYED' : 'STANDBY'}</span>
      </div>
      <div class="operator-body">
        <div class="operator-avatar-box ${char.avatarClass}">
          ${char.avatarLetter}
        </div>
        <div class="operator-details">
          <div class="operator-name">${char.name}</div>
          <div class="operator-role">${char.role}</div>
          <div class="operator-sub">${char.sub}</div>
        </div>
      </div>
      <div class="operator-specs">
        ${specHtml}
      </div>
      <button class="btn-deploy">
        <span>${isActive ? 'CURRENT ACTIVE OPERATOR' : 'DEPLOY OPERATOR'}</span>
        <span style="font-size: 14px;">→</span>
      </button>
    `;

    card.addEventListener('click', () => {
      switchCharacter(char.id);
    });

    operatorList.appendChild(card);
  });
}

function openCharModal() {
  if (document.pointerLockElement) {
    document.exitPointerLock();
  }
  renderOperatorRoster();
  if (charModal) charModal.classList.remove('hidden');
  playDeploySound();
}

function closeCharModal() {
  if (charModal) charModal.classList.add('hidden');
}

function toggleCharModal() {
  if (!charModal) return;
  if (charModal.classList.contains('hidden')) {
    openCharModal();
  } else {
    closeCharModal();
  }
}

function switchCharacter(charId) {
  if (state.currentCharId === charId && state.character) {
    closeCharModal();
    return;
  }
  if (state.isFlying) {
    exitFlight();
  }
  closeCharModal();
  playDeploySound();
  loadCharacter(charId);
}

if (btnCharMenu) {
  btnCharMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    openCharModal();
  });
}

if (btnCloseModal) {
  btnCloseModal.addEventListener('click', (e) => {
    e.stopPropagation();
    closeCharModal();
  });
}

if (charModal) {
  charModal.addEventListener('click', (e) => {
    if (e.target === charModal) {
      closeCharModal();
    }
  });
}

// Day / Sunset toggle (Tombol 'T')
function toggleDayNight() {
  state.isSunset = !state.isSunset;
  if (state.isSunset) {
    scene.background.set(bgSunset);
    scene.fog.color.set(bgSunset);
    sunLight.color.set(0xfb923c);
    sunLight.intensity = 1.4;
    hemiLight.color.set(0xfef08a);
  } else {
    scene.background.set(bgDay);
    scene.fog.color.set(bgDay);
    sunLight.color.set(0xfff8ee);
    sunLight.intensity = 1.8;
    hemiLight.color.set(0xffffff);
  }
}

/* ==========================================================================
   GENSHIN THIRD-PERSON CAMERA CONTROLLER
   ========================================================================== */
const cameraTarget = new THREE.Vector3();
const desiredCameraPos = new THREE.Vector3();

function updateCamera(dt) {
  if (!state.character) return;

  const char = CHARACTERS[state.currentCharId] || CHARACTERS.shiroko;

  // Camera focuses on character's chest/head height
  const focusHeight = char.cameraHeight || 0.85;
  const targetPos = state.pos.clone().add(new THREE.Vector3(0, focusHeight, 0));

  // Compute orbital spherical position
  const cosPitch = Math.cos(state.pitch);
  const sinPitch = Math.sin(state.pitch);
  const sinYaw = Math.sin(state.yaw);
  const cosYaw = Math.cos(state.yaw);

  const offsetX = state.distance * sinYaw * cosPitch;
  const offsetY = state.distance * sinPitch;
  const offsetZ = state.distance * cosYaw * cosPitch;

  // Camera occlusion / collision avoidance against platform boxes
  let actualDist = state.distance;
  const camDir = new THREE.Vector3(offsetX, offsetY, offsetZ).normalize();
  const ray = new THREE.Ray(targetPos, camDir);

  for (const col of state.colliders) {
    if (col.isFloor) continue;
    const box = new THREE.Box3(
      new THREE.Vector3(col.minX, col.minY, col.minZ),
      new THREE.Vector3(col.maxX, col.maxY, col.maxZ)
    );
    box.expandByScalar(0.2); // camera collision padding
    const hit = ray.intersectBox(box, new THREE.Vector3());
    if (hit) {
      const d = targetPos.distanceTo(hit);
      if (d < actualDist && d > 0.4) {
        actualDist = d;
      }
    }
  }

  desiredCameraPos.set(
    targetPos.x + camDir.x * actualDist,
    targetPos.y + camDir.y * actualDist,
    targetPos.z + camDir.z * actualDist
  );

  // Prevent camera from dipping beneath the ground floor
  if (desiredCameraPos.y < 0.25) {
    desiredCameraPos.y = 0.25;
  }

  // Smooth camera following (Damping)
  camera.position.lerp(desiredCameraPos, Math.min(1.0, 14 * dt));
  cameraTarget.lerp(targetPos, Math.min(1.0, 16 * dt));
  camera.lookAt(cameraTarget);
}

/* ==========================================================================
   PHYSICS & COLLISION SYSTEM
   ========================================================================== */
function resolveCollisions(pos, vel, dt) {
  const charRadius = 0.28;
  let onGround = false;

  for (const col of state.colliders) {
    // Check if within horizontal bounds
    const inX = (pos.x + charRadius > col.minX) && (pos.x - charRadius < col.maxX);
    const inZ = (pos.z + charRadius > col.minZ) && (pos.z - charRadius < col.maxZ);

    if (inX && inZ) {
      // Landing on top surface
      const feetY = pos.y;
      const topY = col.maxY;

      // If feet are just above or slightly penetrated into top surface
      if (feetY >= topY - 0.35 && feetY <= topY + 0.35 && vel.y <= 0) {
        pos.y = topY;
        vel.y = 0;
        onGround = true;
        if (state.isFlying && (keys.x || keys.control || vel.y <= 0)) {
          exitFlight();
        }
      } else if (!col.isFloor && pos.y < topY && pos.y + 1.2 > col.minY) {
        // Horizontal pushback from box sides
        const distMinX = Math.abs((pos.x + charRadius) - col.minX);
        const distMaxX = Math.abs((pos.x - charRadius) - col.maxX);
        const distMinZ = Math.abs((pos.z + charRadius) - col.minZ);
        const distMaxZ = Math.abs((pos.z - charRadius) - col.maxZ);

        const minDist = Math.min(distMinX, distMaxX, distMinZ, distMaxZ);

        if (minDist === distMinX) pos.x = col.minX - charRadius;
        else if (minDist === distMaxX) pos.x = col.maxX + charRadius;
        else if (minDist === distMinZ) pos.z = col.minZ - charRadius;
        else if (minDist === distMaxZ) pos.z = col.maxZ + charRadius;
      }
    }
  }

  // Landing & Ground Cooldown Logic
  if (!state.isGrounded && onGround) {
    // Baru saja mendarat di tanah/platform dari udara -> pasang cooldown 0.5s
    state.jumpCooldown = state.jumpCooldownDuration;
  }

  state.isGrounded = onGround;
}

/* ==========================================================================
   CHARACTER CONTROLLER (WASD RELATIVE TO CAMERA)
   ========================================================================== */
let stepTimer = 0;

function updateCharacter(dt) {
  if (!state.character || !state.isLoaded) return;

  const char = CHARACTERS[state.currentCharId] || CHARACTERS.shiroko;

  // Countdown cooldown lompat setelah mendarat
  if (state.jumpCooldown > 0) {
    state.jumpCooldown -= dt;
  }

  // -----------------------------------------------------------
  // FLIGHT CONTROLLER (Doctor Doom Special Skill)
  // -----------------------------------------------------------
  if (state.isFlying) {
    const camForward = new THREE.Vector3(-Math.sin(state.yaw), 0, -Math.cos(state.yaw)).normalize();
    const camRight = new THREE.Vector3(Math.cos(state.yaw), 0, -Math.sin(state.yaw)).normalize();

    const moveDir = new THREE.Vector3();
    if (keys.w) moveDir.add(camForward);
    if (keys.s) moveDir.sub(camForward);
    if (keys.d) moveDir.add(camRight);
    if (keys.a) moveDir.sub(camRight);

    const hasInput = moveDir.lengthSq() > 0.001;

    // Flight Speed & Boost
    const isBoost = keys.shift && state.stamina > 5;
    const flySpeed = isBoost ? 11.5 : 6.2;
    const accel = 18;
    const friction = 8;

    if (isBoost && hasInput) {
      state.stamina = Math.max(0, state.stamina - 20 * dt);
    } else {
      state.stamina = Math.min(state.maxStamina, state.stamina + 18 * dt);
    }

    if (hasInput && !state.isAttacking) {
      moveDir.normalize();
      state.vel.x += (moveDir.x * flySpeed - state.vel.x) * Math.min(1.0, accel * dt);
      state.vel.z += (moveDir.z * flySpeed - state.vel.z) * Math.min(1.0, accel * dt);
      state.targetRotation = Math.atan2(moveDir.x, moveDir.z);
    } else {
      state.vel.x += (0 - state.vel.x) * Math.min(1.0, friction * dt);
      state.vel.z += (0 - state.vel.z) * Math.min(1.0, friction * dt);
    }

    // Vertical flight motion: Space ascends, X or Ctrl descends, else hover with gentle damping
    const vertSpeed = 5.5;
    if (keys.space) {
      state.vel.y += (vertSpeed - state.vel.y) * Math.min(1.0, 12 * dt);
    } else if (keys.x || keys.control) {
      state.vel.y += (-vertSpeed - state.vel.y) * Math.min(1.0, 12 * dt);
    } else {
      // Gentle damping to hover
      state.vel.y += (0 - state.vel.y) * Math.min(1.0, 8 * dt);
    }

    // Smooth rotation towards targetAngle
    const currentRotY = state.character.rotation.y;
    let diff = state.targetRotation - currentRotY;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    state.character.rotation.y += diff * Math.min(1.0, 16 * dt);

    // Apply velocities
    state.pos.x += state.vel.x * dt;
    state.pos.z += state.vel.z * dt;
    state.pos.y += state.vel.y * dt;

    // Platform collisions
    resolveCollisions(state.pos, state.vel, dt);

    // Fallback if below map
    if (state.pos.y < -15) resetCharacterPosition();

    // Sync mesh position
    state.character.position.copy(state.pos);

    // Thruster visual effects update
    if (state.thrusterGroup) {
      const leftRing = state.thrusterGroup.children[0];
      const rightRing = state.thrusterGroup.children[1];
      const seal = state.thrusterGroup.children[2];
      if (leftRing) leftRing.rotation.z += 0.08;
      if (rightRing) rightRing.rotation.z -= 0.08;
      if (seal) seal.rotation.z += 0.03;
      const pulse = 1.0 + Math.sin(clock.getElapsedTime() * 10) * 0.12;
      state.thrusterGroup.scale.set(pulse, 1, pulse);
    }

    // Flight animation handling
    if (!state.isAttacking) {
      if (hasInput) {
        if (isBoost && state.actions['fly_fast']) {
          switchAnimation('fly_fast', 0.2);
        } else if (state.actions['fly_slow']) {
          switchAnimation('fly_slow', 0.2);
        }
      } else {
        if (state.actions['fly_idle']) {
          switchAnimation('fly_idle', 0.25);
        }
      }
    } else {
      // Attack handling while flying
      state.attackTimer += dt;
      const cancelT = char.attackCancelTime || 0.40;
      const recoverT = char.attackRecoverTime || 0.72;
      if (hasInput && state.attackTimer >= cancelT) {
        state.isAttacking = false;
        switchAnimation(isBoost ? 'fly_fast' : 'fly_slow', 0.2);
      } else if (state.attackTimer >= recoverT) {
        state.isAttacking = false;
        switchAnimation(hasInput ? (isBoost ? 'fly_fast' : 'fly_slow') : 'fly_idle', 0.2);
      }
    }

    return;
  }

  // 1. Calculate Camera-Relative Movement Vector
  // Forward is away from camera horizontally
  const camForward = new THREE.Vector3(-Math.sin(state.yaw), 0, -Math.cos(state.yaw)).normalize();
  const camRight = new THREE.Vector3(Math.cos(state.yaw), 0, -Math.sin(state.yaw)).normalize();

  const moveDir = new THREE.Vector3();
  if (keys.w) moveDir.add(camForward);
  if (keys.s) moveDir.sub(camForward);
  if (keys.d) moveDir.add(camRight);
  if (keys.a) moveDir.sub(camRight);

  const hasInput = moveDir.lengthSq() > 0.001;

  // 2. Sprint & Stamina Logic
  if (hasInput && keys.shift && state.stamina > 5) {
    state.isSprinting = true;
    state.stamina = Math.max(0, state.stamina - 24 * dt);
  } else {
    state.isSprinting = false;
    state.stamina = Math.min(state.maxStamina, state.stamina + 22 * dt);
  }

  // 3. Movement Speeds & Acceleration
  const baseSpeed = state.isSprinting ? 6.8 : 3.8;
  const accel = state.isGrounded ? 28 : 10;
  const friction = state.isGrounded ? 18 : 2;

  if (hasInput && !state.isAttacking) {
    moveDir.normalize();

    // Accelerate towards moveDir
    state.vel.x += (moveDir.x * baseSpeed - state.vel.x) * Math.min(1.0, accel * dt);
    state.vel.z += (moveDir.z * baseSpeed - state.vel.z) * Math.min(1.0, accel * dt);

    // Smoothly rotate character to face movement direction
    state.targetRotation = Math.atan2(moveDir.x, moveDir.z);

    // Footstep audio
    stepTimer += dt * (state.isSprinting ? 1.6 : 1.0);
    if (stepTimer > 0.32 && state.isGrounded) {
      playStepSound();
      stepTimer = 0;
    }
  } else {
    // Decelerate / friction
    state.vel.x += (0 - state.vel.x) * Math.min(1.0, friction * dt);
    state.vel.z += (0 - state.vel.z) * Math.min(1.0, friction * dt);
  }

  // Smooth character rotation towards targetAngle
  const currentRotY = state.character.rotation.y;
  let diff = state.targetRotation - currentRotY;
  // Shortest angular path
  while (diff < -Math.PI) diff += Math.PI * 2;
  while (diff > Math.PI) diff -= Math.PI * 2;
  state.character.rotation.y += diff * Math.min(1.0, 16 * dt);

  // 4. Gravity & Vertical Physics
  const gravity = -22.0;
  state.vel.y += gravity * dt;

  // Apply horizontal velocity
  state.pos.x += state.vel.x * dt;
  state.pos.z += state.vel.z * dt;
  state.pos.y += state.vel.y * dt;

  // 5. Collisions & Platform Snap
  resolveCollisions(state.pos, state.vel, dt);

  // Fallback if character falls below map
  if (state.pos.y < -15) {
    resetCharacterPosition();
  }

  // Sync mesh position
  state.character.position.copy(state.pos);

  // 6. Animation State Transitions & Attack Recovery
  const horizSpeed = Math.sqrt(state.vel.x * state.vel.x + state.vel.z * state.vel.z);

  // Attack timer & recovery handling
  if (state.attackCooldown > 0) {
    state.attackCooldown -= dt;
  }

  if (state.isAttacking) {
    state.attackTimer += dt;

    const cancelT = char.attackCancelTime || 0.38;
    const recoverT = char.attackRecoverTime || 0.68;

    // Action Canceling: Jika pemain menekan WASD setelah burst tembakan, batalkan recovery langsung ke lari
    if (hasInput && state.attackTimer >= cancelT) {
      state.isAttacking = false;
      switchAnimation('run', 0.2);
    } else if (state.attackTimer >= recoverT) {
      // Selesai menembak secara alami: transisi halus ke idle atau run tanpa ada bind-pose flicker
      state.isAttacking = false;
      switchAnimation(hasInput ? 'run' : 'idle', 0.22);
    }
  } else {
    // Normal locomotion transitions
    if (!state.isGrounded) {
      if (state.currentAnimName !== 'jump') {
        switchAnimation('jump', 0.15);
      }
    } else if (horizSpeed > 0.25) {
      if (state.currentAnimName !== 'run') {
        switchAnimation('run', 0.2);
      }
      // Speed up animation playback when sprinting
      if (state.actions['run']) {
        state.actions['run'].timeScale = state.isSprinting ? 1.4 : 1.0;
      }
    } else {
      if (state.currentAnimName !== 'idle') {
        switchAnimation('idle', 0.25);
      }
    }
  }
}

/* ==========================================================================
   UPDATE CRYSTALS & FLOATING OBJECTS
   ========================================================================== */
function updateCrystals(time) {
  for (const c of state.crystals) {
    c.mesh.rotation.y += 0.03;
    c.mesh.rotation.x = Math.sin(time * 2 + c.seed) * 0.15;
    c.mesh.position.y = c.baseY + Math.sin(time * 3 + c.seed) * 0.15;

    // Proximity touch check
    if (state.pos.distanceTo(c.mesh.position) < 1.2) {
      c.mesh.rotation.y += 0.2;
    }
  }
}


/* ==========================================================================
   MAIN RENDER LOOP
   ========================================================================== */
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.1);
  const elapsed = clock.getElapsedTime();

  // Animation mixer update
  if (state.mixer) {
    state.mixer.update(dt);
  }

  // Character movement & physics
  updateCharacter(dt);

  // Third-person camera tracking
  updateCamera(dt);

  // Environment elements
  updateCrystals(elapsed);

  // Render 3D Scene
  renderer.render(scene, camera);
}

// Window Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Initialization
buildDevWorld();
loadCharacter();
animate();

// Debug / Inspection API
window.__gameState = state;
window.__gameScene = scene;
window.__gameCamera = camera;
window.__switchCharacter = switchCharacter;
