import * as THREE from "three";
import { Dog3D } from "./DogModel";
import { DogAction, DogBreed, BedColors, HouseViewMode, HouseRoom } from "../../types/pet";
import { sound } from "../../utils/audio";

export type TimeOfDay = "day" | "sunset" | "night";

export type WeatherType = "sunny" | "rainy" | "snowy";

export interface BallPhysics {
  active: boolean;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  bounces: number;
  inDogMouth: boolean;
}

/** Saved furniture layout from edit mode (persisted by the app). */
export interface RoomLayout {
  [objectId: string]: {
    p: [number, number, number];
    r: [number, number, number];
  };
}

export class ParkScene {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  public dog: Dog3D;

  // View Mode: Outdoor Park vs Cozy House Interior (multi-room)
  public viewMode: HouseViewMode = "park";
  public houseRoom: HouseRoom = "living";
  private parkGroup: THREE.Group = new THREE.Group();
  private houseGroup: THREE.Group = new THREE.Group();
  private kitchenGroup: THREE.Group = new THREE.Group();
  private hallwayGroup: THREE.Group = new THREE.Group();
  private upstairsGroup: THREE.Group = new THREE.Group();

  // Lights
  private ambientLight!: THREE.AmbientLight;
  private sunLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private lanternLight!: THREE.PointLight;

  // Park environment elements
  private groundMesh!: THREE.Mesh;
  private skyDome!: THREE.Mesh;
  private dogHouseExteriorGroup: THREE.Group = new THREE.Group();
  private ballMesh!: THREE.Mesh;
  private treatMesh!: THREE.Mesh;
  private obstaclesGroup: THREE.Group = new THREE.Group();
  private particlesGroup: THREE.Group = new THREE.Group();
  // Choppable park trees (axe gameplay) + distant forest treeline
  private treeGroups: THREE.Group[] = [];
  private treeData: { id: string; alive: boolean; respawnAt: number; baseScale: number }[] = [];
  private forestBorderGroup: THREE.Group = new THREE.Group();
  public onTreeChopped?: (treeId: string) => void;
  public onTreeClickedNoAxe?: () => void;
  public hasAxe: boolean = false;
  // Cooking-ready beacon above the dog house (red highlight + pot icon)
  private cookBeaconGroup: THREE.Group = new THREE.Group();
  private cookBeaconVisible: boolean = false;
  public onCookBeaconClicked?: () => void;
  // Weather system (sunny / rainy / snowy)
  public weather: WeatherType = "sunny";
  public weatherSpeedFactor: number = 1.0;
  private precipPoints: THREE.Points | null = null;
  private precipVel: Float32Array | null = null;
  private precipKind: "none" | "rain" | "snow" = "none";

  // House Room Interior elements (Living Room)
  private roomFloorMesh!: THREE.Mesh;
  private houseDoorMesh!: THREE.Mesh;
  private hallwayDoorMesh!: THREE.Mesh;

  // Kitchen Room elements (second house room)
  private kitchenFloorMesh!: THREE.Mesh;
  private kitchenHallDoorMesh!: THREE.Mesh;
  private potGroup: THREE.Group = new THREE.Group();
  private potSteamGroup: THREE.Group = new THREE.Group();

  // Hallway elements (connects living <-> kitchen, stairs to upstairs)
  private hallwayFloorMesh!: THREE.Mesh;
  private hallwayLivingMesh!: THREE.Mesh;
  private hallwayKitchenMesh!: THREE.Mesh;
  private stairsGroup: THREE.Group = new THREE.Group();
  private stairsMatMesh!: THREE.Mesh;
  private readonly STAIR_BASE = new THREE.Vector3(1.55, 0, 2.9);
  private readonly STAIR_TOP = new THREE.Vector3(1.55, 2.8, -1.1);

  // Upstairs bedroom elements (wider than deep)
  private upstairsFloorMesh!: THREE.Mesh;
  private descendMesh!: THREE.Mesh;

  // Living-room toy corner (multiple toys + toy box)
  private toyCornerGroup: THREE.Group = new THREE.Group();

  // Stair-climb animation state
  private climbAnim: { t: number; active: boolean } | null = null;

  // Edit mode (move / rotate furniture)
  public editMode: boolean = false;
  private editables: Map<string, THREE.Object3D> = new Map();
  private selectedEditId: string | null = null;
  private selectionBox: THREE.BoxHelper | null = null;
  private lastTap: { id: string; time: number } | null = null;
  private editDrag: { id: string; moved: boolean } | null = null;
  // Multi-touch edit gestures (no keyboard needed on phones)
  private touchPoints: Map<number, { x: number; y: number }> = new Map();
  private pinchState: { startDist: number; baseY: number; id: string; moved: boolean } | null = null;
  private longPressTimer: number | null = null;
  private secondFingerDownAt: number = 0;
  private suppressTapUntil: number = 0;
  // Floating marker bobbing over the grabbed object
  private selectionMarker: THREE.Group = new THREE.Group();
  private selectionTopOffset: number = 1.0;
  private markerTmp: THREE.Vector3 = new THREE.Vector3();

  // Dog Bed & Color Customization
  private bedGroup: THREE.Group = new THREE.Group();
  private bedCushionMesh!: THREE.Mesh;
  private bedFrameMesh!: THREE.Mesh;
  private bedBlanketMesh!: THREE.Mesh;
  public bedColors: BedColors = {
    cushion: "#dc2626", // Red cushion
    frame: "#854d0e",   // Warm brown rim/frame
    blanket: "#fef3c7", // Soft cream blanket
  };

  // House Toy
  private houseToyGroup: THREE.Group = new THREE.Group();
  private currentToy: "bone" | "duck" | "bear" | "ball" = "bone";
  private isToyAnimating: boolean = false;
  // Extra editable furniture groups (everything except dog house + pot)
  private upstairsDresserGroup: THREE.Group = new THREE.Group();
  private upstairsShelfGroup: THREE.Group = new THREE.Group();
  private kitchenFridgeGroup: THREE.Group = new THREE.Group();
  private kitchenCountersGroup: THREE.Group = new THREE.Group();
  private kitchenShelfGroup: THREE.Group = new THREE.Group();
  private bowlsGroup: THREE.Group = new THREE.Group();

  // Ceiling Lamp
  private ceilingLampGroup: THREE.Group = new THREE.Group();
  private ceilingLampLight!: THREE.PointLight;
  private lampBulbMesh!: THREE.Mesh;
  public isLampOn: boolean = true;

  // Click-to-Walk Movement System
  private walkTarget: THREE.Vector3 | null = null;
  private walkCallback: (() => void) | null = null;
  private walkTargetMarker: THREE.Group = new THREE.Group();

  // Ball physics & Fetch state
  public ballState: BallPhysics = {
    active: false,
    position: new THREE.Vector3(0, 0.2, 2.5),
    velocity: new THREE.Vector3(0, 0, 0),
    bounces: 0,
    inDogMouth: false,
  };
  private fetchState: "idle" | "chasing" | "grabbing" | "returning" = "idle";
  private fetchTargetPos = new THREE.Vector3();
  private fetchReturnPos = new THREE.Vector3(0, 0, 2);

  // Camera control state
  private isDragging: boolean = false;
  private prevMouseX: number = 0;
  private prevMouseY: number = 0;
  private startPointerX: number = 0;
  private startPointerY: number = 0;
  private spherical: THREE.Spherical = new THREE.Spherical(7.5, Math.PI / 3.2, 0);
  private cameraTarget: THREE.Vector3 = new THREE.Vector3(0, 1.0, 0);
  public followDog: boolean = true;
  private timeOfDay: TimeOfDay = "day";

  // Animation frame loop
  private clock: THREE.Clock = new THREE.Clock();
  private animFrameId: number | null = null;
  private isDestroyed: boolean = false;

  // Callbacks for HUD / React
  public onFetchSuccess?: (points: number) => void;
  public onPetClicked?: () => void;
  public onHouseEntered?: () => void;
  public onHouseExited?: () => void;
  public onBedClicked?: () => void;
  public onToyClicked?: () => void;
  public onPotClicked?: () => void;
  public onRoomChanged?: (room: HouseRoom) => void;
  public onDogMoved?: (target: THREE.Vector3) => void;
  public onStairsClimbed?: () => void;
  public onDescendClicked?: () => void;
  public onEditChanged?: (selectedId: string | null) => void;

  constructor(
    container: HTMLElement,
    breed: DogBreed = "golden",
    collarColor: string = "#e11d48",
    initialBedColors?: BedColors,
    initialToy: "bone" | "duck" | "bear" | "ball" = "bone",
    initialAccessory?: string,
    initialLayout?: RoomLayout | null
  ) {
    this.container = container;

    // 1. Scene setup
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0xd6eaf8, 0.015);

