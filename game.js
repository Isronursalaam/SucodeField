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
  thrusterGroup: null,

  // Intro Elevator & Operator Selection Cutscene State
  introActive: true,
  introState: 'overview', // 'overview', 'shiroko', 'drdoom', 'deploying'
  introSelectedCharId: null,
  mouseNorm: new THREE.Vector2(0, 0)
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

function playSelectChime() {
  if (!audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.12); // A5
    gain.gain.setValueAtTime(0.14, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.14);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.14);
  } catch (e) {}
}

function playElevatorDing() {
  if (!audioCtx) return;
  try {
    const now = audioCtx.currentTime;
    [
      { freq: 587.33, time: now, dur: 0.9 }, // D5
      { freq: 880.00, time: now + 0.12, dur: 1.3 } // A5 chime
    ].forEach(note => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note.freq, note.time);
      gain.gain.setValueAtTime(0.18, note.time);
      gain.gain.exponentialRampToValueAtTime(0.001, note.time + note.dur);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(note.time);
      osc.stop(note.time + note.dur);
    });
  } catch (e) {}
}

function playDockingSound() {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const t = audioCtx.currentTime;
  try {
    // 1. Heavy low mechanical arrestor thud
    const osc = audioCtx.createOscillator();
    const oscGain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(32, t + 0.35);
    oscGain.gain.setValueAtTime(0.35, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(oscGain);
    oscGain.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.35);

    // 2. Metallic latch / clank
    const bufSize = Math.floor(audioCtx.sampleRate * 0.12);
    const buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (audioCtx.sampleRate * 0.02));
    }
    const noise = audioCtx.createBufferSource();
    noise.buffer = buf;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, t);
    filter.Q.setValueAtTime(3, t);
    const nGain = audioCtx.createGain();
    nGain.gain.setValueAtTime(0.25, t);
    nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(audioCtx.destination);
    noise.start(t);
  } catch (e) {}
}

function playDoorOpenSound() {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const t = audioCtx.currentTime;
  try {
    // 1. Pressurized pneumatic release hiss (Psssshh)
    const bufSize = Math.floor(audioCtx.sampleRate * 0.85);
    const buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (audioCtx.sampleRate * 0.28));
    }
    const noise = audioCtx.createBufferSource();
    noise.buffer = buf;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3200, t);
    filter.frequency.exponentialRampToValueAtTime(650, t + 0.7);
    const nGain = audioCtx.createGain();
    nGain.gain.setValueAtTime(0.28, t);
    nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.85);
    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(audioCtx.destination);
    noise.start(t);

    // 2. Heavy mechanical servo / rail slide hum
    const osc = audioCtx.createOscillator();
    const oscGain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(95, t);
    osc.frequency.linearRampToValueAtTime(140, t + 0.4);
    osc.frequency.linearRampToValueAtTime(60, t + 0.9);
    const oFilter = audioCtx.createBiquadFilter();
    oFilter.type = 'lowpass';
    oFilter.frequency.setValueAtTime(380, t);
    oscGain.gain.setValueAtTime(0.08, t);
    oscGain.gain.linearRampToValueAtTime(0.12, t + 0.3);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    osc.connect(oFilter);
    oFilter.connect(oscGain);
    oscGain.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.9);
  } catch (e) {}
}

function playDoorCloseSound() {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const t = audioCtx.currentTime;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.25);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.25);
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
let devWorldGroup = null;

function buildDevWorld() {
  devWorldGroup = new THREE.Group();

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
  devWorldGroup.add(floor);

  // Add floor to colliders
  state.colliders.push({
    minX: -80, maxX: 80,
    minY: -0.1, maxY: 0,
    minZ: -80, maxZ: 80,
    isFloor: true
  });

  // Spawn Ring Marker (Positioned at arena landing point Z = 3.2 to eliminate Z-fighting under lift)
  const ringGeo = new THREE.RingGeometry(1.4, 1.5, 32);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x0284c7, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(0, 0.01, 3.2);
  devWorldGroup.add(ring);

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
    devWorldGroup.add(mesh);

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
    devWorldGroup.add(crystal);
    state.crystals.push({ mesh: crystal, baseY: y, seed: Math.random() * 10 });
  }

  addEnergyCrystal(6, 2.8, -17.5);
  addEnergyCrystal(16, 2.1, 4);
  addEnergyCrystal(-14, 3.6, 17);
  addEnergyCrystal(0, 1.0, -8);

  // Hide the outdoor dev arena during intro elevator ascent to eliminate Z-fighting flicker
  devWorldGroup.visible = !state.introActive;
  scene.add(devWorldGroup);
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

    // Smoothly cross-fade from previous action (warp = false prevents bind pose / T-pose glitches)
    prev.crossFadeTo(next, duration, false);
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

  // Intro Cutscene Shortcuts
  if (state.introActive) {
    if (state.introState === 'deploying') {
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') {
        skipIntroToGameplay();
      }
      return;
    }
    if (e.key === 'Escape') {
      returnToIntroOverview();
    } else if (e.key === 'Enter') {
      if (state.introSelectedCharId) {
        // Konfirmasi (YA) dan mulai proses lift berhenti & keluar
        deployOperator(state.introSelectedCharId);
      } else {
        // Default pilih operator kiri (Shiroko) untuk konfirmasi
        selectIntroOperator('shiroko');
      }
    } else if (e.key === '1') {
      selectIntroOperator('shiroko');
    } else if (e.key === '2') {
      selectIntroOperator('drdoom');
    }
    return;
  }

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

