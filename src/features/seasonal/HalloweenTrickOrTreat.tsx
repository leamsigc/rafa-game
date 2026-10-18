import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { X } from "lucide-react";
import { sound } from "../../utils/audio";

interface HalloweenTrickOrTreatProps {
  dogName: string;
  houseName: string;
  onDone: () => void;
}

type Phase = "greet" | "pov";

/**
 * Halloween knock cutscene, in full 3D.
 *
 * Beat 1 (greet): you see Happy standing on the porch with his little pumpkin
 * bucket and he says "Trick or treat!" as the neighbour's door swings open.
 * Beat 2 (pov): the camera becomes the NEIGHBOUR DOG's point of view — you
 * look down at the bucket and watch his paw lift and let a pawful of candy
 * drop into it.
 */
export const HalloweenTrickOrTreat: React.FC<HalloweenTrickOrTreatProps> = ({
  dogName,
  houseName,
  onDone,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("greet");
  const phaseRef = useRef<Phase>("greet");
  const doneRef = useRef(false);
  const doneCb = useRef(onDone);
  doneCb.current = onDone;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d0722);
    scene.fog = new THREE.Fog(0x0d0722, 12, 34);

    const camera = new THREE.PerspectiveCamera(58, mount.clientWidth / mount.clientHeight, 0.05, 120);
    camera.position.set(3, 2.4, 5);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);

    // Spooky night lighting + a warm porch lamp
    scene.add(new THREE.HemisphereLight(0x4b3b8f, 0x140c2c, 0.7));
    const moon = new THREE.DirectionalLight(0xa9c4ff, 0.7);
    moon.position.set(-6, 10, 6);
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    moon.shadow.camera.left = -8;
    moon.shadow.camera.right = 8;
    moon.shadow.camera.top = 8;
    moon.shadow.camera.bottom = -8;
    scene.add(moon);
    const porch = new THREE.PointLight(0xffa94d, 2.0, 12);
    porch.position.set(0, 3.0, -0.5);
    scene.add(porch);

    // Ground + steps
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.MeshStandardMaterial({ color: 0x241a12, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // House facade + doorway (the door pivots open on a hinge group)
    const facade = new THREE.Mesh(
      new THREE.BoxGeometry(7, 6, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.9 })
    );
    facade.position.set(0, 3, -0.6);
    facade.receiveShadow = true;
    scene.add(facade);
    const doorway = new THREE.Mesh(
      new THREE.PlaneGeometry(1.7, 2.6),
      new THREE.MeshStandardMaterial({ color: 0x2b1a08 })
    );
    doorway.position.set(0, 1.3, -0.34);
    scene.add(doorway);
    const doorHinge = new THREE.Group();
    doorHinge.position.set(-0.85, 0, -0.3);
    const doorMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 2.6, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x8b2e0f, roughness: 0.7 })
    );
    doorMesh.position.set(0.85, 1.3, 0);
    doorMesh.castShadow = true;
    doorHinge.add(doorMesh);
    scene.add(doorHinge);
    // Pumpkins on the step
    for (const px of [-1.9, 1.9]) {
      const p = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 14, 12),
        new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0x7c2d12, emissiveIntensity: 0.4 })
      );
      p.scale.y = 0.8;
      p.position.set(px, 0.28, 0.4);
      p.castShadow = true;
      scene.add(p);
    }

    // ---- Simple quadruped builder ----
    function makeDog(color: number, accent: number) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 1.1), new THREE.MeshStandardMaterial({ color, roughness: 0.75 }));
      body.position.y = 0.75;
      body.castShadow = true;
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshStandardMaterial({ color, roughness: 0.75 }));
      head.position.set(0, 1.24, 0.62);
      head.castShadow = true;
      const snout = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.3), new THREE.MeshStandardMaterial({ color: accent }));
      snout.position.set(0, 1.14, 0.9);
      const earGeom = new THREE.BoxGeometry(0.14, 0.28, 0.1);
      const earL = new THREE.Mesh(earGeom, new THREE.MeshStandardMaterial({ color: accent }));
      earL.position.set(-0.18, 1.5, 0.62);
      const earR = earL.clone();
      earR.position.x = 0.18;
      const collar = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.1, 0.46),
        new THREE.MeshStandardMaterial({ color: 0xdb2777 })
      );
      collar.position.set(0, 0.98, 0.62);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.45), new THREE.MeshStandardMaterial({ color }));
      tail.position.set(0, 0.95, -0.62);
      const legGeom = new THREE.CylinderGeometry(0.09, 0.09, 0.55, 8);
      for (const [lx, lz] of [[-0.2, 0.38], [0.2, 0.38], [-0.2, -0.38], [0.2, -0.38]] as [number, number][]) {
        const leg = new THREE.Mesh(legGeom, new THREE.MeshStandardMaterial({ color: accent }));
        leg.position.set(lx, 0.28, lz);
        leg.castShadow = true;
        g.add(leg);
      }
      g.add(body, head, snout, earL, earR, collar, tail);
      return { group: g, tail, head };
    }

    // Happy on the porch with his bucket
    const happy = makeDog(0xd9a441, 0x8a5a1e);
    happy.group.position.set(0, 0, 2.0);
    happy.group.rotation.y = Math.PI; // faces the door / neighbour
    scene.add(happy.group);

    // The little pumpkin bucket (in Happy's mouth)
    const bucket = new THREE.Group();
    const bucketBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.24, 0.36, 16),
      new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.5, emissive: 0x7c2d12, emissiveIntensity: 0.35 })
    );
    bucket.add(bucketBody);
    const handle = new THREE.Mesh(
      new THREE.TorusGeometry(0.24, 0.025, 8, 16, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0x3f2a17 })
    );
    handle.position.y = 0.18;
    bucket.add(handle);
    // jack-o'-lantern face
    {
      const c = document.createElement("canvas");
      c.width = 128;
      c.height = 128;
      const cx = c.getContext("2d")!;
      cx.fillStyle = "#fde047";
      cx.beginPath();
      cx.moveTo(34, 50);
      cx.lineTo(54, 50);
      cx.lineTo(44, 34);
      cx.closePath();
      cx.fill();
      cx.beginPath();
      cx.moveTo(74, 50);
      cx.lineTo(94, 50);
      cx.lineTo(84, 34);
      cx.closePath();
      cx.fill();
      cx.beginPath();
      cx.arc(64, 84, 16, 0, Math.PI);
      cx.fill();
      const face = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true }));
      face.scale.set(0.5, 0.5, 1);
      face.position.set(0, 0.02, 0.29);
      bucket.add(face);
    }
    const homeBucket = new THREE.Vector3(0, 0.9, 1.75);
    bucket.position.copy(homeBucket);
    scene.add(bucket);

    // The neighbour dog, revealed in the doorway
    const neighbor = makeDog(0x8b5e34, 0x3f2a17);
    neighbor.group.position.set(0, 0, -0.02);
    neighbor.group.rotation.y = 0; // faces Happy
    neighbor.group.visible = false;
    scene.add(neighbor.group);

    // The neighbour's paw + a candy it is holding (only in the POV beat)
    const paw = new THREE.Group();
    const pawMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 14, 12),
      new THREE.MeshStandardMaterial({ color: 0x8b5e34 })
    );
    paw.add(pawMesh);
    for (let i = 0; i < 3; i++) {
      const toe = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), new THREE.MeshStandardMaterial({ color: 0x3f2a17 }));
      toe.position.set((i - 1) * 0.12, -0.12, 0.2);
      paw.add(toe);
    }
    paw.visible = false;
    scene.add(paw);

    // Falling candy pieces
    const candyColors = [0xef4444, 0x22c55e, 0xf59e0b, 0xa855f7, 0x38bdf8, 0xf472b6];
    const candies: { mesh: THREE.Mesh; vel: THREE.Vector3; spawned: boolean }[] = [];
    for (let i = 0; i < 4; i++) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 10, 10),
        new THREE.MeshStandardMaterial({ color: candyColors[i % candyColors.length], roughness: 0.4 })
      );
      mesh.visible = false;
      mesh.castShadow = true;
      scene.add(mesh);
      candies.push({ mesh, vel: new THREE.Vector3(), spawned: false });
    }

    // ---- Speech bubble ----
    const makeBubble = (text: string) => {
      const c = document.createElement("canvas");
      c.width = 512;
      c.height = 200;
      const cx = c.getContext("2d")!;
      cx.fillStyle = "rgba(255,247,237,0.97)";
      cx.beginPath();
      cx.roundRect(10, 10, 492, 180, 30);
      cx.fill();
      cx.strokeStyle = "#db2777";
      cx.lineWidth = 6;
      cx.stroke();
      cx.fillStyle = "#111827";
      cx.font = "bold 44px sans-serif";
      cx.textAlign = "center";
      const words = text.split(" ");
      const lines: string[] = [];
      let cur = "";
      for (const w of words) {
        const test = cur ? cur + " " + w : w;
        if (cx.measureText(test).width > 430) {
          lines.push(cur);
          cur = w;
        } else cur = test;
      }
      if (cur) lines.push(cur);
      lines.slice(0, 3).forEach((ln, i) => cx.fillText(ln, 256, 90 + i * 52));
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true }));
      s.scale.set(2.6, 1.0, 1);
      return s;
    };
    const bubble = makeBubble(`${dogName}: "Trick or treat!"`);
    bubble.position.set(0, 2.4, 2.0);
    scene.add(bubble);

    const GREET_END = 2.4;
    const POV_END = 6.2;
    let povCandyTimer = 0;
    let povCandySpawned = 0;

    const setPhaseBoth = (p: Phase) => {
      phaseRef.current = p;
      setPhase(p);
    };

    const finish = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      doneCb.current();
    };

    const clock = new THREE.Clock();
    let raf = 0;

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;

      // Door swings open shortly after the greeting starts
      const doorOpen = THREE.MathUtils.clamp((t - 0.7) / 0.9, 0, 1);
      doorHinge.rotation.y = -doorOpen * (Math.PI * 0.62);
      neighbor.group.visible = doorOpen > 0.4;

      if (phaseRef.current === "greet") {
        happy.tail.rotation.z = Math.sin(t * 8) * 0.4;
        happy.head.rotation.y = Math.sin(t * 2.2) * 0.2;
        camera.position.lerp(new THREE.Vector3(2.4, 2.1, 5.0), Math.min(1, dt * 3));
        camera.lookAt(0, 1.2, 1.4);
        if (t >= GREET_END) {
          setPhaseBoth("pov");
          scene.remove(bubble);
        }
      } else {
        // POV of the neighbour dog, looking down at the bucket
        camera.position.lerp(new THREE.Vector3(0, 1.5, 0.15), Math.min(1, dt * 6));
        camera.lookAt(0, 0.75, 1.75);

        // Paw dips in from the top and lets candy go
        paw.visible = true;
        povCandyTimer += dt;
        const cycle = povCandyTimer % 1.1;
        const dip = Math.sin(Math.min(1, cycle / 0.55) * Math.PI);
        paw.position.set(-0.05, 2.1 - dip * 0.85, 0.9);
        paw.rotation.x = -0.4;

        if (cycle > 0.55 && povCandySpawned < candies.length) {
          const c = candies[povCandySpawned];
          if (!c.spawned) {
            c.spawned = true;
            c.mesh.visible = true;
            c.mesh.position.set(paw.position.x, paw.position.y - 0.15, paw.position.z);
            c.vel.set((Math.random() - 0.5) * 0.8, -0.6, 1.1);
            povCandySpawned++;
            sound.playBallBounce();
          }
        }

        // Candy physics: fall toward the bucket at (0,0.9,1.75)
        for (const c of candies) {
          if (!c.spawned || !c.mesh.visible) continue;
          c.vel.y -= 9 * dt;
          c.mesh.position.addScaledVector(c.vel, dt);
          if (c.mesh.position.y <= 0.95 && c.mesh.position.z >= 1.5) {
            // landed in the bucket
            c.mesh.position.y = 0.95;
            c.vel.set(0, 0, 0);
          }
        }
        if (povCandySpawned >= candies.length && t >= POV_END) finish();
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
  }, [dogName, houseName]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl bg-[#140c2c] border border-orange-400/40 rounded-3xl shadow-2xl overflow-hidden text-white flex flex-col max-h-[94vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#1d1236]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-orange-500 rounded-xl text-lg">🎃</div>
            <div>
              <h3 className="text-sm font-black leading-none">Trick or Treat! — {houseName}</h3>
              <p className="text-[11px] text-orange-100/70 mt-1">
                {phase === "pov" ? "Neighbour dog's POV 🎥 — candy incoming!" : `${dogName} knocks at the door…`}
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
        <div className="px-4 py-3 bg-[#1d1236] border-t border-white/10 text-center text-xs font-bold text-orange-100/90">
          {phase === "greet"
            ? `${dogName}: "Trick or treat!"`
            : "The neighbour lifts his paw… and lets a whole pawful of candy drop into your bucket! 🍬"}
        </div>
      </div>
    </div>
  );
};
