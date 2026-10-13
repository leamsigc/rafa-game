import * as THREE from "three";
import { Dog3D } from "../dog3d/DogModel";
import { DogBreed } from "../../types/pet";

const BLANKET = 0x7c5ba6;
const BLANKET_TRIM = 0x9b7bc7;
const BLANKET_DARK = 0x5a3f7d;
const MILK = 0x5c3a21;
const MILK_HI = 0x7a4e2c;
const STEEL = 0x8fa3b8;

export interface CozySceneCallbacks {
  /** 0-100, how much chocolate milk is left in the bowl. */
  onMilkLevel?: (level: number) => void;
  /** Fires once the bowl is empty. */
  onFinished?: () => void;
  /** One lap finished (drives the counter in the UI). */
  onSip?: (count: number) => void;
}

const SIPS_TOTAL = 6;
const SIP_SECONDS = 1.5;
/** Height of the bowl's inner floor: it sits on the wooden stand. */
const BOWL_BASE_Y = 0.66;

/**
 * The cozy room, in real 3D: Happy sits facing the camera wrapped in a
 * blanket, with a chocolate-milk dispenser and bowl in front of him. He
 * drinks the bowl dry one sip at a time.
 */
export class CozyScene3D {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private clock = new THREE.Clock();
  private animFrame = 0;
  private destroyed = false;

  private dog: Dog3D;
  private blanket: THREE.Mesh;
  private milkSurface!: THREE.Mesh;
  private milkRipple!: THREE.Mesh;
  private pourStream!: THREE.Mesh;
  private lampLight!: THREE.PointLight;
  private lampBulb!: THREE.Mesh;

  private milk = 100;
  private sipT = 0;
  private sips = 0;
  private finished = false;
  private introT = 0;

  constructor(
    container: HTMLElement,
    breed: DogBreed = "golden",
    collarColor = "#e11d48",
    private cb: CozySceneCallbacks = {}
  ) {
    this.container = container;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0705);
    this.scene.fog = new THREE.FogExp2(0x140d07, 0.04);

    this.camera = new THREE.PerspectiveCamera(
      40,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.1,
      60
    );
    // Front view: the dog model faces +z, so the camera sits on +z.
    // Framed on his head and chest, which sit high when he sits up.
    this.camera.position.set(0, 1.5, 4.3);
    this.camera.lookAt(0, 1.02, 0.15);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    container.appendChild(this.renderer.domElement);

    this.buildRoom();
    this.buildLights();

    // Happy, sitting, facing us.
    this.dog = new Dog3D(breed, collarColor);
    this.dog.group.position.set(0, 0, 0);
    this.dog.group.rotation.y = 0;
    this.dog.setAction("cozy", 0);
    this.scene.add(this.dog.group);

    this.blanket = this.buildBlanket();
    this.dog.group.add(this.blanket);

    const station = this.buildMilkStation();
    this.scene.add(station);