// Pointer Lock & Character Click Controls
canvas.addEventListener('click', (e) => {
  initAudio();
  if (state.introActive) {
    handleIntroClick(e);
    return;
  }
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

// Mouse Movement for Camera Orbit & Intro Parallax
window.addEventListener('mousemove', (e) => {
  if (state.introActive) {
    handleIntroMouseMove(e);
    return;
  }

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
  if (state.introActive) return;
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
  if (state.introActive) return;
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
  state.pos.set(0, 0.1, 3.2);
  state.vel.set(0, 0, 0);
  state.targetRotation = 0;
  state.jumpCooldown = 0;
  state.isAttacking = false;
  state.attackTimer = 0;
  if (state.character) {
    state.character.position.copy(state.pos);
    state.character.rotation.y = 0;
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

  const nextChar = CHARACTERS[charId] || CHARACTERS.shiroko;
  const nextCharData = loadedCharacters[charId];

  if (nextCharData && nextCharData.rootGroup) {
    // Remove previous character from scene
    if (state.character) {
      scene.remove(state.character);
    }

    state.currentCharId = charId;
    state.character = nextCharData.rootGroup;
    state.character.position.copy(state.pos);
    state.character.rotation.y = state.targetRotation;
    scene.add(state.character);

    state.mixer = nextCharData.mixer;
    state.actions = nextCharData.actions;
    state.isAttacking = false;
    state.attackTimer = 0;

    if (nextChar.canFly) {
      state.thrusterGroup = nextCharData.rootGroup.userData.thrusterGroup;
    } else {
      state.thrusterGroup = null;
    }
    state.isFlying = false;
    updateFlightHud();

    switchAnimation('idle', 0.2);
    renderOperatorRoster();
  } else {
    loadCharacter(charId);
  }
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
   INTRO ELEVATOR CUTSCENE & CHARACTER SELECTION SYSTEM
   ========================================================================== */
const loadedCharacters = {
  shiroko: null,
  drdoom: null
};

let elevatorGroup = null;
let ascentEffectsGroup = null;
let whoAreYouMesh = null;

// Camera Animation Vectors
const introCamPos = new THREE.Vector3(0, 1.30, 3.35);
const introCamLook = new THREE.Vector3(0, 1.10, 0);
const raycaster = new THREE.Raycaster();

// 1. Procedural Hazard Stripe Texture
function createHazardStripeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#0f172a';
  const stripeW = 16;
  for (let x = -32; x < canvas.width + 32; x += stripeW * 2) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + stripeW, 0);
    ctx.lineTo(x + stripeW - 14, canvas.height);
    ctx.lineTo(x - 14, canvas.height);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10, 1);
  return tex;
}

// 2. 3D "WHO ARE YOU?" Floating Tech Typography (Arknights: Endfield Style)
function createWhoAreYouMesh() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Soft atmospheric glow for tech typography
  ctx.shadowColor = 'rgba(255, 255, 255, 0.75)';
  ctx.shadowBlur = 22;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // 1. Top Subtitle (Tech Protocol Header)
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 42px "JetBrains Mono", monospace';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.letterSpacing = '8px';
  ctx.fillText('OPERATOR SELECTION', canvas.width / 2, 280);

  // 2. Main Title: WHO ARE YOU? (Bold, Crisp White with Question Mark)
  ctx.font = '900 172px "Outfit", -apple-system, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.letterSpacing = '12px';
  ctx.fillText('WHO ARE YOU?', canvas.width / 2, 430);

  // 3. Central Tech Reticle / Verification Badge (between characters)
  ctx.shadowBlur = 12;
  ctx.font = '600 36px "JetBrains Mono", monospace';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.letterSpacing = '4px';
  ctx.fillText('◇  Verify Identity  ◇', canvas.width / 2, 600);

  // 4. Subtle tech targeting corner brackets around characters (as seen in Endfield reference)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 3.5;
  ctx.shadowBlur = 0;

  const drawBrackets = (cx, cy, w, h, len) => {
    // Top-left
    ctx.beginPath(); ctx.moveTo(cx - w/2, cy - h/2 + len); ctx.lineTo(cx - w/2, cy - h/2); ctx.lineTo(cx - w/2 + len, cy - h/2); ctx.stroke();
    // Top-right
    ctx.beginPath(); ctx.moveTo(cx + w/2 - len, cy - h/2); ctx.lineTo(cx + w/2, cy - h/2); ctx.lineTo(cx + w/2, cy - h/2 + len); ctx.stroke();
    // Bottom-left
    ctx.beginPath(); ctx.moveTo(cx - w/2, cy + h/2 - len); ctx.lineTo(cx - w/2, cy + h/2); ctx.lineTo(cx - w/2 + len, cy + h/2); ctx.stroke();
    // Bottom-right
    ctx.beginPath(); ctx.moveTo(cx + w/2 - len, cy + h/2); ctx.lineTo(cx + w/2, cy + h/2); ctx.lineTo(cx + w/2, cy + h/2 - len); ctx.stroke();
  };

  // Left operator targeting bracket (Shiroko)
  drawBrackets(canvas.width * 0.28, 580, 380, 680, 32);
  // Right operator targeting bracket (Doctor Doom)
  drawBrackets(canvas.width * 0.72, 580, 380, 680, 32);

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  texture.needsUpdate = true;

  const geo = new THREE.PlaneGeometry(3.6, 1.8);
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, 1.45, -0.45);
  return mesh;
}

