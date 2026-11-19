import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { boardById } from '../catalog/rigips';
import type { ProjectCalc } from '../calc/materials';
import type { Project } from '../model/types';
import { findCollisions } from '../geometry/contacts';
import { EXIT_FULLSCREEN_ICON, FULLSCREEN_ICON } from '../ui/fullscreen';
import type { FullscreenControl } from '../ui/PlanTab';
import { buildModel3D, type BoxPart, type Layer3D, type MatKey, type Model3D } from './model3d';
import { profileOutline, type ProfileSpec } from './profiles';

const FRAME_COLORS: Record<string, number> = {
  cw: 0x9aa7b4,
  uw: 0x6f7c8a,
  ua: 0x3d6fb3,
  cdMain: 0x8794a1,
  cdSec: 0xb3bec9,
  ud: 0x5f6b77,
  hanger: 0xd08a2e,
  connector: 0xc9a227,
  masonry: 0xc9b9a6,
  disc: 0xe07a2a,
  anchor: 0x6b7480,
  vapor: 0xb0399b,
  timber: 0xc89a5b,
};

const LAYERS: { id: Layer3D; label: string }[] = [
  { id: 'existing', label: 'Istniejące ściany i więźba' },
  { id: 'wallBoards', label: 'Płyty ścian' },
  { id: 'wallFrame', label: 'Ruszt i łączniki ścian' },
  { id: 'ceilingBoards', label: 'Płyty sufitu' },
  { id: 'ceilingFrame', label: 'Ruszt i łączniki sufitu' },
];

type Visibility = Record<Layer3D, boolean>;
const ALL_ON: Visibility = { existing: true, wallBoards: true, wallFrame: true, ceilingBoards: true, ceilingFrame: true };

/** Jakość grafiki: niska – bez cieni (słabe telefony), średnia – cienie, wysoka – miękkie cienie i AO */
export type Quality3D = 'low' | 'medium' | 'high';
const QUALITY_LABEL: Record<Quality3D, string> = { low: 'niska', medium: 'średnia', high: 'wysoka' };
const QUALITY_NEXT: Record<Quality3D, Quality3D> = { low: 'medium', medium: 'high', high: 'low' };
const QUALITY_KEY = 'rigipsiarz.view3d.quality';

function initialQuality(): Quality3D {
  try {
    const q = localStorage.getItem(QUALITY_KEY);
    if (q === 'low' || q === 'medium' || q === 'high') return q;
  } catch {
    /* brak dostępu do pamięci – domyślna jakość */
  }
  // telefon (dotyk) – średnia, komputer – wysoka
  return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches ? 'medium' : 'high';
}

/** Wygląd materiałów: płyty matowe, stal ocynkowana lekko metaliczna */
const FRAME_LOOK: Record<string, { metalness: number; roughness: number }> = {
  cw: { metalness: 0.65, roughness: 0.38 },
  uw: { metalness: 0.65, roughness: 0.42 },
  cdMain: { metalness: 0.65, roughness: 0.38 },
  cdSec: { metalness: 0.65, roughness: 0.38 },
  ud: { metalness: 0.65, roughness: 0.42 },
  ua: { metalness: 0.45, roughness: 0.45 },
  hanger: { metalness: 0.5, roughness: 0.45 },
  connector: { metalness: 0.55, roughness: 0.4 },
  masonry: { metalness: 0, roughness: 0.95 },
  timber: { metalness: 0, roughness: 0.85 },
};

function materialFor(key: MatKey, quality: Quality3D): THREE.Material {
  const isBoard = key.startsWith('board:');
  const color = new THREE.Color(isBoard ? boardById(key.slice(6)).color : (FRAME_COLORS[key] ?? 0x999999));
  // płyty obustronnie – przekroje przy otworach i wycięciach też mają być widoczne
  const side = isBoard ? THREE.DoubleSide : THREE.FrontSide;
  // folia paroizolacyjna: półprzezroczysta, żeby było widać ruszt i wełnę za nią
  if (key === 'vapor') return new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.45, depthWrite: false });
  if (quality === 'low') return new THREE.MeshLambertMaterial({ color, side });
  const look = isBoard ? { metalness: 0, roughness: 0.92 } : (FRAME_LOOK[key] ?? { metalness: 0.4, roughness: 0.5 });
  return new THREE.MeshStandardMaterial({ color, side, ...look });
}

