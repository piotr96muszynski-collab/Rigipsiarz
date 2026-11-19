import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  CEILING_KIND_LABEL,
  MAKER_LABEL,
  WALL_CATEGORY_LABEL,
  allCeilingSystems,
  allWallSystems,
  boardById,
  ceilingSystemById,
  isLiningSystem,
  wallSystemById,
  type CeilingKind,
  type CeilingSystem,
  type Maker,
  type WallCategory,
  type WallSystem,
} from '../catalog/rigips';
import {
  isAtticSystem,
  makerOf,
  recommendCeilings,
  recommendWalls,
  featureNeeds,
  profileWidths,
  WALL_FEATURES,
  type WallFeature,
  wallPurposeOf,
  type CeilingMount,
  type CeilingPick,
  type FireNeed,
  type Room,
  type WallPick,
  type WallPurpose,
} from '../calc/recommend';
import { Picker, type PickOption } from './Picker';
import { DimInput } from './DimInput';
import { useBack } from './back';

interface Props {
  id: string;
  value: string;
  onChange: (id: string) => void;
  /** Tytuł arkusza wyboru */
  label?: string;
}

/** Wiersz listy systemów */
interface Row {
  id: string;
  name: string;
  group: string;
  /** Kody producenta (system i odmiany) – do wyszukiwania i podpisu */
  codes: string[];
  basic: boolean;
  custom: boolean;
  approx: boolean;
  maker: Maker;
  /** Krótkie parametry pod nazwą */
  facts: string;
}

const uniq = <T,>(a: T[]) => [...new Set(a)];
const norm = (t: string) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l');