// 3. 3D High-Tech Open-Air Industrial Elevator (Arknights: Endfield Style)
function createElevatorGroup() {
  const liftGroup = new THREE.Group();

  // Materials
  const platformDeckMat = new THREE.MeshStandardMaterial({
    color: 0x141b24,
    roughness: 0.45,
    metalness: 0.75,
    polygonOffset: true,
    polygonOffsetFactor: -1.0,
    polygonOffsetUnits: -1.0
  });

  const yellowCurbMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15, // Iconic vibrant safety yellow from Endfield
    roughness: 0.35,
    metalness: 0.2
  });

  const darkRigMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.4,
    metalness: 0.9
  });

  const cableWireMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.25,
    metalness: 0.95
  });

  const boltCapMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.3,
    metalness: 0.5
  });

  // 1. Platform Deck (3.6m wide x 2.6m deep) - top surface at Y = +0.02 eliminates coplanar Z-fighting with arena ground (Y = 0)
  const floorGeo = new THREE.BoxGeometry(3.6, 0.20, 2.6);
  const floorMesh = new THREE.Mesh(floorGeo, platformDeckMat);
  floorMesh.position.y = -0.08;
  floorMesh.receiveShadow = true;
  liftGroup.add(floorMesh);

  // Recessed center panel
  const centerPanel = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 0.02, 2.2),
    new THREE.MeshStandardMaterial({
      color: 0x0a0f16,
      roughness: 0.6,
      metalness: 0.6,
      polygonOffset: true,
      polygonOffsetFactor: -2.0,
      polygonOffsetUnits: -3.0
    })
  );
  centerPanel.position.set(0, 0.025, 0);
  centerPanel.receiveShadow = true;
  liftGroup.add(centerPanel);

  // Industrial Beveled Threshold Plate at elevator doorway (Z = 1.30)
  // Seamlessly ramps down from elevator deck Y = +0.02 to arena ground Y = 0.0
  const thresholdMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.5,
    metalness: 0.8,
    polygonOffset: true,
    polygonOffsetFactor: -1.0,
    polygonOffsetUnits: -1.0
  });
  const thresholdRamp = new THREE.Mesh(new THREE.BoxGeometry(2.56, 0.02, 0.16), thresholdMat);
  thresholdRamp.position.set(0, 0.01, 1.32);
  thresholdRamp.rotation.x = 0.125;
  thresholdRamp.receiveShadow = true;
  liftGroup.add(thresholdRamp);

  // 2. Iconic Solid Safety Yellow Perimeter Frame / Curb (Endfield Signature)
  // Front Yellow Bumper Curbs flanking doorway (Left & Right from X: ±1.28 to ±1.80)
  [-1.54, 1.54].forEach(bx => {
    const frontCornerCurb = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.12, 0.14), yellowCurbMat);
    frontCornerCurb.position.set(bx, 0.08, 1.25);
    liftGroup.add(frontCornerCurb);
  });

  // Front Corner White/Silver Inspection Bolt Plates (Seen in Endfield reference)
  [-1.25, 1.25].forEach(bx => {
    const boltPlate = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.03, 0.08), boltCapMat);
    boltPlate.position.set(bx, 0.15, 1.25);
    liftGroup.add(boltPlate);
  });

  // Left & Right Yellow Curbs
  const leftCurb = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 2.6), yellowCurbMat);
  leftCurb.position.set(-1.75, 0.08, 0);
  liftGroup.add(leftCurb);

  const rightCurb = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 2.6), yellowCurbMat);
  rightCurb.position.set(1.75, 0.08, 0);
  liftGroup.add(rightCurb);

  // Back Yellow Curb
  const backCurb = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.12, 0.14), yellowCurbMat);
  backCurb.position.set(0, 0.08, -1.25);
  liftGroup.add(backCurb);

  // 3. Four Sleek Corner Columns
  const colGeo = new THREE.BoxGeometry(0.09, 3.2, 0.09);
  const cornerPositions = [
    [-1.75, 1.62, 1.25],
    [1.75, 1.62, 1.25],
    [-1.75, 1.62, -1.25],
    [1.75, 1.62, -1.25]
  ];
  cornerPositions.forEach(([x, y, z]) => {
    const col = new THREE.Mesh(colGeo, darkRigMat);
    col.position.set(x, y, z);
    liftGroup.add(col);
  });

  // 4. Side Rigging (Sleek High-Tech Tension Cables & Transparent Barrier)
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x94a3b8,
    transmission: 0.85,
    opacity: 0.35,
    transparent: true,
    roughness: 0.1,
    ior: 1.4
  });

  [-1, 1].forEach(side => {
    const sideX = side * 1.75;

    // Top side rail
    const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 2.6), darkRigMat);
    topRail.position.set(sideX, 3.14, 0);
    liftGroup.add(topRail);

    // Mid side rail
    const midRail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 2.6), darkRigMat);
    midRail.position.set(sideX, 1.62, 0);
    liftGroup.add(midRail);

    // Transparent safety shield panel
    const glassPanel = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 2.9), glassMat);
    glassPanel.rotation.y = side === 1 ? -Math.PI / 2 : Math.PI / 2;
    glassPanel.position.set(sideX - side * 0.01, 1.62, 0);
    liftGroup.add(glassPanel);

    // Sleek diagonal tension cables (criss-cross rigging as in Endfield screenshot)
    const cableAngle = Math.atan2(2.9, 2.5);
    const cableLen = Math.hypot(2.5, 2.9);

    const cable1 = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, cableLen, 8), cableWireMat);
    cable1.position.set(sideX - side * 0.02, 1.62, 0);
    cable1.rotation.x = cableAngle;
    liftGroup.add(cable1);

    const cable2 = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, cableLen, 8), cableWireMat);
    cable2.position.set(sideX - side * 0.02, 1.62, 0);
    cable2.rotation.x = -cableAngle;
    liftGroup.add(cable2);
  });

  // 5. Open Shaft Background Structure (NO solid wall! Deep open elevator shaft)
  const shaftStructureGroup = new THREE.Group();
  // Central Vertical Guide Rails in the background
  [-0.45, 0.45].forEach(rx => {
    const shaftRail = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 16, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9, roughness: 0.3 })
    );
    shaftRail.position.set(rx, 6.0, -1.8);
    shaftStructureGroup.add(shaftRail);
  });

  // Vertical Hoist Cables extending up the shaft
  [-0.2, 0.2].forEach(cx => {
    const hoistCable = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 20, 10),
      cableWireMat
    );
    hoistCable.position.set(cx, 8.0, -1.85);
    shaftStructureGroup.add(hoistCable);
  });
  liftGroup.add(shaftStructureGroup);

  // 6. Overhead Lighting (Studio High-CRI Cool-White Top Downlight)
  const cabinLight = new THREE.PointLight(0xf8fafc, 3.4, 14, 1.0);
  cabinLight.position.set(0, 3.2, 0.3);
  cabinLight.castShadow = true;
  cabinLight.shadow.bias = -0.001;
  liftGroup.add(cabinLight);

  // Soft ambient fill light
  const fillLight = new THREE.PointLight(0x38bdf8, 1.2, 8, 1.5);
  fillLight.position.set(0, 1.5, 2.2);
  liftGroup.add(fillLight);

  // 7. Industrial Sliding Blast Doors (Bi-Parting at Front Threshold Z = 1.28)
  const doorMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.35,
    metalness: 0.85
  });

  const doorInnerMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.55,
    metalness: 0.70
  });

  const slitGlassMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.85,
    transparent: true,
    opacity: 0.8,
    roughness: 0.15
  });

  const doorGasketMat = new THREE.MeshStandardMaterial({
    color: 0x090d16,
    roughness: 0.9,
    metalness: 0.1
  });

  const hazardTex = createHazardStripeTexture();
  const doorHazardMat = new THREE.MeshStandardMaterial({
    map: hazardTex,
    roughness: 0.45
  });

  // Top header door track & portal frame
  const doorHeader = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 0.24, 0.16),
    darkRigMat
  );
  doorHeader.position.set(0, 3.14, 1.28);
  liftGroup.add(doorHeader);

  // Status LED light above doors (Red while closed/docking, Green when docked/opening)
  const statusLedMat = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    emissive: 0x10b981,
    emissiveIntensity: 1.5,
    roughness: 0.2
  });
  const statusLed = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.06, 0.04),
    statusLedMat
  );
  statusLed.position.set(0, 3.08, 1.37);
  liftGroup.add(statusLed);

  // Helper to construct industrial blast door leaf
  function createDoorLeaf(isLeft) {
    const leaf = new THREE.Group();
    const doorW = 1.28;
    const doorH = 2.94;
    const doorD = 0.06;

    // Main steel armor plate
    const slab = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, doorD), doorMat);
    slab.position.y = doorH / 2;
    slab.castShadow = true;
    leaf.add(slab);

    // Inner recessed relief plate
    const innerRelief = new THREE.Mesh(new THREE.BoxGeometry(doorW - 0.16, doorH - 0.24, 0.02), doorInnerMat);
    innerRelief.position.set(isLeft ? 0.04 : -0.04, doorH / 2, 0.035);
    leaf.add(innerRelief);

    // Hazard caution stripe band along the bottom
    const hazardBand = new THREE.Mesh(new THREE.BoxGeometry(doorW, 0.18, 0.02), doorHazardMat);
    hazardBand.position.set(0, 0.15, 0.035);
    leaf.add(hazardBand);

    // Vertical vision slit window
    const visionSlit = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.35, 0.08), slitGlassMat);
    visionSlit.position.set(isLeft ? 0.28 : -0.28, 1.65, 0);
    leaf.add(visionSlit);

    // Heavy rubber edge gasket on inner meeting seam
    const gasket = new THREE.Mesh(new THREE.BoxGeometry(0.02, doorH, doorD + 0.01), doorGasketMat);
    gasket.position.set(isLeft ? (doorW / 2) : (-doorW / 2), doorH / 2, 0);
    leaf.add(gasket);

    // Heavy horizontal reinforcing ribs
    [0.75, 1.50, 2.25].forEach(ry => {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(doorW - 0.08, 0.04, 0.02), darkRigMat);
      rib.position.set(0, ry, 0.04);
      leaf.add(rib);
    });

    return leaf;
  }

  // Left Door Leaf (Spans X: -1.28 to 0 when closed at center X = -0.64; parked at X = -1.95 when open)
  const doorLeft = createDoorLeaf(true);
  doorLeft.position.set(-1.95, 0.02, 1.28);
  liftGroup.add(doorLeft);

  // Right Door Leaf (Spans X: 0 to 1.28 when closed at center X = +0.64; parked at X = +1.95 when open)
  const doorRight = createDoorLeaf(false);
  doorRight.position.set(1.95, 0.02, 1.28);
  liftGroup.add(doorRight);

  liftGroup.userData = {
    cabinLight,
    doorLeft,
    doorRight,
    statusLed,
    statusLedMat,
    shaftStructureGroup,
    renderFloorDisplay: () => {}
  };

  return liftGroup;
}