/** Przekrój profilu wyciągnięty na długość 1 m wzdłuż osi profilu (y dla 'up', x dla 'along') */
function profileGeometry(spec: ProfileSpec, A: number, B: number): THREE.BufferGeometry {
  const outline = profileOutline(spec, A, B);
  // punkty kształtu dobrane tak, by po obrocie (a, b) trafiły w osie lokalne bryły
  const pts = outline.map((q) => (spec.axis === 'up' ? new THREE.Vector2(q.x, -q.y) : new THREE.Vector2(-q.y, q.x)));
  const g: THREE.BufferGeometry = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 1, bevelEnabled: false, steps: 1 });
  if (spec.axis === 'up') {
    g.rotateX(-Math.PI / 2); // (a, -b, z) → (a, z, b)
    g.translate(0, -0.5, 0);
  } else {
    g.rotateY(Math.PI / 2); // (-b, a, z) → (z, a, b)
    g.translate(-0.5, 0, 0);
  }
  g.deleteAttribute('uv');
  return g;
}

/** Buduje grupy siatek (po jednej na warstwę i materiał – mało wywołań rysowania) */
function buildGroups(model: Model3D, quality: Quality3D): Map<Layer3D, THREE.Group> {
  const byKey = new Map<string, THREE.BufferGeometry[]>();
  const edgesByLayer = new Map<Layer3D, THREE.BufferGeometry[]>();
  // profile tego samego przekroju – jedna siatka z instancjami (InstancedMesh)
  const profiles = new Map<string, { layer: Layer3D; mat: MatKey; spec: ProfileSpec; A: number; B: number; parts: BoxPart[] }>();
  const tmp = new THREE.Object3D();
  for (const part of model.parts) {
    if (part.type === 'box' && part.profile) {
      const spec = part.profile;
      const A = spec.axis === 'up' ? part.s[0] : part.s[1];
      const B = part.s[2];
      const key = `${part.layer}|${part.mat}|${spec.axis}|${spec.web}|${spec.t}|${spec.lip}|${A.toFixed(4)}|${B.toFixed(4)}`;
      const entry = profiles.get(key) ?? profiles.set(key, { layer: part.layer, mat: part.mat, spec, A, B, parts: [] }).get(key)!;
      entry.parts.push(part);
      continue;
    }
    let g: THREE.BufferGeometry;
    if (part.type === 'box') {
      g = new THREE.BoxGeometry(part.s[0], part.s[1], part.s[2]);
      tmp.position.set(...part.c);
      // najpierw pochylenie wokół osi długości (skosy poddasza), potem obrót w planie
      tmp.rotation.set(part.rotX ?? 0, part.rotY, 0, 'YXZ');
      tmp.updateMatrix();
      g.applyMatrix4(tmp.matrix);
    } else if (part.type === 'cyl') {
      // walec three.js stoi wzdłuż osi Y – obracamy go do osi łącznika
      g = new THREE.CylinderGeometry(part.r, part.r, part.len, 20);
      tmp.position.set(...part.c);
      tmp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...part.axis).normalize());
      tmp.scale.set(1, 1, 1);
      tmp.updateMatrix();
      g.applyMatrix4(tmp.matrix);
      tmp.quaternion.identity();
    } else if (part.type === 'panel') {
      // obrys w płaszczyźnie ściany (x wzdłuż, y w górę), grubość wzdłuż normalnej
      const [outer, ...inner] = part.loops;
      const shape = new THREE.Shape(outer.map((q) => new THREE.Vector2(q.x, q.y)));
      for (const h of inner) shape.holes.push(new THREE.Path(h.map((q) => new THREE.Vector2(q.x, q.y))));
      g = new THREE.ExtrudeGeometry(shape, { depth: part.thickness, bevelEnabled: false });
      g.translate(0, 0, part.n - part.thickness / 2);
      tmp.position.set(...part.origin);
      tmp.rotation.set(0, part.rotY, 0);
      tmp.updateMatrix();
      g.applyMatrix4(tmp.matrix);
    } else {
      // obrys w płaszczyźnie XY (x, -z), potem obrót do poziomu
      const shape = new THREE.Shape(part.points.map((q) => new THREE.Vector2(q.x, -q.y)));
      g = new THREE.ExtrudeGeometry(shape, { depth: part.thickness, bevelEnabled: false });
      g.rotateX(-Math.PI / 2);
      g.translate(0, part.y, 0);
    }
    if (g.index) g = g.toNonIndexed();
    g.deleteAttribute('uv');
    const key = `${part.layer}|${part.mat}`;
    (byKey.get(key) ?? byKey.set(key, []).get(key)!).push(g);
    if (part.layer === 'wallBoards' || part.layer === 'ceilingBoards') {
      const e = new THREE.EdgesGeometry(g, 30);
      (edgesByLayer.get(part.layer) ?? edgesByLayer.set(part.layer, []).get(part.layer)!).push(e);
    }
  }
  const shadows = quality !== 'low';
  const groups = new Map<Layer3D, THREE.Group>();
  const groupOf = (l: Layer3D) => groups.get(l) ?? groups.set(l, new THREE.Group()).get(l)!;
  for (const [key, list] of byKey) {
    const [layer, mat] = key.split('|') as [Layer3D, MatKey];
    const merged = mergeGeometries(list, false);
    list.forEach((g) => g.dispose());
    if (!merged) continue;
    const material = materialFor(mat, quality);
    if (layer === 'wallBoards' || layer === 'ceilingBoards') {
      // płyty lekko odsunięte w głąb, żeby krawędzie (spoiny) były widoczne
      material.polygonOffset = true;
      material.polygonOffsetFactor = 1;
      material.polygonOffsetUnits = 1;
    }
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = shadows;
    mesh.receiveShadow = shadows;
    groupOf(layer).add(mesh);
  }
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const along = new THREE.Vector3(1, 0, 0);
  const qx = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scale = new THREE.Vector3();
  for (const { layer, mat, spec, A, B, parts } of profiles.values()) {
    const mesh = new THREE.InstancedMesh(profileGeometry(spec, A, B), materialFor(mat, quality), parts.length);
    parts.forEach((part, i) => {
      pos.set(...part.c);
      q.setFromAxisAngle(up, part.rotY);
      if (part.rotX) q.multiply(qx.setFromAxisAngle(along, part.rotX));
      // skalujemy tylko długość – przekrój zostaje bez zmian
      if (spec.axis === 'up') scale.set(1, part.s[1], 1);
      else scale.set(part.s[0], 1, 1);
      mesh.setMatrixAt(i, m.compose(pos, q, scale));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.castShadow = shadows;
    mesh.receiveShadow = shadows;
    groupOf(layer).add(mesh);
  }
  for (const [layer, list] of edgesByLayer) {
    const merged = mergeGeometries(list, false);
    list.forEach((g) => g.dispose());
    if (!merged) continue;
    groupOf(layer).add(new THREE.LineSegments(merged, new THREE.LineBasicMaterial({ color: 0x55606c })));
  }
  return groups;
}

function disposeObject(o: THREE.Object3D) {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else mat?.dispose();
  });
}

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export default function View3D({ project, calc, fullscreen }: { project: Project; calc: ProjectCalc; fullscreen?: FullscreenControl }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const ctx = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    content: THREE.Group;
    groups: Map<Layer3D, THREE.Group>;
    sun: THREE.DirectionalLight;
    dirty: boolean;
  } | null>(null);
  const [vis, setVis] = useState<Visibility>(ALL_ON);
  const [quality, setQuality] = useState<Quality3D>(initialQuality);
  const [supported] = useState(webglAvailable);
  const model = useMemo(() => buildModel3D(project, calc), [project, calc]);
  // elementy różnych ścian zajmujące to samo miejsce (model styków nie umie ich połączyć)
  const collisions = useMemo(() => findCollisions(project), [project]);
  const wallName = (id: string) => {
    const i = project.walls.findIndex((w) => w.id === id);
    const w = project.walls[i];
    const n = project.walls.slice(0, i + 1).filter((x) => (x.kind === 'existing') === (w?.kind === 'existing')).length;
    return w?.kind === 'existing' ? `Istniejąca ściana ${n}` : `Ściana ${n}`;
  };
  const framed = useRef(false);
  // położenie kamery zachowane przy zmianie jakości (scena budowana od nowa)
  const view = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null);

  const changeQuality = () => {
    const next = QUALITY_NEXT[quality];
    try {
      localStorage.setItem(QUALITY_KEY, next);
    } catch {
      /* bez zapisu – wybór tylko do zamknięcia widoku */
    }
    setQuality(next);
  };

  // inicjalizacja sceny (od nowa po zmianie jakości)
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !supported) return;
    const high = quality === 'high';
    const renderer = new THREE.WebGLRenderer({ antialias: !high, powerPreference: high ? 'high-performance' : 'low-power' });
    const dpr = window.devicePixelRatio || 1;
    renderer.setPixelRatio(Math.min(dpr, quality === 'low' ? 1 : quality === 'medium' ? 1.5 : 2));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = quality === 'low' ? THREE.NoToneMapping : THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = quality !== 'low';
    renderer.shadowMap.type = THREE.PCFShadowMap;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const env = quality === 'low' ? null : new THREE.PMREMGenerator(renderer);
    if (env) {
      // odbicia otoczenia – stal ocynkowana wygląda jak metal, a nie jak szara plastelina
      scene.environment = env.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environmentIntensity = 0.55;
      env.dispose();
    }
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f99, quality === 'low' ? 1.6 : 0.9));
    const sun = new THREE.DirectionalLight(0xfff6ea, quality === 'low' ? 1.4 : 2.1);
    sun.position.set(5, 10, 7);
    sun.castShadow = quality !== 'low';
    sun.shadow.mapSize.set(high ? 2048 : 1024, high ? 2048 : 1024);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    sun.shadow.radius = high ? 3 : 1;
    scene.add(sun, sun.target);
    const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 500);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.maxPolarAngle = Math.PI * 0.95;
    controls.minDistance = 0.3;
    controls.maxDistance = 120;
    controls.zoomToCursor = true;
    controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    if (view.current) {
      camera.position.copy(view.current.pos);
      controls.target.copy(view.current.target);
      controls.update();
      framed.current = true;
    }
    const content = new THREE.Group();
    scene.add(content);

    // wysoka jakość: cieniowanie zakamarków (GTAO) w osobnym przebiegu; MSAA w buforze pośrednim
    let composer: EffectComposer | null = null;
    if (high && renderer.capabilities.isWebGL2) {
      const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
      composer = new EffectComposer(renderer, rt);
      composer.addPass(new RenderPass(scene, camera));
      const ao = new GTAOPass(scene, camera, 1, 1);
      ao.updateGtaoMaterial({ radius: 0.25, distanceExponent: 1, thickness: 1, scale: 1 });
      ao.blendIntensity = 0.85;
      composer.addPass(ao);
      composer.addPass(new OutputPass());
    }

    const state = { renderer, scene, camera, controls, content, groups: new Map(), sun, dirty: true };
    ctx.current = state;
    controls.addEventListener('change', () => (state.dirty = true));

    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      if (composer) {
        composer.setPixelRatio(renderer.getPixelRatio());
        composer.setSize(w, h);
      }
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      state.dirty = true;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    // renderujemy tylko, gdy coś się zmieniło (oszczędza baterię telefonu)
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      controls.update();
      if (state.dirty) {
        state.dirty = false;
        if (composer) composer.render();
        else renderer.render(scene, camera);
      }
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      view.current = { pos: camera.position.clone(), target: controls.target.clone() };
      controls.dispose();
      disposeObject(scene);
      scene.environment?.dispose();
      composer?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      ctx.current = null;
      framed.current = false;
    };
  }, [supported, quality]);

  // przebudowa zawartości po zmianie projektu
  useEffect(() => {
    const s = ctx.current;
    if (!s) return;
    disposeObject(s.content);
    s.content.clear();
    const { min, max } = model.bounds;
    const cx = (min[0] + max[0]) / 2;
    const cz = (min[2] + max[2]) / 2;
    const span = Math.max(max[0] - min[0], max[2] - min[2], 2);

    const grid = new THREE.GridHelper(Math.ceil(span + 4), Math.ceil(span + 4), 0x9aa4b1, 0xd5dae1);
    grid.position.set(Math.round(cx), 0, Math.round(cz));
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.6;
    s.content.add(grid);

    if (quality !== 'low') {
      // posadzka przyjmująca cienie (sama niewidoczna – widać tylko cień)
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(span + 8, span + 8), new THREE.ShadowMaterial({ opacity: 0.22 }));
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(cx, -0.001, cz);
      floor.receiveShadow = true;
      s.content.add(floor);
      // słońce i zakres mapy cieni dopasowane do modelu
      const radius = Math.hypot(span, max[1]) / 2 + 1;
      const dir = new THREE.Vector3(0.45, 1, 0.65).normalize();
      s.sun.target.position.set(cx, max[1] / 2, cz);
      s.sun.position.copy(s.sun.target.position).addScaledVector(dir, radius * 3);
      const cam = s.sun.shadow.camera;
      cam.left = cam.bottom = -radius;
      cam.right = cam.top = radius;
      cam.near = radius * 0.5;
      cam.far = radius * 5;
      cam.updateProjectionMatrix();
      s.sun.shadow.needsUpdate = true;
    }

    s.groups = buildGroups(model, quality);
    for (const [layer, g] of s.groups) {
      g.visible = vis[layer];
      s.content.add(g);
    }
    if (!framed.current) {
      framed.current = true;
      frame(s.camera, s.controls, model);
    }
    s.dirty = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, quality]);

  // widoczność warstw
  useEffect(() => {
    const s = ctx.current;
    if (!s) return;
    for (const [layer, g] of s.groups) g.visible = vis[layer];
    s.dirty = true;
  }, [vis]);

  const hasAttics = (project.attics?.length ?? 0) > 0;
  const hasCeilings = project.ceilings.length > 0 || hasAttics;
  const hasWalls = project.walls.length > 0;
  const hasExisting = project.walls.some((w) => w.kind === 'existing') || hasAttics;

  if (!supported) {
    return (
      <div className="card view3d-empty">
        <p>Ta przeglądarka nie obsługuje grafiki 3D (WebGL). Wyliczenia i lista zakupów działają normalnie.</p>
      </div>
    );
  }

  return (
    <div className="view3d">
      <div className="view3d-toolbar" role="group" aria-label="Widoczne warstwy">
        {LAYERS.filter((l) => (l.id === 'existing' ? hasExisting : l.id.startsWith('wall') ? hasWalls : hasCeilings)).map((l) => (
          <label key={l.id} className={`chip ${vis[l.id] ? 'on' : ''}`}>
            <input
              type="checkbox"
              checked={vis[l.id]}
              onChange={(e) => setVis((v) => ({ ...v, [l.id]: e.target.checked }))}
            />
            {l.label}
          </label>
        ))}
        <button
          className="chip"
          onClick={() => setVis((v) => ({ ...v, wallBoards: !v.wallBoards, ceilingBoards: !v.wallBoards }))}
        >
          {vis.wallBoards ? 'Pokaż sam ruszt' : 'Pokaż płyty'}
        </button>
        <button
          className="chip"
          onClick={() => {
            const s = ctx.current;
            if (s) {
              frame(s.camera, s.controls, model);
              s.dirty = true;
            }
          }}
        >
          Wyśrodkuj
        </button>
        <button className="chip" onClick={changeQuality} title="Niska – bez cieni, najpłynniej na słabszym telefonie. Wysoka – miękkie cienie i cieniowanie zakamarków.">
          Grafika: {QUALITY_LABEL[quality]}
        </button>
        {fullscreen && !fullscreen.on && (
          <button className="chip" onClick={fullscreen.toggle}>
            <svg className="chip-icon" viewBox="0 0 24 24" aria-hidden>
              <path d={FULLSCREEN_ICON} />
            </svg>
            Pełny ekran
          </button>
        )}
      </div>
      {fullscreen?.on && (
        <button className="fab on view3d-exit" onClick={fullscreen.toggle} aria-label="Zamknij pełny ekran" title="Zamknij pełny ekran">
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d={EXIT_FULLSCREEN_ICON} />
          </svg>
        </button>
      )}
      <div className="view3d-canvas" ref={hostRef}>
        {!hasWalls && !hasCeilings && <p className="view3d-hint">Dodaj ścianę, sufit lub poddasze, żeby zobaczyć model.</p>}
      </div>
      {collisions.length > 0 && (
        <div className="card view3d-collisions" role="status">
          <strong>Elementy nachodzą na siebie ({collisions.length})</strong>
          <ul className="warnings">
            {collisions.slice(0, 6).map((c, i) => (
              <li key={i}>
                {wallName(c.a.wallId)} ({c.a.label}) i {wallName(c.b.wallId)} ({c.b.label}) zajmują to samo miejsce w rzucie,{' '}
                {Math.round(c.areaCm2)} cm². Połącz ściany w jednym punkcie na planie albo przesuń jedną z nich.
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="muted small view3d-help">
        Obracaj jednym palcem, przybliżaj i przesuwaj dwoma. Na komputerze: lewy przycisk obraca, kółko przybliża, prawy
        przesuwa.
      </p>
    </div>
  );
}

/** Ustawia kamerę tak, by cały model był widoczny (widok z narożnika, z góry) */
function frame(camera: THREE.PerspectiveCamera, controls: OrbitControls, model: Model3D) {
  const { min, max } = model.bounds;
  const center = new THREE.Vector3((min[0] + max[0]) / 2, max[1] / 2, (min[2] + max[2]) / 2);
  const size = Math.max(max[0] - min[0], max[2] - min[2], max[1], 2);
  // na telefonie w pionie decyduje węższy, poziomy kąt widzenia
  const vHalf = (camera.fov * Math.PI) / 360;
  const hHalf = Math.atan(Math.tan(vHalf) * Math.min(camera.aspect || 1, 1.6));
  const dist = (size / 2 / Math.tan(Math.min(vHalf, hHalf))) * 1.25;
  const dir = new THREE.Vector3(0.75, 0.85, 1).normalize();
  camera.position.copy(center).addScaledVector(dir, dist);
  controls.target.copy(center);
  controls.update();
}
