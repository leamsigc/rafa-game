import * as THREE from "three";
import { Dog3D } from "./DogModel";
import { DogAction, DogBreed, BedColors, HouseViewMode, HouseRoom } from "../../types/pet";
import type { TabletopGameId } from "../tabletop/tabletopData";
import { getCurrentSeason } from "../seasonal/holidays";
import { sound } from "../../utils/audio";

/**
 * Optional real "Star" logo. Drop the artwork into the repo as
 * `src/assets/star-logo.(png|svg|jpg|webp)` and it is picked up automatically
 * for the third shampoo bottle in the bathroom. Without the file the bottle
 * falls back to a drawn white star + "Star".
 */
const STAR_LOGO_URL = (() => {
  const mods = import.meta.glob(
    ["../../assets/star-logo.*", "../../assets/images/star-logo.*"],
    {
      eager: true,
      query: "?url",
      import: "default",
    }
  ) as Record<string, string>;
  return Object.values(mods)[0];
})();

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

/** Living room footprint in world units. Floors must span at least this far. */
const HOUSE_ROOM_SIZE = 10.0;

/**
 * A strolling city dog NPC: wanders inside a little circle around its home
 * spot (in the fountain park), waits, then strolls somewhere new. It only
 * speaks "woof" — the bubble reveals what the barks actually mean.
 */
interface CityNpc {
  model: Dog3D;
  name: string;
  home: THREE.Vector3;
  radius: number;
  target: THREE.Vector3 | null;
  /** Seconds left before it picks a new spot. */
  wait: number;
  speed: number;
  /** Woof lines + their doggy "translation". */
  lines: { woof: string; meaning: string }[];
  /** Extra lines while the birthday party is on (hats + big scream). */
  partyLines: { woof: string; meaning: string }[];
  lineIdx: number;
  /** Random idle barks. */
  barkCooldown: number;
}

export class ParkScene {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  public dog: Dog3D;

  // View Mode: Outdoor Park vs Cozy House Interior (multi-room) + City
  public viewMode: HouseViewMode = "park";
  public houseRoom: HouseRoom = "living";
  private parkGroup: THREE.Group = new THREE.Group();
  private houseGroup: THREE.Group = new THREE.Group();
  private kitchenGroup: THREE.Group = new THREE.Group();
  private hallwayGroup: THREE.Group = new THREE.Group();
  private upstairsGroup: THREE.Group = new THREE.Group();
  private bathroomGroup: THREE.Group = new THREE.Group();
  private cityGroup: THREE.Group = new THREE.Group();

  // The little car (parked in front of the house — drives to the City!)
  private carGroup: THREE.Group = new THREE.Group();
  private carWheels: THREE.Object3D[] = [];
  private carRide: {
    phase: "none" | "hopIn" | "driveToCity" | "cityDrive" | "driveHome" | "highwayToCity" | "lotPullIn" | "highwayHome" | "homeArrival";
    midwayFired: boolean;
  } = {
    phase: "none",
    midwayFired: false,
  };
  private cinematicCam: boolean = false;
  // Side-view tracking cam: watch the 3D car drive from the side (highway)
  private sideCam: boolean = false;
  // ---- Car sat-nav: choose the stop before driving off -------------------
  // The dashboard sat-nav pops up after Happy walks to the car and offers
  // two stops: the Supermarket lot or the new lot BEHIND the Cake Store.
  public carDestination: "supermarket" | "cakestore" = "supermarket";
  /** Where the car is currently parked in the city (picks the way home). */
  private carParkedLot: "supermarket" | "cakestore" = "supermarket";
  private satNavPending = false;
  public onCarSatNav?: () => void;
  public onCarRideMidway?: () => void;
  public onArrivedInCity?: () => void;
  public onCarReturnMidway?: () => void;
  public onArrivedHome?: () => void;
  public onSupermarketClicked?: () => void;
  public onGymClicked?: () => void;
  public onMultiplayerMachineClicked?: () => void;

  // The little MULTIPLAYER machine on the path (half-spiral staircase + booth)
  private multiplayerMachineGroup: THREE.Group = new THREE.Group();
  private mpMachinePulse: number = 0;
  private mpScreenMat: THREE.MeshStandardMaterial | null = null;

  // City buildings (clickable: supermarket + gym)
  private supermarketGroup: THREE.Group = new THREE.Group();
  private gymGroup: THREE.Group = new THREE.Group();
  private gymDumbbell: THREE.Group = new THREE.Group();
  private cityGroundMesh!: THREE.Mesh;

  // Supermarket sliding glass doors + the walk-in choreography
  private supermarketDoorL: THREE.Group | null = null;
  private supermarketDoorR: THREE.Group | null = null;
  private supermarketDoorProgress = 0; // 0 closed → 1 slid fully open
  private supermarketDoorTarget = 0;
  private supermarketState: "idle" | "walkToDoor" | "stepIn" = "idle";
  private supermarketEntryTimeout = 0;

  // ---- The Birthday Cake Store (pink house on the extended city road) ----
  private cakeStoreGroup: THREE.Group = new THREE.Group();
  private cakeStoreInteriorGroup: THREE.Group = new THREE.Group();
  private cakeStoreFloorMesh!: THREE.Mesh;
  private cakeStoreDoorMesh!: THREE.Mesh;
  private cakeStoreInnerDoorMesh!: THREE.Mesh;
  private cakeCandleFlame: THREE.Mesh | null = null;
  private storeDog: Dog3D | null = null;
  private storeCounterGroup: THREE.Group = new THREE.Group();
  private storeDogBubble: THREE.Sprite | null = null;
  private storeDogBubbleTimer = 0;
  public onCakeStoreClicked?: () => void;
  public onStoreDogTalked?: () => void;
  public onCakeStoreExited?: () => void;

  // ---- Strolling city dog NPCs in the fountain park (they only WOOF!) ----
  private cityNpcs: CityNpc[] = [];
  private cityBubble: THREE.Sprite | null = null;
  private cityBubbleTimer = 0;
  private npcTalkingIdx = -1;

  // ---- Birthday party mode (party hats, balloons, group scream) ----
  private birthdayMode: boolean = false;
  private partyGroup: THREE.Group = new THREE.Group();
  private partyScreamDone: boolean = false;
  private partyBubble: THREE.Sprite | null = null;
  private partyBubbleTimer = 0;
  public onPartyScream?: () => void;

  // Happy's own birthday bubbles ("HAPPY Birthday!" / "Drive to the city!")
  private happyBubble: THREE.Sprite | null = null;
  private happyBubbleTimer = 0;
  private happyBubbleIdx = 0;

  // Seasonal holiday decorations (pumpkins, gifts, flags...)
  private holidayDecorGroup: THREE.Group = new THREE.Group();
  public holiday: string = "none";

  // Bedroom cozy lamp + the ARCADE MACHINE (portal to the Galaxy Arcade)
  private bedLampShade!: THREE.Mesh;
  private bedLampLight!: THREE.PointLight;
  public bedLampOn: boolean = true;
  private bedroomArcadeGroup: THREE.Group = new THREE.Group();

  // Galaxy Arcade world (a whole different dimension of arcade games!)
  private galaxyGroup: THREE.Group = new THREE.Group();
  private arcadeMachines: THREE.Group[] = [];
  private arcadeMachinePos: Record<string, THREE.Vector3> = {};
  private arcadeExitGroup: THREE.Group = new THREE.Group();
  private arcadeReturnTo: "upstairs" | "park" = "upstairs";
  private arcadeFloorMesh!: THREE.Mesh;
  /** One-shot bounce/flash when a cabinet is pressed. */
  private arcadePulse: { target: THREE.Object3D; t: number } | null = null;
  private arcadePulseScreens: THREE.MeshStandardMaterial[] = [];
  public onArcadeClicked?: () => void;
  public onArcadeGameSelected?: (gameId: string) => void;
  public onArcadeExitClicked?: () => void;
  // Camera tween (zoom-into-the-machine portal effect)
  private camTween: {
    active: boolean;
    t: number;
    dur: number;
    fromPos: THREE.Vector3;
    toPos: THREE.Vector3;
    lookAt: THREE.Vector3;
    onDone?: () => void;
  } = { active: false, t: 0, dur: 1, fromPos: new THREE.Vector3(), toPos: new THREE.Vector3(), lookAt: new THREE.Vector3() };

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
  // Park trees (pure scenery — see buildFlora) + distant forest treeline.
  // Trees are never interactive: they cannot be chopped or picked in ANY
  // world, and hidden copies in the City / Galaxy Arcade are unreachable.
  private treeGroups: THREE.Group[] = [];
  private forestBorderGroup: THREE.Group = new THREE.Group();
  // Cooking-ready beacon above the dog house (red highlight + pot icon)
  private cookBeaconGroup: THREE.Group = new THREE.Group();
  private cookBeaconVisible: boolean = false;
  public onCookBeaconClicked?: () => void;
  // Overworld tabletop (round table + chess / tic-tac-toe / four-wins packages)
  private tabletopTableGroup: THREE.Group = new THREE.Group();
  public onTableClicked?: () => void;
  // Bedroom closet (wardrobe) — press to open the hat wardrobe
  private upstairsClosetGroup: THREE.Group = new THREE.Group();
  public onClosetClicked?: () => void;
  // When a full-screen React overlay (tabletop games / wardrobe) owns the
  // screen, scene clicks are gated so board taps never leak into the world.
  public inputEnabled: boolean = true;
  // In-world tabletop board games (3D chess / tic-tac-toe / four-wins on the
  // round table, played in the real garden with live fog, wind & weather).
  public activeTabletopGame: TabletopGameId | null = null;
  public onTabletopCell?: (payload: { r: number; c: number; col: number; g: string }) => void;
  private tabletopBoardGroup = new THREE.Group();
  private tabletopBoardGroupAdded = false;
  private tabletopPackageMeshes: THREE.Object3D[] = [];
  private tabletopChessPieces = new Map<number, THREE.Object3D>();
  /** In-flight board animation: piece leap/hover/smash, or the queen's kick. */
  private ttAnim: {
    phase: "leap" | "hover" | "smash" | "queen" | "kick" | "slide";
    t: number;
    dur: number;
    actor: THREE.Object3D;
    from: THREE.Vector3;
    to: THREE.Vector3;
    hoverY: number;
    victim: THREE.Object3D | null;
    victimColor: number;
    kingCapture: boolean;
    queen: THREE.Object3D | null;
    queenFrom: THREE.Vector3;
    queenTo: THREE.Vector3;
  } | null = null;
  /** Flying debris from a smashed piece. */
  private ttBits: {
    mesh: THREE.Mesh;
    vel: THREE.Vector3;
    spin: THREE.Vector3;
    life: number;
  }[] = [];
  /** Happy's opponent's queen (the white queen) — she delivers the kick. */
  private ttWhiteQueen: THREE.Object3D | null = null;
  private tabletopEmojiCache = new Map<string, THREE.Texture>();
  private tabletopTokens: {
    mesh: THREE.Mesh;
    vy: number;
    restY: number;
    bounces: number;
    active: boolean;
  }[] = [];
  // Bedroom wardrobe: pin the camera on Happy for the 3D hat preview.
  private wardrobeCamLock = false;
  private wardrobeBackPanel: THREE.Mesh | null = null;
  private savedDogPosBeforeTabletop: THREE.Vector3 | null = null;
  private savedDogRotBeforeTabletop = 0;
  // Weather system (sunny / rainy / snowy)
  public weather: WeatherType = "sunny";
  public weatherSpeedFactor: number = 1.0;
  // Seasonal ambient particles: ❄️ snow at Christmas, 🍃 leaves/pollen in
  // spring — visual environmental feedback beyond the HUD widget.
  private seasonPoints: THREE.Points | null = null;
  private seasonVel: Float32Array | null = null;
  private seasonKind: "none" | "snow" | "leaves" = "none";
  // The forest highway chunk (the 3D side-view drive between home & city)
  private highwayGroup: THREE.Group = new THREE.Group();
  public onCityApproach?: () => void;
  public onHomeApproach?: () => void;
  // Snow accumulation: while it snows, the ground slowly turns white
  // (0 = green lawn, 1 = fully blanketed). Melts back when it clears.
  private snowCoverage: number = 0;
  private readonly SNOW_COLOR = new THREE.Color(0xf4f8fb);
  private readonly GRASS_SUNNY = new THREE.Color(0xffffff);
  private readonly GRASS_RAINY = new THREE.Color(0x9fb3a8);
  private precipPoints: THREE.Points | null = null;
  private precipVel: Float32Array | null = null;
  private precipKind: "none" | "rain" | "snow" = "none";
  // Sticky snowflakes: every flake that lands leaves a little white splat
  // on the ground, so the world slowly blankets over in front of you.
  private snowSplats: THREE.Points | null = null;
  private snowSplatCursor = 0;
  private snowSplatTimer = 0;

  // House Room Interior elements (Living Room)
  private roomFloorMesh!: THREE.Mesh;
  private houseDoorMesh!: THREE.Mesh;

  // Kitchen Room elements (second house room)
  private kitchenFloorMesh!: THREE.Mesh;
  private potGroup: THREE.Group = new THREE.Group();
  private potSteamGroup: THREE.Group = new THREE.Group();

  // Hallway elements (connects living <-> kitchen, stairs to upstairs)
  private hallwayFloorMesh!: THREE.Mesh;
  private stairsGroup: THREE.Group = new THREE.Group();
  private stairsMatMesh!: THREE.Mesh;
  private readonly STAIR_BASE = new THREE.Vector3(2.3, 0, 4.1);
  private readonly STAIR_TOP = new THREE.Vector3(2.3, 2.8, -0.2);

  // Upstairs bedroom elements (wider than deep)
  private upstairsFloorMesh!: THREE.Mesh;

  // Bathroom (new room off the hallway — shower, toilet, bath + soap shelf)
  private bathroomFloorMesh!: THREE.Mesh;
  private bathtubGroup: THREE.Group = new THREE.Group();
  private toiletGroup: THREE.Group = new THREE.Group();
  private soapShelfGroup: THREE.Group = new THREE.Group();
  private readonly BATHTUB_CENTER = new THREE.Vector3(-3.0, 0.14, -3.6);
  private inBathtub: boolean = false;

  // Bath-time routine: pick a shampoo → squeeze → rub → rinse with the shower.
  private bathStep: "idle" | "soap" | "lather" | "rinse" = "idle";
  private bathKind: "mens" | "kids" | "star" = "mens";
  private bathBottle: THREE.Mesh | null = null;
  private bathStream: THREE.Mesh | null = null;
  private foamGroup: THREE.Group = new THREE.Group();
  private foamBlobs: THREE.Mesh[] = [];
  private foamBuilt = false;
  private bathAnim: {
    kind: "float" | "squeeze" | "rinse";
    t: number;
    dur: number;
    from: THREE.Vector3;
    to: THREE.Vector3;
  } | null = null;
  private showerHeadGroup: THREE.Group = new THREE.Group();
  private showerGroup: THREE.Group = new THREE.Group();
  private showerHose: THREE.Mesh | null = null;
  private showerSpray: THREE.Mesh | null = null;
  private showerDetached = false;
  private showerReturnTo = new THREE.Vector3(-2.4, 2.14, -4.35);
  public onBathEvent?: (step: "soap" | "rub" | "rinse" | "done") => void;

  // Black doorways: every room exit is a black mat + a solid black wall panel  // that Happy walks through, announced per destination room.
  private doorways: {
    target: HouseRoom;
    label: string;
    mat: THREE.Mesh;
    panel: THREE.Mesh;
    /** The room group this doorway belongs to (hidden rooms are skipped). */
    owner: THREE.Group;
    /** Unit vector pointing from the panel out into the room (approach axis). */
    roomDir: THREE.Vector3;
  }[] = [];
  private doorWalk: {
    t: number;
    dur: number;
    from: THREE.Vector3;
    to: THREE.Vector3;
    target: HouseRoom;
    label: string;
  } | null = null;
  public onDoorWalkedThrough?: (room: HouseRoom, label: string) => void;

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
  /** Grace period after a throw before Happy may pick the ball up. */
  private fetchGrabDelay = 0;

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

    if (import.meta.env.DEV) {
      (window as unknown as { __parkScene?: ParkScene }).__parkScene = this;
    }

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
    this.setupBathroom();
    this.setupToyCorner();
    this.setupCookBeacon();
    this.setupSelectionMarker();
    // The City (park + supermarket + gym), the little car & the Galaxy Arcade
    this.setupCity();
    this.setupCakeStoreInterior();
    this.buildCar();
    this.setupGalaxyArcade();
    this.setupHighway();
    this.applySeasonParticles();
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
    this.scene.add(this.bathroomGroup);
    this.scene.add(this.cityGroup);
    this.scene.add(this.cakeStoreInteriorGroup);
    this.scene.add(this.galaxyGroup);
    this.houseGroup.visible = false; // Initially outdoors
    this.kitchenGroup.visible = false;
    this.hallwayGroup.visible = false;
    this.upstairsGroup.visible = false;
    this.bathroomGroup.visible = false;
    this.cityGroup.visible = false;
    this.cakeStoreInteriorGroup.visible = false;
    this.galaxyGroup.visible = false;

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

    // MULTIPLAYER machine: half a spiral staircase climbing to a little booth
    this.buildMultiplayerMachine(11.4, 0, 2.5);

    // Dog House Exterior
    this.buildDogHouse(-5, 0, -4);

    // Food & Water bowls on small wooden stand
    this.buildBowls(1.8, 0, -1.2);

    // Park Fencing
    this.buildFence();

    // Trees & flowering shrubs
    this.buildFlora();

    // Round tabletop table with the chess / tic-tac-toe / four-wins packages
    this.buildTabletopGames();

    // Agility Obstacles (Hurdles & Weave poles)
    this.buildAgilityCourse();

