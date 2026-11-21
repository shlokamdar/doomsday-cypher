import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/* ============================================================================
   DOOMSDAY CYPHER: the home page 3D scene.
   A rift (black hole with a swirling accretion disk) swallows parallel worlds
   while The Sovereign's iron mask looms behind it. Scroll drives the camera.
   All geometry and art are original.
   ========================================================================== */

const GREEN = new THREE.Color("#2BD67B");
const GOLD = new THREE.Color("#F2B33D");
const PINK = new THREE.Color("#E0408A");

type Keyframe = { p: number; cam: THREE.Vector3; look: THREE.Vector3; mask: number };

/** Camera path through the scene, keyed by page scroll progress (0..1). */
function keyframes(mobile: boolean): Keyframe[] {
  const x = mobile ? 0 : -3.2; // desktop: rift sits to the right of the hero text
  return [
    { p: 0.0, cam: new THREE.Vector3(x, 1.6, 15), look: new THREE.Vector3(x, 0.4, 0), mask: 0.25 },
    { p: 0.22, cam: new THREE.Vector3(4, 3.5, 13), look: new THREE.Vector3(0, 2.5, -6), mask: 1 },
    { p: 0.5, cam: new THREE.Vector3(-9, 6, 7), look: new THREE.Vector3(0, 0, 0), mask: 0.8 },
    { p: 0.75, cam: new THREE.Vector3(6, -2.5, 9), look: new THREE.Vector3(0, 0.5, 0), mask: 0.6 },
    { p: 1.0, cam: new THREE.Vector3(0, 0.8, 6.5), look: new THREE.Vector3(0, 0, 0), mask: 1 },
  ];
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/* ---------------- Accretion disk shader ---------------- */

const diskVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vPos;
  void main() {
    vUv = uv;
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const diskFragment = /* glsl */ `
  uniform float uTime;
  uniform float uGain;
  uniform float uInner;
  uniform float uOuter;
  uniform vec3 uA;
  uniform vec3 uB;
  uniform vec3 uC;
  varying vec3 vPos;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
    return v;
  }

  void main() {
    float r = length(vPos.xy);
    float k = clamp((r - uInner) / (uOuter - uInner), 0.0, 1.0);
    float ang = atan(vPos.y, vPos.x);
    // inner gas orbits faster than outer gas
    float swirl = ang + uTime * (1.6 - k * 1.2) + k * 6.0;
    float n = fbm(vec2(cos(swirl), sin(swirl)) * 2.2 + vec2(k * 7.0, uTime * 0.15));
    float streaks = 0.55 + 0.45 * sin(swirl * 9.0 + n * 6.0);
    vec3 col = mix(uA, uB, smoothstep(0.0, 0.45, k));
    col = mix(col, uC, smoothstep(0.45, 1.0, k));
    col += vec3(1.0) * pow(1.0 - k, 8.0) * 0.9; // white-hot inner edge
    float alpha = smoothstep(0.0, 0.06, k) * (1.0 - smoothstep(0.7, 1.0, k));
    alpha *= (0.35 + 0.9 * n) * streaks;
    gl_FragColor = vec4(col * (0.5 + 0.9 * (1.0 - k)), alpha * 0.6 * uGain);
  }
`;

/* ---------------- Helpers ---------------- */

function glowTexture(inner: string, outer = "rgba(0,0,0,0)") {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, inner);
  grd.addColorStop(1, outer);
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** SVG-space (200x240, y down) cubic path → THREE.Shape centred on the mask. */
function svgShape(cmds: (string | number)[]): THREE.Shape {
  const s = new THREE.Shape();
  const X = (v: number) => (v - 100) / 20;
  const Y = (v: number) => -(v - 120) / 20;
  let i = 0;
  while (i < cmds.length) {
    const c = cmds[i++];
    const n = () => cmds[i++] as number;
    if (c === "M") s.moveTo(X(n()), Y(n()));
    else if (c === "L") s.lineTo(X(n()), Y(n()));
    else if (c === "C") {
      const a = [n(), n(), n(), n(), n(), n()];
      s.bezierCurveTo(X(a[0]), Y(a[1]), X(a[2]), Y(a[3]), X(a[4]), Y(a[5]));
    }
  }
  return s;
}

function svgPath(cmds: (string | number)[]): THREE.Path {
  return svgShape(cmds) as unknown as THREE.Path;
}

/* ---------------- The scene ---------------- */

type World = {
  mesh: THREE.Mesh;
  ring?: THREE.Mesh;
  r: number;
  a: number;
  v: number;
  tilt: number;
  size: number;
  spin: number;
};

type Burst = { pts: THREE.Points; vel: Float32Array; t: number };

export class DoomScene {
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(55, 1, 0.1, 600);
  private clock = new THREE.Clock();
  private raf = 0;
  private running = false;
  private disposed = false;
  private mobile: boolean;
  private frames: Keyframe[];

  private scrollTarget = 0;
  private scroll = 0;
  private mouse = new THREE.Vector2();
  private mouseS = new THREE.Vector2();
  private camPos = new THREE.Vector3();
  private camLook = new THREE.Vector3();

  private rift = new THREE.Group();
  private diskMat!: THREE.ShaderMaterial;
  private coreLight!: THREE.PointLight;
  private worlds: World[] = [];
  private bursts: Burst[] = [];
  private debris!: THREE.InstancedMesh;
  private debrisData: { r: number; a: number; y: number; v: number; s: number; rx: number; ry: number }[] = [];
  private bolts: THREE.Line[] = [];
  private boltTimer = 0;
  private stars!: THREE.Points;
  private mask = new THREE.Group();
  private maskVisor!: THREE.MeshBasicMaterial;
  private maskEyes!: THREE.PointLight;
  private maskLevel = 0.25;
  private dummy = new THREE.Object3D();
  private worldGeo = new THREE.IcosahedronGeometry(1, 3);
  private envTex: THREE.Texture | null = null;
  private perfFrames = 0;
  private perfTime = 0;
  private degraded = false;

  constructor(private canvas: HTMLCanvasElement) {
    this.mobile = window.innerWidth < 768;
    this.frames = keyframes(this.mobile);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !this.mobile, alpha: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.mobile ? 1.5 : 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.9;
    this.renderer.setClearColor("#07090D");

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.35;
    this.scene.environment = this.envTex;
    pmrem.dispose();

    this.scene.fog = new THREE.FogExp2("#07090D", 0.012);
    this.camera.position.copy(this.frames[0].cam);
    this.camPos.copy(this.frames[0].cam);
    this.camLook.copy(this.frames[0].look);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), this.mobile ? 0.55 : 0.7, 0.35, 0.55);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.scene.add(new THREE.AmbientLight("#334", 0.6));
    const rim = new THREE.DirectionalLight("#7FB8FF", 0.8);
    rim.position.set(-10, 8, -6);
    this.scene.add(rim);

    this.buildStars();
    this.buildRift();
    this.buildWorlds();
    this.buildDebris();
    this.buildBolts();
    this.buildMask();
    this.resize();
  }

  /* ---------- builders ---------- */

  private buildStars() {
    const n = this.mobile ? 2500 : 6000;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const palette = [new THREE.Color("#C9D2DC"), new THREE.Color("#ffffff"), GREEN, GOLD, PINK, new THREE.Color("#7FB8FF")];
    for (let i = 0; i < n; i++) {
      const r = 60 + Math.random() * 160;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      pos.set([r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) * 0.7, r * Math.sin(ph) * Math.sin(th)], i * 3);
      const c = palette[Math.random() < 0.8 ? Math.floor(Math.random() * 2) : 2 + Math.floor(Math.random() * 4)];
      col.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    this.stars = new THREE.Points(
      g,
      new THREE.PointsMaterial({ size: 0.45, vertexColors: true, map: glowTexture("rgba(255,255,255,1)"), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
    );
    this.scene.add(this.stars);

    // distant nebula clouds
    const neb = [
      { c: "rgba(43,214,123,0.10)", p: [-70, 25, -150], s: 120 },
      { c: "rgba(224,64,138,0.09)", p: [80, -15, -160], s: 130 },
      { c: "rgba(242,179,61,0.06)", p: [10, 50, -190], s: 110 },
    ];
    for (const b of neb) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(b.c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      sp.position.set(b.p[0], b.p[1], b.p[2]);
      sp.scale.setScalar(b.s);
      this.scene.add(sp);
    }
  }

  private buildRift() {
    this.rift.rotation.set(-1.36, 0, 0.22);
    this.scene.add(this.rift);

    const core = new THREE.Mesh(new THREE.SphereGeometry(1.45, 48, 48), new THREE.MeshBasicMaterial({ color: "#000000" }));
    this.scene.add(core);

    this.diskMat = new THREE.ShaderMaterial({
      vertexShader: diskVertex,
      fragmentShader: diskFragment,
      uniforms: {
        uTime: { value: 0 },
        uGain: { value: 1 },
        uInner: { value: 1.55 },
        uOuter: { value: 6.2 },
        uA: { value: GREEN.clone() },
        uB: { value: GOLD.clone() },
        uC: { value: PINK.clone() },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const disk = new THREE.Mesh(new THREE.RingGeometry(1.55, 6.2, 160, 8), this.diskMat);
    this.rift.add(disk);

    // photon ring and a halo standing "up" (fake lensing of the far side of the disk)
    const photon = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.035, 12, 160), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.3, 1.6, 1.3) }));
    this.scene.add(photon);
    const haloMat = this.diskMat.clone();
    haloMat.uniforms = { ...this.diskMat.uniforms, uGain: { value: 0.4 }, uOuter: { value: 2.4 } };
    const halo = new THREE.Mesh(new THREE.RingGeometry(1.5, 2.4, 128, 2), haloMat);
    halo.rotation.z = 0.22;
    this.scene.add(halo);

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture("rgba(43,214,123,0.14)"), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.setScalar(11);
    this.scene.add(glow);

    this.coreLight = new THREE.PointLight(GREEN, 60, 40, 1.8);
    this.scene.add(this.coreLight);
    const gold = new THREE.PointLight(GOLD, 18, 30, 1.8);
    gold.position.set(0, -1.5, 2);
    this.scene.add(gold);
  }

  private newWorld(far: boolean): World {
    const hues = [150, 40, 330, 205, 270, 15];
    const hue = hues[Math.floor(Math.random() * hues.length)];
    const size = 0.22 + Math.random() * 0.45;
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(hue / 360, 0.7, 0.4),
      emissive: new THREE.Color().setHSL(hue / 360, 0.9, 0.08),
      roughness: 0.75,
      metalness: 0.1,
      flatShading: true,
    });
    const mesh = new THREE.Mesh(this.worldGeo, mat);
    let ring: THREE.Mesh | undefined;
    if (Math.random() < 0.35) {
      ring = new THREE.Mesh(
        new THREE.RingGeometry(1.5, 1.85, 64),
        new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(hue / 360, 0.7, 0.7), transparent: true, opacity: 0.4, side: THREE.DoubleSide }),
      );
      ring.rotation.x = 1.2 + Math.random() * 0.4;
      mesh.add(ring);
    }
    this.rift.add(mesh);
    return {
      mesh,
      ring,
      r: far ? 12 + Math.random() * 5 : 4 + Math.random() * 12,
      a: Math.random() * Math.PI * 2,
      v: 0.25 + Math.random() * 0.35,
      tilt: (Math.random() - 0.5) * 1.2,
      size,
      spin: (Math.random() - 0.5) * 1.5,
    };
  }

  private buildWorlds() {
    // nudge vertices so worlds look rocky, not perfect spheres
    const p = this.worldGeo.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      v.multiplyScalar(1 + (Math.sin(v.x * 5.1) * Math.cos(v.y * 4.3) * Math.sin(v.z * 3.7)) * 0.08);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    this.worldGeo.computeVertexNormals();
    const n = this.mobile ? 7 : 11;
    for (let i = 0; i < n; i++) this.worlds.push(this.newWorld(false));
  }

  private buildDebris() {
    const n = this.mobile ? 350 : 800;
    this.debris = new THREE.InstancedMesh(
      new THREE.TetrahedronGeometry(0.08, 0),
      new THREE.MeshStandardMaterial({ color: "#8b95a1", metalness: 0.8, roughness: 0.35, flatShading: true }),
      n,
    );
    const tint = new THREE.Color();
    for (let i = 0; i < n; i++) {
      this.debrisData.push({
        r: 6.5 + Math.random() * 5,
        a: Math.random() * Math.PI * 2,
        y: (Math.random() - 0.5) * 0.9,
        v: 0.05 + Math.random() * 0.12,
        s: 0.4 + Math.random() * 1.8,
        rx: Math.random() * 3,
        ry: Math.random() * 3,
      });
      tint.set(Math.random() < 0.15 ? GREEN : Math.random() < 0.1 ? GOLD : "#9aa4b1");
      this.debris.setColorAt(i, tint);
    }
    this.rift.add(this.debris);
  }

  private buildBolts() {
    for (let i = 0; i < 7; i++) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(10 * 3), 3));
      const c = i % 3 === 0 ? PINK.clone().multiplyScalar(3) : GREEN.clone().multiplyScalar(3);
      const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: c, transparent: true, blending: THREE.AdditiveBlending }));
      this.scene.add(line);
      this.bolts.push(line);
    }
    this.regenBolts();
  }

  private regenBolts() {
    for (const b of this.bolts) {
      const pos = b.geometry.attributes.position as THREE.BufferAttribute;
      const dir = new THREE.Vector3().randomDirection();
      const side = new THREE.Vector3().randomDirection().cross(dir).normalize();
      const r0 = 1.6;
      const r1 = 3.5 + Math.random() * 3;
      for (let i = 0; i < 10; i++) {
        const t = i / 9;
        const p = dir.clone().multiplyScalar(r0 + (r1 - r0) * t);
        p.add(side.clone().multiplyScalar(Math.sin(t * Math.PI) * 0.6 + (Math.random() - 0.5) * 0.5));
        pos.setXYZ(i, p.x, p.y, p.z);
      }
      pos.needsUpdate = true;
      (b.material as THREE.LineBasicMaterial).opacity = Math.random() < 0.3 ? 0 : 0.5 + Math.random() * 0.5;
    }
  }

  /** The Sovereign: an extruded riveted iron mask with a burning visor. */
  private buildMask() {
    const iron = new THREE.MeshStandardMaterial({ color: "#3d444e", metalness: 0.95, roughness: 0.38, envMapIntensity: 1.6 });
    const dark = new THREE.MeshStandardMaterial({ color: "#1c2128", metalness: 0.9, roughness: 0.5, envMapIntensity: 1.4 });
    const ext = (shape: THREE.Shape, depth: number, bevel = 0.12) =>
      new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 36 });

    const helm = svgShape([
      "M", 100, 12, "C", 140, 12, 172, 30, 178, 70, "L", 182, 120, "C", 182, 150, 170, 178, 148, 200, "L", 118, 228,
      "C", 108, 236, 92, 236, 82, 228, "L", 52, 200, "C", 30, 178, 18, 150, 18, 120, "L", 22, 70, "C", 28, 30, 60, 12, 100, 12,
    ]);
    helm.holes.push(svgPath(["M", 46, 104, "L", 154, 104, "L", 146, 116, "L", 54, 116, "L", 46, 104]));
    const helmMesh = new THREE.Mesh(ext(helm, 1.2, 0.25), iron);
    helmMesh.position.z = -0.6;
    this.mask.add(helmMesh);

    const brow = new THREE.Mesh(ext(svgShape(["M", 40, 74, "C", 60, 60, 140, 60, 160, 74, "L", 156, 86, "C", 130, 78, 70, 78, 44, 86, "L", 40, 74]), 0.25, 0.06), dark);
    brow.position.z = 0.75;
    this.mask.add(brow);
    const ridge = new THREE.Mesh(ext(svgShape(["M", 100, 18, "L", 106, 70, "L", 100, 226, "L", 94, 70, "L", 100, 18]), 0.2, 0.05), iron);
    ridge.position.z = 0.75;
    this.mask.add(ridge);
    const cheekL = svgShape(["M", 34, 122, "C", 52, 128, 70, 140, 78, 170, "L", 66, 200, "C", 46, 184, 34, 160, 34, 122]);
    const cheekR = svgShape(["M", 166, 122, "C", 148, 128, 130, 140, 122, 170, "L", 134, 200, "C", 154, 184, 166, 160, 166, 122]);
    for (const c of [cheekL, cheekR]) {
      const m = new THREE.Mesh(ext(c, 0.25, 0.06), dark);
      m.position.z = 0.75;
      this.mask.add(m);
    }
    const rivetGeo = new THREE.SphereGeometry(0.2, 16, 12);
    const rivetMat = new THREE.MeshStandardMaterial({ color: "#aab3bf", metalness: 1, roughness: 0.2 });
    for (const [x, y] of [[50, 46], [100, 30], [150, 46], [36, 92], [164, 92], [44, 150], [156, 150], [74, 196], [126, 196], [100, 214]]) {
      const r = new THREE.Mesh(rivetGeo, rivetMat);
      r.position.set((x - 100) / 20, -(y - 120) / 20, 0.85);
      this.mask.add(r);
    }
    for (let i = 0; i < 3; i++) {
      const vent = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.14, 0.2), new THREE.MeshBasicMaterial({ color: "#05070a" }));
      vent.position.set(0, -(176 + i * 10 - 120) / 20, 0.7);
      this.mask.add(vent);
    }
    // the burning visor: a bright plane seen through the slit
    this.maskVisor = new THREE.MeshBasicMaterial({ color: GREEN.clone().multiplyScalar(4) });
    const visor = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 0.75), this.maskVisor);
    visor.position.set(0, 0.2, -0.3);
    this.mask.add(visor);
    this.maskEyes = new THREE.PointLight(GREEN, 30, 12, 2);
    this.maskEyes.position.set(0, 0.2, 2);
    this.mask.add(this.maskEyes);

    this.mask.scale.setScalar(this.mobile ? 1.05 : 1.35);
    this.mask.position.set(0, 3.5, -14);
    this.scene.add(this.mask);
  }

  private spawnBurst(at: THREE.Vector3, color: THREE.Color) {
    const n = 70;
    const pos = new Float32Array(n * 3);
    const vel = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos.set([at.x, at.y, at.z], i * 3);
      const d = new THREE.Vector3().randomDirection().multiplyScalar(1.5 + Math.random() * 3);
      vel.set([d.x, d.y, d.z], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(
      g,
      new THREE.PointsMaterial({ color: color.clone().multiplyScalar(3), size: 0.18, map: glowTexture("rgba(255,255,255,1)"), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    this.scene.add(pts);
    this.bursts.push({ pts, vel, t: 0 });
  }

  /* ---------- inputs ---------- */

  setScroll(p: number) {
    this.scrollTarget = Math.min(1, Math.max(0, p));
  }

  setPointer(x: number, y: number) {
    this.mouse.set(x, y);
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    const mobile = w < 768;
    if (mobile !== this.mobile) {
      this.mobile = mobile;
      this.frames = keyframes(mobile);
    }
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.bloom.setSize(w / 2, h / 2);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 0.8 ? 70 : 55;
    this.camera.updateProjectionMatrix();
  }

  /* ---------- loop ---------- */

  start() {
    if (this.running || this.disposed) return;
    this.running = true;
    this.clock.getDelta();
    const loop = () => {
      if (!this.running) return;
      this.tick(Math.min(0.05, this.clock.getDelta()));
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /** Render a single still frame (reduced motion). */
  renderStill() {
    this.tick(0.016);
  }

  /** If the first few seconds run slowly, drop resolution and bloom so the page stays smooth. */
  private watchPerf(dt: number) {
    if (this.degraded || this.perfFrames < 0) return;
    this.perfFrames++;
    this.perfTime += dt;
    if (this.perfTime < 3) return;
    const fps = this.perfFrames / this.perfTime;
    this.perfFrames = -1;
    if (fps < 40) {
      this.degraded = true;
      this.renderer.setPixelRatio(1);
      this.bloom.enabled = fps >= 24;
      this.resize();
    }
  }

  private tick(dt: number) {
    this.watchPerf(dt);
    const t = this.clock.elapsedTime;
    this.diskMat.uniforms.uTime.value = t;

    // scroll → camera along the keyframes, eased
    this.scroll += (this.scrollTarget - this.scroll) * Math.min(1, dt * 3);
    const f = this.frames;
    let i = 0;
    while (i < f.length - 2 && this.scroll > f[i + 1].p) i++;
    const a = f[i];
    const b = f[i + 1];
    const k = smooth(Math.min(1, Math.max(0, (this.scroll - a.p) / (b.p - a.p))));
    const goalPos = a.cam.clone().lerp(b.cam, k);
    const goalLook = a.look.clone().lerp(b.look, k);
    const goalMask = a.mask + (b.mask - a.mask) * k;
    this.mouseS.lerp(this.mouse, Math.min(1, dt * 2.5));
    goalPos.x += this.mouseS.x * 1.2;
    goalPos.y += -this.mouseS.y * 0.8;
    this.camPos.lerp(goalPos, Math.min(1, dt * 4));
    this.camLook.lerp(goalLook, Math.min(1, dt * 4));
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);

    // the rift breathes
    const pulse = 1 + Math.sin(t * 1.3) * 0.08;
    this.coreLight.intensity = 55 * pulse;

    // worlds spiral inward and get torn apart
    for (let w = 0; w < this.worlds.length; w++) {
      const o = this.worlds[w];
      o.r -= dt * o.v * (0.6 + 10 / (o.r + 2));
      o.a += dt * (2.4 / Math.pow(o.r + 0.5, 0.9));
      const near = Math.max(0, Math.min(1, (o.r - 1.6) / 6));
      const s = o.size * (0.25 + 0.75 * near);
      o.mesh.position.set(Math.cos(o.a) * o.r, Math.sin(o.a) * o.r, Math.sin(o.a * 2) * o.tilt);
      o.mesh.scale.set(s * (1 + (1 - near) * 1.6), s * (1 - (1 - near) * 0.5), s);
      o.mesh.rotation.z = o.a + Math.PI / 2;
      o.mesh.rotation.y += dt * o.spin;
      if (o.r < 1.7) {
        const wp = o.mesh.getWorldPosition(new THREE.Vector3());
        this.spawnBurst(wp, (o.mesh.material as THREE.MeshStandardMaterial).color);
        this.rift.remove(o.mesh);
        (o.mesh.material as THREE.Material).dispose();
        if (o.ring) {
          o.ring.geometry.dispose();
          (o.ring.material as THREE.Material).dispose();
        }
        this.worlds[w] = this.newWorld(true);
      }
    }

    for (let j = this.bursts.length - 1; j >= 0; j--) {
      const bu = this.bursts[j];
      bu.t += dt;
      const pos = bu.pts.geometry.attributes.position as THREE.BufferAttribute;
      for (let q = 0; q < pos.count; q++) {
        pos.setXYZ(q, pos.getX(q) + bu.vel[q * 3] * dt, pos.getY(q) + bu.vel[q * 3 + 1] * dt, pos.getZ(q) + bu.vel[q * 3 + 2] * dt);
      }
      pos.needsUpdate = true;
      (bu.pts.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - bu.t / 1.2);
      if (bu.t > 1.2) {
        this.scene.remove(bu.pts);
        bu.pts.geometry.dispose();
        (bu.pts.material as THREE.PointsMaterial).map?.dispose();
        (bu.pts.material as THREE.Material).dispose();
        this.bursts.splice(j, 1);
      }
    }

    // debris ring
    for (let d = 0; d < this.debrisData.length; d++) {
      const o = this.debrisData[d];
      o.a += dt * o.v * (8 / o.r);
      o.rx += dt * 0.8;
      o.ry += dt * 0.6;
      this.dummy.position.set(Math.cos(o.a) * o.r, Math.sin(o.a) * o.r, o.y);
      this.dummy.rotation.set(o.rx, o.ry, 0);
      this.dummy.scale.setScalar(o.s);
      this.dummy.updateMatrix();
      this.debris.setMatrixAt(d, this.dummy.matrix);
    }
    this.debris.instanceMatrix.needsUpdate = true;

    // lightning flickers
    this.boltTimer += dt;
    if (this.boltTimer > 0.09) {
      this.boltTimer = 0;
      this.regenBolts();
    }

    // The Sovereign watches
    this.maskLevel += (goalMask - this.maskLevel) * Math.min(1, dt * 2);
    const flicker = 0.85 + Math.sin(t * 7) * 0.05 + (Math.random() < 0.02 ? -0.4 : 0);
    this.maskVisor.color.copy(GREEN).multiplyScalar((1 + this.maskLevel * 4) * flicker);
    this.maskEyes.intensity = 40 * this.maskLevel * flicker;
    this.mask.position.y = 2.5 + this.maskLevel * 1.5 + Math.sin(t * 0.7) * 0.25;
    this.mask.lookAt(this.camera.position.x * 0.35, this.camera.position.y * 0.5 + 2, this.camera.position.z);

    this.stars.rotation.y = t * 0.006 + this.scroll * 0.6;
    this.composer.render(dt);
  }

  dispose() {
    this.disposed = true;
    this.stop();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      const mats = Array.isArray(mat) ? mat : mat ? [mat] : [];
      for (const x of mats) {
        (x as THREE.MeshBasicMaterial).map?.dispose();
        x.dispose();
      }
    });
    this.envTex?.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }
}

export function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}
