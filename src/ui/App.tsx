import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { calculateProject } from '../calc/materials';
import { PRODUCT_ALIASES, setCustomSystems, type CustomCatalog } from '../catalog/rigips';
import { createProject, sampleProject } from '../model/factory';
import { migrateKeys, type PriceBook } from '../model/prices';
import type { Project } from '../model/types';
import { deleteProject, getKV, listProjects, requestPersistence, saveProject, setKV } from '../storage/db';
import { CatalogView } from './CatalogView';
import { ElementsPanel } from './ElementsPanel';
import { LaserButton } from './LaserButton';
import { LaserDiagnostics } from './LaserDiagnostics';
import { QuickForm } from './QuickForm';
import { ShoppingList } from './ShoppingList';
import { UpdatePrompt } from './UpdatePrompt';
import { useHistory } from './useHistory';
import { fmtNum } from './wallStyle';

// three.js ładujemy dopiero przy otwarciu widoku 3D (mniejszy start aplikacji; offline działa z pamięci podręcznej)
const View3D = lazy(() => import('../view3d/View3D'));

export function App() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [quick, setQuick] = useState(false);
  const [prices, setPrices] = useState<PriceBook>({});
  const [catalogOpen, setCatalogOpen] = useState(false);
  /** Zmienia się po każdej zmianie systemów własnych – odświeża wyliczenia */
  const [catalogVersion, setCatalogVersion] = useState(0);
  const hash = useHash();

  const refresh = useCallback(() => listProjects().then(setProjects).catch(() => setProjects([])), []);
  useEffect(() => {
    refresh();
    requestPersistence();
    getKV<PriceBook>('prices').then((p) => p && setPrices(migrateKeys(p, PRODUCT_ALIASES)));
    getKV<CustomCatalog>('customSystems').then((c) => {
      if (!c) return;
      setCustomSystems(c);
      setCatalogVersion((v) => v + 1);
    });
  }, [refresh]);

  const saveCustom = (c: CustomCatalog) => {
    setCustomSystems(c);
    setKV('customSystems', c);
    setCatalogVersion((v) => v + 1);
  };

  const setPrice = (key: string, value: number | undefined) =>
    setPrices((prev) => {
      const next = { ...prev };
      if (value === undefined) delete next[key];
      else next[key] = value;
      setKV('prices', next);
      return next;
    });

  const open = async (p: Project) => {
    await saveProject(p);
    await refresh();
    setQuick(false);
    setOpenId(p.id);
  };

  const current = projects?.find((p) => p.id === openId);

  return (
    <div className="app">
      {catalogOpen && <CatalogView onClose={() => setCatalogOpen(false)} onSave={saveCustom} />}
      <div hidden={catalogOpen}>
      {hash === '#dalmierz' ? (
        <LaserDiagnostics onClose={() => (history.length > 1 ? history.back() : (location.hash = ''))} />
      ) : current ? (
        <ProjectView
          key={current.id}
          initial={current}
          prices={prices}
          setPrice={setPrice}
          catalogVersion={catalogVersion}
          onOpenCatalog={() => setCatalogOpen(true)}
          onClose={() => {
            setOpenId(null);
            refresh();
          }}
          onDelete={async () => {
            await deleteProject(current.id);
            setOpenId(null);
            refresh();
          }}
        />
      ) : (
        <Home
          projects={projects}
          quick={quick}
          setQuick={setQuick}
          onOpen={open}
          onSelect={setOpenId}
          onOpenCatalog={() => setCatalogOpen(true)}
        />
      )}
      </div>
      <UpdatePrompt />
    </div>
  );
}

