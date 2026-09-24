import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { X, Play, Store, Trophy, ChevronLeft, ChevronRight, RotateCcw, Zap } from "lucide-react";
import { sound } from "../../utils/audio";
import {
  addBones,
  getBoneBalance,
  getEquippedCostume,
  getEquippedDesign,
  getEquippedTrail,
} from "../bonerush/boneRushData";

interface BoneRushRunnerProps {
  dogName: string;
  dogEnergy: number;
  /** Bump this to force re-reading equipped cosmetics after store changes. */
  walletTick?: number;
  onClose: () => void;
  onOpenStore: () => void;
  onGameComplete: (score: number, coinsEarned: number, energyUsed: number) => void;
}

type Phase = "start" | "running" | "results";

const LANES = [-2.4, 0, 2.4];

/** Frame-rate independent exponential damping: smooth at 60-120fps, no stutters. */
function expDamp(current: number, target: number, smoothing: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-smoothing * dt));
}

export const BoneRushRunner: React.FC<BoneRushRunnerProps> = ({
  dogName,
  dogEnergy,
  walletTick = 0,
  onClose,
  onOpenStore,
  onGameComplete,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("start");
  const [score, setScore] = useState(0);
  const [balance, setBalance] = useState(() => getBoneBalance());
  const [lastCoins, setLastCoins] = useState(0);
  const [speedPct, setSpeedPct] = useState(0);

  // Everything the render loop needs lives in one mutable ref blob.
  const g = useRef({
    raf: 0 as number,
    renderer: null as THREE.WebGLRenderer | null,
    // gameplay
    running: false,
    dogX: 0,
    targetLane: 1,
    tilt: 0,
    speed: 9,
    dist: 0,
    bones: 0,
    time: 0,
    spawnTimer: 0,
    objects: [] as { mesh: THREE.Object3D; kind: "bone" | "crate"; }[],
    // three refs
    dog: null as THREE.Group | null,
    legs: [] as THREE.Object3D[],
    tail: null as THREE.Object3D | null,
    trail: null as THREE.Points | null,
    trailData: null as { life: Float32Array; size: number } | null,
    trailTimer: 0,
    boneMat: null as THREE.MeshStandardMaterial | null,
    trailMat: null as THREE.PointsMaterial | null,
    crateMat: null as THREE.MeshStandardMaterial | null,
    completed: false,
  });

  const buildBoneMesh = (mat: THREE.Material): THREE.Group => {
    const bone = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.42, 8), mat);
    shaft.rotation.z = Math.PI / 2;
    bone.add(shaft);
    const knob = new THREE.SphereGeometry(0.11, 8, 8);
    [-0.24, 0.24].forEach((x) => {
      [-0.06, 0.06].forEach((y) => {
        const k = new THREE.Mesh(knob, mat);
        k.position.set(x, y, 0);
        bone.add(k);
      });
    });
    bone.rotation.z = Math.random() * Math.PI;
    return bone;
  };

  const makeBoneMaterial = (): THREE.MeshStandardMaterial => {
    const d = getEquippedDesign();
    const mat = new THREE.MeshStandardMaterial({
      color: d.color,
      roughness: 0.35,
      metalness: d.id === "diamond_crystal" ? 0.7 : 0.15,
    });
    if (d.emissive) {
      mat.emissive = new THREE.Color(d.emissive);
      mat.emissiveIntensity = d.hueCycle ? 0.9 : 0.6;
    }
    if (d.stripes) {
      // Peppermint candy stripes via tiny canvas texture
      const c = document.createElement("canvas");
      c.width = 64;
      c.height = 64;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 64, 64);
      ctx.strokeStyle = "#e11d48";
      ctx.lineWidth = 10;
      for (let i = -64; i < 128; i += 24) {
        ctx.beginPath();
        ctx.moveTo(i, -10);
        ctx.lineTo(i + 74, 74);
        ctx.stroke();
      }
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(2, 1);
      mat.map = tex;
    }
    return mat;
  };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x8ecae6);
    scene.fog = new THREE.Fog(0x8ecae6, 30, 70);

    const camera = new THREE.PerspectiveCamera(60, mount.clientWidth / mount.clientHeight, 0.1, 120);
    camera.position.set(0, 3.4, 6.6);
    camera.lookAt(0, 1, -7);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);
    g.current.renderer = renderer;

    scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x4a7c3a, 0.95));
    const sun = new THREE.DirectionalLight(0xfff2cc, 1.5);
    sun.position.set(6, 14, 4);
    scene.add(sun);

    // ---- Track: 3 grassy lanes with a stone divider (subway-park style) ----
    const track = new THREE.Group();
    const laneGrass = new THREE.MeshStandardMaterial({ color: 0x69b34c, roughness: 0.9 });
    const dividerMat = new THREE.MeshStandardMaterial({ color: 0xd6c29e, roughness: 0.9 });
    const trackFloor = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 200), laneGrass);
    trackFloor.rotation.x = -Math.PI / 2;
    trackFloor.position.z = -80;
    track.add(trackFloor);
    LANES.forEach((x) => {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 200), dividerMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(x + 1.2, 0.01, -80);
      track.add(stripe);
    });
    // Side rails + distant tree silhouettes whooshing past
    const railMat = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.8 });
    [-4.4, 4.4].forEach((x) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 200), railMat);
      rail.position.set(x, 0.2, -80);
      track.add(rail);
    });
    const sideTrees = new THREE.Group();
    for (let i = 0; i < 40; i++) {
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.26, 1.6, 6),
        new THREE.MeshStandardMaterial({ color: 0x6b4423 })
      );
      const canopy = new THREE.Mesh(
        new THREE.SphereGeometry(0.9, 8, 8),
        new THREE.MeshStandardMaterial({ color: i % 2 ? 0x2e7d32 : 0x388e3c })
      );
      canopy.position.y = 1.7;
      const t = new THREE.Group();
      t.add(trunk, canopy);
      t.position.set((i % 2 ? 1 : -1) * (6.5 + Math.random() * 2.5), 0, -i * 6 - Math.random() * 4);
      sideTrees.add(t);
    }
    track.add(sideTrees);
    scene.add(track);

    // ---- Runner pup (costume coat colors from the wallet) ----
    const costume = getEquippedCostume();
    const dogGroup = new THREE.Group();
    const fur = new THREE.MeshStandardMaterial({ color: costume.body, roughness: 0.8 });
    const accent = new THREE.MeshStandardMaterial({ color: costume.accent, roughness: 0.7 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.5, 1.25), fur);
    body.position.y = 0.62;
    body.castShadow = true;
    dogGroup.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.48, 0.55), fur);
    head.position.set(0, 1.0, -0.72);
    dogGroup.add(head);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.24, 0.3), accent);
    snout.position.set(0, 0.88, -1.05);
    dogGroup.add(snout);
    [-0.22, 0.22].forEach((x) => {
      const ear = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.3, 0.1), accent);
      ear.position.set(x, 1.28, -0.68);
      dogGroup.add(ear);
    });
    [-0.24, 0.24].forEach((x) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), new THREE.MeshStandardMaterial({ color: 0x111111 }));
      eye.position.set(x, 1.08, -0.99);
      dogGroup.add(eye);
    });
    if (costume.visor) {
      const visor = new THREE.Mesh(
        new THREE.BoxGeometry(0.56, 0.14, 0.06),
        new THREE.MeshStandardMaterial({ color: costume.visor, emissive: costume.visor, emissiveIntensity: 1.4 })
      );
      visor.position.set(0, 1.12, -1.0);
      dogGroup.add(visor);
    }
    const legs: THREE.Object3D[] = [];
    [
      [-0.26, 0.5], [0.26, 0.5], [-0.26, 0.5], [0.26, 0.5],
    ].forEach(([x, z], i) => {
      const leg = new THREE.Group();
      leg.position.set(x, 0.4, i < 2 ? z : -z);
      const legMesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.18), accent);
      legMesh.position.y = -0.25;
      leg.add(legMesh);
      dogGroup.add(leg);
      legs.push(leg);
    });
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.45), accent);
    tail.position.set(0, 0.85, 0.75);
    tail.rotation.x = -0.5;
    dogGroup.add(tail);
    scene.add(dogGroup);
    g.current.dog = dogGroup;
    g.current.legs = legs;
    g.current.tail = tail;

    // ---- Shared materials ----
    const boneMat = makeBoneMaterial();
    g.current.boneMat = boneMat;
    const crateMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.8 });
    g.current.crateMat = crateMat;

    // ---- 3D trail particle emitter (equipped trail effect) ----
    const trail = getEquippedTrail();
    if (trail.id !== "none") {
      const size = 110;
      const positions = new Float32Array(size * 3);
      const life = new Float32Array(size);
      for (let i = 0; i < size; i++) {
        positions[i * 3 + 2] = 50; // parked far away until spawned
        life[i] = 0;
      }
      const geom = new THREE.BufferGeometry();
      geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const trailMat = new THREE.PointsMaterial({
        color: trail.color,
        size: 0.22,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      });
      const points = new THREE.Points(geom, trailMat);
      points.frustumCulled = false;
      scene.add(points);
      g.current.trail = points;
      g.current.trailMat = trailMat;
      g.current.trailData = { life, size };
    }

    // ---- Render loop ----
    const clock = new THREE.Clock();
    let hueT = 0;

    const spawnWave = () => {
      const roll = Math.random();
      if (roll < 0.62) {
        // A line of 3-5 bones in one lane
        const lane = Math.floor(Math.random() * 3);
        const n = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) {
          const mesh = buildBoneMesh(boneMat);
          mesh.position.set(LANES[lane], 0.55, -46 - i * 1.6);
          scene.add(mesh);
          g.current.objects.push({ mesh, kind: "bone" });
        }
      } else {
        // Crate obstacle (never blocks ALL lanes — max 2)
        const lanes = [0, 1, 2].sort(() => Math.random() - 0.5).slice(0, 1 + Math.floor(Math.random() * 2));
        lanes.forEach((lane) => {
          const crate = new THREE.Group();
          const box = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.0, 1.0), crateMat);
          box.position.y = 0.5;
          box.castShadow = true;
          crate.add(box);
          const slat = new THREE.Mesh(
            new THREE.BoxGeometry(1.2, 0.14, 1.05),
            new THREE.MeshStandardMaterial({ color: 0x78350f })
          );
          slat.position.y = 0.85;
          crate.add(slat);
          crate.position.set(LANES[lane], 0, -46);
          scene.add(crate);
          g.current.objects.push({ mesh: crate, kind: "crate" });
        });
      }
    };

    const endRun = () => {
      if (g.current.completed) return;
      g.current.completed = true;
      g.current.running = false;
      const banked = g.current.bones;
      addBones(banked); // Bone Points Wallet: bank every bone collected
      const coins = Math.floor(banked / 10); // 10 score = 1 coin
      setBalance(getBoneBalance());
      setLastCoins(coins);
      setPhase("results");
      sound.playRewardFanfare();
      onGameComplete(banked, coins, 8);
    };

    const animate = () => {
      g.current.raf = requestAnimationFrame(animate);
      // CLAMPED frame timing: physics never stutters or clips through the floor
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.getElapsedTime();
      const S = g.current;

      if (S.running) {
        S.time += dt;
        // Speed ramps up with distance (gentle curve)
        S.speed = 9 + Math.min(9, S.time * 0.22);
        setSpeedPct(Math.round((S.speed - 9) * 11));

        // Exponential-decay lane smoothing (buttery, frame-rate independent)
        S.dogX = expDamp(S.dogX, LANES[S.targetLane], 13, dt);
        // Banking tilt into lane shifts with smooth centrifugal recovery
        const targetTilt = -THREE.MathUtils.clamp((LANES[S.targetLane] - S.dogX) * 0.22, -0.45, 0.45);
        S.tilt = expDamp(S.tilt, targetTilt, 10, dt);
        if (S.dog) {
          S.dog.position.x = S.dogX;
          S.dog.rotation.z = S.tilt;
          // Gallop bob + paddling paws
          S.dog.position.y = Math.abs(Math.sin(t * (S.speed * 0.85))) * 0.06;
          S.legs.forEach((leg, i) => {
            leg.rotation.x = Math.sin(t * S.speed * 0.9 + (i % 2 ? Math.PI : 0)) * 0.7;
          });
          if (S.tail) S.tail.rotation.x = -0.5 + Math.sin(t * 12) * 0.3;
        }

        // World scroll: move collectibles/obstacles toward the camera
        S.spawnTimer -= dt;
        if (S.spawnTimer <= 0) {
          spawnWave();
          S.spawnTimer = Math.max(0.55, 1.35 - S.time * 0.015);
        }
        for (let i = S.objects.length - 1; i >= 0; i--) {
          const o = S.objects[i];
          o.mesh.position.z += S.speed * dt;
          if (o.kind === "bone") {
            o.mesh.rotation.y += dt * 3;
            o.mesh.position.y = 0.55 + Math.sin(t * 4 + o.mesh.position.z) * 0.08;
          }
          // Collision window around the runner (z ≈ 0)
          if (o.mesh.position.z > -0.75 && o.mesh.position.z < 0.75) {
            const dx = Math.abs(o.mesh.position.x - S.dogX);
            if (o.kind === "bone" && dx < 0.95) {
              scene.remove(o.mesh);
              S.objects.splice(i, 1);
              S.bones += 1; // every bone = +1 score
              setScore(S.bones);
              sound.playSqueak();
              continue;
            }
            if (o.kind === "crate" && dx < 0.85) {
              sound.playBark("low");
              endRun();
            }
          }
          if (o.mesh.position.z > 12) {
            scene.remove(o.mesh);
            S.objects.splice(i, 1);
          }
        }

        // 3D trail emitter: stream particles behind the galloping paws
        if (S.trail && S.trailData && S.trailMat) {
          const pos = S.trail.geometry.getAttribute("position") as THREE.BufferAttribute;
          const arr = pos.array as Float32Array;
          const life = S.trailData.life;
          S.trailTimer -= dt;
          if (S.trailTimer <= 0) {
            // spawn 3 particles behind the paws
            for (let n = 0; n < 3; n++) {
              const idx = Math.floor(Math.random() * life.length);
              arr[idx * 3] = S.dogX + (Math.random() - 0.5) * 0.5;
              arr[idx * 3 + 1] = 0.12 + Math.random() * 0.25;
              arr[idx * 3 + 2] = 0.55;
              life[idx] = 1;
            }
            S.trailTimer = 0.02;
          }
          const trailDef = getEquippedTrail();
          for (let i = 0; i < life.length; i++) {
            if (life[i] > 0) {
              life[i] -= dt * 1.6;
              arr[i * 3 + 2] += S.speed * dt; // trail scrolls away with the world
              arr[i * 3 + 1] += dt * (trailDef.id === "aqua_bubbles" ? 1.1 : 0.15);
            }
          }
          if (trailDef.hueCycle) {
            hueT = (hueT + dt * 0.35) % 1;
            S.trailMat.color.setHSL(hueT, 0.85, 0.6);
          }
          pos.needsUpdate = true;
        }
        // Prismatic rainbow bones hue-cycle in real time
        const designDef = getEquippedDesign();
        if (designDef.hueCycle && S.boneMat) {
          hueT = (hueT + dt * 0.5) % 1;
          S.boneMat.color.setHSL(hueT, 0.9, 0.62);
          S.boneMat.emissive.setHSL(hueT, 0.9, 0.35);
        }
      }

      renderer.render(scene, camera);
    };
    animate();

    // ---- Controls: keyboard + touch swipe ----
    const onKey = (e: KeyboardEvent) => {
      if (!g.current.running) return;
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        g.current.targetLane = Math.max(0, g.current.targetLane - 1);
        sound.playButtonTap();
      } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        g.current.targetLane = Math.min(2, g.current.targetLane + 1);
        sound.playButtonTap();
      }
    };
    window.addEventListener("keydown", onKey);

    let touchStartX: number | null = null;
    const onDown = (e: PointerEvent) => {
      touchStartX = e.clientX;
    };
    const onUp = (e: PointerEvent) => {
      if (touchStartX === null || !g.current.running) return;
      const dx = e.clientX - touchStartX;
      if (Math.abs(dx) > 28) {
        g.current.targetLane = THREE.MathUtils.clamp(
          g.current.targetLane + (dx > 0 ? 1 : -1),
          0,
          2
        );
        sound.playButtonTap();
      }
      touchStartX = null;
    };
    mount.addEventListener("pointerdown", onDown);
    mount.addEventListener("pointerup", onUp);

    return () => {
      cancelAnimationFrame(g.current.raf);
      window.removeEventListener("keydown", onKey);
      mount.removeEventListener("pointerdown", onDown);
      mount.removeEventListener("pointerup", onUp);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      g.current.renderer = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-sync equipped cosmetics + balance when the store changes something
  useEffect(() => {
    setBalance(getBoneBalance());
    const mat = g.current.boneMat;
    const design = getEquippedDesign();
    if (mat) {
      mat.color.setHex(design.color);
      if (design.emissive) {
        mat.emissive.setHex(design.emissive);
        mat.emissiveIntensity = design.hueCycle ? 0.9 : 0.6;
      } else {
        mat.emissive.setHex(0x000000);
      }
    }
  }, [walletTick]);

  const startRun = () => {
    // Reset round state
    const S = g.current;
    S.bones = 0;
    S.time = 0;
    S.speed = 9;
    S.targetLane = 1;
    S.dogX = 0;
    S.tilt = 0;
    S.completed = false;
    S.running = true;
    S.spawnTimer = 0.6;
    setScore(0);
    setPhase("running");
    sound.playWhistle();
  };

  const nudge = (dir: -1 | 1) => {
    if (!g.current.running) return;
    g.current.targetLane = THREE.MathUtils.clamp(g.current.targetLane + dir, 0, 2);
    sound.playButtonTap();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#1f2937] flex flex-col">
      {/* Header bar: score + banked bones + STORE launcher */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#F2E8CF]/95 border-b-4 border-[#A7C957] text-[#386641] z-10">
        <div className="flex items-center gap-3">
          <span className="text-xs font-black">🦴 <span className="tabular-nums">{score}</span></span>
          <span className="text-[10px] font-bold bg-[#A7C957]/40 rounded-full px-2 py-0.5">10 🦴 = 1 🪙</span>
          {phase === "running" && <span className="text-[10px] font-bold text-[#BC4749]">⚡ {speedPct}%</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-black bg-white rounded-full px-3 py-1 border border-[#386641]/20">
            💰 {balance} Bones banked
          </span>
          <button
            onClick={onOpenStore}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-black shadow flex items-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
          >
            <Store className="w-3.5 h-3.5" /> Store
          </button>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-[#e8dcb8] cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 3D canvas */}
      <div className="relative flex-1">
        <div ref={mountRef} className="absolute inset-0 touch-none" />

        {/* Lane nudge buttons (touch-friendly) */}
        {phase === "running" && (
          <>
            <button
              onClick={() => nudge(-1)}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-4 rounded-full bg-black/35 hover:bg-black/50 text-white shadow-xl cursor-pointer active:scale-90 transition-transform"
              aria-label="Move left"
            >
              <ChevronLeft className="w-7 h-7" />
            </button>
            <button
              onClick={() => nudge(1)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-4 rounded-full bg-black/35 hover:bg-black/50 text-white shadow-xl cursor-pointer active:scale-90 transition-transform"
              aria-label="Move right"
            >
              <ChevronRight className="w-7 h-7" />
            </button>
          </>
        )}

        {/* START screen */}
        {phase === "start" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/45 backdrop-blur-xs text-center px-6">
            <div className="bg-[#F2E8CF] rounded-3xl border-4 border-[#A7C957] p-6 sm:p-8 shadow-2xl max-w-sm w-full space-y-4">
              <div className="text-5xl">🦴🐕💨</div>
              <h2 className="text-xl font-black text-[#386641]">Subway Pup: Bone Rush</h2>
              <p className="text-xs font-bold text-[#386641]/75 leading-relaxed">
                Slide {dogName} back and forth across three lanes! Grab bones (+1 score each), dodge the crates.
                Every bone banks into your wallet — 10 score = 1 Treat Coin!
              </p>
              <p className="text-[10px] font-bold text-[#BC4749]">◀ Arrow keys / swipe / tap buttons ▶</p>
              <div className="flex items-center justify-center gap-2 text-xs font-black text-[#386641]">
                <Zap className="w-4 h-4 text-[#6A994E]" /> Energy {Math.round(dogEnergy)}%
              </div>
              <button
                onClick={startRun}
                className="w-full py-3.5 rounded-2xl bg-[#386641] hover:bg-[#2c5234] text-[#F2E8CF] font-black text-sm shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-transform"
              >
                <Play className="w-5 h-5 fill-current" /> Start Running!
              </button>
              <button
                onClick={onOpenStore}
                className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black text-xs shadow flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
              >
                <Store className="w-4 h-4" /> Bone Rush Store · 💰 {balance} bones
              </button>
            </div>
          </div>
        )}

        {/* RESULTS card */}
        {phase === "results" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
            <div className="bg-[#F2E8CF] rounded-3xl border-4 border-[#A7C957] p-6 sm:p-8 shadow-2xl max-w-sm w-full space-y-4 text-center">
              <Trophy className="w-10 h-10 mx-auto text-[#D4A373]" />
              <h2 className="text-lg font-black text-[#386641]">Run Complete!</h2>
              <div className="text-4xl font-black text-[#386641] tabular-nums">🦴 {score}</div>
              <p className="text-xs font-bold text-[#386641]/75">
                +{score} bones banked into your wallet • +{lastCoins} 🪙 Treat Coins
              </p>
              <button
                onClick={startRun}
                className="w-full py-3 rounded-2xl bg-[#386641] hover:bg-[#2c5234] text-[#F2E8CF] font-black text-sm shadow flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-transform"
              >
                <RotateCcw className="w-4 h-4" /> Run Again!
              </button>
              <button
                onClick={onOpenStore}
                className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black text-xs shadow flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
              >
                <Store className="w-4 h-4" /> Spend your 💰 {balance} bones in the Store
              </button>
              <button
                onClick={onClose}
                className="text-xs font-bold text-[#386641]/70 hover:text-[#386641] cursor-pointer"
              >
                Back to the park
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
