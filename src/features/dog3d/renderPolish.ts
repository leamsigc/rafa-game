import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/**
 * Scene-graph polish pass.
 *
 * The whole game is authored with low-level Three.js primitives (boxes,
 * cylinders, spheres) built up into furniture, houses, city buildings, etc.
 * Those raw primitives read as very "blocky" because every edge is a hard
 * 90° corner and the round parts are faceted.
 *
 * Instead of hand-rewriting hundreds of builder functions, this module walks
 * a finished object tree once and upgrades the geometry in place:
 *
 *  - BoxGeometry        -> softly rounded-corner box (catches highlights on
 *                          every edge, so nothing looks like a flat cube)
 *  - CylinderGeometry   -> more radial segments (silhouette is smooth instead
 *                          of polygonal, e.g. table legs, poles, tree trunks)
 *  - ConeGeometry       -> same treatment for roofs / hat cones / trees
 *  - SphereGeometry     -> denser segments for canopies, bulbs, dog parts
 *
 * Every replacement keeps the exact same world size, pivot and material, so
 * click targets, animations, shadows and layout are untouched — the objects
 * simply look sculpted rather than like raw primitives.
 *
 * It also normalises material response (environment reflections + dithering)
 * so the new scene environment light actually shows up on props and fur.
 */

export interface PolishOptions {
  /** Max corner radius as a fraction of the smallest box dimension. */
  boxRadiusFactor?: number;
  /** Hard cap (world units) on the corner radius so tiny cubes stay crisp. */
  maxBoxRadius?: number;
  /** Minimum radial segments for cylinders/cones. */
  minRadialSegments?: number;
  /** Minimum width segments for spheres. */
  minSphereSegments?: number;
}

const DEFAULTS: Required<PolishOptions> = {
  boxRadiusFactor: 0.22,
  maxBoxRadius: 0.18,
  minRadialSegments: 16,
  minSphereSegments: 16,
};

/** Upgrade a single mesh's geometry in place (same size/pivot/material). */
export function polishMeshGeometry(
  mesh: THREE.Mesh,
  options: PolishOptions = {},
  visited: Set<THREE.BufferGeometry> = new Set()
): boolean {
  const opts = { ...DEFAULTS, ...options };
  const geometry = mesh.geometry;
  if (!geometry || visited.has(geometry)) return false;
  visited.add(geometry);

  // --- Box: rounded corners (subclasses such as RoundedBoxGeometry excluded) ---
  if (geometry instanceof THREE.BoxGeometry && !(geometry instanceof RoundedBoxGeometry)) {
    const p = geometry.parameters as {
      width: number;
      height: number;
      depth: number;
      widthSegments: number;
      heightSegments: number;
      depthSegments: number;
    };
    if (p?.width > 0 && p?.height > 0 && p?.depth > 0) {
      const minDim = Math.min(p.width, p.height, p.depth);
      const radius = Math.max(
        0.002,
        Math.min(opts.maxBoxRadius, minDim * opts.boxRadiusFactor)
      );
      // Segments stay low (2) — enough for a soft chamfer without bloating
      // the vertex count across the whole game world.
      mesh.geometry = new RoundedBoxGeometry(
        p.width,
        p.height,
        p.depth,
        2,
        radius
      );
      return true;
    }
  }

  // --- Cones (roof peaks, hats, trees) are cylinders underneath ---
  if (geometry instanceof THREE.ConeGeometry) {
    const p = geometry.parameters as {
      radius: number;
      height: number;
      radialSegments: number;
      heightSegments: number;
    };
    if (p && p.radialSegments < opts.minRadialSegments) {
      mesh.geometry = new THREE.ConeGeometry(
        p.radius,
        p.height,
        opts.minRadialSegments,
        Math.max(1, p.heightSegments)
      );
      return true;
    }
  } else if (geometry instanceof THREE.CylinderGeometry) {
    const p = geometry.parameters as {
      radiusTop: number;
      radiusBottom: number;
      height: number;
      radialSegments: number;
      heightSegments: number;
      openEnded: boolean;
      thetaStart: number;
      thetaLength: number;
    };
    if (p && p.radialSegments < opts.minRadialSegments) {
      mesh.geometry = new THREE.CylinderGeometry(
        p.radiusTop,
        p.radiusBottom,
        p.height,
        opts.minRadialSegments,
        Math.max(1, p.heightSegments),
        p.openEnded ?? false,
        p.thetaStart ?? 0,
        p.thetaLength ?? Math.PI * 2
      );
      return true;
    }
  }

  // --- Spheres (bulbs, tree canopies, dog parts, flowers) ---
  if (geometry instanceof THREE.SphereGeometry) {
    const p = geometry.parameters as {
      radius: number;
      widthSegments: number;
      heightSegments: number;
    };
    if (p && (p.widthSegments < opts.minSphereSegments || p.heightSegments < opts.minSphereSegments)) {
      mesh.geometry = new THREE.SphereGeometry(
        p.radius,
        Math.max(p.widthSegments, opts.minSphereSegments),
        Math.max(p.heightSegments, opts.minSphereSegments)
      );
      return true;
    }
  }

  return false;
}

/** Give standard/physical materials a consistent, richer light response. */
function polishMaterial(material: THREE.Material): void {
  const m = material as THREE.MeshStandardMaterial;
  if (m && typeof m.envMapIntensity === "number") {
    // Slight global reflection boost so props, fur and wood pick up the
    // scene environment light (looks far less "flat plastic").
    m.envMapIntensity = Math.max(m.envMapIntensity, 0.85);
  }
  if ("dithering" in material) {
    material.dithering = true; // smooths gradient banding on sky/fog/large walls
  }
}

/**
 * Walk an object tree and upgrade every primitive geometry / material in
 * place. Safe to call once after the scene has been built — it never changes
 * positions, scales, userData or hierarchy, so all game logic keeps working.
 */
export function polishScene(root: THREE.Object3D, options: PolishOptions = {}): void {
  const visitedGeometries = new Set<THREE.BufferGeometry>();
  const visitedMaterials = new Set<THREE.Material>();
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if ((mesh as THREE.Mesh).isMesh) {
      polishMeshGeometry(mesh, options, visitedGeometries);
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((mat) => {
        if (mat && !visitedMaterials.has(mat)) {
          visitedMaterials.add(mat);
          polishMaterial(mat);
        }
      });
    }
  });
}
