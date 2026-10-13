import * as THREE from "three";
import { Dog3D } from "../dog3d/DogModel";
import { MpMemberState } from "./mpClient";

/**
 * LobbyScene — the multiplayer waiting dimension.
 *
 * A dark void with a blue landing circle for your dog in the middle and four
 * more circles around it. Every time somebody joins, their pup flies down
 * out of the sky and lands on a circle. When the host presses START
 * EXPEDITION, the whole void transforms into one massive disc with a yellow
 * ring and blue inside, and every dog swoops out of the sky onto it.
 */
interface LobbyDog {
  dog: Dog3D;
  slot: number;
  landingT: number; // 0..1 descent from the sky; 1 = landed
  landingDelay: number;
}

const SLOT_POSITIONS: [number, number][] = [
  [0, 0], // center — the creator's dog
  [3.4, 0],
  [0, 3.4],
  [-3.4, 0],
  [0, -3.4],
];

export class LobbyScene {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private clock = new THREE.Clock();
  private animFrameId: number | null = null;
  private isDestroyed = false;

  private circles: THREE.Group[] = [];
  private bigDisc: THREE.Group = new THREE.Group();
  private dogs = new Map<string, LobbyDog>();
  private starfield!: THREE.Points;
  private mode: "lobby" | "expedition" = "lobby";
  private expeditionFade = 0;

