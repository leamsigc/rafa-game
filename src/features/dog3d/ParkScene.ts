import * as THREE from "three";
import { Dog3D } from "./DogModel";
import { DogAction, DogBreed, BedColors, HouseViewMode } from "../../types/pet";
import { sound } from "../../utils/audio";

export type TimeOfDay = "day" | "sunset" | "night";

export interface BallPhysics {
  active: boolean;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  bounces: number;
  inDogMouth: boolean;
}

export class ParkScene {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  public dog: Dog3D;

  // View Mode: Outdoor Park vs Cozy House Interior
  public viewMode: HouseViewMode = "park";
  private parkGroup: THREE.Group = new THREE.Group();
  private houseGroup: THREE.Group = new THREE.Group();

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

  // House Room Interior elements
  private roomFloorMesh!: THREE.Mesh;
  private houseDoorMesh!: THREE.Mesh;

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
  public onDogMoved?: (target: THREE.Vector3) => void;

  constructor(
    container: HTMLElement,
    breed: DogBreed = "golden",
    collarColor: string = "#e11d48",
    initialBedColors?: BedColors,
    initialToy: "bone" | "duck" | "bear" | "ball" = "bone",
    initialAccessory?: string
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

    // 6. House Room Interior (Walls, ceiling, lamp, bed, toy)
    if (initialBedColors) {
      this.bedColors = { ...initialBedColors };
    }
    if (initialToy) {
      this.currentToy = initialToy;
    }
    this.setupHouseRoom();

    // 7. Click-to-Walk Ripple Indicator
    this.setupWalkMarker();

    // 8. Add Groups to Scene
    this.scene.add(this.parkGroup);
    this.scene.add(this.houseGroup);
    this.houseGroup.visible = false; // Initially outdoors

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

  private setupSky() {
    const skyGeom = new THREE.SphereGeometry(60, 32, 24);
    const skyMat = new THREE.MeshBasicMaterial({
      color: 0x93c5fd,
      side: THREE.BackSide,
    });
    this.skyDome = new THREE.Mesh(skyGeom, skyMat);
    this.scene.add(this.skyDome);
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
    const bowlGroup = new THREE.Group();
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

    this.scene.add(bowlGroup);
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

  private buildFlora() {
    const treeMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });
    const leafMat1 = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.8 });
    const leafMat2 = new THREE.MeshStandardMaterial({ color: 0x388e3c, roughness: 0.8 });

    const treePositions = [
      [-10, 0, -8],
      [11, 0, -8],
      [-12, 0, 4],
      [12, 0, 7],
      [-8, 0, 10],
    ];

    treePositions.forEach(([x, y, z]) => {
      const tree = new THREE.Group();
      tree.position.set(x, y, z);

      // Trunk
      const trunkGeom = new THREE.CylinderGeometry(0.35, 0.5, 3.2, 8);
      const trunk = new THREE.Mesh(trunkGeom, treeMat);
      trunk.position.y = 1.6;
      trunk.castShadow = true;
      tree.add(trunk);

      // Clustered canopy
      const canopy1 = new THREE.Mesh(new THREE.SphereGeometry(1.8, 12, 12), leafMat1);
      canopy1.position.set(0, 3.8, 0);
      canopy1.castShadow = true;
      tree.add(canopy1);

      const canopy2 = new THREE.Mesh(new THREE.SphereGeometry(1.4, 10, 10), leafMat2);
      canopy2.position.set(0.6, 4.5, 0.4);
      canopy2.castShadow = true;
      tree.add(canopy2);

      this.scene.add(tree);
    });

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

    // 6. Dog Bed (3 customizable parts: frame, cushion, blanket)
    this.setupDogBed();

    // 7. House Toy (bone, duck, bear, ball)
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
    this.bedGroup.position.set(-1.8, 0, -1.2);
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
    this.houseGroup.add(this.bedGroup);
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

  private setupInputEvents() {
    const dom = this.renderer.domElement;

    dom.addEventListener("pointerdown", (e) => {
      this.isDragging = true;
      this.prevMouseX = e.clientX;
      this.prevMouseY = e.clientY;
      this.startPointerX = e.clientX;
      this.startPointerY = e.clientY;
    });

    window.addEventListener("pointermove", (e) => {
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

    window.addEventListener("pointerup", (e) => {
      if (!this.isDragging) return;
      this.isDragging = false;

      const distMoved = Math.hypot(e.clientX - this.startPointerX, e.clientY - this.startPointerY);
      if (distMoved < 8) {
        this.handleSceneClick(e.clientX, e.clientY);
      }
    });

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
      // 2. House Mode Interactivity
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
      // A. Check Doghouse Exterior Click -> Enter house!
      if (this.dogHouseExteriorGroup) {
        const houseHits = raycaster.intersectObject(this.dogHouseExteriorGroup, true);
        if (houseHits.length > 0) {
          this.enterHouse();
          return;
        }
      }

      // B. Check Ground Lawn Click -> Walk to spot!
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
    if (time === "day") {
      this.ambientLight.intensity = 0.45;
      this.ambientLight.color.setHex(0xffffff);
      this.hemiLight.color.setHex(0x87ceeb);
      this.hemiLight.groundColor.setHex(0x4a8505);
      this.hemiLight.intensity = 0.6;
      this.sunLight.intensity = 1.3;
      this.sunLight.color.setHex(0xfffaed);
      (this.skyDome.material as THREE.MeshBasicMaterial).color.setHex(0x93c5fd);
      this.scene.fog = new THREE.FogExp2(0xd6eaf8, 0.015);
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
      (this.skyDome.material as THREE.MeshBasicMaterial).color.setHex(0xf472b6);
      this.scene.fog = new THREE.FogExp2(0xfbcfe8, 0.02);
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
      (this.skyDome.material as THREE.MeshBasicMaterial).color.setHex(0x0f172a);
      this.scene.fog = new THREE.FogExp2(0x0f172a, 0.025);
      this.lanternLight.intensity = 4.0;
    }
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

      // Move toward ball
      const speed = 4.2;
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

      const speed = 3.6;
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

        const walkSpeed = 3.2;
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
    let clampedX = target.x;
    let clampedZ = target.z;

    if (this.viewMode === "house") {
      // Clamp within house interior bounds
      clampedX = THREE.MathUtils.clamp(target.x, -3.2, 3.2);
      clampedZ = THREE.MathUtils.clamp(target.z, -3.2, 3.2);
    } else {
      // Clamp within outdoor park fence bounds
      clampedX = THREE.MathUtils.clamp(target.x, -12.0, 12.0);
      clampedZ = THREE.MathUtils.clamp(target.z, -12.0, 12.0);
    }

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
   * Enter Dog House (Transitions from Park to Room Interior with Ceiling & Lamp)
   */
  public enterHouse() {
    if (this.viewMode === "house") return;
    this.viewMode = "house";

    this.parkGroup.visible = false;
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
    if (this.onHouseEntered) {
      this.onHouseEntered();
    }
  }

  /**
   * Exit Dog House (Returns back to outdoor park)
   */
  public exitToPark() {
    if (this.viewMode === "park") return;
    this.viewMode = "park";

    this.houseGroup.visible = false;
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
    if (this.viewMode !== "house") {
      this.enterHouse();
    }

    const bedTarget = new THREE.Vector3(-1.8, 0, -1.2);
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
      this.dog.group.position.set(-0.8, 0, -0.6);
      this.dog.group.rotation.y = Math.PI * 0.75;
    }
  }

  /**
   * Play with House Toy: Dog walks to toy and plays
   */
  public playWithToy() {
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

    this.walkTo(new THREE.Vector3(1.0, 0, 0.4), () => {
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

      // Physics & Fetch AI
      this.updatePhysics(delta);

      // Particle system
      this.updateParticles(delta);

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
    window.removeEventListener("resize", this.handleResize);

    // Dispose Three.js objects
    this.scene.clear();
    this.renderer.dispose();
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