function Home({
  projects,
  quick,
  setQuick,
  onOpen,
  onSelect,
  onOpenCatalog,
}: {
  projects: Project[] | null;
  onOpenCatalog: () => void;
  quick: boolean;
  setQuick: (v: boolean) => void;
  onOpen: (p: Project) => void;
  onSelect: (id: string) => void;
}) {
  return (
    <main className="home">
      <header className="home-head">
        <div className="brand">
          <span className="logo" aria-hidden>
            <svg viewBox="0 0 32 32">
              <rect x="3" y="5" width="26" height="22" rx="3" fill="none" stroke="currentColor" strokeWidth="2.5" />
              <path d="M11 5v22M21 5v22" stroke="currentColor" strokeWidth="2.5" />
            </svg>
          </span>
          <div>
            <h1>Rigipsiarz</h1>
            <p className="muted small">Planer suchej zabudowy · działa bez internetu</p>
          </div>
        </div>
        <LaserButton />
      </header>

      {quick ? (
        <QuickForm onCreate={onOpen} onCancel={() => setQuick(false)} />
      ) : (
        <div className="start-actions">
          <button className="tile primary" onClick={() => setQuick(true)}>
            <strong>Szybkie wyliczenie</strong>
            <span>Wpisz wymiary ściany, pomieszczenia lub sufitu</span>
          </button>
          <button className="tile" onClick={() => onOpen(createProject())}>
            <strong>Nowy projekt</strong>
            <span>Pusty projekt, elementy dodasz ręcznie</span>
          </button>
          <button className="tile" onClick={onOpenCatalog}>
            <strong>Katalog systemów</strong>
            <span>Ściany i sufity Rigips, zużycie na m², systemy własne</span>
          </button>
        </div>
      )}

      <section className="projects">
        <h2>Twoje projekty</h2>
        {projects === null ? (
          <p className="muted">Wczytywanie…</p>
        ) : projects.length === 0 ? (
          <div className="empty">
            <p>Nie masz jeszcze projektów. Projekty zapisują się tylko na tym urządzeniu.</p>
            <button className="btn" onClick={() => onOpen(sampleProject())}>
              Otwórz projekt przykładowy
            </button>
          </div>
        ) : (
          <ul className="project-list">
            {projects.map((p) => (
              <li key={p.id}>
                <button onClick={() => onSelect(p.id)}>
                  <strong>{p.name}</strong>
                  <span className="muted small">
                    {p.walls.length} ścian · {p.ceilings.length} sufitów · {new Date(p.updatedAt).toLocaleDateString('pl-PL')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="home-foot small">
        <a href="#dalmierz">Dalmierz Bluetooth – diagnostyka</a>
      </p>
    </main>
  );
}

type Tab = 'list' | 'elements' | '3d' | 'settings';

function ProjectView({
  initial,
  prices,
  setPrice,
  catalogVersion,
  onOpenCatalog,
  onClose,
  onDelete,
}: {
  initial: Project;
  catalogVersion: number;
  onOpenCatalog: () => void;
  prices: PriceBook;
  setPrice: (k: string, v: number | undefined) => void;
  onClose: () => void;
  onDelete: () => void;
}) {
  const { project, update, undo, redo, canUndo, canRedo } = useHistory(initial);
  const [tab, setTab] = useState<Tab>(initial.walls.length + initial.ceilings.length ? 'list' : 'elements');
  // catalogVersion: przelicz po zmianie systemów własnych
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const calc = useMemo(() => calculateProject(project), [project, catalogVersion]);

  // autozapis
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => saveProject(project), 300);
    return () => clearTimeout(t);
  }, [project]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || (e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  const s = calc.stats;
  const wide = useMediaQuery('(min-width: 1024px)');
  const tabs: { id: Tab; label: string }[] = wide
    ? [
        { id: 'elements', label: 'Ściany, sufity i materiały' },
        { id: '3d', label: 'Widok 3D' },
        { id: 'settings', label: 'Ustawienia' },
      ]
    : [
        { id: 'list', label: 'Zakupy' },
        { id: 'elements', label: 'Elementy' },
        { id: '3d', label: '3D' },
        { id: 'settings', label: 'Ustawienia' },
      ];
  const activeTab: Tab = wide && tab === 'list' ? 'elements' : tab;

  return (
    <div className="project">
      <header className="topbar">
        <button className="icon-btn" onClick={onClose} aria-label="Wróć do projektów">
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <input
          className="title-input"
          value={project.name}
          onChange={(e) => update((d) => void (d.name = e.target.value))}
          aria-label="Nazwa projektu"
        />
        <div className="topbar-actions">
          <LaserButton />
          <button className="icon-btn" onClick={undo} disabled={!canUndo} aria-label="Cofnij">
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button className="icon-btn" onClick={redo} disabled={!canRedo} aria-label="Ponów">
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M15 14l5-5-5-5M20 9H10a6 6 0 000 12h3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </header>

      <div className="stats">
        <div>
          <span>Ściany</span>
          <strong>{fmtNum(s.wallAreaM2, 1)} m²</strong>
          <small>{fmtNum(s.wallLengthM)} mb</small>
        </div>
        <div>
          <span>Sufity</span>
          <strong>{fmtNum(s.ceilingAreaM2, 1)} m²</strong>
          <small>{project.ceilings.length} szt.</small>
        </div>
        <div>
          <span>Otwory</span>
          <strong>{s.openings}</strong>
          <small>drzwi i okna</small>
        </div>
      </div>

      <nav className="tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={activeTab === t.id}
            className={activeTab === t.id ? 'on' : ''}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="tab-body">
        {tab === '3d' && (
          <Suspense fallback={<p className="muted">Wczytywanie widoku 3D…</p>}>
            <View3D project={project} calc={calc} />
          </Suspense>
        )}
        {(tab === 'list' || tab === 'elements') && (
          <div className="split">
            <div className={tab === 'elements' ? '' : 'panel-hidden'}>
              <ElementsPanel project={project} calc={calc} update={update} />
            </div>
            <div className={`side ${tab === 'list' ? '' : 'panel-hidden'}`}>
              {wide && <h2 className="side-title">Lista zakupów</h2>}
              <ShoppingList project={project} lines={calc.total} prices={prices} setPrice={setPrice} update={update} />
            </div>
          </div>
        )}
        {tab === 'settings' && (
          <div className="card settings">
            <label className="check">
              <input
                type="checkbox"
                checked={project.settings.wasteEnabled}
                onChange={(e) => update((d) => void (d.settings.wasteEnabled = e.target.checked))}
              />
              Doliczaj zapas na docinki i odpady
            </label>
            <div className="field narrow">
              <label htmlFor="waste">Zapas</label>
              <div className="input-unit">
                <input
                  id="waste"
                  type="number"
                  min={0}
                  max={50}
                  value={project.settings.waste}
                  disabled={!project.settings.wasteEnabled}
                  onChange={(e) => update((d) => void (d.settings.waste = Math.max(0, Math.min(50, Number(e.target.value) || 0))))}
                />
                <span className="unit">%</span>
              </div>
              <small className="hint">Dotyczy płyt, wkrętów, taśm, masy i wełny. Profile liczone są z rozkroju.</small>
            </div>
            <hr />
            <button className="btn" onClick={onOpenCatalog}>
              Katalog systemów i systemy własne
            </button>
            <hr />
            <button className="btn danger" onClick={() => confirm('Usunąć projekt z tego urządzenia?') && onDelete()}>
              Usuń projekt
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function useMediaQuery(q: string) {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setMatch(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [q]);
  return match;
}

function useHash() {
  const [hash, setHash] = useState(() => (typeof location !== 'undefined' ? location.hash : ''));
  useEffect(() => {
    const on = () => setHash(location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash;
}
