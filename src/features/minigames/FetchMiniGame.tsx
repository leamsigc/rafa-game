import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { X, Play, RotateCcw, Zap, Trophy } from "lucide-react";
import confetti from "canvas-confetti";
import { sound } from "../../utils/audio";

interface FetchMiniGameProps {
  dogName: string;
  dogEnergy: number;
  onClose: () => void;
  onGameComplete: (score: number, coinsEarned: number, energyUsed: number) => void;
}

type Phase = "aim" | "flying" | "chase" | "return" | "done" | "flopped";

const GRAVITY = -14;

export const FetchMiniGame: React.FC<FetchMiniGameProps> = ({
  dogName,
  dogEnergy,
  onClose,
  onGameComplete,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("aim");
  const [angle, setAngle] = useState(0);
  const [power, setPower] = useState(65);
  const [score, setScore] = useState(0);
  const [statusText, setStatusText] = useState("Aim, then throw the ball! 🎾");
  const [finished, setFinished] = useState(false);

  const phaseRef = useRef<Phase>("aim");
  const aimRef = useRef({ angle: 0, power: 65 });
  const finishedRef = useRef(false);
  const completeRef = useRef(onGameComplete);
  completeRef.current = onGameComplete;

  aimRef.current = { angle, power };

  const setPhaseBoth = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  useEffect(() => {
    if (!mountRef.current) return;
    const mount = mountRef.current;
    const energy = Math.max(0, Math.min(100, dogEnergy));

    // Dog athleticism scales with energy: speed, reaction, stamina
    const dogSpeed = 2.2 + (energy / 100) * 5.2;
    const reactionDelay = ((100 - energy) / 100) * 1.1;
    const willFlop = energy < 22 && Math.random() < 0.4;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 30, 70);

    const camera = new THREE.PerspectiveCamera(55, mount.clientWidth / mount.clientHeight, 0.1, 200);
    camera.position.set(0, 11, 17);
    camera.lookAt(0, 0.5, -6);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xbfe3ff, 0x4a7c3a, 0.9));
    const sun = new THREE.DirectionalLight(0xfff2cc, 1.6);
    sun.position.set(8, 18, 6);
    sun.castShadow = true;
    scene.add(sun);

    // Ground
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(34, 48),
      new THREE.MeshStandardMaterial({ color: 0x5da24a })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Distance rings every 4 units
    for (let i = 1; i <= 4; i++) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(i * 4 - 0.12, i * 4, 48),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.02;
      scene.add(ring);
    }

    // Decorative trees
    const treePositions: Array<[number, number]> = [[-12, -10], [12, -12], [-9, -18], [10, -19], [15, -4], [-15, -5]];
    for (const [tx, tz] of treePositions) {
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.35, 1.6, 8),
        new THREE.MeshStandardMaterial({ color: 0x7a5230 })
      );
      trunk.position.set(tx, 0.8, tz);
      trunk.castShadow = true;
      const leaves = new THREE.Mesh(
        new THREE.ConeGeometry(1.4, 2.6, 8),
        new THREE.MeshStandardMaterial({ color: 0x2f6b2f })
      );
      leaves.position.set(tx, 2.6, tz);
      leaves.castShadow = true;
      scene.add(trunk, leaves);
    }

    // Owner marker (you)
    const owner = new THREE.Group();
    const ownerBody = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.35, 0.9, 6, 12),
      new THREE.MeshStandardMaterial({ color: 0x386641 })
    );
    ownerBody.position.y = 1.0;
    ownerBody.castShadow = true;
    const ownerHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xf2c89b })
    );
    ownerHead.position.y = 2.0;
    ownerHead.castShadow = true;
    owner.add(ownerBody, ownerHead);
    owner.position.set(0, 0, 1.5);
    scene.add(owner);

    // ---- Blocky fetch dog ----
    const fur = new THREE.MeshStandardMaterial({ color: 0xd9a441 });
    const darkFur = new THREE.MeshStandardMaterial({ color: 0x8a5a1e });
    const dog = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 1.1), fur);
    body.position.y = 0.72;
    body.castShadow = true;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), fur);
    head.position.set(0, 1.15, -0.7);
    head.castShadow = true;
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.3), darkFur);
    snout.position.set(0, 1.05, -1.05);
    const earGeom = new THREE.BoxGeometry(0.14, 0.3, 0.1);
    const earL = new THREE.Mesh(earGeom, darkFur);
    earL.position.set(-0.18, 1.5, -0.7);
    const earR = new THREE.Mesh(earGeom, darkFur);
    earR.position.set(0.18, 1.5, -0.7);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.5), fur);
    tail.position.set(0, 0.95, 0.75);
    const legGeom = new THREE.CylinderGeometry(0.09, 0.09, 0.55, 8);
    const legs: THREE.Mesh[] = [];
    for (const [lx, lz] of [[-0.2, -0.35], [0.2, -0.35], [-0.2, 0.35], [0.2, 0.35]] as Array<[number, number]>) {
      const leg = new THREE.Mesh(legGeom, darkFur);
      leg.position.set(lx, 0.28, lz);
      leg.castShadow = true;
      legs.push(leg);
      dog.add(leg);
    }
    dog.add(body, head, snout, earL, earR, tail);
    dog.position.set(1.2, 0, 1.5);
    scene.add(dog);

    // Ball with stripe
    const ball = new THREE.Group();
    const ballMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 20, 20),
      new THREE.MeshStandardMaterial({ color: 0xc8e64a, roughness: 0.6 })
    );
    ballMesh.castShadow = true;
    const stripe = new THREE.Mesh(
      new THREE.TorusGeometry(0.28, 0.045, 8, 24),
      new THREE.MeshStandardMaterial({ color: 0xffffff })
    );
    ball.add(ballMesh, stripe);
    ball.position.set(0, 1.6, 1.5);
    ball.visible = false;
    scene.add(ball);

    // Aim arrow
    const aimArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 0.45, -1).normalize(),
      new THREE.Vector3(0, 1.2, 1.5),
      3,
      0xffffff,
      0.8,
      0.5
    );
    scene.add(aimArrow);

    // ---- Mutable sim state ----
    const sim = {
      ballPos: new THREE.Vector3(0, 1.6, 1.5),
      ballVel: new THREE.Vector3(),
      ballLive: false,
      landedAt: null as THREE.Vector3 | null,
      throwTime: 0,
      chaseTimer: 0,
      chaseState: "wait" as "wait" | "react" | "run" | "grabbed" | "back" | "flop",
      flopTimer: 0,
      runPhase: 0,
      elapsed: 0,
    };

    const startThrow = () => {
      const { angle: angDeg, power: pow } = aimRef.current;
      const ang = (angDeg * Math.PI) / 180;
      const speed = 6 + (pow / 100) * 11;
      const dir = new THREE.Vector3(Math.sin(ang), 0, -Math.cos(ang));
      sim.ballPos.set(0, 1.6, 1.5);
      sim.ballVel.set(dir.x * speed * 0.55, speed * 0.62, dir.z * speed * 0.72);
      sim.ballLive = true;
      sim.landedAt = null;
      sim.throwTime = sim.elapsed;
      ball.visible = true;
      aimArrow.visible = false;
      sim.chaseState = "wait";
      sim.chaseTimer = 0;
      setPhaseBoth("flying");
      setStatusText("Ball away! 🌀");
      sound.playWhistle();
    };
    (mount as unknown as { __startThrow?: () => void }).__startThrow = startThrow;

    const finish = (finalScore: number, coins: number, energyUsed: number, text: string) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      setFinished(true);
      setScore(finalScore);
      setStatusText(text);
      setPhaseBoth("done");
      sound.playRewardFanfare();
      confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 } });
      completeRef.current(finalScore, coins, energyUsed);
    };

    const clock = new THREE.Clock();
    let raf = 0;

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      sim.elapsed += dt;

      // Ball projectile physics: gravity + bounce + roll friction
      if (sim.ballLive) {
        sim.ballVel.y += GRAVITY * dt;
        sim.ballPos.addScaledVector(sim.ballVel, dt);
        if (sim.ballPos.y <= 0.28) {
          sim.ballPos.y = 0.28;
          if (Math.abs(sim.ballVel.y) > 1.2) {
            sim.ballVel.y *= -0.45;
            sim.ballVel.x *= 0.7;
            sim.ballVel.z *= 0.7;
          } else {
            sim.ballVel.y = 0;
            sim.ballVel.x *= 1 - 2.2 * dt;
            sim.ballVel.z *= 1 - 2.2 * dt;
            if (sim.ballVel.length() < 0.4) {
              sim.ballLive = false;
              sim.landedAt = sim.ballPos.clone();
              sim.chaseState = "react";
              sim.chaseTimer = 0;
              if (phaseRef.current === "flying") {
                setPhaseBoth("chase");
                setStatusText(willFlop ? `${dogName} is eyeing the ball... 😴` : `${dogName} sprints after it! 🏃`);
              }
            }
          }
        }
        // Keep the ball inside the park
        if (sim.ballPos.z < -24) {
          sim.ballPos.z = -24;
          sim.ballVel.z *= -0.4;
        }
        ball.position.copy(sim.ballPos);
        stripe.rotation.x += dt * 9;
        stripe.rotation.y += dt * 5;
        dog.lookAt(sim.ballPos.x, 0, sim.ballPos.z);
      }

      // Dog chase state machine
      if (phaseRef.current === "chase" || phaseRef.current === "return") {
        if (sim.chaseState === "react") {
          // Tired dogs hesitate before sprinting
          sim.chaseTimer += dt;
          tail.rotation.y = Math.sin(sim.elapsed * 14) * 0.5;
          if (willFlop && sim.chaseTimer > 0.8) {
            sim.chaseState = "flop";
            sim.flopTimer = 0;
            setPhaseBoth("flopped");
            setStatusText(`${dogName} flopped down for a nap instead! 😴`);
            sound.playBark("low");
            window.setTimeout(() => finish(10, 2, 3, "Too pooped — but cute! +10 pts consolation 🌙"), 1400);
          } else if (sim.chaseTimer >= reactionDelay) {
            sim.chaseState = "run";
          }
        } else if (sim.chaseState === "run" && sim.landedAt) {
          const target = sim.landedAt;
          const toTarget = new THREE.Vector3(target.x - dog.position.x, 0, target.z - dog.position.z);
          const dist = toTarget.length();
          if (dist < 0.55) {
            sim.chaseState = "grabbed";
            ball.visible = false;
            setStatusText(`Got it! Bringing it back! 🎾`);
            sound.playBark("high");
          } else {
            toTarget.normalize();
            dog.position.addScaledVector(toTarget, dogSpeed * dt);
            dog.lookAt(target.x, 0, target.z);
            // Gallop animation
            sim.runPhase += dt * (6 + dogSpeed);
            const swing = Math.sin(sim.runPhase) * 0.7;
            legs[0].rotation.x = swing;
            legs[3].rotation.x = swing;
            legs[1].rotation.x = -swing;
            legs[2].rotation.x = -swing;
            body.position.y = 0.72 + Math.abs(Math.sin(sim.runPhase)) * 0.09;
            tail.rotation.y = Math.sin(sim.elapsed * 16) * 0.55;
          }
        } else if (sim.chaseState === "grabbed") {
          const home = new THREE.Vector3(1.2, 0, 1.5);
          const toHome = new THREE.Vector3(home.x - dog.position.x, 0, home.z - dog.position.z);
          const dist = toHome.length();
          if (dist < 0.6) {
            const fetchTime = sim.elapsed - sim.throwTime;
            const distance = Math.max(1, Math.abs(sim.landedAt?.z ?? 8) + Math.abs(sim.landedAt?.x ?? 0));
            const finalScore = Math.max(10, Math.round(50 + distance * 8 - fetchTime * 4));
            const coins = Math.max(3, Math.round(finalScore / 4));
            const energyUsed = Math.min(16, Math.round(7 + distance * 0.5));
            for (const leg of legs) leg.rotation.x = 0;
            body.position.y = 0.72;
            ball.visible = true;
            ball.position.set(0, 1.6, 1.5);
            finish(finalScore, coins, energyUsed, `Fetch complete in ${fetchTime.toFixed(1)}s! 🏆 +${finalScore} pts`);
          } else {
            toHome.normalize();
            dog.position.addScaledVector(toHome, dogSpeed * dt);
            dog.lookAt(home.x, 0, home.z);
            sim.runPhase += dt * (6 + dogSpeed);
            const swing = Math.sin(sim.runPhase) * 0.7;
            legs[0].rotation.x = swing;
            legs[3].rotation.x = swing;
            legs[1].rotation.x = -swing;
            legs[2].rotation.x = -swing;
            body.position.y = 0.72 + Math.abs(Math.sin(sim.runPhase)) * 0.09;
            tail.rotation.y = Math.sin(sim.elapsed * 16) * 0.55;
          }
        } else if (sim.chaseState === "flop") {
          // Tired flop: dog lies flat, tail still
          body.position.y = 0.45;
          body.rotation.x = 0.25;
          for (const leg of legs) leg.rotation.x = 0;
        }
      } else {
        // Aim idle: happy bounce + tail wag
        body.position.y = 0.72 + Math.abs(Math.sin(sim.elapsed * 3)) * 0.03;
        tail.rotation.y = Math.sin(sim.elapsed * 8) * 0.4;
        const ang = (aimRef.current.angle * Math.PI) / 180;
        aimArrow.setDirection(new THREE.Vector3(Math.sin(ang), 0.45, -Math.cos(ang)).normalize());
        aimArrow.setLength(2 + (aimRef.current.power / 100) * 3.2, 0.8, 0.5);
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
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else if (mat) mat.dispose();
      });
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [dogName, dogEnergy]);

  const handleThrow = () => {
    if (phaseRef.current !== "aim") return;
    const starter = (mountRef.current as unknown as { __startThrow?: () => void } | null)?.__startThrow;
    starter?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl bg-[#1d3325] border border-[#A7C957]/30 rounded-3xl shadow-2xl overflow-hidden text-[#F2E8CF] flex flex-col max-h-[94vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#A7C957] rounded-xl text-lg">🎾</div>
            <div>
              <h3 className="text-sm font-black text-white leading-none">Fetch Arena — {dogName}</h3>
              <p className="text-[11px] text-white/70 mt-1 flex items-center gap-1">
                <Zap className="w-3 h-3" /> Energy {dogEnergy}% {dogEnergy < 30 ? "— low energy, slower pup!" : "— full speed ahead!"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {score > 0 && (
              <span className="text-xs font-black px-3 py-1.5 rounded-full bg-[#A7C957] text-[#1d3325] flex items-center gap-1">
                <Trophy className="w-3.5 h-3.5" /> {score} pts
              </span>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Close fetch game"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div ref={mountRef} className="relative w-full h-[46vh] min-h-[320px] cursor-crosshair" />

        <div className="px-4 py-3 bg-[#16281d] border-t border-white/10 space-y-2.5">
          <p className="text-xs font-bold text-center text-[#F2E8CF]/90 min-h-4">{statusText}</p>
          {phase === "aim" && !finished && (
            <div className="grid grid-cols-2 gap-3">
              <label className="text-[11px] font-bold text-white/70">
                Angle: {angle}°
                <input
                  type="range"
                  min={-30}
                  max={30}
                  value={angle}
                  onChange={(e) => setAngle(Number(e.target.value))}
                  className="w-full accent-[#A7C957]"
                />
              </label>
              <label className="text-[11px] font-bold text-white/70">
                Power: {power}%
                <input
                  type="range"
                  min={30}
                  max={100}
                  value={power}
                  onChange={(e) => setPower(Number(e.target.value))}
                  className="w-full accent-[#A7C957]"
                />
              </label>
            </div>
          )}
          <div className="flex gap-2">
            {phase === "aim" && !finished && (
              <button
                onClick={handleThrow}
                className="flex-1 py-2.5 rounded-xl text-sm font-black bg-[#A7C957] hover:bg-[#97b949] text-[#1d3325] flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" /> Throw the ball!
              </button>
            )}
            {finished && (
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-sm font-black bg-[#A7C957] hover:bg-[#97b949] text-[#1d3325] flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" /> Collect & Close
              </button>
            )}
            {(phase === "chase" || phase === "flying" || phase === "return") && (
              <div className="flex-1 py-2.5 text-center text-xs font-bold text-white/60">
                {dogName} is on it... 👀
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
