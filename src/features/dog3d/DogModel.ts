import * as THREE from "three";
import { DogAction, DogBreed } from "../../types/pet";
import { sound } from "../../utils/audio";

export interface DogColors {
  primary: number;
  secondary: number;
  belly: number;
  nose: number;
  collar: number;
}

export const BREED_COLORS: Record<DogBreed, { primary: number; secondary: number; belly: number }> = {
  golden: {
    primary: 0xdeb887, // Burlywood golden
    secondary: 0xc69248, // Warm caramel
    belly: 0xf5deb3, // Wheat cream
  },
  chocolate: {
    primary: 0x4a2e18, // Rich dark chocolate
    secondary: 0x382210,
    belly: 0x6b4426,
  },
  husky: {
    primary: 0x474b54, // Slate silver
    secondary: 0x24262b, // Dark charcoal
    belly: 0xf0f2f5, // Snow white
  },
  dalmatian: {
    primary: 0xf8f9fa, // Pure white
    secondary: 0x1a1a1a, // Black patches
    belly: 0xf0f0f0,
  },
  corgi: {
    primary: 0xd97724, // Foxy copper
    secondary: 0xb55a12,
    belly: 0xffffff,
  },
};

export class Dog3D {
  public group: THREE.Group;
  public currentAction: DogAction = "idle";
  public actionProgress: number = 0;
  public actionDuration: number = 0;

  // Skeletal parts for procedural animation
  private bodyMesh!: THREE.Group;
  private torsoMesh!: THREE.Mesh;
  private chestMesh!: THREE.Mesh;
  private neckMesh!: THREE.Group;
  private headMesh!: THREE.Group;
  private jawMesh!: THREE.Mesh;
  private snoutMesh!: THREE.Mesh;
  private tongueMesh!: THREE.Mesh;
  private leftEar!: THREE.Group;
  private rightEar!: THREE.Group;
  private leftEye!: THREE.Mesh;
  private rightEye!: THREE.Mesh;
  private collarMesh!: THREE.Mesh;
  private collarTag!: THREE.Mesh;

  // Legs (articulated)
  private frontLeftLeg!: THREE.Group;
  private frontRightLeg!: THREE.Group;
  private backLeftLeg!: THREE.Group;
  private backRightLeg!: THREE.Group;
  private frontLeftPaw!: THREE.Mesh;
  private frontRightPaw!: THREE.Mesh;
  // Holiday Easter-egg hats (Santa at Christmas, party hat at New Year...)
  private holidayHatGroup: THREE.Group | null = null;
  private currentHolidayHat: string = "none";

  // Segmented tail
  private tailBase!: THREE.Group;
  private tailMid!: THREE.Group;
  private tailTip!: THREE.Mesh;

  // Ball attachment in mouth for fetch
  public ballInMouth!: THREE.Mesh;

  // Visual Accessories (Bowtie, Hat, Crown, Sunglasses, Scarf, Bell)
  private accessories: Map<string, THREE.Object3D> = new Map();
  private currentAccessoryId?: string;

  private breed: DogBreed = "golden";
  private collarColorHex: number = 0xe11d48; // Rose red collar
  private materials: THREE.Material[] = [];

  // Motion states
  private walkCycle: number = 0;
  private earTwitchTimer: number = 0;
  private blinkTimer: number = 0;

  constructor(breed: DogBreed = "golden", collarColor: string = "#e11d48") {
    this.group = new THREE.Group();
    this.breed = breed;
    this.collarColorHex = parseInt(collarColor.replace("#", "0x"), 16) || 0xe11d48;
    this.buildDog();
  }

