import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  X,
  Flag,
  Trophy,
  Timer,
  Gauge,
  Zap,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import confetti from "canvas-confetti";
import { sound } from "../../utils/audio";

interface CarRaceMiniGameProps {
  dogName: string;
  dogEnergy: number;
  onClose: () => void;
  /** score, coinsEarned, energyUsed */
  onGameComplete: (score: number, coinsEarned: number, energyUsed: number) => void;
}

type Phase = "countdown" | "racing" | "finished";

interface RaceResult {
  place: 1 | 2;
  time: number;
  score: number;
  coins: number;
}

/**
 * The "Galaxy Speedway" circuit. Generated from a smooth radial function so
 * it is guaranteed to be a simple (non-self-intersecting) closed loop — every
 * point is single-valued in angle, so the ribbons can never fold over
 * themselves or tear the walls (the "bugged-out wall" glitch).
 */
const LOOP_POINTS: [number, number][] = (() => {
  const R0 = 58;
  const N = 16;
  const out: [number, number][] = [];
  for (let k = 0; k < N; k++) {
    const th = (k / N) * Math.PI * 2;
    const r = R0 * (1 + 0.09 * Math.sin(2 * th + 0.7) + 0.045 * Math.sin(3 * th + 1.9));
    out.push([Math.cos(th) * r * 1.03, Math.sin(th) * r * 1.14]);
  }
  return out;
})();

const TOTAL_LAPS = 3;
const SAMPLES = 460;
const HALF_ROAD = 7.0;
const CAR_HALF = 1.05;
const PLAYER_MAX = 44; // units / second
const AI_BASE = 36.5;
/** Sample-index ranges where a glowing boost pad launches the car. */
const BOOST_RANGES: [number, number][] = [
  [Math.round(SAMPLES * 0.13), Math.round(SAMPLES * 0.17)],
  [Math.round(SAMPLES * 0.62), Math.round(SAMPLES * 0.66)],
];