function rowOf(s: WallSystem | CeilingSystem, group: string): Row {
  const codes = uniq([s.code, ...(s.variants ?? []).map((v) => v.code)].filter((c): c is string => !!c));
  const acoustic = 'acoustic' in s ? s.acoustic : undefined;
  return {
    id: s.id,
    name: s.name,
    group: s.custom ? 'Systemy własne' : group,
    codes,
    basic: !!s.basic,
    custom: !!s.custom,
    approx: !!s.source.approx,
    maker: makerOf(s),
    facts: [codes[0] && `${codes[0]}${codes.length > 1 ? ` +${codes.length - 1}` : ''}`, s.fire?.replace(/ \(.*$/, ''), acoustic].filter(Boolean).join(' · '),
  };
}

/**
 * Znacznik pochodzenia danych: karta producenta albo wartości orientacyjne.
 * `quiet` – bez znacznika „z karty” (w listach wyboru prawie każdy system jest z karty, więc oznaczamy tylko wyjątki).
 */
export function SourceBadge({ approx, custom, quiet }: { approx?: boolean; custom?: boolean; quiet?: boolean }) {
  if (custom) return <span className="sys-badge own">własny</span>;
  if (quiet && !approx) return null;
  return approx ? (
    <span className="sys-badge approx" title="Brak karty producenta – wartości orientacyjne">
      szacunek
    </span>
  ) : (
    <span className="sys-badge card" title="Wartości z karty systemu producenta">
      z karty
    </span>
  );
}

const FIRE_OPTIONS: PickOption<FireNeed>[] = [
  { value: 0, label: 'bez' },
  { value: 30, label: 'EI 30' },
  { value: 60, label: 'EI 60' },
  { value: 90, label: 'EI 90' },
  { value: 120, label: 'EI 120' },
];
const ROOM_OPTIONS: PickOption<Room>[] = [
  { value: 'dry', label: 'Suche' },
  { value: 'humid', label: 'Łazienka, kuchnia', short: 'Łazienka' },
  { value: 'wet', label: 'Strefa mokra (prysznic)', short: 'Mokre' },
];
const PURPOSE_OPTIONS: PickOption<WallPurpose>[] = [
  { value: 'partition', label: 'Działowa' },
  { value: 'installation', label: 'Instalacyjna', short: 'Instal.' },
  { value: 'lining', label: 'Okładzina' },
  { value: 'shaft', label: 'Szacht' },
];
const MOUNT_OPTIONS: PickOption<CeilingMount>[] = [
  { value: 'suspended', label: 'Podwieszany', hint: 'obniżony na wieszakach' },
  { value: 'direct', label: 'Pod stropem', hint: 'na uchwytach ES lub łącznikach' },
  { value: 'span', label: 'Bez wieszaków', hint: 'od ściany do ściany', short: 'Przęsłowy' },
  { value: 'attic', label: 'Poddasze', hint: 'skosy i jętki' },
];

type MakerFilter = Maker | 'all';

function makerOptions(rows: Row[]): PickOption<MakerFilter>[] {
  const makers = uniq(rows.filter((r) => !r.custom).map((r) => r.maker));
  return [{ value: 'all' as MakerFilter, label: 'Wszyscy' }, ...makers.map((m) => ({ value: m as MakerFilter, label: MAKER_LABEL[m] }))];
}

/** Pole pytania w doborze */
function Ask({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="sys-ask">
      <span className="sys-ask-label">{label}</span>
      {children}
    </div>
  );
}

interface PickRow {
  key: string;
  name: string;
  detail: string;
  approx: boolean;
  onPick: () => void;
}

/** Wyniki doboru: trzy najprostsze konstrukcje, reszta po rozwinięciu */
function Picks({ rows, value }: { rows: (PickRow & { id: string })[]; value: string }) {
  const [all, setAll] = useState(false);
  const bar = useRef<HTMLButtonElement>(null);
  const shown = all ? rows : rows.slice(0, 3);
  return (
    <>
      {/* przyklejony u dołu, dopóki wyniki są pod pytaniami (telefon), i u góry przy przewijaniu wyników */}
      <button type="button" ref={bar} className="sys-results-bar" onClick={() => bar.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })}>
        <span>{rows.length ? `Polecane: ${rows.length}` : 'Brak pasujących systemów'}</span>
        {rows.length > 0 && <small>od najprostszej konstrukcji</small>}
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M7 10l5 5 5-5" />
        </svg>
      </button>
      {!rows.length && (
        <p className="sys-empty">Żaden system z katalogu nie ma w karcie takich parametrów. Zmniejsz wymagania albo wybierz system z listy.</p>
      )}
      {shown.map((r, i) => (
        <button key={r.key} type="button" className={`picker-opt sys-pick ${r.id === value ? 'on' : ''}`} onClick={r.onPick}>
          <span className="sys-rank" aria-hidden>
            {i + 1}
          </span>
          <span>
            <span className="picker-label">
              {r.name} <SourceBadge approx={r.approx} quiet />
            </span>
            <small>{r.detail}</small>
          </span>
        </button>
      ))}
      {rows.length > 3 && !all && (
        <button type="button" className="btn ghost small sys-more" onClick={() => setAll(true)}>
          Pokaż pozostałe pasujące ({rows.length - 3})
        </button>
      )}
    </>
  );
}

