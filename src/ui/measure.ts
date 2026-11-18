// Wspólny „kanał pomiarów” – miejsce na integrację z dalmierzem laserowym (np. Bosch przez Web Bluetooth).
// Źródło pomiaru wywołuje `pushMeasurement(cm)`, a wartość trafia do aktywnego pola wymiaru (DimInput).

type Listener = (cm: number) => void;
let active: Listener | null = null;

/** Pole wymiaru rejestruje się jako odbiorca, gdy dostaje fokus */
export function setActiveMeasureTarget(l: Listener | null) {
  active = l;
}

export function isActiveMeasureTarget(l: Listener) {
  return active === l;
}

/** Wywoływane przez źródło pomiaru (dalmierz). Zwraca false, gdy żadne pole nie czeka na wartość. */
export function pushMeasurement(cm: number): boolean {
  if (!active) return false;
  active(Math.round(cm * 10) / 10);
  return true;
}

export const bluetoothSupported = () => typeof navigator !== 'undefined' && 'bluetooth' in navigator;
