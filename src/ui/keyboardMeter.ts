// Dalmierze, które udają klawiaturę Bluetooth (HID, tryb „klawiatura”): po pomiarze „wpisują” wynik do pola
// z fokusem, np. „2.345”, „2,345 m” albo „2345” (tryb mm), zwykle z Enterem lub Tabem na końcu.
// Pole wymiaru w cm potraktowałoby „2.345” jako 2,345 cm, więc rozpoznajemy takie „wpisanie” po tempie:
// urządzenie wysyła znaki co kilka–kilkadziesiąt ms, człowiek pisze wyraźnie wolniej.

/** Maksymalny odstęp między znakami w serii z dalmierza (ms) */
export const BURST_GAP_MS = 45;
/** Minimalna liczba znaków serii */
export const BURST_MIN_CHARS = 3;

/** Śledzi tempo wpisywania znaków w polu */
export class BurstDetector {
  private last = -Infinity;
  private count = 0;

  reset() {
    this.last = -Infinity;
    this.count = 0;
  }

  /** Wywołaj przy każdym wpisanym znaku (keydown klawisza drukowalnego) */
  key(t: number) {
    this.count = t - this.last <= BURST_GAP_MS ? this.count + 1 : 1;
    this.last = t;
  }

  /** Czy cały tekst pola pochodzi z szybkiej serii znaków (czyli z dalmierza) */
  isBurst(text: string): boolean {
    const len = text.trim().length;
    return this.count >= BURST_MIN_CHARS && len > 0 && len <= this.count;
  }
}

/**
 * Wynik wpisany przez dalmierz → cm. Jednostka podana wprost (mm/cm/m) jest brana dosłownie.
 * Bez jednostki: liczba z separatorem dziesiętnym to metry („2.345”), liczba całkowita to milimetry („2345”) –
 * tak wyglądają domyślne formaty dalmierzy w trybach m i mm.
 */
export function parseMeterText(s: string): number | null {
  const m = s
    .trim()
    .toLowerCase()
    .replace(',', '.')
    .match(/^(\d+(?:\.\d+)?)\s*(mm|cm|m)?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const u = m[2] ?? (m[1].includes('.') ? 'm' : 'mm');
  const cm = u === 'mm' ? n / 10 : u === 'm' ? n * 100 : n;
  return Math.round(cm * 10) / 10;
}