/** Lista systemów: podstawowe od razu, pozostałe po rozwinięciu albo przez wyszukiwarkę */
function SystemList({ rows, value, onPick }: { rows: Row[]; value: string; onPick: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const [maker, setMaker] = useState<MakerFilter>('all');
  const current = rows.find((r) => r.id === value);
  const [rest, setRest] = useState(!!current && !current.basic && !current.custom);
  const makers = useMemo(() => makerOptions(rows), [rows]);
  const q = norm(query.trim());
  const match = (r: Row) => (maker === 'all' || r.maker === maker || r.custom) && (!q || norm(`${r.name} ${r.codes.join(' ')} ${r.group}`).includes(q));
  const filtered = rows.filter(match);
  const basic = filtered.filter((r) => r.basic || r.custom);
  const other = filtered.filter((r) => !r.basic && !r.custom);
  const section = (list: Row[]) => {
    let last: string | undefined;
    return list.map((r) => {
      const head = r.group !== last ? r.group : null;
      last = r.group;
      const on = r.id === value;
      return (
        <div key={r.id} role="presentation">
          {head && <div className="picker-group">{head}</div>}
          <button type="button" role="option" aria-selected={on} className={`picker-opt ${on ? 'on' : ''}`} onClick={() => onPick(r.id)}>
            <span>
              <span className="picker-label">
                {r.name} <SourceBadge approx={r.approx} custom={r.custom} quiet />
              </span>
              <small>{[r.maker !== 'rigips' && !r.custom ? MAKER_LABEL[r.maker] : '', r.facts].filter(Boolean).join(' · ')}</small>
            </span>
            {on && (
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            )}
          </button>
        </div>
      );
    });
  };
  return (
    <>
      <div className="sys-filter">
        <input
          type="search"
          className="sys-search"
          placeholder="Szukaj: nazwa, płyta albo numer systemu (np. 3.40.05)"
          aria-label="Szukaj systemu"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {makers.length > 2 && <Picker label="Producent" value={maker} options={makers} onChange={setMaker} mode="segments" />}
      </div>
      {q ? (
        filtered.length ? (
          section(filtered)
        ) : (
          <p className="sys-empty">Brak systemu pasującego do „{query}”.</p>
        )
      ) : (
        <>
          <div className="sys-section">Podstawowe</div>
          {section(basic)}
          {other.length > 0 && (
            <>
              <button type="button" className="sys-section sys-toggle" aria-expanded={rest} onClick={() => setRest(!rest)}>
                Pozostałe systemy ({other.length})
                <svg viewBox="0 0 24 24" aria-hidden>
                  <path d={rest ? 'M7 14l5-5 5 5' : 'M7 10l5 5 5-5'} />
                </svg>
              </button>
              {rest && section(other)}
            </>
          )}
        </>
      )}
    </>
  );
}

/** Arkusz wyboru systemu: zakładka „Dobierz” (pytania i polecane) oraz „Lista” (podstawowe / pozostałe) */
function SystemSheet({
  label,
  rows,
  value,
  onPick,
  onClose,
  wizard,
}: {
  label: string;
  rows: Row[];
  value: string;
  onPick: (id: string) => void;
  onClose: () => void;
  wizard: ReactNode;
}) {
  const titleId = useId();
  const [tab, setTab] = useState<'wizard' | 'list'>('wizard');
  const list = useRef<HTMLDivElement>(null);
  const current = rows.find((r) => r.id === value);
  useBack(true, onClose);
  // druga zakładka zaczyna się od góry (nagłówek, wyszukiwarka), a nie w miejscu przewinięcia pierwszej
  useEffect(() => {
    if (list.current) list.current.scrollTop = 0;
  }, [tab]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey, true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return createPortal(
    <div
      className="picker-backdrop"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      onKeyDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="picker-sheet sys-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(e) => e.stopPropagation()}>
        <span className="picker-grab" aria-hidden />
        <header className="picker-head">
          <strong id={titleId}>{label}</strong>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Zamknij">
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div className="sys-tabs">
          <Picker
            label="Sposób wyboru"
            value={tab}
            mode="segments"
            options={[
              { value: 'wizard', label: 'Dobierz po wymaganiach' },
              { value: 'list', label: `Lista (${rows.length})` },
            ]}
            onChange={setTab}
          />
          {current && (
            <p className="sys-current">
              Teraz: <strong>{current.name}</strong>
            </p>
          )}
        </div>
        <div ref={list} className="picker-list" role={tab === 'list' ? 'listbox' : undefined} aria-labelledby={titleId}>
          {tab === 'wizard' ? wizard : <SystemList rows={rows} value={value} onPick={onPick} />}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function SystemButton({
  id,
  label,
  rows,
  value,
  onChange,
  wizard,
}: Props & { label: string; rows: Row[]; wizard: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const current = rows.find((r) => r.id === value);
  const close = () => {
    setOpen(false);
    btn.current?.focus({ preventScroll: true });
  };
  return (
    <>
      <button ref={btn} id={id} type="button" className="picker-btn" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        <span className="picker-value">{current?.name ?? 'Wybierz…'}</span>
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M7 10l5 5 5-5" />
        </svg>
      </button>
      {open && (
        <SystemSheet
          label={label}
          rows={rows}
          value={value}
          onClose={close}
          onPick={(v) => {
            close();
            if (v !== value) onChange(v);
          }}
          wizard={wizard(close)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Ściany i okładziny
// ---------------------------------------------------------------------------

interface WallSelectProps extends Props {
  /** Wysokość ściany, cm – wstępnie wypełnia pytanie o wysokość */
  heightCm?: number;
  /** Wybór z doboru: system razem z płytą, rozstawem i słupkami z karty (brak = sam system przez onChange) */
  onPick?: (pick: WallPick) => void;
}

const pickDetail = (p: WallPick) =>
  [
    boardById(p.boardId).short + (p.innerBoardId ? ` + ${boardById(p.innerBoardId).short}` : ''),
    ...p.reasons,
    p.variant?.code ? `${MAKER_LABEL[makerOf(p.system)]} ${p.variant.code}` : makerOf(p.system) !== 'rigips' ? MAKER_LABEL[makerOf(p.system)] : '',
  ]
    .filter(Boolean)
    .join(' · ');

const LAYER_OPTIONS: PickOption<0 | 1 | 2>[] = [
  { value: 0, label: 'Dowolne' },
  { value: 1, label: 'Pojedyncze' },
  { value: 2, label: 'Podwójne' },
];

/** Pole wielokrotnego wyboru cech ściany */
function Features({ value, options, onChange }: { value: Set<WallFeature>; options: typeof WALL_FEATURES; onChange: (v: Set<WallFeature>) => void }) {
  const toggle = (id: WallFeature) => {
    const next = new Set(value);
    if (next.has(id)) next.delete(id);
    else {
      next.add(id);
      // łazienka i strefa mokra to jedno pytanie o płytę – zostaje ostatnio zaznaczone
      if (id === 'wet') next.delete('humid');
      if (id === 'humid') next.delete('wet');
    }
    onChange(next);
  };
  return (
    <div className="sys-chips" role="group" aria-label="Cechy ściany">
      {options.map((o) => (
        <button key={o.id} type="button" className={`sys-chip ${value.has(o.id) ? 'on' : ''}`} aria-pressed={value.has(o.id)} title={o.hint} onClick={() => toggle(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function WallWizard({
  value,
  heightCm,
  liningOnly,
  rows,
  onPick,
}: {
  value: string;
  heightCm?: number;
  liningOnly?: boolean;
  rows: Row[];
  onPick: (pick: WallPick) => void;
}) {
  const current = wallSystemById(value);
  const [purpose, setPurpose] = useState<WallPurpose>(liningOnly ? 'lining' : wallPurposeOf(current));
  const [height, setHeight] = useState(heightCm ?? 260);
  const [profile, setProfile] = useState(0);
  const [layers, setLayers] = useState<0 | 1 | 2>(0);
  const [features, setFeatures] = useState<Set<WallFeature>>(new Set());
  const [maker, setMaker] = useState<MakerFilter>('all');
  const makers = useMemo(() => makerOptions(rows), [rows]);
  const widths = useMemo(() => (liningOnly ? [] : profileWidths(purpose)), [purpose, liningOnly]);
  const profileOptions: PickOption<number>[] = [{ value: 0, label: 'Dowolna' }, ...widths.map((w) => ({ value: w, label: `${w} mm`, short: String(w) }))];
  const width = widths.includes(profile) ? profile : 0;
  // akustykę karty podają tylko dla ścian działowych
  const featureOptions = WALL_FEATURES.filter((f) => f.id !== 'acoustic' || purpose === 'partition');
  const active = [...features].filter((f) => featureOptions.some((o) => o.id === f));
  const picks = recommendWalls({
    purpose,
    heightCm: height,
    ...featureNeeds(active),
    profile: width || undefined,
    layers: layers || undefined,
    liningOnly,
    maker: maker === 'all' ? undefined : maker,
  });
  return (
    <>
      <div className="sys-wizard">
        {!liningOnly && (
          <Ask label="Co budujesz?">
            <Picker label="Rodzaj ściany" value={purpose} options={PURPOSE_OPTIONS} onChange={setPurpose} mode="segments" />
          </Ask>
        )}
        <div className="sys-ask-row">
          <DimInput label="Wysokość" unit="m" value={height} min={30} max={1600} onChange={setHeight} />
        </div>
        {widths.length > 0 && (
          <Ask label="Szerokość profilu">
            <Picker label="Szerokość profilu" value={width} options={profileOptions} onChange={setProfile} mode="segments" />
          </Ask>
        )}
        <Ask label="Płytowanie">
          <Picker label="Płytowanie" value={layers} options={LAYER_OPTIONS} onChange={setLayers} mode="segments" />
        </Ask>
        <Ask label="Cechy (możesz zaznaczyć kilka)">
          <Features value={new Set(active)} options={featureOptions} onChange={setFeatures} />
        </Ask>
        {makers.length > 2 && (
          <Ask label="Producent">
            <Picker label="Producent" value={maker} options={makers} onChange={setMaker} mode="segments" />
          </Ask>
        )}
      </div>
      <Picks
        value={value}
        rows={picks.map((p) => ({ key: p.system.id, id: p.system.id, name: p.system.name, detail: pickDetail(p), approx: p.approx, onPick: () => onPick(p) }))}
      />
      <p className="sys-note">
        Klasy EI, akustyka i wysokości pochodzą z kart producentów. Systemy oznaczone „szacunek” nie mają karty – nie pojawiają się przy
        zaznaczonej odporności ogniowej ani akustyce.
      </p>
    </>
  );
}

function wallRows(systems: WallSystem[]): Row[] {
  const cats = Object.keys(WALL_CATEGORY_LABEL) as WallCategory[];
  return [
    ...cats.flatMap((c) => systems.filter((s) => s.category === c && !s.custom).map((s) => rowOf(s, WALL_CATEGORY_LABEL[c]))),
    ...systems.filter((s) => s.custom).map((s) => rowOf(s, 'Systemy własne')),
  ];
}

/** Wybór systemu ściany: dobór po wymaganiach albo lista (podstawowe / pozostałe, wyszukiwarka) */
export function WallSystemSelect({ id, value, onChange, label = 'System ściany', heightCm, onPick }: WallSelectProps) {
  const rows = wallRows(allWallSystems());
  return (
    <SystemButton
      id={id}
      label={label}
      rows={rows}
      value={wallSystemById(value).id}
      onChange={onChange}
      wizard={(close) => (
        <WallWizard
          value={value}
          heightCm={heightCm}
          rows={rows}
          onPick={(p) => {
            close();
            if (onPick) onPick(p);
            else if (p.system.id !== value) onChange(p.system.id);
          }}
        />
      )}
    />
  );
}

/**
 * Systemy okładzin istniejących ścian: jednostronne systemy mocowane do muru z katalogu
 * (klej, CD na ES, ATLAS M-System 3G, systemy własne).
 */
export function LiningSystemSelect({ id, value, onChange, label = 'System okładziny', heightCm, onPick }: WallSelectProps) {
  const rows = wallRows(allWallSystems().filter(isLiningSystem));
  return (
    <SystemButton
      id={id}
      label={label}
      rows={rows}
      value={wallSystemById(value).id}
      onChange={onChange}
      wizard={(close) => (
        <WallWizard
          value={value}
          heightCm={heightCm}
          liningOnly
          rows={rows}
          onPick={(p) => {
            close();
            if (onPick) onPick(p);
            else if (p.system.id !== value) onChange(p.system.id);
          }}
        />
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// Sufity
// ---------------------------------------------------------------------------

interface CeilingSelectProps extends Props {
  /** Krótszy bok pomieszczenia, cm – dla sufitów bez wieszaków */
  spanCm?: number;
  onPick?: (pick: CeilingPick) => void;
}

function mountOf(s: CeilingSystem): CeilingMount {
  if (isAtticSystem(s)) return 'attic';
  if (s.kind === 'ua-span' || s.kind === 'cw-span') return 'span';
  return s.kind === 'direct' || s.kind === 'point-fix' ? 'direct' : 'suspended';
}

function CeilingWizard({ value, spanCm, rows, onPick }: { value: string; spanCm?: number; rows: Row[]; onPick: (pick: CeilingPick) => void }) {
  const [mount, setMount] = useState<CeilingMount>(mountOf(ceilingSystemById(value)));
  const [room, setRoom] = useState<Room>('dry');
  const [fire, setFire] = useState<FireNeed>(0);
  const [span, setSpan] = useState(spanCm ?? 300);
  const [maker, setMaker] = useState<MakerFilter>('all');
  const makers = useMemo(() => makerOptions(rows), [rows]);
  const picks = recommendCeilings({ mount, room, fire, spanCm: mount === 'span' ? span : undefined, maker: maker === 'all' ? undefined : maker });
  return (
    <>
      <div className="sys-wizard">
        <Ask label="Jaki sufit?">
          <Picker label="Rodzaj sufitu" value={mount} options={MOUNT_OPTIONS} onChange={setMount} mode="segments" />
        </Ask>
        {mount === 'span' && (
          <div className="sys-ask-row">
            <DimInput label="Rozpiętość (krótszy bok)" unit="m" value={span} min={50} max={1000} onChange={setSpan} />
          </div>
        )}
        <Ask label="Pomieszczenie">
          <Picker label="Pomieszczenie" value={room} options={ROOM_OPTIONS} onChange={setRoom} mode="segments" />
        </Ask>
        <Ask label="Odporność ogniowa">
          <Picker label="Odporność ogniowa" value={fire} options={FIRE_OPTIONS} onChange={setFire} mode="segments" />
        </Ask>
        {makers.length > 2 && (
          <Ask label="Producent">
            <Picker label="Producent" value={maker} options={makers} onChange={setMaker} mode="segments" />
          </Ask>
        )}
      </div>
      <Picks
        value={value}
        rows={picks.map((p) => ({
          key: p.system.id,
          id: p.system.id,
          name: p.system.name,
          detail: [boardById(p.boardId).short, ...p.reasons, p.system.code].filter(Boolean).join(' · '),
          approx: p.approx,
          onPick: () => onPick(p),
        }))}
      />
    </>
  );
}

export function CeilingSystemSelect({ id, value, onChange, label = 'System sufitu', spanCm, onPick }: CeilingSelectProps) {
  // ruszty tylko do poddaszy (łaty, profile kapeluszowe…) wybiera się w formularzu poddasza
  const all = allCeilingSystems().filter((s) => !s.atticFrame);
  const kinds = Object.keys(CEILING_KIND_LABEL) as CeilingKind[];
  const rows = [
    ...kinds.flatMap((k) => all.filter((s) => s.kind === k && !s.custom).map((s) => rowOf(s, CEILING_KIND_LABEL[k]))),
    ...all.filter((s) => s.custom).map((s) => rowOf(s, 'Systemy własne')),
  ];
  return (
    <SystemButton
      id={id}
      label={label}
      rows={rows}
      value={ceilingSystemById(value).id}
      onChange={onChange}
      wizard={(close) => (
        <CeilingWizard
          value={value}
          spanCm={spanCm}
          rows={rows}
          onPick={(p) => {
            close();
            if (onPick) onPick(p);
            else if (p.system.id !== value) onChange(p.system.id);
          }}
        />
      )}
    />
  );
}

/** Ostrzeżenia z wyliczeń (np. przekroczona wysokość lub rozpiętość) */
export function Warnings({ items }: { items?: string[] }) {
  if (!items?.length) return null;
  return (
    <ul className="warnings" role="status">
      {items.map((w) => (
        <li key={w}>{w}</li>
      ))}
    </ul>
  );
}
