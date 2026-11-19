import { DEFAULT_WOOL, WOOL_THICKNESSES, resolveWool, woolProductById, woolProductsFor, type WoolChoice } from '../catalog/insulation';
import type { VaporBarrierSpec } from '../calc/vaporBarrier';
import { Picker } from './Picker';
import { fmtNum } from './wallStyle';

/** m² bez zbędnych zer: 7,2 · 8,64 · 12 */
const fmtM2 = (v: number) => String(Math.round(v * 1000) / 1000).replace('.', ',');

interface Props {
  id: string;
  enabled: boolean;
  /** Grubość użyta w wyliczeniu, mm */
  thickness: number;
  /** Dostępne grubości, mm */
  options: number[];
  /** Liczba warstw (podwójny ruszt = 2) */
  layers: number;
  /** Powierzchnia netto elementu (po odjęciu otworów), m² */
  areaM2?: number;
  wool?: Record<string, WoolChoice>;
  onToggle: (on: boolean) => void;
  onThickness: (mm: number) => void;
}

/** Wełna mineralna w inspektorze ściany / sufitu: włącznik, grubość i ilość dla elementu */
export function WoolField({ id, enabled, thickness, options, layers, areaM2, wool, onToggle, onThickness }: Props) {
  if (!options.length) return null;
  const r = resolveWool(thickness, wool?.[String(thickness)]);
  const m2 = (areaM2 ?? 0) * layers;
  return (
    <div className="wool-field">
      <div className="wool-row">
        <label className="check">
          <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} />
          Wełna mineralna
        </label>
        {enabled &&
          (options.length > 1 ? (
            <Picker
              id={id}
              label="Grubość wełny"
              value={thickness}
              options={options.map((t) => ({ value: t, label: `${t} mm` }))}
              onChange={onThickness}
              className="wool-pick"
            />
          ) : (
            <span className="muted">{thickness} mm</span>
          ))}
      </div>
      {enabled && areaM2 !== undefined && (
        <small className="hint">
          {layers > 1 ? `2 warstwy × ${fmtNum(areaM2, 1)} m² = ` : ''}
          {fmtNum(m2, 1)} m² netto (po odjęciu otworów) · {r.name}
          {r.packM2 > 0 && `, ${fmtM2(r.packM2)} m² w ${r.packUnit === 'rolka' ? 'rolce' : 'paczce'}`}
        </small>
      )}
    </div>
  );
}

/** Ustawienia projektu: który produkt wełny kupujemy dla każdej grubości */
export function WoolSettings({
  wool,
  onChange,
}: {
  wool?: Record<string, WoolChoice>;
  onChange: (thickness: number, choice: WoolChoice | undefined) => void;
}) {
  return (
    <div className="wool-settings">
      <h3>Wełna mineralna – opakowania</h3>
      <small className="hint">
        Lista zakupów przelicza m² wełny na pełne paczki wybranego produktu. Zawartość paczek wg oferty Bricoman i kart
        producentów – inny produkt (np. URSA) wpisz jako własne opakowanie.
      </small>
      {WOOL_THICKNESSES.map((t) => {
        const choice = wool?.[String(t)];
        const custom = !!choice?.customM2;
        const current = custom ? 'custom' : (choice?.productId ?? DEFAULT_WOOL[t]);
        const selected = woolProductById(current);
        return (
          <div key={t} className="field wool-choice">
            <label htmlFor={`woolp-${t}`}>{t} mm</label>
            <Picker
              id={`woolp-${t}`}
              label={`Wełna ${t} mm – opakowanie`}
              value={current}
              mode="sheet"
              options={[
                ...woolProductsFor(t).map((p) => ({
                  value: p.id,
                  label: `${p.name}${p.thickness !== t ? ` ${p.thickness} mm` : ''}`,
                  short: `${p.name}${p.thickness !== t ? ` ${p.thickness} mm` : ''} · ${fmtM2(p.packM2)} m²`,
                  hint: `${fmtM2(p.packM2)} m² w ${p.form === 'mata' ? 'rolce' : 'paczce'}`,
                })),
                { value: 'custom', label: 'Własne opakowanie…', hint: 'Wpiszesz, ile m² jest w paczce' },
              ]}
              onChange={(v) => onChange(t, v === 'custom' ? { customM2: choice?.customM2 || 5 } : { productId: v })}
            />
            {!custom && selected && (
              <small className="hint">
                {selected.form === 'mata'
                  ? `Mata w rolce, ${fmtM2(selected.packM2)} m²`
                  : `Płyty ${selected.sizeCm?.join('×')} cm, ${selected.pieces} szt. = ${fmtM2(selected.packM2)} m²`}{' '}
                · wełna {selected.material}, λ{' '}
                {fmtM2(selected.lambda)}
              </small>
            )}
            {custom && (
              <div className="input-unit">
                <input
                  type="number"
                  inputMode="decimal"
                  min={0.5}
                  step={0.01}
                  aria-label={`m² w paczce wełny ${t} mm`}
                  value={choice?.customM2 ?? ''}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value.replace(',', '.'));
                    if (Number.isFinite(v) && v > 0) onChange(t, { customM2: v });
                  }}
                />
                <span className="unit">m² w paczce</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Folia paroizolacyjna w inspektorze sufitu / ściany / okładziny: włącznik i ilość dla elementu */
export function VaporField({ spec, enabled, areaM2, onToggle }: { spec: VaporBarrierSpec; enabled: boolean; areaM2?: number; onToggle: (on: boolean) => void }) {
  if (spec.mode === 'none') return null;
  return (
    <div className="wool-field">
      <label className="check">
        <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} />
        Folia paroizolacyjna{spec.mode === 'system' ? ' (element systemu)' : ''}
      </label>
      <small className="hint">
        {enabled && areaM2 !== undefined
          ? `${fmtNum(areaM2 * spec.foil, 1)} m² folii z zakładami ok. 10 cm, taśma na zakłady ${fmtNum(areaM2 * spec.overlapTape, 1)} mb · ${spec.source}`
          : spec.mode === 'system'
            ? 'Wyłączona – upewnij się, że paroizolację zapewnia inna warstwa.'
            : 'Od strony ciepłego pomieszczenia, gdy przegroda oddziela strefy o różnej temperaturze (np. strop pod nieogrzewanym poddaszem, ściana zewnętrzna).'}
      </small>
    </div>
  );
}
