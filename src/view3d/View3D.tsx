import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { boardById } from '../catalog/rigips';
import type { ProjectCalc } from '../calc/materials';
import type { Project } from '../model/types';
import { findCollisions } from '../geometry/contacts';
import { EXIT_FULLSCREEN_ICON, FULLSCREEN_ICON } from '../ui/fullscreen';
import type { FullscreenControl } from '../ui/PlanTab';
import { buildModel3D, type Layer3D, type MatKey, type Model3D } from './model3d';

const FRAME_COLORS: Record<string, number> = {
  cw: 0x9aa7b4,
  uw: 0x6f7c8a,
  ua: 0x3d6fb3,
  cdMain: 0x8794a1,
  cdSec: 0xb3bec9,
  ud: 0x5f6b77,
  hanger: 0xd08a2e,
  masonry: 0xc9b9a6,
};

const LAYERS: { id: Layer3D; label: string }[] = [
  { id: 'existing', label: 'Istniejące ściany' },
  { id: 'wallBoards', label: 'Płyty ścian' },
  { id: 'wallFrame', label: 'Ruszt CW/UW' },
  { id: 'ceilingBoards', label: 'Płyty sufitu' },
  { id: 'ceilingFrame', label: 'Ruszt CD/UD' },
];

type Visibility = Record<Layer3D, boolean>;
const ALL_ON: Visibility = { existing: true, wallBoards: true, wallFrame: true, ceilingBoards: true, ceilingFrame: true };

function materialFor(key: MatKey): THREE.Material {
  if (key.startsWith('board:')) {
    const color = new THREE.Color(boardById(key.slice(6)).color);
    return new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide });
  }
  return new THREE.MeshLambertMaterial({ color: FRAME_COLORS[key] ?? 0x999999 });
}

/** Buduje grupy siatek (po jednej na warstwę i materiał – mało wywołań rysowania) */
function buildGroups(model: Model3D): Map<Layer3D, THREE.Group> {
  const byKey = new Map<string, THREE.BufferGeometry[]>();
  const edgesByLayer = new Map<Layer3D, THREE.BufferGeometry[]>();
  const tmp = new THREE.Object3D();
  for (const part of model.parts) {
    let g: THREE.BufferGeometry;
    if (part.type === 'box') {
      g = new THREE.BoxGeometry(part.s[0], part.s[1], part.s[2]);
      tmp.position.set(...part.c);
      tmp.rotation.set(0, part.rotY, 0);
      tmp.updateMatrix();
      g.applyMatrix4(tmp.matrix);
    } else {
      // obrys w płaszczyźnie XY (x, -z), potem obrót do poziomu
      const shape = new THREE.Shape(part.points.map((q) => new THREE.Vector2(q.x, -q.y)));
      g = new THREE.ExtrudeGeometry(shape, { depth: part.thickness, bevelEnabled: false });
      g.rotateX(-Math.PI / 2);
      g.translate(0, part.y, 0);
      g = g.toNonIndexed();
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
  const groups = new Map<Layer3D, THREE.Group>();
  const groupOf = (l: Layer3D) => groups.get(l) ?? groups.set(l, new THREE.Group()).get(l)!;
  for (const [key, list] of byKey) {
    const [layer, mat] = key.split('|') as [Layer3D, MatKey];
    const merged = mergeGeometries(list, false);
    list.forEach((g) => g.dispose());
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, materialFor(mat));
    if (layer === 'wallBoards' || layer === 'ceilingBoards') {
      // płyty lekko odsunięte w głąb, żeby krawędzie (spoiny) były widoczne
      (mesh.material as THREE.MeshLambertMaterial).polygonOffset = true;
      (mesh.material as THREE.MeshLambertMaterial).polygonOffsetFactor = 1;
      (mesh.material as THREE.MeshLambertMaterial).polygonOffsetUnits = 1;
    }
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
    dirty: boolean;
  } | null>(null);
  const [vis, setVis] = useState<Visibility>(ALL_ON);
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

  // inicjalizacja sceny
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !supported) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f99, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(5, 10, 7);
    scene.add(sun);
    const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 500);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.maxPolarAngle = Math.PI * 0.95;
    controls.minDistance = 0.3;
    controls.maxDistance = 120;
    controls.zoomToCursor = true;
    controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    const content = new THREE.Group();
    scene.add(content);

    const state = { renderer, scene, camera, controls, content, groups: new Map(), dirty: true };
    ctx.current = state;
    controls.addEventListener('change', () => (state.dirty = true));

    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
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
        renderer.render(scene, camera);
      }
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      disposeObject(scene);
      renderer.dispose();
      renderer.domElement.remove();
      ctx.current = null;
      framed.current = false;
    };
  }, [supported]);

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

    s.groups = buildGroups(model);
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
  }, [model]);

  // widoczność warstw
  useEffect(() => {
    const s = ctx.current;
    if (!s) return;
    for (const [layer, g] of s.groups) g.visible = vis[layer];
    s.dirty = true;
  }, [vis]);

  const hasCeilings = project.ceilings.length > 0;
  const hasWalls = project.walls.length > 0;
  const hasExisting = project.walls.some((w) => w.kind === 'existing');

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
        {!hasWalls && !hasCeilings && <p className="view3d-hint">Dodaj ścianę lub sufit, żeby zobaczyć model.</p>}
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
