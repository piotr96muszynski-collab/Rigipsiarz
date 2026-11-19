// Protokół Bluetooth LE dalmierzy Leica DISTO (D1, D110, D2 nowy, X3, X4, D510, D810, S910 i podobne z BLE / Bluetooth Smart).
// NIESPRAWDZONE NA SPRZĘCIE – zbudowane na podstawie publicznego opisu usługi „DISTO” (Leica DISTO SDK)
// i otwartych projektów, które go używają. Do weryfikacji służy ekran „Dalmierz – diagnostyka”.
//
// Usługa 3ab10100-…: każda charakterystyka niesie jedną wartość, bez ramek i sum kontrolnych.
//   3ab10101 – odległość, float32 little-endian w metrach (indicate po każdym pomiarze przyciskiem)
//   3ab10102 – jednostka odległości na ekranie, uint16 (tylko informacyjnie: odległość zawsze przychodzi w metrach)
//   3ab10103 – nachylenie, float32 LE w radianach (modele z czujnikiem pochylenia)
//   3ab10104 – jednostka nachylenia, uint16
//   3ab10109 – polecenia tekstowe ASCII, np. „g” = zmierz, „o” = laser wł., „p” = laser wył.
// Starsze modele (D3a BT, D8, A6) używają klasycznego Bluetooth SPP – przeglądarka ich nie obsłuży.

const uuid = (short: string) => `3ab1${short}-f831-4395-b29d-570977d5bf94`;

export const LEICA_SERVICE = uuid('0100');
export const LEICA_DISTANCE = uuid('0101');
export const LEICA_DISTANCE_UNIT = uuid('0102');
export const LEICA_INCLINATION = uuid('0103');
export const LEICA_INCLINATION_UNIT = uuid('0104');
export const LEICA_COMMAND = uuid('0109');

/** Prefiksy nazw, pod którymi dalmierze Leica się ogłaszają („DISTO D2 1234567”) */
export const LEICA_NAME_PREFIXES = ['DISTO', 'Disto', 'Leica'];

/** Polecenie „zmierz” – wyzwala pomiar z telefonu (wysyłane z diagnostyki) */
export const LEICA_MEASURE = new TextEncoder().encode('g');

export const isLeicaCharacteristic = (u: string) => /^3ab101[0-9a-f]{2}-f831-4395-b29d-570977d5bf94$/i.test(u);
export const isLeicaDistance = (u: string) => u.toLowerCase() === LEICA_DISTANCE;

const NAMES: Record<string, string> = {
  [LEICA_DISTANCE]: 'odległość',
  [LEICA_DISTANCE_UNIT]: 'jednostka odległości',
  [LEICA_INCLINATION]: 'nachylenie',
  [LEICA_INCLINATION_UNIT]: 'jednostka nachylenia',
  [LEICA_COMMAND]: 'polecenia',
};

/** Krótka nazwa charakterystyki do dziennika, np. „Leica odległość” */
export const leicaCharName = (u: string) => `Leica ${NAMES[u.toLowerCase()] ?? u.slice(4, 8)}`;

/** Odległość w metrach z wartości charakterystyki 3ab10101 albo null */
export function leicaMeters(data: Uint8Array): number | null {
  if (data.length < 4) return null;
  const m = new DataView(data.buffer, data.byteOffset, data.byteLength).getFloat32(0, true);
  return Number.isFinite(m) ? m : null;
}

/** Odległość do wstawienia w pole wymiaru (w cm) albo null – tylko z charakterystyki odległości */
export function leicaDistanceCm(charUuid: string, data: Uint8Array): number | null {
  if (!isLeicaDistance(charUuid)) return null;
  const m = leicaMeters(data);
  if (m === null || m <= 0 || m > 300) return null;
  return Math.round(m * 1000) / 10;
}

/** Opis wartości do dziennika diagnostyki */
export function describeLeica(charUuid: string, data: Uint8Array): string | null {
  const u = charUuid.toLowerCase();
  if (!isLeicaCharacteristic(u)) return null;
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if ((u === LEICA_DISTANCE || u === LEICA_INCLINATION) && data.length >= 4) {
    const v = dv.getFloat32(0, true);
    return u === LEICA_DISTANCE ? `Leica odległość: ${v.toFixed(4)} m` : `Leica nachylenie: ${((v * 180) / Math.PI).toFixed(1)}°`;
  }
  if ((u === LEICA_DISTANCE_UNIT || u === LEICA_INCLINATION_UNIT) && data.length >= 2) return `${leicaCharName(u)}: kod ${dv.getUint16(0, true)}`;
  return `${leicaCharName(u)}: ${data.length} B`;
}