    this.parkGroup.add(this.obstaclesGroup);
    this.scene.add(this.particlesGroup);
  }

  /** Half-spiral staircase rising to a small booth: the MULTIPLAYER machine. */
  private buildMultiplayerMachine(x: number, y: number, z: number) {
    const g = new THREE.Group();
    g.position.set(x, y, z);

    const stepMat = new THREE.MeshStandardMaterial({ color: 0x8b5cf6, roughness: 0.5, metalness: 0.3 });
    const railMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4, metalness: 0.5 });
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.4, metalness: 0.6 });

    // Central pole
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.6, 10), poleMat);
    pole.position.y = 1.3;
    pole.castShadow = true;
    g.add(pole);

    // HALF spiral: steps sweep from angle 0 to PI (only half the circle exists)
    const radius = 0.85;
    const steps = 7;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const angle = Math.PI * t;
      const step = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.1, 0.35), stepMat);
      step.position.set(Math.cos(angle) * radius, 0.18 + t * 1.55, Math.sin(angle) * radius);
      step.rotation.y = -angle;
      step.castShadow = true;
      g.add(step);
      // little rail post on each step
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.32, 6), railMat);
      post.position.set(Math.cos(angle) * (radius + 0.22), 0.42 + t * 1.55, Math.sin(angle) * (radius + 0.22));
      g.add(post);
    }
    // Outer rail ribbon following the half-arc
    const railCurve = new THREE.CatmullRomCurve3(
      Array.from({ length: steps }, (_, i) => {
        const t = i / (steps - 1);
        const a = Math.PI * t;
        return new THREE.Vector3(Math.cos(a) * (radius + 0.22), 0.6 + t * 1.55, Math.sin(a) * (radius + 0.22));
      })
    );
    const rail = new THREE.Mesh(new THREE.TubeGeometry(railCurve, 24, 0.045, 6, false), railMat);
    g.add(rail);

    // Landing platform at the END of the half spiral (top of the arc)
    const landing = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.12, 18), stepMat);
    landing.position.set(-radius * 0.75, 1.85, radius * 0.75);
    landing.castShadow = true;
    g.add(landing);

    // The little machine standing on the landing: booth + glowing screen
    const machine = new THREE.Group();
    machine.position.set(-radius * 0.75, 1.91, radius * 0.75);
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.62, 0.42),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.4 })
    );
    body.position.y = 0.31;
    body.castShadow = true;
    machine.add(body);
    const screenMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.9,
      roughness: 0.2,
    });
    this.mpScreenMat = screenMat;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.3), screenMat);
    screen.position.set(0, 0.4, 0.215);
    machine.add(screen);
    // "MP" flag pole antenna with a little globe
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.45, 6), poleMat);
    antenna.position.y = 0.8;
    machine.add(antenna);
    const bobbin = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xfacc15, emissiveIntensity: 0.5 })
    );
    bobbin.position.y = 1.04;
    machine.add(bobbin);
    g.add(machine);

    g.userData = { type: "mpMachine" };
    g.traverse((o) => {
      o.userData = { type: "mpMachine" };
    });
    this.multiplayerMachineGroup = g;
    this.parkGroup.add(g);
  }

  /** Cedar plank texture used on the dog house walls. */
  private cedarPlankTexture(base: string, dark: string): THREE.CanvasTexture {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 256, 256);
    // Horizontal planks with grain + shadow line between them
    for (let y = 0; y < 256; y += 32) {
      ctx.fillStyle = "rgba(0,0,0,0.16)";
      ctx.fillRect(0, y, 256, 2);
      for (let i = 0; i < 26; i++) {
        ctx.strokeStyle = i % 2 ? "rgba(255,255,255,0.05)" : dark;
        ctx.lineWidth = 1;
        ctx.beginPath();
        const gy = y + 4 + Math.random() * 24;
        ctx.moveTo(0, gy);
        ctx.bezierCurveTo(64, gy + (Math.random() - 0.5) * 3, 192, gy + (Math.random() - 0.5) * 3, 256, gy);
        ctx.stroke();
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    return tex;
  }

  private buildDogHouse(x: number, y: number, z: number) {
    const house = new THREE.Group();
    house.position.set(x, y, z);

    // Walls (warm cedar wood — keeps the cedar plank texture)
    const wallGeom = new THREE.BoxGeometry(2.4, 1.8, 2.8);
    const wallMat = new THREE.MeshStandardMaterial({
      map: this.cedarPlankTexture("#9a3412", "rgba(60,25,10,0.35)"),
      color: 0xffffff,
      roughness: 0.8,
    });
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

  /**
   * Overworld tabletop: a round pedestal table (one central column that
   * splits into four splayed legs) with three board-game packages laid on
   * top — Chess (rectangle), Tic-Tac-Toe (small square) and Four-in-a-Row
   * (wider rectangle). Clicking it opens the Tabletop Games menu.
   */
  private buildTabletopGames() {
    const g = this.tabletopTableGroup;
    g.clear();
    g.position.set(-2.7, 0, -1.7);

    const woodMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.7 });
    const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.7 });

    // Round tabletop
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.76, 0.1, 28), woodMat);
    top.position.y = 1.02;
    top.castShadow = true;
    top.receiveShadow = true;
    g.add(top);

    // Central column running down from the middle of the top
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.72, 14), darkWoodMat);
    column.position.y = 0.6;
    column.castShadow = true;
    g.add(column);

    // The column splits into four splayed legs at the bottom
    const strut = (dx: number, dz: number) => {
      const a = new THREE.Vector3(0, 0.34, 0);
      const b = new THREE.Vector3(dx, 0, dz);
      const dir = new THREE.Vector3().subVectors(b, a);
      const len = dir.length();
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, len, 10), darkWoodMat);
      leg.position.copy(a).addScaledVector(dir, 0.5);
      leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      leg.castShadow = true;
      g.add(leg);
      // Little foot pad where the leg meets the ground
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 10), woodMat);
      foot.position.set(dx, 0.02, dz);
      g.add(foot);
    };
    strut(0.42, 0.42);
    strut(-0.42, 0.42);
    strut(0.42, -0.42);
    strut(-0.42, -0.42);

    // --- The three board-game packages on the tabletop ---
    const surf = 1.07; // tabletop surface height
    const addPackage = (
      w: number,
      d: number,
      h: number,
      x: number,
      z: number,
      color: number,
      accent: number
    ) => {
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color, roughness: 0.5 })
      );
      body.position.set(x, surf + h / 2, z);
      body.castShadow = true;
      g.add(body);
      const lid = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.86, 0.02, d * 0.86),
        new THREE.MeshStandardMaterial({ color: accent, roughness: 0.4 })
      );
      lid.position.set(x, surf + h + 0.012, z);
      lid.rotation.y = 0.02;
      g.add(lid);
      this.tabletopPackageMeshes.push(body, lid);
    };

    // 1. Chess — a rectangle box
    addPackage(0.5, 0.36, 0.1, -0.22, 0.04, 0x334155, 0xe2e8f0);
    // 2. Tic-Tac-Toe — a small square box
    addPackage(0.26, 0.26, 0.08, 0.18, 0.3, 0xf59e0b, 0xfffbeb);
    // 3. Four-in-a-Row — a bigger rectangle, a touch longer than it is wide
    addPackage(0.52, 0.4, 0.11, 0.04, -0.34, 0x2563eb, 0xfde68a);

    // Tag the whole table (top + column + legs + packages) as one clickable.
    g.userData = { type: "tabletopgames" };
    g.traverse((c) => (c.userData = { type: "tabletopgames" }));
    this.parkGroup.add(g);
  }

  /** Bedroom wardrobe: the closet that opens into the hat wardrobe view. */
  private buildUpstairsCloset() {
    const g = this.upstairsClosetGroup;
    g.clear();
    g.position.set(-5.7, 0, 2.3);

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.65 });
    const doorMat = new THREE.MeshStandardMaterial({ color: 0xa16207, roughness: 0.55 });

    // Carcass + cornice
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 2.3, 1.3), bodyMat);
    body.position.y = 1.15;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    const cornice = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 1.42), bodyMat);
    cornice.position.y = 2.35;
    g.add(cornice);

    // Two front doors that face into the room (+X), with golden handles
    [-0.34, 0.34].forEach((dz) => {
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.0, 0.6), doorMat);
      door.position.set(0.34, 1.15, dz);
      door.castShadow = true;
      g.add(door);
      const handle = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 10, 10),
        new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.8, roughness: 0.25 })
      );
      handle.position.set(0.38, 1.15, dz - (dz > 0 ? -0.22 : 0.22));
      g.add(handle);
    });

    // Tag the closet as a single clickable wardrobe.
    g.userData = { type: "closet" };
    g.traverse((c) => (c.userData = { type: "closet" }));
    this.upstairsGroup.add(g);
  }

  // =====================================================================
  //  In-world tabletop games — 3D boards laid on the round table, played in
  //  the live garden (real fog, wind & weather). You stand on the near side
  //  (invisible), Happy waits across the table.
  // =====================================================================
  private readonly TT_TABLE = new THREE.Vector3(-2.7, 0, -1.7);
  private readonly TT_CAM_POS = new THREE.Vector3(-2.7, 1.9, 1.7);
  private readonly TT_CAM_LOOK = new THREE.Vector3(-2.7, 0.85, -2.7);
  private readonly TT_HAPPY = new THREE.Vector3(-2.7, 0, -3.15);
  /** Point every tabletop camera shot orbits around (the middle of the board). */
  private readonly TT_FOCUS = new THREE.Vector3(-2.7, 1.14, -1.7);
  /** Free orbit while a board game is being played — the player can spin and
   *  zoom around the board to scan the position (clamped so the board always
   *  stays in view). */
  private ttSpherical = new THREE.Spherical(1.9, 1.05, 0);
  /** Height of the in-world tabletop board surface (pieces stand on this). */
  private readonly TT_BOARD_TOP = 0.034;

  /** Render an emoji / glyph to a canvas texture for 3D board pieces. */
  private emojiTexture(char: string, tint = ""): THREE.Texture {
    const key = char + tint;
    const cached = this.tabletopEmojiCache.get(key);
    if (cached) return cached;
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, size, size);
    ctx.font = `${tint} ${size * 0.8}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(char, size / 2, size * 0.54);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    this.tabletopEmojiCache.set(key, tex);
    return tex;
  }

  private ttPiecePlane(char: string, w: number): THREE.Mesh {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, w),
      new THREE.MeshBasicMaterial({ map: this.emojiTexture(char), transparent: true })
    );
    m.rotation.x = -Math.PI / 2; // lie flat, face up toward the player
    return m;
  }

  private ttFlatCell(w: number, d: number, color: number, extra = 0.02): THREE.Mesh {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshStandardMaterial({ color, roughness: 0.6 })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.y += extra;
    return m;
  }

  private clearTabletopBoard() {
    const g = this.tabletopBoardGroup;
    g.clear();
    this.tabletopChessPieces.clear();
    this.tabletopTokens.length = 0;
    // Cancel any in-flight piece animation / debris so a restart is clean.
    this.ttAnim = null;
    this.ttBits.length = 0;
    this.ttWhiteQueen = null;
  }

  private setTabletopPackagesVisible(v: boolean) {
    this.tabletopPackageMeshes.forEach((m) => (m.visible = v));
  }

  /** Enter an in-world tabletop game: build the board, seat Happy, focus cam. */
  public enterTabletopGame(gameId: TabletopGameId, onReady?: () => void) {
    this.activeTabletopGame = gameId;
    if (!this.savedDogPosBeforeTabletop) {
      this.savedDogPosBeforeTabletop = this.dog.group.position.clone();
      this.savedDogRotBeforeTabletop = this.dog.group.rotation.y;
    }
    if (!this.tabletopBoardGroupAdded) {
      this.parkGroup.add(this.tabletopBoardGroup);
      this.tabletopBoardGroupAdded = true;
    }
    this.tabletopBoardGroup.position.set(this.TT_TABLE.x, 1.07, this.TT_TABLE.z);
    this.tabletopBoardGroup.visible = true;
    this.setTabletopPackagesVisible(false);
    this.clearTabletopBoard();
    // Start with the board framed from the player's side at a fairly steep
    // angle (so tall pieces never hide the square behind them); the player can
    // drag to orbit and scroll to zoom while they study the position.
    this.ttSpherical.set(2.4, 0.62, 0);
    this.updateCameraPosition();

    // Seat Happy across the table, facing the player side (+Z, toward camera).
    this.dog.group.position.copy(this.TT_HAPPY);
    this.dog.group.rotation.y = 0;
    this.dog.group.scale.setScalar(1);

    if (gameId === "tictactoe") this.buildTicTacToe3D();
    else if (gameId === "chess") this.buildChess3D();
    else this.buildConnectFour3D();

    setTimeout(() => onReady && onReady(), 2000);
  }

  public exitTabletopGame() {
    this.activeTabletopGame = null;
    this.tabletopBoardGroup.visible = false;
    this.clearTabletopBoard();
    this.setTabletopPackagesVisible(true);
    this.onTabletopCell = undefined;
    if (this.savedDogPosBeforeTabletop) {
      this.dog.group.position.copy(this.savedDogPosBeforeTabletop);
      this.dog.group.rotation.y = this.savedDogRotBeforeTabletop;
      this.dog.setAction("idle", 0.5);
      this.savedDogPosBeforeTabletop = null;
    }
  }

  private buildTicTacToe3D() {
    const g = this.tabletopBoardGroup;
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(0.74, 0.03, 0.74),
      new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.7 })
    );
    slab.position.y = 0.015;
    slab.receiveShadow = true;
    g.add(slab);
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++) {
        const pad = this.ttFlatCell(0.2, 0.2, (r + c) % 2 ? 0xfde68a : 0xfef3c7, 0.03);
        pad.position.set((c - 1) * 0.225, 0.032, (r - 1) * 0.225);
        pad.userData = { type: "tabletopCell", g: "ttt", r, c, col: c };
        g.add(pad);
      }
  }

  public tttPlace(r: number, c: number, who: 0 | 1, you: string, happy: string) {
    const mesh = this.ttPiecePlane(who === 0 ? you : happy, 0.24);
    mesh.position.set((c - 1) * 0.225, 0.075, (r - 1) * 0.225);
    mesh.userData = { tabletopPiece: true, r, c };
    (mesh.material as THREE.MeshBasicMaterial).opacity = 0;
    this.tabletopBoardGroup.add(mesh);
    // rise-in as Happy "builds" it
    let t = 0;
    const rise = () => {
      t += 0.06;
      const s = Math.min(1, t);
      mesh.scale.setScalar(0.4 + s * 0.6);
      (mesh.material as THREE.MeshBasicMaterial).opacity = s;
      if (s < 1) requestAnimationFrame(rise);
    };
    rise();
  }

  /**
   * One real 3D chess piece (pawn / rook / knight / bishop / queen / king),
   * built from turned, rounded primitives so the whole set reads as sculpted
   * models standing on the board — no flat glyph decals.
   */
  private makeChessPiece(type: string, white: boolean): THREE.Group {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: white ? 0xf3ecdd : 0x25252c,
      roughness: 0.34,
      metalness: 0.06,
    });
    const cyl = (rt: number, rb: number, h: number) =>
      new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 20), mat);
    const sph = (r: number, seg = 18) => new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg), mat);
    const cone = (r: number, h: number) => new THREE.Mesh(new THREE.ConeGeometry(r, h, 20), mat);
    const box = (w: number, h: number, d: number) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    const at = (m: THREE.Mesh, y: number, x = 0, z = 0) => {
      m.position.set(x, y, z);
      m.castShadow = true;
      g.add(m);
      return m;
    };

    // Shared turned foot.
    at(cyl(0.028, 0.031, 0.014), 0.007);

    switch (type) {
      case "p": // pawn
        at(cyl(0.014, 0.02, 0.026), 0.027);
        at(sph(0.0135, 16), 0.05);
        at(sph(0.0125, 16), 0.069);
        break;
      case "r": // rook
        at(cyl(0.017, 0.021, 0.034), 0.031);
        at(cyl(0.023, 0.017, 0.014), 0.056);
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
          at(box(0.013, 0.013, 0.013), 0.069, Math.cos(a) * 0.015, Math.sin(a) * 0.015);
        }
        break;
      case "n": {
        // knight — stylised horse head on a collar
        at(cyl(0.017, 0.021, 0.03), 0.029);
        const neck = at(cyl(0.012, 0.016, 0.038), 0.058, 0, 0.004);
        neck.rotation.x = 0.22;
        const head = at(box(0.026, 0.03, 0.04), 0.082, 0, 0.006);
        head.rotation.x = 0.5;
        at(box(0.018, 0.015, 0.026), 0.09, 0, 0.028); // muzzle
        at(cone(0.006, 0.016), 0.1, -0.009, -0.004); // ears
        at(cone(0.006, 0.016), 0.1, 0.009, -0.004);
        break;
      }
      case "b": // bishop
        at(cyl(0.011, 0.019, 0.03), 0.029);
        at(sph(0.016, 18), 0.055);
        at(cone(0.014, 0.028), 0.075);
        at(sph(0.007, 12), 0.092);
        break;
      case "q": // queen
        at(cyl(0.012, 0.02, 0.032), 0.03);
        at(sph(0.019, 20), 0.058);
        at(cyl(0.022, 0.013, 0.018), 0.079);
        [
          [0.018, 0],
          [-0.018, 0],
          [0, 0.018],
          [0, -0.018],
        ].forEach(([x, z]) => at(sph(0.0065, 10), 0.093, x, z));
        at(sph(0.008, 12), 0.098);
        break;
      case "k": // king
      default:
        at(cyl(0.012, 0.02, 0.032), 0.03);
        at(sph(0.019, 20), 0.058);
        at(cyl(0.021, 0.013, 0.02), 0.08);
        at(box(0.01, 0.03, 0.01), 0.098); // cross
        at(box(0.024, 0.009, 0.01), 0.102);
        break;
    }
    return g;
  }

  private buildChess3D() {
    const g = this.tabletopBoardGroup;
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(0.94, 0.032, 0.94),
      new THREE.MeshStandardMaterial({ color: 0x5b3a1e, roughness: 0.7 })
    );
    slab.position.y = 0.016;
    slab.receiveShadow = true;
    g.add(slab);
    const size = 0.1125;
    const stepped = size + 0.004;
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++) {
        const sq = this.ttFlatCell(size, size, (r + c) % 2 ? 0x8d5524 : 0xf0d9b5);
        sq.position.set((c - 3.5) * stepped, 0.0335, (r - 3.5) * stepped);
        sq.userData = { type: "tabletopCell", g: "chess", r, c, col: c };
        g.add(sq);
      }
    const back: string[] = ["r", "n", "b", "q", "k", "b", "n", "r"];
    const put = (r: number, c: number, t: string, who: 0 | 1) => {
      const mesh = this.makeChessPiece(t, who === 0);
      mesh.position.set((c - 3.5) * stepped, this.TT_BOARD_TOP, (r - 3.5) * stepped);
      mesh.userData = { tabletopPiece: true, r, c, pt: t, wt: who === 0 };
      g.add(mesh);
      this.tabletopChessPieces.set(r * 8 + c, mesh);
      if (who === 0 && t === "q") this.ttWhiteQueen = mesh;
    };
    for (let c = 0; c < 8; c++) {
      put(0, c, back[c], 1);
      put(1, c, "p", 1);
      put(6, c, "p", 0);
      put(7, c, back[c], 0);
    }
  }

  /**
   * Snap any in-flight board animation to its finished state. Called before a
   * new move starts so a quick reply can never strand a piece mid-air (or
   * leave a captured piece sitting on the board).
   */
  private flushTtAnim() {
    const a = this.ttAnim;
    if (!a) return;
    a.actor.position.set(a.to.x, this.TT_BOARD_TOP, a.to.z);
    a.actor.rotation.set(0, 0, 0);
    if (a.victim && a.victim.parent === this.tabletopBoardGroup) {
      this.spawnTtBits(a.victim.position.clone(), a.victimColor, 10);
      this.tabletopBoardGroup.remove(a.victim);
    }
    this.ttAnim = null;
  }

  /** chessMove: move a piece (optionally capturing the one on `to`). */
  public chessMove(frR: number, frC: number, toR: number, toC: number, captured: boolean) {
    this.flushTtAnim();
    const frIdx = frR * 8 + frC;
    const toIdx = toR * 8 + toC;
    const mesh = this.tabletopChessPieces.get(frIdx);
    if (!mesh) return;

    const victim = captured ? this.tabletopChessPieces.get(toIdx) ?? null : null;

    // Bookkeeping is immediate so the rules can never desync from the visuals.
    if (victim) this.tabletopChessPieces.delete(toIdx);
    this.tabletopChessPieces.set(toIdx, mesh);
    this.tabletopChessPieces.delete(frIdx);
    const ud = mesh.userData as { r: number; c: number };
    ud.r = toR;
    ud.c = toC;

    const stepped = 0.1125 + 0.004;
    const to = new THREE.Vector3((toC - 3.5) * stepped, this.TT_BOARD_TOP, (toR - 3.5) * stepped);
    const from = mesh.position.clone();

    if (!victim) {
      this.ttAnim = {
        phase: "slide",
        t: 0,
        dur: 0.28,
        actor: mesh,
        from,
        to,
        hoverY: this.TT_BOARD_TOP,
        victim: null,
        victimColor: 0xffffff,
        kingCapture: false,
        queen: null,
        queenFrom: new THREE.Vector3(),
        queenTo: new THREE.Vector3(),
      };
      return;
    }

    const vU = victim.userData as { pt?: string; wt?: boolean };
    const kingCapture = vU.pt === "k";

    // The queen delivers the finishing kick — unless SHE made the capture.
    const queen = kingCapture && this.ttWhiteQueen && this.ttWhiteQueen !== mesh
      ? this.ttWhiteQueen
      : null;

    let queenFrom = new THREE.Vector3();
    let queenTo = new THREE.Vector3();
    if (queen) {
      queenFrom = queen.position.clone();
      // Take up position in front of the doomed king.
      queenTo = new THREE.Vector3(
        to.x,
        this.TT_BOARD_TOP,
        to.z + (toR < 4 ? stepped * 1.6 : -stepped * 1.6)
      );
    }

    this.ttAnim = {
      phase: "leap",
      t: 0,
      dur: 0.38,
      actor: mesh,
      from,
      to,
      hoverY: this.TT_BOARD_TOP + 0.3,
      victim,
      victimColor: vU.wt ? 0xf3ecdd : 0x25252c,
      kingCapture,
      queen,
      queenFrom,
      queenTo,
    };
    sound.playSqueak();
  }

  /** Tiny cubes that burst out of a smashed piece. */
  private spawnTtBits(pos: THREE.Vector3, color: number, count: number) {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.013, 0.013, 0.013), mat);
      m.position.copy(pos);
      m.position.y += 0.04;
      this.tabletopBoardGroup.add(m);
      this.ttBits.push({
        mesh: m,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 0.9,
          0.45 + Math.random() * 0.75,
          (Math.random() - 0.5) * 0.9
        ),
        spin: new THREE.Vector3(Math.random() * 9, Math.random() * 9, Math.random() * 9),
        life: 0.75 + Math.random() * 0.35,
      });
    }
  }

  private updateTtBits(delta: number) {
    for (let i = this.ttBits.length - 1; i >= 0; i--) {
      const b = this.ttBits[i];
      b.life -= delta;
      b.vel.y -= 3.4 * delta;
      b.mesh.position.addScaledVector(b.vel, delta);
      b.mesh.rotation.x += b.spin.x * delta;
      b.mesh.rotation.y += b.spin.y * delta;
      b.mesh.rotation.z += b.spin.z * delta;
      if (b.life <= 0 || b.mesh.position.y < -0.4) {
        this.tabletopBoardGroup.remove(b.mesh);
        this.ttBits.splice(i, 1);
      }
    }
  }

  /**
   * Drives the board choreography:
   *   leap  → the attacker vaults over to hover above the target
   *   hover → it pirouettes in the air
   *   smash → it slams down and the captured piece bursts into bits
   * and, when a king falls, the queen marches over and kicks him off the table.
   */
  private updateTabletopAnim(delta: number) {
    this.updateTtBits(delta);
    const a = this.ttAnim;
    if (!a) return;
    a.t += delta / a.dur;
    const t = Math.min(1, a.t);

    if (a.phase === "slide") {
      const p = a.actor.position;
      p.x = THREE.MathUtils.lerp(a.from.x, a.to.x, t);
      p.z = THREE.MathUtils.lerp(a.from.z, a.to.z, t);
      p.y = this.TT_BOARD_TOP + Math.sin(t * Math.PI) * 0.09;
      if (t >= 1) {
        p.set(a.to.x, this.TT_BOARD_TOP, a.to.z);
        this.ttAnim = null;
      }
      return;
    }

    if (a.phase === "leap") {
      const p = a.actor.position;
      p.x = THREE.MathUtils.lerp(a.from.x, a.to.x, t);
      p.z = THREE.MathUtils.lerp(a.from.z, a.to.z, t);
      p.y = THREE.MathUtils.lerp(a.from.y, a.hoverY, t) + Math.sin(t * Math.PI) * 0.24;
      a.actor.rotation.y = t * Math.PI * 0.5;
      if (t >= 1) {
        a.phase = "hover";
        a.t = 0;
        a.dur = 0.42;
      }
      return;
    }

    if (a.phase === "hover") {
      a.actor.position.y = a.hoverY + Math.sin(t * Math.PI) * 0.03;
      a.actor.rotation.y = Math.PI * 0.5 + t * Math.PI * 1.5; // the little turn
      if (t >= 1) {
        a.t = 0;
        if (a.kingCapture && a.queen) {
          a.phase = "queen";
          a.dur = 0.45;
        } else if (a.kingCapture) {
          // No queen on the board (or the queen made the capture herself) —
          // boot the king straight off the table.
          a.phase = "kick";
          a.dur = 0.8;
          sound.playRewardFanfare();
        } else {
          a.phase = "smash";
          a.dur = 0.17;
          // Shatter the captured piece on impact.
          if (a.victim) {
            this.spawnTtBits(a.victim.position.clone(), a.victimColor, 12);
            this.tabletopBoardGroup.remove(a.victim);
          }
          sound.playCrunch();
        }
      }
      return;
    }

    if (a.phase === "queen") {
      const q = a.queen!;
      q.position.x = THREE.MathUtils.lerp(a.queenFrom.x, a.queenTo.x, t);
      q.position.z = THREE.MathUtils.lerp(a.queenFrom.z, a.queenTo.z, t);
      q.position.y = this.TT_BOARD_TOP + Math.sin(t * Math.PI) * 0.12;
      if (t >= 1) {
        a.phase = "kick";
        a.t = 0;
        a.dur = 0.8;
        sound.playRewardFanfare();
      }
      return;
    }

    if (a.phase === "kick") {
      // The king is booted off the table, tumbling.
      if (a.victim) {
        const k = a.victim;
        k.position.y = this.TT_BOARD_TOP + Math.sin(t * Math.PI) * 1.1 - t * t * 2.2;
        k.position.z = a.to.z + t * 1.3;
        k.position.x = a.to.x + t * 0.35;
        k.rotation.x += delta * 11;
        k.rotation.z += delta * 7;
      }
      // The capturing piece settles down onto the square.
      const p = a.actor.position;
      p.x = a.to.x;
      p.z = a.to.z;
      p.y = THREE.MathUtils.lerp(a.hoverY, this.TT_BOARD_TOP, Math.min(1, t * 2.2));
      a.actor.rotation.y = Math.PI * 2 * Math.min(1, t * 2.2);
      if (t >= 1) {
        if (a.victim) this.tabletopBoardGroup.remove(a.victim);
        p.set(a.to.x, this.TT_BOARD_TOP, a.to.z);
        a.actor.rotation.y = 0;
        this.ttAnim = null;
      }
      return;
    }

    // "smash" — the attacker slams straight down.
    const p = a.actor.position;
    p.y = THREE.MathUtils.lerp(a.hoverY, this.TT_BOARD_TOP, t);
    a.actor.rotation.y = Math.PI * 2 * t;
    if (t >= 1) {
      a.actor.rotation.y = 0;
      p.set(a.to.x, this.TT_BOARD_TOP, a.to.z);
      this.ttAnim = null;
    }
  }


  private buildConnectFour3D() {
    const g = this.tabletopBoardGroup;
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(0.98, 0.04, 0.72),
      new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.5 })
    );
    slab.position.y = 0.02;
    slab.receiveShadow = true;
    g.add(slab);
    for (let r = 0; r < 6; r++)
      for (let c = 0; c < 7; c++) {
        const hole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.05, 0.05, 0.05, 14),
          new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 })
        );
        hole.position.set((c - 3) * 0.125, 0.03, (r - 2.5) * 0.1);
        hole.userData = { type: "tabletopCell", g: "c4", r, c, col: c };
        g.add(hole);
      }
  }

  /** Drop a connect-four token with a gravity fall + little bounce. */
  public c4Drop(col: number, row: number, who: 0 | 1) {
    const geo = new THREE.CylinderGeometry(0.055, 0.055, 0.05, 18);
    const mat = new THREE.MeshStandardMaterial({
      color: who === 0 ? 0xef4444 : 0xfacc15,
      roughness: 0.35,
      emissive: who === 0 ? 0x7f1d1d : 0x854d0e,
      emissiveIntensity: 0.2,
    });
    const disc = new THREE.Mesh(geo, mat);
    disc.castShadow = true;
    const restY = 0.085;
    disc.position.set((col - 3) * 0.125, 0.95, (row - 2.5) * 0.1);
    disc.userData = { tabletopPiece: true, r: row, c: col };
    this.tabletopBoardGroup.add(disc);
    this.tabletopTokens.push({ mesh: disc, vy: 0, restY, bounces: 0, active: true });
  }

  private updateTabletopTokens(delta: number) {
    for (const t of this.tabletopTokens) {
      if (!t.active) continue;
      t.vy -= 9.5 * delta;
      t.mesh.position.y += t.vy * delta;
      if (t.mesh.position.y <= t.restY) {
        t.mesh.position.y = t.restY;
        if (Math.abs(t.vy) > 1.1) {
          t.vy = -t.vy * 0.42; // bounce
          t.bounces += 1;
        } else {
          t.vy = 0;
          t.active = false;
          t.mesh.position.y = t.restY;
        }
        if (t.bounces > 3) {
          t.vy = 0;
          t.active = false;
          t.mesh.position.y = t.restY;
        }
      }
    }
  }

  /** Flash the winning line of pieces across the board. */
  public tabletopHighlight(cells: { r: number; c: number }[]) {
    const set = new Set(cells.map(({ r, c }) => `${r}-${c}`));
    this.tabletopBoardGroup.children.forEach((ch) => {
      const ud = ch.userData as { tabletopPiece?: boolean; r?: number; c?: number };
      if (ud.tabletopPiece && ud.r != null && ud.c != null) {
        const mat = (ch as THREE.Mesh).material as THREE.MeshStandardMaterial;
        if (mat && set.has(`${ud.r}-${ud.c}`) && mat.emissive) {
          mat.emissive = new THREE.Color(0xffffff);
          mat.emissiveIntensity = 0.7;
        }
      }
    });
  }

  // ===== Bedroom wardrobe: live 3D dog preview via the real model =====
  private wardSavedDogPos = new THREE.Vector3();
  private wardSavedCamPos = new THREE.Vector3();
  private wardSavedLook = new THREE.Vector3();

  public enterWardrobeView(onReady?: () => void) {
    this.wardrobeCamLock = true;
    this.wardSavedDogPos.copy(this.dog.group.position);
    this.wardSavedCamPos.copy(this.camera.position);
    // Stand Happy just in front of the open closet, facing the room.
    this.dog.group.position.set(-4.5, 0, 2.3);
    this.dog.group.rotation.y = Math.PI / 2; // face +X (out of the closet)
    this.dog.setAction("idle", 0.5);
    // Blue back-panel so the closet interior reads blue behind Happy.
    if (!this.wardrobeBackPanel) {
      this.wardrobeBackPanel = new THREE.Mesh(
        new THREE.PlaneGeometry(3, 3),
        new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 1 })
      );
      this.wardrobeBackPanel.rotation.y = Math.PI / 2;
      this.upstairsGroup.add(this.wardrobeBackPanel);
    }
    this.wardrobeBackPanel.position.set(-5.9, 1.5, 2.3);
    this.wardrobeBackPanel.visible = true;
    setTimeout(() => onReady && onReady(), 700);
  }

  public exitWardrobeView() {
    this.wardrobeCamLock = false;
    if (this.wardrobeBackPanel) this.wardrobeBackPanel.visible = false;
    this.dog.group.position.copy(this.wardSavedDogPos);
    this.dog.setAction("idle", 0.5);
  }

  public wardrobeViewReady() {
    return this.wardrobeCamLock;
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

    this.parkGroup.add(fenceGroup); // park-only: it used to linger in the City too
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
    // ---- Park trees: pure scenery (NOT interactive) ----
    // Trees used to be choppable with an axe, which let a stray tap in the
    // City / Galaxy Arcade dimension fell an invisible overworld tree. They
    // are now scenery-only: never registered as editables, never raycast as
    // targets, and never chopped anywhere.
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
    treePositions.forEach(([x, y, z], i) => {
      const baseScale = 0.9 + ((i * 37) % 30) / 100;
      const tree = this.makeOneTree(baseScale, i % 3 === 0);
      tree.position.set(x, y, z);
      const id = `tree${i}`;
      tree.userData = { type: "scenery" };
      tree.traverse((c) => {
        c.userData = { type: "scenery" };
      });
      this.parkGroup.add(tree);
      this.treeGroups.push(tree);
      // NOTE: intentionally NOT registered as editable and NOT tagged as a
      // "tree" hit target — trees are decoration only.
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
      // Parented to the park (NOT the scene) so bushes never poke through the
      // walls of the house rooms, which sit at the same world coordinates.
      this.parkGroup.add(bush);

      // Small blossom
      const fl = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), flowerMat);
      fl.position.set(bx + 0.3, 0.8, bz + 0.2);
      this.parkGroup.add(fl);
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
    // Sized to the room and pushed slightly under the walls, otherwise the
    // sky shows through the gap at the skirting and reads as a white void.
    const floorGeom = new THREE.PlaneGeometry(HOUSE_ROOM_SIZE + 0.6, HOUSE_ROOM_SIZE + 0.6);
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
    // Bigger, cozier rooms with solid walls (DoubleSide so nothing ever
    // looks see-through when the camera grazes a wall).
    const wallHeight = 4.0;
    const roomWidth = HOUSE_ROOM_SIZE;
    const roomDepth = HOUSE_ROOM_SIZE;

    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      roughness: 0.85,
      side: THREE.DoubleSide,
    });
    const wainscotMat = new THREE.MeshStandardMaterial({
      color: 0x9a3412,
      roughness: 0.7,
      side: THREE.DoubleSide,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x78350f,
      roughness: 0.5,
      side: THREE.DoubleSide,
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

    // Seal the doorway with a cozy wooden front door (doggy flap included!)
    // Oversized panel overlaps the wall around the opening so there is NEVER
    // a hairline see-through gap, from any angle.
    const frontDoor = new THREE.Group();
    const doorPanel = new THREE.Mesh(
      new THREE.BoxGeometry(2.56, 2.62, 0.14),
      new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.6 })
    );
    doorPanel.position.set(0, 1.28, 0);
    doorPanel.castShadow = true;
    frontDoor.add(doorPanel);
    // Carved panels
    [0.78, 1.74].forEach((py) => {
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 0.72, 0.03),
        new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.55 })
      );
      panel.position.set(0, py, 0.075);
      frontDoor.add(panel);
    });
    // Doggy flap at the bottom — the pup's own private entrance!
    const flap = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.62, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x3f2a17, roughness: 0.8 })
    );
    flap.position.set(0, 0.36, 0.075);
    frontDoor.add(flap);
    const flapHole = new THREE.Mesh(
      new THREE.CircleGeometry(0.22, 16),
      new THREE.MeshBasicMaterial({ color: 0x1f140e })
    );
    flapHole.position.set(0, 0.36, 0.108);
    frontDoor.add(flapHole);
    // Door knob
    const knob = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.8, roughness: 0.25 })
    );
    knob.position.set(0.86, 1.25, 0.09);
    frontDoor.add(knob);
    // Sits proud of the wall inner face, covering the opening with margin
    frontDoor.position.set(0, 0, roomDepth / 2 - 0.12);
    this.houseGroup.add(frontDoor);

    // Corner posts seal the wall-joint notches so no gaps can be seen
    const cornerGeom = new THREE.BoxGeometry(0.42, wallHeight, 0.42);
    [
      [-roomWidth / 2, -roomDepth / 2],
      [roomWidth / 2, -roomDepth / 2],
      [-roomWidth / 2, roomDepth / 2],
      [roomWidth / 2, roomDepth / 2],
    ].forEach(([x, z]) => {
      const post = new THREE.Mesh(cornerGeom, trimMat);
      post.position.set(x, wallHeight / 2, z);
      this.houseGroup.add(post);
    });

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

    // Black doorway to the hallway: mat on the floor + a black wall panel on
    // the right wall that Happy walks through.
    this.makeBlackDoorway(
      "hallway",
      "hallway",
      this.houseGroup,
      new THREE.Vector3(4.0, 0.02, 2.6),
      new THREE.Vector3(roomWidth / 2 - 0.05, 1.15, 2.6),
      -Math.PI / 2,
      new THREE.Vector3(-1, 0, 0)
    );

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
    const roomWidth = 10.0;
    const roomDepth = 10.0;
    const wallHeight = 4.0;

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
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xffedd5, roughness: 0.85, side: THREE.DoubleSide });
    const backsplashMat = new THREE.MeshStandardMaterial({ color: 0xfdba74, roughness: 0.6, side: THREE.DoubleSide });
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

    // Seal the kitchen doorway with an oversized door + doggy flap —
    // overlaps the wall so no hairline gap is visible from any angle.
    const kitchenDoor = new THREE.Mesh(
      new THREE.BoxGeometry(2.56, 2.62, 0.14),
      new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.6 })
    );
    kitchenDoor.position.set(0, 1.28, roomDepth / 2 - 0.12);
    kitchenDoor.castShadow = true;
    this.kitchenGroup.add(kitchenDoor);
    const kitchenFlap = new THREE.Mesh(
      new THREE.CircleGeometry(0.22, 16),
      new THREE.MeshBasicMaterial({ color: 0x1f140e })
    );
    kitchenFlap.position.set(0, 0.36, roomDepth / 2 - 0.12 + 0.073);
    this.kitchenGroup.add(kitchenFlap);

    // Corner posts to seal the wall joints
    const kCornerGeom = new THREE.BoxGeometry(0.42, wallHeight, 0.42);
    [
      [-roomWidth / 2, -roomDepth / 2],
      [roomWidth / 2, -roomDepth / 2],
      [-roomWidth / 2, roomDepth / 2],
      [roomWidth / 2, roomDepth / 2],
    ].forEach(([x, z]) => {
      const post = new THREE.Mesh(kCornerGeom, wallMat);
      post.position.set(x, wallHeight / 2, z);
      this.kitchenGroup.add(post);
    });

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
    // Counters pushed flush against the (now larger) walls
    mkCounter(-1.6, -4.42, 4.6, 1.0);
    mkCounter(-4.42, -1.2, 1.0, 4.4);
    mkCounter(4.42, -1.2, 1.0, 4.4);

    // Kitchen sink with faucet on the back counter
    const sinkBasin = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.18, 0.6),
      new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.7, roughness: 0.3 })
    );
    sinkBasin.position.set(-1.6, 1.0, -4.42);
    this.kitchenCountersGroup.add(sinkBasin);
    const faucetStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.5, 8),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.25 })
    );
    faucetStem.position.set(-1.6, 1.25, -4.68);
    this.kitchenCountersGroup.add(faucetStem);
    const faucetSpout = new THREE.Mesh(
      new THREE.TorusGeometry(0.14, 0.035, 8, 12, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.25 })
    );
    faucetSpout.position.set(-1.6, 1.45, -4.54);
    faucetSpout.rotation.y = Math.PI / 2;
    this.kitchenCountersGroup.add(faucetSpout);

    // Upper shelves + jars + hanging pans for coziness
    const shelfMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.6 });
    [-2.2, -1.2, -0.2].forEach((sx) => {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.07, 0.35), shelfMat);
      shelf.position.set(sx, 2.3, -4.72);
      this.kitchenShelfGroup.add(shelf);
      const jarColors = [0xfacc15, 0x86efac, 0xfda4af];
      const jar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.11, 0.28, 10),
        new THREE.MeshStandardMaterial({ color: jarColors[Math.abs(Math.floor(sx * 10)) % 3], roughness: 0.4 })
      );
      jar.position.set(sx, 2.48, -4.72);
      jar.castShadow = true;
      this.kitchenShelfGroup.add(jar);
    });
    // Hanging rail with pots + utensils on the right wall
    const railBar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 2.0, 8),
      new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.3 })
    );
    railBar.rotation.z = Math.PI / 2;
    railBar.position.set(4.55, 2.4, -2.4);
    railBar.rotation.set(0, 0, Math.PI / 2);
    this.kitchenShelfGroup.add(railBar);
    [0, 1, 2].forEach((hi) => {
      const pan = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16 - hi * 0.02, 0.16 - hi * 0.02, 0.1, 12),
        new THREE.MeshStandardMaterial({ color: hi === 1 ? 0xb45309 : 0x334155, metalness: 0.6, roughness: 0.4 })
      );
      pan.position.set(4.55, 2.1, -1.7 + hi * 0.7);
      pan.castShadow = true;
      this.kitchenShelfGroup.add(pan);
    });
    // Sunny kitchen window above the sink
    const winFrame = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 1.2, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.5 })
    );
    winFrame.position.set(-1.6, 2.5, -4.9);
    this.kitchenGroup.add(winFrame);
    const winGlass = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 0.95),
      new THREE.MeshBasicMaterial({ color: 0xbfe6f5 })
    );
    winGlass.position.set(-1.6, 2.5, -4.82);
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
    this.kitchenFridgeGroup.position.set(4.3, 1.1, -4.35);
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
    potBody.name = "potBody"; // July 4th Easter egg: gets an American flag texture
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

    // 5. Black doorway back to the hallway (front wall)
    this.makeBlackDoorway(
      "hallway",
      "hallway",
      this.kitchenGroup,
      new THREE.Vector3(0, 0.02, roomDepth / 2 - 1.1),
      new THREE.Vector3(0, 1.15, roomDepth / 2 - 0.05),
      0,
      new THREE.Vector3(0, 0, -1)
    );
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

  /**
   * A "black doorway" — the shared look for every room exit:
   *   • a black mat on the floor you press, and
   *   • a solid black wall panel (a black doorway, not a real door) right
   *     behind it that Happy physically walks into.
   * Pressing either one walks the dog through the black panel and then switches
   * room, announced as "<name> is walking into the <label>".
   */
  private makeBlackDoorway(
    target: HouseRoom,
    label: string,
    group: THREE.Group,
    matPos: THREE.Vector3,
    panelPos: THREE.Vector3,
    rotY: number,
    roomDir: THREE.Vector3
  ) {
    const matGeom = new THREE.PlaneGeometry(1.5, 0.85);
    matGeom.rotateX(-Math.PI / 2);
    const mat = new THREE.Mesh(
      matGeom,
      new THREE.MeshStandardMaterial({ color: 0x0b0b0f, roughness: 0.95 })
    );
    mat.position.copy(matPos);
    mat.rotation.y = rotY;
    mat.receiveShadow = true;
    mat.userData = { type: "black_door" };
    group.add(mat);

    // The black opening itself. Opaque + FrontSide, so the moment Happy steps
    // inside the box he is swallowed by the black face nearest the camera.
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 2.3, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 1, side: THREE.FrontSide })
    );
    panel.position.copy(panelPos);
    panel.rotation.y = rotY;
    panel.castShadow = false;
    panel.receiveShadow = false;
    panel.userData = { type: "black_door" };
    group.add(panel);

    this.doorways.push({ target, label, mat, panel, owner: group, roomDir: roomDir.clone().normalize() });
  }

  private setupHallway() {
    this.hallwayGroup.clear();
    // A ROOMY grand hallway: wide enough to always see where you're walking
    const roomW = 9.6;
    const roomD = 12;
    const wallH = 4.4;

    // Wood flooring hallway runner
    const floorGeom = new THREE.PlaneGeometry(roomW, roomD);
    floorGeom.rotateX(-Math.PI / 2);
    this.hallwayFloorMesh = new THREE.Mesh(
      floorGeom,
      new THREE.MeshStandardMaterial({ map: this.makeWoodFloorTexture(2, 3.5), roughness: 0.6 })
    );
    this.hallwayFloorMesh.receiveShadow = true;
    this.hallwayFloorMesh.userData = { type: "floor" };
    this.hallwayGroup.add(this.hallwayFloorMesh);

    // Wide cozy runner rug down the middle
    const runner = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.03, 10.4),
      new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.95 })
    );
    runner.position.set(-0.9, 0.015, 0);
    runner.receiveShadow = true;
    runner.userData = { type: "floor" };
    this.hallwayGroup.add(runner);
    // Little bone pattern stripes on the runner
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.9 });
    for (let z = -4.4; z <= 4.4; z += 1.6) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.012, 0.14), stripeMat);
      stripe.position.set(-0.9, 0.028, z);
      stripe.userData = { type: "floor" };
      this.hallwayGroup.add(stripe);
    }

    const wallMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.85, side: THREE.DoubleSide });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.6, side: THREE.DoubleSide });
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
      // Crown molding for a comfy home feel
      const crown = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, 0.2), trimMat);
      crown.position.set(x, wallH - 0.06, z);
      crown.rotation.y = rotY;
      this.hallwayGroup.add(crown);
    };
    mkWall(roomW, 0, -roomD / 2, 0);
    mkWall(roomW, 0, roomD / 2, 0);
    mkWall(roomD, -roomW / 2, 0, Math.PI / 2);
    mkWall(roomD, roomW / 2, 0, Math.PI / 2);

    // Corner posts seal the hallway wall joints (no gaps!)
    const hCornerGeom = new THREE.BoxGeometry(0.4, wallH, 0.4);
    [
      [-roomW / 2, -roomD / 2],
      [roomW / 2, -roomD / 2],
      [-roomW / 2, roomD / 2],
      [roomW / 2, roomD / 2],
    ].forEach(([x, z]) => {
      const post = new THREE.Mesh(hCornerGeom, trimMat);
      post.position.set(x, wallH / 2, z);
      this.hallwayGroup.add(post);
    });

    // Ceiling + two warm hanging lamps (bright & cozy)
    const ceil = new THREE.Mesh(
      new THREE.PlaneGeometry(roomW, roomD),
      new THREE.MeshStandardMaterial({ color: 0xfff7ed, roughness: 0.9, side: THREE.DoubleSide })
    );
    ceil.geometry.rotateX(Math.PI / 2);
    ceil.position.y = wallH;
    this.hallwayGroup.add(ceil);
    [2.8, -2.8].forEach((lz) => {
      const lamp = new THREE.PointLight(0xffe9b8, 1.9, 14);
      lamp.position.set(0, wallH - 0.55, lz);
      this.hallwayGroup.add(lamp);
      const shade = new THREE.Mesh(
        new THREE.ConeGeometry(0.34, 0.26, 14, 1, true),
        new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.4, side: THREE.DoubleSide })
      );
      shade.position.set(0, wallH - 0.5, lz);
      this.hallwayGroup.add(shade);
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 10, 10),
        new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffe082, emissiveIntensity: 1.0 })
      );
      bulb.position.set(0, wallH - 0.62, lz);
      this.hallwayGroup.add(bulb);
    });

    // Gallery wall of framed paw portraits (left wall, whole length)
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.5 });
    [-4.2, -2.1, 0, 2.1, 4.2].forEach((z, i) => {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.72, 0.92), frameMat);
      frame.position.set(-roomW / 2 + 0.1, 2.0, z);
      this.hallwayGroup.add(frame);
      const picColors = [0xfbcfe8, 0xbfdbfe, 0xfde68a, 0xbbf7d0, 0xfed7aa];
      const pic = new THREE.Mesh(
        new THREE.PlaneGeometry(0.72, 0.52),
        new THREE.MeshBasicMaterial({ color: picColors[i % picColors.length] })
      );
      pic.position.set(-roomW / 2 + 0.15, 2.0, z);
      pic.rotation.y = Math.PI / 2;
      this.hallwayGroup.add(pic);
      // Little paw dot on each portrait
      const paw = new THREE.Mesh(
        new THREE.CircleGeometry(0.1, 12),
        new THREE.MeshBasicMaterial({ color: 0x78350f })
      );
      paw.position.set(-roomW / 2 + 0.155, 2.0, z);
      paw.rotation.y = Math.PI / 2;
      this.hallwayGroup.add(paw);
    });

    // Wall clock (canvas face with real hour marks)
    const clockCanvas = document.createElement("canvas");
    clockCanvas.width = 128;
    clockCanvas.height = 128;
    const cCtx = clockCanvas.getContext("2d")!;
    cCtx.fillStyle = "#fef3c7";
    cCtx.beginPath();
    cCtx.arc(64, 64, 60, 0, Math.PI * 2);
    cCtx.fill();
    cCtx.strokeStyle = "#78350f";
    cCtx.lineWidth = 8;
    cCtx.stroke();
    cCtx.fillStyle = "#78350f";
    for (let t = 0; t < 12; t++) {
      const a = (t / 12) * Math.PI * 2;
      cCtx.beginPath();
      cCtx.arc(64 + Math.sin(a) * 46, 64 - Math.cos(a) * 46, 4, 0, Math.PI * 2);
      cCtx.fill();
    }
    cCtx.strokeStyle = "#b91c1c";
    cCtx.lineWidth = 5;
    cCtx.beginPath();
    cCtx.moveTo(64, 64);
    cCtx.lineTo(64, 34);
    cCtx.moveTo(64, 64);
    cCtx.lineTo(86, 72);
    cCtx.stroke();
    const clock = new THREE.Mesh(
      new THREE.CircleGeometry(0.42, 24),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(clockCanvas) })
    );
    clock.position.set(0, 2.6, -roomD / 2 + 0.09);
    this.hallwayGroup.add(clock);

    // Console table with a cozy lamp near the living-room end
    const consoleMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.6 });
    const consoleGroup = new THREE.Group();
    const tableTop = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 2.0), consoleMat);
    tableTop.position.y = 0.85;
    consoleGroup.add(tableTop);
    [[-0.35, -0.8], [0.35, -0.8], [-0.35, 0.8], [0.35, 0.8]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.85, 0.08), consoleMat);
      leg.position.set(lx, 0.42, lz);
      consoleGroup.add(leg);
    });
    // Table lamp (glowing)
    const lampBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.1, 0.22, 10),
      new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.5 })
    );
    lampBase.position.set(0, 1.0, 0);
    consoleGroup.add(lampBase);
    const lampShade = new THREE.Mesh(
      new THREE.ConeGeometry(0.2, 0.24, 12, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.4, side: THREE.DoubleSide })
    );
    lampShade.position.set(0, 1.2, 0);
    consoleGroup.add(lampShade);
    const consoleLight = new THREE.PointLight(0xffd9a0, 0.9, 5);
    consoleLight.position.set(0, 1.25, 0);
    consoleGroup.add(consoleLight);
    consoleGroup.position.set(-roomW / 2 + 0.62, 0, 4.6);
    this.hallwayGroup.add(consoleGroup);

    // Leash + collar hooks by the living-room door
    const hookMat = new THREE.MeshStandardMaterial({ color: 0xd6d6d6, metalness: 0.7, roughness: 0.3 });
    [3.9, 4.4].forEach((hz, hi) => {
      const hook = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.02, 8, 12), hookMat);
      hook.position.set(roomW / 2 - 0.1, 1.6, hz);
      this.hallwayGroup.add(hook);
      if (hi === 0) {
        // Hanging leash (curvy rope)
        const leash = new THREE.Mesh(
          new THREE.CylinderGeometry(0.03, 0.03, 0.8, 8),
          new THREE.MeshStandardMaterial({ color: 0xbc4749, roughness: 0.8 })
        );
        leash.position.set(roomW / 2 - 0.12, 1.2, hz);
        leash.rotation.z = 0.15;
        this.hallwayGroup.add(leash);
        const clasp = new THREE.Mesh(
          new THREE.SphereGeometry(0.05, 8, 8),
          new THREE.MeshStandardMaterial({ color: 0xd6d6d6, metalness: 0.8 })
        );
        clasp.position.set(roomW / 2 - 0.18, 0.78, hz);
        this.hallwayGroup.add(clasp);
      } else {
        // Spare collar
        const collar = new THREE.Mesh(
          new THREE.TorusGeometry(0.12, 0.035, 8, 16),
          new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.5 })
        );
        collar.position.set(roomW / 2 - 0.13, 1.44, hz);
        collar.rotation.x = Math.PI / 2;
        this.hallwayGroup.add(collar);
      }
    });

    // Potted plants at both ends for a fresh home vibe
    const potMat = new THREE.MeshStandardMaterial({ color: 0xc2703e, roughness: 0.8 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.8 });
    [[-2.8, -5.2], [2.8, 5.2]].forEach(([px, pz]) => {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.4, 10), potMat);
      pot.position.set(px, 0.2, pz);
      pot.castShadow = true;
      this.hallwayGroup.add(pot);
      for (let l = 0; l < 5; l++) {
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), leafMat);
        leaf.scale.set(0.5, 1.4, 0.5);
        leaf.position.set(px + (Math.random() - 0.5) * 0.3, 0.75 + l * 0.14, pz + (Math.random() - 0.5) * 0.3);
        leaf.castShadow = true;
        this.hallwayGroup.add(leaf);
      }
    });

    // Staircase along the right wall (8 steps climbing toward -z). It hugs
    // the widened wall so the middle of the hall stays free to stroll.
    this.stairsGroup = new THREE.Group();
    const stepMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.6 });
    const stepTopMat = new THREE.MeshStandardMaterial({ color: 0xd6a35c, roughness: 0.55 });
    for (let i = 0; i < 8; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.35, 0.58), stepMat);
      step.position.set(3.55, 0.175 + i * 0.35, 3.9 - i * 0.55);
      step.castShadow = true;
      step.receiveShadow = true;
      this.stairsGroup.add(step);
      const tread = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.05, 0.6), stepTopMat);
      tread.position.set(3.55, 0.35 + i * 0.35, 3.9 - i * 0.55);
      tread.receiveShadow = true;
      this.stairsGroup.add(tread);
    }
    // Wooden handrail
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 4.6), stepMat);
    rail.position.set(2.75, 1.9, 1.9);
    rail.rotation.x = -0.55;
    this.stairsGroup.add(rail);
    for (let i = 0; i < 4; i++) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.1, 0.07), stepMat);
      post.position.set(2.75, 0.9 + i * 0.55, 3.5 - i * 1.05);
      this.stairsGroup.add(post);
    }
    // Dark opening at the top of the stairs (mystery above!)
    const darkOpening = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 1.4),
      new THREE.MeshBasicMaterial({ color: 0x000000 })
    );
    darkOpening.position.set(3.55, 3.35, -0.85);
    this.stairsGroup.add(darkOpening);
    this.stairsGroup.userData = { type: "stairs" };
    this.stairsGroup.traverse((c) => {
      c.userData = { type: "stairs" };
    });
    this.hallwayGroup.add(this.stairsGroup);

    // "UPSTAIRS" mat at the stair base (click to climb!)
    this.stairsMatMesh = this.makeDoorMat("⬆ UPSTAIRS 🐾", "#6d28d9", "#ddd6fe", "stairs", 2.25, 4.9);
    this.stairsMatMesh.userData = { type: "stairs" };
    this.hallwayGroup.add(this.stairsMatMesh);

    // Black doorways: living room (+z end), kitchen (-z end) and the new
    // bathroom — on the left wall, directly opposite the stairs.
    this.makeBlackDoorway(
      "living",
      "living room",
      this.hallwayGroup,
      new THREE.Vector3(0, 0.02, 4.9),
      new THREE.Vector3(0, 1.15, roomD / 2 - 0.05),
      0,
      new THREE.Vector3(0, 0, -1)
    );
    this.makeBlackDoorway(
      "kitchen",
      "kitchen",
      this.hallwayGroup,
      new THREE.Vector3(0, 0.02, -4.9),
      new THREE.Vector3(0, 1.15, -roomD / 2 + 0.05),
      0,
      new THREE.Vector3(0, 0, 1)
    );
    this.makeBlackDoorway(
      "bathroom",
      "bathroom",
      this.hallwayGroup,
      new THREE.Vector3(-4.0, 0.02, 0),
      new THREE.Vector3(-roomW / 2 + 0.05, 1.15, 0),
      Math.PI / 2,
      new THREE.Vector3(1, 0, 0)
    );
  }

  private setupUpstairs() {
    this.upstairsGroup.clear();
    // Bedroom is WIDER than deep — with a comfortable margin so the
    // camera never pops through the walls.
    const roomW = 12;
    const roomD = 9;
    const wallH = 3.6;

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

    const wallMat = new THREE.MeshStandardMaterial({ color: 0xe0e7ff, roughness: 0.85, side: THREE.DoubleSide });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x4c1d95, roughness: 0.6, side: THREE.DoubleSide });
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

    // Corner posts seal the bedroom wall joints (no gaps!)
    const uCornerGeom = new THREE.BoxGeometry(0.4, wallH, 0.4);
    [
      [-roomW / 2, -roomD / 2],
      [roomW / 2, -roomD / 2],
      [-roomW / 2, roomD / 2],
      [roomW / 2, roomD / 2],
    ].forEach(([x, z]) => {
      const post = new THREE.Mesh(uCornerGeom, trimMat);
      post.position.set(x, wallH / 2, z);
      this.upstairsGroup.add(post);
    });

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

    // Wardrobe closet (opens the hat wardrobe from inside the closet)
    this.buildUpstairsCloset();

    // Little dresser with drawers — grouped so edit mode can move it
    this.upstairsDresserGroup = new THREE.Group();
    this.upstairsDresserGroup.position.set(4.9, 0, -4.05);
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
    this.upstairsShelfGroup.position.set(-4.85, 0, -4.15);
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

    // ===== Cozy bedroom upgrades =====

    // Nightstand with a clickable lamp + alarm clock (next to the bed)
    const nightstand = new THREE.Group();
    const nsMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.6 });
    const nsBody = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.55, 0.55), nsMat);
    nsBody.position.y = 0.28;
    nsBody.castShadow = true;
    nightstand.add(nsBody);
    const nsDrawer = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.2, 0.04), new THREE.MeshStandardMaterial({ color: 0xddd6fe, roughness: 0.5 }));
    nsDrawer.position.set(0, 0.34, 0.29);
    nightstand.add(nsDrawer);
    const nsKnob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.7 }));
    nsKnob.position.set(0, 0.34, 0.32);
    nightstand.add(nsKnob);
    // Bedside lamp (click to toggle the cozy glow!)
    const bedLampGroup = new THREE.Group();
    const bedLampBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.1, 0.2, 10),
      new THREE.MeshStandardMaterial({ color: 0x4c1d95, roughness: 0.5 })
    );
    bedLampBase.position.y = 0.66;
    bedLampGroup.add(bedLampBase);
    this.bedLampShade = new THREE.Mesh(
      new THREE.ConeGeometry(0.17, 0.2, 12, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.4, side: THREE.DoubleSide })
    );
    this.bedLampShade.position.y = 0.82;
    bedLampGroup.add(this.bedLampShade);
    this.bedLampLight = new THREE.PointLight(0xffd9a0, 1.8, 7);
    this.bedLampLight.position.set(0, 0.85, 0);
    bedLampGroup.add(this.bedLampLight);
    bedLampGroup.position.set(0.2, 0, 0);
    nightstand.add(bedLampGroup);
    // Alarm clock (click — pup wakes up with a start!)
    const clockBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.16, 0.1),
      new THREE.MeshStandardMaterial({ color: 0xbc4749, roughness: 0.5 })
    );
    clockBody.position.set(-0.2, 0.66, 0.1);
    nightstand.add(clockBody);
    const clockFace = new THREE.Mesh(
      new THREE.CircleGeometry(0.06, 12),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    clockFace.position.set(-0.2, 0.66, 0.155);
    nightstand.add(clockFace);
    nightstand.position.set(-5.35, 0, -0.3);
    nightstand.userData = { type: "floor" };
    nightstand.traverse((c) => {
      if (c === this.bedLampShade || c === bedLampBase) c.userData = { type: "bedlamp" };
      if (c === clockBody || c === clockFace) c.userData = { type: "clock" };
    });
    this.bedLampShade.userData = { type: "bedlamp" };
    bedLampBase.userData = { type: "bedlamp" };
    clockBody.userData = { type: "clock" };
    this.upstairsGroup.add(nightstand);

    // Curtains flanking the starry window (cosy midnight vibes)
    const curtainMat = new THREE.MeshStandardMaterial({ color: 0x7c3aed, roughness: 0.9 });
    [-1.55, 1.55].forEach((cx) => {
      const curtain = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.4, 0.12), curtainMat);
      curtain.position.set(cx, 2.15, -4.36);
      this.upstairsGroup.add(curtain);
      // Curtain rod cap
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.7 })
      );
      cap.position.set(cx + (cx > 0 ? 0.28 : -0.28), 3.42, -4.36);
      this.upstairsGroup.add(cap);
    });
    const curtainRod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 4.6, 8),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.7 })
    );
    curtainRod.rotation.z = Math.PI / 2;
    curtainRod.position.set(0, 3.42, -4.36);
    this.upstairsGroup.add(curtainRod);

    // Fluffy slippers by the bed (click for happy paws!)
    const slipperMat = new THREE.MeshStandardMaterial({ color: 0xf9a8d4, roughness: 0.95 });
    [-0.22, 0.22].forEach((sx) => {
      const slipper = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), slipperMat);
      slipper.scale.set(1, 0.5, 1.6);
      slipper.position.set(-2.4 + sx, 0.07, 0.6);
      slipper.userData = { type: "slippers" };
      this.upstairsGroup.add(slipper);
    });

    // Bone art canvas above the bed
    const artCanvas = document.createElement("canvas");
    artCanvas.width = 256;
    artCanvas.height = 128;
    const aCtx = artCanvas.getContext("2d")!;
    aCtx.fillStyle = "#c4b5fd";
    aCtx.fillRect(0, 0, 256, 128);
    aCtx.strokeStyle = "#4c1d95";
    aCtx.lineWidth = 8;
    aCtx.strokeRect(6, 6, 244, 116);
    aCtx.font = "64px serif";
    aCtx.textAlign = "center";
    aCtx.fillText("🦴", 128, 84);
    const bedArt = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 0.75),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(artCanvas) })
    );
    bedArt.position.set(-3.8, 2.5, 0.35);
    bedArt.rotation.y = Math.PI / 2 + 0.25;
    this.upstairsGroup.add(bedArt);

    // Throw pillows on the bed + blanket chest at its foot
    const pillowMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });
    [-0.3, 0.25].forEach((px, i) => {
      const throwPillow = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), pillowMat);
      throwPillow.scale.set(1.3, 0.6, 0.8);
      throwPillow.position.set(-3.8 + px + (i === 0 ? -0.35 : 0.55), 0.26, -1.2 + (i === 0 ? 0.3 : -0.25));
      this.upstairsGroup.add(throwPillow);
    });
    const chestMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 });
    const chest = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 0.6), chestMat);
    chest.position.set(-3.8, 0.25, 0.6);
    chest.castShadow = true;
    this.upstairsGroup.add(chest);
    const chestLid = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.1, 0.64), new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.6 }));
    chestLid.position.set(-3.8, 0.54, 0.6);
    this.upstairsGroup.add(chestLid);

    // ===== THE ARCADE MACHINE (portal to the Galaxy Arcade world!) =====
    this.bedroomArcadeGroup = this.makeArcadeMachine("GALAXY ARCADE", 0x7c3aed, 0x22d3ee, "galaxyArcade");
    this.bedroomArcadeGroup.position.set(5.05, 0, 2.2);
    this.bedroomArcadeGroup.rotation.y = -Math.PI / 2; // faces into the room
    this.upstairsGroup.add(this.bedroomArcadeGroup);

    // Black doorway back down to the hallway (same look as every doorstep)
    this.makeBlackDoorway(
      "hallway",
      "hallway",
      this.upstairsGroup,
      new THREE.Vector3(1.55, 0.02, 3.4),
      new THREE.Vector3(1.55, 1.15, roomD / 2 - 0.05),
      0,
      new THREE.Vector3(0, 0, -1)
    );
  }

  // =====================================================================
  //  Bathroom — the new room off the hallway (opposite the stairs).
  //  Shower + bathtub (Happy can hop in), toilet, sink, and a shelf with
  //  Happy's Men's Shampoo, Happy Kids and the Star bottle.
  // =====================================================================

  /** Ceramic wall/floor tile texture. */
  private makeTileTexture(base: string, grout: string, repeat = 3): THREE.CanvasTexture {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = grout;
    ctx.fillRect(0, 0, 256, 256);
    const n = 4;
    const s = 256 / n;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const shade = (x + y) % 2 ? 0.94 : 1;
        const col = new THREE.Color(base).multiplyScalar(shade);
        ctx.fillStyle = `#${col.getHexString()}`;
        ctx.fillRect(x * s + 3, y * s + 3, s - 6, s - 6);
        ctx.fillStyle = "rgba(255,255,255,0.22)";
        ctx.fillRect(x * s + 3, y * s + 3, s - 6, 4);
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat, repeat);
    return tex;
  }

  /**
   * Front label for the three bathroom shampoo bottles:
   *   mens → black pack with an orange stripe at the bottom
   *   kids → green & blue striped "Happy Kids"
   *   star → black pack with the white Star logo + "Star"
   */
  private makeShampooTexture(kind: "mens" | "kids" | "star"): THREE.CanvasTexture {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 384;
    const ctx = c.getContext("2d")!;
    ctx.textAlign = "center";

    if (kind === "mens") {
      ctx.fillStyle = "#0d0d10";
      ctx.fillRect(0, 0, 256, 384);
      ctx.fillStyle = "#f97316"; // orange stripe at the bottom
      ctx.fillRect(0, 296, 256, 88);
      ctx.fillStyle = "#ffffff";
      ctx.font = "italic bold 46px Georgia, serif";
      ctx.fillText("Happy's", 128, 116);
      ctx.font = "bold 42px sans-serif";
      ctx.fillText("Men's", 128, 186);
      ctx.fillText("Shampoo", 128, 238);
      ctx.font = "bold 20px sans-serif";
      ctx.fillStyle = "#0d0d10";
      ctx.fillText("2 in 1  ·  400 ml", 128, 346);
    } else if (kind === "kids") {
      for (let y = 0; y < 384; y += 48) {
        ctx.fillStyle = (y / 48) % 2 ? "#22c55e" : "#3b82f6";
        ctx.fillRect(0, y, 256, 48);
      }
      ctx.fillStyle = "rgba(255,255,255,0.94)";
      ctx.fillRect(22, 112, 212, 148);
      ctx.fillStyle = "#1d4ed8";
      ctx.font = "bold 54px sans-serif";
      ctx.fillText("Happy", 128, 178);
      ctx.fillStyle = "#16a34a";
      ctx.fillText("Kids", 128, 238);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 21px sans-serif";
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = 4;
      ctx.strokeText("tear-free · 300 ml", 128, 350);
      ctx.fillText("tear-free · 300 ml", 128, 350);
    } else {
      // Star — a black pack carrying the white Star logo.
      ctx.fillStyle = "#050506";
      ctx.fillRect(0, 0, 256, 384);

      // Only draw the built-in logo when the real artwork hasn't been dropped in.
      if (!STAR_LOGO_URL) {
        // White outlined "tag" shape (chamfered top-left corner)
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 3;
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(34, 126);
        ctx.lineTo(86, 44);
        ctx.lineTo(226, 44);
        ctx.lineTo(226, 278);
        ctx.lineTo(34, 278);
        ctx.closePath();
        ctx.stroke();

        // The logo's name
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 62px Helvetica, Arial, sans-serif";
        ctx.fillText("Star", 130, 192);

        // Little star outline in the corner of the logo
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          const rr = i % 2 ? 11 : 25;
          const px = 192 + Math.cos(a) * rr;
          const py = 243 + Math.sin(a) * rr;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }

      ctx.font = "italic 20px sans-serif";
      ctx.fillStyle = "#a1a1aa";
      ctx.fillText("signature shampoo", 128, 340);
    }

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;

    // Real Star artwork (if dropped into src/assets) — drawn in "screen" blend
    // so only the white parts of the logo land on the black pack.
    if (kind === "star" && STAR_LOGO_URL) {
      const img = new Image();
      img.onload = () => {
        const box = 196;
        const scale = Math.min(box / img.width, box / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.fillStyle = "#050506";
        ctx.fillRect(0, 0, 256, 300);
        ctx.globalCompositeOperation = "screen";
        ctx.drawImage(img, 128 - w / 2, 150 - h / 2, w, h);
        ctx.globalCompositeOperation = "source-over";
        tex.needsUpdate = true;
      };
      img.src = STAR_LOGO_URL;
    }
    return tex;
  }

  /** A single shampoo box: label on the front & back, plain sides. */
  private makeShampooBox(kind: "mens" | "kids" | "star", w: number, h: number, d: number): THREE.Mesh {
    const label = this.makeShampooTexture(kind);
    const sideColor = kind === "kids" ? 0x3b82f6 : 0x111114;
    const side = new THREE.MeshStandardMaterial({ color: sideColor, roughness: 0.55 });
    const front = new THREE.MeshStandardMaterial({ map: label, roughness: 0.5 });
    const cap = new THREE.MeshStandardMaterial({
      color: kind === "kids" ? 0x16a34a : 0x27272a,
      roughness: 0.4,
      metalness: kind === "star" ? 0.5 : 0.1,
    });
    // BoxGeometry material order: +X, -X, +Y, -Y, +Z, -Z
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [
      side, side, cap, cap, front, front,
    ]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { type: "shampoo", kind };
    return mesh;
  }

  private setupBathroom() {
    const g = this.bathroomGroup;
    g.clear();
    const roomW = 12;
    const roomD = 10;
    const wallH = 4.2;

    // ---- Tiled floor ----
    const floorGeom = new THREE.PlaneGeometry(roomW, roomD);
    floorGeom.rotateX(-Math.PI / 2);
    this.bathroomFloorMesh = new THREE.Mesh(
      floorGeom,
      new THREE.MeshStandardMaterial({
        map: this.makeTileTexture("#eef4fb", "#a8c4e0", 4),
        roughness: 0.3,
      })
    );
    this.bathroomFloorMesh.receiveShadow = true;
    this.bathroomFloorMesh.userData = { type: "floor" };
    g.add(this.bathroomFloorMesh);

    // ---- Tiled walls ----
    const wallMat = new THREE.MeshStandardMaterial({
      map: this.makeTileTexture("#bfdbfe", "#60a5fa", 2),
      roughness: 0.45,
      side: THREE.DoubleSide,
    });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.55 });
    const mkWall = (w: number, x: number, z: number, rotY: number) => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, 0.15), wallMat);
      wall.position.set(x, wallH / 2, z);
      wall.rotation.y = rotY;
      wall.receiveShadow = true;
      g.add(wall);
      const base = new THREE.Mesh(new THREE.BoxGeometry(w, 0.14, 0.19), trimMat);
      base.position.set(x, 0.07, z);
      base.rotation.y = rotY;
      g.add(base);
    };
    mkWall(roomW, 0, -roomD / 2, 0);
    mkWall(roomW, 0, roomD / 2, 0);
    mkWall(roomD, -roomW / 2, 0, Math.PI / 2);
    mkWall(roomD, roomW / 2, 0, Math.PI / 2);
    [
      [-roomW / 2, -roomD / 2],
      [roomW / 2, -roomD / 2],
      [-roomW / 2, roomD / 2],
      [roomW / 2, roomD / 2],
    ].forEach(([x, z]) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, wallH, 0.3), trimMat);
      post.position.set(x, wallH / 2, z);
      g.add(post);
    });

    // ---- Ceiling + warm light ----
    const ceil = new THREE.Mesh(
      new THREE.PlaneGeometry(roomW, roomD),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.9, side: THREE.DoubleSide })
    );
    ceil.geometry.rotateX(Math.PI / 2);
    ceil.position.y = wallH;
    g.add(ceil);
    const light = new THREE.PointLight(0xe0f2fe, 1.5, 15);
    light.position.set(0, wallH - 0.45, 0);
    g.add(light);
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.12, 16), trimMat);
    lamp.position.set(0, wallH - 0.08, 0);
    g.add(lamp);

    // ---- Bathtub (long side along the back wall) ----
    const tub = this.bathtubGroup;
    tub.clear();
    const tubX = -3.0;
    const tubZ = -3.6;
    const tubW = 2.6;
    const tubD = 1.2;
    const tubH = 0.78;
    const tubMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.16, metalness: 0.04 });
    const tubBottom = new THREE.Mesh(new THREE.BoxGeometry(tubW, 0.14, tubD), tubMat);
    tubBottom.position.set(tubX, 0.07, tubZ);
    tub.add(tubBottom);
    const side = (w: number, h: number, d: number, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), tubMat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      tub.add(m);
    };
    side(tubW, tubH, 0.1, tubX, tubH / 2, tubZ - tubD / 2); // back
    side(tubW, tubH, 0.1, tubX, tubH / 2, tubZ + tubD / 2); // front
    side(0.1, tubH, tubD, tubX - tubW / 2, tubH / 2, tubZ); // left
    side(0.1, tubH, tubD, tubX + tubW / 2, tubH / 2, tubZ); // right
    // Chrome tap + feet
    const chrome = new THREE.MeshStandardMaterial({ color: 0xe4e4e7, metalness: 0.45, roughness: 0.32 });
    const tap = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.22, 12), chrome);
    tap.position.set(tubX - tubW / 2 + 0.22, tubH + 0.05, tubZ - tubD / 2 + 0.18);
    tub.add(tap);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 12), chrome);
    spout.rotation.z = Math.PI / 2;
    spout.position.set(tubX - tubW / 2 + 0.32, tubH + 0.14, tubZ - tubD / 2 + 0.18);
    tub.add(spout);
    tub.userData = { type: "bathtub" };
    tub.traverse((o) => (o.userData = { type: "bathtub" }));
    g.add(tub);

    // ---- Shower: wall rig + a hand head that unclips onto a hose ----
    const shower = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 2.1, 14), chrome);
    pole.position.set(-1.9, 1.15, -4.35);
    shower.add(pole);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.55, 12), chrome);
    arm.rotation.z = Math.PI / 2;
    arm.position.set(-2.15, 2.2, -4.35);
    shower.add(arm);
    // Wall water outlet the hand shower clips onto
    const outlet = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.14, 12), chrome);
    outlet.rotation.z = Math.PI / 2;
    outlet.position.set(-2.42, 2.2, -4.35);
    shower.add(outlet);

    // Detachable hand head (press it to unclip the shower and rinse Happy)
    const headGroup = this.showerHeadGroup;
    headGroup.clear();
    headGroup.position.copy(this.showerReturnTo);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.09, 18), chrome);
    headGroup.add(head);
    const headFace = new THREE.Mesh(
      new THREE.CircleGeometry(0.15, 18),
      new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.6, roughness: 0.35 })
    );
    headFace.rotation.x = -Math.PI / 2;
    headFace.position.y = -0.05;
    headGroup.add(headFace);
    const spray = new THREE.Mesh(
      new THREE.ConeGeometry(0.3, 0.75, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x93c5fd,
        transparent: true,
        opacity: 0.34,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    spray.position.y = -0.42;
    spray.rotation.x = Math.PI;
    spray.visible = false;
    headGroup.add(spray);
    this.showerSpray = spray;
    headGroup.userData = { type: "shower" };
    headGroup.traverse((o) => (o.userData = { type: "shower" }));
    shower.add(headGroup);

    // Hose "branch" that springs to life once the head is unclipped
    const hoseCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-2.5, 2.18, -4.35),
      new THREE.Vector3(-2.72, 1.72, -4.12),
      new THREE.Vector3(-3.0, 1.62, -3.86),
      new THREE.Vector3(-3.0, 1.88, -3.62),
    ]);
    this.showerHose = new THREE.Mesh(new THREE.TubeGeometry(hoseCurve, 26, 0.028, 8, false), chrome);
    this.showerHose.visible = false;
    shower.add(this.showerHose);

    // Glass screen along the front of the tub
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(1.05, 1.5),
      new THREE.MeshStandardMaterial({
        color: 0xcfe8ff,
        transparent: true,
        opacity: 0.28,
        roughness: 0.08,
        metalness: 0.1,
        side: THREE.DoubleSide,
      })
    );
    glass.position.set(tubX + 1.0, 0.86, tubZ + tubD / 2 + 0.03);
    shower.add(glass);
    shower.userData = { type: "shower" };
    shower.traverse((o) => (o.userData = { type: "shower" }));
    this.showerGroup = shower;
    g.add(shower);

    // ---- Toilet ----
    const wc = this.toiletGroup;
    wc.clear();
    const porcelain = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
    const pedestal = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.36, 0.5), porcelain);
    pedestal.position.set(2.6, 0.18, -4.0);
    wc.add(pedestal);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.2, 0.24, 20), porcelain);
    bowl.position.set(2.6, 0.44, -3.9);
    wc.add(bowl);
    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(0.19, 0.19, 0.03, 20),
      new THREE.MeshStandardMaterial({ color: 0xbfdbfe, roughness: 0.1 })
    );
    water.position.set(2.6, 0.55, -3.9);
    wc.add(water);
    const seat = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 10, 22), porcelain);
    seat.rotation.x = Math.PI / 2;
    seat.position.set(2.6, 0.57, -3.9);
    wc.add(seat);
    const tank = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.66, 0.22), porcelain);
    tank.position.set(2.6, 0.85, -4.62);
    wc.add(tank);
    const flush = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.03, 14),
      new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.8, roughness: 0.25 })
    );
    flush.position.set(2.68, 1.19, -4.6);
    wc.add(flush);
    wc.userData = { type: "toilet" };
    wc.traverse((o) => (o.userData = { type: "toilet" }));
    g.add(wc);

    // ---- Sink + mirror (left wall) ----
    const sinkMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.3 });
    const cabinet = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 1.1), new THREE.MeshStandardMaterial({ color: 0xa16207, roughness: 0.6 }));
    cabinet.position.set(-5.2, 0.4, 1.2);
    g.add(cabinet);
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.2, 0.18, 20), sinkMat);
    basin.position.set(-5.15, 0.89, 1.2);
    g.add(basin);
    const faucet = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.24, 12), chrome);
    faucet.position.set(-5.4, 1.03, 1.2);
    g.add(faucet);
    const mirror = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8, 1.05),
      new THREE.MeshStandardMaterial({ color: 0xbfe6ff, metalness: 0.95, roughness: 0.05 })
    );
    mirror.position.set(-5.5, 1.9, 1.2);
    mirror.rotation.y = Math.PI / 2;
    g.add(mirror);

    // ---- Soap shelf with the three shampoo bottles ----
    const shelf = this.soapShelfGroup;
    shelf.clear();
    const shelfMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.45 });
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.05, 0.26), shelfMat);
    plank.position.set(-1.0, 1.3, -4.85);
    plank.castShadow = true;
    plank.receiveShadow = true;
    shelf.add(plank);
    [-0.36, 0.36].forEach((dx) => {
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.2), shelfMat);
      bracket.position.set(-1.0 + dx, 1.2, -4.87);
      shelf.add(bracket);
    });
    const kinds: ("mens" | "kids" | "star")[] = ["mens", "kids", "star"];
    kinds.forEach((kind, i) => {
      const box = this.makeShampooBox(kind, 0.15, 0.22, 0.09);
      box.position.set(-1.3 + i * 0.3, 1.435, -4.85);
      box.rotation.y = -0.14 + i * 0.14;
      shelf.add(box);
    });
    shelf.userData = { type: "soapShelf" };
    // (Do NOT traverse-overwrite userData here — the bottles carry their own
    // { type: "shampoo", kind } tags that the bath routine reads.)
    g.add(shelf);

    // ---- Finishing touches: bath mat + towel rail ----
    const bathMat = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.02, 0.7),
      new THREE.MeshStandardMaterial({ color: 0x60a5fa, roughness: 0.95 })
    );
    bathMat.position.set(-3.0, 0.012, -2.4);
    bathMat.receiveShadow = true;
    g.add(bathMat);
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 12), chrome);
    rail.rotation.z = Math.PI / 2;
    rail.position.set(5.35, 1.5, 2.6);
    g.add(rail);
    const towel = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.72, 0.42),
      new THREE.MeshStandardMaterial({ color: 0xfda4af, roughness: 0.95 })
    );
    towel.position.set(5.28, 1.16, 2.6);
    g.add(towel);

    // ---- Black doorway back to the hallway ----
    this.makeBlackDoorway(
      "hallway",
      "hallway",
      g,
      new THREE.Vector3(4.4, 0.02, 0),
      new THREE.Vector3(roomW / 2 - 0.05, 1.15, 0),
      -Math.PI / 2,
      new THREE.Vector3(-1, 0, 0)
    );
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

  // ================= THE FOREST HIGHWAY (3D drive between home & city) =================

  /**
   * A long country road: forest on both sides that thins out into city
   * outskirts at the far end. The camera rides alongside so you clearly
   * see the 3D car driving from the side — all the way to the city.
   */
  private setupHighway() {
    const hw = this.highwayGroup;

    // Asphalt road running along z
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 260),
      new THREE.MeshStandardMaterial({ color: 0x3b4045, roughness: 0.95 })
    );
    road.geometry.rotateX(-Math.PI / 2);
    road.position.y = 0.01;
    road.receiveShadow = true;
    hw.add(road);
    // Center dashes
    for (let z = -125; z <= 125; z += 6) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.02, 2.6), new THREE.MeshBasicMaterial({ color: 0xf7d45c }));
      dash.position.set(0, 0.02, z);
      hw.add(dash);
    }
    // Grass shoulders
    [-1, 1].forEach((side) => {
      const g = new THREE.Mesh(
        new THREE.PlaneGeometry(60, 260),
        new THREE.MeshStandardMaterial({ color: 0x69b34c, roughness: 0.95 })
      );
      g.geometry.rotateX(-Math.PI / 2);
      g.position.set(side * 34, 0, 0);
      g.receiveShadow = true;
      hw.add(g);
    });
    // Dense forest for the first stretch, thinning toward the city.
    // The +x side stays CLEAR — the tracking camera rides there.
    for (let i = 0; i < 64; i++) {
      const side = i % 2 ? 1 : -1;
      const t = this.makeOneTree(0.8 + ((i * 29) % 30) / 100, i % 3 === 0);
      const z = 120 - i * 3.4 - Math.random() * 3;
      if (z < -30) continue; // no trees once the city starts
      // West side (-x): thick forest in the background behind the car.
      // East side (+x, camera side): trees pushed well behind the camera.
      t.position.set(side < 0 ? -7 - Math.random() * 20 : 17 + Math.random() * 10, 0, z);
      hw.add(t);
    }
    // City outskirts at the far (north) end: buildings rise along the road
    for (let i = 0; i < 16; i++) {
      const w = 5 + ((i * 7) % 4);
      const h = 8 + ((i * 13) % 11);
      const b = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, 5),
        new THREE.MeshStandardMaterial({ color: i % 2 ? 0x64748b : 0x5d6b81, roughness: 0.7 })
      );
      const side = i % 2 ? 1 : -1;
      b.position.set(side * (10 + (i % 3) * 9), h / 2, -60 - (i % 5) * 9 - ((i * 3) % 5));
      b.castShadow = true;
      hw.add(b);
    }
    // Street lamps the whole way
    for (let z = -110; z <= 110; z += 18) {
      [-1, 1].forEach((side) => {
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.07, 0.09, 3, 8),
          new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.5 })
        );
        pole.position.set(side * 4.6, 1.5, z);
        hw.add(pole);
        const bulb = new THREE.Mesh(
          new THREE.SphereGeometry(0.18, 8, 8),
          new THREE.MeshStandardMaterial({ color: 0xfff7cc, emissive: 0xffe082, emissiveIntensity: 0.9 })
        );
        bulb.position.set(side * 4.6, 3.1, z);
        hw.add(bulb);
      });
    }
    hw.visible = false;
    this.scene.add(hw);
  }

  // ================= ARCADE MACHINES + GALAXY WORLD =================

  /** A chunky retro arcade cabinet with a glowing marquee, fake-game screen,
   *  joystick & buttons, and a floating title. Fully clickable. */
  private makeArcadeMachine(title: string, bodyColor: number, glowColor: number, gameId: string): THREE.Group {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.5 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.4 });
    const glowMat = new THREE.MeshStandardMaterial({
      color: glowColor, emissive: glowColor, emissiveIntensity: 1.2, roughness: 0.4,
    });

    // Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.9, 0.85), bodyMat);
    body.position.y = 0.95;
    body.castShadow = true;
    g.add(body);
    // Marquee top with glowing strip
    const marquee = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.34, 0.92), bodyMat);
    marquee.position.y = 2.05;
    g.add(marquee);
    const glowStrip = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.1, 0.06), glowMat);
    glowStrip.position.set(0, 1.96, 0.46);
    g.add(glowStrip);
    // Screen with fake game art + title
    const screenCanvas = document.createElement("canvas");
    screenCanvas.width = 256;
    screenCanvas.height = 176;
    const sc = screenCanvas.getContext("2d")!;
    const grad = sc.createLinearGradient(0, 0, 0, 176);
    grad.addColorStop(0, "#0f172a");
    grad.addColorStop(1, "#312e81");
    sc.fillStyle = grad;
    sc.fillRect(0, 0, 256, 176);
    sc.fillStyle = "#fde047";
    sc.font = "bold 26px sans-serif";
    sc.textAlign = "center";
    sc.fillText(title.toUpperCase().slice(0, 14), 128, 60);
    sc.font = "40px serif";
    sc.fillText("🎮", 128, 120);
    for (let i = 0; i < 24; i++) {
      sc.fillStyle = "rgba(255,255,255,0.8)";
      sc.fillRect(Math.random() * 256, Math.random() * 176, 2, 2);
    }
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.85, 0.58),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(screenCanvas) })
    );
    screen.position.set(0, 1.5, 0.45);
    screen.rotation.x = -0.12;
    g.add(screen);
    // Control panel with joystick + buttons
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.12, 0.42), darkMat);
    panel.position.set(0, 1.06, 0.6);
    panel.rotation.x = 0.35;
    g.add(panel);
    const stick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.03, 0.22, 8),
      new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.6 })
    );
    stick.position.set(-0.28, 1.2, 0.68);
    stick.rotation.x = 0.35;
    g.add(stick);
    const stickBall = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 10), new THREE.MeshStandardMaterial({ color: 0xef4444 }));
    stickBall.position.set(-0.28, 1.33, 0.63);
    g.add(stickBall);
    [-0.02, 0.18].forEach((bx, i) => {
      const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 10), glowMat);
      btn.position.set(bx, 1.19, 0.72 - i * 0.02);
      g.add(btn);
    });
    // Neon side stripes
    [-0.58, 0.58].forEach((sx) => {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.7, 0.06), glowMat);
      stripe.position.set(sx, 0.95, 0.44);
      g.add(stripe);
    });
    // Floating title bubble sprite above the marquee
    const tCanvas = document.createElement("canvas");
    tCanvas.width = 320;
    tCanvas.height = 80;
    const tc = tCanvas.getContext("2d")!;
    tc.fillStyle = "rgba(17, 24, 39, 0.9)";
    tc.beginPath();
    tc.roundRect(6, 6, 308, 68, 20);
    tc.fill();
    tc.strokeStyle = `#${new THREE.Color(glowColor).getHexString()}`;
    tc.lineWidth = 5;
    tc.stroke();
    tc.fillStyle = "#ffffff";
    tc.font = "bold 30px sans-serif";
    tc.textAlign = "center";
    tc.fillText(title, 160, 50);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(tCanvas), transparent: true, depthTest: false })
    );
    sprite.scale.set(2.4, 0.6, 1);
    sprite.position.y = 2.75;
    g.add(sprite);

    g.userData = { type: "arcadeGame", gameId };
    g.traverse((c) => {
      c.userData = { type: "arcadeGame", gameId };
    });
    return g;
  }

  /** The Galaxy Arcade dimension: a starry neon platform ringed by arcade
   *  cabinets — each one a portal into a real playable mini-game. */
  private setupGalaxyArcade() {
    const galaxy = this.galaxyGroup;

    // ---- Space dome (galaxy canvas: stars + nebulae) ----
    const domeCanvas = document.createElement("canvas");
    domeCanvas.width = 1024;
    domeCanvas.height = 512;
    const dc = domeCanvas.getContext("2d")!;
    const bg = dc.createLinearGradient(0, 0, 0, 512);
    bg.addColorStop(0, "#020617");
    bg.addColorStop(0.5, "#1e1b4b");
    bg.addColorStop(1, "#312e81");
    dc.fillStyle = bg;
    dc.fillRect(0, 0, 1024, 512);
    // Nebula blobs
    for (let n = 0; n < 7; n++) {
      const nx = Math.random() * 1024;
      const ny = Math.random() * 512;
      const r = 60 + Math.random() * 130;
      const ng = dc.createRadialGradient(nx, ny, 0, nx, ny, r);
      ng.addColorStop(0, ["rgba(167,139,250,0.5)", "rgba(56,189,248,0.4)", "rgba(244,114,182,0.4)"][n % 3]);
      ng.addColorStop(1, "rgba(0,0,0,0)");
      dc.fillStyle = ng;
      dc.fillRect(nx - r, ny - r, r * 2, r * 2);
    }
    // Stars
    for (let i = 0; i < 420; i++) {
      dc.fillStyle = Math.random() > 0.15 ? "rgba(255,255,255,0.9)" : "#fde047";
      const size = Math.random() > 0.85 ? 3 : 1.6;
      dc.fillRect(Math.random() * 1024, Math.random() * 512, size, size);
    }
    const domeMat = new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(domeCanvas),
      side: THREE.BackSide,
      fog: false,
    });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 24), domeMat);
    galaxy.add(dome);

    // ---- Floating 3D star particles ----
    const starCount = 350;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 14 + Math.random() * 30;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.random() * Math.PI;
      starPos[i * 3] = Math.cos(th) * r * Math.sin(ph);
      starPos[i * 3 + 1] = Math.abs(Math.cos(ph) * r * 0.7) + 1;
      starPos[i * 3 + 2] = Math.sin(th) * r * Math.sin(ph);
    }
    const starGeom = new THREE.BufferGeometry();
    starGeom.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.14, transparent: true, opacity: 0.9, fog: false });
    const stars = new THREE.Points(starGeom, starMat);
    galaxy.add(stars);

    // ---- Neon platform ----
    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(12.5, 13, 0.4, 48),
      new THREE.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.4, metalness: 0.4 })
    );
    platform.position.y = 0.2;
    platform.receiveShadow = true;
    platform.userData = { type: "arcade_floor" };
    galaxy.add(platform);
    this.arcadeFloorMesh = platform;
    // Glowing rim ring
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(12.55, 0.09, 8, 48),
      new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x22d3ee, emissiveIntensity: 1.6 })
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.4;
    galaxy.add(rim);
    // Inner glow ring
    const inner = new THREE.Mesh(
      new THREE.TorusGeometry(7.2, 0.05, 8, 48),
      new THREE.MeshStandardMaterial({ color: 0xa78bfa, emissive: 0x7c3aed, emissiveIntensity: 1.4 })
    );
    inner.rotation.x = Math.PI / 2;
    inner.position.y = 0.42;
    galaxy.add(inner);

    // ---- The arcade machines (each a real playable game) ----
    const games: { id: string; title: string; body: number; glow: number }[] = [
      { id: "boneRush", title: "Subway Pup: Bone Rush", body: 0x4338ca, glow: 0x22d3ee },
      { id: "pawShuffle", title: "Paw Shuffle", body: 0x9d174d, glow: 0xf472b6 },
      { id: "backyardDigger", title: "Backyard Digger", body: 0x92400e, glow: 0xfbbf24 },
      { id: "treatCatch", title: "Treat Catch Frenzy", body: 0x166534, glow: 0x4ade80 },
      { id: "agility", title: "Agility Park Dash", body: 0xb45309, glow: 0xfde047 },
    ];
    this.arcadeMachines = [];
    this.arcadeMachinePos = {};
    games.forEach((game, i) => {
      const machine = this.makeArcadeMachine(game.title, game.body, game.glow, game.id);
      // Arrange in an arc facing the center of the platform
      const angle = (-0.5 + (i / (games.length - 1)) * 1.0) * Math.PI * 0.9;
      const radius = 7.4;
      const mx = Math.sin(angle) * radius;
      const mz = -Math.cos(angle) * radius * 0.75 - 2.2;
      machine.position.set(mx, 0.4, mz);
      machine.rotation.y = Math.atan2(-mx, -mz) + Math.PI;
      machine.userData = { type: "arcadeGame", gameId: game.id, baseY: 0.4 };
      this.arcadeMachines.push(machine);
      this.arcadeMachinePos[game.id] = new THREE.Vector3(mx, 1.4, mz);
      galaxy.add(machine);

      // Generous invisible hit proxy so the cabinet is easy to press even
      // from a distance or at a grazing camera angle.
      const proxy = new THREE.Mesh(
        new THREE.BoxGeometry(3.2, 4.4, 3.2),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      proxy.position.y = 1.9;
      proxy.userData = { type: "arcadeGame", gameId: game.id };
      machine.add(proxy);
    });

    // ---- HOME portal (exit pedestal) ----
    this.arcadeExitGroup = new THREE.Group();
    const portalRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.05, 0.14, 10, 32),
      new THREE.MeshStandardMaterial({ color: 0xf472b6, emissive: 0xdb2777, emissiveIntensity: 1.5 })
    );
    portalRing.position.y = 1.6;
    portalRing.rotation.x = 0;
    this.arcadeExitGroup.add(portalRing);
    const portalSwirl = new THREE.Mesh(
      new THREE.CircleGeometry(0.95, 24),
      new THREE.MeshBasicMaterial({ color: 0x1e1b4b, transparent: true, opacity: 0.85 })
    );
    portalSwirl.position.y = 1.6;
    this.arcadeExitGroup.add(portalSwirl);
    const homeCanvas = document.createElement("canvas");
    homeCanvas.width = 160;
    homeCanvas.height = 80;
    const hc = homeCanvas.getContext("2d")!;
    hc.fillStyle = "rgba(17,24,39,0.92)";
    hc.beginPath();
    hc.roundRect(6, 6, 148, 68, 18);
    hc.fill();
    hc.strokeStyle = "#f472b6";
    hc.lineWidth = 5;
    hc.stroke();
    hc.fillStyle = "#ffffff";
    hc.font = "bold 30px sans-serif";
    hc.textAlign = "center";
    hc.fillText("🏠 HOME", 80, 50);
    const homeSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(homeCanvas), transparent: true, depthTest: false })
    );
    homeSprite.scale.set(1.9, 0.95, 1);
    homeSprite.position.y = 3.1;
    this.arcadeExitGroup.add(homeSprite);
    this.arcadeExitGroup.position.set(0, 0.4, 3.6);
    this.arcadeExitGroup.userData = { type: "arcadeExit" };
    this.arcadeExitGroup.traverse((c) => {
      c.userData = { type: "arcadeExit" };
    });
    // Fat invisible hit area so the HOME portal is easy to grab.
    const exitProxy = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 4.6, 4.2),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    exitProxy.position.y = 1.9;
    exitProxy.userData = { type: "arcadeExit" };
    this.arcadeExitGroup.add(exitProxy);
    galaxy.add(this.arcadeExitGroup);

    // ---- Neon lighting ----
    const neonPurple = new THREE.PointLight(0x7c3aed, 2.2, 26);
    neonPurple.position.set(-6, 6, -4);
    galaxy.add(neonPurple);
    const neonCyan = new THREE.PointLight(0x22d3ee, 2.0, 26);
    neonCyan.position.set(6, 6, -4);
    galaxy.add(neonCyan);
    const neonPink = new THREE.PointLight(0xf472b6, 1.6, 20);
    neonPink.position.set(0, 5, 6);
    galaxy.add(neonPink);
  }

  /** Enter the Galaxy Arcade dimension (behind a cartoon transition). */
  public enterArcadeWorld(returnTo: "upstairs" | "park" = "upstairs") {
    this.arcadeReturnTo = returnTo;
    this.viewMode = "arcade";
    this.hideAllRooms();
    this.galaxyGroup.visible = true;
    this.walkTarget = null;
    this.walkTargetMarker.visible = false;
    this.dog.group.position.set(0, 0.4, 6.2);
    this.dog.group.rotation.y = Math.PI;
    this.dog.setAction("idle");
    this.spherical.set(9.5, Math.PI / 3.0, 0);
    this.cameraTarget.set(0, 1.4, 0);
    this.updateCameraPosition();
    sound.playPotReveal();
  }

  /** Leave the arcade — back to wherever you came from. */
  public exitArcadeWorld() {
    this.galaxyGroup.visible = false;
    if (this.arcadeReturnTo === "park") {
      this.viewMode = "park";
      this.hideAllRooms();
      this.parkGroup.visible = true;
      this.dog.group.position.set(-4.5, 0, -2.5);
      this.dog.group.rotation.y = Math.PI;
      this.dog.setAction("idle");
      this.spherical.set(7.5, Math.PI / 3.2, 0);
      this.cameraTarget.copy(this.dog.group.position).add(new THREE.Vector3(0, 1.0, 0));
    } else {
      this.viewMode = "house";
      this.houseRoom = "upstairs";
      this.hideAllRooms();
      this.upstairsGroup.visible = true;
      this.dog.group.position.set(1.55, 0, 1.8);
      this.dog.group.rotation.y = Math.PI * 0.9;
      this.dog.setAction("idle");
      this.spherical.set(4.8, Math.PI / 3.1, 0);
      this.cameraTarget.set(0, 0.9, 0);
    }
    this.walkTarget = null;
    this.walkTargetMarker.visible = false;
    this.updateCameraPosition();
    sound.playSoftWoof();
  }

  /** Bedside lamp toggle (cozy bedroom functionality). */
  public toggleBedLamp() {
    this.bedLampOn = !this.bedLampOn;
    this.bedLampLight.visible = this.bedLampOn;
    sound.playLightSwitch();
  }

  /**
   * The bedroom cabinet sits against the right-hand wall, which puts it
   * off-screen from the default bedroom camera — so the HUD button has to be
   * able to trigger it too. Bounce + flash it so the press is acknowledged
   * whichever way the player entered.
   */
  public pulseBedroomArcade() {
    this.pulseArcadeCabinet(this.bedroomArcadeGroup);
  }

  /** True while the camera is close enough to the bedroom cabinet to click it. */
  public isBedroomArcadeOnScreen(): boolean {
    return this.viewMode === "house" && this.houseRoom === "upstairs";
  }

  /**
   * Give an arcade cabinet a visible "you pressed me" reaction: the cabinet
   * hops and its screen flashes. Without this the press reads as a no-op.
   */
  public pulseArcadeCabinet(machine: THREE.Object3D | null | undefined) {
    if (!machine) return;
    const baseY = machine.userData?.baseY;
    if (typeof baseY !== "number") {
      machine.userData.baseY = machine.position.y;
    }
    this.arcadePulse = { target: machine, t: 0 };
    const screens = this.findEmissiveScreens(machine);
    for (const s of screens) s.emissiveIntensity = 3.4;
    this.arcadePulseScreens = screens;
  }

  private findEmissiveScreens(machine: THREE.Object3D): THREE.MeshStandardMaterial[] {
    const out: THREE.MeshStandardMaterial[] = [];
    machine.traverse((c) => {
      const mesh = c as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mat && mat.emissive && mat.emissiveIntensity > 0.5) out.push(mat);
    });
    return out;
  }

  private updateArcadePulse(delta: number) {
    if (!this.arcadePulse) return;
    this.arcadePulse.t += delta;
    const k = Math.min(1, this.arcadePulse.t / 0.55);
    const { target } = this.arcadePulse;
    const baseY = typeof target.userData?.baseY === "number" ? target.userData.baseY : target.position.y;
    // A quick two-hop bounce that settles back down.
    const hop = Math.sin(k * Math.PI * 2) * (1 - k) * 0.28;
    target.position.y = baseY + hop;
    for (const s of this.arcadePulseScreens) s.emissiveIntensity = 1.4 + (1 - k) * 2.0;
    if (k >= 1) {
      target.position.y = baseY;
      for (const s of this.arcadePulseScreens) s.emissiveIntensity = 1.4;
      this.arcadePulse = null;
      this.arcadePulseScreens = [];
    }
  }

  /** Smooth cinematic zoom toward a point in the world (portal effect). */
  public zoomToObject(target: THREE.Vector3, onDone?: () => void) {
    const dir = new THREE.Vector3().subVectors(this.camera.position, target);
    if (dir.lengthSq() < 0.01) dir.set(0.5, 0.8, 1.5);
    const toPos = target.clone().add(dir.setLength(1.7));
    toPos.y = Math.max(target.y + 0.9, 1.2);
    this.camTween = {
      active: true,
      t: 0,
      dur: 1.0,
      fromPos: this.camera.position.clone(),
      toPos,
      lookAt: target.clone(),
      onDone,
    };
  }

  public zoomToBedroomArcade(onDone?: () => void) {
    this.zoomToObject(new THREE.Vector3(4.55, 1.5, 2.2), onDone);
  }

  /** Zoom the camera up to the bedroom closet for the wardrobe. */
  public zoomToCloset(onDone?: () => void) {
    const p = this.upstairsClosetGroup.position.clone();
    p.y = 1.3;
    p.x += 0.4; // nudge toward the room so the camera isn't inside the wall
    this.zoomToObject(p, onDone);
  }

  public zoomToArcadeGame(gameId: string, onDone?: () => void) {
    const pos = this.arcadeMachinePos[gameId];
    if (!pos) {
      if (onDone) onDone();
      return;
    }
    this.zoomToObject(pos.clone().add(new THREE.Vector3(0, 0.1, 0.55)), onDone);
  }

  private updateCameraTween(delta: number) {
    if (!this.camTween.active) return;
    this.camTween.t += delta;
    const k = Math.min(1, this.camTween.t / this.camTween.dur);
    const e = k * k * (3 - 2 * k); // smoothstep ease
    this.camera.position.lerpVectors(this.camTween.fromPos, this.camTween.toPos, e);
    this.camera.lookAt(this.camTween.lookAt);
    if (k >= 1) {
      this.camTween.active = false;
      const cb = this.camTween.onDone;
      this.camTween.onDone = undefined;
      if (cb) cb();
    }
  }

  // ================= THE LITTLE CAR =================

  /** A cute low-poly car parked at the end of the platform in front of the
   *  house door. Click it and Happy hops in for the drive to the City! */
  private buildCar() {
    const car = new THREE.Group();
    car.position.set(-5, 0, 10.5);
    car.rotation.y = 0; // faces +z (away from the house, ready to drive)

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.35, metalness: 0.25 });
    const cabinMat = new THREE.MeshStandardMaterial({ color: 0xfecdd3, roughness: 0.2, metalness: 0.3 });
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.9 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 2.9), bodyMat);
    body.position.y = 0.62;
    body.castShadow = true;
    car.add(body);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.55, 1.3), cabinMat);
    cabin.position.set(0, 1.15, -0.25);
    cabin.castShadow = true;
    car.add(cabin);

    // Windshield + happy doggy behind the wheel (peeking ears!)
    const windshield = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 0.4),
      new THREE.MeshStandardMaterial({ color: 0xbfe6f5, roughness: 0.1, metalness: 0.4, side: THREE.DoubleSide })
    );
    windshield.position.set(0, 1.12, 0.42);
    windshield.rotation.x = -0.25;
    car.add(windshield);

    this.carWheels = [];
    [
      [-0.82, 1.0], [0.82, 1.0], [-0.82, -1.0], [0.82, -1.0],
    ].forEach(([x, z]) => {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.22, 12), tireMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.3, z);
      wheel.castShadow = true;
      car.add(wheel);
      this.carWheels.push(wheel);
    });

    // Headlights + taillights
    [0xd, 0xd].forEach((_, i) => {
      const light = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xfff9c4, emissive: 0xffe082, emissiveIntensity: 0.8 })
      );
      light.position.set(i === 0 ? -0.5 : 0.5, 0.62, 1.47);
      car.add(light);
    });

    car.userData = { type: "car" };
    car.traverse((c) => {
      c.userData = { type: "car" };
    });
    this.carGroup = car;
    // Scene root (NOT parkGroup): the car stays visible while the world
    // chunks swap during the park → highway → city ride cinematic.
    this.scene.add(car);
  }

  /** Click the parked car: Happy walks over and the dashboard sat-nav opens. */
  public startCarRideToCity() {
    if (this.viewMode !== "park" || this.carRide.phase !== "none" || this.satNavPending) return;
    this.carRide = { phase: "hopIn", midwayFired: false };
    const side = new THREE.Vector3(this.carGroup.position.x + 1.6, 0, this.carGroup.position.z);
    this.walkTo(side, () => {
      // Happy's at the car: show the sat-nav and ask WHERE to.
      this.carRide = { phase: "none", midwayFired: false };
      this.satNavPending = true;
      sound.playButtonTap();
      if (this.onCarSatNav) this.onCarSatNav();
    });
  }

  /** The sat-nav destination was picked — hop in and roll out of the park. */
  public startCarRideWithDestination(dest: "supermarket" | "cakestore") {
    if (this.viewMode !== "park" || !this.satNavPending) return;
    this.satNavPending = false;
    this.carDestination = dest;
    this.dog.group.visible = false; // hops in!
    this.carRide = { phase: "driveToCity", midwayFired: false };
    this.cinematicCam = true;
    sound.playWhistle();
    sound.playToyBounce();
  }

  /** The sat-nav was dismissed without picking a stop. */
  public cancelCarSatNav() {
    this.satNavPending = false;
  }

  /** In the City: click the car again to drive home. */
  public startCarRideHome() {
    if (this.viewMode !== "city" || this.carRide.phase !== "none") return;
    this.carRide = { phase: "hopIn", midwayFired: false };
    const side = new THREE.Vector3(this.carGroup.position.x - 1.6, 0, this.carGroup.position.z + 1.2);
    this.walkTo(side, () => {
      this.dog.group.visible = false;
      if (this.carParkedLot === "cakestore") {
        // Leave the lot behind the Cake Store: back down the lane, out along
        // the south side of the shop, then home down the street — again
        // hugging the east lane past the plaza tree.
        this.carPath = [
          new THREE.Vector3(17.0, 0, -33.55),
          new THREE.Vector3(17.0, 0, -24.0),
          new THREE.Vector3(16.0, 0, -21.6),
          new THREE.Vector3(11.0, 0, -21.4),
          new THREE.Vector3(5.6, 0, -21.4),
          new THREE.Vector3(4.2, 0, -19.8),
          new THREE.Vector3(4.4, 0, -16),
          new THREE.Vector3(4.4, 0, 0),
          new THREE.Vector3(4.35, 0, 8.6),
          new THREE.Vector3(3.2, 0, 11),
          new THREE.Vector3(3, 0, 16),
          new THREE.Vector3(3, 0, 26),
        ];
      } else {
        // Back out of the spot, down the lane, onto the street and south home
        this.carPath = [
          new THREE.Vector3(8.0, 0, 1.05),
          new THREE.Vector3(8.0, 0, 6.4),
          new THREE.Vector3(7.8, 0, 7.9),
          new THREE.Vector3(5.0, 0, 8.8),
          new THREE.Vector3(3.2, 0, 10.5),
          new THREE.Vector3(3, 0, 16),
          new THREE.Vector3(3, 0, 26),
        ];
      }
      this.carPathIdx = 0;
      this.carRide.phase = "driveHome";
      this.sideCam = true;
      sound.playWhistle();
    });
  }

  /** Called (behind the cartoon black screen) to land the car in the City. */
  public arriveInCity() {
    this.viewMode = "city";
    this.houseRoom = "living";
    this.hideAllRooms();
    this.cityGroup.visible = true;
    this.walkTarget = null;
    this.walkTargetMarker.visible = false;
    // Car enters from the forest road in the south and cruises to the park
    this.carGroup.rotation.y = Math.PI; // face -z (into the city)
    this.carGroup.position.set(3, 0, 24);
    this.carRide.phase = "cityDrive";
    this.cinematicCam = true;
  }

  /** Called (behind the black screen) to land the car back home in the park. */
  public arriveHomeFromCity() {
    this.viewMode = "park";
    this.hideAllRooms();
    // Next city visit should start the birthday scream all over again
    this.partyScreamDone = false;
    this.parkGroup.visible = true;
    this.carGroup.rotation.y = 0;
    this.carGroup.position.set(-5, 0, 10.5);
    this.dog.group.visible = true;
    this.dog.group.position.set(-4.5, 0, -2.5);
    this.dog.group.rotation.y = Math.PI;
    this.dog.setAction("idle");
    this.carRide = { phase: "none", midwayFired: false };
    this.cinematicCam = false;
    this.spherical.set(7.5, Math.PI / 3.2, 0);
    this.cameraTarget.copy(this.dog.group.position).add(new THREE.Vector3(0, 1.0, 0));
    this.updateCameraPosition();
    if (this.onArrivedHome) this.onArrivedHome();
  }

  /**
   * Called behind the cutscene's parking scene: the car is already parked at
   * the City lot and Happy has just walked out — reveal a ready-to-play city.
   */
  public arriveInCityParked() {
    this.viewMode = "city";
    this.houseRoom = "living";
    this.hideAllRooms();
    this.cityGroup.visible = true;
    this.walkTarget = null;
    this.walkTargetMarker.visible = false;
    // Nose-in at the free parking spot beside the blue/yellow/purple cars
    this.carParkedLot = "supermarket";
    this.carGroup.rotation.y = Math.PI / 2;
    this.carGroup.position.set(12.2, 0, 1.05);
    this.dog.group.visible = true;
    this.dog.group.position.set(10.3, 0, 3.4);
    this.dog.group.rotation.y = Math.PI * 0.85;
    this.dog.setAction("sit", 3.0);
    this.carRide = { phase: "none", midwayFired: false };
    this.cinematicCam = false;
    this.spherical.set(9.0, Math.PI / 3.5, -1.95);
    this.cameraTarget.set(11.6, 1.2, 3.4);
    this.updateCameraPosition();
  }

  /**
   * The reverse trip: the cutscene parks the car back at its home spot in
   * front of the house and Happy walks out onto the lawn.
   */
  public arriveHomeParked() {
    this.viewMode = "park";
    this.houseRoom = "living";
    this.hideAllRooms();
    this.parkGroup.visible = true;
    this.walkTarget = null;
    this.walkTargetMarker.visible = false;
    this.carGroup.rotation.y = 0;
    this.carGroup.position.set(-5, 0, 10.5);
    this.dog.group.visible = true;
    this.dog.group.position.set(-3.9, 0, 9.4);
    this.dog.group.rotation.y = Math.PI;
    this.dog.setAction("sit", 3.0);
    this.carRide = { phase: "none", midwayFired: false };
    this.cinematicCam = false;
    this.spherical.set(7.5, Math.PI / 3.2, 0);
    this.cameraTarget.copy(this.dog.group.position).add(new THREE.Vector3(0, 1.0, 0));
    this.updateCameraPosition();
  }

  /** Quick escape from the City without the full cinematic (HUD button). */
  public exitCityInstant() {
    if (this.viewMode !== "city") return;
    this.arriveHomeFromCity();
  }

  /** Drive the car along waypoints (lot pull-in / pull-out paths). */
  private carPath: THREE.Vector3[] = [];
  private carPathIdx = 0;
  private moveCarAlongPath(delta: number, speed: number): boolean {
    if (this.carPathIdx >= this.carPath.length) return true;
    const target = this.carPath[this.carPathIdx];
    const pos = this.carGroup.position;
    const dx = target.x - pos.x;
    const dz = target.z - pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.15) {
      this.carPathIdx++;
      return this.carPathIdx >= this.carPath.length;
    }
    const step = Math.min(dist, speed * delta);
    pos.x += (dx / dist) * step;
    pos.z += (dz / dist) * step;
    const targetAngle = Math.atan2(dx, dz);
    this.carGroup.rotation.y = THREE.MathUtils.lerp(
      this.carGroup.rotation.y,
      targetAngle,
      Math.min(1, delta * 6)
    );
    return false;
  }

  // ---- Highway ride phases (all fully 3D, viewed from the side) ----

  /** Swap to the forest highway chunk and cruise toward the city. */
  public startHighwayToCity() {
    this.viewMode = "highway";
    this.hideAllRooms();
    this.highwayGroup.visible = true;
    this.carGroup.position.set(0, 0, 115);
    this.carGroup.rotation.y = Math.PI; // nose toward -z (city end)
    this.sideCam = true;
    this.carRide = { phase: "highwayToCity", midwayFired: false };
  }

  /** Enter the city and drive to the sat-nav stop, hunting the free spot. */
  public startLotPullIn() {
    this.viewMode = "city";
    this.hideAllRooms();
    this.cityGroup.visible = true;
    this.carGroup.position.set(3, 0, 15);
    this.carGroup.rotation.y = Math.PI;
    this.carPathIdx = 0;
    this.sideCam = true;
    if (this.carDestination === "cakestore") {
      // Roll all the way north up the street — hugging the east lane to
      // clear the plaza tree by the bench — then hang a right around the
      // south side of the pink Cake Store, and up its east side into the
      // lot BEHIND the shop (never on the left-hand side of the road!)
      this.carPath = [
        new THREE.Vector3(3, 0, 10),
        new THREE.Vector3(4.35, 0, 8.6),
        new THREE.Vector3(4.4, 0, 2),
        new THREE.Vector3(4.4, 0, -10),
        new THREE.Vector3(4.2, 0, -16),
        new THREE.Vector3(4.0, 0, -19.2),
        new THREE.Vector3(6.0, 0, -21.2),
        new THREE.Vector3(12.0, 0, -21.4),
        new THREE.Vector3(16.2, 0, -21.6),
        new THREE.Vector3(17.0, 0, -24.5),
        new THREE.Vector3(17.0, 0, -29.5),
        new THREE.Vector3(17.0, 0, -33.55),
        new THREE.Vector3(21.2, 0, -33.55),
      ];
    } else {
      // Roll up the street, swing into the lot driveway, cruise down the lane
      // PAST the blue, yellow and purple cars, then nose into the free spot.
      this.carPath = [
        new THREE.Vector3(3, 0, 11),
        new THREE.Vector3(3.4, 0, 9.2),
        new THREE.Vector3(5.6, 0, 8.2),
        new THREE.Vector3(8.0, 0, 7.4),
        new THREE.Vector3(8.0, 0, 5.6),
        new THREE.Vector3(8.0, 0, 3.9),
        new THREE.Vector3(8.0, 0, 2.2),
        new THREE.Vector3(8.0, 0, 1.05),
        new THREE.Vector3(12.2, 0, 1.05),
      ];
    }
    this.carRide = { phase: "lotPullIn", midwayFired: false };
  }

  /** Leave the city on the highway, cruising home through the forest. */
  public startHighwayHome() {
    this.viewMode = "highway";
    this.hideAllRooms();
    this.highwayGroup.visible = true;
    this.carGroup.position.set(0, 0, -112);
    this.carGroup.rotation.y = 0; // nose toward +z (home end)
    this.sideCam = true;
    this.carRide = { phase: "highwayHome", midwayFired: false };
  }

  /** Back at the park: drive the last stretch up to the house spot. */
  public startHomeArrival() {
    this.viewMode = "park";
    this.hideAllRooms();
    this.parkGroup.visible = true;
    this.carGroup.position.set(-5, 0, 32);
    this.carGroup.rotation.y = Math.PI; // nose toward -z (the house spot)
    this.sideCam = false;
    this.cinematicCam = true;
    this.carRide = { phase: "homeArrival", midwayFired: false };
  }

  private updateCarRide(delta: number) {
    const ride = this.carRide;
    if (ride.phase === "none" || ride.phase === "hopIn") return;

    const speed = ride.phase === "highwayToCity" || ride.phase === "highwayHome" ? 17 : 10;
    // Spin the wheels while driving
    this.carWheels.forEach((w) => (w.rotation.x += delta * speed * 2));

    if (ride.phase === "driveToCity") {
      this.carGroup.position.z += speed * delta;
      if (this.carGroup.position.z > 26 && !ride.midwayFired) {
        ride.midwayFired = true;
        ride.phase = "none";
        this.cinematicCam = false;
        if (this.onCarRideMidway) this.onCarRideMidway(); // → highway
      }
    } else if (ride.phase === "highwayToCity") {
      this.carGroup.position.z -= speed * delta;
      if (this.carGroup.position.z < -112 && !ride.midwayFired) {
        ride.midwayFired = true;
        ride.phase = "none";
        if (this.onCityApproach) this.onCityApproach(); // → city lot
      }
    } else if (ride.phase === "lotPullIn") {
      if (this.moveCarAlongPath(delta, 8)) {
        this.carRide = { phase: "none", midwayFired: false };
        this.sideCam = false;
        this.carGroup.rotation.y = Math.PI / 2; // nose-in, facing east
        this.dog.group.visible = true;
        this.dog.setAction("sit", 3.0);
        if (this.carDestination === "cakestore") {
          // Parked in the new lot BEHIND the Cake Store — step out beside
          // the neighbours and frame the pink shop next door.
          this.carParkedLot = "cakestore";
          this.dog.group.position.set(19.3, 0, -31.2);
          this.dog.group.rotation.y = Math.PI * 0.85;
          // Frame from the driveway mouth (south), so the lot, the cars and
          // the pink shop's east side all read — never inside the shop!
          this.spherical.set(12.5, 0.95, -0.35);
          this.cameraTarget.set(20.9, 1.2, -30.6);
        } else {
          // Parked in the hedge lot by the supermarket: Happy hops out in
          // the lane beside his car and the blue/yellow/purple neighbours.
          this.carParkedLot = "supermarket";
          this.dog.group.position.set(10.3, 0, 3.4);
          this.dog.group.rotation.y = Math.PI * 0.85;
          this.spherical.set(9.0, Math.PI / 3.5, -1.95);
          this.cameraTarget.set(11.6, 1.2, 3.4);
        }
        this.updateCameraPosition();
        sound.playRewardFanfare();
        if (this.onArrivedInCity) this.onArrivedInCity();
      }
    } else if (ride.phase === "driveHome") {
      if (this.moveCarAlongPath(delta, 10)) {
        ride.midwayFired = true;
        ride.phase = "none";
        if (this.onCarReturnMidway) this.onCarReturnMidway(); // → highway
      }
    } else if (ride.phase === "highwayHome") {
      this.carGroup.position.z += speed * delta;
      if (this.carGroup.position.z > 112 && !ride.midwayFired) {
        ride.midwayFired = true;
        ride.phase = "none";
        if (this.onHomeApproach) this.onHomeApproach(); // → park arrival
      }
    } else if (ride.phase === "homeArrival") {
      this.carGroup.position.z -= 12 * delta;
      if (this.carGroup.position.z <= 10.5 && !ride.midwayFired) {
        ride.midwayFired = true;
        this.carGroup.position.z = 10.5;
        this.dog.group.visible = true;
        this.dog.group.position.set(-3.9, 0, 9.4);
        this.dog.group.rotation.y = Math.PI;
        this.dog.setAction("sit", 3.0);
        this.carRide = { phase: "none", midwayFired: false };
        this.cinematicCam = false;
        this.spherical.set(7.5, Math.PI / 3.2, 0);
        this.cameraTarget.copy(this.dog.group.position).add(new THREE.Vector3(0, 1.0, 0));
        this.updateCameraPosition();
        sound.playSoftWoof();
        if (this.onArrivedHome) this.onArrivedHome();
      }
    }
  }

  // ================= THE CITY =================

  /** Modern city chunk: street + forest approach, a beautiful city park,
   *  the SUPERMARKET, the GYM, and a skyline backdrop. */
  private setupCity() {
    const city = this.cityGroup;

    // Concrete ground (96x96: the city road now runs much further north,
    // all the way up to the Birthday Cake Store)
    const groundCanvas = document.createElement("canvas");
    groundCanvas.width = 256;
    groundCanvas.height = 256;
    const gCtx = groundCanvas.getContext("2d")!;
    gCtx.fillStyle = "#9aa1a8";
    gCtx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 700; i++) {
      gCtx.fillStyle = Math.random() > 0.5 ? "#8d949b" : "#a8afb6";
      gCtx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
    const groundTex = new THREE.CanvasTexture(groundCanvas);
    groundTex.wrapS = THREE.RepeatWrapping;
    groundTex.wrapT = THREE.RepeatWrapping;
    groundTex.repeat.set(12, 12);
    this.cityGroundMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(96, 96),
      new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.95 })
    );
    this.cityGroundMesh.geometry.rotateX(-Math.PI / 2);
    this.cityGroundMesh.receiveShadow = true;
    this.cityGroundMesh.userData = { type: "city_floor" };
    city.add(this.cityGroundMesh);

    // Street running along z (the car drives in on it from the forest).
    // EXTENDED north: -36 … 28 so the new Cake Store has real frontage.
    const streetCanvas = document.createElement("canvas");
    streetCanvas.width = 64;
    streetCanvas.height = 256;
    const sCtx = streetCanvas.getContext("2d")!;
    sCtx.fillStyle = "#3b4045";
    sCtx.fillRect(0, 0, 64, 256);
    sCtx.fillStyle = "#f7d45c";
    for (let y = 10; y < 256; y += 42) {
      sCtx.fillRect(29, y, 6, 22);
    }
    const streetTex = new THREE.CanvasTexture(streetCanvas);
    streetTex.wrapS = THREE.RepeatWrapping;
    streetTex.wrapT = THREE.RepeatWrapping;
    streetTex.repeat.set(1, 8);
    const street = new THREE.Mesh(
      new THREE.PlaneGeometry(5.5, 64),
      new THREE.MeshStandardMaterial({ map: streetTex, roughness: 0.95 })
    );
    street.geometry.rotateX(-Math.PI / 2);
    street.position.set(3, 0.02, -4);
    street.userData = { type: "city_floor" };
    city.add(street);

    // Sidewalks flanking the street
    const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, roughness: 0.9 });
    [-0.1, 6.2].forEach((x) => {
      const sw = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 64), sidewalkMat);
      sw.geometry.rotateX(-Math.PI / 2);
      sw.position.set(x, 0.03, -4);
      sw.userData = { type: "city_floor" };
      city.add(sw);
    });

    // ---- Modern city park (west of the street) ----
    const park = new THREE.Group();
    // Grand plaza circle
    const plaza = new THREE.Mesh(
      new THREE.CylinderGeometry(5.2, 5.35, 0.08, 36),
      new THREE.MeshStandardMaterial({ color: 0xe8e0cc, roughness: 0.8 })
    );
    plaza.position.set(-5, 0.05, 1);
    plaza.receiveShadow = true;
    plaza.userData = { type: "city_floor" };
    park.add(plaza);
    // Stone paths radiating out
    const pathMat = new THREE.MeshStandardMaterial({ color: 0xd6c29e, roughness: 0.85 });
    [[-11, 1, 8, 1.4], [-5, -4.4, 1.4, 8]].forEach(([x, z, w, d]) => {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), pathMat);
      p.geometry.rotateX(-Math.PI / 2);
      p.position.set(x, 0.06, z);
      p.userData = { type: "city_floor" };
      park.add(p);
    });
    // Fountain centerpiece
    const fountain = new THREE.Group();
    const fBase = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 1.55, 0.5, 20),
      new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.4 })
    );
    fBase.position.y = 0.25;
    fountain.add(fBase);
    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(1.25, 1.25, 0.12, 20),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.1, metalness: 0.4, transparent: true, opacity: 0.9 })
    );
    water.position.y = 0.52;
    fountain.add(water);
    const jet = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 1.2, 10),
      new THREE.MeshStandardMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.7 })
    );
    jet.position.y = 1.1;
    fountain.add(jet);
    fountain.position.set(-5, 0, 1);
    park.add(fountain);
    // Benches, lamps, flower beds & trees around the plaza
    const benchMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.7 });
    [
      [-8.5, -1.8, 0], [-1.5, -1.8, 0], [-8.5, 3.8, Math.PI], [-1.5, 3.8, Math.PI],
    ].forEach(([x, z, r]) => {
      const bench = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.5), benchMat);
      seat.position.y = 0.45;
      bench.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.08), benchMat);
      back.position.set(0, 0.7, -0.22);
      bench.add(back);
      bench.position.set(x, 0, z);
      bench.rotation.y = r;
      bench.traverse((c) => (c.castShadow = true));
      park.add(bench);
    });
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6, roughness: 0.4 });
    [[-10, -2.5], [0, -2.5], [-10, 4.5], [0, 4.5]].forEach(([x, z]) => {
      const lamp = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.6, 8), lampMat);
      pole.position.y = 1.3;
      lamp.add(pole);
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 10, 10),
        new THREE.MeshStandardMaterial({ color: 0xfff7cc, emissive: 0xffe082, emissiveIntensity: 0.9 })
      );
      bulb.position.y = 2.7;
      lamp.add(bulb);
      lamp.position.set(x, 0, z);
      park.add(lamp);
    });
    const flowerColors = [0xf43f5e, 0xfacc15, 0xa855f7, 0x38bdf8];
    [[-9.5, 0], [-0.5, 0], [-9.5, 2.2], [-0.5, 2.2]].forEach(([x, z], i) => {
      const bed = new THREE.Mesh(
        new THREE.CylinderGeometry(0.6, 0.65, 0.24, 12),
        new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 })
      );
      bed.position.set(x, 0.12, z);
      park.add(bed);
      for (let f = 0; f < 5; f++) {
        const fl = new THREE.Mesh(
          new THREE.SphereGeometry(0.11, 8, 8),
          new THREE.MeshStandardMaterial({ color: flowerColors[(i + f) % flowerColors.length] })
        );
        fl.position.set(x + (Math.random() - 0.5) * 0.8, 0.32, z + (Math.random() - 0.5) * 0.8);
        park.add(fl);
      }
    });
    [[-12.5, -3], [-12.5, 5], [2.5, 7.5]].forEach(([x, z], i) => {
      const tree = this.makeOneTree(0.8 + i * 0.06, i % 2 === 0);
      tree.position.set(x, 0, z);
      park.add(tree);
    });
    city.add(park);

    // ---- Shared sign-maker: rounded canvas plate with emoji + text ----
    const makeSignPlane = (w: number, signText: string, signBg: string, signFg: string) => {
      const signCanvas = document.createElement("canvas");
      signCanvas.width = 512;
      signCanvas.height = 128;
      const ctx = signCanvas.getContext("2d")!;
      ctx.fillStyle = signBg;
      ctx.beginPath();
      ctx.roundRect(6, 6, 500, 116, 22);
      ctx.fill();
      ctx.fillStyle = signFg;
      // Auto-fit the text so long signs (e.g. 🛒 SUPERMARKET) never clip
      let size = 64;
      ctx.font = `bold ${size}px sans-serif`;
      const measured = ctx.measureText(signText).width;
      if (measured > 470) {
        size = Math.max(30, Math.floor((64 * 470) / measured));
        ctx.font = `bold ${size}px sans-serif`;
      }
      ctx.textAlign = "center";
      ctx.fillText(signText, 256, 86);
      return new THREE.Mesh(
        new THREE.PlaneGeometry(w, w * (128 / 512)),
        new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(signCanvas) })
      );
    };

    // ---- SUPERMARKET: long beige market hall with brick roof + corner pillars ----
    {
      const market = new THREE.Group();
      const w = 13;          // long facade (east-west)
      const h = 3.8;         // wall height
      const d = 6;           // depth
      const ov = 0.8;        // roof overhang
      const rh = 1.7;        // ridge height

      const beigeMat = new THREE.MeshStandardMaterial({ color: 0xe4d5ae, roughness: 0.75 });
      const pillarMat = new THREE.MeshStandardMaterial({ color: 0xcdb98a, roughness: 0.7 });
      const stoneMat = new THREE.MeshStandardMaterial({ color: 0xb3a077, roughness: 0.8 });

      // Walls
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), beigeMat);
      body.position.y = h / 2;
      body.castShadow = true;
      body.receiveShadow = true;
      market.add(body);

      // Four corner pillars (with little stone feet + caps)
      [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]].forEach(([px, pz]) => {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.5, h, 0.5), pillarMat);
        pillar.position.set(px, h / 2, pz);
        pillar.castShadow = true;
        market.add(pillar);
        const foot = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.34, 0.72), stoneMat);
        foot.position.set(px, 0.17, pz);
        market.add(foot);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.24, 0.72), stoneMat);
        cap.position.set(px, h - 0.12, pz);
        market.add(cap);
      });

      // Brick roof: two slanted slabs (brick canvas) meeting at a ridge
      const brickCanvas = document.createElement("canvas");
      brickCanvas.width = 256;
      brickCanvas.height = 128;
      const bCtx = brickCanvas.getContext("2d")!;
      bCtx.fillStyle = "#7f3b2d"; // mortar
      bCtx.fillRect(0, 0, 256, 128);
      for (let row = 0; row < 8; row++) {
        const y = row * 16;
        const offset = (row % 2) * 24;
        for (let col = 0; col < 6; col++) {
          const shade = [0xa8553f, 0x9c4c38, 0xb05a42][(row + col) % 3];
          bCtx.fillStyle = `#${shade.toString(16).padStart(6, "0")}`;
          bCtx.fillRect(offset + col * 48 - 24, y + 2, 44, 12);
          if (offset + col * 48 - 24 < 0) bCtx.fillRect(offset + col * 48 - 24 + 256, y + 2, 44, 12);
        }
      }
      const brickTex = new THREE.CanvasTexture(brickCanvas);
      brickTex.wrapS = THREE.RepeatWrapping;
      brickTex.wrapT = THREE.RepeatWrapping;
      brickTex.repeat.set(5, 2);
      const brickMat = new THREE.MeshStandardMaterial({ map: brickTex, roughness: 0.85 });

      const run = d / 2 + ov;
      const slope = Math.hypot(run, rh);
      const angle = Math.atan2(rh, run);
      const L = w + ov * 2;
      [1, -1].forEach((side) => {
        const slab = new THREE.Mesh(new THREE.BoxGeometry(L, 0.22, slope), brickMat);
        slab.position.set(0, h + rh / 2, (side * run) / 2);
        slab.rotation.x = side * angle;
        slab.castShadow = true;
        market.add(slab);
      });
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(L + 0.2, 0.2, 0.4), brickMat);
      ridge.position.set(0, h + rh + 0.02, 0);
      market.add(ridge);

      // Gable end triangles (beige) so the roof tent looks solid
      const gableShape = new THREE.Shape();
      gableShape.moveTo(-run, 0);
      gableShape.lineTo(run, 0);
      gableShape.lineTo(0, rh);
      gableShape.closePath();
      const gableGeom = new THREE.ShapeGeometry(gableShape);
      [1, -1].forEach((side) => {
        const gable = new THREE.Mesh(
          gableGeom,
          new THREE.MeshStandardMaterial({ color: 0xe4d5ae, roughness: 0.75, side: THREE.DoubleSide })
        );
        gable.rotation.y = (side * Math.PI) / 2;
        gable.position.set((side * w) / 2, h, 0);
        market.add(gable);
      });

      // Entrance sign directly over the glass doors (the big rooftop display
      // carries the name; this one marks the way in)
      const sign = makeSignPlane(4.2, "🛒 SUPERMARKET", "#0369a1", "#ffffff");
      sign.position.set(0, 3.25, d / 2 + 0.04);
      market.add(sign);
      const doorMat = new THREE.MeshStandardMaterial({
        color: 0xbfe6f5, roughness: 0.08, metalness: 0.5, transparent: true, opacity: 0.72,
        side: THREE.DoubleSide,
      });
      const frameMat = new THREE.MeshStandardMaterial({ color: 0xe8e8ec, metalness: 0.4, roughness: 0.4 });

      // ---- Sliding GLASS DOORS: click them and they open for Happy to walk in ----
      // Dark recess behind the opening (a little peek into the lit shop)
      const recess = new THREE.Mesh(
        new THREE.PlaneGeometry(3.1, 2.5),
        new THREE.MeshBasicMaterial({ color: 0x241d18 })
      );
      recess.position.set(0, 1.28, d / 2 - 0.16);
      market.add(recess);
      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(2.9, 0.5),
        new THREE.MeshBasicMaterial({ color: 0xffd9a0 })
      );
      glow.position.set(0, 2.3, d / 2 - 0.15);
      market.add(glow);
      // Header beam + side jambs around the entrance opening
      const header = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.3, 0.18), frameMat);
      header.position.set(0, 2.72, d / 2 + 0.02);
      market.add(header);
      [-1.62, 1.62].forEach((jx) => {
        const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.6, 0.18), frameMat);
        jamb.position.set(jx, 1.3, d / 2 + 0.02);
        market.add(jamb);
      });
      // The two sliding panels (grouped — they slide apart when the store opens)
      const mkDoorPanel = (side: 1 | -1) => {
        const panel = new THREE.Group();
        const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.32, 2.5), doorMat);
        glass.position.set(0, 1.3, 0);
        panel.add(glass);
        const edge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.5, 0.1), frameMat);
        edge.position.set(side * 0.62, 1.3, 0);
        panel.add(edge);
        const rail = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.09, 0.1), frameMat);
        rail.position.set(0, 2.52, 0);
        panel.add(rail);
        const handle = new THREE.Mesh(
          new THREE.CylinderGeometry(0.035, 0.035, 0.85, 8),
          new THREE.MeshStandardMaterial({ color: 0xb0b6bf, metalness: 0.85, roughness: 0.25 })
        );
        handle.position.set(side * 0.17, 1.25, 0.1);
        panel.add(handle);
        panel.position.set(side * 0.68, 0, d / 2 + 0.07);
        return panel;
      };
      this.supermarketDoorL = mkDoorPanel(-1);
      this.supermarketDoorR = mkDoorPanel(1);
      market.add(this.supermarketDoorL);
      market.add(this.supermarketDoorR);

      // Shop windows flanking the entrance
      [-4.4, 4.4].forEach((wx) => {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.5), doorMat);
        win.position.set(wx, 2.0, d / 2 + 0.05);
        market.add(win);
        const winFrame = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.7, 0.1), frameMat);
        winFrame.position.set(wx, 2.0, d / 2 + 0.01);
        market.add(winFrame);
      });

      // ---- ROOFTOP DISPLAY: a big SUPERMARKET billboard hanging over the roof ----
      {
        const postMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.6, roughness: 0.35 });
        [-3.2, 3.2].forEach((px) => {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.1, 0.18), postMat);
          post.position.set(px, h + rh + 0.7, 0);
          market.add(post);
        });
        const board = new THREE.Mesh(
          new THREE.BoxGeometry(8.8, 2.3, 0.2),
          new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 })
        );
        board.position.set(0, h + rh + 1.55, 0);
        board.castShadow = true;
        market.add(board);
        const bigSign = makeSignPlane(8.0, "🛒 SUPERMARKET", "#0369a1", "#ffffff");
        bigSign.position.set(0, h + rh + 1.55, 0.14);
        market.add(bigSign);
        const bigSignBack = makeSignPlane(8.0, "🛒 SUPERMARKET", "#0369a1", "#ffffff");
        bigSignBack.position.set(0, h + rh + 1.55, -0.14);
        bigSignBack.rotation.y = Math.PI;
        market.add(bigSignBack);
      }

      market.position.set(13.5, 0, -10);
      this.supermarketGroup = market;
      this.supermarketGroup.userData = { type: "supermarket" };
      this.supermarketGroup.traverse((c) => (c.userData = { type: "supermarket" }));
      city.add(this.supermarketGroup);
    }

    // ---- GYM: orange training hall with a GIANT dumbbell sign on the roof ----
    {
      const gym = new THREE.Group();
      const gw = 8;
      const gh = 4.2;
      const gd = 5;
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(gw, gh, gd),
        new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.6 })
      );
      body.position.y = gh / 2;
      body.castShadow = true;
      body.receiveShadow = true;
      gym.add(body);
      const sign = makeSignPlane(6.5, "🏋️ DOGGY GYM", "#9a3412", "#ffffff");
      sign.position.set(0, gh - 0.9, gd / 2 + 0.04);
      gym.add(sign);
      const doorMat = new THREE.MeshStandardMaterial({
        color: 0xbfe6f5, roughness: 0.08, metalness: 0.5, transparent: true, opacity: 0.85,
      });
      [-0.65, 0.65].forEach((dx) => {
        const door = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.0), doorMat);
        door.position.set(dx, 1.0, gd / 2 + 0.04);
        gym.add(door);
      });

      // The giant "handle": a chunky dumbbell resting on two rooftop posts
      const metalMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.35 });
      const plateMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.5, roughness: 0.45 });
      const dumbbell = new THREE.Group();
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 4.6, 12), metalMat);
      bar.rotation.z = Math.PI / 2;
      dumbbell.add(bar);
      [-1, 1].forEach((side) => {
        const plate1 = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.42, 20), plateMat);
        plate1.rotation.z = Math.PI / 2;
        plate1.position.x = side * 1.75;
        plate1.castShadow = true;
        dumbbell.add(plate1);
        const plate2 = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.4, 18), metalMat);
        plate2.rotation.z = Math.PI / 2;
        plate2.position.x = side * 2.25;
        plate2.castShadow = true;
        dumbbell.add(plate2);
      });
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 1.1, 12), metalMat);
      grip.rotation.z = Math.PI / 2;
      dumbbell.add(grip);
      // Two posts holding it up like a rooftop sign
      [-1.5, 1.5].forEach((px) => {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.1, 0.24), metalMat);
        post.position.set(px, gh + 0.55, 0);
        gym.add(post);
      });
      dumbbell.position.set(0, gh + 1.75, 0);
      this.gymDumbbell = dumbbell;
      gym.add(dumbbell);

      gym.position.set(-13, 0, -10);
      this.gymGroup = gym;
      this.gymGroup.userData = { type: "gym" };
      this.gymGroup.traverse((c) => (c.userData = { type: "gym" }));
      city.add(this.gymGroup);
    }

    // ---- Skyline backdrop (north edge) ----
    const skyline = new THREE.Group();
    const windowCanvas = document.createElement("canvas");
    windowCanvas.width = 64;
    windowCanvas.height = 64;
    const wCtx = windowCanvas.getContext("2d")!;
    wCtx.fillStyle = "#64748b";
    wCtx.fillRect(0, 0, 64, 64);
    for (let y = 6; y < 60; y += 12) {
      for (let x = 6; x < 60; x += 12) {
        wCtx.fillStyle = Math.random() > 0.35 ? "#fde68a" : "#94a3b8";
        wCtx.fillRect(x, y, 7, 7);
      }
    }
    const windowTex = new THREE.CanvasTexture(windowCanvas);
    windowTex.wrapS = THREE.RepeatWrapping;
    windowTex.wrapT = THREE.RepeatWrapping;
    for (let i = 0; i < 9; i++) {
      const h = 7 + Math.random() * 10;
      const tower = new THREE.Mesh(
        new THREE.BoxGeometry(3.4, h, 3.4),
        new THREE.MeshStandardMaterial({ map: windowTex, roughness: 0.7 })
      );
      tower.position.set(-28 + i * 7, h / 2, -42 - Math.random() * 3);
      skyline.add(tower);
    }
    city.add(skyline);

    // ---- Forest approach (south edge — the car drives through it) ----
    const forestApproach = new THREE.Group();
    for (let i = 0; i < 16; i++) {
      const t = this.makeOneTree(0.85 + ((i * 31) % 30) / 100, i % 2 === 0);
      let x = -18 + i * 2.4 + Math.random() * 1.2;
      // Keep the road mouth (and the whole carriageway) clearly open —
      // no tree trunks standing in the middle of the street!
      if (x > -1.5 && x < 8.5) x -= 10.5;
      t.position.set(x, 0, 19 + Math.random() * 7);
      forestApproach.add(t);
    }
    city.add(forestApproach);

    // ---- Parking lot (EAST of the street — the car drives in and parks here!) ----
    // Moved clear of the street: a proper hedge-framed lot with four painted
    // spots. Three city cars (blue, yellow, purple) are already parked; the
    // deep free spot is saved for the red one coming in off the street.
    const lot = new THREE.Group();
    const lotPad = new THREE.Mesh(
      new THREE.PlaneGeometry(9.2, 8.8),
      new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.95 })
    );
    lotPad.geometry.rotateX(-Math.PI / 2);
    lotPad.position.set(11.8, 0.02, 3.8);
    lotPad.receiveShadow = true;
    lot.add(lotPad);
    // Driveway apron crossing the sidewalk (street → lot lane)
    const apron = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 1.8),
      new THREE.MeshStandardMaterial({ color: 0x565d64, roughness: 0.95 })
    );
    apron.geometry.rotateX(-Math.PI / 2);
    apron.position.set(6.9, 0.025, 8.0);
    apron.userData = { type: "city_floor" };
    lot.add(apron);
    // Painted white spot dividers (4 spots along the lot, stacked in z)
    [1.9, 3.6, 5.3].forEach((z) => {
      const line = new THREE.Mesh(
        new THREE.BoxGeometry(6.8, 0.01, 0.12),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      line.position.set(12.3, 0.03, z);
      lot.add(line);
    });
    // Outer edge lines (softer white)
    [0.2, 7.0].forEach((z) => {
      const line = new THREE.Mesh(
        new THREE.BoxGeometry(6.8, 0.01, 0.1),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 })
      );
      line.position.set(12.3, 0.03, z);
      lot.add(line);
    });

    // Trimmed leafy hedges framing the lot (north, east & south sides)
    const makeHedge = (length: number, alongX: boolean): THREE.Group => {
      const hedge = new THREE.Group();
      const core = new THREE.Mesh(
        new THREE.BoxGeometry(alongX ? length : 0.55, 0.62, alongX ? 0.55 : length),
        new THREE.MeshStandardMaterial({ color: 0x2f6b2f, roughness: 0.95 })
      );
      core.position.y = 0.31;
      core.castShadow = true;
      hedge.add(core);
      const leafMatA = new THREE.MeshStandardMaterial({ color: 0x3f7d3a, roughness: 0.95 });
      const leafMatB = new THREE.MeshStandardMaterial({ color: 0x4c8f45, roughness: 0.95 });
      const leafMatC = new THREE.MeshStandardMaterial({ color: 0x5aa050, roughness: 0.95 });
      const blobs = Math.max(3, Math.round(length / 0.42));
      for (let i = 0; i < blobs; i++) {
        const t = (i / (blobs - 1) - 0.5) * length;
        const blob = new THREE.Mesh(
          new THREE.SphereGeometry(0.3 + Math.random() * 0.1, 8, 8),
          i % 3 === 0 ? leafMatA : i % 3 === 1 ? leafMatB : leafMatC
        );
        const side = (Math.random() - 0.5) * 0.5;
        blob.position.set(
          alongX ? t : side,
          0.58 + Math.random() * 0.16,
          alongX ? side : t
        );
        blob.castShadow = true;
        hedge.add(blob);
      }
      return hedge;
    };
    const hedgeN = makeHedge(9.4, true);
    hedgeN.position.set(12.0, 0, -0.55);
    lot.add(hedgeN);
    const hedgeE = makeHedge(8.8, false);
    hedgeE.position.set(16.55, 0, 3.8);
    lot.add(hedgeE);
    const hedgeS = makeHedge(7.6, true);
    hedgeS.position.set(12.9, 0, 8.3);
    lot.add(hedgeS);

    // Three neighbours already parked: blue, yellow & purple!
    const makeParkedCar = (bodyColor: number, cabinColor: number): THREE.Group => {
      const parked = new THREE.Group();
      const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.35, metalness: 0.25 });
      const cabMat = new THREE.MeshStandardMaterial({ color: cabinColor, roughness: 0.25, metalness: 0.3 });
      const tireMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.9 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.58, 2.75), bodyMat);
      body.position.y = 0.58;
      body.castShadow = true;
      parked.add(body);
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.52, 1.25), cabMat);
      cabin.position.set(0, 1.08, -0.25);
      cabin.castShadow = true;
      parked.add(cabin);
      [[-0.82, 0.95], [0.82, 0.95], [-0.82, -0.95], [0.82, -0.95]].forEach(([x, z]) => {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.22, 12), tireMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(x, 0.3, z);
        parked.add(wheel);
      });
      return parked;
    };
    const parkedSpots: { color: number; cabin: number; z: number }[] = [
      { color: 0x3b82f6, cabin: 0xbfdbfe, z: 6.15 }, // blue
      { color: 0xfacc15, cabin: 0xfef3c7, z: 4.45 }, // yellow
      { color: 0xa855f7, cabin: 0xe9d5ff, z: 2.75 }, // purple
    ];
    parkedSpots.forEach(({ color, cabin, z }) => {
      const car = makeParkedCar(color, cabin);
      car.rotation.y = Math.PI / 2; // nose-in, facing east
      car.position.set(12.2, 0, z);
      car.userData = { type: "city_floor" }; // scenery — no click behaviour
      car.traverse((c) => (c.userData = { type: "city_floor" }));
      lot.add(car);
    });

    // Little 🅿️ sign post by the driveway
    const signPole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 1.8, 8),
      new THREE.MeshStandardMaterial({ color: 0xd6d6d6, metalness: 0.6 })
    );
    signPole.position.set(8.7, 0.9, 8.9);
    lot.add(signPole);
    const signCanvas = document.createElement("canvas");
    signCanvas.width = 96;
    signCanvas.height = 96;
    const pCtx = signCanvas.getContext("2d")!;
    pCtx.fillStyle = "#1d4ed8";
    pCtx.beginPath();
    pCtx.roundRect(4, 4, 88, 88, 14);
    pCtx.fill();
    pCtx.fillStyle = "#ffffff";
    pCtx.font = "bold 60px sans-serif";
    pCtx.textAlign = "center";
    pCtx.fillText("P", 48, 70);
    const signPlate = new THREE.Mesh(
      new THREE.PlaneGeometry(0.7, 0.7),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(signCanvas), side: THREE.DoubleSide })
    );
    signPlate.position.set(8.7, 1.85, 8.9);
    signPlate.rotation.y = Math.PI / 4;
    lot.add(signPlate);
    this.cityGroup.add(lot);

    // ---- SECOND PARKING LOT: behind the Cake Store (east side, never on
    // the left of the road). The sat-nav route for the Cake Store swings
    // right off the street, glides along the shop's south side, turns up its
    // east side and parks here — directly BEHIND the pink cake shop. ----
    const lot2 = new THREE.Group();
    // Driveway strip from the street, along the south side of the Cake Store
    const drive2 = new THREE.Mesh(
      new THREE.PlaneGeometry(12.6, 3.0),
      new THREE.MeshStandardMaterial({ color: 0x565d64, roughness: 0.95 })
    );
    drive2.geometry.rotateX(-Math.PI / 2);
    drive2.position.set(11.2, 0.025, -21.4);
    drive2.userData = { type: "city_floor" };
    lot2.add(drive2);
    // Lane strip climbing the west side of the lot from the driveway
    const lane2 = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 6.4),
      new THREE.MeshStandardMaterial({ color: 0x565d64, roughness: 0.95 })
    );
    lane2.geometry.rotateX(-Math.PI / 2);
    lane2.position.set(17.05, 0.025, -23.7);
    lane2.userData = { type: "city_floor" };
    lot2.add(lane2);
    // Lot pad
    const lotPad2 = new THREE.Mesh(
      new THREE.PlaneGeometry(9.2, 8.8),
      new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.95 })
    );
    lotPad2.geometry.rotateX(-Math.PI / 2);
    lotPad2.position.set(20.8, 0.02, -31.0);
    lotPad2.receiveShadow = true;
    lotPad2.userData = { type: "city_floor" };
    lot2.add(lotPad2);
    // Painted white spot dividers (same 4-spot pattern as the first lot)
    [-29.3, -31.0, -32.7].forEach((z) => {
      const line = new THREE.Mesh(
        new THREE.BoxGeometry(6.8, 0.01, 0.12),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      line.position.set(21.3, 0.03, z);
      lot2.add(line);
    });
    [-27.6, -34.4].forEach((z) => {
      const line = new THREE.Mesh(
        new THREE.BoxGeometry(6.8, 0.01, 0.1),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 })
      );
      line.position.set(21.3, 0.03, z);
      lot2.add(line);
    });
    // Leafy hedges around the lot (south side leaves the lane gap open)
    const hedge2N = makeHedge(9.4, true);
    hedge2N.position.set(21.0, 0, -35.45);
    lot2.add(hedge2N);
    const hedge2E = makeHedge(8.8, false);
    hedge2E.position.set(25.55, 0, -31.0);
    lot2.add(hedge2E);
    const hedge2S = makeHedge(7.4, true);
    hedge2S.position.set(22.1, 0, -26.55);
    lot2.add(hedge2S);
    // Three neighbours already parked behind the shop: blue, yellow, purple
    const parkedSpots2: { color: number; cabin: number; z: number }[] = [
      { color: 0x3b82f6, cabin: 0xbfdbfe, z: -28.45 }, // blue
      { color: 0xfacc15, cabin: 0xfef3c7, z: -30.15 }, // yellow
      { color: 0xa855f7, cabin: 0xe9d5ff, z: -31.85 }, // purple
    ];
    parkedSpots2.forEach(({ color, cabin, z }) => {
      const car = makeParkedCar(color, cabin);
      car.rotation.y = Math.PI / 2; // nose-in, facing east
      car.position.set(21.2, 0, z);
      car.userData = { type: "city_floor" };
      car.traverse((c) => (c.userData = { type: "city_floor" }));
      lot2.add(car);
    });
    // Little 🅿️ sign by the driveway corner
    const signPole2 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 1.8, 8),
      new THREE.MeshStandardMaterial({ color: 0xd6d6d6, metalness: 0.6 })
    );
    signPole2.position.set(15.4, 0.9, -19.7);
    lot2.add(signPole2);
    const signPlate2 = new THREE.Mesh(
      new THREE.PlaneGeometry(0.7, 0.7),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(signCanvas), side: THREE.DoubleSide })
    );
    signPlate2.position.set(15.4, 1.85, -19.7);
    signPlate2.rotation.y = Math.PI / 4;
    lot2.add(signPlate2);
    this.cityGroup.add(lot2);

    // ---- THE BIRTHDAY CAKE STORE (pink house at the end of the extended road) ----
    {
      const store = new THREE.Group();
      const sw = 7;    // depth (x, west→east)
      const sh = 4.4;  // wall height
      const sl = 10;   // length (z)
      const pinkMat = new THREE.MeshStandardMaterial({ color: 0xf9a8d4, roughness: 0.7 });
      const deepPinkMat = new THREE.MeshStandardMaterial({ color: 0xec4899, roughness: 0.65 });
      const creamMat = new THREE.MeshStandardMaterial({ color: 0xfff1f2, roughness: 0.6 });

      // Pink walls
      const body = new THREE.Mesh(new THREE.BoxGeometry(sw, sh, sl), pinkMat);
      body.position.y = sh / 2;
      body.castShadow = true;
      body.receiveShadow = true;
      store.add(body);
      // White base skirt + corner trim
      const skirt = new THREE.Mesh(new THREE.BoxGeometry(sw + 0.2, 0.5, sl + 0.2), creamMat);
      skirt.position.y = 0.25;
      store.add(skirt);
      [[-sw / 2, -sl / 2], [sw / 2, -sl / 2], [-sw / 2, sl / 2], [sw / 2, sl / 2]].forEach(([px, pz]) => {
        const trim = new THREE.Mesh(new THREE.BoxGeometry(0.34, sh, 0.34), creamMat);
        trim.position.set(px, sh / 2, pz);
        trim.castShadow = true;
        store.add(trim);
      });

      // Flat cream roof with a pink parapet (the cake stage)
      const roof = new THREE.Mesh(new THREE.BoxGeometry(sw + 0.6, 0.32, sl + 0.6), creamMat);
      roof.position.y = sh + 0.16;
      roof.receiveShadow = true;
      store.add(roof);
      const parapetMat = deepPinkMat;
      [[0, -sl / 2 - 0.15, sw + 0.6, 0.3], [0, sl / 2 + 0.15, sw + 0.6, 0.3]].forEach(([px, pz, w, d]) => {
        const parapet = new THREE.Mesh(new THREE.BoxGeometry(w, 0.34, d), parapetMat);
        parapet.position.set(px, sh + 0.48, pz);
        store.add(parapet);
      });
      [[-sw / 2 - 0.15, 0], [sw / 2 + 0.15, 0]].forEach(([px, pz]) => {
        const parapet = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.34, sl + 0.6), parapetMat);
        parapet.position.set(px, sh + 0.48, pz);
        store.add(parapet);
      });

      // THE GIANT ROUND CAKE on the roof, with a candle on top!
      const cake = new THREE.Group();
      const tier1 = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 1.0, 28), pinkMat);
      tier1.position.y = 0.5;
      tier1.castShadow = true;
      cake.add(tier1);
      const frost1 = new THREE.Mesh(new THREE.TorusGeometry(2.28, 0.14, 10, 32), creamMat);
      frost1.rotation.x = Math.PI / 2;
      frost1.position.y = 1.0;
      cake.add(frost1);
      const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(1.65, 1.65, 0.85, 24), creamMat);
      tier2.position.y = 1.42;
      tier2.castShadow = true;
      cake.add(tier2);
      const frost2 = new THREE.Mesh(new THREE.TorusGeometry(1.63, 0.12, 10, 28), deepPinkMat);
      frost2.rotation.x = Math.PI / 2;
      frost2.position.y = 1.85;
      cake.add(frost2);
      const tier3 = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.72, 22), pinkMat);
      tier3.position.y = 2.2;
      tier3.castShadow = true;
      cake.add(tier3);
      // Cherries around the tiers
      const cherryMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3 });
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const cherry = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), cherryMat);
        cherry.position.set(Math.sin(a) * 2.05, 1.02, Math.cos(a) * 2.05);
        cake.add(cherry);
      }
      // Candle
      const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 1.0, 12), creamMat);
      candle.position.y = 3.07;
      cake.add(candle);
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.11, 0.34, 10),
        new THREE.MeshStandardMaterial({ color: 0xffa500, emissive: 0xffa500, emissiveIntensity: 2.2 })
      );
      flame.position.y = 3.72;
      cake.add(flame);
      this.cakeCandleFlame = flame;
      const candleGlow = new THREE.PointLight(0xffc266, 0.9, 7);
      candleGlow.position.y = 3.7;
      cake.add(candleGlow);
      cake.position.set(0, sh + 0.32, 0);
      store.add(cake);

      // Two glass doors on the WEST face (toward the road) + frames
      const doorMat = new THREE.MeshStandardMaterial({
        color: 0xbfe6f5, roughness: 0.08, metalness: 0.5, transparent: true, opacity: 0.85,
      });
      const frameMat = creamMat;
      [-0.78, 0.78].forEach((dz) => {
        const door = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.4), doorMat);
        door.position.set(-sw / 2 - 0.01, 1.25, dz);
        door.rotation.y = -Math.PI / 2;
        store.add(door);
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.6, 1.5), frameMat);
        frame.position.set(-sw / 2 - 0.04, 1.3, dz);
        store.add(frame);
      });
      const doorMatPlate = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.05, 2.6),
        new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.9 })
      );
      doorMatPlate.position.set(-sw / 2 - 0.5, 0.03, 0);
      store.add(doorMatPlate);

      // Big shop windows on the west + south faces
      [[-sw / 2, -3.2], [-sw / 2, 3.2]].forEach(([px, pz]) => {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.6), doorMat);
        win.position.set(px - 0.01, 2.0, pz);
        win.rotation.y = -Math.PI / 2;
        store.add(win);
        const wFrame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.85, 2.45), frameMat);
        wFrame.position.set(px - 0.04, 2.0, pz);
        store.add(wFrame);
      });
      [[-1.8], [1.8]].forEach(([px]) => {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.6), doorMat);
        win.position.set(px, 2.0, sl / 2 + 0.01);
        store.add(win);
        const wFrame = new THREE.Mesh(new THREE.BoxGeometry(2.45, 1.85, 0.1), frameMat);
        wFrame.position.set(px, 2.0, sl / 2 + 0.04);
        store.add(wFrame);
      });

      // Signs: above the doors (west) + facing the road-approach (south)
      const makeSign = (signText: string) => {
        const c = document.createElement("canvas");
        c.width = 512;
        c.height = 128;
        const ctx = c.getContext("2d")!;
        ctx.fillStyle = "#db2777";
        ctx.beginPath();
        ctx.roundRect(6, 6, 500, 116, 22);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 58px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(signText, 256, 84);
        return new THREE.Mesh(
          new THREE.PlaneGeometry(3.6, 0.9),
          new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c) })
        );
      };
      const signW = makeSign("🎂 CAKE STORE");
      signW.position.set(-sw / 2 - 0.06, sh - 0.55, 0);
      signW.rotation.y = -Math.PI / 2;
      store.add(signW);
      const signS = makeSign("🎂 CAKE STORE");
      signS.position.set(0, sh - 0.55, sl / 2 + 0.06);
      store.add(signS);

      store.position.set(11.5, 0, -30);
      this.cakeStoreGroup = store;
      this.cakeStoreGroup.userData = { type: "cakestore" };
      this.cakeStoreGroup.traverse((c) => (c.userData = { type: "cakestore" }));
      city.add(this.cakeStoreGroup);
    }

    // Strolling dog NPCs in the fountain park + birthday party decor
    this.setupCityDogNpcs();
    this.setupBirthdayPartyDecor();

    // Warm city lighting
    const cityLight = new THREE.PointLight(0xfff1b8, 1.4, 30);
    cityLight.position.set(-5, 6, 1);
    city.add(cityLight);
  }

  // ================= SUPERMARKET GLASS DOORS =================

  /**
   * Happy asks the supermarket doors to open: he trots up to the entrance,
   * the glass panels slide apart, he steps inside — and the shopping game
   * opens (fired through onSupermarketClicked once he's through).
   */
  private beginSupermarketEntry() {
    if (this.supermarketState !== "idle") return;
    this.supermarketState = "walkToDoor";
    this.supermarketDoorTarget = 1;
    this.supermarketEntryTimeout = 20;
    sound.playButtonTap();
    // World coordinates of the market entrance (market sits at 13.5, -10)
    const doorFront = new THREE.Vector3(13.5, 0, -6.15);
    this.walkTo(doorFront, () => {
      if (this.supermarketState !== "walkToDoor") return;
      this.supermarketState = "stepIn";
      this.supermarketEntryTimeout = 8;
      const insidePoint = new THREE.Vector3(13.5, 0, -6.8);
      this.walkTo(insidePoint, () => {
        if (this.supermarketState !== "stepIn") return;
        this.supermarketState = "idle";
        this.supermarketDoorTarget = 0; // doors close behind him
        sound.playSoftWoof();
        if (this.onSupermarketClicked) this.onSupermarketClicked();
      });
    });
  }

  /** Slide the glass doors toward their target and guard the choreography. */
  private updateSupermarketDoors(delta: number) {
    if (!this.supermarketDoorL || !this.supermarketDoorR) return;
    if (this.supermarketState !== "idle") {
      this.supermarketEntryTimeout -= delta;
      if (this.supermarketEntryTimeout <= 0) {
        // The walk got interrupted (player tapped elsewhere) — reset safely
        this.supermarketState = "idle";
        this.supermarketDoorTarget = 0;
      }
    }
    const diff = this.supermarketDoorTarget - this.supermarketDoorProgress;
    if (Math.abs(diff) > 0.001) {
      this.supermarketDoorProgress = THREE.MathUtils.clamp(
        this.supermarketDoorProgress + Math.sign(diff) * delta * 1.6,
        0,
        1
      );
      const slide = this.supermarketDoorProgress * 1.05;
      this.supermarketDoorL.position.x = -0.68 - slide;
      this.supermarketDoorR.position.x = 0.68 + slide;
    }
  }

  // ================= CITY DOG NPCS (the fountain-park woofers) =================

  /** Three dogs stroll the fountain plaza. They only ever WOOF — the bubble
   *  reveals what the barks actually mean (hit them to hear the next line). */
  private setupCityDogNpcs() {
    const defs: {
      name: string;
      breed: DogBreed;
      collar: string;
      home: [number, number];
      radius: number;
      lines: { woof: string; meaning: string }[];
      partyLines: { woof: string; meaning: string }[];
    }[] = [
      {
        name: "Rex",
        breed: "husky",
        collar: "#2563eb",
        home: [-8.6, -1.6],
        radius: 1.7,
        lines: [
          { woof: "Woof! Woof-woof woooof!", meaning: "Good afternoon! You're the new face around the fountain, aren't you?" },
          { woof: "Grrr-woof! Woof woof!", meaning: "Careful — that puddle by the bench is deeper than it looks. I tested it. Twice." },
          { woof: "Woooooof… woof!", meaning: "The pigeons think they run this plaza. Between us, I let them believe it." },
          { woof: "Woof! Woof-woof-woof!", meaning: "If you ever find a bone near the fountain… it's mine. But I might share. Might." },
        ],
        partyLines: [
          { woof: "WOOF WOOF WOOF!", meaning: "HAPPY BIRTHDAY! I've been barking it all morning — my throat is gone and my tail won't stop." },
          { woof: "Woof! Woooof!", meaning: "The cake store dog baked all night. The whole park smells like frosting. Best day ever." },
        ],
      },
      {
        name: "Bella",
        breed: "corgi",
        collar: "#db2777",
        home: [-1.9, -0.8],
        radius: 1.5,
        lines: [
          { woof: "Yip yip! Woof!", meaning: "Oh my paws, hiii! You smell like park grass and adventure!" },
          { woof: "Woof-woof! Yip yip!", meaning: "I saw the ice-cream truck this morning. It drove PAST. I'm still recovering." },
          { woof: "Woof! Woooof…", meaning: "The fountain water? Cold. Very cold. I checked with my whole face." },
          { woof: "Yip! Woof woof!", meaning: "Your human lets you choose the walk route? Mine calls it 'trust'. It is not trust." },
        ],
        partyLines: [
          { woof: "Yip yip! WOOF!", meaning: "HAPPY BIRTHDAY!! I helped bake the cake! I mostly watched. I definitely taste-tested." },
          { woof: "Woof! Yip!", meaning: "Balloons! BALLOONS! One of them looked at me funny, so I'm staying close to you." },
        ],
      },
      {
        name: "Milo",
        breed: "dalmatian",
        collar: "#7c3aed",
        home: [-5.2, 5.0],
        radius: 1.5,
        lines: [
          { woof: "Woof… woooof…", meaning: "Do you ever wonder why the fountain never stops talking? It just… woofs water all day." },
          { woof: "Woof! Woof!", meaning: "I'm practicing my howl. I'm told it's 'a lot'. I'm working on it." },
          { woof: "Woof-woof! Woof…", meaning: "Someday I'll catch my own tail. Today is not that day. Tomorrow isn't looking great either." },
          { woof: "Woooof! Yip!", meaning: "Stick close to the cake store on your birthday. Trust me. The whole city smells like frosting." },
        ],
        partyLines: [
          { woof: "WOOOOF! Woof!", meaning: "Happy birthday, friend! I wished for you to catch your tail one day. Dreams are important." },
          { woof: "Woof… woof!", meaning: "The fountain is spraying in rhythm with the birthday song. I think. Or I'm just very happy." },
        ],
      },
    ];

    defs.forEach((d) => {
      const model = new Dog3D(d.breed, d.collar);
      model.group.scale.setScalar(0.85);
      model.group.position.set(d.home[0], 0, d.home[1]);
      model.group.rotation.y = Math.random() * Math.PI * 2;
      model.setAction("idle");
      this.cityGroup.add(model.group);
      this.cityNpcs.push({
        model,
        name: d.name,
        home: new THREE.Vector3(d.home[0], 0, d.home[1]),
        radius: d.radius,
        target: null,
        wait: 1 + Math.random() * 3,
        speed: 0.75 + Math.random() * 0.35,
        lines: d.lines,
        partyLines: d.partyLines,
        lineIdx: 0,
        barkCooldown: 4 + Math.random() * 6,
      });
    });
  }

  /**
   * Canvas speech-bubble sprite. Lines are auto-wrapped & centered so
   * long "translations" never overflow the bubble.
   */
  private makeSpeechSprite(opts: {
    lines: { text: string; size: number; color: string; bold?: boolean; italic?: boolean }[];
    canvasW?: number;
    canvasH?: number;
    bg?: string;
    border?: string;
    /** World-units per canvas pixel. */
    pxPerUnit?: number;
  }): THREE.Sprite {
    const W = opts.canvasW ?? 560;
    const H = opts.canvasH ?? 320;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;

    // Bubble plate + tail
    const pad = 10;
    const tailH = 34;
    const bottom = H - tailH;
    ctx.fillStyle = opts.bg ?? "rgba(255, 255, 255, 0.97)";
    ctx.strokeStyle = opts.border ?? "#3f3f46";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(pad, pad, W - pad * 2, bottom - pad, 26);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(W / 2 - 20, bottom - 2);
    ctx.lineTo(W / 2 + 20, bottom - 2);
    ctx.lineTo(W / 2, bottom + tailH - 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Cover the tail outline seam on the bubble edge
    ctx.fillStyle = opts.bg ?? "rgba(255, 255, 255, 0.97)";
    ctx.fillRect(W / 2 - 18, bottom - 8, 36, 10);

    // Text: wrap every line to the bubble width
    const maxWidth = W - pad * 2 - 44;
    const layout: { text: string; size: number; color: string; bold?: boolean; italic?: boolean }[] = [];
    opts.lines.forEach((line) => {
      ctx.font = `${line.italic ? "italic " : ""}${line.bold ? "bold " : ""}${line.size}px sans-serif`;
      const words = line.text.split(" ");
      let current = "";
      words.forEach((word) => {
        const test = current ? `${current} ${word}` : word;
        if (ctx.measureText(test).width > maxWidth && current) {
          layout.push({ ...line, text: current });
          current = word;
        } else {
          current = test;
        }
      });
      if (current) layout.push({ ...line, text: current });
    });
    const totalH = layout.reduce((acc, l) => acc + l.size * 1.32, 0);
    let y = pad + (bottom - pad - totalH) / 2 + 6;
    ctx.textAlign = "center";
    layout.forEach((l) => {
      ctx.font = `${l.italic ? "italic " : ""}${l.bold ? "bold " : ""}${l.size}px sans-serif`;
      ctx.fillStyle = l.color;
      y += l.size * 1.32;
      ctx.fillText(l.text, W / 2, y - l.size * 0.32);
    });

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })
    );
    const ppu = opts.pxPerUnit ?? 160;
    sprite.scale.set(W / ppu, H / ppu, 1);
    sprite.renderOrder = 999;
    return sprite;
  }

  private disposeSprite(sprite: THREE.Sprite | null) {
    if (!sprite) return;
    (sprite.material as THREE.SpriteMaterial).map?.dispose();
    (sprite.material as THREE.SpriteMaterial).dispose();
    sprite.parent?.remove(sprite);
  }

  /** Show the next bark line above a city NPC (woof + doggy translation). */
  private showCityNpcBubble(npc: CityNpc) {
    const pool = this.birthdayMode ? npc.partyLines : npc.lines;
    const line = pool[npc.lineIdx % pool.length];
    npc.lineIdx += 1;
    this.disposeSprite(this.cityBubble);
    this.cityBubble = this.makeSpeechSprite({
      canvasW: 560,
      canvasH: 330,
      lines: [
        { text: `${npc.name} 🐾`, size: 26, color: "#9d174d", bold: true },
        { text: line.woof, size: 46, color: "#111827", bold: true },
        { text: `(it means: “${line.meaning}”)`, size: 25, color: "#4b5563", italic: true },
      ],
    });
    const p = npc.model.group.position;
    this.cityBubble.position.set(p.x, 2.65, p.z);
    this.cityGroup.add(this.cityBubble);
    this.cityBubbleTimer = 7.5;
  }

  /** Happy walks up to a strolling NPC and it barks at him. */
  private talkToCityNpc(idx: number) {
    const npc = this.cityNpcs[idx];
    if (!npc) return;
    this.npcTalkingIdx = idx;
    npc.target = null;
    npc.wait = Math.max(npc.wait, 3.5);
    // Face Happy
    const dx = this.dog.group.position.x - npc.model.group.position.x;
    const dz = this.dog.group.position.z - npc.model.group.position.z;
    if (Math.hypot(dx, dz) > 0.01) {
      npc.model.group.rotation.y = Math.atan2(dx, dz);
    }
    npc.model.setAction("bark", 1.5);
    sound.playBark(idx === 0 ? "low" : idx === 1 ? "high" : "normal");
    this.showCityNpcBubble(npc);
  }

  /** One big bubble over the plaza: ALL the dogs scream "Happy Birthday!" */
  private showPartyScream() {
    this.disposeSprite(this.partyBubble);
    this.partyBubble = this.makeSpeechSprite({
      canvasW: 780,
      canvasH: 300,
      bg: "rgba(255, 241, 242, 0.97)",
      border: "#db2777",
      lines: [
        { text: "🎉 HAPPY BIRTHDAY! 🎂", size: 78, color: "#db2777", bold: true },
        { text: "Every dog in the park howls it together! (Woof-woof, translated.)", size: 26, color: "#831843", italic: true },
      ],
    });
    this.partyBubble.position.set(-5, 4.3, 1.2);
    this.cityGroup.add(this.partyBubble);
    this.partyBubbleTimer = 9.5;
    // The whole pack joins in!
    this.cityNpcs.forEach((npc, i) => {
      npc.target = null;
      npc.wait = Math.max(npc.wait, 4);
      npc.model.setAction(i % 2 === 0 ? "howl" : "bark", 2.6);
      const dx = -5 - npc.model.group.position.x;
      const dz = 1 - npc.model.group.position.z;
      npc.model.group.rotation.y = Math.atan2(dx, dz);
    });
    sound.playRewardFanfare();
    if (this.onPartyScream) this.onPartyScream();
  }

  /** Happy's own cycling birthday bubbles. */
  private refreshHappyBirthdayBubble() {
    this.disposeSprite(this.happyBubble);
    if (!this.birthdayMode) return;
    const lines = this.happyBubbleIdx === 0
      ? [
          { text: "HAPPY", size: 116, color: "#db2777", bold: true },
          { text: "Birthday! 🎂", size: 52, color: "#111827", bold: true },
          { text: "(HAPPY is my name — clever, right?)", size: 24, color: "#6b7280", italic: true },
        ]
      : [
          { text: "Don't you want to drive to the city? 🚗", size: 44, color: "#111827", bold: true },
          { text: "The party is waiting in the fountain park!", size: 26, color: "#6b7280", italic: true },
        ];
    this.happyBubble = this.makeSpeechSprite({ canvasW: 640, canvasH: 330, lines });
    const p = this.dog.group.position;
    this.happyBubble.position.set(p.x, 3.1, p.z);
    this.scene.add(this.happyBubble);
    this.happyBubbleTimer = 8.5;
  }

  /** Toggle birthday-party mode: party hats, tree of balloons & the big scream. */
  public setBirthdayMode(active: boolean) {    this.birthdayMode = active;
    this.partyGroup.visible = active;
    // Happy gets the one-and-only striped cone hat (not sold in any shop!)
    this.dog.setHolidayHat(active ? "party" : this.holiday === "christmas" ? "santa" : "none");
    this.cityNpcs.forEach((npc) => npc.model.setHolidayHat(active ? "party" : "none"));
    this.partyScreamDone = false;
    if (!active) {
      this.disposeSprite(this.happyBubble);
      this.happyBubble = null;
      this.disposeSprite(this.partyBubble);
      this.partyBubble = null;
    } else {
      this.happyBubbleIdx = 0;
      this.happyBubbleTimer = 0.8;
    }
  }

  // ================= BIRTHDAY PARTY DECOR =================

  /** Balloons, a banner and a cake table that appear in the city on birthdays. */
  private setupBirthdayPartyDecor() {
    this.partyGroup = new THREE.Group();
    this.partyGroup.visible = false;

    // Banner between two poles over the plaza
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.6 });
    [[-9.4, 1.5], [-0.6, 1.5]].forEach(([px, pz]) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 4.0, 10), poleMat);
      pole.position.set(px, 2.0, pz);
      pole.castShadow = true;
      this.partyGroup.add(pole);
    });
    const bannerCanvas = document.createElement("canvas");
    bannerCanvas.width = 1024;
    bannerCanvas.height = 192;
    const bctx = bannerCanvas.getContext("2d")!;
    bctx.fillStyle = "#fdf2f8";
    bctx.beginPath();
    bctx.roundRect(4, 4, 1016, 184, 22);
    bctx.fill();
    bctx.strokeStyle = "#db2777";
    bctx.lineWidth = 10;
    bctx.stroke();
    bctx.fillStyle = "#db2777";
    bctx.font = "bold 92px sans-serif";
    bctx.textAlign = "center";
    bctx.fillText("🎉 HAPPY BIRTHDAY! 🎂", 512, 124);
    const banner = new THREE.Mesh(
      new THREE.PlaneGeometry(8.6, 1.6),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(bannerCanvas), side: THREE.DoubleSide })
    );
    banner.position.set(-5, 3.35, 1.5);
    this.partyGroup.add(banner);

    // Balloon clusters (fountain park + cake store front)
    const balloonColors = [0xf472b6, 0xfacc15, 0x60a5fa, 0xa855f7, 0x4ade80];
    const makeBalloonCluster = (cx: number, cz: number) => {
      const cluster = new THREE.Group();
      for (let i = 0; i < 5; i++) {
        const color = balloonColors[i % balloonColors.length];
        const balloon = new THREE.Mesh(
          new THREE.SphereGeometry(0.3, 12, 12),
          new THREE.MeshStandardMaterial({ color, roughness: 0.25 })
        );
        balloon.scale.set(1, 1.22, 1);
        balloon.position.set(
          (Math.random() - 0.5) * 1.1,
          2.4 + Math.random() * 0.9,
          (Math.random() - 0.5) * 1.1
        );
        balloon.castShadow = true;
        cluster.add(balloon);
        const string = new THREE.Mesh(
          new THREE.CylinderGeometry(0.012, 0.012, 1.0, 6),
          new THREE.MeshBasicMaterial({ color: 0xffffff })
        );
        string.position.set(balloon.position.x, balloon.position.y - 0.9, balloon.position.z);
        cluster.add(string);
      }
      cluster.position.set(cx, 0, cz);
      this.partyGroup.add(cluster);
    };
    makeBalloonCluster(-9.6, -2.7);
    makeBalloonCluster(-0.4, -2.7);
    makeBalloonCluster(-9.6, 4.7);
    makeBalloonCluster(7.4, -26.2);
    makeBalloonCluster(7.4, -33.8);

    // Party table with a big cake near the fountain
    const table = new THREE.Group();
    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(1.15, 1.15, 0.12, 20),
      new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.6 })
    );
    top.position.y = 0.92;
    top.castShadow = true;
    table.add(top);
    const tablecloth = new THREE.Mesh(
      new THREE.CylinderGeometry(1.05, 1.2, 0.75, 20, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xfbcfe8, roughness: 0.8, side: THREE.DoubleSide })
    );
    tablecloth.position.y = 0.5;
    table.add(tablecloth);
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.16, 0.9, 10),
      new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.6 })
    );
    leg.position.y = 0.45;
    table.add(leg);
    // Big cake on the table
    const tableCake = new THREE.Group();
    const t1 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.62, 0.34, 20),
      new THREE.MeshStandardMaterial({ color: 0xf9a8d4, roughness: 0.6 })
    );
    t1.position.y = 0.17;
    t1.castShadow = true;
    tableCake.add(t1);
    const t2 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, 0.28, 18),
      new THREE.MeshStandardMaterial({ color: 0xfff1f2, roughness: 0.6 })
    );
    t2.position.y = 0.48;
    tableCake.add(t2);
    const candle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8),
      new THREE.MeshStandardMaterial({ color: 0x60a5fa, roughness: 0.5 })
    );
    candle.position.y = 0.77;
    tableCake.add(candle);
    const tFlame = new THREE.Mesh(
      new THREE.ConeGeometry(0.06, 0.16, 8),
      new THREE.MeshStandardMaterial({ color: 0xffa500, emissive: 0xffa500, emissiveIntensity: 2 })
    );
    tFlame.position.y = 1.0;
    tableCake.add(tFlame);
    tableCake.position.y = 1.0;
    table.add(tableCake);
    table.position.set(-2.2, 0, 3.4);
    this.partyGroup.add(table);

    this.cityGroup.add(this.partyGroup);
  }

  // ================= THE CAKE STORE INTERIOR =================

  /** Square plot, rectangular room inside, long counter with cake models,
   *  and the friendly cake-chef dog behind it. */
  private setupCakeStoreInterior() {
    const room = this.cakeStoreInteriorGroup;

    // Wood floor (walkable)
    const woodCanvas = document.createElement("canvas");
    woodCanvas.width = 256;
    woodCanvas.height = 256;
    const wctx = woodCanvas.getContext("2d")!;
    wctx.fillStyle = "#d9b382";
    wctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 10; i++) {
      wctx.fillStyle = i % 2 === 0 ? "#cfa77a" : "#c9a173";
      wctx.fillRect(0, i * 26, 256, 24);
      wctx.fillStyle = "rgba(120, 72, 40, 0.35)";
      wctx.fillRect(0, i * 26 + 24, 256, 2);
    }
    const woodTex = new THREE.CanvasTexture(woodCanvas);
    woodTex.wrapS = THREE.RepeatWrapping;
    woodTex.wrapT = THREE.RepeatWrapping;
    woodTex.repeat.set(6, 4);
    this.cakeStoreFloorMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 14),
      new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.85 })
    );
    this.cakeStoreFloorMesh.geometry.rotateX(-Math.PI / 2);
    this.cakeStoreFloorMesh.position.y = 0.01;
    this.cakeStoreFloorMesh.receiveShadow = true;
    this.cakeStoreFloorMesh.userData = { type: "cakestore_floor" };
    room.add(this.cakeStoreFloorMesh);

    const wallMat = new THREE.MeshStandardMaterial({ color: 0xfbcfe8, roughness: 0.85 });
    const creamMat = new THREE.MeshStandardMaterial({ color: 0xfff7f9, roughness: 0.7 });
    const wainscotMat = new THREE.MeshStandardMaterial({ color: 0xfff1f2, roughness: 0.75 });
    const wallH = 4.6;

    // Walls (south wall gets a doorway gap in the middle) — the room is BIG
    // so the camera can orbit freely without ever touching a wall
    const northW = new THREE.Mesh(new THREE.BoxGeometry(20, wallH, 0.3), wallMat);
    northW.position.set(0, wallH / 2, -7);
    room.add(northW);
    const westW = new THREE.Mesh(new THREE.BoxGeometry(0.3, wallH, 14), wallMat);
    westW.position.set(-10, wallH / 2, 0);
    room.add(westW);
    const eastW = new THREE.Mesh(new THREE.BoxGeometry(0.3, wallH, 14), wallMat);
    eastW.position.set(10, wallH / 2, 0);
    room.add(eastW);
    [-5.725, 5.725].forEach((x) => {
      const seg = new THREE.Mesh(new THREE.BoxGeometry(8.55, wallH, 0.3), wallMat);
      seg.position.set(x, wallH / 2, 7);
      room.add(seg);
    });
    const header = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.9, 0.3), wallMat);
    header.position.set(0, wallH - 0.45, 7);
    room.add(header);
    // White wainscot strips
    [[0, -6.82, 20], [-9.82, 0, 14], [9.82, 0, 14]].forEach(([px, pz, len]) => {
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(px === 0 ? len : 0.24, 0.9, px === 0 ? 0.24 : len),
        wainscotMat
      );
      strip.position.set(px, 0.45, pz);
      room.add(strip);
    });
    // Ceiling
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(20.4, 14.4), creamMat);
    ceiling.geometry.rotateX(Math.PI / 2);
    ceiling.position.y = wallH;
    room.add(ceiling);

    // South-wall door (the way back out) + windows either side
    const doorGlass = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 2.5),
      new THREE.MeshStandardMaterial({
        color: 0xbfe6f5, roughness: 0.08, metalness: 0.5, transparent: true, opacity: 0.85, side: THREE.DoubleSide,
      })
    );
    doorGlass.position.set(0, 1.28, 7);
    this.cakeStoreDoorMesh = doorGlass;
    this.cakeStoreDoorMesh.userData = { type: "cakestore_exit" };
    room.add(doorGlass);
    [[-5.0], [5.0]].forEach(([wx]) => {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.7), doorGlass.material);
      win.position.set(wx, 1.55, 6.84);
      room.add(win);
      const wFrame = new THREE.Mesh(new THREE.BoxGeometry(2.15, 1.95, 0.06), creamMat);
      wFrame.position.set(wx, 1.55, 6.87);
      room.add(wFrame);
    });
    // EXIT sign over the door
    const exitCanvas = document.createElement("canvas");
    exitCanvas.width = 128;
    exitCanvas.height = 64;
    const ectx = exitCanvas.getContext("2d")!;
    ectx.fillStyle = "#16a34a";
    ectx.beginPath();
    ectx.roundRect(4, 4, 120, 56, 12);
    ectx.fill();
    ectx.fillStyle = "#ffffff";
    ectx.font = "bold 36px sans-serif";
    ectx.textAlign = "center";
    ectx.fillText("EXIT", 64, 45);
    const exitSign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.0, 0.5),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(exitCanvas) })
    );
    exitSign.position.set(0, 3.05, 6.84);
    room.add(exitSign);

    // Wall sign behind the counter
    const salonCanvas = document.createElement("canvas");
    salonCanvas.width = 512;
    salonCanvas.height = 128;
    const sctx = salonCanvas.getContext("2d")!;
    sctx.fillStyle = "#fff1f2";
    sctx.beginPath();
    sctx.roundRect(4, 4, 504, 120, 20);
    sctx.fill();
    sctx.strokeStyle = "#db2777";
    sctx.lineWidth = 8;
    sctx.stroke();
    sctx.fillStyle = "#db2777";
    sctx.font = "bold 58px sans-serif";
    sctx.textAlign = "center";
    sctx.fillText("🎂 CAKE SALON", 256, 82);
    const salonSign = new THREE.Mesh(
      new THREE.PlaneGeometry(4.4, 1.1),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(salonCanvas) })
    );
    salonSign.position.set(0, 3.3, -6.82);
    room.add(salonSign);

    // The long counter (a rectangle inside the square store)
    const counterPink = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.55 });
    const counterTop = new THREE.MeshStandardMaterial({ color: 0xfff7f9, roughness: 0.4 });
    this.storeCounterGroup = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(10, 0.92, 1.0), counterPink);
    base.position.y = 0.46;
    base.castShadow = true;
    this.storeCounterGroup.add(base);
    const topSlab = new THREE.Mesh(new THREE.BoxGeometry(10.3, 0.12, 1.2), counterTop);
    topSlab.position.y = 0.98;
    topSlab.castShadow = true;
    this.storeCounterGroup.add(topSlab);
    const kick = new THREE.Mesh(new THREE.BoxGeometry(10.1, 0.16, 1.05), creamMat);
    kick.position.y = 0.08;
    this.storeCounterGroup.add(kick);
    this.storeCounterGroup.position.set(0, 0, 0.6);
    room.add(this.storeCounterGroup);

    // Cake models marching along the counter
    const cakeSpots: { x: number; base: number; icing: number; drip: number; cherry: boolean }[] = [
      { x: -4.0, base: 0x6b4426, icing: 0x8b5a2b, drip: 0xfff1f2, cherry: true },
      { x: -2.0, base: 0xf9a8d4, icing: 0xf472b6, drip: 0xfff1f2, cherry: true },
      { x: 0.0, base: 0xfff1f2, icing: 0xfda4af, drip: 0xfacc15, cherry: false },
      { x: 2.0, base: 0xfef3c7, icing: 0xfde68a, drip: 0xffffff, cherry: true },
      { x: 4.0, base: 0xc4b5fd, icing: 0xa855f7, drip: 0xfff1f2, cherry: false },
    ];
    cakeSpots.forEach((spot) => {
      const mini = new THREE.Group();
      const plate = new THREE.Mesh(
        new THREE.CylinderGeometry(0.46, 0.46, 0.05, 18),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 })
      );
      mini.add(plate);
      const cakeBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.34, 0.36, 0.3, 16),
        new THREE.MeshStandardMaterial({ color: spot.base, roughness: 0.6 })
      );
      cakeBody.position.y = 0.18;
      cakeBody.castShadow = true;
      mini.add(cakeBody);
      const icing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.35, 0.1, 16),
        new THREE.MeshStandardMaterial({ color: spot.icing, roughness: 0.5 })
      );
      icing.position.y = 0.37;
      mini.add(icing);
      const dripRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.34, 0.045, 8, 20),
        new THREE.MeshStandardMaterial({ color: spot.drip, roughness: 0.5 })
      );
      dripRing.rotation.x = Math.PI / 2;
      dripRing.position.y = 0.32;
      mini.add(dripRing);
      if (spot.cherry) {
        const cherry = new THREE.Mesh(
          new THREE.SphereGeometry(0.09, 10, 10),
          new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3 })
        );
        cherry.position.y = 0.5;
        mini.add(cherry);
      }
      mini.position.set(spot.x, 1.04, 0.6);
      room.add(mini);
    });

    // Shelves of cake boxes on the north wall
    const shelfMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
    [1.5, 2.4].forEach((sy) => {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.08, 0.34), shelfMat);
      shelf.position.set(0, sy, -6.65);
      room.add(shelf);
    });
    const boxColors = [0xf472b6, 0xfacc15, 0x60a5fa, 0xa855f7, 0x4ade80, 0xfb923c];
    boxColors.forEach((color, i) => {
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.34, 0.3),
        new THREE.MeshStandardMaterial({ color, roughness: 0.6 })
      );
      box.position.set(-3.4 + i * 1.35, 1.72, -6.65);
      room.add(box);
    });
    // Second row of boxes on the upper shelf
    [0xfb7185, 0x38bdf8, 0xfbbf24, 0x34d399, 0xc084fc].forEach((color, i) => {
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.34, 0.3),
        new THREE.MeshStandardMaterial({ color, roughness: 0.6 })
      );
      box.position.set(-2.7 + i * 1.35, 2.62, -6.65);
      room.add(box);
    });

    // Display fridge on the east wall
    const fridge = new THREE.Group();
    const fridgeBody = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 1.9, 0.9),
      new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.3, metalness: 0.2 })
    );
    fridgeBody.position.y = 0.95;
    fridge.add(fridgeBody);
    const fridgeGlass = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 1.5),
      new THREE.MeshStandardMaterial({
        color: 0xbfe6f5, roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0.6,
      })
    );
    fridgeGlass.position.set(0, 1.05, 0.46);
    fridge.add(fridgeGlass);
    fridge.position.set(7.6, 0, -1.4);
    room.add(fridge);

    // The cake-chef dog behind the counter (he talks!)
    this.storeDog = new Dog3D("corgi", "#db2777");
    this.storeDog.group.position.set(-0.4, 0, -1.15);
    this.storeDog.group.rotation.y = 0; // looks south toward the entrance
    this.storeDog.setAction("idle");
    room.add(this.storeDog.group);

    // Warm shop light
    const shopLight = new THREE.PointLight(0xffe4c4, 1.4, 24);
    shopLight.position.set(0, 4.0, 1.2);
    room.add(shopLight);
    const pinkGlow = new THREE.PointLight(0xff9bc7, 0.8, 13);
    pinkGlow.position.set(-5, 3.3, -2.5);
    room.add(pinkGlow);
    const backLight = new THREE.PointLight(0xfff1d6, 0.9, 16);
    backLight.position.set(5.5, 4.0, -3);
    room.add(backLight);
  }

  /** Clicking the shop dog (or his counter) makes him greet you. */
  private talkToStoreDog() {
    if (this.storeDog) this.storeDog.setAction("bark", 1.4);
    sound.playBark("high");
    this.storeDogSay("Woof! Welcome to my cake store! 🎂 Would you like to set your birthday?");
    if (this.onStoreDogTalked) this.onStoreDogTalked();
  }

  /** Update the shop dog's speech bubble (also used by React). */
  public storeDogSay(text: string) {
    this.disposeSprite(this.storeDogBubble);
    this.storeDogBubble = this.makeSpeechSprite({
      canvasW: 620,
      canvasH: 300,
      lines: [
        { text: "Chef Biscuit 🐾", size: 26, color: "#9d174d", bold: true },
        { text: text, size: 36, color: "#111827", bold: true },
      ],
    });
    this.storeDogBubble.position.set(-0.4, 2.75, -1.15);
    this.cakeStoreInteriorGroup.add(this.storeDogBubble);
    this.storeDogBubbleTimer = 8.5;
  }

  /** Walk through the Cake Store doors (called behind the cartoon transition). */
  public enterCakeStore() {
    this.viewMode = "cakestore";
    this.houseRoom = "living";
    this.hideAllRooms();
    this.cakeStoreInteriorGroup.visible = true;
    this.walkTarget = null;
    this.walkTargetMarker.visible = false;
    this.dog.group.position.set(0, 0, 5.6);
    this.dog.group.rotation.y = Math.PI; // faces the counter
    this.dog.setAction("idle");
    this.spherical.set(7.4, Math.PI / 3.2, 0);
    this.cameraTarget.set(0, 0.9, 0.2);
    this.updateCameraPosition();
    sound.playSoftWoof();
    // On a birthday the chef dog greets you with the big news right away
    if (this.birthdayMode) {
      this.storeDogSay("WOOF! HAPPY BIRTHDAY!! 🎉 The whole city park is waiting to celebrate with you!");
    }
    if (this.onRoomChanged) this.onRoomChanged("living");
  }

  /** Step back out of the Cake Store into the city. */
  public exitCakeStore() {
    if (this.viewMode !== "cakestore") return;
    this.viewMode = "city";
    this.hideAllRooms();
    this.cityGroup.visible = true;
    this.dog.group.position.set(7.9, 0, -30);
    this.dog.group.rotation.y = -Math.PI / 2; // faces the store from outside
    this.dog.setAction("idle");
    this.walkTarget = null;
    this.walkTargetMarker.visible = false;
    this.spherical.set(9.5, Math.PI / 3.1, 0.5);
    this.cameraTarget.set(9.5, 1.0, -29.5);
    this.updateCameraPosition();
    sound.playButtonTap();
    if (this.onCakeStoreExited) this.onCakeStoreExited();
  }

  // ================= CITY NPC + BIRTHDAY RUNTIME UPDATES =================

  /** Per-frame brains for the fountain-park dogs (stroll, wait, woof). */
  private updateCityNpcs(delta: number, elapsed: number) {
    if (this.viewMode !== "city" || !this.cityGroup.visible) return;
    const dogPos = this.dog.group.position;
    this.cityNpcs.forEach((npc, idx) => {
      npc.model.update(delta, elapsed);
      const pos = npc.model.group.position;
      if (npc.target) {
        const dx = npc.target.x - pos.x;
        const dz = npc.target.z - pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.09) {
          npc.target = null;
          npc.wait = 1.8 + Math.random() * 4.5;
          npc.model.setAction("idle");
        } else {
          const step = Math.min(dist, npc.speed * delta);
          pos.x += (dx / dist) * step;
          pos.z += (dz / dist) * step;
          const targetAngle = Math.atan2(dx, dz);
          npc.model.group.rotation.y = THREE.MathUtils.lerp(
            npc.model.group.rotation.y,
            targetAngle,
            Math.min(1, delta * 4.5)
          );
          if (npc.model.currentAction !== "run") npc.model.setAction("run");
        }
      } else {
        npc.wait -= delta;
        npc.barkCooldown -= delta;
        // Soft idle woofs when Happy wanders close (never mid-conversation)
        if (npc.barkCooldown <= 0 && idx !== this.npcTalkingIdx) {
          npc.barkCooldown = 8 + Math.random() * 10;
          if (Math.hypot(pos.x - dogPos.x, pos.z - dogPos.z) < 9) {
            npc.model.setAction("bark", 1.2);
            sound.playSoftWoof();
          }
        }
        if (npc.wait <= 0) {
          if (idx === this.npcTalkingIdx) {
            // Chat's over — back to the stroll
            this.npcTalkingIdx = -1;
          } else {
            // A new spot inside this dog's little circle (never in the fountain)
            const angle = Math.random() * Math.PI * 2;
            const r = npc.radius * (0.35 + Math.random() * 0.65);
            let tx = npc.home.x + Math.sin(angle) * r;
            let tz = npc.home.z + Math.cos(angle) * r;
            if (Math.hypot(tx + 5, tz - 1) < 2.1) {
              tx = npc.home.x;
              tz = npc.home.z;
            }
            npc.target = new THREE.Vector3(tx, 0, tz);
          }
        }
      }
    });
  }

  /** Birthday beats: candle flicker, bubble timers, party scream & Happy's lines. */
  private updateBirthday(delta: number, elapsed: number) {
    // Candle flame on the giant roof cake flickers forever (it's so pretty)
    if (this.cakeCandleFlame) {
      const s = 1 + Math.sin(elapsed * 12) * 0.18 + Math.sin(elapsed * 27) * 0.09;
      this.cakeCandleFlame.scale.set(1, s, 1);
    }
    // The giant dumbbell sign on the gym sways gently in the breeze
    this.gymDumbbell.rotation.z = Math.sin(elapsed * 1.1) * 0.05;

    // Bubble lifetimes
    if (this.cityBubbleTimer > 0) {
      this.cityBubbleTimer -= delta;
      if (this.cityBubbleTimer <= 0) {
        this.disposeSprite(this.cityBubble);
        this.cityBubble = null;
      }
    }
    if (this.partyBubbleTimer > 0) {
      this.partyBubbleTimer -= delta;
      if (this.partyBubbleTimer <= 0) {
        this.disposeSprite(this.partyBubble);
        this.partyBubble = null;
      }
    }
    if (this.storeDogBubbleTimer > 0) {
      this.storeDogBubbleTimer -= delta;
      if (this.storeDogBubbleTimer <= 0) {
        this.disposeSprite(this.storeDogBubble);
        this.storeDogBubble = null;
      }
    }

    // Arriving in the city on a birthday: the whole pack screams together!
    if (this.birthdayMode && !this.partyScreamDone && this.viewMode === "city" && this.cityGroup.visible) {
      this.partyScreamDone = true;
      this.showPartyScream();
    }

    // Happy's cycling birthday bubbles while strolling around at home
    if (this.birthdayMode) {
      if (this.viewMode === "park" || this.viewMode === "house") {
        this.happyBubbleTimer -= delta;
        if (this.happyBubbleTimer <= 0 || !this.happyBubble) {
          this.happyBubbleIdx = this.happyBubble ? (this.happyBubbleIdx + 1) % 2 : 0;
          this.refreshHappyBirthdayBubble();
        }
        if (this.happyBubble) {
          const p = this.dog.group.position;
          this.happyBubble.position.set(p.x, 3.1, p.z);
        }
      } else if (this.happyBubble) {
        this.disposeSprite(this.happyBubble);
        this.happyBubble = null;
      }
    }
  }

  // ================= HOLIDAY EASTER EGGS =================

  /** Apply seasonal decorations: pumpkins at Halloween, gifts + wreath at
   *  Christmas, an American-flag cauldron on the 4th of July... */
  public setHoliday(holiday: string) {
    this.holiday = holiday;
    this.applySeasonParticles(); // ❄️ Christmas snow / 🍃 spring leaves

    // The kitchen cauldron becomes an American flag on the 4th of July 🇺🇸
    const potBody = this.potGroup.getObjectByName("potBody") as THREE.Mesh | undefined;
    if (potBody) {
      const mat = potBody.material as THREE.MeshStandardMaterial;
      if (holiday === "july4") {
        const flagCanvas = document.createElement("canvas");
        flagCanvas.width = 128;
        flagCanvas.height = 128;
        const f = flagCanvas.getContext("2d")!;
        // 13 stripes
        for (let i = 0; i < 13; i++) {
          f.fillStyle = i % 2 === 0 ? "#B22234" : "#FFFFFF";
          f.fillRect(0, i * 10, 128, 10);
        }
        // Blue canton + stars
        f.fillStyle = "#3C3B6E";
        f.fillRect(0, 0, 54, 70);
        f.fillStyle = "#FFFFFF";
        for (let r = 0; r < 5; r++) {
          for (let c = 0; c < 6; c++) {
            f.fillRect(6 + c * 8 + (r % 2) * 4, 7 + r * 13, 3, 3);
          }
        }
        const flagTex = new THREE.CanvasTexture(flagCanvas);
        mat.map = flagTex;
        mat.color.setHex(0xffffff);
        mat.needsUpdate = true;
      } else {
        mat.map = null;
        mat.color.setHex(0x334155);
        mat.needsUpdate = true;
      }
    }

    // Rebuild the park decorations for the season
    while (this.holidayDecorGroup.children.length) {
      this.holidayDecorGroup.remove(this.holidayDecorGroup.children[0]);
    }
    this.holidayDecorGroup = new THREE.Group();

    if (holiday === "halloween") {
      // 🎃 Pumpkins along the entrance path
      [[-1.5, 5.5], [0.5, 6.5], [2.5, 5.8]].forEach(([x, z], i) => {
        const pumpkin = new THREE.Group();
        const body = new THREE.Mesh(
          new THREE.SphereGeometry(0.42, 12, 10),
          new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.6 })
        );
        body.scale.set(1, 0.78, 1);
        body.position.y = 0.33;
        body.castShadow = true;
        pumpkin.add(body);
        const stem = new THREE.Mesh(
          new THREE.CylinderGeometry(0.06, 0.09, 0.2, 8),
          new THREE.MeshStandardMaterial({ color: 0x166534 })
        );
        stem.position.y = 0.75;
        pumpkin.add(stem);
        // Carved face: triangle eyes + jagged grin
        const faceMat = new THREE.MeshStandardMaterial({ color: 0xfde047, emissive: 0xfacc15, emissiveIntensity: 1.2 });
        [-0.14, 0.14].forEach((fx) => {
          const eye = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.14, 4), faceMat);
          eye.rotation.x = Math.PI;
          eye.position.set(fx, 0.42, 0.38);
          pumpkin.add(eye);
        });
        const grin = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.07, 0.05), faceMat);
        grin.position.set(0, 0.24, 0.4);
        pumpkin.add(grin);
        pumpkin.position.set(x, 0, z);
        pumpkin.rotation.y = i * 0.6;
        this.holidayDecorGroup.add(pumpkin);
      });
    } else if (holiday === "christmas") {
      // 🎄 Gift boxes by the dog house door + a wreath on the front
      const giftColors = [0xdc2626, 0x2563eb, 0x16a34a];
      [[-6.8, -2.4], [-6.4, -3.4], [-7.4, -3.0]].forEach(([x, z], i) => {
        const gift = new THREE.Group();
        const box = new THREE.Mesh(
          new THREE.BoxGeometry(0.55, 0.45, 0.55),
          new THREE.MeshStandardMaterial({ color: giftColors[i % 3], roughness: 0.5 })
        );
        box.position.y = 0.23;
        box.castShadow = true;
        gift.add(box);
        const ribbon = new THREE.Mesh(
          new THREE.BoxGeometry(0.58, 0.48, 0.12),
          new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.4 })
        );
        ribbon.position.y = 0.23;
        gift.add(ribbon);
        gift.position.set(x, 0, z);
        gift.rotation.y = i * 0.8;
        this.holidayDecorGroup.add(gift);
      });
      const wreath = new THREE.Mesh(
        new THREE.TorusGeometry(0.42, 0.1, 10, 20),
        new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.8 })
      );
      wreath.position.set(-5, 1.7, -2.52);
      this.holidayDecorGroup.add(wreath);
      const bow = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xdc2626 })
      );
      bow.position.set(-5, 1.45, -2.5);
      this.holidayDecorGroup.add(bow);
    } else if (holiday === "july4") {
      // 🇺🇸 Little flag stands near the path
      [[-2.5, 4.5], [1.5, 5.2]].forEach(([x, z]) => {
        const flag = new THREE.Group();
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.03, 0.03, 1.6, 8),
          new THREE.MeshStandardMaterial({ color: 0xd6d6d6, metalness: 0.6 })
        );
        pole.position.y = 0.8;
        flag.add(pole);
        const cloth = new THREE.Mesh(
          new THREE.PlaneGeometry(0.7, 0.42),
          new THREE.MeshStandardMaterial({
            map: this.makeUsFlagTexture(),
            side: THREE.DoubleSide,
          })
        );
        cloth.position.set(0.38, 1.35, 0);
        flag.add(cloth);
        flag.position.set(x, 0, z);
        this.holidayDecorGroup.add(flag);
      });
    }

    this.parkGroup.add(this.holidayDecorGroup);
  }

  private makeUsFlagTexture(): THREE.CanvasTexture {
    const c = document.createElement("canvas");
    c.width = 96;
    c.height = 56;
    const f = c.getContext("2d")!;
    for (let i = 0; i < 13; i++) {
      f.fillStyle = i % 2 === 0 ? "#B22234" : "#FFFFFF";
      f.fillRect(0, i * 4.3, 96, 4.3);
    }
    f.fillStyle = "#3C3B6E";
    f.fillRect(0, 0, 40, 30);
    f.fillStyle = "#FFFFFF";
    for (let r = 0; r < 4; r++) {
      for (let col = 0; col < 5; col++) {
        f.fillRect(4 + col * 7 + (r % 2) * 3, 4 + r * 7, 2.4, 2.4);
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
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

      if (this.activeTabletopGame) {
        // Orbit around the chessboard: spin horizontally + tilt vertically,
        // but never dip below the table or flip over the top.
        this.ttSpherical.theta -= dx * 0.008;
        this.ttSpherical.phi = THREE.MathUtils.clamp(
          this.ttSpherical.phi - dy * 0.006,
          0.22,
          1.46
        );
      } else {
        this.spherical.theta -= dx * 0.006;
        this.spherical.phi = THREE.MathUtils.clamp(
          this.spherical.phi - dy * 0.006,
          0.15,
          Math.PI / 2 - 0.05
        );
      }

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
      // During a tabletop game the wheel zooms in/out around the board only.
      if (this.activeTabletopGame) {
        this.ttSpherical.radius = THREE.MathUtils.clamp(
          this.ttSpherical.radius + e.deltaY * 0.0016,
          0.9,
          3.2
        );
        this.updateCameraPosition();
        return;
      }
      // Zoom limits keep the camera INSIDE the room so walls never look
      // see-through from outside (city gets a wide orbit).
      let minRadius = 3.5;
      let maxRadius = 18.0;
      if (this.viewMode === "city") {
        minRadius = 4.0;
        maxRadius = 16.0;
      } else if (this.viewMode === "arcade") {
        minRadius = 3.5;
        maxRadius = 13.0;
      } else if (this.viewMode === "house") {
        minRadius = 2.0;
        maxRadius =
          this.houseRoom === "hallway"
            ? 4.6
            : this.houseRoom === "upstairs"
              ? 4.8
              : 4.6; // living / kitchen / bathroom
      }
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
    // The highway ride is a pure cinematic — no world interaction mid-drive
    if (this.viewMode === "highway") return;
    // A full-screen React overlay (tabletop games / wardrobe) is on top.
    if (!this.inputEnabled) return;
    const dom = this.renderer.domElement;
    const rect = dom.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.camera);

    // Bath-time: while Happy soaks in the tub the shampoo routine takes over
    // (so tapping Happy rubs the lather in instead of just petting him).
    if (
      this.viewMode === "house" &&
      this.houseRoom === "bathroom" &&
      this.inBathtub &&
      this.handleBathClick(raycaster)
    ) {
      return;
    }

    // In-world tabletop play: only board cells respond — tapping empty space
    // or Happy across the table must NOT walk / pet during a game.
    if (this.activeTabletopGame) {      const cellHits = raycaster.intersectObject(this.tabletopBoardGroup, true);
      for (const hit of cellHits) {
        let o: THREE.Object3D | null = hit.object;
        while (o) {
          const ud = o.userData as {
            type?: string; r?: number; c?: number; col?: number; g?: string; tabletopPiece?: boolean;
          };
          if (ud.r != null && ud.c != null && (ud.type === "tabletopCell" || ud.tabletopPiece)) {
            if (this.onTabletopCell) {
              this.onTabletopCell({ r: ud.r, c: ud.c, col: ud.col ?? ud.c, g: ud.g || "" });
            }
            return;
          }
          o = o.parent;
        }
      }
      return; // swallow the click during tabletop play
    }

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

      // Every room exit is a black doorway: press the mat (or the black panel)
      // and Happy walks through it into the next room.
      for (const dw of this.doorways) {
        if (!dw.owner.visible) continue;
        if (
          raycaster.intersectObject(dw.mat, false).length > 0 ||
          raycaster.intersectObject(dw.panel, false).length > 0
        ) {
          this.walkThroughDoor(dw);
          return;
        }
      }

      if (this.houseRoom === "hallway") {
        // HALLWAY interactivity — stairs up, black doorways (handled above)
        const stairHits = raycaster.intersectObjects([this.stairsGroup, this.stairsMatMesh], true);
        if (stairHits.length > 0) {
          this.climbStairs();
          return;
        }
        // (living / kitchen exits are black doorways, handled generically above)
        if (this.hallwayFloorMesh) {
          const floorHits = raycaster.intersectObject(this.hallwayFloorMesh, false);
          if (floorHits.length > 0) {
            this.walkTo(floorHits[0].point);
            return;
          }
        }
        return;
      }

      if (this.houseRoom === "bathroom") {
        // BATHROOM interactivity — shower + bathtub, toilet, floor walk
        const showerHits = this.visibleHits(this.showerGroup, raycaster);
        const tubHits = raycaster.intersectObject(this.bathtubGroup, true);
        if (showerHits.length > 0 || tubHits.length > 0) {
          this.enterBathtub();
          return;
        }
        const wcHits = raycaster.intersectObject(this.toiletGroup, true);
        if (wcHits.length > 0) {
          sound.playButtonTap();
          this.dog.setAction("sit", 1.5);
          return;
        }
        if (this.bathroomFloorMesh) {
          const floorHits = raycaster.intersectObject(this.bathroomFloorMesh, false);
          if (floorHits.length > 0) {
            if (this.inBathtub) this.exitBathtub();
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
        // (the way back down is a black doorway, handled generically above)
        // Cozy bedroom functionalities: bedside lamp, alarm clock, slippers
        // + THE ARCADE MACHINE (portal to the Galaxy Arcade world!)
        const roomHits = raycaster.intersectObject(this.upstairsGroup, true);
        if (roomHits.length > 0) {
          let o: THREE.Object3D | null = roomHits[0].object;
          let clickKind = "";
          while (o) {
            const ty = (o.userData as { type?: string }).type;
            // The bedroom cabinet is built by makeArcadeMachine(), so it carries
            // "arcadeGame" — accept both tags or the click silently does nothing.
            if (
              ty === "bedlamp" ||
              ty === "clock" ||
              ty === "slippers" ||
              ty === "closet" ||
              ty === "arcade" ||
              ty === "arcadeGame"
            ) {
              clickKind = ty;
              break;
            }
            o = o.parent;
          }
          if (clickKind === "bedlamp") {
            this.toggleBedLamp();
            return;
          }
          if (clickKind === "clock") {
            this.dog.setAction("backflip", 1.6);
            sound.playWhistle();
            this.spawnHeartParticles(this.dog.group.position.clone().add(new THREE.Vector3(0, 1.4, 0)));
            return;
          }
          if (clickKind === "slippers") {
            this.dog.setAction("zoomies", 3.0);
            sound.playSqueak();
            this.spawnHeartParticles(this.dog.group.position.clone().add(new THREE.Vector3(0, 1.4, 0)));
            return;
          }
          if (clickKind === "closet") {
            // Open the hat wardrobe — React focuses the closet then shows it.
            if (this.onClosetClicked) this.onClosetClicked();
            return;
          }
          if (clickKind === "arcade" || clickKind === "arcadeGame") {
            this.pulseArcadeCabinet(this.bedroomArcadeGroup);
            if (this.onArcadeClicked) this.onArcadeClicked();
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

        // (the back-to-hallway exit is a black doorway, handled generically above)

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

      // D2. The hallway exit is a black doorway (handled generically above).

      // E. Check Room Floor Click -> Walk to spot!
      if (this.roomFloorMesh) {
        const floorHits = raycaster.intersectObject(this.roomFloorMesh, false);
        if (floorHits.length > 0) {
          this.walkTo(floorHits[0].point);
          return;
        }
      }
    } else if (this.viewMode === "park") {
      // 3. Park Mode Interactivity — scoped to the overworld ONLY so city &
      // galaxy taps can never interact with (e.g. hit) the shared park trees.
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
      // B. Trees are now pure scenery — they can no longer be chopped down
      // (neither here in the overworld nor anywhere else; hidden park trees
      // can never be hit from the city/galaxy since this block is now
      // scoped to the overworld only).
      // C. The tabletop games table — checked FIRST: it sits just in front of
      // the dog house, so its roof would otherwise swallow the tap.
      const tableHits = raycaster.intersectObject(this.tabletopTableGroup, true);
      if (tableHits.length > 0) {
        if (this.onTableClicked) this.onTableClicked();
        return;
      }
      // C2. Check Doghouse Exterior Click -> Enter house!
      if (this.dogHouseExteriorGroup) {
        const houseHits = raycaster.intersectObject(this.dogHouseExteriorGroup, true);
        if (houseHits.length > 0) {
          this.enterHouse();
          return;
        }
      }

      // C3. The little car — click it and Happy drives to the City!
      const carHits = raycaster.intersectObject(this.carGroup, true);
      if (carHits.length > 0) {
        this.startCarRideToCity();
        return;
      }

      // C5. The MULTIPLAYER machine (half-spiral staircase booth on the path)
      const mpHits = raycaster.intersectObject(this.multiplayerMachineGroup, true);
      if (mpHits.length > 0) {
        this.mpMachinePulse = 1;
        if (this.onMultiplayerMachineClicked) this.onMultiplayerMachineClicked();
        return;
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

    // ================= GALAXY ARCADE interactivity =================
    if (this.viewMode === "arcade") {
      const gHits = raycaster.intersectObject(this.galaxyGroup, true);
      if (gHits.length > 0) {
        // Scan every hit, not just the closest one: the platform disc is huge
        // and routinely sits in front of a cabinet, which used to swallow the
        // press and leave the player unable to start a game.
        let clickKind = "";
        let gameId = "";
        let floorPoint: THREE.Vector3 | null = null;

        for (const hit of gHits) {
          let o: THREE.Object3D | null = hit.object;
          let kind = "";
          let id = "";
          while (o) {
            const ud = o.userData as { type?: string; gameId?: string };
            if (ud.type === "arcadeGame" || ud.type === "arcadeExit" || ud.type === "arcade_floor") {
              kind = ud.type;
              id = ud.gameId || "";
              break;
            }
            o = o.parent;
          }
          if (!kind) continue;
          // A cabinet or the exit portal always wins over the floor.
          if (kind === "arcadeGame" || kind === "arcadeExit") {
            clickKind = kind;
            gameId = id;
            break;
          }
          if (!floorPoint) floorPoint = hit.point;
        }

        if (clickKind === "arcadeGame" && gameId) {
          this.pulseArcadeCabinet(this.arcadeMachines.find((m) => m.userData?.gameId === gameId));
          if (this.onArcadeGameSelected) this.onArcadeGameSelected(gameId);
          return;
        }
        if (clickKind === "arcadeExit") {
          if (this.onArcadeExitClicked) this.onArcadeExitClicked();
          return;
        }
        if (floorPoint) {
          this.walkTo(floorPoint);
          return;
        }
      }
      return;
    }

    // ================= CITY MODE interactivity =================
    if (this.viewMode === "city") {
      // Supermarket -> the glass doors slide open and Happy walks in to shop
      const marketHits = raycaster.intersectObject(this.supermarketGroup, true);
      if (marketHits.length > 0) {
        this.beginSupermarketEntry();
        return;
      }
      // Gym -> doggy workout minigame
      const gymHits = raycaster.intersectObject(this.gymGroup, true);
      if (gymHits.length > 0) {
        if (this.onGymClicked) this.onGymClicked();
        return;
      }
      // The Birthday Cake Store -> walk in (React plays the transition)
      const cakeHits = raycaster.intersectObject(this.cakeStoreGroup, true);
      if (cakeHits.length > 0) {
        if (this.onCakeStoreClicked) this.onCakeStoreClicked();
        return;
      }
      // The strolling park dog NPCs -> they only woof at you
      for (let i = 0; i < this.cityNpcs.length; i++) {
        const npcHits = raycaster.intersectObject(this.cityNpcs[i].model.group, true);
        if (npcHits.length > 0) {
          this.talkToCityNpc(i);
          return;
        }
      }
      // The car -> drive back home
      const carHits = raycaster.intersectObject(this.carGroup, true);
      if (carHits.length > 0) {
        this.startCarRideHome();
        return;
      }
      // City ground walk
      if (this.cityGroundMesh) {
        const groundHits = raycaster.intersectObject(this.cityGroundMesh, false);
        if (groundHits.length > 0) {
          this.walkTo(groundHits[0].point);
          return;
        }
      }
      return;
    }

    // ================= CAKE STORE interactivity =================
    if (this.viewMode === "cakestore") {
      // The cake-chef dog behind the counter (or his counter) -> talk!
      if (this.storeDog) {
        const dogHits = raycaster.intersectObject(this.storeDog.group, true);
        if (dogHits.length > 0) {
          this.talkToStoreDog();
          return;
        }
      }
      const counterHits = raycaster.intersectObject(this.storeCounterGroup, true);
      if (counterHits.length > 0) {
        this.talkToStoreDog();
        return;
      }
      // Front door -> back out into the city
      if (this.cakeStoreDoorMesh) {
        const doorHits = raycaster.intersectObject(this.cakeStoreDoorMesh, false);
        if (doorHits.length > 0) {
          this.exitCakeStore();
          return;
        }
      }
      // Shop floor walk
      if (this.cakeStoreFloorMesh) {
        const floorHits = raycaster.intersectObject(this.cakeStoreFloorMesh, false);
        if (floorHits.length > 0) {
          this.walkTo(floorHits[0].point);
          return;
        }
      }
      return;
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
    // A zoom tween owns the camera while active (portal into machines)
    if (this.camTween.active) return;
    // Tabletop play: a free orbit around the board so the player can spin
    // around and zoom in/out to scan their position. Radius/phi are clamped
    // (in the drag + wheel handlers) so the board never leaves the view.
    if (this.activeTabletopGame) {
      this.camera.position.setFromSpherical(this.ttSpherical).add(this.TT_FOCUS);
      this.camera.lookAt(this.TT_FOCUS);
      return;
    }
    if (this.wardrobeCamLock) {
      // Happy is a ~3-unit-tall model, so the shot has to stand well back to
      // frame the whole dog — hat and head included — against the closet.
      this.camera.position.set(0.2, 2.4, 4.2);
      this.camera.lookAt(-4.2, 1.4, 2.1);
      return;
    }
    // Side view: the camera rides alongside so you clearly see the
    // 3D car model driving from the side — close enough to enjoy it!
    if (this.sideCam) {
      const c = this.carGroup.position;
      this.camera.position.set(c.x + 10.5, 3.0, c.z + 2.5);
      this.camera.lookAt(c.x, 0.9, c.z);
      return;
    }
    // Cinematic chase cam while riding in the car
    if (this.cinematicCam) {
      const c = this.carGroup.position;
      this.camera.position.set(c.x + 4.5, 3.6, c.z + 7.5);
      this.camera.lookAt(c.x, 0.9, c.z);
      return;
    }
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
    // Never let the interior camera slip outside the walls (no more void!)
    this.confineCameraToRoom();
    this.camera.lookAt(target);
  }

  /**
   * Interior camera confinement: clamps the camera INSIDE the current room so
   * orbiting can never poke through a wall and reveal the empty void. Applies
   * to the whole dog house (every room) and the Cake Store.
   */
  private confineCameraToRoom() {
    const c = this.camera.position;
    if (this.viewMode === "cakestore") {
      c.x = THREE.MathUtils.clamp(c.x, -9.4, 9.4);
      c.y = THREE.MathUtils.clamp(c.y, 0.8, 4.3);
      c.z = THREE.MathUtils.clamp(c.z, -6.5, 6.5);
      return;
    }
    if (this.viewMode !== "house") return;
    if (this.houseRoom === "hallway") {
      c.x = THREE.MathUtils.clamp(c.x, -4.4, 4.4);
      c.y = THREE.MathUtils.clamp(c.y, 0.8, 4.2);
      c.z = THREE.MathUtils.clamp(c.z, -5.7, 5.7);
    } else if (this.houseRoom === "bathroom") {
      c.x = THREE.MathUtils.clamp(c.x, -5.6, 5.6);
      c.y = THREE.MathUtils.clamp(c.y, 0.8, 3.9);
      c.z = THREE.MathUtils.clamp(c.z, -4.6, 4.6);
    } else if (this.houseRoom === "upstairs") {
      c.x = THREE.MathUtils.clamp(c.x, -5.6, 5.6);
      c.y = THREE.MathUtils.clamp(c.y, 0.8, 3.3);
      c.z = THREE.MathUtils.clamp(c.z, -4.1, 4.1);
    } else {
      // Living room / kitchen (10x10)
      c.x = THREE.MathUtils.clamp(c.x, -4.7, 4.7);
      c.y = THREE.MathUtils.clamp(c.y, 0.8, 3.8);
      c.z = THREE.MathUtils.clamp(c.z, -4.7, 4.7);
    }
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

    // Launch from just in front of Happy — never from a hard-coded world point.
    // (Launching from a fixed spot made a re-throw land inside him, so the
    // "reached the ball" check fired instantly and he never ran.)
    const dogPos = this.dog.group.position;
    const dir = new THREE.Vector3(Math.sin(targetAngle), 0, -Math.cos(targetAngle));
    const launchPos = new THREE.Vector3(
      dogPos.x + dir.x * 1.1,
      1.2,
      dogPos.z + dir.z * 1.1
    );
    this.ballState.position.copy(launchPos);
    this.ballMesh.position.copy(launchPos);
    this.ballMesh.visible = true;
    this.dog.ballInMouth.visible = false;

    this.ballState.velocity.set(
      dir.x * targetDistance * 0.8,
      5.5 + Math.random() * 1.5,
      dir.z * targetDistance * 0.8
    );
    this.ballState.bounces = 0;
    this.ballState.active = true;
    this.fetchState = "chasing";
    // A short grace period so the pickup can't trigger on the launch frame.
    this.fetchGrabDelay = 0.6;

    // Remember where the player is standing: this is where Happy brings it back.
    this.fetchReturnPos.set(dogPos.x, 0, dogPos.z);
    this.fetchTargetPos.copy(launchPos);
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
    if (this.fetchGrabDelay > 0) this.fetchGrabDelay -= delta;
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
      if (dist < 0.7 && this.fetchGrabDelay <= 0) {
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
    // Guard: the dog house is NOT directly accessible from the City —
    // you always return to the park lawn first.
    if (this.viewMode === "city") {
      this.exitCityInstant();
      return;
    }
    if (this.viewMode === "highway" || this.viewMode === "arcade") return;
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
    this.bathroomGroup.visible = false;
    this.cityGroup.visible = false;
    this.cakeStoreInteriorGroup.visible = false;
    this.galaxyGroup.visible = false;
    this.highwayGroup.visible = false;
    // The car only makes sense in the outdoor worlds
    this.carGroup.visible =
      this.viewMode === "park" || this.viewMode === "highway" || this.viewMode === "city";
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

    this.dog.group.position.set(0, 0, 1.2);
    this.dog.group.rotation.y = Math.PI;
    this.dog.setAction("idle");

    this.walkTarget = null;
    this.walkTargetMarker.visible = false;

    this.spherical.set(6.4, Math.PI / 3.1, 0);
    this.cameraTarget.set(0, 0.9, 0.6);
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

    this.spherical.set(5.6, Math.PI / 2.8, 0);
    this.cameraTarget.set(0, 0.9, 0);
    this.updateCameraPosition();

    sound.playSoftWoof();
    if (this.onRoomChanged) this.onRoomChanged("upstairs");
  }

  /**
   * Enter the Bathroom (shower + bath, toilet, soap shelf with Happy's
   * Men's Shampoo, Happy Kids and the Star bottle).
   */
  public enterBathroom() {
    if (this.viewMode !== "house") {
      this.viewMode = "house";
      if (this.onHouseEntered) this.onHouseEntered();
    }
    this.houseRoom = "bathroom";
    this.hideAllRooms();
    this.bathroomGroup.visible = true;
    this.inBathtub = false;

    this.dog.group.position.set(0.4, 0, 0.6);
    this.dog.group.rotation.y = Math.PI * 0.8;
    this.dog.group.scale.setScalar(1);
    this.dog.setAction("idle");

    this.walkTarget = null;
    this.walkTargetMarker.visible = false;

    this.spherical.set(5.4, Math.PI / 2.9, 0);
    this.cameraTarget.set(0, 1.0, -0.4);
    this.updateCameraPosition();

    sound.playSoftWoof();
    if (this.onRoomChanged) this.onRoomChanged("bathroom");
  }

  /** Click the shower: Happy hops into the bathtub (framed close-up). */
  public enterBathtub() {
    if (this.viewMode !== "house" || this.houseRoom !== "bathroom") return;
    if (this.inBathtub) {
      this.exitBathtub();
      return;
    }
    const tub = this.BATHTUB_CENTER.clone();
    this.walkTo(new THREE.Vector3(tub.x, 0, tub.z + 1.7), () => {
      this.buildBathFoam();
      this.clearBath();
      this.inBathtub = true;
      this.dog.group.position.set(tub.x, tub.y, tub.z);
      this.dog.group.rotation.y = 0; // face the camera, chest-deep in the tub
      this.dog.setAction("sit", 2.0);
      this.spherical.set(4.3, Math.PI / 2.9, 0);
      this.cameraTarget.set(tub.x, tub.y + 0.8, tub.z);
      this.updateCameraPosition();
      sound.playSqueak();
      this.spawnHeartParticles(tub.clone().add(new THREE.Vector3(0, 0.9, 0)));
    });
  }

  /** Step out of the tub and back to the bathroom floor. */
  public exitBathtub() {
    if (!this.inBathtub) return;
    this.clearBath();
    this.inBathtub = false;
    this.dog.group.position.set(this.BATHTUB_CENTER.x + 0.2, 0, this.BATHTUB_CENTER.z + 1.6);
    this.dog.group.rotation.y = Math.PI;
    this.dog.setAction("idle");
    this.spherical.set(5.4, Math.PI / 2.9, 0);
    this.cameraTarget.set(0, 1.0, -0.4);
    this.updateCameraPosition();
  }

  // =====================================================================
  //  Bath-time routine: pick a shampoo → squeeze it over Happy → rub it in
  //  (white foam everywhere) → unclip the hand shower and rinse him off.
  // =====================================================================

  /** Clumps of white foam, parented to Happy so they follow him around. */
  private buildBathFoam() {
    if (this.foamBuilt) return;
    this.foamBuilt = true;
    this.foamGroup = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });
    // Local space of the dog model (back, flanks and head).
    const spots: [number, number, number][] = [
      [0, 1.6, -0.5], [0.3, 1.45, -0.3], [-0.32, 1.47, -0.28],
      [0.2, 1.66, -0.05], [-0.22, 1.66, -0.02], [0, 1.32, -0.72],
      [0.36, 1.24, -0.1], [-0.36, 1.22, -0.12], [0.14, 1.74, -0.7],
      [-0.16, 1.72, -0.74], [0.44, 1.5, -0.46], [-0.44, 1.5, -0.46],
      [0, 1.18, -0.42], [0.24, 1.08, -0.55], [-0.24, 1.08, -0.5],
      [0.1, 1.86, -0.34], [-0.1, 1.86, -0.3],
    ];
    spots.forEach(([x, y, z], i) => {
      const r = 0.13 + ((i * 37) % 7) * 0.012;
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat);
      m.position.set(x, y, z);
      m.scale.set(1, 0.7, 1);
      m.visible = false;
      this.foamGroup.add(m);
      this.foamBlobs.push(m);
    });
    this.dog.group.add(this.foamGroup);
  }

  /** Show the first `k` (0..1) share of the foam clumps. */
  private setFoam(k: number) {
    const n = Math.round(k * this.foamBlobs.length);
    this.foamBlobs.forEach((b, i) => (b.visible = i < n));
  }

  /** Raycast helper that ignores objects hidden behind an invisible parent
   *  (THREE's raycaster does not skip invisible meshes). */
  private visibleHits(obj: THREE.Object3D, ray: THREE.Raycaster): THREE.Intersection[] {
    return ray.intersectObject(obj, true).filter((h) => {
      let o: THREE.Object3D | null = h.object;
      while (o) {
        if (!o.visible) return false;
        o = o.parent;
      }
      return true;
    });
  }

  private clearBath() {
    if (this.bathBottle) {
      this.scene.remove(this.bathBottle);
      this.bathBottle = null;
    }
    if (this.bathStream) {
      this.scene.remove(this.bathStream);
      this.bathStream = null;
    }
    this.setFoam(0);
    this.bathAnim = null;
    this.bathStep = "idle";
    if (this.showerDetached) this.reattachShower();
  }

  /** Reroute a click while Happy is soaking. Returns true if it was handled. */
  private handleBathClick(raycaster: THREE.Raycaster): boolean {
    // 1. Press the floating bottle → squeeze it over Happy.
    if (this.bathBottle && this.bathStep === "soap") {
      if (raycaster.intersectObject(this.bathBottle, true).length > 0) {
        this.squeezeShampoo();
        return true;
      }
    }
    // 2. Rub the lather in (tap Happy).
    if (this.bathStep === "lather") {
      if (raycaster.intersectObject(this.dog.group, true).length > 0) {
        this.rubShampoo();
        return true;
      }
    }
    // 3. Unclip / re-clip the hand shower (tap the head or the pole).
    if (this.visibleHits(this.showerGroup, raycaster).length > 0) {
      if (this.showerDetached) this.reattachShower();
      else this.detachShower();
      return true;
    }
    // 4. Take a bottle off the shelf (only if Happy isn't in front of it).
    if (this.bathStep === "idle") {
      const hits = raycaster.intersectObject(this.soapShelfGroup, true);
      const dogHits = raycaster.intersectObject(this.dog.group, true);
      if (hits.length > 0 && (!dogHits.length || hits[0].distance < dogHits[0].distance)) {
        for (const hit of hits) {
          let o: THREE.Object3D | null = hit.object;
          while (o) {
            const ud = o.userData as { type?: string; kind?: "mens" | "kids" | "star" };
            if (ud.type === "shampoo" && ud.kind) {
              this.pickShampoo(ud.kind);
              return true;
            }
            o = o.parent;
          }
        }
      }
    }
    return false;
  }

  /** Lift a shampoo bottle off the shelf and float it over Happy. */
  private pickShampoo(kind: "mens" | "kids" | "star") {
    if (this.bathStep !== "idle") return;
    const bottle = this.makeShampooBox(kind, 0.16, 0.24, 0.1);
    bottle.position.set(this.BATHTUB_CENTER.x + 1.1, 1.5, this.BATHTUB_CENTER.z + 0.9);
    this.scene.add(bottle);
    this.bathBottle = bottle;
    this.bathKind = kind;
    this.bathStep = "soap";
    this.bathAnim = {
      kind: "float",
      t: 0,
      dur: 0.6,
      from: bottle.position.clone(),
      to: new THREE.Vector3(this.BATHTUB_CENTER.x + 0.42, 1.72, this.BATHTUB_CENTER.z + 0.5),
    };
    sound.playSqueak();
    if (this.onBathEvent) this.onBathEvent("soap");
  }

  /** Tip the held bottle and squirt a ribbon of shampoo onto Happy. */
  private squeezeShampoo() {
    if (this.bathStep !== "soap" || !this.bathBottle) return;
    this.bathStep = "lather";
    this.bathAnim = {
      kind: "squeeze",
      t: 0,
      dur: 0.85,
      from: this.bathBottle.position.clone(),
      to: new THREE.Vector3(this.BATHTUB_CENTER.x + 0.3, 1.5, this.BATHTUB_CENTER.z + 0.35),
    };
    // The falling ribbon of shampoo.
    const stream = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.03, 0.5, 8),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 })
    );
    stream.position.set(this.BATHTUB_CENTER.x + 0.3, 1.28, this.BATHTUB_CENTER.z + 0.3);
    this.scene.add(stream);
    this.bathStream = stream;
    sound.playSqueak();
    if (this.onBathEvent) this.onBathEvent("rub");
  }

  /** Rub the shampoo in: lather spreads over Happy as he wriggles. */
  private rubShampoo() {
    if (this.bathStep !== "lather") return;
    this.bathStep = "rinse";
    this.setFoam(0.65);
    this.dog.setAction("zoomies", 1.8);
    sound.playCrunch();
    this.spawnHeartParticles(this.dog.group.position.clone().add(new THREE.Vector3(0, 1.4, 0)));
    if (this.onBathEvent) this.onBathEvent("rub");
  }

  /** Unclip the hand shower from the wall and let it run over Happy. */
  private detachShower() {
    this.showerDetached = true;
    if (this.showerHose) this.showerHose.visible = true;
    if (this.showerSpray) this.showerSpray.visible = true;
    this.showerHeadGroup.rotation.z = Math.PI * 0.42;
    this.bathStep = "rinse";
    // Rinse the foam away over a couple of seconds.
    let t = 0;
    const rinse = () => {
      t += 0.06;
      if (t < 1) {
        this.setFoam(Math.max(0, (1 - t) * 1.15));
        requestAnimationFrame(rinse);
      } else {
        this.setFoam(0);
      }
    };
    rinse();
    this.bathAnim = {
      kind: "rinse",
      t: 0,
      dur: 0.55,
      from: this.showerHeadGroup.position.clone(),
      to: new THREE.Vector3(this.BATHTUB_CENTER.x, 1.9, this.BATHTUB_CENTER.z + 0.1),
    };
    this.dog.setAction("sit", 2.0);
    sound.playSqueak();
    if (this.onBathEvent) this.onBathEvent("rinse");
  }

  /** Clip the hand shower back onto its wall outlet. */
  private reattachShower() {
    this.showerDetached = false;
    if (this.showerHose) this.showerHose.visible = false;
    if (this.showerSpray) this.showerSpray.visible = false;
    this.showerHeadGroup.position.copy(this.showerReturnTo);
    this.showerHeadGroup.rotation.z = 0;
    this.bathAnim = null;
    if (this.bathStep === "rinse") {
      this.bathStep = "idle";
      this.setFoam(0);
      if (this.onBathEvent) this.onBathEvent("done");
    }
  }

  private updateBath(delta: number) {
    const a = this.bathAnim;
    if (!a) return;
    a.t += delta / a.dur;
    const t = Math.min(1, a.t);

    if (a.kind === "float" && this.bathBottle) {
      this.bathBottle.position.lerpVectors(a.from, a.to, t);
      this.bathBottle.position.y += Math.sin(t * Math.PI) * 0.12;
      this.bathBottle.rotation.y = t * Math.PI * 0.5;
      if (t >= 1) this.bathAnim = null;
      return;
    }
    if (a.kind === "squeeze" && this.bathBottle) {
      this.bathBottle.position.lerpVectors(a.from, a.to, t);
      this.bathBottle.rotation.z = Math.PI * 0.8 * t; // tip it upside-down
      if (this.bathStream) this.bathStream.visible = t < 0.85;
      if (t >= 1) {
        if (this.bathStream) {
          this.scene.remove(this.bathStream);
          this.bathStream = null;
        }
        if (this.bathBottle) {
          this.bathBottle.rotation.z = 0;
          this.bathBottle.rotation.y = 0;
        }
        this.bathAnim = null;
      }
      return;
    }
    if (a.kind === "rinse") {
      this.showerHeadGroup.position.lerpVectors(a.from, a.to, t);
      if (t >= 1) {
        this.showerHeadGroup.position.copy(a.to);
        this.bathAnim = null;
      }
    }
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

  /**
   * Press a black doorway: Happy trots onto the mat, then walks straight into
   * the black panel and is swallowed by it. The room change fires once he is
   * fully inside (onDoorWalkedThrough), so the announce text lands on the beat.
   */
  private walkThroughDoor(dw: {
    target: HouseRoom;
    label: string;
    mat: THREE.Mesh;
    panel: THREE.Mesh;
    roomDir: THREE.Vector3;
  }) {
    if (this.doorWalk) return;
    if (this.inBathtub) this.exitBathtub();
    this.walkTo(dw.mat.position.clone(), () => {
      // Step through: aim just inside the black panel.
      const to = dw.panel.position.clone().addScaledVector(dw.roomDir, -0.05);
      to.y = 0;
      this.doorWalk = {
        t: 0,
        dur: 0.9,
        from: this.dog.group.position.clone(),
        to,
        target: dw.target,
        label: dw.label,
      };
      this.dog.setAction("run");
      sound.playSoftWoof();
    });
  }

  private updateDoorWalk(delta: number) {
    const dw = this.doorWalk;
    if (!dw) return;
    dw.t += delta / dw.dur;
    const t = Math.min(1, dw.t);
    const pos = this.dog.group.position;
    pos.x = THREE.MathUtils.lerp(dw.from.x, dw.to.x, t);
    pos.z = THREE.MathUtils.lerp(dw.from.z, dw.to.z, t);
    // Little stride bounce as he disappears into the dark
    pos.y = Math.abs(Math.sin(t * Math.PI * 3)) * 0.06;
    if (t >= 1) {
      pos.y = 0;
      this.dog.setAction("idle");
      this.doorWalk = null;
      if (this.onDoorWalkedThrough) this.onDoorWalkedThrough(dw.target, dw.label);
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
    // Only ever consider editables that are actually visible in the CURRENT
    // world. Objects that belong to another world (e.g. the park trees while
    // you're in the City or the Galaxy Arcade) are hidden but still sit in the
    // scene graph — THREE's raycaster does NOT skip invisible meshes, so
    // without this guard a tap in another dimension could hit an invisible
    // park object. This keeps hidden trees/props completely inaccessible.
    const candidates = [...this.editables.values()].filter((o) => o.visible);
    const hits = raycaster.intersectObjects(candidates, true);
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

  // ---------- Cooking-ready beacon: red highlight + pot over the house ----------

  /** Idle bob for the soup-ready beacon above the dog house. */
  private updateCookBeaconBob() {
    const now = performance.now();
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

  // ---------- Seasonal ambient particles (Christmas snow / spring leaves) ----------

  /** (Re)build the ambient seasonal particle field. Called on init + holiday set. */
  private applySeasonParticles() {
    const season = getCurrentSeason();
    const kind: "none" | "snow" | "leaves" =
      this.holiday === "christmas" ? "snow" : season === "spring" ? "leaves" : "none";
    if (kind === this.seasonKind && this.seasonPoints) return;
    this.seasonKind = kind;

    if (this.seasonPoints) {
      this.scene.remove(this.seasonPoints);
      this.seasonPoints.geometry.dispose();
      (this.seasonPoints.material as THREE.Material).dispose();
      this.seasonPoints = null;
      this.seasonVel = null;
    }
    if (kind === "none") return;

    const count = kind === "snow" ? 420 : 260;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    this.seasonVel = new Float32Array(count);
    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 30;
      positions[i * 3 + 1] = Math.random() * 14;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 30;
      // Snow: white sparkle. Spring: fresh-green & pollen-yellow leaves
      if (kind === "snow") {
        color.setHSL(0.55, 0.1, 0.95);
        this.seasonVel[i] = 0.9 + Math.random() * 0.8;
      } else {
        const leafColors = [0x4ade80, 0x86efac, 0xfde047, 0xfecaca];
        color.setHex(leafColors[i % leafColors.length]);
        this.seasonVel[i] = 0.5 + Math.random() * 0.5; // leaves flutter slowly
      }
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size: kind === "snow" ? 0.12 : 0.22,
      vertexColors: true,
      transparent: true,
      opacity: kind === "snow" ? 0.9 : 0.85,
      depthWrite: false,
    });
    this.seasonPoints = new THREE.Points(geom, mat);
    this.seasonPoints.frustumCulled = false;
    this.scene.add(this.seasonPoints);
  }

  private updateSeasonParticles(delta: number, elapsed: number) {
    if (!this.seasonPoints || this.seasonKind === "none" || !this.seasonVel) return;
    // Ambient seasons live in the outdoor worlds (park, city & highway)
    this.seasonPoints.visible =
      this.viewMode === "park" || this.viewMode === "city" || this.viewMode === "highway";
    if (!this.seasonPoints.visible) return;
    // Center the field on the dog — or on the car while riding (dog's inside!)
    const riding = this.carRide.phase !== "none" && !this.dog.group.visible;
    const center = riding ? this.carGroup.position : this.dog.group.position;
    this.seasonPoints.position.set(center.x, 0, center.z);
    const pos = this.seasonPoints.geometry.getAttribute("position") as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < this.seasonVel.length; i++) {
      const v = this.seasonVel[i];
      arr[i * 3 + 1] -= v * delta;
      if (this.seasonKind === "leaves") {
        // Fluttering leaf/pollen drift
        arr[i * 3] += Math.sin(elapsed * 1.2 + i * 1.3) * delta * 0.7;
        arr[i * 3 + 2] += Math.cos(elapsed * 0.9 + i * 2.1) * delta * 0.5;
      } else {
        // Gentle snow sway
        arr[i * 3] += Math.sin(elapsed * 0.8 + i * 1.7) * delta * 0.3;
      }
      if (arr[i * 3 + 1] < 0) {
        arr[i * 3 + 1] = 14;
        arr[i * 3] = (Math.random() - 0.5) * 30;
        arr[i * 3 + 2] = (Math.random() - 0.5) * 30;
      }
    }
    pos.needsUpdate = true;
  }

  /**
   * Ground tint = weather base color, gradually whitened by snowCoverage.
   * While it snows the ground blankets over in ~10s of landing snowflakes
   * (each sticky splat adds to it) and melts back in ~25s.
   */
  private applyGroundTint() {
    const groundMat = this.groundMesh?.material as THREE.MeshStandardMaterial | undefined;
    if (groundMat) {
      const base = this.weather === "rainy" ? this.GRASS_RAINY : this.GRASS_SUNNY;
      groundMat.color.copy(base).lerp(this.SNOW_COLOR, this.snowCoverage);
    }
    // The city concrete whitens with it (emissive, so the texture still shows)
    if (this.cityGroundMesh) {
      const cityMat = this.cityGroundMesh.material as THREE.MeshStandardMaterial;
      cityMat.emissive.copy(this.SNOW_COLOR);
      cityMat.emissiveIntensity = this.snowCoverage * 0.8;
    }
  }

  private updateSnowCoverage(delta: number) {
    const prev = this.snowCoverage;
    if (this.weather === "snowy") {
      // ~10 seconds of snowfall blankets the whole ground white
      this.snowCoverage = Math.min(1, this.snowCoverage + delta / 10);
    } else if (this.snowCoverage > 0) {
      this.snowCoverage = Math.max(0, this.snowCoverage - delta / 25);
    }
    if (this.snowCoverage !== prev) {
      this.applyGroundTint();
    }
  }

  /** Build the layer of soft round splats that landed flakes leave behind. */
  private buildSnowSplatLayer() {
    const cap = 1600;
    const positions = new Float32Array(cap * 3);
    for (let i = 0; i < cap; i++) {
      positions[i * 3 + 1] = -30; // parked under the world until a flake lands
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    // Soft round flake splat sprite
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext("2d")!;
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.6, "rgba(255,255,255,0.9)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    const mat = new THREE.PointsMaterial({
      map: new THREE.CanvasTexture(c),
      color: 0xffffff,
      size: 0.44,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.snowSplats = new THREE.Points(geom, mat);
    this.snowSplats.frustumCulled = false;
    this.scene.add(this.snowSplats);
    this.snowSplatCursor = 0;
    this.snowSplatTimer = 0;
  }

  /**
   * While it snows in an outdoor world, landed flakes keep stamping soft white
   * splats on the ground around the dog (~130/s, so after ~10s everything is
   * white). The splats melt away with the snowCoverage after the snowfall.
   */
  private updateSnowSplats(delta: number) {
    if (this.weather === "snowy" && !this.snowSplats) {
      this.buildSnowSplatLayer();
    }
    if (!this.snowSplats) return;
    const outdoors =
      this.viewMode === "park" || this.viewMode === "city" || this.viewMode === "highway";
    this.snowSplats.visible = outdoors;
    const mat = this.snowSplats.material as THREE.PointsMaterial;
    if (this.weather === "snowy" && outdoors && this.snowCoverage < 0.995) {
      this.snowSplatTimer -= delta;
      const pos = this.snowSplats.geometry.getAttribute("position") as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      const cap = pos.count;
      const dog = this.dog.group.position;
      let stamped = false;
      while (this.snowSplatTimer <= 0) {
        this.snowSplatTimer += 1 / 130; // ~130 flakes land per second
        const i = this.snowSplatCursor % cap;
        arr[i * 3] = dog.x + (Math.random() - 0.5) * 30;
        arr[i * 3 + 1] = 0.045 + Math.random() * 0.02;
        arr[i * 3 + 2] = dog.z + (Math.random() - 0.5) * 30;
        this.snowSplatCursor++;
        stamped = true;
      }
      if (stamped) pos.needsUpdate = true;
    }
    // Splats melt together with the blanket
    mat.opacity = 0.95 * this.snowCoverage;
    if (this.weather !== "snowy" && this.snowCoverage <= 0.01) {
      this.scene.remove(this.snowSplats);
      this.snowSplats.geometry.dispose();
      (mat.map as THREE.Texture | null)?.dispose();
      mat.dispose();
      this.snowSplats = null;
      this.snowSplatCursor = 0;
    }
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
      // damp, darker grass (snow coverage still fades out on top)
      this.applyGroundTint();
    } else if (this.weather === "snowy") {
      this.sunLight.intensity *= 0.7;
      if (night) {
        this.setSkyGradient("#0f172a", "#334155");
        this.scene.fog = new THREE.FogExp2(0x1e293b, 0.026);
      } else {
        this.setSkyGradient("#6ea8dc", "#dceef5");
        this.scene.fog = new THREE.FogExp2(0xdce8f2, 0.022);
      }
      // snow blankets the lawn gradually — see updateSnowCoverage()
      this.applyGroundTint();
    } else {
      this.applyGroundTint();
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
    // Storms stay outside — never rain inside the dog house (highway & the
    // city streets both count as outside)
    this.precipPoints.visible =
      this.viewMode === "park" || this.viewMode === "highway" || this.viewMode === "city";
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
    if (this.viewMode === "arcade") {
      // Stay on the neon platform
      const r = Math.hypot(x, z - 0.5);
      if (r <= 11.5) return { x, z };
      const k = 11.5 / r;
      return { x: x * k, z: 0.5 + (z - 0.5) * k };
    }
    if (this.viewMode === "city") {
      return {
        x: THREE.MathUtils.clamp(x, -13.0, 25.8),
        z: THREE.MathUtils.clamp(z, -36.2, 16.0),
      };
    }
    if (this.viewMode === "cakestore") {
      // The big rectangular shop floor inside the square building
      return {
        x: THREE.MathUtils.clamp(x, -8.8, 8.8),
        z: THREE.MathUtils.clamp(z, -5.8, 5.8),
      };
    }
    if (this.houseRoom === "hallway") {
      return {
        x: THREE.MathUtils.clamp(x, -3.9, 3.9),
        z: THREE.MathUtils.clamp(z, -5.4, 5.4),
      };
    }
    if (this.houseRoom === "upstairs") {
      return {
        x: THREE.MathUtils.clamp(x, -5.2, 5.2),
        z: THREE.MathUtils.clamp(z, -3.6, 3.6),
      };
    }
    if (this.houseRoom === "bathroom") {
      return {
        x: THREE.MathUtils.clamp(x, -5.5, 5.5),
        z: THREE.MathUtils.clamp(z, -4.5, 4.5),
      };
    }
    if (this.viewMode === "house") {
      // Living / kitchen rooms are now a comfy 10x10
      return {
        x: THREE.MathUtils.clamp(x, -4.2, 4.2),
        z: THREE.MathUtils.clamp(z, -4.2, 4.2),
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

      // "Walking into the black doorway" animation
      this.updateDoorWalk(delta);

      // Cinematic camera zooms (arcade portals)
      this.updateCameraTween(delta);

      // Car ride cinematic (park <-> city)
      this.updateCarRide(delta);

      // Physics & Fetch AI
      this.updatePhysics(delta);

      // Particle system
      this.updateParticles(delta);

      // Soup-ready beacon bob above the dog house
      this.updateCookBeaconBob();

      // Tabletop four-wins tokens falling + bouncing on the board
      this.updateTabletopTokens(delta);

      // Chess capture / checkmate choreography + flying debris
      this.updateTabletopAnim(delta);

      // Bath-time: shampoo float / squeeze / rinse tweens
      this.updateBath(delta);

      // Floating marker over the grabbed edit-mode object
      this.updateSelectionMarker(elapsed);

      // Rain / snow weather particles
      this.updatePrecipitationMotion(delta, elapsed);

      // Snow slowly blankets the lawn white while it snows — landed flakes
      // stick to the ground as splats (see updateSnowSplats)
      this.updateSnowCoverage(delta);
      this.updateSnowSplats(delta);

      // Seasonal ambience: ❄️ Christmas snowfall / 🍃 spring leaves & pollen
      this.updateSeasonParticles(delta, elapsed);

      // Arcade cabinet bounce/flash after being pressed
      this.updateArcadePulse(delta);

      // Strolling city dog NPCs (they only woof!) + birthday party beats
      this.updateCityNpcs(delta, elapsed);
      this.updateBirthday(delta, elapsed);

      // Supermarket glass doors sliding open / shut
      this.updateSupermarketDoors(delta);

      // Multiplayer machine: idle screen shimmer + click flash
      if (this.mpScreenMat) {
        if (this.mpMachinePulse > 0) this.mpMachinePulse = Math.max(0, this.mpMachinePulse - delta * 2);
        const glow = 0.7 + Math.sin(elapsed * 3.5) * 0.35 + this.mpMachinePulse * 2.2;
        this.mpScreenMat.emissiveIntensity = glow;
      }

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

      // Camera follow (and always track during car-ride cinematics)
      if (this.followDog || this.sideCam || this.cinematicCam) {
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
