import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { calculateProject } from '../calc/materials';
import { appBoardLength, isBoardLengthPref, setAppBoardLength, setProjectBoardLength, type BoardLengthPref } from '../calc/boardLength';
import { BoardLengthField } from './BoardLengthField';
import { ProfileLengthsField } from './ProfileLengthsField';
import { appProfileLengths, setAppProfileLengths, setProjectProfileLengths, type AppProfileLengths } from '../calc/profileLength';
import { PRODUCT_ALIASES, setCustomSystems, type CustomCatalog } from '../catalog/rigips';
import { createProject, duplicateProject, sampleProject } from '../model/factory';
import { migrateKeys, type PriceBook } from '../model/prices';
import type { Project } from '../model/types';
import { deleteProject, getKV, getProject, listProjects, requestPersistence, saveProject, setKV } from '../storage/db';
import { CatalogView } from './CatalogView';
import { DrawingsPanel } from './DrawingsPanel';
import { ElementsPanel } from './ElementsPanel';
import { FinishingPanel } from './FinishingPanel';
import { PlanTab } from './PlanTab';
import { ProjectList, UndoToast } from './ProjectList';
import { LaserButton } from './LaserButton';
import { BACK_ICON, NavIcon, SETTINGS_ICON, StageBar, ViewSwitch } from './StageNav';
import { stageOf, stagesFor, viewForStage, type StageId, type Tab } from './stages';
import { LaserDiagnostics } from './LaserDiagnostics';
import { QuickForm } from './QuickForm';
import { ShoppingList } from './ShoppingList';
import { WoolSettings } from './WoolField';
import { UpdatePrompt } from './UpdatePrompt';
import { useBack, useExitHint } from './back';
import { useImmersive } from './fullscreen';
import { useHistory } from './useHistory';
import { withLiningBacking } from '../model/backing';
import { fmtNum } from './wallStyle';
import { DimInput } from './DimInput';
import { PomiarImportTile } from './PomiarImport';
import { maxCeilingHeight } from '../calc/ceilingLevels';
import { ceilingSystemById } from '../catalog/rigips';

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
  // długość arkuszy płyt – ustawienie całej aplikacji (projekt może je nadpisać)
  const [appBoardLen, setAppBoardLen] = useState<BoardLengthPref>(appBoardLength());
  // długości profili – ustawienie całej aplikacji (projekt może je nadpisać na liście zakupów)
  const [appProfileLen, setAppProfileLen] = useState<AppProfileLengths>(appProfileLengths());
  const hash = useHash();

  const refresh = useCallback(() => listProjects().then(setProjects).catch(() => setProjects([])), []);
  useEffect(() => {
    refresh();
    requestPersistence();
    getKV<PriceBook>('prices').then((p) => p && setPrices(migrateKeys(p, PRODUCT_ALIASES)));
    getKV<BoardLengthPref>('boardLength').then((v) => {
      if (!isBoardLengthPref(v)) return;
      setAppBoardLength(v);
      setAppBoardLen(v);
      setCatalogVersion((n) => n + 1);
    });
    getKV<AppProfileLengths>('profileLengths').then((v) => {
      if (!v) return;
      setAppProfileLengths(v);
      setAppProfileLen(appProfileLengths());
      setCatalogVersion((n) => n + 1);
    });
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

  const saveBoardLen = (v: BoardLengthPref) => {
    setAppBoardLength(v);
    setAppBoardLen(v);
    setKV('boardLength', v);
    setCatalogVersion((n) => n + 1);
  };

  const saveProfileLen = (v: AppProfileLengths) => {
    setAppProfileLengths(v);
    setAppProfileLen(appProfileLengths());
    setKV('profileLengths', appProfileLengths());
    setCatalogVersion((n) => n + 1);
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

  // usunięty projekt trzymamy w pamięci, żeby dało się go przywrócić przyciskiem Cofnij
  const [removed, setRemoved] = useState<Project | null>(null);
  const removedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const remove = async (p: Project) => {
    const latest = (await getProject(p.id)) ?? p;
    await deleteProject(p.id);
    if (openId === p.id) setOpenId(null);
    await refresh();
    setRemoved(latest);
    clearTimeout(removedTimer.current);
    removedTimer.current = setTimeout(() => setRemoved(null), 6000);
  };
  const undoRemove = async () => {
    if (!removed) return;
    clearTimeout(removedTimer.current);
    setRemoved(null);
    await saveProject(removed);
    await refresh();
  };
  const duplicate = async (p: Project) => {
    await saveProject(duplicateProject((await getProject(p.id)) ?? p));
    await refresh();
  };
  const rename = async (p: Project, name: string) => {
    const latest = (await getProject(p.id)) ?? p;
    await saveProject({ ...latest, name, updatedAt: Date.now() });
    await refresh();
  };

  const current = projects?.find((p) => p.id === openId);

  // przycisk Wstecz: najpierw zamyka katalog, potem diagnostykę dalmierza
  useBack(hash === '#dalmierz', () => {
    history.replaceState(history.state, '', location.pathname + location.search);
    window.dispatchEvent(new Event('hashchange'));
  });
  useBack(catalogOpen, () => setCatalogOpen(false));

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
          appBoardLen={appBoardLen}
          setAppBoardLen={saveBoardLen}
          appProfileLen={appProfileLen}
          setAppProfileLen={saveProfileLen}
          onOpenCatalog={() => setCatalogOpen(true)}
          onClose={() => {
            setOpenId(null);
            refresh();
          }}
          onDelete={() => remove(current)}
        />
      ) : (
        <Home
          projects={projects}
          quick={quick}
          setQuick={setQuick}
          onOpen={open}
          onSelect={setOpenId}
          onDelete={remove}
          onDuplicate={duplicate}
          onRename={rename}
          onOpenCatalog={() => setCatalogOpen(true)}
          appBoardLen={appBoardLen}
          setAppBoardLen={saveBoardLen}
          appProfileLen={appProfileLen}
          setAppProfileLen={saveProfileLen}
        />
      )}
      </div>
      {removed && <UndoToast name={removed.name} onUndo={undoRemove} onDismiss={() => setRemoved(null)} />}
      <UpdatePrompt />
      <ExitHint />
    </div>
  );
}