export const CarRaceMiniGame: React.FC<CarRaceMiniGameProps> = ({
  dogName,
  dogEnergy,
  onClose,
  onGameComplete,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("countdown");
  const [countdown, setCountdown] = useState(3);
  const [lap, setLap] = useState(1);
  const [place, setPlace] = useState<1 | 2>(1);
  const [speedKmh, setSpeedKmh] = useState(0);
  const [raceTime, setRaceTime] = useState(0);
  const [boosting, setBoosting] = useState(false);
  const [result, setResult] = useState<RaceResult | null>(null);

  // Live input flags (keyboard + on-screen touch pad)
  const keysRef = useRef({ w: false, a: false, s: false, d: false });
  const phaseRef = useRef<Phase>("countdown");
  const finishedRef = useRef(false);
  const completeRef = useRef(onGameComplete);
  completeRef.current = onGameComplete;
  phaseRef.current = phase;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // ---------------- Scene setup ----------------
    const scene = new THREE.Scene();
    const VOID = 0x090418;
    scene.background = new THREE.Color(VOID);
    scene.fog = new THREE.Fog(VOID, 90, 240);

    const camera = new THREE.PerspectiveCamera(62, mount.clientWidth / mount.clientHeight, 0.1, 700);
    camera.position.set(0, 10, -70);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);

    // Space lighting: cool nebula bounce + a soft sun for form
    scene.add(new THREE.HemisphereLight(0x6d7cff, 0x0a0418, 0.7));
    const sun = new THREE.DirectionalLight(0xfff0d0, 1.2);
    sun.position.set(60, 90, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -100;
    sun.shadow.camera.right = 100;
    sun.shadow.camera.top = 100;
    sun.shadow.camera.bottom = -100;
    scene.add(sun);

    // ---- Star dome (canvas sky with nebula clouds) ----
    const domeCanvas = document.createElement("canvas");
    domeCanvas.width = 1024;
    domeCanvas.height = 512;
    const dc = domeCanvas.getContext("2d")!;
    const bg = dc.createLinearGradient(0, 0, 0, 512);
    bg.addColorStop(0, "#05010f");
    bg.addColorStop(0.55, "#160b33");
    bg.addColorStop(1, "#2a1052");
    dc.fillStyle = bg;
    dc.fillRect(0, 0, 1024, 512);
    for (let n = 0; n < 9; n++) {
      const nx = Math.random() * 1024;
      const ny = Math.random() * 512;
      const r = 70 + Math.random() * 160;
      const ng = dc.createRadialGradient(nx, ny, 0, nx, ny, r);
      ng.addColorStop(
        0,
        ["rgba(124,58,237,0.55)", "rgba(34,211,238,0.45)", "rgba(244,114,182,0.45)"][n % 3]
      );
      ng.addColorStop(1, "rgba(0,0,0,0)");
      dc.fillStyle = ng;
      dc.fillRect(nx - r, ny - r, r * 2, r * 2);
    }
    for (let i = 0; i < 520; i++) {
      dc.fillStyle = Math.random() > 0.2 ? "rgba(255,255,255,0.92)" : "#a5f3fc";
      const size = Math.random() > 0.88 ? 3 : 1.5;
      dc.fillRect(Math.random() * 1024, Math.random() * 512, size, size);
    }
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(340, 40, 28),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(domeCanvas), side: THREE.BackSide, fog: false })
    );
    scene.add(dome);

    // ---- Big ringed planet + moon overhead ----
    const planet = new THREE.Mesh(
      new THREE.SphereGeometry(26, 40, 32),
      new THREE.MeshStandardMaterial({ color: 0x7c3aed, emissive: 0x3b0f70, emissiveIntensity: 0.7, roughness: 0.85 })
    );
    planet.position.set(-150, 96, -190);
    scene.add(planet);
    const planetRing = new THREE.Mesh(
      new THREE.TorusGeometry(40, 2.4, 10, 60),
      new THREE.MeshBasicMaterial({ color: 0xf0abfc, transparent: true, opacity: 0.7 })
    );
    planetRing.position.copy(planet.position);
    planetRing.rotation.set(Math.PI / 2.4, 0.3, 0);
    scene.add(planetRing);
    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(9, 24, 20),
      new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x0e7490, emissiveIntensity: 0.6 })
    );
    moon.position.set(150, 70, -150);
    scene.add(moon);

    // ---- Nebula floor under the floating track ----
    const floorCanvas = document.createElement("canvas");
    floorCanvas.width = 512;
    floorCanvas.height = 512;
    const fc = floorCanvas.getContext("2d")!;
    const fg = fc.createRadialGradient(256, 256, 20, 256, 256, 256);
    fg.addColorStop(0, "#140a2a");
    fg.addColorStop(0.6, "#0a0518");
    fg.addColorStop(1, "#030109");
    fc.fillStyle = fg;
    fc.fillRect(0, 0, 512, 512);
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(220, 64),
      new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(floorCanvas), roughness: 1 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.4;
    scene.add(floor);

    // ---------------- The track ----------------
    const curve = new THREE.CatmullRomCurve3(
      LOOP_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z)),
      true,
      "catmullrom",
      0.5
    );
    curve.arcLengthDivisions = 800;
    const pts = curve.getSpacedPoints(SAMPLES); // SAMPLES+1, last === first
    const totalLen = curve.getLength();

    const centers: THREE.Vector3[] = [];
    const tangents: THREE.Vector3[] = [];
    const normals: THREE.Vector3[] = [];
    for (let i = 0; i < SAMPLES; i++) {
      const p = pts[i];
      const prev = pts[(i - 1 + SAMPLES) % SAMPLES];
      const next = pts[(i + 1) % SAMPLES];
      const tan = new THREE.Vector3(next.x - prev.x, 0, next.z - prev.z).normalize();
      const nor = new THREE.Vector3(tan.z, 0, -tan.x).normalize(); // left-hand normal
      centers.push(p.clone());
      tangents.push(tan);
      normals.push(nor);
    }

    // Build a closed ribbon offset ±width around the centreline
    const ribbon = (offset: number, width: number): THREE.BufferGeometry => {
      const pos: number[] = [];
      const idx: number[] = [];
      for (let i = 0; i < SAMPLES; i++) {
        const n = normals[i];
        const c = centers[i];
        const l = c.clone().addScaledVector(n, offset + width).setY(0);
        const r = c.clone().addScaledVector(n, offset - width).setY(0);
        pos.push(l.x, l.y, l.z, r.x, r.y, r.z);
      }
      for (let i = 0; i < SAMPLES; i++) {
        const a = i * 2;
        const b = i * 2 + 1;
        const c = ((i + 1) % SAMPLES) * 2;
        const d = ((i + 1) % SAMPLES) * 2 + 1;
        idx.push(a, c, b, b, c, d);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    };

    // Asphalt
    const road = new THREE.Mesh(
      ribbon(0, HALF_ROAD),
      new THREE.MeshStandardMaterial({ color: 0x0b0b16, roughness: 0.92, metalness: 0.2 })
    );
    road.position.y = 0.02;
    road.receiveShadow = true;
    scene.add(road);

    // Glowing neon edge lines (cyan)
    for (const side of [1, -1]) {
      const edge = new THREE.Mesh(
        ribbon(side * HALF_ROAD, 0.5),
        new THREE.MeshBasicMaterial({ color: 0x22d3ee })
      );
      edge.position.y = 0.06;
      scene.add(edge);
    }

    // Magenta dashed centre line
    const linePos: number[] = [];
    const lineIdx: number[] = [];
    for (let i = 0; i < SAMPLES; i++) {
      const n = normals[i];
      const c = centers[i];
      const l = c.clone().addScaledVector(n, 0.24).setY(0.05);
      const r = c.clone().addScaledVector(n, -0.24).setY(0.05);
      linePos.push(l.x, l.y, l.z, r.x, r.y, r.z);
    }
    for (let i = 0; i < SAMPLES; i += 14) {
      for (let k = 0; k < 7 && i + k + 1 < SAMPLES; k++) {
        const a = (i + k) * 2;
        const b = (i + k) * 2 + 1;
        const c = (i + k + 1) * 2;
        const d = (i + k + 1) * 2 + 1;
        lineIdx.push(a, c, b, b, c, d);
      }
    }
    const lineGeom = new THREE.BufferGeometry();
    lineGeom.setAttribute("position", new THREE.Float32BufferAttribute(linePos, 3));
    lineGeom.setIndex(lineIdx);
    scene.add(new THREE.Mesh(lineGeom, new THREE.MeshBasicMaterial({ color: 0xf472b6 })));

    // ---- Low glowing barrier wall along both edges of the track ----
    const WALL_H = 1.4;
    const wallGeomAt = (side: number, height: number) => {
      const pos: number[] = [];
      const idx: number[] = [];
      const off = HALF_ROAD + 0.35;
      for (let i = 0; i < SAMPLES; i++) {
        const n = normals[i];
        const c = centers[i];
        const bx = c.x + n.x * side * off;
        const bz = c.z + n.z * side * off;
        pos.push(bx, 0.04, bz, bx, height, bz);
      }
      for (let i = 0; i < SAMPLES; i++) {
        const a = i * 2;
        const b = i * 2 + 1;
        const c = ((i + 1) % SAMPLES) * 2;
        const d = ((i + 1) % SAMPLES) * 2 + 1;
        idx.push(a, c, b, b, c, d);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    };
    for (const side of [1, -1]) {
      const wall = new THREE.Mesh(
        wallGeomAt(side, WALL_H),
        new THREE.MeshStandardMaterial({
          color: 0x0e2436,
          emissive: side === 1 ? 0x22d3ee : 0xf472b6,
          emissiveIntensity: 0.55,
          side: THREE.DoubleSide,
          roughness: 0.5,
          metalness: 0.3,
        })
      );
      scene.add(wall);
      // Bright neon cap running along the top of the wall
      const cap = new THREE.Mesh(
        ribbon(side * (HALF_ROAD + 0.35), 0.18),
        new THREE.MeshBasicMaterial({ color: side === 1 ? 0x22d3ee : 0xf472b6 })
      );
      cap.position.y = WALL_H;
      scene.add(cap);
    }

    // ---- Neon arches spanning the road at intervals ----
    const makeArch = (i: number, height: number, color: number) => {
      const c = centers[i];
      const n = normals[i];
      const beamAngle = Math.atan2(-n.z, n.x);
      const g = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 1.5,
        transparent: true,
        opacity: 0.92,
      });
      const postGeom = new THREE.BoxGeometry(0.42, height, 0.42);
      for (const side of [1, -1]) {
        const post = new THREE.Mesh(postGeom, mat);
        post.position.copy(c).addScaledVector(n, side * (HALF_ROAD + 0.7));
        post.position.y = height / 2;
        g.add(post);
      }
      const beam = new THREE.Mesh(new THREE.BoxGeometry((HALF_ROAD + 0.7) * 2, 0.5, 0.5), mat);
      beam.position.set(c.x, height, c.z);
      beam.rotation.y = beamAngle;
      g.add(beam);
      scene.add(g);
      return g;
    };
    const archColors = [0x22d3ee, 0xf472b6, 0xa78bfa, 0xfde047];
    for (let k = 0; k < 7; k++) {
      const i = Math.round(((k + 0.5) / 7) * SAMPLES) % SAMPLES;
      makeArch(i, 7.2, archColors[k % archColors.length]);
    }

    // ---- Start / finish gantry with checkered banner + start lights ----
    const s0 = centers[0];
    const n0 = normals[0];
    const beamAngle0 = Math.atan2(-n0.z, n0.x);
    const startLights: THREE.MeshStandardMaterial[] = [];
    {
      const gantry = new THREE.Group();
      const postMat = new THREE.MeshStandardMaterial({ color: 0xe5e7eb, emissive: 0x475569, emissiveIntensity: 0.4 });
      const postGeom = new THREE.BoxGeometry(0.6, 9, 0.6);
      for (const side of [1, -1]) {
        const post = new THREE.Mesh(postGeom, postMat);
        post.position.copy(s0).addScaledVector(n0, side * (HALF_ROAD + 0.9));
        post.position.y = 4.5;
        post.castShadow = true;
        gantry.add(post);
      }
      const beam = new THREE.Mesh(new THREE.BoxGeometry((HALF_ROAD + 0.9) * 2, 1.4, 0.7), postMat);
      beam.position.set(s0.x, 9, s0.z);
      beam.rotation.y = beamAngle0;
      gantry.add(beam);

      // Checkered banner
      const bannerCanvas = document.createElement("canvas");
      bannerCanvas.width = 256;
      bannerCanvas.height = 64;
      const bc = bannerCanvas.getContext("2d")!;
      for (let x = 0; x < 16; x++) {
        for (let y = 0; y < 4; y++) {
          bc.fillStyle = (x + y) % 2 ? "#111827" : "#f8fafc";
          bc.fillRect(x * 16, y * 16, 16, 16);
        }
      }
      const banner = new THREE.Mesh(
        new THREE.PlaneGeometry((HALF_ROAD + 0.9) * 2, 1.3),
        new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(bannerCanvas), side: THREE.DoubleSide })
      );
      banner.position.set(s0.x, 7.9, s0.z);
      banner.rotation.y = beamAngle0 + Math.PI / 2;
      gantry.add(banner);

      // "FINISH" sign
      const signCanvas = document.createElement("canvas");
      signCanvas.width = 256;
      signCanvas.height = 64;
      const sc = signCanvas.getContext("2d")!;
      sc.fillStyle = "rgba(9,4,24,0.9)";
      sc.beginPath();
      sc.roundRect(6, 6, 244, 52, 14);
      sc.fill();
      sc.strokeStyle = "#fde047";
      sc.lineWidth = 4;
      sc.stroke();
      sc.fillStyle = "#fde047";
      sc.font = "bold 34px sans-serif";
      sc.textAlign = "center";
      sc.fillText("FINISH", 128, 44);
      const sign = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(signCanvas), transparent: true })
      );
      sign.scale.set(5.2, 1.3, 1);
      sign.position.set(s0.x, 10.6, s0.z);
      gantry.add(sign);

      // Five start lights across the beam
      for (let k = 0; k < 5; k++) {
        const lm = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 1.6 });
        startLights.push(lm);
        const light = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 14), lm);
        const off = (k - 2) * 1.1;
        light.position.set(
          s0.x + n0.x * off,
          8.1,
          s0.z + n0.z * off
        );
        gantry.add(light);
      }
      scene.add(gantry);
    }

    // Checkered start line on the tarmac
    {
      const sfCanvas = document.createElement("canvas");
      sfCanvas.width = 256;
      sfCanvas.height = 64;
      const sfc = sfCanvas.getContext("2d")!;
      for (let x = 0; x < 16; x++) {
        for (let y = 0; y < 4; y++) {
          sfc.fillStyle = (x + y) % 2 ? "#111827" : "#f8fafc";
          sfc.fillRect(x * 16, y * 16, 16, 16);
        }
      }
      const startLine = new THREE.Mesh(
        new THREE.PlaneGeometry(HALF_ROAD * 2, 3.6),
        new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sfCanvas) })
      );
      startLine.rotation.x = -Math.PI / 2;
      startLine.rotation.z = -Math.atan2(tangents[0].x, tangents[0].z);
      startLine.position.set(s0.x, 0.07, s0.z);
      scene.add(startLine);
    }

    // ---- Boost pads (glowing orange chevrons on two straights) ----
    const boostMats: THREE.MeshBasicMaterial[] = [];
    for (const [a, b] of BOOST_RANGES) {
      for (let i = a; i <= b; i += 4) {
        const c = centers[i];
        const tan = tangents[i];
        const pad = new THREE.Mesh(
          new THREE.PlaneGeometry(HALF_ROAD * 1.5, 1.1),
          new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.85 })
        );
        boostMats.push(pad.material as THREE.MeshBasicMaterial);
        pad.rotation.x = -Math.PI / 2;
        pad.rotation.z = -Math.atan2(tan.x, tan.z);
        pad.position.set(c.x, 0.08, c.z);
        scene.add(pad);
      }
    }

    // ---- Floating neon crystals (slowly spinning) ----
    const crystals: THREE.Mesh[] = [];
    const crystalColors = [0x22d3ee, 0xf472b6, 0xa78bfa, 0xfde047, 0x4ade80];
    for (let k = 0; k < 16; k++) {
      const ang = (k / 16) * Math.PI * 2;
      const rr = 92 + (k % 3) * 14;
      const mat = new THREE.MeshStandardMaterial({
        color: crystalColors[k % crystalColors.length],
        emissive: crystalColors[k % crystalColors.length],
        emissiveIntensity: 0.9,
        roughness: 0.2,
        metalness: 0.3,
      });
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(2.2 + (k % 4), 0), mat);
      crystal.position.set(Math.cos(ang) * rr, 6 + (k % 5) * 4, Math.sin(ang) * rr);
      crystals.push(crystal);
      scene.add(crystal);
    }

    // ---- Distant neon skyline towers ----
    for (let k = 0; k < 18; k++) {
      const ang = (k / 18) * Math.PI * 2;
      const rr = 150 + (k % 4) * 22;
      const h = 26 + (k % 5) * 14;
      const tower = new THREE.Mesh(
        new THREE.BoxGeometry(8, h, 8),
        new THREE.MeshStandardMaterial({ color: 0x120a26, emissive: 0x3b0764, emissiveIntensity: 0.5 })
      );
      tower.position.set(Math.cos(ang) * rr, h / 2 - 2, Math.sin(ang) * rr);
      scene.add(tower);
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(1, 10, 10),
        new THREE.MeshBasicMaterial({ color: archColors[k % archColors.length] })
      );
      cap.position.set(tower.position.x, h + 0.5, tower.position.z);
      scene.add(cap);
    }

    // ---------------- Cars ----------------
    function makeCar(color: number, accent: number, withDriver: boolean) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(2.0, 0.55, 3.9),
        new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.5, emissive: color, emissiveIntensity: 0.12 })
      );
      body.position.y = 0.62;
      body.castShadow = true;
      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 0.5, 1.7),
        new THREE.MeshStandardMaterial({ color: accent, roughness: 0.25, metalness: 0.4 })
      );
      cabin.position.set(0, 1.05, 0.15);
      cabin.castShadow = true;
      const wing = new THREE.Mesh(
        new THREE.BoxGeometry(1.9, 0.12, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x0b0b14, emissive: accent, emissiveIntensity: 0.6 })
      );
      wing.position.set(0, 1.0, -1.8);
      // Underglow strip
      const glow = new THREE.Mesh(
        new THREE.BoxGeometry(2.05, 0.06, 3.9),
        new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.8 })
      );
      glow.position.y = 0.34;
      g.add(body, cabin, wing, glow);

      const wheelGeom = new THREE.CylinderGeometry(0.44, 0.44, 0.38, 16);
      const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0a0a12, emissive: 0x1f2937, emissiveIntensity: 0.4 });
      const wheels: THREE.Mesh[] = [];
      for (const [wx, wz] of [[-1.0, 1.3], [1.0, 1.3], [-1.0, -1.3], [1.0, -1.3]] as [number, number][]) {
        const w = new THREE.Mesh(wheelGeom, wheelMat);
        w.rotation.z = Math.PI / 2;
        w.position.set(wx, 0.44, wz);
        w.castShadow = true;
        wheels.push(w);
        g.add(w);
      }

      if (withDriver) {
        const head = new THREE.Mesh(
          new THREE.SphereGeometry(0.32, 16, 16),
          new THREE.MeshStandardMaterial({ color: 0xd9a441 })
        );
        head.position.set(0, 1.5, 0.3);
        head.castShadow = true;
        const snout = new THREE.Mesh(
          new THREE.BoxGeometry(0.2, 0.16, 0.22),
          new THREE.MeshStandardMaterial({ color: 0x8a5a1e })
        );
        snout.position.set(0, 1.42, 0.62);
        const earGeom = new THREE.BoxGeometry(0.11, 0.22, 0.08);
        const earL = new THREE.Mesh(earGeom, new THREE.MeshStandardMaterial({ color: 0x8a5a1e }));
        earL.position.set(-0.15, 1.75, 0.3);
        const earR = earL.clone();
        earR.position.x = 0.15;
        g.add(head, snout, earL, earR);
      }
      g.userData.wheels = wheels;
      return g;
    }

    const playerCar = makeCar(0xff2d55, 0x7dd3fc, true);
    const rivalCar = makeCar(0x2563eb, 0x93c5fd, false);
    scene.add(playerCar, rivalCar);

    // ---------------- Simulation state ----------------
    const sampleS: number[] = new Array(SAMPLES);
    for (let i = 0; i < SAMPLES; i++) sampleS[i] = (i / SAMPLES) * totalLen;

    const laneOffset = HALF_ROAD - 2.6;
    // A rested dog drives a little faster — low energy trims the top speed.
    const maxSpeed = PLAYER_MAX * (0.82 + (Math.max(0, Math.min(100, dogEnergy)) / 100) * 0.18);
    // Start a little past the line so the finish gantry sits behind the grid.
    const START_I = 34;
    const startPos = (side: number) => centers[START_I].clone().addScaledVector(normals[START_I], side * laneOffset);
    const headingFromTangent = (i: number) => Math.atan2(tangents[i].x, tangents[i].z);

    const sim = {
      elapsed: 0,
      raceStart: -1,
      countdownFrom: 3.999,
      player: {
        pos: startPos(1),
        heading: headingFromTangent(START_I),
        speed: 0,
        lap: 0,
        s: sampleS[START_I],
        prevS: sampleS[START_I],
        idx: START_I,
      },
      ai: {
        pos: startPos(-1),
        heading: headingFromTangent(START_I),
        speed: 0,
        lap: 0,
        s: sampleS[START_I],
        prevS: 0,
        idx: START_I,
        target: AI_BASE,
      },
      boost: 0,
      finishedPlace: null as 1 | 2 | null,
    };

    const nearestSample = (p: THREE.Vector3, lastIdx: number) => {
      let best = lastIdx;
      let bestD = Infinity;
      for (let k = -16; k <= 16; k++) {
        const i = (lastIdx + k + SAMPLES) % SAMPLES;
        const dx = centers[i].x - p.x;
        const dz = centers[i].z - p.z;
        const d = dx * dx + dz * dz;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      if (bestD > 49) {
        for (let i = 0; i < SAMPLES; i += 2) {
          const dx = centers[i].x - p.x;
          const dz = centers[i].z - p.z;
          const d = dx * dx + dz * dz;
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        }
      }
      return { idx: best, lateral: Math.sqrt(bestD) };
    };

    const lateralOffset = (p: THREE.Vector3, idx: number) => {
      const n = normals[idx];
      return (p.x - centers[idx].x) * n.x + (p.z - centers[idx].z) * n.z;
    };

    const progressS = (p: THREE.Vector3, idx: number) => {
      const t = tangents[idx];
      const along = (p.x - centers[idx].x) * t.x + (p.z - centers[idx].z) * t.z;
      return { s: sampleS[idx] + along, idx };
    };

    // ---------------- Engine sound ----------------
    let engineOsc: OscillatorNode | null = null;
    let engineGain: GainNode | null = null;
    const audioCtx = sound.getContext();
    if (audioCtx) {
      try {
        engineOsc = audioCtx.createOscillator();
        engineOsc.type = "sawtooth";
        engineOsc.frequency.value = 60;
        engineGain = audioCtx.createGain();
        engineGain.gain.value = 0;
        engineOsc.connect(engineGain);
        engineGain.connect(audioCtx.destination);
        engineOsc.start();
      } catch {
        engineOsc = null;
      }
    }

    // ---------------- Finish ----------------
    const finishRace = (place: 1 | 2, time: number) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      const timeBonus = Math.max(0, Math.round(95 - time)) * (place === 1 ? 2 : 1);
      const score = (place === 1 ? 150 : 80) + timeBonus;
      const coins = Math.round(score / 5);
      sim.finishedPlace = place;
      setPhase("finished");
      phaseRef.current = "finished";
      setPlace(place);
      setResult({ place, time, score, coins });
      sound.playRewardFanfare();
      if (place === 1) confetti({ particleCount: 90, spread: 80, origin: { y: 0.5 } });
      completeRef.current(score, coins, 14);
    };

    // ---------------- Input ----------------
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "w" || k === "arrowup") { keysRef.current.w = true; e.preventDefault(); }
      if (k === "s" || k === "arrowdown") { keysRef.current.s = true; e.preventDefault(); }
      if (k === "a" || k === "arrowleft") { keysRef.current.a = true; e.preventDefault(); }
      if (k === "d" || k === "arrowright") { keysRef.current.d = true; e.preventDefault(); }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "w" || k === "arrowup") keysRef.current.w = false;
      if (k === "s" || k === "arrowdown") keysRef.current.s = false;
      if (k === "a" || k === "arrowleft") keysRef.current.a = false;
      if (k === "d" || k === "arrowright") keysRef.current.d = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    // ---------------- Loop ----------------
    const clock = new THREE.Clock();
    let raf = 0;
    let hudAccum = 0;
    let lastCountdown = -1;
    let lastBoostState = false;
    const camPos = new THREE.Vector3(sim.player.pos.x, 8, sim.player.pos.z - 15);
    const camLook = new THREE.Vector3();

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      sim.elapsed += dt;

      // Countdown
      if (sim.raceStart < 0) {
        const remaining = sim.countdownFrom - sim.elapsed;
        const cd = remaining > 1 ? Math.ceil(remaining - 1) : 0;
        if (cd !== lastCountdown) {
          lastCountdown = cd;
          setCountdown(cd);
        }
        if (remaining <= 0.5) {
          sim.raceStart = sim.elapsed;
          setPhase("racing");
          phaseRef.current = "racing";
          sound.playWhistle();
        }
      }

      const racing = phaseRef.current === "racing";

      // ---- Player physics ----
      const p = sim.player;
      const keys = keysRef.current;
      if (racing) {
        if (keys.w) p.speed += 26 * dt;
        else if (keys.s) p.speed -= 34 * dt;
        else p.speed *= 1 - 1.3 * dt;

        const goingForward = p.speed >= 0;
        const steerInput = (keys.a ? 1 : 0) + (keys.d ? -1 : 0);
        if (steerInput !== 0) {
          const grip = Math.min(1, Math.abs(p.speed) / 14);
          p.heading += steerInput * 2.0 * dt * grip * (goingForward ? 1 : -1);
        }
        p.speed = THREE.MathUtils.clamp(p.speed, -14, maxSpeed);
      } else {
        p.speed *= 1 - 4 * dt;
      }

      p.pos.x += Math.sin(p.heading) * p.speed * dt;
      p.pos.z += Math.cos(p.heading) * p.speed * dt;

      // Keep the car on the road: barrier bump when it drifts off the strip
      const near = nearestSample(p.pos, p.idx);
      p.idx = near.idx;
      const off = lateralOffset(p.pos, p.idx);
      const limit = HALF_ROAD + 0.35 - CAR_HALF; // the glowing wall is the outer edge
      if (Math.abs(off) > limit) {
        const n = normals[p.idx];
        const push = Math.abs(off) - limit;
        p.pos.x -= n.x * Math.sign(off) * push;
        p.pos.z -= n.z * Math.sign(off) * push;
        p.speed *= 0.72; // scrub speed on the barrier
      }

      // ---- Boost pads ----
      if (racing) {
        for (const [a, b] of BOOST_RANGES) {
          if (p.idx >= a && p.idx <= b) sim.boost = 1.0;
        }
      }
      sim.boost = Math.max(0, sim.boost - dt);
      const boosted = sim.boost > 0;
      if (boosted && racing) {
        p.speed = Math.min(p.speed + 30 * dt, maxSpeed * 1.5);
      }

      // Progress + lap counting for the player
      const prog = progressS(p.pos, p.idx);
      let sNow = prog.s;
      if (sNow < -totalLen * 0.25) sNow += totalLen;
      else if (sNow > totalLen * 1.25) sNow -= totalLen;
      if (p.prevS > totalLen * 0.75 && sNow < totalLen * 0.25) {
        p.lap += 1;
        if (racing && p.lap >= TOTAL_LAPS) {
          finishRace(sim.ai.lap >= TOTAL_LAPS ? 2 : 1, sim.elapsed - sim.raceStart);
        }
      } else if (p.prevS < totalLen * 0.25 && sNow > totalLen * 0.75) {
        p.lap = Math.max(0, p.lap - 1);
      }
      p.prevS = sNow;
      p.s = sNow;

      playerCar.position.copy(p.pos);
      playerCar.rotation.y = p.heading;
      const pWheels = playerCar.userData.wheels as THREE.Mesh[];
      const spin = p.speed * dt * 1.6;
      pWheels.forEach((w) => (w.rotation.x += spin));

      // ---- AI opponent (follows the racing line with rubber-banding) ----
      const ai = sim.ai;
      if (racing) {
        const playerTotal = p.lap * totalLen + p.s;
        const aiTotal = ai.lap * totalLen + ai.s;
        const gap = playerTotal - aiTotal; // + = player ahead
        const rubber = THREE.MathUtils.clamp(gap * 0.06, -3.5, 4.5);
        ai.target = AI_BASE + rubber + Math.sin(sim.elapsed * 0.8) * 1.2;
        ai.speed += (ai.target - ai.speed) * Math.min(1, dt * 1.5);
      } else {
        ai.speed += (0 - ai.speed) * Math.min(1, dt * 2);
      }
      ai.s += ai.speed * dt;
      while (ai.s >= totalLen) {
        ai.s -= totalLen;
        ai.lap += 1;
      }
      const aiIdx = Math.floor((ai.s / totalLen) * SAMPLES) % SAMPLES;
      const aiBase = centers[aiIdx];
      const aiN = normals[aiIdx];
      ai.pos.copy(aiBase).addScaledVector(aiN, -laneOffset * 0.85);
      ai.heading = headingFromTangent(aiIdx);
      rivalCar.position.copy(ai.pos);
      rivalCar.rotation.y = ai.heading;
      const rWheels = rivalCar.userData.wheels as THREE.Mesh[];
      rWheels.forEach((w) => (w.rotation.x += ai.speed * dt * 1.6));

      // ---- Start lights: red while counting down, green at GO ----
      const lightsGo = sim.raceStart >= 0;
      for (const lm of startLights) {
        lm.color.setHex(lightsGo ? 0x22c55e : 0xef4444);
        lm.emissive.setHex(lightsGo ? 0x22c55e : 0xef4444);
      }

      // ---- Animate the scenery ----
      const t = sim.elapsed;
      for (const c of crystals) {
        c.rotation.x += dt * 0.6;
        c.rotation.y += dt * 0.9;
        c.position.y += Math.sin(t * 1.2 + c.position.x) * dt * 0.6;
      }
      for (const m of boostMats) {
        m.opacity = boosted ? 1 : 0.55 + Math.sin(t * 6) * 0.18;
      }

      // ---- Chase camera (pulls back + widens FOV while boosting) ----
      const back = boosted ? 17 : 15;
      const targetCam = new THREE.Vector3(
        p.pos.x - Math.sin(p.heading) * back,
        boosted ? 6.8 : 7.6,
        p.pos.z - Math.cos(p.heading) * back
      );
      camPos.lerp(targetCam, Math.min(1, dt * 4));
      camera.position.copy(camPos);
      // Look a little ahead of the car so more road is in view
      const lookAhead = 6;
      camLook.lerp(
        new THREE.Vector3(
          p.pos.x + Math.sin(p.heading) * lookAhead,
          0.7,
          p.pos.z + Math.cos(p.heading) * lookAhead
        ),
        Math.min(1, dt * 6)
      );
      camera.lookAt(camLook);
      camera.fov = THREE.MathUtils.lerp(camera.fov, boosted ? 74 : 62, Math.min(1, dt * 3));
      camera.updateProjectionMatrix();

      // ---- Engine sound ----
      if (engineOsc && engineGain && audioCtx) {
        const s = sound.getSettings();
        const vol = s.sfxEnabled ? s.masterVolume * s.sfxVolume : 0;
        const spd = Math.max(0, p.speed);
        engineOsc.frequency.setTargetAtTime(55 + spd * 5.2, audioCtx.currentTime, 0.05);
        engineGain.gain.setTargetAtTime(vol * (0.02 + spd * 0.0016), audioCtx.currentTime, 0.08);
      }

      // ---- HUD (throttled) ----
      hudAccum += dt;
      if (hudAccum > 0.1) {
        hudAccum = 0;
        if (racing) {
          setRaceTime(sim.elapsed - sim.raceStart);
          setSpeedKmh(Math.max(0, Math.round(p.speed * 2.6)));
          setLap(Math.min(TOTAL_LAPS, Math.max(1, p.lap + 1)));
          const playerTotal = p.lap * totalLen + p.s;
          const aiTotal = ai.lap * totalLen + ai.s;
          setPlace(playerTotal >= aiTotal ? 1 : 2);
        }
        if (boosted !== lastBoostState) {
          lastBoostState = boosted;
          setBoosting(boosted);
        }
      }

      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      if (engineOsc && engineGain && audioCtx) {
        try {
          engineGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.05);
          engineOsc.stop(audioCtx.currentTime + 0.15);
          engineGain.disconnect();
        } catch {
          // ignore
        }
      }
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else if (mat) mat.dispose();
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dogName, dogEnergy]);

  const hold = (key: "w" | "a" | "s" | "d", down: boolean) => {
    keysRef.current[key] = down;
  };

  const padBtn =
    "pointer-events-auto select-none touch-none w-12 h-12 rounded-xl bg-white/12 border border-white/25 text-white flex items-center justify-center active:bg-white/30 backdrop-blur-sm transition-colors";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl bg-[#0b1220] border border-cyan-400/30 rounded-3xl shadow-2xl overflow-hidden text-white flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#0f172a]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-br from-cyan-400 to-fuchsia-500 rounded-xl text-lg">🏎️</div>
            <div>
              <h3 className="text-sm font-black leading-none">
                Galaxy Speedway — Puppy Grand Prix
              </h3>
              <p className="text-[11px] text-white/60 mt-1">
                {dogName} · Energy {dogEnergy}% · {TOTAL_LAPS} laps vs the rival · W A S D
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close race"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* HUD strip */}
        <div className="grid grid-cols-4 gap-2 px-3 py-2 bg-[#111c30] border-b border-white/10 text-center">
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-black uppercase text-white/50 flex items-center gap-1">
              <Flag className="w-3 h-3 text-emerald-400" /> Lap
            </span>
            <span className="text-sm font-black">{lap}/{TOTAL_LAPS}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-black uppercase text-white/50 flex items-center gap-1">
              <Trophy className="w-3 h-3 text-amber-400" /> Place
            </span>
            <span className={`text-sm font-black ${place === 1 ? "text-amber-300" : "text-sky-300"}`}>
              {place === 1 ? "1st" : "2nd"}
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-black uppercase text-white/50 flex items-center gap-1">
              <Timer className="w-3 h-3 text-sky-400" /> Time
            </span>
            <span className="text-sm font-black">{raceTime.toFixed(1)}s</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-black uppercase text-white/50 flex items-center gap-1">
              <Gauge className="w-3 h-3 text-rose-400" /> Speed
            </span>
            <span className="text-sm font-black">{speedKmh}</span>
          </div>
        </div>

        {/* Canvas */}
        <div ref={mountRef} className="relative w-full h-[52vh] min-h-[320px]">
          {/* Countdown overlay */}
          {phase === "countdown" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40">
              <div className="text-6xl font-black text-cyan-300 drop-shadow-[0_0_18px_rgba(34,211,238,0.8)] animate-pulse">
                {countdown > 0 ? countdown : "GO!"}
              </div>
              <p className="mt-2 text-xs font-bold text-white/70">Get ready on the grid… boost pads ahead! ⚡</p>
            </div>
          )}

          {/* Boost flash */}
          {boosting && phase === "racing" && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-400/90 text-[#0b1220] font-black text-xs shadow-lg animate-pulse">
              <Zap className="w-4 h-4 fill-current" /> BOOST!
            </div>
          )}

          {/* Mobile touch controls */}
          {phase === "racing" && (
            <>
              <div className="absolute bottom-3 left-3 flex items-center gap-2">
                <button className={padBtn} onPointerDown={() => hold("a", true)} onPointerUp={() => hold("a", false)} onPointerLeave={() => hold("a", false)} aria-label="Steer left">
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button className={padBtn} onPointerDown={() => hold("d", true)} onPointerUp={() => hold("d", false)} onPointerLeave={() => hold("d", false)} aria-label="Steer right">
                  <ChevronRight className="w-6 h-6" />
                </button>
              </div>
              <div className="absolute bottom-3 right-3 flex flex-col gap-2 items-end">
                <button className={`${padBtn} !bg-emerald-500/40 !border-emerald-300/40`} onPointerDown={() => hold("w", true)} onPointerUp={() => hold("w", false)} onPointerLeave={() => hold("w", false)} aria-label="Accelerate">
                  <ChevronUp className="w-6 h-6" />
                </button>
                <button className={`${padBtn} !bg-rose-500/40 !border-rose-300/40`} onPointerDown={() => hold("s", true)} onPointerUp={() => hold("s", false)} onPointerLeave={() => hold("s", false)} aria-label="Brake">
                  <ChevronDown className="w-6 h-6" />
                </button>
              </div>
            </>
          )}

          {/* Result overlay */}
          {phase === "finished" && result && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 p-6 text-center">
              <div className="text-5xl mb-2">{result.place === 1 ? "🏆" : "🥈"}</div>
              <h4 className="text-2xl font-black text-amber-300">
                {result.place === 1 ? "You Won the Grand Prix!" : "So Close — 2nd Place!"}
              </h4>
              <p className="mt-1 text-sm font-bold text-white/80">
                {TOTAL_LAPS} laps in {result.time.toFixed(2)}s
              </p>
              <div className="mt-4 flex items-center gap-4 text-sm font-black">
                <span className="px-3 py-1.5 rounded-full bg-white/10">+{result.coins} Coins</span>
                <span className="px-3 py-1.5 rounded-full bg-white/10">+{result.score} XP</span>
              </div>
              <button
                onClick={onClose}
                className="mt-6 px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#0b1220] font-black text-sm cursor-pointer active:scale-95 transition-transform"
              >
                Collect &amp; Close
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-[#0f172a] border-t border-white/10 flex items-center justify-between gap-3 text-[11px] font-bold text-white/60">
          <span>
            ⌨️ W accelerate · S brake · A/D steer — ⚡ hit the orange boost pads, beat the blue rival!
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 cursor-pointer shrink-0"
          >
            Quit race
          </button>
        </div>
      </div>
    </div>
  );
};