  private buildDog() {
    // Clear previous children
    while (this.group.children.length > 0) {
      this.group.remove(this.group.children[0]);
    }
    this.materials.forEach((m) => m.dispose());
    this.materials = [];

    const colors = BREED_COLORS[this.breed];

    // Realistic fur shaders with soft specular sheen
    const furMaterial = new THREE.MeshStandardMaterial({
      color: colors.primary,
      roughness: 0.85,
      metalness: 0.05,
      shadowSide: THREE.DoubleSide,
    });
    const secondaryFurMaterial = new THREE.MeshStandardMaterial({
      color: colors.secondary,
      roughness: 0.85,
      metalness: 0.05,
    });
    const bellyFurMaterial = new THREE.MeshStandardMaterial({
      color: colors.belly,
      roughness: 0.9,
      metalness: 0.0,
    });
    const noseMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.25,
      metalness: 0.1,
    });
    const eyeMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e150d,
      roughness: 0.1,
      metalness: 0.3,
    });
    const tongueMaterial = new THREE.MeshStandardMaterial({
      color: 0xff6b8b,
      roughness: 0.4,
      metalness: 0.0,
    });
    const collarMaterial = new THREE.MeshStandardMaterial({
      color: this.collarColorHex,
      roughness: 0.4,
      metalness: 0.3,
    });
    const goldTagMaterial = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.2,
      metalness: 0.85,
    });

    this.materials.push(
      furMaterial,
      secondaryFurMaterial,
      bellyFurMaterial,
      noseMaterial,
      eyeMaterial,
      tongueMaterial,
      collarMaterial,
      goldTagMaterial
    );

    // Root dog body container
    this.bodyMesh = new THREE.Group();
    this.bodyMesh.position.y = 1.05; // Ground clearance for standing dog
    this.group.add(this.bodyMesh);

    // 1. Torso / Ribcage
    const torsoGeom = new THREE.CylinderGeometry(0.55, 0.48, 1.25, 16);
    torsoGeom.rotateZ(Math.PI / 2);
    this.torsoMesh = new THREE.Mesh(torsoGeom, furMaterial);
    this.torsoMesh.castShadow = true;
    this.torsoMesh.receiveShadow = true;
    this.torsoMesh.position.set(0, 0, -0.15);
    this.bodyMesh.add(this.torsoMesh);

    // Chest expansion
    const chestGeom = new THREE.SphereGeometry(0.58, 16, 16);
    chestGeom.scale(0.9, 1.05, 1.15);
    this.chestMesh = new THREE.Mesh(chestGeom, bellyFurMaterial);
    this.chestMesh.position.set(0, 0.05, 0.35);
    this.chestMesh.castShadow = true;
    this.bodyMesh.add(this.chestMesh);

    // 2. Neck
    this.neckMesh = new THREE.Group();
    this.neckMesh.position.set(0, 0.25, 0.65);
    this.neckMesh.rotation.x = -0.35;
    this.bodyMesh.add(this.neckMesh);

    const neckGeom = new THREE.CylinderGeometry(0.38, 0.48, 0.65, 14);
    const neckCylinder = new THREE.Mesh(neckGeom, furMaterial);
    neckCylinder.position.y = 0.25;
    neckCylinder.castShadow = true;
    this.neckMesh.add(neckCylinder);

    // Collar
    const collarGeom = new THREE.TorusGeometry(0.42, 0.06, 10, 24);
    collarGeom.rotateX(Math.PI / 2);
    this.collarMesh = new THREE.Mesh(collarGeom, collarMaterial);
    this.collarMesh.position.y = 0.15;
    this.collarMesh.castShadow = true;
    this.neckMesh.add(this.collarMesh);

    // Golden tag
    const tagGeom = new THREE.CylinderGeometry(0.09, 0.09, 0.02, 16);
    tagGeom.rotateX(Math.PI / 2);
    this.collarTag = new THREE.Mesh(tagGeom, goldTagMaterial);
    this.collarTag.position.set(0, 0.08, 0.44);
    this.neckMesh.add(this.collarTag);

    // 3. Head
    this.headMesh = new THREE.Group();
    this.headMesh.position.set(0, 0.55, 0.15);
    this.neckMesh.add(this.headMesh);

    // Cranium
    const headGeom = new THREE.SphereGeometry(0.46, 16, 16);
    headGeom.scale(0.95, 1.0, 1.05);
    const headCranium = new THREE.Mesh(headGeom, furMaterial);
    headCranium.castShadow = true;
    this.headMesh.add(headCranium);

    // Snout / Muzzle
    const snoutGeom = new THREE.CylinderGeometry(0.24, 0.34, 0.58, 14);
    snoutGeom.rotateX(Math.PI / 2);
    this.snoutMesh = new THREE.Mesh(snoutGeom, secondaryFurMaterial);
    this.snoutMesh.position.set(0, -0.06, 0.46);
    this.snoutMesh.castShadow = true;
    this.headMesh.add(this.snoutMesh);

    // Nose
    const noseGeom = new THREE.SphereGeometry(0.12, 12, 12);
    noseGeom.scale(1.2, 0.85, 1.0);
    const nose = new THREE.Mesh(noseGeom, noseMaterial);
    nose.position.set(0, 0.02, 0.74);
    this.headMesh.add(nose);

    // Eyes with corneal reflection
    const eyeGeom = new THREE.SphereGeometry(0.08, 12, 12);
    this.leftEye = new THREE.Mesh(eyeGeom, eyeMaterial);
    this.leftEye.position.set(0.22, 0.15, 0.36);
    this.headMesh.add(this.leftEye);

    this.rightEye = new THREE.Mesh(eyeGeom, eyeMaterial);
    this.rightEye.position.set(-0.22, 0.15, 0.36);
    this.headMesh.add(this.rightEye);

    // Eye highlights
    const highlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const hlGeom = new THREE.SphereGeometry(0.025, 8, 8);
    const leftHl = new THREE.Mesh(hlGeom, highlightMat);
    leftHl.position.set(0.24, 0.18, 0.42);
    this.headMesh.add(leftHl);
    const rightHl = new THREE.Mesh(hlGeom, highlightMat);
    rightHl.position.set(-0.2, 0.18, 0.42);
    this.headMesh.add(rightHl);

    // Lower Jaw (openable for barks, panting & eating)
    const jawGeom = new THREE.CylinderGeometry(0.18, 0.26, 0.45, 12);
    jawGeom.rotateX(Math.PI / 2);
    this.jawMesh = new THREE.Mesh(jawGeom, secondaryFurMaterial);
    this.jawMesh.position.set(0, -0.22, 0.4);
    this.headMesh.add(this.jawMesh);

    // Tongue
    const tongueGeom = new THREE.BoxGeometry(0.16, 0.03, 0.3);
    this.tongueMesh = new THREE.Mesh(tongueGeom, tongueMaterial);
    this.tongueMesh.position.set(0, -0.16, 0.45);
    this.tongueMesh.rotation.x = 0.2;
    this.headMesh.add(this.tongueMesh);
    this.tongueMesh.visible = false; // Shown during panting/eating

    // Tennis ball in mouth (for fetch)
    const ballGeom = new THREE.SphereGeometry(0.16, 16, 16);
    const ballMat = new THREE.MeshStandardMaterial({
      color: 0xccff00, // Neon tennis yellow
      roughness: 0.9,
    });
    this.materials.push(ballMat);
    this.ballInMouth = new THREE.Mesh(ballGeom, ballMat);
    this.ballInMouth.position.set(0, -0.08, 0.65);
    this.ballInMouth.visible = false;
    this.headMesh.add(this.ballInMouth);

    // Floppy ears
    const earGeom = new THREE.ConeGeometry(0.24, 0.65, 10);
    earGeom.scale(0.8, 1, 0.35);
    earGeom.rotateX(Math.PI);

    this.leftEar = new THREE.Group();
    this.leftEar.position.set(0.38, 0.22, -0.05);
    this.leftEar.rotation.set(0.2, 0.1, 0.45);
    const leftEarMesh = new THREE.Mesh(earGeom, secondaryFurMaterial);
    leftEarMesh.position.y = -0.28;
    leftEarMesh.castShadow = true;
    this.leftEar.add(leftEarMesh);
    this.headMesh.add(this.leftEar);

    this.rightEar = new THREE.Group();
    this.rightEar.position.set(-0.38, 0.22, -0.05);
    this.rightEar.rotation.set(0.2, -0.1, -0.45);
    const rightEarMesh = new THREE.Mesh(earGeom, secondaryFurMaterial);
    rightEarMesh.position.y = -0.28;
    rightEarMesh.castShadow = true;
    this.rightEar.add(rightEarMesh);
    this.headMesh.add(this.rightEar);

    // 4. Legs & Paws
    this.frontLeftLeg = this.createLeg(0.34, -0.1, 0.42, furMaterial, true);
    this.frontRightLeg = this.createLeg(-0.34, -0.1, 0.42, furMaterial, true);
    this.backLeftLeg = this.createLeg(0.36, -0.12, -0.65, furMaterial, false);
    this.backRightLeg = this.createLeg(-0.36, -0.12, -0.65, furMaterial, false);

    this.bodyMesh.add(this.frontLeftLeg);
    this.bodyMesh.add(this.frontRightLeg);
    this.bodyMesh.add(this.backLeftLeg);
    this.bodyMesh.add(this.backRightLeg);

    // Paw references
    this.frontLeftPaw = this.frontLeftLeg.getObjectByName("paw") as THREE.Mesh;
    this.frontRightPaw = this.frontRightLeg.getObjectByName("paw") as THREE.Mesh;

    // 5. Tail (segmented for natural swooshing)
    this.tailBase = new THREE.Group();
    this.tailBase.position.set(0, 0.32, -0.78);
    this.tailBase.rotation.x = 0.65;
    this.bodyMesh.add(this.tailBase);

    const tailBaseGeom = new THREE.CylinderGeometry(0.1, 0.14, 0.4, 10);
    const tailBaseMesh = new THREE.Mesh(tailBaseGeom, furMaterial);
    tailBaseMesh.position.y = 0.2;
    tailBaseMesh.castShadow = true;
    this.tailBase.add(tailBaseMesh);

    this.tailMid = new THREE.Group();
    this.tailMid.position.y = 0.38;
    this.tailBase.add(this.tailMid);

    const tailMidGeom = new THREE.CylinderGeometry(0.06, 0.1, 0.4, 10);
    const tailMidMesh = new THREE.Mesh(tailMidGeom, secondaryFurMaterial);
    tailMidMesh.position.y = 0.2;
    tailMidMesh.castShadow = true;
    this.tailMid.add(tailMidMesh);

    const tailTipGeom = new THREE.SphereGeometry(0.08, 8, 8);
    tailTipGeom.scale(0.8, 1.4, 0.8);
    this.tailTip = new THREE.Mesh(tailTipGeom, furMaterial);
    this.tailTip.position.y = 0.42;
    this.tailTip.castShadow = true;
    this.tailMid.add(this.tailTip);

    // Shadow catcher footprint
    const shadowGeom = new THREE.PlaneGeometry(1.6, 2.2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.25,
    });
    shadowGeom.rotateX(-Math.PI / 2);
    const shadowMesh = new THREE.Mesh(shadowGeom, shadowMat);
    shadowMesh.position.y = 0.02;
    this.group.add(shadowMesh);

    // 6. Visual Accessories Setup
    this.buildAccessories();
  }

  private buildAccessories() {
    this.accessories.clear();

    // 1. Bowtie (front of collar on neckMesh)
    const bowtieGroup = new THREE.Group();
    bowtieGroup.position.set(0, 0.12, 0.48);
    const bowMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 });
    const knotGeom = new THREE.SphereGeometry(0.045, 8, 8);
    const knot = new THREE.Mesh(knotGeom, bowMat);
    bowtieGroup.add(knot);

    const wingGeom = new THREE.ConeGeometry(0.09, 0.14, 6);
    wingGeom.rotateZ(Math.PI / 2);
    const leftWing = new THREE.Mesh(wingGeom, bowMat);
    leftWing.position.set(-0.08, 0, 0);
    leftWing.scale.set(0.6, 1, 0.5);
    bowtieGroup.add(leftWing);

    const rightWing = new THREE.Mesh(wingGeom, bowMat);
    rightWing.position.set(0.08, 0, 0);
    rightWing.rotation.z = Math.PI;
    rightWing.scale.set(0.6, 1, 0.5);
    bowtieGroup.add(rightWing);
    bowtieGroup.visible = false;
    this.neckMesh.add(bowtieGroup);
    this.accessories.set("bowtie", bowtieGroup);

    // 2. Top Hat (on top of headMesh)
    const hatGroup = new THREE.Group();
    hatGroup.position.set(0, 0.48, 0.05);
    const hatMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.5 });
    const ribbonMat = new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.3 });
    const brimGeom = new THREE.CylinderGeometry(0.42, 0.42, 0.03, 16);
    const brim = new THREE.Mesh(brimGeom, hatMat);
    hatGroup.add(brim);
    const crownGeom = new THREE.CylinderGeometry(0.26, 0.28, 0.38, 16);
    const crownMesh = new THREE.Mesh(crownGeom, hatMat);
    crownMesh.position.y = 0.2;
    hatGroup.add(crownMesh);
    const ribbonGeom = new THREE.CylinderGeometry(0.282, 0.282, 0.08, 16);
    const ribbon = new THREE.Mesh(ribbonGeom, ribbonMat);
    ribbon.position.y = 0.06;
    hatGroup.add(ribbon);
    hatGroup.visible = false;
    this.headMesh.add(hatGroup);
    this.accessories.set("tophat", hatGroup);

    // 3. Golden Crown
    const crownGroup = new THREE.Group();
    crownGroup.position.set(0, 0.48, 0.05);
    const goldCrownMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.8, roughness: 0.2 });
    const crownBaseGeom = new THREE.CylinderGeometry(0.24, 0.22, 0.14, 16);
    const crownBase = new THREE.Mesh(crownBaseGeom, goldCrownMat);
    crownGroup.add(crownBase);
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const spikeGeom = new THREE.ConeGeometry(0.05, 0.14, 4);
      const spike = new THREE.Mesh(spikeGeom, goldCrownMat);
      spike.position.set(Math.sin(angle) * 0.2, 0.14, Math.cos(angle) * 0.2);
      crownGroup.add(spike);
    }
    crownGroup.visible = false;
    this.headMesh.add(crownGroup);
    this.accessories.set("crown", crownGroup);

    // 4. Cool Sunglasses
    const glassesGroup = new THREE.Group();
    glassesGroup.position.set(0, 0.16, 0.45);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.6, roughness: 0.2 });
    const lensMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.9, roughness: 0.1, transparent: true, opacity: 0.85 });
    const lensGeom = new THREE.BoxGeometry(0.16, 0.1, 0.02);
    const leftLens = new THREE.Mesh(lensGeom, lensMat);
    leftLens.position.set(0.2, 0, 0);
    glassesGroup.add(leftLens);
    const rightLens = new THREE.Mesh(lensGeom, lensMat);
    rightLens.position.set(-0.2, 0, 0);
    glassesGroup.add(rightLens);
    const bridgeGeom = new THREE.BoxGeometry(0.14, 0.02, 0.02);
    const bridge = new THREE.Mesh(bridgeGeom, frameMat);
    glassesGroup.add(bridge);
    glassesGroup.visible = false;
    this.headMesh.add(glassesGroup);
    this.accessories.set("sunglasses", glassesGroup);

    // 5. Cozy Warm Scarf
    const scarfGroup = new THREE.Group();
    scarfGroup.position.set(0, 0.12, 0);
    const scarfMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.8 });
    const scarfGeom = new THREE.TorusGeometry(0.46, 0.1, 10, 24);
    scarfGeom.rotateX(Math.PI / 2);
    const scarfRing = new THREE.Mesh(scarfGeom, scarfMat);
    scarfGroup.add(scarfRing);
    const tailGeom = new THREE.BoxGeometry(0.14, 0.35, 0.05);
    const tail = new THREE.Mesh(tailGeom, scarfMat);
    tail.position.set(0.24, -0.15, 0.38);
    tail.rotation.z = 0.2;
    scarfGroup.add(tail);
    scarfGroup.visible = false;
    this.neckMesh.add(scarfGroup);
    this.accessories.set("scarf", scarfGroup);

    // 6. Shiny Bell Collar Charm
    const bellGroup = new THREE.Group();
    bellGroup.position.set(0, 0.06, 0.48);
    const bellMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.9, roughness: 0.15 });
    const bellSphere = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 12), bellMat);
    bellGroup.add(bellSphere);
    bellGroup.visible = false;
    this.neckMesh.add(bellGroup);
    this.accessories.set("bell", bellGroup);

    if (this.currentAccessoryId) {
      this.setAccessory(this.currentAccessoryId);
    }

    // Rebuild the holiday hat after a breed change (headMesh was recreated)
    this.holidayHatGroup = null;
    if (this.currentHolidayHat !== "none") {
      this.setHolidayHat(this.currentHolidayHat as "santa");
    }
  }

  /**
   * Holiday Easter-egg hat: a bobbling Santa hat at Christmas
   * ("santa") — hidden otherwise ("none").
   */
  public setHolidayHat(kind: "santa" | "none") {
    this.currentHolidayHat = kind;
    if (!this.holidayHatGroup && kind === "santa") {
      this.holidayHatGroup = new THREE.Group();
      const redMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.5 });
      const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
      // Droopy cone cap
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.5, 14), redMat);
      cone.position.y = 0.22;
      cone.rotation.z = 0.28;
      cone.castShadow = true;
      this.holidayHatGroup.add(cone);
      // Furry brim
      const brim = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.07, 10, 18), whiteMat);
      brim.rotation.x = Math.PI / 2;
      brim.position.y = -0.03;
      this.holidayHatGroup.add(brim);
      // Pompom on the tip
      const pompom = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), whiteMat);
      pompom.position.set(0.14, 0.44, 0);
      this.holidayHatGroup.add(pompom);
      this.holidayHatGroup.position.set(0, 0.48, 0.05);
      this.holidayHatGroup.rotation.z = 0.3;
      this.headMesh.add(this.holidayHatGroup);
    }
    if (this.holidayHatGroup) {
      this.holidayHatGroup.visible = kind === "santa";
    }
  }

  public setAccessory(accessoryId?: string) {
    this.currentAccessoryId = accessoryId;
    this.accessories.forEach((obj, key) => {
      obj.visible = key === accessoryId;
    });
  }

  private createLeg(
    x: number,
    y: number,
    z: number,
    material: THREE.Material,
    isFront: boolean
  ): THREE.Group {
    const legGroup = new THREE.Group();
    legGroup.position.set(x, y, z);

    // Thigh / upper leg
    const upperRadius = isFront ? 0.18 : 0.24;
    const upperGeom = new THREE.CylinderGeometry(upperRadius * 0.75, upperRadius, 0.55, 12);
    const upperMesh = new THREE.Mesh(upperGeom, material);
    upperMesh.position.y = -0.25;
    upperMesh.castShadow = true;
    legGroup.add(upperMesh);

    // Shin / lower leg
    const lowerGeom = new THREE.CylinderGeometry(0.11, 0.14, 0.5, 10);
    const lowerMesh = new THREE.Mesh(lowerGeom, material);
    lowerMesh.position.set(0, -0.65, isFront ? 0.02 : -0.06);
    lowerMesh.rotation.x = isFront ? 0 : -0.15;
    lowerMesh.castShadow = true;
    legGroup.add(lowerMesh);

    // Paw
    const pawGeom = new THREE.SphereGeometry(0.16, 10, 10);
    pawGeom.scale(1.1, 0.6, 1.4);
    const pawMesh = new THREE.Mesh(pawGeom, material);
    pawMesh.name = "paw";
    pawMesh.position.set(0, -0.92, 0.08);
    pawMesh.castShadow = true;
    legGroup.add(pawMesh);

    return legGroup;
  }

  public setBreed(breed: DogBreed) {
    if (this.breed !== breed) {
      this.breed = breed;
      this.buildDog();
    }
  }

  public setCollarColor(hexColor: string) {
    this.collarColorHex = parseInt(hexColor.replace("#", "0x"), 16);
    if (this.collarMesh) {
      (this.collarMesh.material as THREE.MeshStandardMaterial).color.setHex(this.collarColorHex);
    }
  }

  /**
   * Set animation state
   */
  public setAction(action: DogAction, durationSeconds: number = 0) {
    this.currentAction = action;
    this.actionProgress = 0;
    this.actionDuration = durationSeconds;

    if (action === "bark") {
      sound.playBark("normal");
    } else if (action === "eat") {
      sound.playCrunch();
    } else if (action === "spin" || action === "roll") {
      sound.playSoftWoof();
    }
  }

  /**
   * Update animations each frame (delta in seconds, elapsed time)
   */
  public update(delta: number, elapsed: number) {
    this.actionProgress += delta;
    this.walkCycle += delta * 8;
    this.earTwitchTimer += delta;
    this.blinkTimer += delta;

    // Natural ear twitch
    const earTwitch = Math.sin(this.earTwitchTimer * 3.5) * (Math.sin(this.earTwitchTimer * 0.7) > 0.8 ? 0.2 : 0.02);
    this.leftEar.rotation.z = 0.45 + earTwitch;
    this.rightEar.rotation.z = -0.45 - earTwitch;

    // Reset base transforms
    this.tongueMesh.visible = false;

    // Switch animations
    switch (this.currentAction) {
      case "idle":
        this.animateIdle(elapsed);
        break;
      case "sit":
      case "stay":
        this.animateSit(elapsed);
        break;
      case "bark":
        this.animateBark(elapsed);
        break;
      case "run":
      case "fetch":
        this.animateRun(elapsed);
        break;
      case "roll":
        this.animateRoll(elapsed);
        break;
      case "spin":
        this.animateSpin(elapsed);
        break;
      case "rest":
        this.animateRest(elapsed);
        break;
      case "eat":
        this.animateEat(elapsed);
        break;
      case "handshake":
        this.animateHandshake(elapsed);
        break;
      case "jump":
        this.animateJump(elapsed);
        break;
      case "dance":
        this.animateDance(elapsed);
        break;
      case "backflip":
        this.animateBackflip(elapsed);
        break;
      case "cuddle":
        this.animateCuddle(elapsed);
        break;
      case "zoomies":
        this.animateZoomies(elapsed);
        break;
      case "howl":
        this.animateHowl(elapsed);
        break;
      default:
        this.animateIdle(elapsed);
    }

    // Auto-return to idle if duration elapsed
    if (this.actionDuration > 0 && this.actionProgress >= this.actionDuration) {
      this.setAction("idle");
    }
  }

  private animateIdle(time: number) {
    // Gentle breathing
    const breath = Math.sin(time * 2.2);
    this.bodyMesh.position.y = 1.05 + breath * 0.02;
    this.torsoMesh.scale.set(1 + breath * 0.03, 1 + breath * 0.02, 1);
    this.bodyMesh.rotation.set(0, 0, 0);

    // Attentive head swaying
    this.neckMesh.rotation.set(-0.35 + Math.sin(time * 1.2) * 0.04, Math.cos(time * 0.8) * 0.06, 0);
    this.headMesh.rotation.set(Math.sin(time * 1.5) * 0.03, 0, Math.sin(time * 0.9) * 0.05);

    // Rhythmic happy tail wag
    const wag = Math.sin(time * 4.5) * 0.45;
    this.tailBase.rotation.set(0.65, wag, 0);
    this.tailMid.rotation.y = wag * 0.6;

    // Legs firmly grounded
    this.frontLeftLeg.rotation.set(0, 0, 0);
    this.frontRightLeg.rotation.set(0, 0, 0);
    this.backLeftLeg.rotation.set(0, 0, 0);
    this.backRightLeg.rotation.set(0, 0, 0);

    // Jaw closed
    this.jawMesh.position.y = -0.22;
  }

  private animateSit(time: number) {
    // Torso tilts up, hips drop
    this.bodyMesh.position.y = 0.72;
    this.bodyMesh.rotation.x = -0.45;

    // Head tilts back to look up at owner
    this.neckMesh.rotation.set(0.1, 0, 0);
    this.headMesh.rotation.set(0.35 + Math.sin(time * 2.0) * 0.03, 0, Math.sin(time * 1.1) * 0.04);

    // Front legs straight to support weight
    this.frontLeftLeg.rotation.set(0.42, 0, 0);
    this.frontRightLeg.rotation.set(0.42, 0, 0);

    // Hind legs folded tight to grass
    this.backLeftLeg.rotation.set(1.4, 0.2, 0);
    this.backRightLeg.rotation.set(1.4, -0.2, 0);

    // Tail swishes happily against grass
    const wag = Math.sin(time * 6.0) * 0.55;
    this.tailBase.rotation.set(0.2, wag, 0);
    this.tailMid.rotation.y = wag * 0.7;

    // Slight mouth crack with happy tongue
    this.jawMesh.position.y = -0.25;
    this.tongueMesh.visible = true;
    this.tongueMesh.position.z = 0.48 + Math.sin(time * 3) * 0.03;
  }

  private animateBark(time: number) {
    const p = (this.actionProgress % 0.4) / 0.4;
    const jolt = Math.sin(p * Math.PI);

    this.bodyMesh.position.y = 1.05 + jolt * 0.08;
    this.neckMesh.rotation.set(-0.25 + jolt * 0.2, 0, 0);
    this.headMesh.rotation.set(jolt * 0.25, 0, 0);

    // Open mouth wide for woof
    this.jawMesh.position.y = -0.22 - jolt * 0.12;
    this.tongueMesh.visible = true;

    // Tail stiff & rapid wag
    this.tailBase.rotation.set(0.9, Math.sin(time * 14.0) * 0.6, 0);
    this.tailMid.rotation.y = Math.sin(time * 14.0) * 0.5;

    // Front legs slightly lift on bark impact
    this.frontLeftLeg.rotation.x = -jolt * 0.15;
    this.frontRightLeg.rotation.x = -jolt * 0.15;
  }

  private animateRun(time: number) {
    const cycle = this.walkCycle;

    // Realistic diagonal quadruped trot cycle
    const frontL = Math.sin(cycle) * 0.65;
    const frontR = Math.sin(cycle + Math.PI) * 0.65;
    const backL = Math.sin(cycle + Math.PI) * 0.7;
    const backR = Math.sin(cycle) * 0.7;

    this.bodyMesh.position.y = 1.05 + Math.abs(Math.sin(cycle * 2)) * 0.12;
    this.bodyMesh.rotation.z = Math.sin(cycle) * 0.06;
    this.bodyMesh.rotation.x = Math.sin(cycle * 2) * 0.05;

    this.frontLeftLeg.rotation.x = frontL;
    this.frontRightLeg.rotation.x = frontR;
    this.backLeftLeg.rotation.x = backL;
    this.backRightLeg.rotation.x = backR;

    // Head bobs forward in stride
    this.neckMesh.rotation.set(-0.35 + Math.sin(cycle * 2) * 0.08, 0, 0);

    // Tail streams behind dynamically
    this.tailBase.rotation.set(0.35, Math.sin(cycle) * 0.35, 0);
    this.tailMid.rotation.y = Math.sin(cycle) * 0.4;

    // Panting tongue
    this.tongueMesh.visible = true;
    this.jawMesh.position.y = -0.26;
  }

  private animateRoll(time: number) {
    const rollAngle = (this.actionProgress * 2.5) % (Math.PI * 2);

    this.bodyMesh.position.y = 0.55;
    this.bodyMesh.rotation.z = Math.sin(time * 4) * 0.8 + Math.PI * 0.9;
    this.bodyMesh.rotation.x = 0;

    // Flailing happy paws
    this.frontLeftLeg.rotation.set(-0.6 + Math.sin(time * 8) * 0.3, 0.4, 0.2);
    this.frontRightLeg.rotation.set(-0.6 + Math.cos(time * 8) * 0.3, -0.4, -0.2);
    this.backLeftLeg.rotation.set(0.6 + Math.sin(time * 7) * 0.3, 0.3, 0);
    this.backRightLeg.rotation.set(0.6 + Math.cos(time * 7) * 0.3, -0.3, 0);

    this.neckMesh.rotation.set(-0.1, 0, 0);
    this.tongueMesh.visible = true;
    this.jawMesh.position.y = -0.26;

    // Rapid tail wagging on back
    this.tailBase.rotation.set(0, Math.sin(time * 10) * 0.6, 0);
  }

  private animateSpin(time: number) {
    const spinSpeed = 6.0;
    this.group.rotation.y += 0.08;

    this.bodyMesh.position.y = 1.05 + Math.sin(time * 12) * 0.06;
    this.bodyMesh.rotation.y = 0.3; // Chasing tail curvature

    // Running legs
    this.frontLeftLeg.rotation.x = Math.sin(time * 12) * 0.5;
    this.frontRightLeg.rotation.x = Math.cos(time * 12) * 0.5;
    this.backLeftLeg.rotation.x = Math.sin(time * 12 + Math.PI) * 0.5;
    this.backRightLeg.rotation.x = Math.cos(time * 12 + Math.PI) * 0.5;

    this.tailBase.rotation.set(0.5, 0.8, 0);
    this.tongueMesh.visible = true;
    this.jawMesh.position.y = -0.25;
  }

  private animateRest(time: number) {
    // Dog lies down cozy flat
    this.bodyMesh.position.y = 0.45;
    this.bodyMesh.rotation.set(0, 0, 0.08); // Relaxed slight side tilt

    // Slow deep resting breath
    const deepBreath = Math.sin(time * 1.2);
    this.torsoMesh.scale.set(1 + deepBreath * 0.04, 1 + deepBreath * 0.03, 1);

    // Paws tucked under/forward
    this.frontLeftLeg.rotation.set(1.45, 0, 0.1);
    this.frontRightLeg.rotation.set(1.45, 0, -0.1);
    this.backLeftLeg.rotation.set(-1.45, 0.3, 0);
    this.backRightLeg.rotation.set(-1.45, -0.3, 0);

    // Head resting gently between paws
    this.neckMesh.rotation.set(-0.15, 0, 0);
    this.headMesh.rotation.set(0.1, 0, 0.15);

    // Tail relaxed on grass
    this.tailBase.rotation.set(0.1, 0.1, 0);
    this.tailMid.rotation.y = Math.sin(time * 1.5) * 0.1;
    this.jawMesh.position.y = -0.22;
  }

  private animateEat(time: number) {
    // Head reaches down to ground
    this.bodyMesh.position.y = 0.95;
    this.neckMesh.rotation.set(-0.75, 0, 0);
    this.headMesh.rotation.set(0.35, 0, 0);

    // Chewing jaw movement
    const chew = Math.abs(Math.sin(time * 9)) * 0.15;
    this.jawMesh.position.y = -0.22 - chew;
    this.tongueMesh.visible = true;
    this.tongueMesh.position.z = 0.44 + chew * 0.3;

    // Happy tail wag while eating
    const wag = Math.sin(time * 7) * 0.5;
    this.tailBase.rotation.set(0.8, wag, 0);
    this.tailMid.rotation.y = wag * 0.5;
  }

  private animateHandshake(time: number) {
    // Sitting posture
    this.bodyMesh.position.y = 0.72;
    this.bodyMesh.rotation.x = -0.42;

    this.neckMesh.rotation.set(0.15, 0, 0);
    this.headMesh.rotation.set(0.25, 0, 0.05);

    // Right front leg raised high into hand position!
    const shake = Math.sin(time * 6) * 0.1;
    this.frontRightLeg.rotation.set(1.3 + shake, 0, 0.25);
    this.frontLeftLeg.rotation.set(0.42, 0, 0);

    this.backLeftLeg.rotation.set(1.4, 0.2, 0);
    this.backRightLeg.rotation.set(1.4, -0.2, 0);

    const wag = Math.sin(time * 8) * 0.6;
    this.tailBase.rotation.set(0.4, wag, 0);
    this.tailMid.rotation.y = wag * 0.7;

    this.tongueMesh.visible = true;
    this.jawMesh.position.y = -0.25;
  }

  private animateJump(time: number) {
    const p = (this.actionProgress % 0.8) / 0.8;
    const jumpCurve = Math.sin(p * Math.PI);

    this.bodyMesh.position.y = 1.05 + jumpCurve * 1.8;
    this.bodyMesh.rotation.x = -jumpCurve * 0.4;

    this.frontLeftLeg.rotation.set(-jumpCurve * 0.8, 0, 0);
    this.frontRightLeg.rotation.set(-jumpCurve * 0.8, 0, 0);
    this.backLeftLeg.rotation.set(jumpCurve * 0.9, 0, 0);
    this.backRightLeg.rotation.set(jumpCurve * 0.9, 0, 0);

    this.tailBase.rotation.set(0.8, Math.sin(time * 12) * 0.5, 0);
  }

  private animateDance(time: number) {
    // Dog stands upright on hind legs and dances!
    this.bodyMesh.position.y = 1.35;
    this.bodyMesh.rotation.x = -1.05;
    this.bodyMesh.rotation.z = Math.sin(time * 7) * 0.15; // rhythmic body groove

    // Hind legs supporting standing posture
    this.backLeftLeg.rotation.set(1.1 + Math.sin(time * 7) * 0.1, 0.15, 0);
    this.backRightLeg.rotation.set(1.1 - Math.sin(time * 7) * 0.1, -0.15, 0);

    // Front paws tap-dancing in the air
    const tapL = Math.sin(time * 9) * 0.4;
    const tapR = Math.cos(time * 9) * 0.4;
    this.frontLeftLeg.rotation.set(1.2 + tapL, 0.3, 0.2);
    this.frontRightLeg.rotation.set(1.2 + tapR, -0.3, -0.2);

    // Head bopping happily
    this.neckMesh.rotation.set(0.2, 0, 0);
    this.headMesh.rotation.set(0.25 + Math.sin(time * 8) * 0.08, 0, Math.sin(time * 7) * 0.1);

    // Tail wagging with high excitement
    const wag = Math.sin(time * 14) * 0.7;
    this.tailBase.rotation.set(0.5, wag, 0);
    this.tailMid.rotation.y = wag * 0.8;

    this.tongueMesh.visible = true;
    this.jawMesh.position.y = -0.26;
  }

  private animateBackflip(time: number) {
    // Aerial 360 degree backflip leap!
    const p = Math.min(1, this.actionProgress / Math.max(0.01, this.actionDuration || 1.8));
    const leapY = Math.sin(p * Math.PI);

    this.bodyMesh.position.y = 1.05 + leapY * 2.2;
    // Complete 360 rotation around X axis
    this.bodyMesh.rotation.x = -p * Math.PI * 2;
    this.bodyMesh.rotation.z = 0;

    // Tuck legs during the flip
    const tuck = Math.sin(p * Math.PI) * 0.8;
    this.frontLeftLeg.rotation.set(-0.4 - tuck, 0, 0);
    this.frontRightLeg.rotation.set(-0.4 - tuck, 0, 0);
    this.backLeftLeg.rotation.set(0.4 + tuck, 0, 0);
    this.backRightLeg.rotation.set(0.4 + tuck, 0, 0);

    this.tailBase.rotation.set(0.9, Math.sin(time * 15) * 0.4, 0);
    this.tongueMesh.visible = true;
  }

  private animateCuddle(time: number) {
    // Dog snuggles close in a loving, cozy posture
    this.bodyMesh.position.y = 0.55;
    this.bodyMesh.rotation.set(0, 0.1, 0.12);

    // Soft, comforting breathing
    const breath = Math.sin(time * 1.6);
    this.torsoMesh.scale.set(1 + breath * 0.03, 1 + breath * 0.03, 1);

    // Paws tucked gently around
    this.frontLeftLeg.rotation.set(1.2, 0.2, 0.1);
    this.frontRightLeg.rotation.set(1.3, -0.1, -0.1);
    this.backLeftLeg.rotation.set(-1.2, 0.2, 0);
    this.backRightLeg.rotation.set(-1.2, -0.2, 0);

    // Head tilted up with warm, loving affection
    this.neckMesh.rotation.set(-0.1, 0.1, 0);
    this.headMesh.rotation.set(0.18 + Math.sin(time * 1.5) * 0.03, 0.1, 0.2);

    // Slow, sweet tail swish against grass
    const wag = Math.sin(time * 3.5) * 0.35;
    this.tailBase.rotation.set(0.2, wag, 0);
    this.tailMid.rotation.y = wag * 0.5;

    this.tongueMesh.visible = false;
    this.jawMesh.position.y = -0.22;
  }

  private animateZoomies(time: number) {
    // Frantic, high-speed playful scamper with rapid weave!
    const cycle = time * 18;
    const weave = Math.sin(time * 6) * 0.2;

    this.bodyMesh.position.y = 0.88 + Math.abs(Math.sin(cycle)) * 0.15;
    this.bodyMesh.rotation.x = 0.15; // crouched down low for speed
    this.bodyMesh.rotation.y = weave * 1.2;
    this.bodyMesh.rotation.z = Math.sin(time * 6) * 0.15;

    // Rapid diagonal sprint gait
    this.frontLeftLeg.rotation.x = Math.sin(cycle) * 0.95;
    this.frontRightLeg.rotation.x = Math.sin(cycle + Math.PI) * 0.95;
    this.backLeftLeg.rotation.x = Math.sin(cycle + Math.PI) * 0.95;
    this.backRightLeg.rotation.x = Math.sin(cycle) * 0.95;

    // Head outstretched eagerly
    this.neckMesh.rotation.set(-0.45, 0, 0);
    this.headMesh.rotation.set(0.1, 0, 0);

    // Tail held high and flapping rapidly
    this.tailBase.rotation.set(1.1, Math.sin(time * 20) * 0.8, 0);
    this.tailMid.rotation.y = Math.sin(time * 20) * 0.8;

    this.tongueMesh.visible = true;
    this.jawMesh.position.y = -0.28;
  }

  private animateHowl(time: number) {
    // Sitting and lifting snout high to the sky for a long awoo
    this.bodyMesh.position.y = 0.72;
    this.bodyMesh.rotation.x = -0.5;

    // Neck tilted straight back, head pointing upward
    const howlVibe = Math.sin(time * 10) * 0.03;
    this.neckMesh.rotation.set(0.45 + howlVibe, 0, 0);
    this.headMesh.rotation.set(0.65 + howlVibe, 0, 0);

    // Front legs straight
    this.frontLeftLeg.rotation.set(0.48, 0, 0);
    this.frontRightLeg.rotation.set(0.48, 0, 0);
    this.backLeftLeg.rotation.set(1.4, 0.2, 0);
    this.backRightLeg.rotation.set(1.4, -0.2, 0);

    // O-shaped howling mouth opening
    this.jawMesh.position.y = -0.32 - Math.abs(Math.sin(time * 4)) * 0.06;
    this.tongueMesh.visible = true;

    // Trembling soulful tail
    this.tailBase.rotation.set(0.3, Math.sin(time * 8) * 0.3, 0);
  }
}
