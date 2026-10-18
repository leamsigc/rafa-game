import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { X, Check } from "lucide-react";
import { sound } from "../../utils/audio";

export interface CandyLine {
  id: string;
  icon: string;
  name: string;
  count: number;
}

interface HalloweenCandyUnpackProps {
  dogName: string;
  candies: CandyLine[];
  onDone: () => void;
}

type Phase = "pour" | "summary";

/**
 * The kitchen counter cutscene: Happy tips his Halloween bucket upside-down and
 * all the candy he collected pours out onto the counter, then he reads back
 * what the night's haul was. Everything is 3D.
 */
export const HalloweenCandyUnpack: React.FC<HalloweenCandyUnpackProps> = ({
  dogName,
  candies,
  onDone,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("pour");
  const doneRef = useRef(false);
  const doneCb = useRef(onDone);
  doneCb.current = onDone;

  const totalPieces = Math.min(16, Math.max(1, candies.reduce((s, c) => s + c.count, 0)));

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1b1208);
    scene.fog = new THREE.Fog(0x1b1208, 14, 32);

    const camera = new THREE.PerspectiveCamera(52, mount.clientWidth / mount.clientHeight, 0.05, 120);
    camera.position.set(0, 2.0, 4.6);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xfff3d6, 0x2a1c10, 1.05));
    const key = new THREE.DirectionalLight(0xfff1d6, 1.2);
    key.position.set(3, 8, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -8;
    key.shadow.camera.right = 8;
    key.shadow.camera.top = 8;
    key.shadow.camera.bottom = -8;
    scene.add(key);

    // Kitchen backdrop
    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 12),
      new THREE.MeshStandardMaterial({ color: 0xdcc7a4, roughness: 0.95 })
    );
    wall.position.set(0, 4.5, -3.4);
    scene.add(wall);
    const winFrame = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 1.5, 0.14),
      new THREE.MeshStandardMaterial({ color: 0x7c4a12, roughness: 0.6 })
    );
    winFrame.position.set(-0.2, 3.0, -3.3);
    scene.add(winFrame);
    const winGlass = new THREE.Mesh(
      new THREE.PlaneGeometry(1.85, 1.2),
      new THREE.MeshBasicMaterial({ color: 0xbfe6f5 })
    );
    winGlass.position.set(-0.2, 3.0, -3.22);
    scene.add(winGlass);

    // The counter with a wooden top
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(7, 1.0, 1.6),
      new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.65 })
    );
    base.position.set(0, 0.5, -1.6);
    base.receiveShadow = true;
    scene.add(base);
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(7.2, 0.14, 1.8),
      new THREE.MeshStandardMaterial({ color: 0xfdf6e3, roughness: 0.3 })
    );
    top.position.set(0, 1.06, -1.6);
    top.receiveShadow = true;
    scene.add(top);
    const counterY = 1.16;

    // The little pumpkin bucket, tipped over on the counter
    const bucket = new THREE.Group();
    const bucketBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.26, 0.4, 18),
      new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.5, emissive: 0x7c2d12, emissiveIntensity: 0.35 })
    );
    bucket.add(bucketBody);
    const handle = new THREE.Mesh(
      new THREE.TorusGeometry(0.26, 0.028, 8, 18, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0x3f2a17 })
    );
    handle.position.y = 0.2;
    bucket.add(handle);
    bucket.position.set(-2.2, counterY + 0.2, -1.55);
    scene.add(bucket);

    // Candy pieces that pour out
    const candyColors = [0xef4444, 0x22c55e, 0xf59e0b, 0xa855f7, 0x38bdf8, 0xf472b6, 0xfb923c, 0x84cc16];
    const candies3d: { mesh: THREE.Mesh; vel: THREE.Vector3; target: THREE.Vector3; t: number; live: boolean }[] = [];
    for (let i = 0; i < totalPieces; i++) {
      const mat = new THREE.MeshStandardMaterial({ color: candyColors[i % candyColors.length], roughness: 0.45 });
      const geo = i % 3 === 0
        ? new THREE.SphereGeometry(0.1, 10, 10)
        : i % 3 === 1
        ? new THREE.BoxGeometry(0.16, 0.16, 0.16)
        : new THREE.CylinderGeometry(0.08, 0.08, 0.16, 10);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      mesh.castShadow = true;
      scene.add(mesh);
      const target = new THREE.Vector3(-1.2 + (i % 8) * 0.42, counterY + 0.1, -1.35 + (i % 3) * 0.18);
      candies3d.push({ mesh, vel: new THREE.Vector3(), target, t: 0, live: false });
    }

    // A soft label sprite over the counter
    {
      const c = document.createElement("canvas");
      c.width = 512;
      c.height = 128;
      const cx = c.getContext("2d")!;
      cx.fillStyle = "rgba(63,42,23,0.92)";
      cx.beginPath();
      cx.roundRect(8, 8, 496, 112, 24);
      cx.fill();
      cx.fillStyle = "#fde68a";
      cx.font = "bold 44px sans-serif";
      cx.textAlign = "center";
      cx.fillText("🍬 HALLOWEEN HAUL 🍬", 256, 80);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true }));
      sprite.scale.set(3.2, 0.8, 1);
      sprite.position.set(0, 4.6, -2.4);
      scene.add(sprite);
    }

    let pourStarted = false;
    const clock = new THREE.Clock();
    let raf = 0;
    let pourElapsed = 0;

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;

      if (!pourStarted && t > 0.7) {
        pourStarted = true;
        sound.playPotReveal();
      }

      if (pourStarted) {
        pourElapsed += dt;
        // Bucket tips further over
        bucket.rotation.z = THREE.MathUtils.lerp(bucket.rotation.z, -1.7, Math.min(1, dt * 2.2));

        // Release candy pieces one after another
        candies3d.forEach((c, i) => {
          if (!c.live && pourElapsed > 0.15 + i * 0.12) {
            c.live = true;
            c.mesh.visible = true;
            c.mesh.position.set(bucket.position.x + 0.2, counterY + 0.25, bucket.position.z);
            c.vel.set(1.4 + Math.random() * 1.2, 0.6 + Math.random() * 0.6, (Math.random() - 0.5) * 0.8);
          }
          if (c.live) {
            const d = c.mesh.position.distanceTo(c.target);
            if (d < 0.12) {
              c.mesh.position.copy(c.target);
              c.vel.set(0, 0, 0);
            } else {
              // arc then settle onto the counter
              c.vel.y -= 7 * dt;
              const toTarget = new THREE.Vector3().subVectors(c.target, c.mesh.position);
              c.vel.addScaledVector(toTarget, dt * 2.4);
              c.vel.multiplyScalar(1 - 1.6 * dt);
              c.mesh.position.addScaledVector(c.vel, dt);
              if (c.mesh.position.y < counterY + 0.08) {
                c.mesh.position.y = counterY + 0.08;
                c.vel.y = Math.abs(c.vel.y) * 0.3;
              }
              c.mesh.rotation.x += dt * 3;
              c.mesh.rotation.z += dt * 2.4;
            }
          }
        });
      }

      // Gentle camera push-in
      camera.position.lerp(new THREE.Vector3(0, 2.1, 4.2), Math.min(1, dt * 1.4));
      camera.lookAt(0, 1.3, -1.4);

      renderer.render(scene, camera);
    };
    animate();

    const summaryTimer = window.setTimeout(() => {
      setPhase("summary");
      sound.playRewardFanfare();
    }, 5200);

    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(summaryTimer);
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
  }, [dogName, totalPieces]);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    doneCb.current();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl bg-[#1b1208] border border-amber-400/40 rounded-3xl shadow-2xl overflow-hidden text-white flex flex-col max-h-[94vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#2b1c12]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-400 rounded-xl text-lg">🍬</div>
            <div>
              <h3 className="text-sm font-black leading-none">Kitchen Counter — Unpack the Haul</h3>
              <p className="text-[11px] text-amber-100/70 mt-1">Happy tips his bucket over… everything is 3D!</p>
            </div>
          </div>
          <button
            onClick={finish}
            className="p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div ref={mountRef} className="relative w-full h-[48vh] min-h-[300px]">
          {phase === "summary" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 p-6 text-center">
              <div className="text-4xl mb-2">🍬</div>
              <h4 className="text-xl font-black text-amber-300">
                {dogName} says: &ldquo;We got…&rdquo;
              </h4>
              <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[30vh] overflow-y-auto">
                {candies.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-sm font-bold"
                  >
                    <span className="text-lg">{c.icon}</span>
                    <span>{c.name}</span>
                    <span className="text-amber-300">×{c.count}</span>
                  </li>
                ))}
                {candies.length === 0 && <li className="text-sm text-white/70">…an empty bucket! 😅</li>}
              </ul>
              <button
                onClick={finish}
                className="mt-5 px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#1b1208] font-black text-sm cursor-pointer active:scale-95 transition-transform flex items-center gap-2"
              >
                <Check className="w-4 h-4" /> Store the candy
              </button>
            </div>
          )}
        </div>
        <div className="px-4 py-3 bg-[#2b1c12] border-t border-white/10 text-center text-xs font-bold text-amber-100/90">
          {phase === "pour"
            ? "Wait for it… the candy is tumbling out onto the counter! 🍬"
            : "All stored — Happy had a very good Halloween. 🎃"}
        </div>
      </div>
    </div>
  );
};