    this.handleResize = this.handleResize.bind(this);
    window.addEventListener("resize", this.handleResize);
    this.loop();
  }

  // -----------------------------------------------------------------------
  // Room
  // -----------------------------------------------------------------------

  private buildRoom() {
    const room = new THREE.Group();
    this.scene.add(room);

    // Floorboards
    const floorCanvas = document.createElement("canvas");
    floorCanvas.width = 512;
    floorCanvas.height = 512;
    const fc = floorCanvas.getContext("2d")!;
    fc.fillStyle = "#6b4423";
    fc.fillRect(0, 0, 512, 512);
    fc.strokeStyle = "#4a2d16";
    fc.lineWidth = 3;
    for (let y = 0; y < 512; y += 64) {
      fc.beginPath();
      fc.moveTo(0, y);
      fc.lineTo(512, y);
      fc.stroke();
      for (let x = (y % 128 === 0 ? 0 : 64); x < 512; x += 128) {
        fc.beginPath();
        fc.moveTo(x, y);
        fc.lineTo(x, y + 64);
        fc.stroke();
      }
    }
    const floorTex = new THREE.CanvasTexture(floorCanvas);
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(3, 3);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 14),
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    room.add(floor);

    // Back + side walls, generous so no edge of the void is ever in frame
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x4a3526,
      roughness: 0.95,
      side: THREE.DoubleSide,
    });
    const back = new THREE.Mesh(new THREE.BoxGeometry(14, 5, 0.2), wallMat);
    back.position.set(0, 2.5, -3.2);
    back.receiveShadow = true;
    room.add(back);

    const left = new THREE.Mesh(new THREE.BoxGeometry(0.2, 5, 8), wallMat);
    left.position.set(-4.2, 2.5, 0.5);
    left.receiveShadow = true;
    room.add(left);

    const right = left.clone();
    right.position.x = 4.2;
    room.add(right);

    // Warm rug under the whole scene
    const rug = new THREE.Mesh(
      new THREE.CylinderGeometry(2.1, 2.15, 0.03, 40),
      new THREE.MeshStandardMaterial({ color: 0x8c4a3a, roughness: 0.98 })
    );
    rug.position.set(0, 0.015, 0.5);
    rug.receiveShadow = true;
    room.add(rug);

    // Night window on the back wall
    const win = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 1.2),
      new THREE.MeshBasicMaterial({ color: 0x0b1a3a })
    );
    win.position.set(-2.6, 2.1, -3.08);
    room.add(win);
    const winFrame = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 1.4, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x2f2118, roughness: 0.8 })
    );
    winFrame.position.set(-2.6, 2.1, -3.14);
    room.add(winFrame);
  }

  private buildLights() {
    this.scene.add(new THREE.AmbientLight(0xa87c52, 1.5));

    // Key: the bedside lamp
    this.lampLight = new THREE.PointLight(0xffc98a, 9, 16, 1.5);
    this.lampLight.position.set(1.9, 2.3, 2.0);
    this.lampLight.castShadow = true;
    this.lampLight.shadow.mapSize.set(1024, 1024);
    this.scene.add(this.lampLight);

    // A second warm lamp on the other side so both ears catch the light
    const lamp2 = new THREE.PointLight(0xffb86b, 5, 14, 1.6);
    lamp2.position.set(-2.0, 2.0, 1.4);
    this.scene.add(lamp2);

    // The lamp itself, so the glow has a source on screen
    const shade = new THREE.Mesh(
      new THREE.ConeGeometry(0.34, 0.4, 18, 1, true),
      new THREE.MeshStandardMaterial({
        color: 0xe8b06a,
        emissive: 0xffb86b,
        emissiveIntensity: 0.9,
        roughness: 0.7,
        side: THREE.DoubleSide,
      })
    );
    shade.position.set(1.9, 2.5, 2.0);
    this.scene.add(shade);

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.05, 1.9, 10),
      new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.6, metalness: 0.3 })
    );
    pole.position.set(1.9, 1.2, 2.0);
    this.scene.add(pole);
    this.lampBulb = shade;

    // Cool moonlight fill from the window, so the shadows aren't dead
    const moon = new THREE.DirectionalLight(0x8fb4ff, 0.85);
    moon.position.set(-3.5, 3, -1.5);
    this.scene.add(moon);

    // Soft front fill so his face reads
    const fill = new THREE.PointLight(0xffe0b8, 4.5, 9, 1.6);
    fill.position.set(0, 1.7, 3.2);
    this.scene.add(fill);
  }

  // -----------------------------------------------------------------------
  // The blanket, draped around him
  // -----------------------------------------------------------------------

  /**
   * A draped fleece: a lathed bell shape from the shoulders to the floor,
   * with radial fold ripples and a wavy hem so it reads as cloth, not a cone.
   * Parented to the dog so it follows his body.
   */
  private buildBlanket(): THREE.Mesh {
    const profile: THREE.Vector2[] = [];
    // Wide enough at the top to swallow his chest, which bulges forward.
    const pts: [number, number][] = [
      [0.60, 1.04],
      [0.70, 0.94],
      [0.82, 0.76],
      [0.92, 0.50],
      [1.01, 0.24],
      [1.08, 0.03],
    ];
    for (const [r, y] of pts) profile.push(new THREE.Vector2(r, y));

    const geom = new THREE.LatheGeometry(profile, 44);

    // Fold the cloth: ripple the radius and lift the hem into soft waves.
    const pos = geom.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const theta = Math.atan2(v.z, v.x);
      const drop = THREE.MathUtils.clamp((1.04 - v.y) / 1.04, 0, 1);
      // Vertical folds get stronger toward the hem
      const ripple = Math.cos(theta * 7) * 0.055 * drop;
      const len = Math.hypot(v.x, v.z) || 1;
      v.x += (v.x / len) * ripple;
      v.z += (v.z / len) * ripple;
      // Wavy hem
      if (v.y < 0.32) v.y += Math.cos(theta * 7 + 0.6) * 0.07 * (1 - v.y / 0.32);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geom.computeVertexNormals();

    const mesh = new THREE.Mesh(
      geom,
      new THREE.MeshStandardMaterial({
        color: BLANKET,
        roughness: 0.98,
        metalness: 0,
        side: THREE.DoubleSide,
      })
    );
    // Deeper front-to-back so the wrap clears his chest and muzzle, but kept
    // short enough that the bowl in front is never hidden by the hem.
    mesh.scale.set(1, 1, 1.12);
    mesh.position.z = -0.16;
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Rolled trim where the blanket meets his chest
    const trim = new THREE.Mesh(
      new THREE.TorusGeometry(0.605, 0.08, 10, 34),
      new THREE.MeshStandardMaterial({ color: BLANKET_TRIM, roughness: 0.95 })
    );
    trim.rotation.x = Math.PI / 2;
    trim.scale.z = 1.12;
    trim.position.set(0, 1.03, -0.16);
    trim.castShadow = true;
    mesh.add(trim);

    // Star motif on the fleece, sitting proud of the cloth
    const starMat = new THREE.MeshStandardMaterial({ color: BLANKET_TRIM, roughness: 0.9 });
    for (const [sx, sy, sz, r] of [
      [-0.62, 0.6, 0.62, 0.1],
      [0.6, 0.44, 0.64, 0.085],
      [0.04, 0.84, 0.7, 0.07],
    ] as [number, number, number, number][]) {
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(r, 0), starMat);
      star.position.set(sx, sy, sz);
      star.scale.z = 0.3;
      star.castShadow = true;
      mesh.add(star);
    }

    return mesh;
  }

  // -----------------------------------------------------------------------
  // Chocolate milk dispenser + bowl
  // -----------------------------------------------------------------------

  private buildMilkStation(): THREE.Group {
    const g = new THREE.Group();

    const steel = new THREE.MeshStandardMaterial({
      color: STEEL,
      roughness: 0.32,
      metalness: 0.72,
    });

    // --- The bowl, on a low wooden stand so a sitting dog can reach it ---
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x7a4f2c, roughness: 0.9 });
    const stand = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.6, 0.86), woodMat);
    stand.position.set(0, 0.3, 1.3);
    stand.castShadow = true;
    stand.receiveShadow = true;
    g.add(stand);
    const standTop = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.07, 0.96), woodMat);
    standTop.position.set(0, 0.63, 1.3);
    standTop.castShadow = true;
    standTop.receiveShadow = true;
    g.add(standTop);

    const bowlProfile: THREE.Vector2[] = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.18, 0.005),
      new THREE.Vector2(0.3, 0.07),
      new THREE.Vector2(0.37, 0.18),
      new THREE.Vector2(0.39, 0.22),
      new THREE.Vector2(0.36, 0.22),
      new THREE.Vector2(0.345, 0.17),
      new THREE.Vector2(0.27, 0.06),
      new THREE.Vector2(0.16, 0.02),
      new THREE.Vector2(0.0, 0.015),
    ];
    const bowl = new THREE.Mesh(
      new THREE.LatheGeometry(bowlProfile, 40),
      new THREE.MeshStandardMaterial({
        color: STEEL,
        roughness: 0.28,
        metalness: 0.75,
        side: THREE.DoubleSide,
      })
    );
    bowl.position.set(0, 0.66, 1.3);
    bowl.castShadow = true;
    bowl.receiveShadow = true;
    g.add(bowl);

    // --- Chocolate milk surface, its height tracks how much is left ---
    this.milkSurface = new THREE.Mesh(
      new THREE.CircleGeometry(0.335, 36),
      new THREE.MeshStandardMaterial({ color: MILK, roughness: 0.2, metalness: 0.15 })
    );
    this.milkSurface.rotation.x = -Math.PI / 2;
    this.milkSurface.position.set(0, 0.8, 1.3);
    g.add(this.milkSurface);

    // Expanding ring used for lap ripples
    this.milkRipple = new THREE.Mesh(
      new THREE.RingGeometry(0.05, 0.09, 26),
      new THREE.MeshBasicMaterial({
        color: MILK_HI,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
      })
    );
    this.milkRipple.rotation.x = -Math.PI / 2;
    this.milkRipple.position.set(0, 0.8, 1.3);
    g.add(this.milkRipple);

    // The pour of milk from his mouth down into the surface
    this.pourStream = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.05, 1, 8),
      new THREE.MeshStandardMaterial({ color: MILK, roughness: 0.3 })
    );
    this.pourStream.visible = false;
    this.pourStream.castShadow = true;
    g.add(this.pourStream);

    // --- Dispenser, set off to one side so it never hides him ---
    const tank = new THREE.Group();
    tank.position.set(1.15, 0, 0.62);
    tank.rotation.y = -0.5;
    g.add(tank);

    const canister = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.7, 28), steel);
    canister.position.y = 0.98;
    canister.castShadow = true;
    tank.add(canister);

    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.375, 0.375, 0.08, 28), steel);
    lid.position.y = 1.37;
    lid.castShadow = true;
    tank.add(lid);

    // Gauge showing how much chocolate milk is left in the tank
    const tankMilk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.332, 0.332, 0.66, 24),
      new THREE.MeshStandardMaterial({ color: MILK, roughness: 0.45 })
    );
    tankMilk.position.y = 0.98;
    tank.add(tankMilk);

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.45, 0.62, 22), steel);
    base.position.y = 0.31;
    base.castShadow = true;
    tank.add(base);

    // Spout arcing over toward the bowl
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.52, 12), steel);
    spout.position.set(-0.12, 0.6, 0.3);
    spout.rotation.set(1.15, 0, 0.5);
    spout.castShadow = true;
    tank.add(spout);

    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.055, 0.14, 12), steel);
    nozzle.position.set(-0.34, 0.48, 0.44);
    nozzle.castShadow = true;
    tank.add(nozzle);

    this.tankMilk = tankMilk;
    return g;
  }

  private tankMilk!: THREE.Mesh;

  // -----------------------------------------------------------------------
  // Loop
  // -----------------------------------------------------------------------

  private loop = () => {
    if (this.destroyed) return;
    this.animFrame = requestAnimationFrame(this.loop);
    const delta = Math.min(this.clock.getDelta(), 0.05);
    const elapsed = this.clock.getElapsedTime();

    this.introT = Math.min(1, this.introT + delta / 1.2);
    this.updateSipping(delta);
    this.updateMilk();
    this.updateLamp(elapsed);

    this.dog.update(delta, elapsed);
    this.renderer.render(this.scene, this.camera);
  };

  /** One lap every SIP_SECONDS until the bowl is empty. */
  private updateSipping(delta: number) {
    if (this.finished) {
      this.dog.cozySip = Math.max(0, this.dog.cozySip - delta * 4);
      return;
    }

    this.sipT += delta / SIP_SECONDS;
    if (this.sipT >= 1) {
      this.sipT = 0;
      this.sips += 1;
      this.milk = Math.max(0, 100 - (this.sips / SIPS_TOTAL) * 100);
      this.cb.onSip?.(this.sips);
      this.cb.onMilkLevel?.(this.milk);
      if (this.sips >= SIPS_TOTAL) {
        this.finished = true;
        this.cb.onFinished?.();
      }
    }

    // 0→0.3 lean down, 0.3→0.75 lap, 0.75→1 sit back up
    const t = this.sipT;
    let dip: number;
    if (t < 0.3) dip = t / 0.3;
    else if (t < 0.75) dip = 1;
    else dip = 1 - (t - 0.75) / 0.25;
    this.dog.cozySip = Math.max(0, Math.min(1, dip));
  }

  /** Drop the milk surface (and the tank gauge) to match what's left. */
  private updateMilk() {
    const frac = this.milk / 100;
    // Bowl interior sits on the stand: 0.03 up from the bowl floor to the rim.
    const surfaceY = BOWL_BASE_Y + 0.03 + frac * 0.165;
    this.milkSurface.position.y = surfaceY;
    // Keep the disc inside the bowl walls as the level drops.
    this.milkSurface.scale.setScalar(0.62 + frac * 0.38);
    this.tankMilk.scale.y = Math.max(0.02, frac);
    this.tankMilk.position.y = 0.65 + (0.66 * this.tankMilk.scale.y) / 2;

    // Milk stream from the snout down into the surface
    const lapping = this.dog.cozySip > 0.75;
    this.pourStream.visible = lapping && frac > 0;
    if (this.pourStream.visible) {
      const topY = surfaceY + 0.34;
      const h = Math.max(0.02, topY - surfaceY);
      this.pourStream.scale.set(1, h, 1);
      this.pourStream.position.set(0, surfaceY + h / 2, 1.3);
    }


    // Ripples spread out from the point of impact
    if (lapping) {
      const mat = this.milkRipple.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.5;
      const s = 1 + ((this.clock.elapsedTime * 1.6) % 1) * 2.2;
      this.milkRipple.scale.setScalar(s);
      this.milkRipple.position.y = surfaceY + 0.004;
    } else {
      (this.milkRipple.material as THREE.MeshBasicMaterial).opacity = 0;
    }
  }

  /** Gentle lamp flicker so the room feels alive. */
  private updateLamp(elapsed: number) {
    const f =
      0.9 +
      Math.sin(elapsed * 1.7) * 0.05 +
      Math.sin(elapsed * 5.3) * 0.03 +
      Math.sin(elapsed * 11.1) * 0.02;
    this.lampLight.intensity = 3.2 * f;
    (this.lampBulb.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.55 * f;
  }

  private handleResize = () => {
    const w = this.container.clientWidth;
    const h = Math.max(1, this.container.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.animFrame);
    window.removeEventListener("resize", this.handleResize);
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry?.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) m?.dispose();
      }
    });
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
