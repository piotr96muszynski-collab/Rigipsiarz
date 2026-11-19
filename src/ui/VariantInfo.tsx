import { MAKER_LABEL, boardById, wallMaxHeight, type StudSpacing, type WallSystem } from '../catalog/rigips';
import { makerOf, variantForHeight, type WallPick } from '../calc/recommend';
import { Picker } from './Picker';
import { SourceBadge } from './SystemSelect';
import { fmtNum } from './wallStyle';

interface Props {
  idBase: string;
  sys: WallSystem;
  boardId: string;
  studSpacing: StudSpacing;
  doubleStuds?: boolean;
  innerBoardId?: string;
  /** Płyty strony 2 (systemy z innym poszyciem stron) */
  sideBBoards?: string[];
  /** Wysokość ściany, cm */
  heightCm: number;
  /** Zastosuj odmianę z karty (rozstaw, słupki podwójne) */
  onApply: (pick: WallPick) => void;
  onDouble: (on: boolean) => void;
  onInner: (boardId: string) => void;
  /** Zmiana płyt strony 2 (brak = bez wyboru) */
  onSideB?: (boards: string[]) => void;
  /** line: tylko linia z karty i podpowiedź przy za wysokiej ścianie; options: tylko słupki podwójne i płyta wewnętrzna */
  part?: 'line' | 'options';
}

const range = (vals: (number | undefined)[]) => {
  const x = [...new Set(vals.filter((v): v is number => v !== undefined))].sort((a, b) => a - b);
  return x.length ? `${x[0]}${x.length > 1 ? `–${x[x.length - 1]}` : ''}` : undefined;
};

/**
 * Odmiana z karty producenta dla bieżących ustawień ściany (płyta, rozstaw, słupki): numer systemu,
 * dopuszczalna wysokość, EI i akustyka. Gdy ściana jest za wysoka, podpowiada odmianę z gęstszymi
 * albo podwójnymi słupkami. Tu też przełącznik słupków podwójnych i płyta warstw wewnętrznych.
 */
export function WallVariantInfo({ idBase, sys, boardId, studSpacing, doubleStuds, innerBoardId, sideBBoards, heightCm, onApply, onDouble, onInner, onSideB, part }: Props) {
  const cw = sys.frame === 'single' || sys.frame === 'double' || sys.frame === 'separate';
  const maker = MAKER_LABEL[makerOf(sys)];
  // strona 2 z innym poszyciem: odmiana z karty musi mieć te same płyty strony 2
  const sideB = (sideBBoards?.length ? sideBBoards : sys.sideB ?? []).join('+');
  const match = (sys.variants ?? []).filter(
    (v) =>
      v.board === boardId &&
      (v.studSpacing ?? sys.studSpacing) === studSpacing &&
      !!v.doubleStuds === !!doubleStuds &&
      (!v.sideB || v.sideB.join('+') === sideB),
  );
  const sideBOptions = sys.sideB?.length
    ? [...new Set([sys.sideB.join('+'), ...(sys.variants ?? []).flatMap((v) => (v.sideB ? [v.sideB.join('+')] : []))])]
    : [];
  const sideBLabel = (key: string) => key.split('+').map((id) => boardById(id).name).join(' + ');
  const limit = wallMaxHeight(sys, studSpacing, { board: boardId, doubleStuds });
  const tooHigh = !!limit && heightCm > limit + 0.5;
  const better = tooHigh ? variantForHeight(sys, heightCm, boardId) : undefined;
  const innerOptions = sys.innerBoard
    ? [...new Set([sys.innerBoard, ...(sys.variants ?? []).filter((v) => v.board === boardId).flatMap((v) => v.innerBoards ?? [])])]
    : [];
  const fire = range(match.map((v) => v.fire));
  const ra1 = range(match.map((v) => v.ra1));
  const hMax = match.length ? Math.max(...match.map((v) => v.maxHeight ?? 0)) : 0;
  const codes = [...new Set(match.map((v) => v.code).filter(Boolean))];
  const line = part !== 'options';
  const opts = part !== 'line';
  return (
    <div className="variant-info">
      {!line || sys.custom ? null : match.length ? (
        <p className="variant-line">
          <SourceBadge />
          <span>
            {maker} {codes.join(', ')}
            {hMax ? ` · do ${fmtNum(hMax / 100)} m` : ''}
            {fire ? ` · EI ${fire}` : ''}
            {ra1 ? ` · RA1 ${ra1} dB` : ''}
            {match.some((v) => v.fire !== match[0].fire) ? ' (klasa EI zależy od wypełnienia – sprawdź kartę)' : ''}
          </span>
        </p>
      ) : sys.variants?.length ? (
        <p className="variant-line">
          <SourceBadge approx />
          <span>
            Karta systemu nie podaje odmiany z płytą {boardById(boardId).short} przy {doubleStuds ? 'podwójnych ' : ''}słupkach co {studSpacing} cm – wysokość i
            klasa EI nie są potwierdzone.
          </span>
        </p>
      ) : sys.source.approx ? (
        <p className="variant-line">
          <SourceBadge approx />
          <span>System bez karty producenta – wartości orientacyjne.</span>
        </p>
      ) : null}
      {line &&
        tooHigh &&
        (better ? (
          <button type="button" className="btn small variant-apply" onClick={() => onApply(better)}>
            Zastosuj słupki {better.doubleStuds ? 'podwójne ' : ''}co {better.studSpacing} cm
            {better.variant?.code ? ` (${maker} ${better.variant.code}` : ' ('}
            {better.maxHeight ? `${better.variant?.code ? ', ' : ''}do ${fmtNum(better.maxHeight / 100)} m)` : ')'}
          </button>
        ) : (
          <p className="variant-line">
            <span>Żadna odmiana tego systemu nie sięga {fmtNum(heightCm / 100)} m – wybierz mocniejszy system w „Dobierz po wymaganiach”.</span>
          </p>
        ))}
      {opts && (cw || innerOptions.length > 0 || sideBOptions.length > 1) && (
        <div className="variant-opts">
          {cw && (
            <label className="check">
              <input type="checkbox" checked={!!doubleStuds} onChange={(e) => onDouble(e.target.checked)} />
              <span>Słupki podwójne (2×CW)</span>
            </label>
          )}
          {innerOptions.length > 0 && (
            <div className="field">
              <label htmlFor={`ib-${idBase}`}>Płyta wewnętrzna{sys.innerLayers && sys.innerLayers > 1 ? ` (${sys.innerLayers} warstwy)` : ''}</label>
              <Picker
                id={`ib-${idBase}`}
                label="Płyta warstw wewnętrznych"
                value={innerBoardId ?? sys.innerBoard!}
                options={innerOptions.map((id) => ({ value: id, label: boardById(id).name, short: boardById(id).short }))}
                onChange={onInner}
                mode="sheet"
              />
            </div>
          )}
          {sideBOptions.length > 1 && onSideB && (
            <div className="field">
              <label htmlFor={`sb-${idBase}`}>Płyty strony B (od rusztu)</label>
              <Picker
                id={`sb-${idBase}`}
                label="Płyty strony B"
                value={sideB}
                options={sideBOptions.map((key) => ({ value: key, label: sideBLabel(key), short: key.split('+').map((id) => boardById(id).short).join(' + ') }))}
                onChange={(key) => onSideB(key.split('+'))}
                mode="sheet"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