/** Komunikat po ostatnim cofnięciu – drugie Wstecz zamyka aplikację */
function ExitHint() {
  const show = useExitHint();
  if (!show) return null;
  return (
    <div className="toast exit-hint" role="status" aria-live="polite">
      <span>Cofnij jeszcze raz, aby wyjść</span>
    </div>
  );
}

function Home({
  projects,
  quick,
  setQuick,
  onOpen,
  onSelect,
  onDelete,
  onDuplicate,
  onRename,
  onOpenCatalog,
  appBoardLen,
  setAppBoardLen,
  appProfileLen,
  setAppProfileLen,
}: {
  projects: Project[] | null;
  onOpenCatalog: () => void;
  appBoardLen: BoardLengthPref;
  setAppBoardLen: (v: BoardLengthPref) => void;
  appProfileLen: AppProfileLengths;
  setAppProfileLen: (v: AppProfileLengths) => void;
  quick: boolean;
  setQuick: (v: boolean) => void;
  onOpen: (p: Project) => void;
  onSelect: (id: string) => void;
  onDelete: (p: Project) => void;
  onDuplicate: (p: Project) => void;
  onRename: (p: Project, name: string) => void;
}) {
  useBack(quick, () => setQuick(false));
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
            <span>Wpisz wymiary ściany, pomieszczenia, sufitu lub poddasza</span>
          </button>
          <button className="tile" onClick={() => onOpen(createProject())}>
            <strong>Nowy projekt</strong>
            <span>Pusty projekt, elementy dodasz ręcznie</span>
          </button>
          <button className="tile" onClick={onOpenCatalog}>
            <strong>Katalog systemów</strong>
            <span>Ściany i sufity Rigips, Norgips i ATLAS M-System 3G, zużycie na m², systemy własne</span>
          </button>
          <PomiarImportTile onOpen={onOpen} />
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
          <ProjectList projects={projects} onSelect={onSelect} onDelete={onDelete} onDuplicate={onDuplicate} onRename={onRename} />
        )}
      </section>

      <section className="card home-settings">
        <BoardLengthField
          label="Długość płyt"
          value={appBoardLen}
          onChange={(v) => setAppBoardLen(v ?? 'auto')}
          hint={APP_BOARD_HINT}
        />
        <ProfileLengthsField value={appProfileLen} onChange={setAppProfileLen} />
      </section>

      <p className="home-foot small">
        <a href="#dalmierz">Dalmierz Bluetooth – diagnostyka</a>
      </p>
    </main>
  );
}

const APP_BOARD_HINT =
  'Arkusze tej długości idą do układu płyt, rysunków, 3D i listy zakupów. Auto – najkrótszy arkusz nie niższy od ściany. Gdy dostawka wyszłaby węższa niż 30 cm, pełny arkusz jest skracany.';