// 4. Elevator Ascent Visual Effects (Falling Speed Particles & Passing Girders)
function createElevatorAscentEffects() {
  const group = new THREE.Group();

  const particleCount = 350;
  const positions = new Float32Array(particleCount * 3);
  const speeds = new Float32Array(particleCount);

  for (let i = 0; i < particleCount; i++) {
    positions[i * 3 + 0] = (Math.random() - 0.5) * 16;
    positions[i * 3 + 1] = Math.random() * 20 - 4;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 16;
    speeds[i] = 14 + Math.random() * 12;
  }

  const partGeo = new THREE.BufferGeometry();
  partGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const partMat = new THREE.PointsMaterial({
    color: 0x7dd3fc,
    size: 0.08,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending
  });
  const particles = new THREE.Points(partGeo, partMat);
  group.add(particles);

  // Passing Shaft Girders
  const girderCount = 6;
  const girders = [];
  const girderGeo = new THREE.BoxGeometry(10, 0.15, 8);
  const girderMat = new THREE.MeshBasicMaterial({ color: 0x334155, wireframe: true, transparent: true, opacity: 0.35 });

  for (let i = 0; i < girderCount; i++) {
    const g = new THREE.Mesh(girderGeo, girderMat);
    g.position.y = i * 4;
    group.add(g);
    girders.push(g);
  }

  group.userData = {
    particles,
    positions,
    speeds,
    girders
  };

  return group;
}

// 5. Load Character GLTF Helper with Promise
function loadModelPromise(charId) {
  const char = CHARACTERS[charId];
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(
      char.file,
      (gltf) => {
        const rootGroup = new THREE.Group();
        const model = gltf.scene;
        model.scale.setScalar(char.scale);
        model.rotation.y = char.modelRotationY;
        model.position.y = char.yOffset;

        model.traverse((child) => {
          if (child.isMesh || child.isSkinnedMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            child.frustumCulled = false;
            if (child.material) {
              const mats = Array.isArray(child.material) ? child.material : [child.material];
              mats.forEach(mat => {
                mat.roughness = char.id === 'drdoom' ? 0.45 : 0.65;
                mat.metalness = char.id === 'drdoom' ? 0.35 : 0.1;
              });
            }
          }
        });

        if (char.canFly) {
          const thrusters = createFlightThrusters();
          rootGroup.add(thrusters);
          rootGroup.userData.thrusterGroup = thrusters;
        }

        rootGroup.add(model);

        // Mixers & Actions
        const mixer = new THREE.AnimationMixer(model);
        const actions = {};
        const clips = gltf.animations;

        if (clips && clips.length > 0) {
          for (const [key, clipName] of Object.entries(char.anims)) {
            const clip = clips.find(c => c.name === clipName);
            if (clip) {
              actions[key] = mixer.clipAction(clip);
            }
          }
          if (actions['jump']) {
            actions['jump'].setLoop(THREE.LoopOnce, 1);
            actions['jump'].clampWhenFinished = true;
          }
          if (actions['attack']) {
            actions['attack'].setLoop(THREE.LoopOnce, 1);
            actions['attack'].clampWhenFinished = true;
          }
          ['fly_idle', 'fly_slow', 'fly_fast'].forEach(k => {
            if (actions[k]) actions[k].setLoop(THREE.LoopRepeat);
          });

          if (actions['idle']) {
            actions['idle'].play();
          }
        }

        const data = {
          charId,
          rootGroup,
          model,
          mixer,
          actions,
          gltf
        };
        loadedCharacters[charId] = data;
        resolve(data);
      },
      (xhr) => {
        if (xhr.total > 0 && loadingProgress) {
          const pct = Math.round((xhr.loaded / xhr.total) * 100);
          loadingProgress.style.width = `${pct}%`;
        }
      },
      reject
    );
  });
}

// 6. Pedestal Highlight Helper (Rings removed per user request)
function highlightPedestal(charId) {
  // Rings removed
}

// 7. Raycaster Hover & Click Handlers for Intro
function handleIntroMouseMove(e) {
  state.mouseNorm.x = (e.clientX / window.innerWidth) * 2 - 1;
  state.mouseNorm.y = -(e.clientY / window.innerHeight) * 2 + 1;

  if (!state.introActive || state.introState === 'deploying') return;

  raycaster.setFromCamera(state.mouseNorm, camera);

  const candidates = [];
  if (loadedCharacters.shiroko) candidates.push(loadedCharacters.shiroko.rootGroup);
  if (loadedCharacters.drdoom) candidates.push(loadedCharacters.drdoom.rootGroup);

  const intersects = raycaster.intersectObjects(candidates, true);

  if (intersects.length > 0) {
    let topHit = intersects[0].object;
    while (topHit.parent && topHit.parent !== scene) {
      if (topHit === loadedCharacters.shiroko?.rootGroup || topHit === loadedCharacters.drdoom?.rootGroup) break;
      topHit = topHit.parent;
    }

    if (topHit === loadedCharacters.shiroko?.rootGroup) {
      canvas.style.cursor = 'pointer';
      highlightPedestal('shiroko');
      return;
    } else if (topHit === loadedCharacters.drdoom?.rootGroup) {
      canvas.style.cursor = 'pointer';
      highlightPedestal('drdoom');
      return;
    }
  }

  canvas.style.cursor = 'default';
  highlightPedestal(state.introSelectedCharId);
}

