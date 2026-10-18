import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { X } from "lucide-react";
import { sound } from "../../utils/audio";
import type { CafeItemDef } from "./CafeMenuModal";

interface CafeServiceCutsceneProps {
  dogName: string;
  item: CafeItemDef;
  tableNumber: number;
  onDone: () => void;
}

type Phase = "waiting" | "counter" | "walking" | "serving";

/**
 * The 3D "dog service" cutscene at Happy Café.
 *
 * After ordering it plays out in three beats, all in 3D:
 *  1. WAITING  — a warm shot of Happy sitting at his table.
 *  2. COUNTER  — the café's server dog is at the counter and calls out the
 *                order: "Here's your <item>! Table 8!"
 *  3. WALKING  — the camera becomes the server dog's POV: you follow him as he
 *                carries the tray across the café to the table.
 *  4. SERVING  — he sets it down: "Here's your food — enjoy!"
 */
export const CafeServiceCutscene: React.FC<CafeServiceCutsceneProps> = ({
  dogName,
  item,
  tableNumber,
  onDone,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("waiting");
  const [caption, setCaption] = useState(`${dogName} is waiting at table ${tableNumber}…`);
  const phaseRef = useRef<Phase>("waiting");
  const doneRef = useRef(false);
  const doneCb = useRef(onDone);
  doneCb.current = onDone;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x2b1c12);
    scene.fog = new THREE.Fog(0x2b1c12, 22, 46);

    const camera = new THREE.PerspectiveCamera(58, mount.clientWidth / mount.clientHeight, 0.05, 200);
    camera.position.set(6, 3.2, 7);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffe9cf, 0x33221a, 1.05));
    const key = new THREE.DirectionalLight(0xfff1d6, 1.15);
    key.position.set(6, 10, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -16;
    key.shadow.camera.right = 16;
    key.shadow.camera.top = 16;
    key.shadow.camera.bottom = -16;
    scene.add(key);
    const warm = new THREE.PointLight(0xffb066, 1.4, 22);
    warm.position.set(-2, 3.4, -3);
    scene.add(warm);

    // ---- Room: floor + two walls + skirting ----
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.85 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xe8d4b6, roughness: 0.95 });
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(24, 8), wallMat);
    backWall.position.set(0, 4, -8);
    backWall.receiveShadow = true;
    scene.add(backWall);
    const sideWall = new THREE.Mesh(new THREE.PlaneGeometry(24, 8), wallMat);
    sideWall.rotation.y = Math.PI / 2;
    sideWall.position.set(-8, 4, 0);
    sideWall.receiveShadow = true;
    scene.add(sideWall);

    // ---- Counter along the back wall ----
    const counterMat = new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.6 });
    const counter = new THREE.Mesh(new THREE.BoxGeometry(9, 1.05, 1.6), counterMat);
    counter.position.set(-1.5, 0.52, -6.4);
    counter.castShadow = true;
    counter.receiveShadow = true;
    scene.add(counter);
    const counterTop = new THREE.Mesh(
      new THREE.BoxGeometry(9.2, 0.16, 1.8),
      new THREE.MeshStandardMaterial({ color: 0x3f2a17, roughness: 0.5 })
    );
    counterTop.position.set(-1.5, 1.1, -6.4);
    scene.add(counterTop);
    // Coffee machine + cups on the counter
    const machine = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 1.1, 1.1),
      new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.4, metalness: 0.5 })
    );
    machine.position.set(-4.4, 1.75, -6.4);
    machine.castShadow = true;
    scene.add(machine);
    for (let i = 0; i < 3; i++) {
      const cup = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.13, 0.28, 12),
        new THREE.MeshStandardMaterial({ color: 0xfdf3e3 })
      );
      cup.position.set(1.0 + i * 0.5, 1.32, -6.5);
      scene.add(cup);
    }

    // ---- A few round tables with chairs ----
    const tableMat = new THREE.MeshStandardMaterial({ color: 0x9c6b3f, roughness: 0.7 });
    const chairMat = new THREE.MeshStandardMaterial({ color: 0x5c3a1e, roughness: 0.7 });
    const makeTable = (x: number, z: number) => {
      const g = new THREE.Group();
      const top = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.14, 20), tableMat);
      top.position.y = 1.0;
      top.castShadow = true;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.0, 10), chairMat);
      leg.position.y = 0.5;
      g.add(top, leg);
      for (let i = 0; i < 2; i++) {
        const chair = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.7), chairMat);
        chair.position.set((i === 0 ? 1 : -1) * 1.7, 0.55, i === 0 ? 0.6 : -0.6);
        chair.castShadow = true;
        g.add(chair);
      }
      g.position.set(x, 0, z);
      scene.add(g);
      return g;
    };
    makeTable(-4.6, 2.6);
    const happyTable = makeTable(4.2, 3.0);
    makeTable(0.4, 5.4);

    // Table-number plate on Happy's table
    {
      const c = document.createElement("canvas");
      c.width = 128;
      c.height = 64;
      const cx = c.getContext("2d")!;
      cx.fillStyle = "#3f2a17";
      cx.roundRect(6, 6, 116, 52, 10);
      cx.fill();
      cx.fillStyle = "#fde68a";
      cx.font = "bold 34px sans-serif";
      cx.textAlign = "center";
      cx.fillText(`№ ${tableNumber}`, 64, 45);
      const plate = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true }));
      plate.scale.set(1.1, 0.55, 1);
      plate.position.set(happyTable.position.x, 1.7, happyTable.position.z + 1.0);
      scene.add(plate);
    }

    // ---- Dogs ----
    function makeDog(color: number, collar: string, accent: number) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.62, 0.62, 1.25),
        new THREE.MeshStandardMaterial({ color, roughness: 0.7 })
      );
      body.position.y = 0.82;
      body.castShadow = true;
      const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.56, 0.56, 0.56),
        new THREE.MeshStandardMaterial({ color, roughness: 0.7 })
      );
      head.position.set(0, 1.36, 0.72);
      head.castShadow = true;
      const snout = new THREE.Mesh(
        new THREE.BoxGeometry(0.26, 0.24, 0.32),
        new THREE.MeshStandardMaterial({ color: accent, roughness: 0.7 })
      );
      snout.position.set(0, 1.24, 1.02);
      const earGeom = new THREE.BoxGeometry(0.15, 0.3, 0.1);
      const earL = new THREE.Mesh(earGeom, new THREE.MeshStandardMaterial({ color: accent }));
      earL.position.set(-0.2, 1.66, 0.72);
      const earR = earL.clone();
      earR.position.x = 0.2;
      const collarMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.12, 0.5),
        new THREE.MeshStandardMaterial({ color: collar })
      );
      collarMesh.position.set(0, 1.06, 0.72);
      const tail = new THREE.Mesh(
        new THREE.BoxGeometry(0.13, 0.13, 0.5),
        new THREE.MeshStandardMaterial({ color, roughness: 0.7 })
      );
      tail.position.set(0, 1.05, -0.72);
      const legGeom = new THREE.CylinderGeometry(0.1, 0.1, 0.62, 8);
      const legs: THREE.Mesh[] = [];
      for (const [lx, lz] of [[-0.22, 0.42], [0.22, 0.42], [-0.22, -0.42], [0.22, -0.42]] as [number, number][]) {
        const leg = new THREE.Mesh(legGeom, new THREE.MeshStandardMaterial({ color: accent }));
        leg.position.set(lx, 0.31, lz);
        leg.castShadow = true;
        legs.push(leg);
        g.add(leg);
      }
      g.add(body, head, snout, earL, earR, collarMesh, tail);
      return { group: g, legs, tail, head };
    }

    const happy = makeDog(0xd9a441, "#e11d48", 0x8a5a1e);
    happy.group.position.set(happyTable.position.x - 0.1, 0, happyTable.position.z - 1.35);
    happy.group.rotation.y = Math.PI; // faces the table/server
    happy.group.position.y = -0.32; // seated (legs tucked)
    scene.add(happy.group);

    const server = makeDog(0xb07a45, "#0f766e", 0x6b4423);
    server.group.position.set(-3.4, 0, -7.6); // behind the counter
    server.group.rotation.y = Math.PI; // faces the room
    scene.add(server.group);

    // A tray the server carries, with the ordered item floating on it
    const tray = new THREE.Group();
    const trayMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, 0.07, 18),
      new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.5, roughness: 0.4 })
    );
    tray.add(trayMesh);
    {
      const c = document.createElement("canvas");
      c.width = 128;
      c.height = 128;
      const cx = c.getContext("2d")!;
      cx.font = "bold 92px sans-serif";
      cx.textAlign = "center";
      cx.textBaseline = "middle";
      cx.fillText(item.emoji, 64, 70);
      const itemSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true }));
      itemSprite.scale.set(0.7, 0.7, 1);
      itemSprite.position.y = 0.35;
      tray.add(itemSprite);
    }
    tray.position.set(-3.4, 1.55, -6.2);
    scene.add(tray);
    const trayHome = tray.position.clone();
    const trayServed = new THREE.Vector3(happyTable.position.x, 1.5, happyTable.position.z - 0.2);

    // ---- Speech bubble helper ----
    const makeBubble = (text: string) => {
      const c = document.createElement("canvas");
      c.width = 640;
      c.height = 200;
      const cx = c.getContext("2d")!;
      cx.fillStyle = "rgba(255,247,237,0.97)";
      cx.beginPath();
      cx.roundRect(10, 10, 620, 180, 30);
      cx.fill();
      cx.strokeStyle = "#7c2d12";
      cx.lineWidth = 6;
      cx.stroke();
      cx.fillStyle = "#3f2a17";
      cx.font = "bold 40px sans-serif";
      cx.textAlign = "center";
      // wrap
      const words = text.split(" ");
      const lines: string[] = [];
      let cur = "";
      for (const w of words) {
        const test = cur ? cur + " " + w : w;
        if (cx.measureText(test).width > 560) {
          lines.push(cur);
          cur = w;
        } else cur = test;
      }
      if (cur) lines.push(cur);
      lines.slice(0, 3).forEach((ln, i) => cx.fillText(ln, 320, 80 + i * 48));
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true }));
      sprite.scale.set(3.4, 1.05, 1);
      return sprite;
    };

    let bubble: THREE.Sprite | null = null;
    const showBubble = (text: string, at: THREE.Vector3) => {
      if (bubble) {
        scene.remove(bubble);
        (bubble.material as THREE.SpriteMaterial).map?.dispose();
        bubble.material.dispose();
      }
      bubble = makeBubble(text);
      bubble.position.set(at.x, at.y + 1.6, at.z);
      scene.add(bubble);
    };

    // ---- Timeline ----
    const WAIT_END = 2.0;
    const COUNTER_END = 4.4;
    const servePath = [
      new THREE.Vector3(-3.4, 0, -5.2),
      new THREE.Vector3(-1.2, 0, -3.4),
      new THREE.Vector3(1.8, 0, -1.6),
      new THREE.Vector3(3.4, 0, 0.9),
      new THREE.Vector3(4.2, 0, 1.7),
    ];
    let pathIdx = 0;
    let walkPhase = 0;
    let arrived = false;
    const walkSpeed = 2.4;

    const clock = new THREE.Clock();
    let raf = 0;
    let lastPhase: Phase | null = null;

    const setPhaseBoth = (p: Phase) => {
      phaseRef.current = p;
      setPhase(p);
    };

    const finish = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      sound.playRewardFanfare();
      doneCb.current();
    };

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;

      // Phase transitions
      if (phaseRef.current === "waiting" && t >= WAIT_END) {
        setPhaseBoth("counter");
        sound.playSoftWoof();
        showBubble(`Here's your ${item.name}! Table ${tableNumber}!`, server.group.position);
      } else if (phaseRef.current === "counter" && t >= COUNTER_END) {
        setPhaseBoth("walking");
        setCaption("Following the server dog to your table…");
        if (bubble) {
          scene.remove(bubble);
          bubble = null;
        }
      } else if (phaseRef.current === "walking" && arrived) {
        setPhaseBoth("serving");
        setCaption(`"Here's your ${item.name} — enjoy! 🐾"`);
        showBubble("Here's your food — enjoy!", happy.group.position);
        sound.playCrunch();
      }

      // Server walks along the serve path
      if (phaseRef.current === "walking" && pathIdx < servePath.length) {
        const target = servePath[pathIdx];
        const pos = server.group.position;
        const dx = target.x - pos.x;
        const dz = target.z - pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.12) {
          pathIdx++;
          if (pathIdx >= servePath.length) arrived = true;
        } else {
          const step = Math.min(dist, walkSpeed * dt);
          pos.x += (dx / dist) * step;
          pos.z += (dz / dist) * step;
          const ang = Math.atan2(dx, dz);
          server.group.rotation.y = ang;
          walkPhase += dt * 9;
          const swing = Math.sin(walkPhase) * 0.6;
          server.legs[0].rotation.x = swing;
          server.legs[3].rotation.x = swing;
          server.legs[1].rotation.x = -swing;
          server.legs[2].rotation.x = -swing;
          // Tray follows the server's front
          tray.position.lerp(
            new THREE.Vector3(pos.x + Math.sin(ang) * 0.6, 1.55, pos.z + Math.cos(ang) * 0.6),
            0.4
          );
          tray.rotation.y = ang;
        }
      } else if (phaseRef.current === "serving") {
        // Present the tray at the table, Happy wags
        tray.position.lerp(trayServed, Math.min(1, dt * 3));
        happy.tail.rotation.z = Math.sin(t * 12) * 0.5;
        server.legs.forEach((l) => (l.rotation.x = 0));
        if (t > COUNTER_END + servePath.length * 0.9 + 3.4) {
          finish();
        }
      } else if (phaseRef.current !== "walking") {
        tray.position.lerp(trayHome, Math.min(1, dt * 4));
      }

      // Idle life
      happy.tail.rotation.z = Math.sin(t * 6) * 0.28;
      if (phaseRef.current === "waiting") {
        happy.head.rotation.y = Math.sin(t * 2) * 0.25;
      }
      server.tail.rotation.z = Math.sin(t * 7) * 0.3;
      void lastPhase;

      // ---- Camera per phase ----
      if (phaseRef.current === "waiting") {
        camera.position.lerp(new THREE.Vector3(happyTable.position.x + 3.2, 2.4, happyTable.position.z + 4.6), Math.min(1, dt * 3));
        camera.lookAt(happy.group.position.x, 1.0, happy.group.position.z);
      } else if (phaseRef.current === "counter") {
        camera.position.lerp(new THREE.Vector3(server.group.position.x + 2.6, 2.3, server.group.position.z + 3.6), Math.min(1, dt * 3));
        camera.lookAt(server.group.position.x, 1.2, server.group.position.z);
      } else if (phaseRef.current === "walking") {
        // POV: ride on the server dog's head, looking where he walks
        const p = server.group.position;
        const ang = server.group.rotation.y;
        const eye = new THREE.Vector3(p.x + Math.sin(ang) * 0.5, 1.62, p.z + Math.cos(ang) * 0.5);
        camera.position.lerp(eye, Math.min(1, dt * 8));
        camera.lookAt(p.x + Math.sin(ang) * 8, 1.2, p.z + Math.cos(ang) * 8);
      } else {
        camera.position.lerp(new THREE.Vector3(happyTable.position.x + 3.6, 2.6, happyTable.position.z + 4.2), Math.min(1, dt * 3));
        camera.lookAt(happyTable.position.x, 1.0, happyTable.position.z);
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
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dogName, item.id, tableNumber]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl bg-[#1b1208] border border-amber-400/30 rounded-3xl shadow-2xl overflow-hidden text-white flex flex-col max-h-[94vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#2b1c12]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-400 rounded-xl text-lg">☕</div>
            <div>
              <h3 className="text-sm font-black leading-none">Happy Café — Dog Service</h3>
              <p className="text-[11px] text-amber-100/70 mt-1">
                {item.emoji} {item.name} · Table {tableNumber}
                {phase === "walking" ? " · server dog POV 🎥" : ""}
              </p>
            </div>
          </div>
          <button
            onClick={() => doneCb.current()}
            className="p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Skip"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div ref={mountRef} className="relative w-full h-[52vh] min-h-[320px]" />
        <div className="px-4 py-3 bg-[#2b1c12] border-t border-white/10 text-center text-xs font-bold text-amber-100/90 min-h-[40px] flex items-center justify-center">
          {caption}
        </div>
      </div>
    </div>
  );
};