function ProjectView({
  initial,
  prices,
  setPrice,
  catalogVersion,
  appBoardLen,
  setAppBoardLen,
  appProfileLen,
  setAppProfileLen,
  onOpenCatalog,
  onClose,
  onDelete,
}: {
  initial: Project;
  catalogVersion: number;
  appBoardLen: BoardLengthPref;
  setAppBoardLen: (v: BoardLengthPref) => void;
  appProfileLen: AppProfileLengths;
  setAppProfileLen: (v: AppProfileLengths) => void;
  onOpenCatalog: () => void;
  prices: PriceBook;
  setPrice: (k: string, v: number | undefined) => void;
  onClose: () => void;
  onDelete: () => void;
}) {
  const { project, update, commit, undo, redo, canUndo, canRedo } = useHistory(initial, withLiningBacking);
  const [startTab] = useState<Tab>(initial.walls.length + initial.ceilings.length + (initial.attics?.length ?? 0) ? 'list' : 'plan');
  const [tab, setTab] = useState<Tab>(startTab);
  // catalogVersion: przelicz po zmianie systemów własnych
  // długość płyt tego projektu – wyliczenia, rysunki i 3D biorą ją z modułu boardLength
  setProjectBoardLength(project.settings.boardLength);
  // długości profili tego projektu (rozkrój, łączniki wzdłużne na rysunkach i w 3D)
  setProjectProfileLengths(project.settings.profileLengths);
  useEffect(
    () => () => {
      setProjectBoardLength(undefined);
      setProjectProfileLengths(undefined);
    },
    [],
  );
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
  const stages = stagesFor(wide);
  const stage = stageOf(tab);
  const views = stages.find((x) => x.id === stage)?.views;
  // ostatnio oglądany widok każdego etapu – powrót do etapu otwiera to, co było
  const [lastView, setLastView] = useState<Partial<Record<StageId, Tab>>>({});
  const go = (t: Tab) => {
    const st = stageOf(t);
    if (st) setLastView((prev) => ({ ...prev, [st]: t }));
    setTab(t);
  };
  const goStage = (id: StageId) => go(viewForStage(id, lastView));
  const beforeSettings = useRef<Tab>(startTab);
  const toggleSettings = () => {
    if (tab === 'settings') return setTab(beforeSettings.current);
    beforeSettings.current = tab;
    setTab('settings');
  };
  const activeTab = tab;
  const homeTab = startTab;

  // przycisk Wstecz: z innej zakładki wraca do startowej, a stamtąd do listy projektów
  useBack(true, () => (activeTab !== homeTab ? setTab(startTab) : onClose()));

  // pełny ekran tylko dla planera i widoku 3D; rejestrowany po Wstecz projektu, więc zamyka się pierwszy
  const imm = useImmersive();
  const canImmerse = activeTab === 'plan' || activeTab === '3d';
  const immersive = imm.on && canImmerse;
  const { on: immOn, exit: immExit } = imm;
  useEffect(() => {
    if (immOn && !canImmerse) immExit();
  }, [immOn, canImmerse, immExit]);
  const fullscreen = { on: immersive, toggle: imm.toggle, undo, redo, canUndo, canRedo };

  return (
    <div className={`project ${activeTab === 'plan' ? 'on-plan' : ''} ${immersive ? 'immersive' : ''}`}>
      <header className="topbar">
        <button className="icon-btn back-btn" onClick={onClose} aria-label="Wszystkie projekty">
          <NavIcon d={BACK_ICON} />
        </button>
        <input
          className="title-input"
          value={project.name}
          onChange={(e) => update((d) => void (d.name = e.target.value))}
          aria-label="Nazwa projektu"
        />
        {wide && <StageBar stages={stages} active={stage} onSelect={goStage} className="in-topbar" />}
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
          <button
            className={`icon-btn ${tab === 'settings' ? 'on' : ''}`}
            onClick={toggleSettings}
            aria-label="Ustawienia projektu"
            aria-pressed={tab === 'settings'}
          >
            <NavIcon d={SETTINGS_ICON} />
          </button>
        </div>
      </header>

      {views ? <ViewSwitch views={views} active={tab} onSelect={go} /> : <h2 className="view-title">Ustawienia projektu</h2>}

      {(tab === 'list' || tab === 'elements') && (
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
        {s.atticAreaM2 > 0 ? (
          <div>
            <span>Poddasza</span>
            <strong>{fmtNum(s.atticAreaM2, 1)} m²</strong>
            <small>skosy i sufity</small>
          </div>
        ) : s.liningAreaM2 > 0 ? (
          <div>
            <span>Okładziny</span>
            <strong>{fmtNum(s.liningAreaM2, 1)} m²</strong>
            <small>na istniejących ścianach</small>
          </div>
        ) : (
          <div>
            <span>Otwory</span>
            <strong>{s.openings}</strong>
            <small>drzwi i okna</small>
          </div>
        )}
      </div>
      )}

      <div className="tab-body">
        {activeTab === 'plan' && (
          <PlanTab project={project} calc={calc} update={update} commit={commit} wide={wide} onShowList={() => go('list')} fullscreen={fullscreen} />
        )}
        {tab === '3d' && (
          <Suspense fallback={<p className="muted">Wczytywanie widoku 3D…</p>}>
            <View3D project={project} calc={calc} fullscreen={fullscreen} />
          </Suspense>
        )}
        {(tab === 'list' || tab === 'elements') && (
          <div className={`split ${tab === 'list' ? 'solo-list' : ''}`}>
            <div className={tab === 'elements' ? '' : 'panel-hidden'}>
              <ElementsPanel project={project} calc={calc} update={update} />
            </div>
            <div className={`side ${tab === 'list' ? '' : 'panel-hidden'}`}>
              {wide && tab === 'elements' && <h2 className="side-title">Lista zakupów</h2>}
              <ShoppingList project={project} lines={calc.total} prices={prices} setPrice={setPrice} update={update} />
            </div>
          </div>
        )}
        {activeTab === 'joints' && <FinishingPanel project={project} calc={calc} update={update} />}
        {tab === 'drawings' && <DrawingsPanel project={project} calc={calc} />}
        {activeTab === 'settings' && (
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
            <ProjectHeights project={project} update={update} />
            <hr />
            <BoardLengthField
              label="Długość płyt w tym projekcie"
              value={project.settings.boardLength}
              inherit={appBoardLen}
              onChange={(v) =>
                update((d) => {
                  if (v === undefined) delete d.settings.boardLength;
                  else d.settings.boardLength = v;
                })
              }
            />
            <BoardLengthField label="Domyślnie w aplikacji" value={appBoardLen} onChange={(v) => setAppBoardLen(v ?? 'auto')} hint={APP_BOARD_HINT} />
            <hr />
            <ProfileLengthsField label="Długość profili – domyślnie w aplikacji" value={appProfileLen} onChange={setAppProfileLen} />
            <hr />
            <WoolSettings
              wool={project.settings.wool}
              onChange={(t, choice) =>
                update((d) => {
                  const next = { ...(d.settings.wool ?? {}) };
                  if (choice) next[String(t)] = choice;
                  else delete next[String(t)];
                  d.settings.wool = next;
                })
              }
            />
            <hr />
            <button className="btn" onClick={onOpenCatalog}>
              Katalog systemów i systemy własne
            </button>
            <hr />
            <button className="btn danger" onClick={onDelete}>
              Usuń projekt
            </button>
          </div>
        )}
      </div>

      {!wide && <StageBar stages={stages} active={stage} onSelect={goStage} />}
    </div>
  );
}

/** Wysokość do stropu (nowe ściany i strop nad nowymi sufitami) i wysokość nowych sufitów podwieszanych */
function ProjectHeights({ project, update }: { project: Project; update: (fn: (d: Project) => void) => void }) {
  const st = project.settings;
  const sys = ceilingSystemById(st.defaultCeilingSystem);
  const top = maxCeilingHeight(st.defaultHeight, sys, sys.defaultBoard);
  return (
    <div className="field">
      <div className="grid-2">
        <DimInput label="Strop (wysokość ścian)" unit="m" value={st.defaultHeight} min={100} max={1000} onChange={(v) => update((d) => void (d.settings.defaultHeight = v))} />
        <DimInput
          label="Sufit podwieszany"
          unit="m"
          value={Math.min(st.ceilingHeight ?? top, top)}
          min={50}
          max={top}
          onChange={(v) => update((d) => void (d.settings.ceilingHeight = v))}
        />
      </div>
      <small className="hint">
        Dotyczy nowych ścian i sufitów. Ściany dochodzą do stropu, sufit wisi pod nim, a profil UD kotwi się do ścian na poziomie sufitu. Narysowane sufity zmienisz w ich ustawieniach.
      </small>
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