    // 2. Camera setup
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);

    // 3. Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);

    // 4. Lights & Sky
    this.setupLighting();
    this.setupSky();

    // 5. Park Environment (Lawn, Fences, Dog House, Agility Obstacles)
    this.setupParkEnvironment();

    // 6. House Rooms Interior (Living Room + Kitchen)
    if (initialBedColors) {
      this.bedColors = { ...initialBedColors };
    }
    if (initialToy) {
      this.currentToy = initialToy;
    }
    this.setupHouseRoom();
    this.setupKitchenRoom();
    this.setupHallway();
    this.setupUpstairs();
    this.setupToyCorner();
    this.setupCookBeacon();
    this.setupSelectionMarker();
    // Edit mode: everything movable EXCEPT the dog house + cooking pot.
    // (bed/toy/lamp indoors, dresser/shelves upstairs, counters/fridge in
    // kitchen, bowls/hurdles/trees outside — the house shell & pot stay put.)
    this.registerEditable("bed", this.bedGroup);
    this.registerEditable("toy", this.houseToyGroup);
    this.registerEditable("toycorner", this.toyCornerGroup);
    this.registerEditable("lamp", this.ceilingLampGroup);
    this.registerEditable("dresser", this.upstairsDresserGroup);
    this.registerEditable("bookshelf", this.upstairsShelfGroup);
    this.registerEditable("fridge", this.kitchenFridgeGroup);
    this.registerEditable("counters", this.kitchenCountersGroup);
    this.registerEditable("shelf", this.kitchenShelfGroup);
    this.registerEditable("bowls", this.bowlsGroup);
    this.registerEditable("hurdle", this.obstaclesGroup);
    if (initialLayout) {
      this.applyLayout(initialLayout);
    }

    // 7. Click-to-Walk Ripple Indicator
    this.setupWalkMarker();

    // 8. Add Groups to Scene
    this.scene.add(this.parkGroup);
    this.scene.add(this.houseGroup);
    this.scene.add(this.kitchenGroup);
    this.scene.add(this.hallwayGroup);
    this.scene.add(this.upstairsGroup);
    this.houseGroup.visible = false; // Initially outdoors
    this.kitchenGroup.visible = false;
    this.hallwayGroup.visible = false;
    this.upstairsGroup.visible = false;

    // 9. Dog model
    this.dog = new Dog3D(breed, collarColor);
    if (initialAccessory) {
      this.dog.setAccessory(initialAccessory);
    }
    this.dog.group.position.set(0, 0, 0);
    this.scene.add(this.dog.group);

    // Initialize camera position now that dog model and targets are ready
    this.updateCameraPosition();

    // 10. Tennis Ball
    this.setupTennisBall();

    // 11. Event listeners for Orbit & Click Interactions
    this.setupInputEvents();

    // Start loop
    this.start();
  }

  private setupLighting() {
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x4a8505, 0.6);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfffaed, 1.25);
    this.sunLight.position.set(12, 20, 10);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 50;
    const d = 14;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);

    // Doghouse lantern (active during sunset/night)
    this.lanternLight = new THREE.PointLight(0xffaa44, 0, 12);
    this.lanternLight.position.set(-4.5, 2.2, -4);
    this.scene.add(this.lanternLight);
  }

  private skyBaseColor = new THREE.Color(0x7ec8f7);
  private makeSkyGradientTexture(topColor: string, horizonColor: string): THREE.CanvasTexture {
    const c = document.createElement("canvas");
    c.width = 4;
    c.height = 256;
    const ctx = c.getContext("2d")!;
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, topColor);
    grad.addColorStop(0.55, "#9fd8f5");
    grad.addColorStop(0.78, horizonColor);
    grad.addColorStop(1, "#cfecc0");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 4, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private setupSky() {
    // Green-and-blue forest sky: blue up top melting into soft green at the
    // horizon so the treeline blends naturally into the sky.
    const skyGeom = new THREE.SphereGeometry(60, 32, 24);
    const skyMat = new THREE.MeshBasicMaterial({
      map: this.makeSkyGradientTexture("#4aa8ec", "#a8e0c8"),
      side: THREE.BackSide,
      fog: false,
    });
    this.skyDome = new THREE.Mesh(skyGeom, skyMat);
    this.scene.add(this.skyDome);
  }

  private setSkyGradient(topColor: string, horizonColor: string) {
    const mat = this.skyDome.material as THREE.MeshBasicMaterial;
    const old = mat.map;
    mat.map = this.makeSkyGradientTexture(topColor, horizonColor);
    mat.needsUpdate = true;
    if (old) old.dispose();
  }

  private setupParkEnvironment() {
    // Ground lawn
    const groundGeom = new THREE.PlaneGeometry(80, 80, 40, 40);
    groundGeom.rotateX(-Math.PI / 2);

    // Procedural grass texture canvas
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#5ba829";
    ctx.fillRect(0, 0, 512, 512);

    // Subtle lawn speckles & mowing patterns
    for (let i = 0; i < 4000; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? "#4e9620" : "#69b832";
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 3, 3);
    }
    // Mower stripes
    ctx.fillStyle = "rgba(0, 0, 0, 0.04)";
    for (let y = 0; y < 512; y += 48) {
      ctx.fillRect(0, y, 512, 24);
    }

    const groundTex = new THREE.CanvasTexture(canvas);
    groundTex.wrapS = THREE.RepeatWrapping;
    groundTex.wrapT = THREE.RepeatWrapping;
    groundTex.repeat.set(16, 16);

    const groundMat = new THREE.MeshStandardMaterial({
      map: groundTex,
      roughness: 0.95,
      metalness: 0.0,
    });
    this.groundMesh = new THREE.Mesh(groundGeom, groundMat);
    this.groundMesh.receiveShadow = true;
    this.groundMesh.userData = { type: "ground" };
    this.parkGroup.add(this.groundMesh);

    // Pathway
    const pathGeom = new THREE.PlaneGeometry(3.5, 40);
    pathGeom.rotateX(-Math.PI / 2);
    const pathMat = new THREE.MeshStandardMaterial({
      color: 0xd6c29e, // Warm cobblestone/sand
      roughness: 0.9,
    });
    const pathMesh = new THREE.Mesh(pathGeom, pathMat);
    pathMesh.position.set(9, 0.01, 0);
    pathMesh.receiveShadow = true;
    this.parkGroup.add(pathMesh);

    // Dog House Exterior
    this.buildDogHouse(-5, 0, -4);

    // Food & Water bowls on small wooden stand
    this.buildBowls(1.8, 0, -1.2);

    // Park Fencing
    this.buildFence();

    // Trees & flowering shrubs
    this.buildFlora();

    // Agility Obstacles (Hurdles & Weave poles)
    this.buildAgilityCourse();

    this.parkGroup.add(this.obstaclesGroup);
    this.scene.add(this.particlesGroup);
  }

  private buildDogHouse(x: number, y: number, z: number) {
    const house = new THREE.Group();
    house.position.set(x, y, z);

    // Walls (warm cedar wood)
    const wallGeom = new THREE.BoxGeometry(2.4, 1.8, 2.8);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.8 });
    const walls = new THREE.Mesh(wallGeom, wallMat);
    walls.position.y = 0.9;
    walls.castShadow = true;
    walls.receiveShadow = true;
    house.add(walls);

    // Doorway opening
    const doorGeom = new THREE.CylinderGeometry(0.55, 0.55, 0.1, 16);
    doorGeom.rotateX(Math.PI / 2);
    const doorMat = new THREE.MeshBasicMaterial({ color: 0x1f140e });
    const door = new THREE.Mesh(doorGeom, doorMat);
    door.position.set(0, 0.8, 1.41);
    house.add(door);

    const doorLowerGeom = new THREE.BoxGeometry(1.1, 0.8, 0.1);
    const doorLower = new THREE.Mesh(doorLowerGeom, doorMat);
    doorLower.position.set(0, 0.4, 1.41);
    house.add(doorLower);

    // Roof (red gable roof)
    const roofGeom = new THREE.ConeGeometry(2.2, 1.2, 4);
    roofGeom.rotateY(Math.PI / 4);
    roofGeom.scale(1.2, 1, 1.4);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.7 });
    const roof = new THREE.Mesh(roofGeom, roofMat);
    roof.position.y = 2.3;
    roof.castShadow = true;
    house.add(roof);

    // Warm lantern hanging on doghouse
    const lanternGeom = new THREE.CylinderGeometry(0.12, 0.16, 0.35, 8);
    const lanternMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.6,
    });
    const lantern = new THREE.Mesh(lanternGeom, lanternMat);
    lantern.position.set(1.1, 1.4, 1.45);
    house.add(lantern);

    // Bone sign with "BUDDY"
    const signGeom = new THREE.BoxGeometry(1.2, 0.35, 0.06);
    const signMat = new THREE.MeshStandardMaterial({ color: 0xfef08a });
    const sign = new THREE.Mesh(signGeom, signMat);
    sign.position.set(0, 1.6, 1.43);
    house.add(sign);

    // Tag entire exterior house for clicking
    this.dogHouseExteriorGroup = house;
    this.dogHouseExteriorGroup.userData = { type: "doghouse" };
    this.dogHouseExteriorGroup.traverse((child) => {
      child.userData = { type: "doghouse" };
    });

    this.parkGroup.add(house);
  }

  private buildBowls(x: number, y: number, z: number) {
    const bowlGroup = this.bowlsGroup;
    bowlGroup.clear();
    bowlGroup.position.set(x, y, z);

    // Wooden mat
    const matGeom = new THREE.BoxGeometry(1.4, 0.05, 0.8);
    const matMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
    const mat = new THREE.Mesh(matGeom, matMat);
    mat.position.y = 0.025;
    mat.receiveShadow = true;
    bowlGroup.add(mat);

    // Food bowl (silver with kibble)
    const bowlGeom = new THREE.CylinderGeometry(0.26, 0.18, 0.18, 16);
    const bowlMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7, roughness: 0.3 });
    const foodBowl = new THREE.Mesh(bowlGeom, bowlMat);
    foodBowl.position.set(-0.35, 0.12, 0);
    foodBowl.castShadow = true;
    bowlGroup.add(foodBowl);

    const kibbleGeom = new THREE.CylinderGeometry(0.22, 0.22, 0.05, 12);
    const kibbleMat = new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.9 });
    const kibble = new THREE.Mesh(kibbleGeom, kibbleMat);
    kibble.position.set(-0.35, 0.18, 0);
    bowlGroup.add(kibble);

    // Water bowl (blue water with shine)
    const waterBowl = new THREE.Mesh(bowlGeom, bowlMat);
    waterBowl.position.set(0.35, 0.12, 0);
    waterBowl.castShadow = true;
    bowlGroup.add(waterBowl);

    const waterGeom = new THREE.CylinderGeometry(0.22, 0.22, 0.04, 16);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.1,
      metalness: 0.4,
    });
    const water = new THREE.Mesh(waterGeom, waterMat);
    water.position.set(0.35, 0.18, 0);
    bowlGroup.add(water);

    this.parkGroup.add(bowlGroup);
  }

  private buildFence() {
    const fenceGroup = new THREE.Group();
    const postMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.8 });

    // White perimeter picket fences
    for (let i = -14; i <= 14; i += 1.8) {
      // North fence
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.3, 0.12), postMat);
      post.position.set(i, 0.65, -12);
      post.castShadow = true;
      fenceGroup.add(post);

      const picket = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.1, 0.04), postMat);
      picket.position.set(i + 0.9, 0.55, -12);
      picket.castShadow = true;
      fenceGroup.add(picket);
    }

    // Fence rails
    const railMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.8 });
    const topRail = new THREE.Mesh(new THREE.BoxGeometry(29, 0.08, 0.08), railMat);
    topRail.position.set(0, 0.9, -12);
    topRail.castShadow = true;
    fenceGroup.add(topRail);

    const bottomRail = new THREE.Mesh(new THREE.BoxGeometry(29, 0.08, 0.08), railMat);
    bottomRail.position.set(0, 0.35, -12);
    bottomRail.castShadow = true;
    fenceGroup.add(bottomRail);

    this.scene.add(fenceGroup);
  }

  private makeOneTree(scale: number, tall: boolean): THREE.Group {
    const treeMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });
    const leafMats = [
      new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.8 }),
      new THREE.MeshStandardMaterial({ color: 0x388e3c, roughness: 0.8 }),
      new THREE.MeshStandardMaterial({ color: 0x43a047, roughness: 0.8 }),
    ];
    const tree = new THREE.Group();
    const trunkH = tall ? 3.6 : 2.9;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.48, trunkH, 8), treeMat);
    trunk.position.y = trunkH / 2;
    trunk.castShadow = true;
    tree.add(trunk);
    const canopy1 = new THREE.Mesh(new THREE.SphereGeometry(1.7, 12, 12), leafMats[0]);
    canopy1.position.set(0, trunkH + 0.5, 0);
    canopy1.castShadow = true;
    tree.add(canopy1);
    const canopy2 = new THREE.Mesh(new THREE.SphereGeometry(1.3, 10, 10), leafMats[1]);
    canopy2.position.set(0.6, trunkH + 1.1, 0.4);
    canopy2.castShadow = true;
    tree.add(canopy2);
    const canopy3 = new THREE.Mesh(new THREE.SphereGeometry(0.95, 9, 9), leafMats[2]);
    canopy3.position.set(-0.55, trunkH + 0.9, -0.3);
    canopy3.castShadow = true;
    tree.add(canopy3);
    tree.scale.setScalar(scale);
    return tree;
  }

  private buildFlora() {
    // ---- Choppable park trees: plenty of them, spread around the lawn ----
    const treePositions: [number, number, number][] = [
      [-10, 0, -8],
      [11, 0, -8],
      [-12, 0, 4],
      [12, 0, 7],
      [-8, 0, 10],
      [-4, 0, 9],
      [4, 0, -9.5],
      [-13, 0, -3],
      [13.5, 0, 0.5],
      [7.5, 0, 9.5],
      [-6.5, 0, -10.5],
      [0.5, 0, 10.5],
    ];

    this.treeGroups = [];
    this.treeData = [];
    treePositions.forEach(([x, y, z], i) => {
      const baseScale = 0.9 + ((i * 37) % 30) / 100;
      const tree = this.makeOneTree(baseScale, i % 3 === 0);
      tree.position.set(x, y, z);
      const id = `tree${i}`;
      tree.userData = { type: "tree", treeId: id };
      tree.traverse((c) => {
        c.userData = { type: "tree", treeId: id };
      });
      this.parkGroup.add(tree);
      this.treeGroups.push(tree);
      this.treeData.push({ id, alive: true, respawnAt: 0, baseScale });
      this.registerEditable(id, tree);
    });

    // ---- Distant forest border: little trees ringing the back + sides ----
    // They sit behind the fence and melt the blue sky into green forest.
    this.forestBorderGroup = new THREE.Group();
    const ringCount = 26;
    for (let i = 0; i < ringCount; i++) {
      const a = (i / ringCount) * Math.PI * 2;
      // Keep the front (south, +z toward camera start) lower so the park stays open,
      // pack the back (north, -z) dense like a real forest wall.
      const isBack = Math.sin(a) < -0.15;
      const radius = isBack ? 17 + ((i * 53) % 5) : 20 + ((i * 29) % 6);
      const x = Math.cos(a) * radius;
      const z = Math.sin(a) * radius;
      if (z > 13 && Math.abs(x) < 9) continue; // leave the entrance path open
      const little = this.makeOneTree(0.75 + ((i * 41) % 40) / 100, i % 2 === 0);
      little.position.set(x, 0, z);
      // Slight color variance for a natural forest wall
      little.rotation.y = (i * 1.7) % (Math.PI * 2);
      this.forestBorderGroup.add(little);
    }
    // A couple of extra back-row giants for depth
    [[-14, -16], [0, -18], [14, -16]].forEach(([x, z], k) => {
      const giant = this.makeOneTree(1.5 + k * 0.12, true);
      giant.position.set(x, 0, z);
      this.forestBorderGroup.add(giant);
    });
    // Parented to the park so the forest wall hides when you go indoors
    this.parkGroup.add(this.forestBorderGroup);

    // Flowering bushes
    const bushMat = new THREE.MeshStandardMaterial({ color: 0x4caf50 });
    const flowerMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e });

    const bushPositions = [
      [-3, 0, -10],
      [3, 0, -10],
      [-7, 0, -2],
      [6, 0, -4],
    ];

    bushPositions.forEach(([bx, by, bz]) => {
      const bush = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 8), bushMat);
      bush.scale.set(1.4, 0.9, 1.2);
      bush.position.set(bx, 0.5, bz);
      bush.castShadow = true;
      this.scene.add(bush);

      // Small blossom
      const fl = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), flowerMat);
      fl.position.set(bx + 0.3, 0.8, bz + 0.2);
      this.scene.add(fl);
    });
  }

  private buildAgilityCourse() {
    // 1. Agility Jump Hurdle
    const hurdleGroup = new THREE.Group();
    hurdleGroup.position.set(0, 0, -7);

    const postMat = new THREE.MeshStandardMaterial({ color: 0x0284c7 });
    const barMat = new THREE.MeshStandardMaterial({ color: 0xfacc15 });

    const postLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 1.2, 8), postMat);
    postLeft.position.set(-1.4, 0.6, 0);
    postLeft.castShadow = true;
    hurdleGroup.add(postLeft);

    const postRight = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 1.2, 8), postMat);
    postRight.position.set(1.4, 0.6, 0);
    postRight.castShadow = true;
    hurdleGroup.add(postRight);

    // Crossbar
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.8, 8), barMat);
    bar.rotateZ(Math.PI / 2);
    bar.position.set(0, 0.65, 0);
    bar.castShadow = true;
    hurdleGroup.add(bar);

    this.obstaclesGroup.add(hurdleGroup);

    // 2. Weave Poles (striped slalom poles)
    const weaveGroup = new THREE.Group();
    weaveGroup.position.set(5.5, 0, 2);

    for (let p = 0; p < 5; p++) {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 1.5, 8),
        new THREE.MeshStandardMaterial({ color: p % 2 === 0 ? 0xe11d48 : 0xffffff })
      );
      pole.position.set(0, 0.75, (p - 2) * 1.3);
      pole.castShadow = true;
      weaveGroup.add(pole);
    }
    this.obstaclesGroup.add(weaveGroup);
  }

  private setupTennisBall() {
    const ballGeom = new THREE.SphereGeometry(0.18, 16, 16);
    const ballMat = new THREE.MeshStandardMaterial({
      color: 0xccff00, // Tennis neon yellow
      roughness: 0.9,
    });
    this.ballMesh = new THREE.Mesh(ballGeom, ballMat);
    this.ballMesh.castShadow = true;
    this.ballMesh.position.copy(this.ballState.position);
    this.scene.add(this.ballMesh);

    // Treat mesh (hidden until fed)
    const treatGeom = new THREE.BoxGeometry(0.3, 0.15, 0.4);
    const treatMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.7 });
    this.treatMesh = new THREE.Mesh(treatGeom, treatMat);
    this.treatMesh.castShadow = true;
    this.treatMesh.visible = false;
    this.scene.add(this.treatMesh);
  }

  private setupHouseRoom() {
    this.houseGroup.clear();

    // 1. Hardwood Flooring
    const floorGeom = new THREE.PlaneGeometry(8.4, 8.4);
    floorGeom.rotateX(-Math.PI / 2);
    const floorCanvas = document.createElement("canvas");
    floorCanvas.width = 512;
    floorCanvas.height = 512;
    const fCtx = floorCanvas.getContext("2d")!;
    fCtx.fillStyle = "#854d0e";
    fCtx.fillRect(0, 0, 512, 512);
    fCtx.strokeStyle = "#5a3206";
    fCtx.lineWidth = 4;
    for (let y = 0; y < 512; y += 64) {
      fCtx.strokeRect(0, y, 512, 64);
      for (let x = (y % 128 === 0 ? 0 : 64); x < 512; x += 128) {
        fCtx.strokeRect(x, y, 128, 64);
      }
    }
    const floorTex = new THREE.CanvasTexture(floorCanvas);
    floorTex.wrapS = THREE.RepeatWrapping;
    floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(2, 2);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.6,
      metalness: 0.05,
    });
    this.roomFloorMesh = new THREE.Mesh(floorGeom, floorMat);
    this.roomFloorMesh.receiveShadow = true;
    this.roomFloorMesh.userData = { type: "floor" };
    this.houseGroup.add(this.roomFloorMesh);

    // 2. Cozy Braided Area Rug in center
    const rugGeom = new THREE.CylinderGeometry(2.4, 2.45, 0.02, 32);
    const rugMat = new THREE.MeshStandardMaterial({
      color: 0xfde68a,
      roughness: 0.95,
    });
    const rug = new THREE.Mesh(rugGeom, rugMat);
    rug.position.set(0, 0.01, 0.3);
    rug.receiveShadow = true;
    rug.userData = { type: "floor" };
    this.houseGroup.add(rug);

    const rugRimGeom = new THREE.TorusGeometry(2.4, 0.08, 8, 32);
    rugRimGeom.rotateX(Math.PI / 2);
    const rugRimMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.9 });
    const rugRim = new THREE.Mesh(rugRimGeom, rugRimMat);
    rugRim.position.set(0, 0.02, 0.3);
    this.houseGroup.add(rugRim);

    // 3. Walls (Back, Left, Right, Front with Doorway)
    const wallHeight = 3.6;
    const roomWidth = 8.4;
    const roomDepth = 8.4;

    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      roughness: 0.85,
    });
    const wainscotMat = new THREE.MeshStandardMaterial({
      color: 0x9a3412,
      roughness: 0.7,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x78350f,
      roughness: 0.5,
    });

    const createWall = (x: number, z: number, rotY: number, hasWindow: boolean = false) => {
      const wall = new THREE.Group();
      wall.position.set(x, 0, z);
      wall.rotation.y = rotY;

      // Upper wall
      const upperGeom = new THREE.BoxGeometry(roomWidth, wallHeight - 1.2, 0.15);
      const upper = new THREE.Mesh(upperGeom, wallMat);
      upper.position.set(0, 1.2 + (wallHeight - 1.2) / 2, 0);
      upper.receiveShadow = true;
      wall.add(upper);

      // Lower wainscoting
      const lowerGeom = new THREE.BoxGeometry(roomWidth, 1.2, 0.18);
      const lower = new THREE.Mesh(lowerGeom, wainscotMat);
      lower.position.set(0, 0.6, 0);
      lower.receiveShadow = true;
      wall.add(lower);

      // Baseboard trim
      const baseGeom = new THREE.BoxGeometry(roomWidth, 0.16, 0.22);
      const base = new THREE.Mesh(baseGeom, trimMat);
      base.position.set(0, 0.08, 0);
      wall.add(base);

      // Chair rail molding
      const railGeom = new THREE.BoxGeometry(roomWidth, 0.08, 0.22);
      const rail = new THREE.Mesh(railGeom, trimMat);
      rail.position.set(0, 1.2, 0);
      wall.add(rail);

      if (hasWindow) {
        const winFrame = new THREE.Mesh(
          new THREE.BoxGeometry(2.0, 1.6, 0.24),
          new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.5 })
        );
        winFrame.position.set(0, 2.2, 0);
        wall.add(winFrame);

        const winGlass = new THREE.Mesh(
          new THREE.PlaneGeometry(1.7, 1.3),
          new THREE.MeshBasicMaterial({ color: 0xbae6fd })
        );
        winGlass.position.set(0, 2.2, 0.13);
        wall.add(winGlass);

        const crossH = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.04, 0.04), trimMat);
        crossH.position.set(0, 2.2, 0.14);
        wall.add(crossH);
        const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.3, 0.04), trimMat);
        crossV.position.set(0, 2.2, 0.14);
        wall.add(crossV);
      }

      return wall;
    };

    // Back wall
    const backWall = createWall(0, -roomDepth / 2, 0);
    const portraitFrame = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 1.2, 0.06),
      new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.4, roughness: 0.3 })
    );
    portraitFrame.position.set(0, 2.3, -roomDepth / 2 + 0.12);
    this.houseGroup.add(portraitFrame);

    const portraitCanvas = document.createElement("canvas");
    portraitCanvas.width = 256;
    portraitCanvas.height = 256;
    const pCtx = portraitCanvas.getContext("2d")!;
    pCtx.fillStyle = "#fef08a";
    pCtx.fillRect(0, 0, 256, 256);
    pCtx.fillStyle = "#1e293b";
    pCtx.font = "bold 30px sans-serif";
    pCtx.textAlign = "center";
    pCtx.fillText("BEST DOGGY", 128, 60);
    pCtx.font = "72px sans-serif";
    pCtx.fillText("🐾", 128, 145);
    pCtx.font = "bold 24px sans-serif";
    pCtx.fillStyle = "#e11d48";
    pCtx.fillText("HOME SWEET HOME", 128, 205);
    const portraitPic = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 1.0),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(portraitCanvas) })
    );
    portraitPic.position.set(0, 2.3, -roomDepth / 2 + 0.16);
    this.houseGroup.add(portraitPic);
    this.houseGroup.add(backWall);

    // Left wall with Window
    const leftWall = createWall(-roomWidth / 2, 0, Math.PI / 2, true);
    this.houseGroup.add(leftWall);

    // Right wall with Trophy Shelf
    const rightWall = createWall(roomWidth / 2, 0, -Math.PI / 2);
    const shelf = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.08, 0.35),
      new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.5 })
    );
    shelf.position.set(roomWidth / 2 - 0.2, 2.0, 0);
    this.houseGroup.add(shelf);
    const trophyGeom = new THREE.CylinderGeometry(0.12, 0.06, 0.3, 12);
    const trophyMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.9, roughness: 0.1 });
    const trophy = new THREE.Mesh(trophyGeom, trophyMat);
    trophy.position.set(roomWidth / 2 - 0.2, 2.2, 0);
    this.houseGroup.add(trophy);
    this.houseGroup.add(rightWall);

    // Front Wall with Doorway
    const frontWall = new THREE.Group();
    frontWall.position.set(0, 0, roomDepth / 2);
    const frontLeft = new THREE.Mesh(
      new THREE.BoxGeometry(roomWidth / 2 - 1.1, wallHeight, 0.15),
      wallMat
    );
    frontLeft.position.set(-(roomWidth / 4 + 0.55), wallHeight / 2, 0);
    frontWall.add(frontLeft);

    const frontRight = new THREE.Mesh(
      new THREE.BoxGeometry(roomWidth / 2 - 1.1, wallHeight, 0.15),
      wallMat
    );
    frontRight.position.set(roomWidth / 4 + 0.55, wallHeight / 2, 0);
    frontWall.add(frontRight);

    const frontTop = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, wallHeight - 2.4, 0.15),
      wallMat
    );
    frontTop.position.set(0, 2.4 + (wallHeight - 2.4) / 2, 0);
    frontWall.add(frontTop);

    const doorTrim = new THREE.Mesh(
      new THREE.BoxGeometry(2.3, 0.12, 0.22),
      trimMat
    );
    doorTrim.position.set(0, 2.4, 0);
    frontWall.add(doorTrim);
    this.houseGroup.add(frontWall);

    // Welcome / Exit Door Mat (Click to Exit to Park)
    const doorMatGeom = new THREE.PlaneGeometry(1.8, 0.9);
    doorMatGeom.rotateX(-Math.PI / 2);
    const matCanvas = document.createElement("canvas");
    matCanvas.width = 256;
    matCanvas.height = 128;
    const mCtx = matCanvas.getContext("2d")!;
    mCtx.fillStyle = "#166534";
    mCtx.fillRect(0, 0, 256, 128);
    mCtx.strokeStyle = "#86efac";
    mCtx.lineWidth = 6;
    mCtx.strokeRect(4, 4, 248, 120);
    mCtx.fillStyle = "#ffffff";
    mCtx.font = "bold 24px sans-serif";
    mCtx.textAlign = "center";
    mCtx.fillText("🌲 GO OUTSIDE 🐾", 128, 70);
    this.houseDoorMesh = new THREE.Mesh(
      doorMatGeom,
      new THREE.MeshStandardMaterial({
        map: new THREE.CanvasTexture(matCanvas),
        roughness: 0.9,
      })
    );
    this.houseDoorMesh.position.set(0, 0.02, roomDepth / 2 - 0.75);
    this.houseDoorMesh.userData = { type: "exit_door" };
    this.houseGroup.add(this.houseDoorMesh);

    // Kitchen doorway mat (click to enter Kitchen room)
    const kitchenMatGeom = new THREE.PlaneGeometry(1.8, 0.9);
    kitchenMatGeom.rotateX(-Math.PI / 2);
    const kCanvas = document.createElement("canvas");
    kCanvas.width = 256;
    kCanvas.height = 128;
    const kCtx = kCanvas.getContext("2d")!;
    kCtx.fillStyle = "#b45309";
    kCtx.fillRect(0, 0, 256, 128);
    kCtx.strokeStyle = "#fde68a";
    kCtx.lineWidth = 6;
    kCtx.strokeRect(4, 4, 248, 120);
    kCtx.fillStyle = "#ffffff";
    kCtx.font = "bold 26px sans-serif";
    kCtx.textAlign = "center";
    kCtx.fillText("🚪 HALLWAY 🚪", 128, 72);
    this.hallwayDoorMesh = new THREE.Mesh(
      kitchenMatGeom,
      new THREE.MeshStandardMaterial({
        map: new THREE.CanvasTexture(kCanvas),
        roughness: 0.9,
      })
    );
    this.hallwayDoorMesh.position.set(2.6, 0.02, 1.2);
    this.hallwayDoorMesh.rotation.y = -0.35;
    this.hallwayDoorMesh.userData = { type: "hallway_door" };
    this.houseGroup.add(this.hallwayDoorMesh);

    // 4. Ceiling with Wooden Beams
    const ceilingGeom = new THREE.PlaneGeometry(roomWidth, roomDepth);
    ceilingGeom.rotateX(Math.PI / 2);
    const ceilingMat = new THREE.MeshStandardMaterial({
      color: 0x78350f,
      roughness: 0.8,
    });
    const ceiling = new THREE.Mesh(ceilingGeom, ceilingMat);
    ceiling.position.y = wallHeight;
    this.houseGroup.add(ceiling);

    for (let z = -roomDepth / 2 + 1.4; z <= roomDepth / 2 - 1.4; z += 1.8) {
      const beam = new THREE.Mesh(
        new THREE.BoxGeometry(roomWidth, 0.22, 0.28),
        trimMat
      );
      beam.position.set(0, wallHeight - 0.11, z);
      this.houseGroup.add(beam);
    }

    // 5. Ceiling Lamp
    this.setupCeilingLamp(wallHeight);

    // 6. House Toy (bone, duck, bear, ball)
    this.setupHouseToy();
  }

  private setupCeilingLamp(ceilingY: number) {
    this.ceilingLampGroup = new THREE.Group();
    this.ceilingLampGroup.position.set(0, ceilingY, 0);

    const rodGeom = new THREE.CylinderGeometry(0.02, 0.02, 0.9, 8);
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.8,
      roughness: 0.2,
    });
    const rod = new THREE.Mesh(rodGeom, brassMat);
    rod.position.y = -0.45;
    this.ceilingLampGroup.add(rod);

    const shadeGeom = new THREE.ConeGeometry(0.48, 0.32, 16, 1, true);
    const shadeMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      roughness: 0.3,
      side: THREE.DoubleSide,
    });
    const shade = new THREE.Mesh(shadeGeom, shadeMat);
    shade.position.y = -0.9;
    this.ceilingLampGroup.add(shade);

    const bulbGeom = new THREE.SphereGeometry(0.12, 16, 16);
    const bulbMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfffaed,
      emissiveIntensity: 1.0,
      roughness: 0.1,
    });
    this.lampBulbMesh = new THREE.Mesh(bulbGeom, bulbMat);
    this.lampBulbMesh.position.y = -0.98;
    this.ceilingLampGroup.add(this.lampBulbMesh);

    this.ceilingLampLight = new THREE.PointLight(0xfff1b8, 2.2, 12);
    this.ceilingLampLight.position.y = -1.05;
    this.ceilingLampLight.castShadow = true;
    this.ceilingLampLight.shadow.bias = -0.001;
    this.ceilingLampGroup.add(this.ceilingLampLight);

    const chainGeom = new THREE.CylinderGeometry(0.008, 0.008, 0.35, 6);
    const chain = new THREE.Mesh(chainGeom, brassMat);
    chain.position.set(0.16, -1.05, 0);
    this.ceilingLampGroup.add(chain);

    const knobGeom = new THREE.SphereGeometry(0.035, 8, 8);
    const knob = new THREE.Mesh(knobGeom, brassMat);
    knob.position.set(0.16, -1.24, 0);
    this.ceilingLampGroup.add(knob);

    this.ceilingLampGroup.userData = { type: "lamp" };
    this.ceilingLampGroup.traverse((child) => {
      child.userData = { type: "lamp" };
    });

    this.houseGroup.add(this.ceilingLampGroup);
  }

  private setupDogBed() {
    this.bedGroup = new THREE.Group();
    this.bedGroup.position.set(-3.8, 0, -1.2);
    this.bedGroup.rotation.y = 0.25;

    // 1. Bed Frame / Outer Rim
    const frameGeom = new THREE.TorusGeometry(1.05, 0.24, 12, 32);
    frameGeom.scale(1.15, 0.65, 0.95);
    frameGeom.rotateX(Math.PI / 2);
    const frameMat = new THREE.MeshStandardMaterial({
      color: this.bedColors.frame,
      roughness: 0.75,
      metalness: 0.05,
    });
    this.bedFrameMesh = new THREE.Mesh(frameGeom, frameMat);
    this.bedFrameMesh.position.y = 0.16;
    this.bedFrameMesh.castShadow = true;
    this.bedFrameMesh.receiveShadow = true;
    this.bedFrameMesh.userData = { type: "bed", part: "frame" };
    this.bedGroup.add(this.bedFrameMesh);

    // 2. Bed Cushion (Mattress / Pillow)
    const cushionGeom = new THREE.CylinderGeometry(0.95, 1.0, 0.2, 32);
    cushionGeom.scale(1.12, 1.0, 0.92);
    const cushionMat = new THREE.MeshStandardMaterial({
      color: this.bedColors.cushion,
      roughness: 0.9,
      metalness: 0.0,
    });
    this.bedCushionMesh = new THREE.Mesh(cushionGeom, cushionMat);
    this.bedCushionMesh.position.y = 0.1;
    this.bedCushionMesh.receiveShadow = true;
    this.bedCushionMesh.userData = { type: "bed", part: "cushion" };
    this.bedGroup.add(this.bedCushionMesh);

    // 3. Bed Blanket (Folded Fleece Throw)
    const blanketGeom = new THREE.BoxGeometry(0.75, 0.1, 0.65);
    const blanketMat = new THREE.MeshStandardMaterial({
      color: this.bedColors.blanket,
      roughness: 0.95,
      metalness: 0.0,
    });
    this.bedBlanketMesh = new THREE.Mesh(blanketGeom, blanketMat);
    this.bedBlanketMesh.position.set(0.65, 0.18, -0.28);
    this.bedBlanketMesh.rotation.y = 0.35;
    this.bedBlanketMesh.castShadow = true;
    this.bedBlanketMesh.userData = { type: "bed", part: "blanket" };
    this.bedGroup.add(this.bedBlanketMesh);

    // Little Bone Cushion Pillow at head of bed
    const pillowGeom = new THREE.SphereGeometry(0.18, 12, 12);
    pillowGeom.scale(1.5, 0.5, 0.7);
    const pillowMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
    });
    const pillow = new THREE.Mesh(pillowGeom, pillowMat);
    pillow.position.set(-0.55, 0.18, -0.45);
    pillow.rotation.y = 0.4;
    this.bedGroup.add(pillow);

    this.bedGroup.userData = { type: "bed" };
    this.upstairsGroup.add(this.bedGroup);
  }

  private setupHouseToy() {
    this.houseToyGroup = new THREE.Group();
    this.houseToyGroup.position.set(1.4, 0.12, 0.4);
    this.houseToyGroup.userData = { type: "toy" };
    this.rebuildToyMesh();
    this.houseGroup.add(this.houseToyGroup);
  }

  private rebuildToyMesh() {
    while (this.houseToyGroup.children.length > 0) {
      this.houseToyGroup.remove(this.houseToyGroup.children[0]);
    }

    if (this.currentToy === "bone") {
      const boneMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.4 });
      const shaftGeom = new THREE.CylinderGeometry(0.06, 0.06, 0.45, 12);
      shaftGeom.rotateZ(Math.PI / 2);
      const shaft = new THREE.Mesh(shaftGeom, boneMat);
      this.houseToyGroup.add(shaft);

      const knobGeom = new THREE.SphereGeometry(0.08, 10, 10);
      [-0.24, 0.24].forEach((x) => {
        [-0.05, 0.05].forEach((z) => {
          const knob = new THREE.Mesh(knobGeom, boneMat);
          knob.position.set(x, 0, z);
          this.houseToyGroup.add(knob);
        });
      });
    } else if (this.currentToy === "duck") {
      const yellowMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3 });
      const orangeMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.5 });
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), yellowMat);
      body.scale.set(1.2, 0.9, 1.0);
      this.houseToyGroup.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), yellowMat);
      head.position.set(0.12, 0.14, 0);
      this.houseToyGroup.add(head);
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.09, 8), orangeMat);
      beak.rotateZ(-Math.PI / 2);
      beak.position.set(0.24, 0.12, 0);
      this.houseToyGroup.add(beak);
    } else if (this.currentToy === "bear") {
      const bearMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), bearMat);
      this.houseToyGroup.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), bearMat);
      head.position.set(0, 0.18, 0);
      this.houseToyGroup.add(head);
      [-0.1, 0.1].forEach((x) => {
        const ear = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), bearMat);
        ear.position.set(x, 0.28, 0);
        this.houseToyGroup.add(ear);
      });
    } else {
      const ballMat = new THREE.MeshStandardMaterial({ color: 0xccff00, roughness: 0.8 });
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 16), ballMat);
      this.houseToyGroup.add(ball);
    }

    this.houseToyGroup.traverse((c) => {
      c.castShadow = true;
      c.userData = { type: "toy" };
    });
  }

  private setupKitchenRoom() {
    this.kitchenGroup.clear();
    const roomWidth = 8.4;
    const roomDepth = 8.4;
    const wallHeight = 3.6;

    // 1. Classic checkerboard tile floor (ivory + charcoal) — big bold squares
    this.kitchenCountersGroup = new THREE.Group();
    this.kitchenFridgeGroup = new THREE.Group();
    this.kitchenShelfGroup = new THREE.Group();
    const floorGeom = new THREE.PlaneGeometry(roomWidth, roomDepth);
    floorGeom.rotateX(-Math.PI / 2);
    const tileCanvas = document.createElement("canvas");
    tileCanvas.width = 256;
    tileCanvas.height = 256;
    const tCtx = tileCanvas.getContext("2d")!;
    const tileSize = 128;
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 2; x++) {
        tCtx.fillStyle = (x + y) % 2 === 0 ? "#faf6ee" : "#22303c";
        tCtx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
        tCtx.strokeStyle = "#c9b896";
        tCtx.lineWidth = 4;
        tCtx.strokeRect(x * tileSize + 2, y * tileSize + 2, tileSize - 4, tileSize - 4);
        // subtle tile sheen
        tCtx.fillStyle = "rgba(255,255,255,0.06)";
        tCtx.fillRect(x * tileSize + 8, y * tileSize + 8, tileSize - 16, 24);
      }
    }
    const tileTex = new THREE.CanvasTexture(tileCanvas);
    tileTex.wrapS = THREE.RepeatWrapping;
    tileTex.wrapT = THREE.RepeatWrapping;
    tileTex.repeat.set(4, 4);
    this.kitchenFloorMesh = new THREE.Mesh(
      floorGeom,
      new THREE.MeshStandardMaterial({ map: tileTex, roughness: 0.5 })
    );
    this.kitchenFloorMesh.receiveShadow = true;
    this.kitchenFloorMesh.userData = { type: "kitchen_floor" };
    this.kitchenGroup.add(this.kitchenFloorMesh);

    // 2. Walls (warm kitchen yellow + white tile backsplash look)
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xffedd5, roughness: 0.85 });
    const backsplashMat = new THREE.MeshStandardMaterial({ color: 0xfdba74, roughness: 0.6 });
    const mkWall = (x: number, z: number, rotY: number) => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.rotation.y = rotY;
      const upper = new THREE.Mesh(new THREE.BoxGeometry(roomWidth, wallHeight - 1.2, 0.15), wallMat);
      upper.position.set(0, 1.2 + (wallHeight - 1.2) / 2, 0);
      upper.receiveShadow = true;
      g.add(upper);
      const lower = new THREE.Mesh(new THREE.BoxGeometry(roomWidth, 1.2, 0.18), backsplashMat);
      lower.position.set(0, 0.6, 0);
      g.add(lower);
      return g;
    };
    this.kitchenGroup.add(mkWall(0, -roomDepth / 2, 0));
    this.kitchenGroup.add(mkWall(-roomWidth / 2, 0, Math.PI / 2));
    this.kitchenGroup.add(mkWall(roomWidth / 2, 0, -Math.PI / 2));
    // Front wall with opening (same as living room)
    const frontWall = new THREE.Group();
    frontWall.position.set(0, 0, roomDepth / 2);
    const fl = new THREE.Mesh(new THREE.BoxGeometry(roomWidth / 2 - 1.1, wallHeight, 0.15), wallMat);
    fl.position.set(-(roomWidth / 4 + 0.55), wallHeight / 2, 0);
    frontWall.add(fl);
    const fr = new THREE.Mesh(new THREE.BoxGeometry(roomWidth / 2 - 1.1, wallHeight, 0.15), wallMat);
    fr.position.set(roomWidth / 4 + 0.55, wallHeight / 2, 0);
    frontWall.add(fr);
    const ft = new THREE.Mesh(new THREE.BoxGeometry(2.2, wallHeight - 2.4, 0.15), wallMat);
    ft.position.set(0, 2.4 + (wallHeight - 2.4) / 2, 0);
    frontWall.add(ft);
    this.kitchenGroup.add(frontWall);

    // Ceiling
    const ceilGeom = new THREE.PlaneGeometry(roomWidth, roomDepth);
    ceilGeom.rotateX(Math.PI / 2);
    const ceil = new THREE.Mesh(
      ceilGeom,
      new THREE.MeshStandardMaterial({ color: 0xfff7ed, roughness: 0.9 })
    );
    ceil.position.y = wallHeight;
    this.kitchenGroup.add(ceil);
    const ceilLight = new THREE.PointLight(0xfff7ed, 1.6, 14);
    ceilLight.position.set(0, wallHeight - 0.4, 0);
    this.kitchenGroup.add(ceilLight);

    // 3. Counters around back + sides (L-shape kitchen) — grouped for edit mode
    const counterMat = new THREE.MeshStandardMaterial({ color: 0x7c4a12, roughness: 0.55 });
    const counterTopMat = new THREE.MeshStandardMaterial({ color: 0xfdf6e3, roughness: 0.25 });
    const cabinetMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.6 });
    const mkCounter = (x: number, z: number, w: number, d: number) => {
      const base = new THREE.Mesh(new THREE.BoxGeometry(w, 0.9, d), counterMat);
      base.position.set(x, 0.45, z);
      base.castShadow = true;
      base.receiveShadow = true;
      this.kitchenCountersGroup.add(base);
      const top = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.08, d + 0.1), counterTopMat);
      top.position.set(x, 0.94, z);
      top.castShadow = true;
      this.kitchenCountersGroup.add(top);
      // cabinet doors + knobs so it reads as a real kitchen
      const doors = Math.max(1, Math.round(w / 1.1));
      for (let di = 0; di < doors; di++) {
        const dx = x - w / 2 + (di + 0.5) * (w / doors);
        const door = new THREE.Mesh(new THREE.BoxGeometry(w / doors - 0.12, 0.62, 0.04), cabinetMat);
        door.position.set(dx, 0.45, z + d / 2 + 0.01);
        if (Math.abs(w) < Math.abs(d)) {
          door.position.set(x + w / 2 + 0.01, 0.45, dx - x + z);
          door.rotation.y = Math.PI / 2;
        }
        this.kitchenCountersGroup.add(door);
        const knob = new THREE.Mesh(
          new THREE.SphereGeometry(0.035, 8, 8),
          new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.8, roughness: 0.3 })
        );
        knob.position.copy(door.position);
        knob.position.z += 0.05;
        if (Math.abs(w) < Math.abs(d)) {
          knob.position.copy(door.position);
          knob.position.x += 0.05;
        }
        this.kitchenCountersGroup.add(knob);
      }
    };
    mkCounter(-1.6, -3.55, 4.6, 1.0);
    mkCounter(-3.55, -1.2, 1.0, 4.4);
    mkCounter(3.55, -1.2, 1.0, 4.4);

    // Kitchen sink with faucet on the back counter
    const sinkBasin = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.18, 0.6),
      new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.7, roughness: 0.3 })
    );
    sinkBasin.position.set(-1.6, 1.0, -3.55);
    this.kitchenCountersGroup.add(sinkBasin);
    const faucetStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.5, 8),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.25 })
    );
    faucetStem.position.set(-1.6, 1.25, -3.8);
    this.kitchenCountersGroup.add(faucetStem);
    const faucetSpout = new THREE.Mesh(
      new THREE.TorusGeometry(0.14, 0.035, 8, 12, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.25 })
    );
    faucetSpout.position.set(-1.6, 1.45, -3.66);
    faucetSpout.rotation.y = Math.PI / 2;
    this.kitchenCountersGroup.add(faucetSpout);

    // Upper shelves + jars + hanging pans for coziness
    const shelfMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.6 });
    [-2.2, -1.2, -0.2].forEach((sx) => {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.07, 0.35), shelfMat);
      shelf.position.set(sx, 2.3, -4.0);
      this.kitchenShelfGroup.add(shelf);
      const jarColors = [0xfacc15, 0x86efac, 0xfda4af];
      const jar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.11, 0.28, 10),
        new THREE.MeshStandardMaterial({ color: jarColors[Math.abs(Math.floor(sx * 10)) % 3], roughness: 0.4 })
      );
      jar.position.set(sx, 2.48, -4.0);
      jar.castShadow = true;
      this.kitchenShelfGroup.add(jar);
    });
    // Hanging rail with pots + utensils on the right wall
    const railBar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 2.0, 8),
      new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.3 })
    );
    railBar.rotation.z = Math.PI / 2;
    railBar.position.set(2.2, 2.4, -3.9);
    this.kitchenShelfGroup.add(railBar);
    [1.5, 2.2, 2.9].forEach((hx, hi) => {
      const pan = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16 - hi * 0.02, 0.16 - hi * 0.02, 0.1, 12),
        new THREE.MeshStandardMaterial({ color: hi === 1 ? 0xb45309 : 0x334155, metalness: 0.6, roughness: 0.4 })
      );
      pan.position.set(hx, 2.1, -3.9);
      pan.castShadow = true;
      this.kitchenShelfGroup.add(pan);
    });
    // Sunny kitchen window above the sink
    const winFrame = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 1.2, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.5 })
    );
    winFrame.position.set(-1.6, 2.5, -4.12);
    this.kitchenGroup.add(winFrame);
    const winGlass = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 0.95),
      new THREE.MeshBasicMaterial({ color: 0xbfe6f5 })
    );
    winGlass.position.set(-1.6, 2.5, -4.05);
    this.kitchenGroup.add(winGlass);

    // Fridge (tall white box) in corner — grouped for edit mode
    const fridge = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 2.2, 1.0),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35, metalness: 0.15 })
    );
    fridge.position.set(0, 0, 0);
    fridge.castShadow = true;
    this.kitchenFridgeGroup.add(fridge);
    const fridgeHandle = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.7, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7, roughness: 0.3 })
    );
    fridgeHandle.position.set(-0.4, 0.2, 0.55);
    this.kitchenFridgeGroup.add(fridgeHandle);
    // Fridge magnets (little paw + heart)
    const magnetA = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.5 })
    );
    magnetA.position.set(0.15, 0.5, 0.52);
    this.kitchenFridgeGroup.add(magnetA);
    const magnetB = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.12, 0.03),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5 })
    );
    magnetB.position.set(-0.15, 0.7, 0.52);
    this.kitchenFridgeGroup.add(magnetB);
    this.kitchenFridgeGroup.position.set(3.4, 1.1, -3.3);
    this.kitchenGroup.add(this.kitchenCountersGroup);
    this.kitchenGroup.add(this.kitchenShelfGroup);
    this.kitchenGroup.add(this.kitchenFridgeGroup);

    // 4. CENTRAL STOVE + COOKING POT (middle of room, clickable!)
    const stoveBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.85, 0.95, 0.5, 20),
      new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.5, metalness: 0.3 })
    );
    stoveBase.position.set(0, 0.25, 0.4);
    stoveBase.castShadow = true;
    stoveBase.receiveShadow = true;
    stoveBase.userData = { type: "pot" };
    this.kitchenGroup.add(stoveBase);

    // Fire glow ring under pot
    const fireRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.5, 0.07, 8, 24),
      new THREE.MeshStandardMaterial({
        color: 0xf97316,
        emissive: 0xea580c,
        emissiveIntensity: 1.2,
        roughness: 0.4,
      })
    );
    fireRing.rotation.x = Math.PI / 2;
    fireRing.position.set(0, 0.52, 0.4);
    fireRing.userData = { type: "pot" };
    this.kitchenGroup.add(fireRing);

    this.potGroup = new THREE.Group();
    this.potGroup.position.set(0, 0.62, 0.4);
    this.potGroup.userData = { type: "pot" };

    const potBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.5, 0.5, 20),
      new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.75, roughness: 0.3 })
    );
    potBody.position.y = 0.25;
    potBody.castShadow = true;
    potBody.userData = { type: "pot" };
    this.potGroup.add(potBody);

    const potRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.62, 0.05, 8, 24),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.25 })
    );
    potRim.rotation.x = Math.PI / 2;
    potRim.position.y = 0.5;
    potRim.userData = { type: "pot" };
    this.potGroup.add(potRim);

    // Soup surface (bubbling orange stew)
    const soup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.55, 0.06, 20),
      new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xb45309,
        emissiveIntensity: 0.35,
        roughness: 0.25,
      })
    );
    soup.position.y = 0.47;
    soup.userData = { type: "pot" };
    soup.name = "soupSurface";
    this.potGroup.add(soup);

    // Veggie chunks floating on soup
    const chunkMatA = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.7 });
    const chunkMatB = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.7 });
    for (let i = 0; i < 6; i++) {
      const chunk = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), i % 2 === 0 ? chunkMatA : chunkMatB);
      const a = (i / 6) * Math.PI * 2;
      chunk.position.set(Math.cos(a) * 0.3, 0.51, Math.sin(a) * 0.3);
      chunk.userData = { type: "pot" };
      this.potGroup.add(chunk);
    }

    // Side handles
    [-0.68, 0.68].forEach((hx) => {
      const handle = new THREE.Mesh(
        new THREE.TorusGeometry(0.1, 0.03, 6, 12, Math.PI),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6 })
      );
      handle.position.set(hx, 0.35, 0);
      handle.rotation.z = hx > 0 ? -Math.PI / 2 : Math.PI / 2;
      handle.userData = { type: "pot" };
      this.potGroup.add(handle);
    });

    this.potGroup.traverse((c) => {
      c.userData = { type: "pot" };
    });
    this.kitchenGroup.add(this.potGroup);

    // Steam puffs above pot (animated in render loop)
    this.potSteamGroup = new THREE.Group();
    this.potSteamGroup.position.set(0, 1.3, 0.4);
    for (let i = 0; i < 4; i++) {
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(0.12 - i * 0.015, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 - i * 0.1 })
      );
      puff.position.set((Math.random() - 0.5) * 0.3, i * 0.28, (Math.random() - 0.5) * 0.3);
      puff.userData = { steamIndex: i };
      this.potSteamGroup.add(puff);
    }
    this.kitchenGroup.add(this.potSteamGroup);

    // Big floating "COOK!" label sprite above pot (canvas texture)
    const labelCanvas = document.createElement("canvas");
    labelCanvas.width = 256;
    labelCanvas.height = 96;
    const lCtx = labelCanvas.getContext("2d")!;
    lCtx.fillStyle = "rgba(180, 83, 9, 0.92)";
    lCtx.beginPath();
    lCtx.roundRect(8, 8, 240, 80, 24);
    lCtx.fill();
    lCtx.fillStyle = "#fff";
    lCtx.font = "bold 40px sans-serif";
    lCtx.textAlign = "center";
    lCtx.fillText("🍲 COOK!", 128, 62);
    const labelTex = new THREE.CanvasTexture(labelCanvas);
    const label = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: labelTex, transparent: true, depthTest: false })
    );
    label.scale.set(1.6, 0.6, 1);
    label.position.set(0, 2.35, 0.4);
    label.userData = { type: "pot" };
    this.kitchenGroup.add(label);

    // 5. Back-to-Living door mat (click to return to living room)
    const liveMatGeom = new THREE.PlaneGeometry(1.8, 0.9);
    liveMatGeom.rotateX(-Math.PI / 2);
    const lvCanvas = document.createElement("canvas");
    lvCanvas.width = 256;
    lvCanvas.height = 128;
    const lvCtx = lvCanvas.getContext("2d")!;
    lvCtx.fillStyle = "#386641";
    lvCtx.fillRect(0, 0, 256, 128);
    lvCtx.strokeStyle = "#A7C957";
    lvCtx.lineWidth = 6;
    lvCtx.strokeRect(4, 4, 248, 120);
    lvCtx.fillStyle = "#fff";
    lvCtx.font = "bold 24px sans-serif";
    lvCtx.textAlign = "center";
    lvCtx.fillText("🚪 HALLWAY", 128, 70);
    this.kitchenHallDoorMesh = new THREE.Mesh(
      liveMatGeom,
      new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(lvCanvas), roughness: 0.9 })
    );
    this.kitchenHallDoorMesh.position.set(0, 0.02, roomDepth / 2 - 0.75);
    this.kitchenHallDoorMesh.userData = { type: "hallway_door" };
    this.kitchenGroup.add(this.kitchenHallDoorMesh);
  }

  private makeWoodFloorTexture(repeatX: number, repeatY: number): THREE.CanvasTexture {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#854d0e";
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = "#5a3206";
    ctx.lineWidth = 4;
    for (let y = 0; y < 512; y += 64) {
      ctx.strokeRect(0, y, 512, 64);
      for (let x = y % 128 === 0 ? 0 : 64; x < 512; x += 128) {
        ctx.strokeRect(x, y, 128, 64);
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    return tex;
  }

  private makeDoorMatTexture(text: string, bg: string, border: string): THREE.CanvasTexture {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 128;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 256, 128);
    ctx.strokeStyle = border;
    ctx.lineWidth = 6;
    ctx.strokeRect(4, 4, 248, 120);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 25px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(text, 128, 72);
    return new THREE.CanvasTexture(c);
  }

  private makeDoorMat(
    text: string,
    bg: string,
    border: string,
    type: string,
    x: number,
    z: number,
    rotY: number = 0
  ): THREE.Mesh {
    const geom = new THREE.PlaneGeometry(1.8, 0.9);
    geom.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(
      geom,
      new THREE.MeshStandardMaterial({
        map: this.makeDoorMatTexture(text, bg, border),
        roughness: 0.9,
      })
    );
    mesh.position.set(x, 0.02, z);
    mesh.rotation.y = rotY;
    mesh.userData = { type };
    return mesh;
  }

  private setupHallway() {
    this.hallwayGroup.clear();
    const roomW = 5;
    const roomD = 9;
    const wallH = 3.4;

    // Wood flooring hallway runner
    const floorGeom = new THREE.PlaneGeometry(roomW, roomD);
    floorGeom.rotateX(-Math.PI / 2);
    this.hallwayFloorMesh = new THREE.Mesh(
      floorGeom,
      new THREE.MeshStandardMaterial({ map: this.makeWoodFloorTexture(1.5, 2.5), roughness: 0.6 })
    );
    this.hallwayFloorMesh.receiveShadow = true;
    this.hallwayFloorMesh.userData = { type: "floor" };
    this.hallwayGroup.add(this.hallwayFloorMesh);

    // Cozy runner rug down the middle
    const runner = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.03, 7.2),
      new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.95 })
    );
    runner.position.set(-0.6, 0.015, 0);
    runner.receiveShadow = true;
    runner.userData = { type: "floor" };
    this.hallwayGroup.add(runner);

    const wallMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.85 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.6 });
    const mkWall = (w: number, x: number, z: number, rotY: number) => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, 0.15), wallMat);
      wall.position.set(x, wallH / 2, z);
      wall.rotation.y = rotY;
      wall.receiveShadow = true;
      this.hallwayGroup.add(wall);
      const base = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, 0.2), trimMat);
      base.position.set(x, 0.08, z);
      base.rotation.y = rotY;
      this.hallwayGroup.add(base);
    };
    mkWall(roomW, 0, -roomD / 2, 0);
    mkWall(roomW, 0, roomD / 2, 0);
    mkWall(roomD, -roomW / 2, 0, Math.PI / 2);
    mkWall(roomD, roomW / 2, 0, Math.PI / 2);

    // Ceiling + warm light
    const ceil = new THREE.Mesh(
      new THREE.PlaneGeometry(roomW, roomD),
      new THREE.MeshStandardMaterial({ color: 0xfff7ed, roughness: 0.9 })
    );
    ceil.geometry.rotateX(Math.PI / 2);
    ceil.position.y = wallH;
    this.hallwayGroup.add(ceil);
    const lamp = new THREE.PointLight(0xffe9b8, 1.8, 12);
    lamp.position.set(0, wallH - 0.5, 0);
    this.hallwayGroup.add(lamp);

    // Framed paw pictures along the left wall
    [-2, 0, 2].forEach((z, i) => {
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.7, 0.9),
        new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.5 })
      );
      frame.position.set(-roomW / 2 + 0.1, 1.9, z);
      this.hallwayGroup.add(frame);
      const pic = new THREE.Mesh(
        new THREE.PlaneGeometry(0.7, 0.5),
        new THREE.MeshBasicMaterial({ color: [0xfbcfe8, 0xbfdbfe, 0xfde68a][i % 3] })
      );
      pic.position.set(-roomW / 2 + 0.15, 1.9, z);
      pic.rotation.y = Math.PI / 2;
      this.hallwayGroup.add(pic);
    });

    // Staircase along the right wall (8 steps climbing toward -z)
    this.stairsGroup = new THREE.Group();
    const stepMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.6 });
    const stepTopMat = new THREE.MeshStandardMaterial({ color: 0xd6a35c, roughness: 0.55 });
    for (let i = 0; i < 8; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.35, 0.58), stepMat);
      step.position.set(1.55, 0.175 + i * 0.35, 3.0 - i * 0.55);
      step.castShadow = true;
      step.receiveShadow = true;
      this.stairsGroup.add(step);
      const tread = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.05, 0.6), stepTopMat);
      tread.position.set(1.55, 0.35 + i * 0.35, 3.0 - i * 0.55);
      tread.receiveShadow = true;
      this.stairsGroup.add(tread);
    }
    // Wooden handrail
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 4.6), stepMat);
    rail.position.set(0.78, 1.9, 1.0);
    rail.rotation.x = -0.55;
    this.stairsGroup.add(rail);
    for (let i = 0; i < 4; i++) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.1, 0.07), stepMat);
      post.position.set(0.78, 0.9 + i * 0.55, 2.6 - i * 1.05);
      this.stairsGroup.add(post);
    }
    // Dark opening at the top of the stairs (mystery above!)
    const darkOpening = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 1.4),
      new THREE.MeshBasicMaterial({ color: 0x000000 })
    );
    darkOpening.position.set(1.55, 3.3, -1.75);
    this.stairsGroup.add(darkOpening);
    this.stairsGroup.userData = { type: "stairs" };
    this.stairsGroup.traverse((c) => {
      c.userData = { type: "stairs" };
    });
    this.hallwayGroup.add(this.stairsGroup);

    // "UPSTAIRS" mat at the stair base (click to climb!)
    this.stairsMatMesh = this.makeDoorMat("⬆ UPSTAIRS 🐾", "#6d28d9", "#ddd6fe", "stairs", 0, 3.4);
    this.stairsMatMesh.userData = { type: "stairs" };
    this.hallwayGroup.add(this.stairsMatMesh);

    // Door mats to living room + kitchen
    this.hallwayLivingMesh = this.makeDoorMat("🛋️ LIVING", "#386641", "#A7C957", "living_door", -1.3, 3.5);
    this.hallwayGroup.add(this.hallwayLivingMesh);
    this.hallwayKitchenMesh = this.makeDoorMat("🍳 KITCHEN", "#b45309", "#fde68a", "kitchen_door", -1.3, -3.5);
    this.hallwayGroup.add(this.hallwayKitchenMesh);
  }

  private setupUpstairs() {
    this.upstairsGroup.clear();
    // Bedroom is WIDER than deep
    const roomW = 12;
    const roomD = 7;
    const wallH = 3.4;

    const floorGeom = new THREE.PlaneGeometry(roomW, roomD);
    floorGeom.rotateX(-Math.PI / 2);
    this.upstairsFloorMesh = new THREE.Mesh(
      floorGeom,
      new THREE.MeshStandardMaterial({ map: this.makeWoodFloorTexture(3, 2), roughness: 0.6 })
    );
    this.upstairsFloorMesh.receiveShadow = true;
    this.upstairsFloorMesh.userData = { type: "floor" };
    this.upstairsGroup.add(this.upstairsFloorMesh);

    // Big round rug in the middle
    const rug = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.25, 0.03, 32),
      new THREE.MeshStandardMaterial({ color: 0xc4b5fd, roughness: 0.95 })
    );
    rug.position.set(0.5, 0.015, 0.3);
    rug.receiveShadow = true;
    rug.userData = { type: "floor" };
    this.upstairsGroup.add(rug);

    const wallMat = new THREE.MeshStandardMaterial({ color: 0xe0e7ff, roughness: 0.85 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x4c1d95, roughness: 0.6 });
    const mkWall = (w: number, x: number, z: number, rotY: number, withWindow: boolean = false) => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, 0.15), wallMat);
      wall.position.set(x, wallH / 2, z);
      wall.rotation.y = rotY;
      wall.receiveShadow = true;
      this.upstairsGroup.add(wall);
      if (withWindow) {
        const frame = new THREE.Mesh(
          new THREE.BoxGeometry(2.2, 1.7, 0.2),
          new THREE.MeshStandardMaterial({ color: 0x4c1d95, roughness: 0.5 })
        );
        frame.position.set(x, 2.1, z);
        frame.rotation.y = rotY;
        this.upstairsGroup.add(frame);
        const glass = new THREE.Mesh(
          new THREE.PlaneGeometry(1.9, 1.4),
          new THREE.MeshBasicMaterial({ color: 0x0f172a })
        );
        // Starry night sky outside
        const starCanvas = document.createElement("canvas");
        starCanvas.width = 128;
        starCanvas.height = 96;
        const sCtx = starCanvas.getContext("2d")!;
        sCtx.fillStyle = "#0f172a";
        sCtx.fillRect(0, 0, 128, 96);
        sCtx.fillStyle = "#fef9c3";
        for (let i = 0; i < 28; i++) {
          sCtx.fillRect(Math.random() * 128, Math.random() * 96, 2, 2);
        }
        sCtx.fillStyle = "#fefce8";
        sCtx.beginPath();
        sCtx.arc(100, 22, 10, 0, Math.PI * 2);
        sCtx.fill();
        glass.material.map = new THREE.CanvasTexture(starCanvas);
        glass.material.needsUpdate = true;
        const off = new THREE.Vector3(0, 0, 0.12).applyEuler(new THREE.Euler(0, rotY, 0));
        glass.position.set(x + off.x, 2.1, z + off.z);
        glass.rotation.y = rotY;
        this.upstairsGroup.add(glass);
      }
    };
    mkWall(roomW, 0, -roomD / 2, 0, true);
    mkWall(roomW, 0, roomD / 2, 0);
    mkWall(roomD, -roomW / 2, 0, Math.PI / 2);
    mkWall(roomD, roomW / 2, 0, Math.PI / 2);

    // Ceiling + moon-night lamp glow
    const ceil = new THREE.Mesh(
      new THREE.PlaneGeometry(roomW, roomD),
      new THREE.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.9 })
    );
    ceil.geometry.rotateX(Math.PI / 2);
    ceil.position.y = wallH;
    this.upstairsGroup.add(ceil);
    const moonLamp = new THREE.PointLight(0xc4b5fd, 1.6, 16);
    moonLamp.position.set(0, wallH - 0.5, 0);
    this.upstairsGroup.add(moonLamp);

    // The dog bed lives upstairs now
    this.setupDogBed();

    // Little dresser with drawers — grouped so edit mode can move it
    this.upstairsDresserGroup = new THREE.Group();
    this.upstairsDresserGroup.position.set(4.6, 0, -2.9);
    const dresserMat = new THREE.MeshStandardMaterial({ color: 0x7c3aed, roughness: 0.6 });
    const dresser = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 0.6), dresserMat);
    dresser.position.set(0, 0.5, 0);
    dresser.castShadow = true;
    this.upstairsDresserGroup.add(dresser);
    [-0.25, 0.25].forEach((dx) => {
      const drawer = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.32, 0.05),
        new THREE.MeshStandardMaterial({ color: 0xddd6fe, roughness: 0.5 })
      );
      drawer.position.set(dx, 0.62, 0.32);
      this.upstairsDresserGroup.add(drawer);
      const knob = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.8, roughness: 0.3 })
      );
      knob.position.set(dx, 0.62, 0.36);
      this.upstairsDresserGroup.add(knob);
    });
    this.upstairsGroup.add(this.upstairsDresserGroup);

    // Bookshelf with colorful books — grouped so edit mode can move it
    this.upstairsShelfGroup = new THREE.Group();
    this.upstairsShelfGroup.position.set(-5.2, 0, -3.1);
    const shelfMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.6 });
    const bookColors = [0xef4444, 0x3b82f6, 0x22c55e, 0xeab308, 0xa855f7, 0xec4899];
    for (let s = 0; s < 2; s++) {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.07, 0.4), shelfMat);
      shelf.position.set(0, 1.1 + s * 0.6, 0);
      this.upstairsShelfGroup.add(shelf);
      for (let b = 0; b < 6; b++) {
        const book = new THREE.Mesh(
          new THREE.BoxGeometry(0.16, 0.42, 0.28),
          new THREE.MeshStandardMaterial({ color: bookColors[(b + s * 2) % bookColors.length], roughness: 0.7 })
        );
        book.position.set(-0.7 + b * 0.28, 1.35 + s * 0.6, 0);
        book.rotation.z = b === 5 ? -0.18 : 0;
        this.upstairsShelfGroup.add(book);
      }
    }
    this.upstairsGroup.add(this.upstairsShelfGroup);

    // Descend mat back to the hallway stairs
    this.descendMesh = this.makeDoorMat("⬇ DOWNSTAIRS", "#6d28d9", "#ddd6fe", "stairs_down", 1.55, 2.4);
    this.upstairsGroup.add(this.descendMesh);
  }

  private setupToyCorner() {
    this.toyCornerGroup = new THREE.Group();
    this.toyCornerGroup.position.set(2.3, 0, -1.6);
    this.toyCornerGroup.userData = { type: "toy" };

    // Toy box (open crate)
    const boxMat = new THREE.MeshStandardMaterial({ color: 0x0d9488, roughness: 0.7 });
    const boxBottom = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.12, 0.75), boxMat);
    boxBottom.position.y = 0.06;
    boxBottom.castShadow = true;
    this.toyCornerGroup.add(boxBottom);
    const wallGeomX = new THREE.BoxGeometry(1.0, 0.45, 0.08);
    const wallGeomZ = new THREE.BoxGeometry(0.08, 0.45, 0.75);
    [[0, 0.28, 0.335, wallGeomX], [0, 0.28, -0.335, wallGeomX]].forEach(([x, y, z, g]) => {
      const wall = new THREE.Mesh(g as THREE.BufferGeometry, boxMat);
      wall.position.set(x as number, y as number, z as number);
      wall.castShadow = true;
      this.toyCornerGroup.add(wall);
    });
    [[-0.46, 0], [0.46, 0]].forEach(([x]) => {
      const wall = new THREE.Mesh(wallGeomZ, boxMat);
      wall.position.set(x as number, 0.28, 0);
      wall.castShadow = true;
      this.toyCornerGroup.add(wall);
    });

    // Ball peeking out of the box
    const cornerBall = new THREE.Mesh(
      new THREE.SphereGeometry(0.17, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.5 })
    );
    cornerBall.position.set(-0.2, 0.42, 0.05);
    cornerBall.castShadow = true;
    this.toyCornerGroup.add(cornerBall);

    // Rope bone leaning on the box
    const ropeMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.9 });
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8), ropeMat);
    rope.rotation.z = 1.1;
    rope.position.set(0.35, 0.4, -0.1);
    rope.castShadow = true;
    this.toyCornerGroup.add(rope);

    // Squeaky duck beside the box
    const duckMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 });
    const duckBody = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 12), duckMat);
    duckBody.scale.set(1.2, 0.85, 1.0);
    duckBody.position.set(0.75, 0.13, 0.35);
    duckBody.castShadow = true;
    this.toyCornerGroup.add(duckBody);
    const duckHead = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), duckMat);
    duckHead.position.set(0.88, 0.28, 0.35);
    this.toyCornerGroup.add(duckHead);

    this.toyCornerGroup.traverse((c) => {
      c.userData = { type: "toy" };
    });
    this.houseGroup.add(this.toyCornerGroup);
  }

  private setupWalkMarker() {
    this.walkTargetMarker = new THREE.Group();
    const ringGeom = new THREE.RingGeometry(0.22, 0.32, 24);
    ringGeom.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const ringMesh = new THREE.Mesh(ringGeom, ringMat);
    this.walkTargetMarker.add(ringMesh);

    const dotGeom = new THREE.CircleGeometry(0.08, 16);
    dotGeom.rotateX(-Math.PI / 2);
    const dotMat = new THREE.MeshBasicMaterial({
      color: 0x0284c7,
      side: THREE.DoubleSide,
    });
    const dotMesh = new THREE.Mesh(dotGeom, dotMat);
    dotMesh.position.y = 0.005;
    this.walkTargetMarker.add(dotMesh);

    this.walkTargetMarker.visible = false;
    this.scene.add(this.walkTargetMarker);
  }

  private toNDC(clientX: number, clientY: number): THREE.Vector2 {
    const rect = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
  }

  private setupInputEvents() {
    const dom = this.renderer.domElement;

    dom.addEventListener("pointerdown", (e) => {
      this.touchPoints.set(e.pointerId, { x: e.clientX, y: e.clientY });
      // Second finger down: switch to two-finger gestures, freeze the camera
      if (this.touchPoints.size === 2) {
        this.isDragging = false;
        this.clearLongPress();
        if (this.editMode) {
          if (this.editDrag && !this.editDrag.moved) {
            // Pinch on the grabbed object: pinch out lifts, pinch in lowers
            const pts = [...this.touchPoints.values()];
            this.pinchState = {
              startDist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
              baseY: this.editables.get(this.editDrag.id)?.position.y ?? 0,
              id: this.editDrag.id,
              moved: false,
            };
            this.editDrag = null;
          }
          this.secondFingerDownAt = performance.now();
        }
        return;
      }
      if (this.touchPoints.size > 2) return;
      // Edit mode works outside AND inside: grabbing furniture starts a drag
      if (this.editMode) {
        const picked = this.pickEditable(this.toNDC(e.clientX, e.clientY));
        if (picked) {
          // Dog house + cooking pot are the only locked objects
          if (picked === "doghouse" || picked === "pot") return;
          this.selectEditable(picked);
          this.editDrag = { id: picked, moved: false };
          this.startPointerX = e.clientX;
          this.startPointerY = e.clientY;
          // Long-press (no keyboard needed): hold still to nudge the object up
          this.startLongPress(e.clientX, e.clientY, picked);
          return;
        }
      }
      this.isDragging = true;
      this.prevMouseX = e.clientX;
      this.prevMouseY = e.clientY;
      this.startPointerX = e.clientX;
      this.startPointerY = e.clientY;
    });

    window.addEventListener("pointermove", (e) => {
      if (this.touchPoints.has(e.pointerId)) {
        this.touchPoints.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }
      // Two-finger pinch: lift / lower the grabbed object on the Y axis
      if (this.pinchState && this.touchPoints.size >= 2) {
        const pts = [...this.touchPoints.values()];
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (Math.abs(dist - this.pinchState.startDist) > 6) {
          this.pinchState.moved = true;
        }
        if (this.pinchState.moved) {
          const obj = this.editables.get(this.pinchState.id);
          if (obj) {
            obj.position.y = THREE.MathUtils.clamp(
              this.pinchState.baseY + (dist - this.pinchState.startDist) * 0.006,
              0,
              3.0
            );
            this.selectionBox?.update();
            this.refreshSelectionMarker();
          }
        }
        return;
      }
      // A real move cancels a pending long-press
      if (this.longPressTimer !== null) {
        const moved = Math.hypot(e.clientX - this.startPointerX, e.clientY - this.startPointerY);
        if (moved > 10) this.clearLongPress();
      }
      // Edit mode furniture drag: slide the grabbed object along the floor
      if (this.editDrag && !this.isDragging) {
        const dist = Math.hypot(e.clientX - this.startPointerX, e.clientY - this.startPointerY);
        if (!this.editDrag.moved && dist > 10) {
          this.editDrag.moved = true;
          this.clearLongPress();
        }
        if (this.editDrag.moved) {
          const raycaster = new THREE.Raycaster();
          raycaster.setFromCamera(this.toNDC(e.clientX, e.clientY), this.camera);
          const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
          const hit = new THREE.Vector3();
          if (raycaster.ray.intersectPlane(floorPlane, hit)) {
            const obj = this.editables.get(this.editDrag.id);
            if (obj) {
              const c = this.clampForRoom(hit.x, hit.z);
              obj.position.x = c.x;
              obj.position.z = c.z;
              this.selectionBox?.update();
              this.refreshSelectionMarker();
            }
          }
        }
        return;
      }
      if (!this.isDragging) return;
      const dx = e.clientX - this.prevMouseX;
      const dy = e.clientY - this.prevMouseY;

      this.spherical.theta -= dx * 0.006;
      this.spherical.phi = THREE.MathUtils.clamp(
        this.spherical.phi - dy * 0.006,
        0.15,
        Math.PI / 2 - 0.05
      );

      this.updateCameraPosition();
      this.prevMouseX = e.clientX;
      this.prevMouseY = e.clientY;
    });

    const onPointerEnd = (e: PointerEvent) => {
      this.touchPoints.delete(e.pointerId);
      // Two fingers -> one: pinch ended (or a quick two-finger tap = tilt)
      if (this.pinchState) {
        const pinch = this.pinchState;
        this.pinchState = null;
        if (pinch.moved) {
          this.buzz(20);
          if (this.onEditChanged) this.onEditChanged(this.selectedEditId);
        } else if (this.selectedEditId && performance.now() - this.secondFingerDownAt < 350) {
          // Quick two-finger tap on the selected object: tilt it forward
          this.rotateSelected("x", 15);
          this.buzz(15);
          // Don't let the leftover finger release count as a double-tap
          this.lastTap = null;
          this.suppressTapUntil = performance.now() + 600;
        }
        return;
      }
      // Edit mode tap vs drag: tap selects (double-tap spins), drag saves layout
      if (this.editDrag) {
        const drag = this.editDrag;
        this.editDrag = null;
        this.clearLongPress();
        if (drag.moved) {
          if (this.onEditChanged) this.onEditChanged(this.selectedEditId);
        } else {
          const now = performance.now();
          if (now < this.suppressTapUntil) {
            this.lastTap = null;
          } else if (this.lastTap && this.lastTap.id === drag.id && now - this.lastTap.time < 350) {
            this.rotateSelected("y", 45);
            this.lastTap = null;
          } else {
            this.lastTap = { id: drag.id, time: now };
          }
        }
        return;
      }
      if (!this.isDragging) return;
      this.isDragging = false;

      const distMoved = Math.hypot(e.clientX - this.startPointerX, e.clientY - this.startPointerY);
      if (distMoved < 8) {
        this.handleSceneClick(e.clientX, e.clientY);
      }
    };
    window.addEventListener("pointerup", onPointerEnd);
    window.addEventListener("pointercancel", onPointerEnd);

    dom.addEventListener("wheel", (e) => {
      e.preventDefault();
      const minRadius = this.viewMode === "house" ? 3.0 : 3.5;
      const maxRadius = this.viewMode === "house" ? 5.5 : 18.0;
      this.spherical.radius = THREE.MathUtils.clamp(
        this.spherical.radius + e.deltaY * 0.008,
        minRadius,
        maxRadius
      );
      this.updateCameraPosition();
    });

    // Handle window resize
    window.addEventListener("resize", this.handleResize);
  }

  private handleSceneClick(clientX: number, clientY: number) {
    const dom = this.renderer.domElement;
    const rect = dom.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.camera);

    // 1. Check Dog Click (Petting with heart particles)
    const dogIntersects = raycaster.intersectObject(this.dog.group, true);
    if (dogIntersects.length > 0) {
      this.triggerPetAffection();
      if (this.onPetClicked) this.onPetClicked();
      return;
    }

    if (this.viewMode === "house") {
      // Edit mode intercepts taps for object selection (double-tap spins)
      if (this.editMode) {
        const picked = this.pickEditable(mouse);
        if (picked) {
          if (picked === "doghouse" || picked === "pot") {
            this.selectEditable(null);
            return;
          }
          const now = performance.now();
          if (this.lastTap && this.lastTap.id === picked && now - this.lastTap.time < 350) {
            this.rotateSelected("y", 45);
            this.lastTap = null;
            if (this.onEditChanged) this.onEditChanged(this.selectedEditId);
          } else {
            this.selectEditable(picked);
            this.lastTap = { id: picked, time: now };
          }
          return;
        }
        this.selectEditable(null);
        return;
      }

      if (this.houseRoom === "hallway") {
        // HALLWAY interactivity — stairs up, doors to living + kitchen
        const stairHits = raycaster.intersectObjects([this.stairsGroup, this.stairsMatMesh], true);
        if (stairHits.length > 0) {
          this.climbStairs();
          return;
        }
        if (this.hallwayLivingMesh) {
          const hits = raycaster.intersectObject(this.hallwayLivingMesh, false);
          if (hits.length > 0) {
            this.enterLivingRoom();
            return;
          }
        }
        if (this.hallwayKitchenMesh) {
          const hits = raycaster.intersectObject(this.hallwayKitchenMesh, false);
          if (hits.length > 0) {
            this.enterKitchen();
            return;
          }
        }
        if (this.hallwayFloorMesh) {
          const floorHits = raycaster.intersectObject(this.hallwayFloorMesh, false);
          if (floorHits.length > 0) {
            this.walkTo(floorHits[0].point);
            return;
          }
        }
        return;
      }

      if (this.houseRoom === "upstairs") {
        // UPSTAIRS interactivity — bed, descend mat, floor walk
        const bedHits = raycaster.intersectObject(this.bedGroup, true);
        if (bedHits.length > 0) {
          if (this.onBedClicked) {
            this.onBedClicked();
          } else {
            this.goToBed();
          }
          return;
        }
        if (this.descendMesh) {
          const hits = raycaster.intersectObject(this.descendMesh, false);
          if (hits.length > 0) {
            if (this.onDescendClicked) this.onDescendClicked();
            return;
          }
        }
        if (this.upstairsFloorMesh) {
          const floorHits = raycaster.intersectObject(this.upstairsFloorMesh, false);
          if (floorHits.length > 0) {
            this.walkTo(floorHits[0].point);
            return;
          }
        }
        return;
      }

      if (this.houseRoom === "kitchen") {
        // KITCHEN ROOM interactivity — pot in the middle opens cooking!
        const potHits = raycaster.intersectObjects([this.potGroup, this.potSteamGroup], true);
        // Also test stove base via kitchenGroup scan fallback
        const stoveHits =
          potHits.length > 0
            ? potHits
            : raycaster.intersectObject(this.kitchenGroup, true).filter((h) => {
                let o: THREE.Object3D | null = h.object;
                while (o) {
                  if (o.userData?.type === "pot") return true;
                  o = o.parent;
                }
                return false;
              });
        if (stoveHits.length > 0) {
          this.walkToPotAndCook();
          return;
        }

        // Back to hallway (hallway sits between kitchen and living room)
        if (this.kitchenHallDoorMesh) {
          const backHits = raycaster.intersectObject(this.kitchenHallDoorMesh, false);
          if (backHits.length > 0) {
            this.enterHallway();
            return;
          }
        }

        // Kitchen floor walk
        if (this.kitchenFloorMesh) {
          const floorHits = raycaster.intersectObject(this.kitchenFloorMesh, false);
          if (floorHits.length > 0) {
            this.walkTo(floorHits[0].point);
            return;
          }
        }
        return;
      }

      // LIVING ROOM interactivity
      // A. Check Bed Click -> Dog walks onto bed and goes to sleep!
      const bedHits = raycaster.intersectObject(this.bedGroup, true);
      if (bedHits.length > 0) {
        if (this.onBedClicked) {
          this.onBedClicked();
        } else {
          this.goToBed();
        }
        return;
      }

      // B. Check House Toy Click -> Dog plays with toy!
      const toyHits = raycaster.intersectObject(this.houseToyGroup, true);
      if (toyHits.length > 0) {
        this.playWithToy();
        return;
      }

      // B2. Check Toy Corner Click -> Dog plays with corner toys!
      const cornerHits = raycaster.intersectObject(this.toyCornerGroup, true);
      if (cornerHits.length > 0) {
        this.playWithToy(new THREE.Vector3(1.9, 0, -1.2));
        return;
      }

      // C. Check Ceiling Lamp Click -> Toggle lamp!
      const lampHits = raycaster.intersectObject(this.ceilingLampGroup, true);
      if (lampHits.length > 0) {
        this.toggleCeilingLamp();
        return;
      }

      // D. Check Exit Doorway Click -> Go outside!
      if (this.houseDoorMesh) {
        const doorHits = raycaster.intersectObject(this.houseDoorMesh, false);
        if (doorHits.length > 0) {
          this.exitToPark();
          return;
        }
      }

      // D2. Check Hallway Doorway Click -> Enter hallway!
      if (this.hallwayDoorMesh) {
        const kHits = raycaster.intersectObject(this.hallwayDoorMesh, false);
        if (kHits.length > 0) {
          this.enterHallway();
          return;
        }
      }

      // E. Check Room Floor Click -> Walk to spot!
      if (this.roomFloorMesh) {
        const floorHits = raycaster.intersectObject(this.roomFloorMesh, false);
        if (floorHits.length > 0) {
          this.walkTo(floorHits[0].point);
          return;
        }
      }
    } else {
      // 3. Park Mode Interactivity
      // Edit mode in the park: tap trees / bowls / hurdles to move them
      if (this.editMode) {
        const picked = this.pickEditable(mouse);
        if (picked) {
          if (picked === "doghouse" || picked === "pot") {
            this.selectEditable(null);
            return;
          }
          const now = performance.now();
          if (this.lastTap && this.lastTap.id === picked && now - this.lastTap.time < 350) {
            this.rotateSelected("y", 45);
            this.lastTap = null;
            if (this.onEditChanged) this.onEditChanged(this.selectedEditId);
          } else {
            this.selectEditable(picked);
            this.lastTap = { id: picked, time: now };
          }
          return;
        }
        this.selectEditable(null);
        return;
      }
      // A. Cooking-ready beacon above the house (red ring + pot icon)
      if (this.cookBeaconVisible) {
        const beaconHits = raycaster.intersectObject(this.cookBeaconGroup, true);
        if (beaconHits.length > 0) {
          if (this.onCookBeaconClicked) this.onCookBeaconClicked();
          return;
        }
      }
      // B. Choppable trees (needs the axe from the shop)
      const treeHits = raycaster.intersectObjects(this.treeGroups.filter((_, i) => this.treeData[i]?.alive), true);
      if (treeHits.length > 0) {
        let o: THREE.Object3D | null = treeHits[0].object;
        while (o) {
          const tid = (o.userData as { treeId?: string }).treeId;
          if (tid) {
            this.chopTree(tid);
            return;
          }
          o = o.parent;
        }
      }
      // C. Check Doghouse Exterior Click -> Enter house!
      if (this.dogHouseExteriorGroup) {
        const houseHits = raycaster.intersectObject(this.dogHouseExteriorGroup, true);
        if (houseHits.length > 0) {
          this.enterHouse();
          return;
        }
      }

      // D. Check Ground Lawn Click -> Walk to spot!
      if (this.groundMesh) {
        const groundHits = raycaster.intersectObject(this.groundMesh, false);
        if (groundHits.length > 0) {
          this.walkTo(groundHits[0].point);
          return;
        }
      }
    }
  }

  private handleResize = () => {
    if (this.isDestroyed || !this.container) return;
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 600;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private updateCameraPosition() {
    let target: THREE.Vector3;
    if (this.viewMode === "house") {
      target = this.cameraTarget; // Center of room
    } else {
      const dogPos = this.dog?.group?.position;
      target = (this.followDog && dogPos)
        ? dogPos.clone().add(new THREE.Vector3(0, 0.9, 0))
        : this.cameraTarget;
    }

    if (!target) return;

    this.camera.position.setFromSpherical(this.spherical).add(target);
    this.camera.lookAt(target);
  }

  public setTimeOfDay(time: TimeOfDay) {
    this.timeOfDay = time;
    const skyMat = this.skyDome.material as THREE.MeshBasicMaterial;
    skyMat.color.setHex(0xffffff);
    if (time === "day") {
      this.ambientLight.intensity = 0.45;
      this.ambientLight.color.setHex(0xffffff);
      this.hemiLight.color.setHex(0x87ceeb);
      this.hemiLight.groundColor.setHex(0x4a8505);
      this.hemiLight.intensity = 0.6;
      this.sunLight.intensity = 1.3;
      this.sunLight.color.setHex(0xfffaed);
      // Day: blue top melting into green horizon (forest feel)
      this.setSkyGradient("#4aa8ec", "#a8e0c8");
      this.scene.fog = new THREE.FogExp2(0xcfe8d8, 0.014);
      this.lanternLight.intensity = 0;
    } else if (time === "sunset") {
      this.ambientLight.intensity = 0.35;
      this.ambientLight.color.setHex(0xfecdd3);
      this.hemiLight.color.setHex(0xfb923c);
      this.hemiLight.groundColor.setHex(0x854d0e);
      this.hemiLight.intensity = 0.5;
      this.sunLight.intensity = 1.4;
      this.sunLight.color.setHex(0xf97316);
      this.sunLight.position.set(16, 8, 12);
      this.setSkyGradient("#7c5cc9", "#f7b98a");
      this.scene.fog = new THREE.FogExp2(0xf3cf9e, 0.018);
      this.lanternLight.intensity = 2.5;
    } else {
      // Night mode
      this.ambientLight.intensity = 0.15;
      this.ambientLight.color.setHex(0x38bdf8);
      this.hemiLight.color.setHex(0x1e3a8a);
      this.hemiLight.groundColor.setHex(0x064e3b);
      this.hemiLight.intensity = 0.3;
      this.sunLight.intensity = 0.4;
      this.sunLight.color.setHex(0x93c5fd);
      this.setSkyGradient("#0f172a", "#1e3a5f");
      this.scene.fog = new THREE.FogExp2(0x0f172a, 0.025);
      this.lanternLight.intensity = 4.0;
    }
    this.applyWeatherOverlay();
  }

  /**
   * Throw tennis ball for interactive Fetch game!
   */
  public throwBall(targetDistance: number = 7.0, targetAngle: number = 0) {
    if (this.ballState.inDogMouth || this.fetchState !== "idle") return;

    sound.playWhistle();

    // Start ball at dog/camera launch point
    const launchPos = new THREE.Vector3(0, 1.2, 2.5);
    this.ballState.position.copy(launchPos);
    this.ballMesh.position.copy(launchPos);
    this.ballMesh.visible = true;
    this.dog.ballInMouth.visible = false;

    // Calculate trajectory
    const dir = new THREE.Vector3(
      Math.sin(targetAngle) * targetDistance,
      0,
      -Math.cos(targetAngle) * targetDistance
    );
    this.ballState.velocity.set(dir.x * 0.8, 5.5 + Math.random() * 1.5, dir.z * 0.8);
    this.ballState.bounces = 0;
    this.ballState.active = true;
    this.fetchState = "chasing";

    // Dog turns and chases
    this.fetchTargetPos.set(launchPos.x + dir.x, 0, launchPos.z + dir.z);
    this.dog.setAction("run");
  }

  /**
   * Feed a treat in 3D: Treat drops, dog bounds toward it and munches!
   */
  public feedTreat() {
    const treatPos = new THREE.Vector3(
      this.dog.group.position.x + (Math.random() - 0.5) * 1.2,
      1.5,
      this.dog.group.position.z + 1.2
    );
    this.treatMesh.position.copy(treatPos);
    this.treatMesh.visible = true;

    // Dog eats
    setTimeout(() => {
      this.dog.setAction("eat", 2.0);
      this.spawnHeartParticles(this.dog.group.position.clone().add(new THREE.Vector3(0, 1.4, 0)));
      setTimeout(() => {
        this.treatMesh.visible = false;
      }, 1000);
    }, 400);
  }

  /**
   * Petting interaction with heart particle explosion!
   */
  public triggerPetAffection() {
    sound.playSoftWoof();
    this.dog.setAction("jump", 1.0);
    this.spawnHeartParticles(this.dog.group.position.clone().add(new THREE.Vector3(0, 1.4, 0)));
  }

  /**
   * Spawn 3D Heart / Love floating particles
   */
  public spawnHeartParticles(center: THREE.Vector3) {
    const count = 10;
    for (let i = 0; i < count; i++) {
      const pMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e });
      const pGeom = new THREE.SphereGeometry(0.08, 6, 6);
      const p = new THREE.Mesh(pGeom, pMat);
      p.position.copy(center);
      p.userData = {
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 1.5,
          1.2 + Math.random() * 1.0,
          (Math.random() - 0.5) * 1.5
        ),
        life: 1.0,
      };
      this.particlesGroup.add(p);
    }
  }

  private updateParticles(delta: number) {
    for (let i = this.particlesGroup.children.length - 1; i >= 0; i--) {
      const p = this.particlesGroup.children[i] as THREE.Mesh;
      p.userData.life -= delta * 1.2;
      p.position.addScaledVector(p.userData.vel, delta);
      p.scale.setScalar(Math.max(0.01, p.userData.life));

      if (p.userData.life <= 0) {
        this.particlesGroup.remove(p);
        p.geometry.dispose();
        (p.material as THREE.Material).dispose();
      }
    }
  }

  private updatePhysics(delta: number) {
    // 1. Ball physics
    if (this.ballState.active) {
      this.ballState.velocity.y -= 9.8 * delta; // Gravity
      this.ballState.position.addScaledVector(this.ballState.velocity, delta);

      // Ground bounce
      if (this.ballState.position.y <= 0.18) {
        this.ballState.position.y = 0.18;
        this.ballState.velocity.y = -this.ballState.velocity.y * 0.55;
        this.ballState.velocity.x *= 0.75;
        this.ballState.velocity.z *= 0.75;
        this.ballState.bounces++;

        if (this.ballState.bounces === 1) {
          sound.playBallBounce();
        }

        if (this.ballState.bounces > 4 || this.ballState.velocity.length() < 0.2) {
          this.ballState.active = false;
          this.ballState.velocity.set(0, 0, 0);
          this.fetchTargetPos.copy(this.ballState.position);
        }
      }

      this.ballMesh.position.copy(this.ballState.position);
      this.ballMesh.rotation.x += this.ballState.velocity.z * delta * 5;
      this.ballMesh.rotation.z -= this.ballState.velocity.x * delta * 5;
    }

    // 2. Dog Fetch AI
    if (this.fetchState === "chasing") {
      if (!this.dog?.group?.position || !this.ballMesh?.position) return;
      const dogPos = this.dog.group.position;
      const target = this.ballMesh.position;
      const diff = new THREE.Vector2(target.x - dogPos.x, target.z - dogPos.z);
      const dist = diff.length();

      // Turn smoothly towards ball
      const targetAngle = Math.atan2(diff.x, diff.y);
      this.dog.group.rotation.y = THREE.MathUtils.lerp(
        this.dog.group.rotation.y,
        targetAngle,
        delta * 6
      );

      // Move toward ball (rain makes the dog lethargic & slower)
      const speed = 4.2 * this.weatherSpeedFactor;
      dogPos.x += Math.sin(targetAngle) * speed * delta;
      dogPos.z += Math.cos(targetAngle) * speed * delta;

      // When reached ball
      if (dist < 0.7) {
        this.fetchState = "grabbing";
        this.dog.setAction("idle");
        setTimeout(() => {
          this.ballMesh.visible = false;
          this.dog.ballInMouth.visible = true;
          this.ballState.inDogMouth = true;
          this.fetchState = "returning";
          this.dog.setAction("run");
          sound.playSqueak();
        }, 350);
      }
    } else if (this.fetchState === "returning") {
      if (!this.dog?.group?.position || !this.fetchReturnPos) return;
      const dogPos = this.dog.group.position;
      const target = this.fetchReturnPos;
      const diff = new THREE.Vector2(target.x - dogPos.x, target.z - dogPos.z);
      const dist = diff.length();

      const targetAngle = Math.atan2(diff.x, diff.y);
      this.dog.group.rotation.y = THREE.MathUtils.lerp(
        this.dog.group.rotation.y,
        targetAngle,
        delta * 6
      );

      const speed = 3.6 * this.weatherSpeedFactor;
      dogPos.x += Math.sin(targetAngle) * speed * delta;
      dogPos.z += Math.cos(targetAngle) * speed * delta;

      // Returned to player!
      if (dist < 0.8) {
        this.fetchState = "idle";
        this.ballState.inDogMouth = false;
        this.dog.ballInMouth.visible = false;
        this.ballMesh.position.set(dogPos.x + 0.5, 0.18, dogPos.z + 0.5);
        this.ballMesh.visible = true;
        this.dog.setAction("sit");
        sound.playSoftWoof();
        sound.playRewardFanfare();
        if (this.onFetchSuccess) {
          this.onFetchSuccess(50);
        }
      }
    }

    // 3. Click-to-Walk Movement
    if (this.walkTarget && this.fetchState === "idle") {
      const dogPos = this.dog.group.position;
      const diff = new THREE.Vector2(this.walkTarget.x - dogPos.x, this.walkTarget.z - dogPos.z);
      const dist = diff.length();

      if (dist > 0.25) {
        const targetAngle = Math.atan2(diff.x, diff.y);
        this.dog.group.rotation.y = THREE.MathUtils.lerp(
          this.dog.group.rotation.y,
          targetAngle,
          delta * 8
        );

        const walkSpeed = 3.2 * this.weatherSpeedFactor;
        dogPos.x += Math.sin(targetAngle) * walkSpeed * delta;
        dogPos.z += Math.cos(targetAngle) * walkSpeed * delta;

        if (this.walkTargetMarker.visible) {
          this.walkTargetMarker.rotation.y += delta * 3;
          const s = 1.0 + Math.sin(this.clock.getElapsedTime() * 8) * 0.15;
          this.walkTargetMarker.scale.set(s, s, s);
        }
      } else {
        // Arrived at destination!
        this.walkTarget = null;
        this.walkTargetMarker.visible = false;
        this.dog.setAction("idle");
        if (this.walkCallback) {
          const cb = this.walkCallback;
          this.walkCallback = null;
          cb();
        }
      }
    }
  }

  /**
   * Click-to-Walk: Instructs the dog to navigate to a specific (x, z) point
   */
  public walkTo(target: THREE.Vector3, onArrived?: () => void) {
    const c = this.clampForRoom(target.x, target.z);
    const clampedX = c.x;
    const clampedZ = c.z;

    this.walkTarget = new THREE.Vector3(clampedX, 0, clampedZ);
    this.walkCallback = onArrived || null;

    this.walkTargetMarker.position.set(clampedX, 0.02, clampedZ);
    this.walkTargetMarker.visible = true;
    this.walkTargetMarker.scale.set(1, 1, 1);

    this.dog.setAction("run");
    if (this.onDogMoved) {
      this.onDogMoved(this.walkTarget);
    }
  }

  /**
   * Enter Dog House (Transitions from Park to Living Room Interior)
   */
  public enterHouse() {
    if (this.viewMode === "house" && this.houseRoom === "living") return;
    this.viewMode = "house";
    this.houseRoom = "living";

    this.hideAllRooms();
    this.houseGroup.visible = true;

    // Reset dog position inside room
    this.dog.group.position.set(0, 0, 0.6);
    this.dog.group.rotation.y = 0;
    this.dog.setAction("idle");

    this.walkTarget = null;
    this.walkTargetMarker.visible = false;

    // Room camera framing
    this.spherical.set(4.6, Math.PI / 3.0, 0);
    this.cameraTarget.set(0, 0.9, 0);
    this.updateCameraPosition();

    sound.playSoftWoof();
    if (this.onRoomChanged) this.onRoomChanged("living");
    if (this.onHouseEntered) {
      this.onHouseEntered();
    }
  }

  /**
   * Enter Kitchen (second house room with central cooking pot)
   */
  public enterKitchen() {
    if (this.viewMode !== "house") {
      this.viewMode = "house";
      this.parkGroup.visible = false;
      if (this.onHouseEntered) this.onHouseEntered();
    }
    this.houseRoom = "kitchen";
    this.hideAllRooms();
    this.kitchenGroup.visible = true;

    this.dog.group.position.set(0, 0, 1.8);
    this.dog.group.rotation.y = Math.PI;
    this.dog.setAction("idle");

    this.walkTarget = null;
    this.walkTargetMarker.visible = false;

    this.spherical.set(4.6, Math.PI / 3.0, 0);
    this.cameraTarget.set(0, 0.9, 0.3);
    this.updateCameraPosition();

    sound.playSoftWoof();
    if (this.onRoomChanged) this.onRoomChanged("kitchen");
  }

  /**
   * Enter Living Room (first house room with bed + toy)
   */
  public enterLivingRoom() {
    if (this.viewMode !== "house") {
      this.enterHouse();
      return;
    }
    this.houseRoom = "living";
    this.hideAllRooms();
    this.houseGroup.visible = true;

    this.dog.group.position.set(0, 0, 0.6);
    this.dog.group.rotation.y = 0;
    this.dog.setAction("idle");

    this.walkTarget = null;
    this.walkTargetMarker.visible = false;

    this.spherical.set(4.6, Math.PI / 3.0, 0);
    this.cameraTarget.set(0, 0.9, 0);
    this.updateCameraPosition();

    sound.playButtonTap();
    if (this.onRoomChanged) this.onRoomChanged("living");
  }

  private hideAllRooms() {
    this.parkGroup.visible = false;
    this.houseGroup.visible = false;
    this.kitchenGroup.visible = false;
    this.hallwayGroup.visible = false;
    this.upstairsGroup.visible = false;
  }

  /**
   * Enter Hallway (wood-floor corridor between living room and kitchen, stairs up)
   */
  public enterHallway() {
    if (this.viewMode !== "house") {
      this.viewMode = "house";
      if (this.onHouseEntered) this.onHouseEntered();
    }
    this.houseRoom = "hallway";
    this.hideAllRooms();
    this.hallwayGroup.visible = true;

    this.dog.group.position.set(0, 0, 2.6);
    this.dog.group.rotation.y = Math.PI;
    this.dog.setAction("idle");

    this.walkTarget = null;
    this.walkTargetMarker.visible = false;

    this.spherical.set(4.8, Math.PI / 3.0, 0);
    this.cameraTarget.set(0, 0.9, 0);
    this.updateCameraPosition();

    sound.playSoftWoof();
    if (this.onRoomChanged) this.onRoomChanged("hallway");
  }

  /**
   * Enter Upstairs bedroom (wider than deep, bed + night sky window)
   */
  public enterUpstairs() {
    if (this.viewMode !== "house") {
      this.viewMode = "house";
      if (this.onHouseEntered) this.onHouseEntered();
    }
    this.houseRoom = "upstairs";
    this.hideAllRooms();
    this.upstairsGroup.visible = true;

    this.dog.group.position.set(1.55, 0, 1.8);
    this.dog.group.rotation.y = Math.PI * 0.9;
    this.dog.setAction("idle");

    this.walkTarget = null;
    this.walkTargetMarker.visible = false;

    this.spherical.set(7.0, Math.PI / 3.1, 0);
    this.cameraTarget.set(0, 0.9, 0);
    this.updateCameraPosition();

    sound.playSoftWoof();
    if (this.onRoomChanged) this.onRoomChanged("upstairs");
  }

  /**
   * Climb the hallway stairs: dog walks to the base, hops up step by step,
   * then fires onStairsClimbed (the app plays the iris transition).
   */
  public climbStairs() {
    if (this.viewMode !== "house" || this.houseRoom !== "hallway") return;
    if (this.climbAnim?.active) return;
    this.walkTo(new THREE.Vector3(this.STAIR_BASE.x, 0, this.STAIR_BASE.z + 0.6), () => {
      this.climbAnim = { t: 0, active: true };
      this.dog.setAction("run");
      sound.playWhistle();
    });
  }

  private updateClimb(delta: number) {
    if (!this.climbAnim?.active) return;
    this.climbAnim.t += delta / 2.4;
    const t = Math.min(1, this.climbAnim.t);
    const pos = this.dog.group.position;
    pos.x = THREE.MathUtils.lerp(this.STAIR_BASE.x, this.STAIR_TOP.x, t);
    pos.z = THREE.MathUtils.lerp(this.STAIR_BASE.z + 0.6, this.STAIR_TOP.z, t);
    // Hop up the steps with a little bounce
    pos.y = THREE.MathUtils.lerp(0, this.STAIR_TOP.y, t) + Math.abs(Math.sin(t * Math.PI * 8)) * 0.12;
    this.dog.group.rotation.y = Math.PI;
    if (t >= 1) {
      this.climbAnim.active = false;
      pos.y = 0;
      this.dog.setAction("idle");
      sound.playRewardFanfare();
      if (this.onStairsClimbed) this.onStairsClimbed();
    }
  }

  // ---------- Edit mode: move & rotate furniture ----------

  public setEditMode(on: boolean) {
    this.editMode = on;
    this.editDrag = null;
    this.pinchState = null;
    this.clearLongPress();
    this.touchPoints.clear();
    if (!on) {
      this.selectEditable(null);
    } else {
      this.selectionMarker.visible = !!this.selectedEditId;
    }
  }

  private registerEditable(id: string, obj: THREE.Object3D) {
    this.editables.set(id, obj);
    obj.traverse((c) => {
      c.userData.editId = id;
    });
  }

  private pickEditable(mouse: THREE.Vector2): string | null {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.camera);
    const hits = raycaster.intersectObjects([...this.editables.values()], true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o) {
        const id = (o.userData as { editId?: string }).editId;
        if (id && this.editables.has(id)) return id;
        o = o.parent;
      }
    }
    return null;
  }

  public selectEditable(id: string | null) {
    this.selectedEditId = id;
    if (this.selectionBox) {
      this.scene.remove(this.selectionBox);
      this.selectionBox.geometry.dispose();
      (this.selectionBox.material as THREE.Material).dispose();
      this.selectionBox = null;
    }
    if (id) {
      const obj = this.editables.get(id);
      if (obj) {
        this.selectionBox = new THREE.BoxHelper(obj, 0xfacc15);
        this.scene.add(this.selectionBox);
        this.refreshSelectionMarker();
        this.selectionMarker.visible = this.editMode;
        this.buzz(12);
      }
    } else {
      this.selectionMarker.visible = false;
    }
    if (this.onEditChanged) this.onEditChanged(id);
  }

  /** Tiny haptic tick on phones (silent no-op on desktop). */
  private buzz(ms: number) {
    try {
      (navigator as Navigator & { vibrate?: (p: number) => boolean }).vibrate?.(ms);
    } catch {
      // ignore
    }
  }

  /** Long-press shortcut: hold one finger still to nudge the object upward. */
  private startLongPress(x: number, y: number, id: string) {
    this.clearLongPress();
    this.longPressTimer = window.setTimeout(() => {
      this.longPressTimer = null;
      if (this.selectedEditId !== id || this.pinchState) return;
      this.moveSelectedVertical(0.25);
      sound.playButtonTap();
      this.buzz(25);
      // A hold is not a tap — don't chain it into a double-tap spin
      this.lastTap = null;
    }, 600);
  }

  private clearLongPress() {
    if (this.longPressTimer !== null) {
      window.clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  private setupSelectionMarker() {
    this.selectionMarker = new THREE.Group();
    // Amber cone pointing down at the grabbed object
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.16, 0.3, 12),
      new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xb45309,
        emissiveIntensity: 0.7,
        roughness: 0.4,
      })
    );
    cone.rotation.x = Math.PI;
    this.selectionMarker.add(cone);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.24, 0.035, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0xfde047 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.22;
    this.selectionMarker.add(ring);
    this.selectionMarker.visible = false;
    this.scene.add(this.selectionMarker);
  }

  /** Recompute how high the marker floats (top of the grabbed object). */
  private refreshSelectionMarker() {
    const obj = this.selectedEditId ? this.editables.get(this.selectedEditId) : undefined;
    if (!obj) return;
    try {
      const box = new THREE.Box3().setFromObject(obj);
      obj.getWorldPosition(this.markerTmp);
      this.selectionTopOffset = Math.max(0.4, box.max.y - this.markerTmp.y);
    } catch {
      this.selectionTopOffset = 1.0;
    }
  }

  private updateSelectionMarker(elapsed: number) {
    if (!this.selectionMarker.visible || !this.selectedEditId) return;
    const obj = this.editables.get(this.selectedEditId);
    if (!obj) {
      this.selectionMarker.visible = false;
      return;
    }
    obj.getWorldPosition(this.markerTmp);
    this.selectionMarker.position.set(
      this.markerTmp.x,
      this.markerTmp.y + this.selectionTopOffset + 0.35 + Math.sin(elapsed * 4) * 0.08,
      this.markerTmp.z
    );
    this.selectionMarker.rotation.y = elapsed * 2;
  }

  public getSelectedEditId(): string | null {
    return this.selectedEditId;
  }

  public moveSelected(dx: number, dz: number) {
    const obj = this.selectedEditId ? this.editables.get(this.selectedEditId) : undefined;
    if (!obj) return;
    // Dog house + cooking pot stay put — everything else can move
    if (this.selectedEditId === "doghouse" || this.selectedEditId === "pot") return;
    const c = this.clampForRoom(obj.position.x + dx, obj.position.z + dz);
    obj.position.x = c.x;
    obj.position.z = c.z;
    this.selectionBox?.update();
    this.refreshSelectionMarker();
    if (this.onEditChanged) this.onEditChanged(this.selectedEditId);
  }

  /** Shift+Up/Down in edit mode: lift / lower the object on the Y axis. */
  public moveSelectedVertical(dy: number) {
    const obj = this.selectedEditId ? this.editables.get(this.selectedEditId) : undefined;
    if (!obj) return;
    if (this.selectedEditId === "doghouse" || this.selectedEditId === "pot") return;
    obj.position.y = THREE.MathUtils.clamp(obj.position.y + dy, 0, 3.0);
    this.selectionBox?.update();
    this.refreshSelectionMarker();
    this.buzz(12);
    if (this.onEditChanged) this.onEditChanged(this.selectedEditId);
  }

  // ---------- Axe gameplay: chop down park trees ----------

  /** Chop a tree if the player owns an axe. Falls over, hides, respawns later. */
  public chopTree(treeId: string): boolean {
    const idx = this.treeData.findIndex((t) => t.id === treeId);
    if (idx < 0) return false;
    const data = this.treeData[idx];
    if (!data.alive) return false;
    if (!this.hasAxe) {
      if (this.onTreeClickedNoAxe) this.onTreeClickedNoAxe();
      return false;
    }
    data.alive = false;
    data.respawnAt = performance.now() + 60000;
    const tree = this.treeGroups[idx];
    // Falling timber animation: tip over + sink slightly
    const startRot = tree.rotation.z;
    const startY = tree.position.y;
    const t0 = performance.now();
    const fall = () => {
      const k = Math.min(1, (performance.now() - t0) / 700);
      tree.rotation.z = startRot + k * 1.35;
      tree.position.y = startY - k * 0.4;
      if (k < 1) {
        requestAnimationFrame(fall);
      } else {
        tree.visible = false;
        tree.rotation.z = startRot;
        tree.position.y = startY;
      }
    };
    requestAnimationFrame(fall);
    sound.playChop();
    this.spawnHeartParticles(tree.position.clone().add(new THREE.Vector3(0, 2.2, 0)));
    // If it was selected in edit mode, deselect
    if (this.selectedEditId === treeId) this.selectEditable(null);
    if (this.onTreeChopped) this.onTreeChopped(treeId);
    return true;
  }

  private updateTreeRespawns() {
    const now = performance.now();
    this.treeData.forEach((data, i) => {
      if (!data.alive && now >= data.respawnAt) {
        data.alive = true;
        const tree = this.treeGroups[i];
        tree.visible = true;
        tree.scale.setScalar(0.01);
        // Grow back to the tree's original size
        const t0 = performance.now();
        const target = data.baseScale || 1;
        const grow = () => {
          const k = Math.min(1, (performance.now() - t0) / 1200);
          tree.scale.setScalar(Math.max(0.01, k * target));
          if (k < 1) requestAnimationFrame(grow);
          else tree.scale.setScalar(target);
        };
        requestAnimationFrame(grow);
      }
    });
    // Gentle badge bob + pulse above the dog house when soup is ready
    if (this.cookBeaconVisible) {
      const t = now / 1000;
      this.cookBeaconGroup.position.y = 3.9 + Math.sin(t * 3) * 0.15;
      const s = 1 + Math.sin(t * 3) * 0.06;
      this.cookBeaconGroup.scale.set(s, s, 1);
    }
  }

  // ---------- Cooking-ready beacon: red highlight + pot over the house ----------

  /**
   * Soup-ready badge over the park dog house: a high-contrast cherry-red
   * circle (fully saturated crimson, visible from anywhere outside) with a
   * little square Quest-style cooking-pot icon in the middle. A sprite, so it
   * always faces the camera like a game notification marker.
   */
  private makeBeaconTexture(): THREE.CanvasTexture {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext("2d")!;
    // White outer ring for pop against sky + trees
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(128, 128, 120, 0, Math.PI * 2);
    ctx.fill();
    // Cherry-red disc: bright crimson, never burgundy or pale pink
    ctx.fillStyle = "#F50A26";
    ctx.beginPath();
    ctx.arc(128, 128, 106, 0, Math.PI * 2);
    ctx.fill();
    // Subtle darker-red inner edge for depth
    ctx.strokeStyle = "#A3001B";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(128, 128, 98, 0, Math.PI * 2);
    ctx.stroke();

    const ink = "#1F2937";
    // Steam curls above the pot
    ctx.strokeStyle = "rgba(255,255,255,0.92)";
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    const steam = (x: number) => {
      ctx.beginPath();
      ctx.moveTo(x, 92);
      ctx.quadraticCurveTo(x - 10, 76, x, 60);
      ctx.quadraticCurveTo(x + 10, 46, x, 32);
      ctx.stroke();
    };
    steam(104);
    steam(128);
    steam(152);

    // Square Quest-style pot: legs, body, rim, lid, side handles
    ctx.fillStyle = "#2b3542";
    ctx.fillRect(90, 196, 14, 18); // left leg
    ctx.fillRect(152, 196, 14, 18); // right leg
    // Side handles
    ctx.fillStyle = "#8B9BB0";
    ctx.strokeStyle = ink;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(56, 142, 22, 26, 7);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(178, 142, 22, 26, 7);
    ctx.fill();
    ctx.stroke();
    // Pot body (rounded square)
    ctx.fillStyle = "#546274";
    ctx.beginPath();
    ctx.roundRect(74, 128, 108, 74, 16);
    ctx.fill();
    ctx.stroke();
    // Body shine stripe
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.roundRect(86, 140, 14, 50, 7);
    ctx.fill();
    // Rim
    ctx.fillStyle = "#8B9BB0";
    ctx.beginPath();
    ctx.roundRect(66, 118, 124, 22, 10);
    ctx.fill();
    ctx.stroke();
    // Lid knob
    ctx.fillStyle = "#2b3542";
    ctx.beginPath();
    ctx.roundRect(118, 100, 20, 16, 6);
    ctx.fill();
    ctx.stroke();

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private setupCookBeacon() {
    this.cookBeaconGroup = new THREE.Group();
    this.cookBeaconGroup.position.set(-5, 3.9, -4);
    const badge = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.makeBeaconTexture(),
        transparent: true,
        depthTest: false, // always visible outside — never hidden behind trees
      })
    );
    badge.scale.set(2.4, 2.4, 1);
    badge.renderOrder = 999;
    badge.userData = { type: "cookbeacon" };
    this.cookBeaconGroup.add(badge);
    this.cookBeaconGroup.visible = false;
    this.cookBeaconGroup.userData = { type: "cookbeacon" };
    // Parented to the park so it only ever shows outside over the dog house
    this.parkGroup.add(this.cookBeaconGroup);
  }

  public setCookBeaconVisible(visible: boolean) {
    this.cookBeaconVisible = visible;
    this.cookBeaconGroup.visible = visible;
  }

  /**
   * Memory Album snapshot: renders one fresh frame and captures the canvas
   * as a JPEG data URL. Render + capture happen in the same tick so it works
   * without preserveDrawingBuffer.
   */
  public captureSnapshot(): string | null {
    try {
      this.renderer.render(this.scene, this.camera);
      return this.renderer.domElement.toDataURL("image/jpeg", 0.85);
    } catch (e) {
      console.warn("Snapshot capture failed", e);
      return null;
    }
  }

  // ---------- Weather system ----------

  public setWeather(w: WeatherType) {
    this.weather = w;
    this.weatherSpeedFactor = w === "rainy" ? 0.8 : w === "snowy" ? 0.9 : 1.05;
    this.updatePrecipitation();
    // Re-apply the time-of-day base, then layer the weather on top
    this.setTimeOfDay(this.timeOfDay);
  }

  /** Sky / fog / light overlay for the current weather (base comes from time of day). */
  private applyWeatherOverlay() {
    const groundMat = this.groundMesh?.material as THREE.MeshStandardMaterial | undefined;
    const night = this.timeOfDay === "night";
    if (this.weather === "rainy") {
      this.sunLight.intensity *= 0.45;
      this.hemiLight.intensity *= 0.85;
      if (night) {
        this.setSkyGradient("#141e28", "#2c3e50");
        this.scene.fog = new THREE.FogExp2(0x141e28, 0.03);
      } else {
        this.setSkyGradient("#5b7a94", "#a9bfae");
        this.scene.fog = new THREE.FogExp2(0x9db3bd, 0.028);
      }
      groundMat?.color.setHex(0x9fb3a8); // damp, darker grass
    } else if (this.weather === "snowy") {
      this.sunLight.intensity *= 0.7;
      if (night) {
        this.setSkyGradient("#0f172a", "#334155");
        this.scene.fog = new THREE.FogExp2(0x1e293b, 0.026);
      } else {
        this.setSkyGradient("#6ea8dc", "#dceef5");
        this.scene.fog = new THREE.FogExp2(0xdce8f2, 0.022);
      }
      groundMat?.color.setHex(0xe8eef7); // snow-dusted lawn
    } else {
      groundMat?.color.setHex(0xffffff);
    }
  }

  private updatePrecipitation() {
    if (this.precipPoints) {
      this.scene.remove(this.precipPoints);
      this.precipPoints.geometry.dispose();
      (this.precipPoints.material as THREE.Material).dispose();
      this.precipPoints = null;
      this.precipVel = null;
    }
    const kind = this.weather === "rainy" ? "rain" : this.weather === "snowy" ? "snow" : "none";
    this.precipKind = kind;
    if (kind === "none") return;
    const count = kind === "rain" ? 700 : 500;
    const positions = new Float32Array(count * 3);
    this.precipVel = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 30;
      positions[i * 3 + 1] = Math.random() * 15;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 30;
      this.precipVel[i] = kind === "rain" ? 16 + Math.random() * 8 : 1.0 + Math.random() * 0.9;
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: kind === "rain" ? 0x9fc5e8 : 0xffffff,
      size: kind === "rain" ? 0.09 : 0.14,
      transparent: true,
      opacity: kind === "rain" ? 0.65 : 0.9,
      depthWrite: false,
    });
    this.precipPoints = new THREE.Points(geom, mat);
    this.precipPoints.frustumCulled = false;
    this.scene.add(this.precipPoints);
  }

  private updatePrecipitationMotion(delta: number, elapsed: number) {
    if (!this.precipPoints || this.precipKind === "none") return;
    // Storms stay outside — never rain inside the dog house
    this.precipPoints.visible = this.viewMode === "park";
    if (!this.precipPoints.visible) return;
    // Keep the storm centered on the dog
    this.precipPoints.position.set(this.dog.group.position.x, 0, this.dog.group.position.z);
    const pos = this.precipPoints.geometry.getAttribute("position") as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const n = this.precipVel?.length ?? 0;
    for (let i = 0; i < n; i++) {
      const v = this.precipVel![i];
      if (this.precipKind === "rain") {
        arr[i * 3 + 1] -= v * delta;
        arr[i * 3] -= 2.0 * delta; // wind slant
      } else {
        arr[i * 3 + 1] -= v * delta;
        arr[i * 3] += Math.sin(elapsed * 1.5 + i * 1.7) * delta * 0.6; // drift
      }
      if (arr[i * 3 + 1] < 0) {
        arr[i * 3 + 1] = 15;
        arr[i * 3] = (Math.random() - 0.5) * 30;
        arr[i * 3 + 2] = (Math.random() - 0.5) * 30;
      }
    }
    pos.needsUpdate = true;
  }

  public rotateSelected(axis: "x" | "y" | "z", deg: number) {
    const obj = this.selectedEditId ? this.editables.get(this.selectedEditId) : undefined;
    if (!obj) return;
    if (this.selectedEditId === "doghouse" || this.selectedEditId === "pot") return;
    const rad = (deg * Math.PI) / 180;
    if (axis === "x") obj.rotation.x += rad;
    else if (axis === "y") obj.rotation.y += rad;
    else obj.rotation.z += rad;
    this.selectionBox?.update();
    this.refreshSelectionMarker();
    this.buzz(15);
    if (this.onEditChanged) this.onEditChanged(this.selectedEditId);
  }

  public getLayout(): RoomLayout {
    const out: RoomLayout = {};
    this.editables.forEach((obj, id) => {
      out[id] = {
        p: [obj.position.x, obj.position.y, obj.position.z],
        r: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
      };
    });
    return out;
  }

  public applyLayout(layout: RoomLayout | null | undefined) {
    if (!layout) return;
    for (const [id, t] of Object.entries(layout)) {
      const obj = this.editables.get(id);
      if (!obj || !t) continue;
      if (Array.isArray(t.p) && t.p.length === 3) obj.position.set(t.p[0], t.p[1], t.p[2]);
      if (Array.isArray(t.r) && t.r.length === 3) obj.rotation.set(t.r[0], t.r[1], t.r[2]);
    }
  }

  private clampForRoom(x: number, z: number): { x: number; z: number } {
    if (this.houseRoom === "hallway") {
      return {
        x: THREE.MathUtils.clamp(x, -1.9, 1.9),
        z: THREE.MathUtils.clamp(z, -3.9, 3.9),
      };
    }
    if (this.houseRoom === "upstairs") {
      return {
        x: THREE.MathUtils.clamp(x, -5.2, 5.2),
        z: THREE.MathUtils.clamp(z, -2.7, 2.7),
      };
    }
    if (this.viewMode === "house") {
      return {
        x: THREE.MathUtils.clamp(x, -3.2, 3.2),
        z: THREE.MathUtils.clamp(z, -3.2, 3.2),
      };
    }
    return {
      x: THREE.MathUtils.clamp(x, -12.0, 12.0),
      z: THREE.MathUtils.clamp(z, -12.0, 12.0),
    };
  }

  /**
   * Walk dog to the central pot, then open cooking UI
   */
  public walkToPotAndCook() {
    const potSide = new THREE.Vector3(0, 0, 1.6);
    this.walkTo(potSide, () => {
      this.dog.group.rotation.y = Math.PI;
      this.dog.setAction("sit", 2.0);
      sound.playCrunch();
      this.spawnHeartParticles(this.dog.group.position.clone().add(new THREE.Vector3(0, 1.2, 0)));
      if (this.onPotClicked) this.onPotClicked();
    });
  }

  /**
   * Exit Dog House (Returns back to outdoor park)
   */
  public exitToPark() {
    if (this.viewMode === "park") return;
    this.viewMode = "park";

    this.hideAllRooms();
    this.parkGroup.visible = true;

    // Position dog in front of doghouse doorway
    this.dog.group.position.set(-4.5, 0, -2.5);
    this.dog.group.rotation.y = Math.PI;
    this.dog.setAction("idle");

    this.walkTarget = null;
    this.walkTargetMarker.visible = false;

    // Outdoor camera framing
    this.spherical.set(7.5, Math.PI / 3.2, 0);
    this.cameraTarget.copy(this.dog.group.position).add(new THREE.Vector3(0, 1.0, 0));
    this.updateCameraPosition();

    sound.playSoftWoof();
    if (this.onHouseExited) {
      this.onHouseExited();
    }
  }

  /**
   * Go to Dog Bed: Walks dog onto the bed, curls up, and initiates sleep sequence
   */
  public goToBed(onAsleep?: () => void) {
    // The bed lives in the upstairs bedroom
    if (this.viewMode !== "house" || this.houseRoom !== "upstairs") {
      this.enterUpstairs();
    }

    const bedTarget = new THREE.Vector3(this.bedGroup.position.x, 0, this.bedGroup.position.z);
    const dogPos = this.dog.group.position;
    const distToBed = new THREE.Vector2(bedTarget.x - dogPos.x, bedTarget.z - dogPos.z).length();

    // If dog is already on or right next to the bed, immediately rest
    if (distToBed < 0.6) {
      this.dog.group.position.set(bedTarget.x, 0, bedTarget.z);
      this.dog.group.rotation.y = 0.35;
      this.dog.setAction("rest");
      sound.playGoodNightLullaby();
      if (onAsleep) onAsleep();
      return;
    }

    this.walkTo(bedTarget, () => {
      this.dog.group.rotation.y = 0.35;
      this.dog.setAction("rest");
      sound.playGoodNightLullaby();
      if (onAsleep) onAsleep();
    });
  }

  /**
   * Wake up from sleep: dog stands up, stretches, and steps off the bed onto the warm rug
   */
  public wakeUp() {
    this.dog.setAction("idle");
    if (this.viewMode === "house") {
      // Step slightly forward from the bed onto the rug facing the camera
      this.dog.group.position.set(
        this.bedGroup.position.x + 1.0,
        0,
        this.bedGroup.position.z + 0.6
      );
      this.dog.group.rotation.y = Math.PI * 0.75;
    }
  }

  /**
   * Play with House Toy: Dog walks to toy and plays
   */
  public playWithToy(near?: THREE.Vector3) {
    sound.playToyBounce();
    this.isToyAnimating = true;

    const originalY = 0.12;
    let progress = 0;
    const bounceInterval = setInterval(() => {
      progress += 0.18;
      if (progress >= Math.PI) {
        this.houseToyGroup.position.y = originalY;
        this.isToyAnimating = false;
        clearInterval(bounceInterval);
      } else {
        this.houseToyGroup.position.y = originalY + Math.sin(progress) * 0.35;
      }
    }, 25);

    this.walkTo(near ?? new THREE.Vector3(1.0, 0, 0.4), () => {
      this.dog.setAction("eat", 1.5);
      this.spawnHeartParticles(this.dog.group.position.clone().add(new THREE.Vector3(0, 1.2, 0)));
      if (this.onToyClicked) this.onToyClicked();
    });
  }

  /**
   * Toggle Ceiling Lamp On/Off
   */
  public toggleCeilingLamp() {
    this.isLampOn = !this.isLampOn;
    sound.playLightSwitch();

    if (this.ceilingLampLight) {
      this.ceilingLampLight.visible = this.isLampOn;
    }
    if (this.lampBulbMesh) {
      (this.lampBulbMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = this.isLampOn ? 1.0 : 0.05;
    }
  }

  /**
   * Update Bed Colors in real-time
   */
  public updateBedColors(colors: BedColors) {
    this.bedColors = { ...colors };
    if (this.bedCushionMesh) {
      (this.bedCushionMesh.material as THREE.MeshStandardMaterial).color.set(colors.cushion);
    }
    if (this.bedFrameMesh) {
      (this.bedFrameMesh.material as THREE.MeshStandardMaterial).color.set(colors.frame);
    }
    if (this.bedBlanketMesh) {
      (this.bedBlanketMesh.material as THREE.MeshStandardMaterial).color.set(colors.blanket);
    }
  }

  /**
   * Update House Toy model
   */
  public updateHouseToy(toy: "bone" | "duck" | "bear" | "ball") {
    this.currentToy = toy;
    this.rebuildToyMesh();
  }

  private start() {
    const animate = () => {
      if (this.isDestroyed) return;
      this.animFrameId = requestAnimationFrame(animate);

      const delta = Math.min(this.clock.getDelta(), 0.1);
      const elapsed = this.clock.getElapsedTime();

      // Update Dog skeletal animations
      this.dog.update(delta, elapsed);

      // Stair-climb animation
      this.updateClimb(delta);

      // Physics & Fetch AI
      this.updatePhysics(delta);

      // Particle system
      this.updateParticles(delta);

      // Tree regrowth + soup-ready beacon bob
      this.updateTreeRespawns();

      // Floating marker over the grabbed edit-mode object
      this.updateSelectionMarker(elapsed);

      // Rain / snow weather particles
      this.updatePrecipitationMotion(delta, elapsed);

      // Kitchen pot steam + soup bubble animation
      if (this.kitchenGroup.visible) {
        const t = elapsed;
        this.potSteamGroup.children.forEach((puff, i) => {
          puff.position.y = 0.1 + ((t * 0.45 + i * 0.3) % 1.2);
          const s = 0.7 + ((t * 0.45 + i * 0.3) % 1.2) * 0.6;
          puff.scale.set(s, s, s);
          (puff as THREE.Mesh).position.x = Math.sin(t * 1.4 + i * 1.7) * 0.14;
        });
        const soup = this.potGroup.getObjectByName("soupSurface");
        if (soup) {
          soup.position.y = 0.47 + Math.sin(t * 5.0) * 0.008;
          soup.scale.set(1 + Math.sin(t * 3.2) * 0.015, 1, 1 + Math.cos(t * 3.2) * 0.015);
        }
      }

      // Camera follow
      if (this.followDog) {
        this.updateCameraPosition();
      }

      this.renderer.render(this.scene, this.camera);
    };

    animate();
  }

  public destroy() {
    this.isDestroyed = true;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
    }
    this.clearLongPress();
    window.removeEventListener("resize", this.handleResize);

    // Dispose Three.js objects
    this.scene.clear();
    this.renderer.dispose();
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