  constructor(container: HTMLElement) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x040617);
    this.scene.fog = new THREE.Fog(0x040617, 18, 42);

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;
    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 200);
    this.camera.position.set(0, 4.6, 9.5);
    this.camera.lookAt(0, 0.6, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    this.buildLights();
    this.buildStarfield();
    this.buildCircles();
    this.buildBigDisc();

    window.addEventListener("resize", this.handleResize);
    this.start();
  }

  private buildLights() {
    this.scene.add(new THREE.AmbientLight(0x8899ff, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(4, 8, 5);
    this.scene.add(key);
    const rim = new THREE.PointLight(0x38bdf8, 40, 40);
    rim.position.set(0, 5, 0);
    this.scene.add(rim);
  }

  private buildStarfield() {
    const count = 700;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 30 + Math.random() * 50;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = Math.abs(r * Math.cos(phi)) - 4;
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: 0xbfdbfe, size: 0.28, sizeAttenuation: true });
    this.starfield = new THREE.Points(geom, mat);
    this.scene.add(this.starfield);
  }

  /** One blue landing circle: glowing disc + brighter rim. */
  private makeCircle(radius: number, rimColor: number): THREE.Group {
    const g = new THREE.Group();
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, 0.08, 40),
      new THREE.MeshStandardMaterial({
        color: 0x1d4ed8,
        emissive: 0x1e40af,
        emissiveIntensity: 0.55,
        roughness: 0.35,
      })
    );
    disc.position.y = 0.04;
    g.add(disc);
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(radius, radius * 0.07, 12, 48),
      new THREE.MeshStandardMaterial({ color: rimColor, emissive: rimColor, emissiveIntensity: 1.1, roughness: 0.3 })
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.09;
    g.add(rim);
    return g;
  }

  private buildCircles() {
    SLOT_POSITIONS.forEach(([x, z]) => {
      const c = this.makeCircle(1.35, 0x60a5fa);
      c.position.set(x, 0, z);
      this.scene.add(c);
      this.circles.push(c);
    });
  }

  /** The massive expedition disc: yellow ring, blue inside. */
  private buildBigDisc() {
    const inside = new THREE.Mesh(
      new THREE.CylinderGeometry(9.5, 9.5, 0.12, 64),
      new THREE.MeshStandardMaterial({ color: 0x1d4ed8, emissive: 0x1e40af, emissiveIntensity: 0.5, roughness: 0.4 })
    );
    inside.position.y = 0.05;
    this.bigDisc.add(inside);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(9.5, 0.45, 16, 80),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xfacc15, emissiveIntensity: 1.0, roughness: 0.3 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.12;
    this.bigDisc.add(ring);
    this.bigDisc.visible = false;
    this.scene.add(this.bigDisc);
  }

  /** Add (or re-add) a member's dog — it flies down from the sky and lands. */
  addMember(member: MpMemberState) {
    if (this.dogs.has(member.id)) return;
    const slot = this.freeSlot();
    const dog = new Dog3D(member.breed as never, member.collarColor);
    dog.setAction("idle");
    const [x, z] = SLOT_POSITIONS[slot];
    dog.group.position.set(x, 14, z);
    dog.group.scale.setScalar(0.9);
    this.scene.add(dog.group);
    this.dogs.set(member.id, { dog, slot, landingT: 0, landingDelay: 0.15 });
  }

  removeMember(id: string) {
    const entry = this.dogs.get(id);
    if (!entry) return;
    this.scene.remove(entry.dog.group);
    this.dogs.delete(id);
  }

  private freeSlot(): number {
    const used = new Set([...this.dogs.values()].map((d) => d.slot));
    for (let i = 0; i < SLOT_POSITIONS.length; i++) {
      if (!used.has(i)) return i;
    }
    return 0;
  }

  /** START EXPEDITION: giant yellow-ringed blue disc; every dog re-lands on it. */
  startExpedition() {
    if (this.mode === "expedition") return;
    this.mode = "expedition";
    this.bigDisc.visible = true;
    this.bigDisc.scale.setScalar(0.01);
    this.expeditionFade = 0;
    // Pull the camera back to fit the massive circle
    this.camera.position.set(0, 9.5, 20);
    this.camera.lookAt(0, 0.6, 0);
    // Every dog (creator in the middle, the rest in a ring) flies out of the sky again
    let i = 0;
    const others = [...this.dogs.entries()];
    for (const [id, entry] of others) {
      const isCenter = i === 0;
      const angle = (i / Math.max(1, others.length - 1)) * Math.PI * 2;
      const r = isCenter ? 0 : 5.5;
      entry.dog.group.position.set(Math.cos(angle) * r, 16, Math.sin(angle) * r);
      entry.landingT = 0;
      entry.landingDelay = 0.3 + i * 0.35; // singular swoops, one after another
      i++;
      void id;
    }
    this.scene.fog = new THREE.Fog(0x040617, 30, 80);
  }

  private updateDogs(delta: number, elapsed: number) {
    for (const entry of this.dogs.values()) {
      entry.dog.update(delta, elapsed);
      if (entry.landingT < 1) {
        if (entry.landingDelay > 0) {
          entry.landingDelay -= delta;
        } else {
          entry.landingT = Math.min(1, entry.landingT + delta / 1.1);
        }
      }
      // Descent from the sky with a soft landing bounce
      const t = entry.landingT;
      const eased = 1 - Math.pow(1 - t, 3);
      const bounce = t >= 1 ? Math.sin(Math.min(1, (t - 1) * 8) * Math.PI) * 0.18 : 0;
      const targetXZ = this.mode === "expedition" ? entry.dog.group.position : { x: entry.dog.group.position.x, z: entry.dog.group.position.z };
      entry.dog.group.position.y = 14 * (1 - eased) + 0.12 + bounce;
      void targetXZ;
      if (t >= 1 && entry.dog.group.position.y < 0.13) entry.dog.group.position.y = 0.12;
    }
  }

  private start() {
    const animate = () => {
      if (this.isDestroyed) return;
      this.animFrameId = requestAnimationFrame(animate);
      const delta = Math.min(this.clock.getDelta(), 0.1);
      const elapsed = this.clock.getElapsedTime();

      this.updateDogs(delta, elapsed);

      // Slowly twinkle the starfield and bob the circles
      if (this.starfield) this.starfield.rotation.y = elapsed * 0.02;
      this.circles.forEach((c, i) => {
        c.position.y = Math.sin(elapsed * 1.4 + i * 1.3) * 0.06;
        c.visible = this.mode === "lobby";
      });
      if (this.mode === "expedition") {
        this.expeditionFade = Math.min(1, this.expeditionFade + delta * 0.8);
        const s = 0.01 + this.expeditionFade * 0.99;
        this.bigDisc.scale.setScalar(s);
        this.bigDisc.rotation.y = elapsed * 0.05;
      }

      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  private handleResize = () => {
    if (this.isDestroyed) return;
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 600;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  destroy() {
    this.isDestroyed = true;
    if (this.animFrameId !== null) cancelAnimationFrame(this.animFrameId);
    window.removeEventListener("resize", this.handleResize);
    for (const entry of this.dogs.values()) this.scene.remove(entry.dog.group);
    this.dogs.clear();
    this.scene.clear();
    this.renderer.dispose();
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
