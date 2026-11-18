import { DEFAULT_WOOL, WOOL_THICKNESSES, resolveWool, woolProductById, woolProductsFor, type WoolChoice } from '../catalog/insulation';
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
            <select
              id={id}
              aria-label="Grubość wełny"
              value={thickness}
              onChange={(e) => onThickness(Number(e.target.value))}
            >
              {options.map((t) => (
                <option key={t} value={t}>
                  {t} mm
                </option>
              ))}
            </select>
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
            <select
              id={`woolp-${t}`}
              value={current}
              onChange={(e) =>
                onChange(t, e.target.value === 'custom' ? { customM2: choice?.customM2 || 5 } : { productId: e.target.value })
              }
            >
              {woolProductsFor(t).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.thickness !== t ? ` ${p.thickness} mm` : ''} · {fmtM2(p.packM2)} m²
                </option>
              ))}
              <option value="custom">Własne opakowanie…</option>
            </select>
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