function handleIntroClick(e) {
  if (!state.introActive) return;
  if (state.introState === 'deploying') {
    skipIntroToGameplay();
    return;
  }

  state.mouseNorm.x = (e.clientX / window.innerWidth) * 2 - 1;
  state.mouseNorm.y = -(e.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(state.mouseNorm, camera);

  const candidates = [];
  if (loadedCharacters.shiroko) candidates.push(loadedCharacters.shiroko.rootGroup);
  if (loadedCharacters.drdoom) candidates.push(loadedCharacters.drdoom.rootGroup);

  const intersects = raycaster.intersectObjects(candidates, true);

  if (intersects.length > 0) {
    let topHit = intersects[0].object;
    while (topHit.parent && topHit.parent !== scene) {
      if (topHit === loadedCharacters.shiroko?.rootGroup || topHit === loadedCharacters.drdoom?.rootGroup) break;
      topHit = topHit.parent;
    }

    if (topHit === loadedCharacters.shiroko?.rootGroup) {
      if (state.introState === 'shiroko') {
        // Klik kedua pada Shiroko -> Konfirmasi (YA) & deploy!
        deployOperator('shiroko');
      } else {
        // Klik pertama -> Zoom in ke Shiroko & tampilkan bilah konfirmasi
        selectIntroOperator('shiroko');
      }
      return;
    } else if (topHit === loadedCharacters.drdoom?.rootGroup) {
      if (state.introState === 'drdoom') {
        // Klik kedua pada Doctor Doom -> Konfirmasi (YA) & deploy!
        deployOperator('drdoom');
      } else {
        // Klik pertama -> Zoom in ke Doctor Doom & tampilkan bilah konfirmasi
        selectIntroOperator('drdoom');
      }
      return;
    }
  }
}

// 8. Select Operator in Intro (Triggers Smooth Camera Glide to Half Body Front-Diagonal)
function selectIntroOperator(charId) {
  initAudio();
  playSelectChime();

  state.introSelectedCharId = charId;
  state.introState = charId; // 'shiroko' or 'drdoom'

  const char = CHARACTERS[charId];
  const actionBar = document.getElementById('intro-action-bar');
  const selectedName = document.getElementById('intro-selected-name');

  if (actionBar && char) {
    if (selectedName) selectedName.textContent = char.name.toUpperCase();
    actionBar.classList.remove('hidden');
  }

  highlightPedestal(charId);
}

// 9. Return to Dual Overview (Both Operators Full Body)
function returnToIntroOverview() {
  initAudio();
  playSelectChime();
  state.introState = 'overview';
  state.introSelectedCharId = null;

  const actionBar = document.getElementById('intro-action-bar');
  if (actionBar) {
    actionBar.classList.add('hidden');
  }
  highlightPedestal(null);
}

// 10. Deploy Operator (Elevator Deceleration, Docking, Doors Opening & Walkout Cinematic)
function deployOperator(charId) {
  if (state.introState === 'deploying') return;

  const targetCharId = charId || state.introSelectedCharId || 'shiroko';
  state.introSelectedCharId = targetCharId;
  state.currentCharId = targetCharId;
  state.introState = 'deploying';
  state.deployStartTime = performance.now() / 1000;
  state.dockingSoundPlayed = false;
  state.doorSoundPlayed = false;
  state.walkAnimStarted = false;
  state.idleCrossfaded = false;
  state.stepTimer = 0;

  playDeploySound();

  const actionBar = document.getElementById('intro-action-bar');
  if (actionBar) actionBar.classList.add('hidden');
  canvas.style.cursor = 'default';
}

function finalizeGameplayTransition() {
  if (!state.introActive) return;

  const charId = state.currentCharId || 'shiroko';
  const char = CHARACTERS[charId];
  const selectedCharData = loadedCharacters[charId];
  const unselectedCharId = charId === 'shiroko' ? 'drdoom' : 'shiroko';
  const unselectedCharData = loadedCharacters[unselectedCharId];

  // Remove unselected character if still present in scene
  if (unselectedCharData && unselectedCharData.rootGroup && unselectedCharData.rootGroup.parent) {
    scene.remove(unselectedCharData.rootGroup);
  }

  // Remove ascent speed particles & floating text
  if (ascentEffectsGroup && ascentEffectsGroup.parent) {
    scene.remove(ascentEffectsGroup);
  }
  if (whoAreYouMesh && whoAreYouMesh.parent) {
    scene.remove(whoAreYouMesh);
  }

  // Make sure outdoor world is visible
  if (devWorldGroup) {
    devWorldGroup.visible = true;
  }

  // Remove elevator cabin, shaft rails, cables, and doors completely upon entering gameplay
  if (elevatorGroup && elevatorGroup.parent) {
    scene.remove(elevatorGroup);
  }

  // Set active character & position on arena floor
  state.pos.set(0, 0, 3.2);
  state.vel.set(0, 0, 0);
  state.targetRotation = 0; // facing forward (+Z)

  if (selectedCharData && selectedCharData.rootGroup) {
    state.character = selectedCharData.rootGroup;
    state.character.position.copy(state.pos);
    state.character.rotation.y = 0;
    // Restore materials opacity
    state.character.traverse((child) => {
      if (child.isMesh && child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach(m => { m.opacity = 1.0; });
      }
    });

    state.mixer = selectedCharData.mixer;
    state.actions = selectedCharData.actions;
    state.currentAction = selectedCharData.actions['idle'];
    state.currentAnimName = 'idle';
    if (state.currentAction) {
      state.currentAction.enabled = true;
      state.currentAction.setEffectiveWeight(1.0);
      state.currentAction.play();
    }
  }

  if (char.canFly) {
    state.thrusterGroup = selectedCharData.rootGroup.userData.thrusterGroup;
  } else {
    state.thrusterGroup = null;
  }
  state.isFlying = false;
  updateFlightHud();

  // Restore outdoor daylight environment
  scene.background.set(state.isSunset ? bgSunset : bgDay);
  scene.fog.color.set(state.isSunset ? bgSunset : bgDay);
  scene.fog.near = 10;
  scene.fog.far = 180;
  sunLight.intensity = 1.8;

  // Initialize Camera to TPS Orbit position behind player looking forward
  state.yaw = Math.PI;
  state.pitch = 0.28;
  state.distance = char.cameraDist || 3.4;

  // Seamless Camera Handoff: Pre-seed cameraTarget and desiredCameraPos exactly
  // to eliminate any snap, jerk, or lerping lag from origin (0, 0, 0)
  const focusHeight = char.cameraHeight || 0.85;
  const targetPos = state.pos.clone().add(new THREE.Vector3(0, focusHeight, 0));
  cameraTarget.copy(targetPos);

  const cosPitch = Math.cos(state.pitch);
  const sinPitch = Math.sin(state.pitch);
  const sinYaw = Math.sin(state.yaw);
  const cosYaw = Math.cos(state.yaw);

  const offsetX = state.distance * sinYaw * cosPitch;
  const offsetY = state.distance * sinPitch;
  const offsetZ = state.distance * cosYaw * cosPitch;

  desiredCameraPos.set(
    targetPos.x + offsetX,
    targetPos.y + offsetY,
    targetPos.z + offsetZ
  );

  camera.position.copy(desiredCameraPos);
  camera.lookAt(cameraTarget);

  // Hide Intro HUD
  const introHud = document.getElementById('intro-hud');
  if (introHud) introHud.classList.add('hidden');

  // Show top-right Character menu button
  if (btnCharMenu) btnCharMenu.classList.remove('hidden');

  // Unlock gameplay!
  state.introActive = false;
  state.introState = 'gameplay';
}

function skipIntroToGameplay() {
  if (!state.introActive) return;
  finalizeGameplayTransition();
}

// 11. Update Intro Cutscene Frame
function updateIntro(dt, elapsed) {
  // Update animation mixers
  if (loadedCharacters.shiroko?.mixer) {
    loadedCharacters.shiroko.mixer.update(dt);
  }
  if (loadedCharacters.drdoom?.mixer) {
    loadedCharacters.drdoom.mixer.update(dt);
  }

  // --------------------------------------------------------------------------
  // CINEMATIC DEPLOYMENT SEQUENCE (After selecting character)
  // --------------------------------------------------------------------------
  if (state.introState === 'deploying') {
    const elapsedDeploy = (performance.now() / 1000) - state.deployStartTime;
    const selectedCharId = state.currentCharId || 'shiroko';
    const unselectedCharId = selectedCharId === 'shiroko' ? 'drdoom' : 'shiroko';
    const selectedCharData = loadedCharacters[selectedCharId];
    const unselectedCharData = loadedCharacters[unselectedCharId];
    const char = CHARACTERS[selectedCharId];

    // 1. Smoothly fade out "WHO ARE YOU?" typography and unselected character
    if (elapsedDeploy < 0.8) {
      const fade = Math.max(0, 1.0 - elapsedDeploy / 0.55);
      if (whoAreYouMesh && whoAreYouMesh.material) {
        whoAreYouMesh.material.opacity = fade;
      }
      if (unselectedCharData && unselectedCharData.rootGroup) {
        unselectedCharData.rootGroup.traverse((child) => {
          if (child.isMesh && child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach(m => {
              m.transparent = true;
              m.opacity = fade;
            });
          }
        });
      }
    } else {
      if (whoAreYouMesh && whoAreYouMesh.parent) scene.remove(whoAreYouMesh);
      if (unselectedCharData && unselectedCharData.rootGroup && unselectedCharData.rootGroup.parent) {
        scene.remove(unselectedCharData.rootGroup);
      }
    }

    // PHASE 1: GRADUAL DOCKING & DECELERATION (0.0s - 2.0s)
    if (elapsedDeploy < 2.0) {
      // Lift decelerates gradually (smooth exponential ease-out braking curve)
      const decelProgress = Math.min(1.0, elapsedDeploy / 2.0);
      const decel = Math.pow(1.0 - decelProgress, 2.2);

      if (ascentEffectsGroup && ascentEffectsGroup.userData) {
        const { positions, speeds, girders, particles } = ascentEffectsGroup.userData;
        for (let i = 0; i < speeds.length; i++) {
          positions[i * 3 + 1] -= speeds[i] * dt * decel;
          if (positions[i * 3 + 1] < -4) positions[i * 3 + 1] = 16;
        }
        particles.geometry.attributes.position.needsUpdate = true;
        for (const g of girders) {
          g.position.y -= 18 * dt * decel;
          if (g.position.y < -4) g.position.y += girders.length * 4;
        }
      }

      // Platform vibration settles smoothly with subtle braking inertia dip (clamped above floor to eliminate Z-fighting)
      if (elevatorGroup) {
        const brakeDip = Math.sin(Math.min(1.0, Math.max(0, (elapsedDeploy - 1.2) / 0.8)) * Math.PI) * 0.006;
        const vib = Math.max(0, Math.sin(elapsed * 24) * 0.002 * decel);
        elevatorGroup.position.y = vib - brakeDip * decel;
      }

      if (selectedCharData && selectedCharData.rootGroup) {
        selectedCharData.rootGroup.position.y = (elevatorGroup ? elevatorGroup.position.y : 0) + 0.02;
      }

      // Sliding blast doors close firmly into airlock seal
      if (elevatorGroup && elevatorGroup.userData) {
        const { doorLeft, doorRight, statusLedMat } = elevatorGroup.userData;
        const closeT = Math.min(1.0, elapsedDeploy / 0.80);
        const easeClose = 1 - Math.pow(1 - closeT, 3);
        if (doorLeft) doorLeft.position.x = -1.95 + (-0.64 - (-1.95)) * easeClose;
        if (doorRight) doorRight.position.x = 1.95 + (0.64 - 1.95) * easeClose;

        // Status LED turns red during braking, green upon complete dock
        if (statusLedMat) {
          if (elapsedDeploy >= 1.85) {
            statusLedMat.color.set(0x10b981);
            statusLedMat.emissive.set(0x10b981);
          } else {
            statusLedMat.color.set(0xef4444);
            statusLedMat.emissive.set(0xef4444);
          }
        }
      }

      // Floor display counts up gradually and locks to Floor 44
      if (elevatorGroup?.userData?.renderFloorDisplay) {
        const floorNum = Math.min(44, Math.floor(40 + decelProgress * 4.2));
        elevatorGroup.userData.renderFloorDisplay(floorNum);
      }

      // Elevator Arrival Chime & Heavy Docking Clamp Latch right as it comes to a complete halt
      if (elapsedDeploy >= 1.85 && !state.dockingSoundPlayed) {
        state.dockingSoundPlayed = true;
        playElevatorDing();
        playDockingSound();
      }

      // Camera gently centers on front
      const targetCam = new THREE.Vector3(0, 1.30, 3.55);
      const targetLook = new THREE.Vector3(0, 1.10, 0);
      introCamPos.lerp(targetCam, Math.min(1.0, 5.0 * dt));
      introCamLook.lerp(targetLook, Math.min(1.0, 6.0 * dt));
    }

    // PHASE 2: DOORS OPENING & DAYLIGHT REVEAL (2.0s - 3.2s)
    else if (elapsedDeploy >= 2.0 && elapsedDeploy < 3.2) {
      // Elevator is fully docked flush at Y = 0
      if (elevatorGroup) {
        elevatorGroup.position.y = 0;
      }
      if (selectedCharData && selectedCharData.rootGroup) {
        selectedCharData.rootGroup.position.y = 0.02;
      }

      if (!state.doorSoundPlayed) {
        state.doorSoundPlayed = true;
        playDoorOpenSound();
        if (devWorldGroup) devWorldGroup.visible = true;
        if (elevatorGroup?.userData?.shaftStructureGroup) {
          elevatorGroup.userData.shaftStructureGroup.visible = false;
        }
      }

      // Doors slide apart smoothly to X = ±1.95
      const openT = Math.min(1.0, (elapsedDeploy - 2.0) / 1.15);
      const easeOpen = 1 - Math.pow(1 - openT, 3);
      if (elevatorGroup && elevatorGroup.userData) {
        const { doorLeft, doorRight } = elevatorGroup.userData;
        if (doorLeft) doorLeft.position.x = -0.64 + (-1.95 - (-0.64)) * easeOpen;
        if (doorRight) doorRight.position.x = 0.64 + (1.95 - 0.64) * easeOpen;
      }

      // Sky and sun daylight transition
      const skyT = Math.min(1.0, (elapsedDeploy - 2.0) / 1.0);
      scene.background.lerpColors(new THREE.Color(0x0c111a), state.isSunset ? bgSunset : bgDay, skyT);
      scene.fog.color.copy(scene.background);
      scene.fog.near = 2.0 + (10.0 - 2.0) * skyT;
      scene.fog.far = 16.0 + (160.0 - 16.0) * skyT;
      sunLight.intensity = 1.8 * skyT;

      // Camera pulls back slightly to frame the opening doorway and outside vista
      const targetCam = new THREE.Vector3(0, 1.40, 3.80);
      const targetLook = new THREE.Vector3(0, 1.12, 0.6);
      introCamPos.lerp(targetCam, Math.min(1.0, 4.5 * dt));
      introCamLook.lerp(targetLook, Math.min(1.0, 5.5 * dt));
    }

    // PHASE 3: CHARACTER WALKING OUT OF CABIN (3.2s - 5.4s)
    else if (elapsedDeploy >= 3.2 && elapsedDeploy < 5.4) {
      if (elevatorGroup) {
        elevatorGroup.position.y = 0;
      }

      // Start walk/run animation smoothly with NO WARP (eliminates T-pose / bind pose glitch)
      if (!state.walkAnimStarted) {
        state.walkAnimStarted = true;
        if (selectedCharData) {
          const runAct = selectedCharData.actions['run'];
          const idleAct = selectedCharData.actions['idle'];
          if (runAct) {
            runAct.enabled = true;
            runAct.setEffectiveTimeScale(selectedCharId === 'shiroko' ? 0.95 : 1.0);
            runAct.setEffectiveWeight(1.0);
            runAct.play();
            if (idleAct && idleAct !== runAct) {
              idleAct.crossFadeTo(runAct, 0.28, false); // warp = false prevents T-pose
            }
          }
        }
      }

      // Walk progress along Z
      const walkT = Math.min(1.0, (elapsedDeploy - 3.2) / 1.95);
      const easeWalk = walkT < 0.5 ? 2 * walkT * walkT : -1 + (4 - 2 * walkT) * walkT;
      const startX = selectedCharId === 'shiroko' ? -0.60 : 0.52;
      const curX = startX * (1 - Math.min(1.0, walkT * 1.5));
      const curZ = 3.2 * easeWalk;

      // Vertical position steps smoothly from lift deck (+0.02) to arena ground (0.0) as they pass doorway threshold Z = 1.3
      const charY = curZ < 1.3 ? 0.02 : Math.max(0, 0.02 * (1 - (curZ - 1.3) / 0.5));

      if (selectedCharData && selectedCharData.rootGroup) {
        selectedCharData.rootGroup.position.set(curX, charY, curZ);
        selectedCharData.rootGroup.rotation.y = 0; // Walk forward (+Z)
      }

      // Synchronized footstep audio
      state.stepTimer = (state.stepTimer || 0) + dt;
      if (state.stepTimer > 0.35 && walkT < 0.92) {
        playStepSound();
        state.stepTimer = 0;
      }

      // Smooth cinematic camera orbit (sweeping from front to behind character)
      const orbitT = Math.min(1.0, (elapsedDeploy - 3.2) / 2.15);
      const smoothOrbit = orbitT * orbitT * (3 - 2 * orbitT);
      const angle = smoothOrbit * Math.PI; // 0 (front) -> Math.PI (behind)
      const focusH = char.cameraHeight || 0.85;
      const camDist = char.cameraDist || 3.4;
      const pitch = 0.28;

      // Arc camera up and around to follow position matching gameplay TPS orbit formula
      const camH = 1.35 * (1 - smoothOrbit) + (focusH + camDist * Math.sin(pitch)) * smoothOrbit;
      const offsetX = Math.sin(angle) * (camDist * 0.65);
      const offsetZ = Math.cos(angle) * (camDist * (Math.cos(pitch) * smoothOrbit + (1 - smoothOrbit)));

      const targetCamPos = new THREE.Vector3(curX + offsetX, camH, curZ + offsetZ);
      const targetCamLook = new THREE.Vector3(curX, focusH, curZ);

      // Lerp dynamically, converging firmly as orbit completes
      const camLerp = 8.0 + smoothOrbit * 12.0;
      introCamPos.lerp(targetCamPos, Math.min(1.0, camLerp * dt));
      introCamLook.lerp(targetCamLook, Math.min(1.0, (camLerp + 2.0) * dt));

      // As character reaches destination, cross-fade back to idle with NO WARP (eliminates T-pose)
      if (elapsedDeploy >= 5.0 && !state.idleCrossfaded) {
        state.idleCrossfaded = true;
        if (selectedCharData) {
          const runAct = selectedCharData.actions['run'];
          const idleAct = selectedCharData.actions['idle'];
          if (idleAct) {
            idleAct.enabled = true;
            idleAct.setEffectiveWeight(1.0);
            idleAct.play();
            if (runAct && runAct !== idleAct) {
              runAct.crossFadeTo(idleAct, 0.32, false); // warp = false prevents T-pose
            }
          }
        }
      }
    }

    // PHASE 4: GAMEPLAY READY
    else {
      finalizeGameplayTransition();
      return;
    }

    camera.position.copy(introCamPos);
    camera.lookAt(introCamLook);
    return;
  }

  // --------------------------------------------------------------------------
  // NORMAL ELEVATOR ASCENT & OPERATOR SELECTION OVERVIEW
  // --------------------------------------------------------------------------
  // Update elevator ascent particles & girders
  if (ascentEffectsGroup && ascentEffectsGroup.userData) {
    const { positions, speeds, girders, particles } = ascentEffectsGroup.userData;
    for (let i = 0; i < speeds.length; i++) {
      positions[i * 3 + 1] -= speeds[i] * dt;
      if (positions[i * 3 + 1] < -4) {
        positions[i * 3 + 1] = 16;
      }
    }
    particles.geometry.attributes.position.needsUpdate = true;

    for (const g of girders) {
      g.position.y -= 18 * dt;
      if (g.position.y < -4) {
        g.position.y += girders.length * 4;
      }
    }
  }

  // Update elevator digital floor counter
  if (elevatorGroup && elevatorGroup.userData) {
    if (elevatorGroup.userData.renderFloorDisplay) {
      const floorNum = 14 + Math.floor(elapsed * 1.5);
      elevatorGroup.userData.renderFloorDisplay(floorNum);
    }
    // Subtle elevator platform vibration
    elevatorGroup.position.y = Math.sin(elapsed * 24) * 0.002;
  }

  // Keep characters standing flush on elevator deck (+0.02) during pre-selection
  if (state.introState !== 'deploying') {
    if (loadedCharacters['shiroko']?.rootGroup) {
      loadedCharacters['shiroko'].rootGroup.position.y = (elevatorGroup ? elevatorGroup.position.y : 0) + 0.02;
    }
    if (loadedCharacters['drdoom']?.rootGroup) {
      loadedCharacters['drdoom'].rootGroup.position.y = (elevatorGroup ? elevatorGroup.position.y : 0) + 0.02;
    }
  }

  // Floating hover animation for "WHO ARE YOU?" text in 3D mid-air
  if (whoAreYouMesh) {
    whoAreYouMesh.position.y = 1.45 + Math.sin(elapsed * 1.5) * 0.02;
  }

  // Compute Camera target positions based on introState
  let baseCamPos = new THREE.Vector3();
  let baseCamLook = new THREE.Vector3();

  if (state.introState === 'shiroko') {
    baseCamPos.set(-1.30, 1.05, 1.35);
    baseCamLook.set(-0.60, 0.90, 0);
  } else if (state.introState === 'drdoom') {
    baseCamPos.set(1.35, 1.40, 1.45);
    baseCamLook.set(0.52, 1.30, 0);
  } else {
    baseCamPos.set(0, 1.30, 3.45);
    baseCamLook.set(0, 1.15, 0);
  }

  // Interactive mouse parallax
  const parallaxX = state.mouseNorm.x * 0.35;
  const parallaxY = state.mouseNorm.y * 0.18;
  const desiredCamPos = baseCamPos.clone().add(new THREE.Vector3(parallaxX, parallaxY, 0));

  // Smooth camera glide
  introCamPos.lerp(desiredCamPos, Math.min(1.0, 5.0 * dt));
  introCamLook.lerp(baseCamLook, Math.min(1.0, 6.0 * dt));

  camera.position.copy(introCamPos);
  camera.lookAt(introCamLook);
}

// 12. Initialize Intro Scene & Load Both Characters in Parallel
async function initIntroCharacters() {
  if (loadingScreen) {
    loadingScreen.style.display = 'flex';
    loadingScreen.style.opacity = '1';
    if (loadingTitle) loadingTitle.textContent = 'Memuat Lift & Operator (Shiroko & Dr Doom)...';
    if (loadingProgress) loadingProgress.style.width = '10%';
  }

  // Dark atmospheric elevator shaft environment during ascent (Arknights: Endfield Style)
  scene.background.set(0x0c111a);
  scene.fog.color.set(0x0c111a);
  scene.fog.near = 2.0;
  scene.fog.far = 16.0;

  // Create Elevator, Ascent Effects, and "WHO ARE YOU" Text
  elevatorGroup = createElevatorGroup();
  scene.add(elevatorGroup);

  ascentEffectsGroup = createElevatorAscentEffects();
  scene.add(ascentEffectsGroup);

  whoAreYouMesh = createWhoAreYouMesh();
  scene.add(whoAreYouMesh);

  // Bind Intro UI Buttons
  const btnDeploy = document.getElementById('btn-intro-deploy');
  if (btnDeploy) {
    btnDeploy.addEventListener('click', (e) => {
      e.stopPropagation();
      deployOperator();
    });
  }

  const btnBack = document.getElementById('btn-intro-back');
  if (btnBack) {
    btnBack.addEventListener('click', (e) => {
      e.stopPropagation();
      returnToIntroOverview();
    });
  }

  try {
    // Load both models concurrently
    const [shirokoData, drDoomData] = await Promise.all([
      loadModelPromise('shiroko'),
      loadModelPromise('drdoom')
    ]);

    // Position Shiroko on Left (-0.60, 0.02, 0), standing side-by-side
    shirokoData.rootGroup.position.set(-0.60, 0.02, 0);
    shirokoData.rootGroup.rotation.y = 0;
    scene.add(shirokoData.rootGroup);

    // Position Doctor Doom on Right (0.52, 0.02, 0), standing side-by-side
    drDoomData.rootGroup.position.set(0.52, 0.02, 0);
    drDoomData.rootGroup.rotation.y = 0;
    scene.add(drDoomData.rootGroup);

    state.isLoaded = true;

    // Hide loading screen smoothly
    if (loadingProgress) loadingProgress.style.width = '100%';
    setTimeout(() => {
      if (loadingScreen) {
        loadingScreen.style.opacity = '0';
        setTimeout(() => {
          loadingScreen.style.display = 'none';
        }, 400);
      }
    }, 300);
  } catch (err) {
    console.error('Failed to load intro characters:', err);
    if (loadingScreen) {
      loadingScreen.innerHTML = `<div style="color:#ef4444;font-weight:600;">Gagal memuat karakter: ${err.message}</div>`;
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

  // If intro cutscene is active, run elevator & intro animation
  if (state.introActive) {
    updateIntro(dt, elapsed);
    renderer.render(scene, camera);
    return;
  }

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

// Initialization: Build Dev World and Launch Intro Cutscene
buildDevWorld();
initIntroCharacters();
animate();

// Debug / Inspection API
window.__gameState = state;
window.__gameScene = scene;
window.__gameCamera = camera;
window.__switchCharacter = switchCharacter;
window.__loadedCharacters = loadedCharacters;

