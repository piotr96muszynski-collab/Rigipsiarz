// Protokół Bluetooth LE dalmierzy Bosch (GLM 50 C, PLR 30 C / 40 C / 50 C i podobne).
// Potwierdzone na PLR 30 C (2026-11-19): usługa 00005301-…, polecenie C0 55 02 01 00 1A, wynik C0 55 10 06 + float32 LE od bajtu 7, CRC OK.
// Bosch nie publikuje opisu protokołu. Poniższe wartości pochodzą z otwartych projektów,
// które odczytują pomiary z GLM 50 C / PLR przez BLE, i trzeba je potwierdzić na prawdziwym egzemplarzu
// (do tego służy ekran „Dalmierz – diagnostyka”).
//
// Ramka: [0xC0] [polecenie] [długość danych N] [N bajtów danych] [CRC-8]
// CRC-8: wielomian 0xA6, wartość początkowa 0xAA, liczone od bajtu 0xC0 do końca danych.
// Pomiar w trybie synchronizacji: C0 55 10 06 … – odległość jako float32 little-endian w metrach od bajtu 7.

import { LEICA_SERVICE } from './leica';

/** Usługa BLE „Bosch MT” w starszych modelach (GLM 50 C, GLM 100 C) */
export const BOSCH_SERVICE = '02a6c0d0-0451-4000-b000-fb3210111989';
/** Charakterystyka do zapisu poleceń i odbioru wskazań (indicate) */
export const BOSCH_CHARACTERISTIC = '02a6c0d1-0451-4000-b000-fb3210111989';
/** Usługa BLE w nowszych modelach (PLR 30 C / 40 C, GLM 50-27 C) – ten sam protokół ramek MT */
export const BOSCH_SERVICE_V2 = '00005301-0000-0041-5253-534f46540000';
export const BOSCH_CHARACTERISTIC_V2 = '00004301-0000-0041-5253-534f46540000';

/** Znane pary usługa/charakterystyka, sprawdzane po kolei przy łączeniu */
export const BOSCH_CHANNELS = [
  { service: BOSCH_SERVICE_V2, characteristic: BOSCH_CHARACTERISTIC_V2 },
  { service: BOSCH_SERVICE, characteristic: BOSCH_CHARACTERISTIC },
] as const;

/**
 * Diagnostyka: przeglądarka pokazuje tylko usługi wymienione przed połączeniem, więc podajemy
 * szeroką listę kandydatów (Bosch, standardowe, popularne moduły BLE-UART), żeby zobaczyć, co dalmierz ma.
 */
export const DIAG_CANDIDATE_SERVICES = [
  ...BOSCH_CHANNELS.map((c) => c.service),
  LEICA_SERVICE, // Leica DISTO (zob. leica.ts)
  '00005300-0000-0041-5253-534f46540000',
  '00005302-0000-0041-5253-534f46540000',
  'device_information',
  'battery_service',
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  '0000fff0-0000-1000-8000-00805f9b34fb',
  '0000fee0-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Microchip ISSC
];

export const isBoschCharacteristic = (uuid: string) => BOSCH_CHANNELS.some((c) => c.characteristic === uuid.toLowerCase());

/** Prefiksy nazw, pod którymi dalmierze Bosch się ogłaszają */
export const BOSCH_NAME_PREFIXES = ['PLR', 'GLM', 'Bosch', 'BOSCH', 'PLM'];

const START = 0xc0;
const CMD_SYNC = 0x55;
/** Tryb pomiaru „pojedyncza odległość” w ramce wyniku */
export const MODE_DISTANCE = 0x06;

export function crc8(bytes: ArrayLike<number>, end = bytes.length): number {
  let c = 0xaa;
  for (let i = 0; i < end; i++) {
    c ^= bytes[i];
    for (let b = 0; b < 8; b++) c = c & 0x80 ? ((c << 1) ^ 0xa6) & 0xff : (c << 1) & 0xff;
  }
  return c;
}

/** Buduje ramkę polecenia z sumą kontrolną */
export function buildFrame(cmd: number, payload: number[]): Uint8Array {
  const body = [START, cmd, payload.length, ...payload];
  return Uint8Array.from([...body, crc8(body)]);
}

/** Włącza tryb synchronizacji: każdy pomiar wykonany przyciskiem na dalmierzu jest wysyłany do telefonu (C0 55 02 01 00 1A) */
export const ENABLE_SYNC = buildFrame(CMD_SYNC, [0x01, 0x00]);

export interface BoschFrame {
  cmd: number;
  /** dane bez nagłówka i CRC */
  payload: Uint8Array;
  crcOk: boolean;
  /** tryb pomiaru (pierwszy bajt danych), gdy to ramka wyniku */
  mode?: number;
  /** odległość w metrach, gdy to ramka wyniku z odległością */
  meters?: number;
}

/** Rozpoznaje ramkę Bosch. Zwraca null, gdy dane nie wyglądają na ramkę. */
export function parseFrame(data: Uint8Array): BoschFrame | null {
  if (data.length < 4 || data[0] !== START) return null;
  const n = data[2];
  if (data.length < 3 + n) return null;
  const payload = data.slice(3, 3 + n);
  const crcOk = data.length >= 4 + n && crc8(data, 3 + n) === data[3 + n];
  const frame: BoschFrame = { cmd: data[1], payload, crcOk };
  if (data[1] === CMD_SYNC && n >= 8) {
    frame.mode = payload[0];
    const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const m = dv.getFloat32(7, true);
    if (Number.isFinite(m)) frame.meters = m;
  }
  return frame;
}

/**
 * Wyciąga odległość do wstawienia w pole wymiaru (w cm) albo null.
 * Przyjmuje tylko tryb pojedynczej odległości – powierzchnia czy objętość nie mogą trafić do pola długości.
 */
export function distanceCm(data: Uint8Array): number | null {
  const f = parseFrame(data);
  if (!f || f.mode !== MODE_DISTANCE || f.meters === undefined) return null;
  if (f.meters <= 0 || f.meters > 250) return null;
  return Math.round(f.meters * 1000) / 10;
}

/** Diagnostyka: wszystkie miejsca w ramce, gdzie float32 LE wygląda jak odległość 0,05–100 m */
export function floatCandidates(data: Uint8Array): { offset: number; meters: number }[] {
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const out: { offset: number; meters: number }[] = [];
  for (let o = 0; o + 4 <= data.length; o++) {
    const v = dv.getFloat32(o, true);
    if (Number.isFinite(v) && v >= 0.05 && v <= 100) out.push({ offset: o, meters: Math.round(v * 10000) / 10000 });
  }
  return out;
}

export function toHex(data: Uint8Array): string {
  return Array.from(data, (b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}

/** „C0 55 02 01 00 1A” albo „c055020100” → bajty; null przy błędnym zapisie */
export function fromHex(s: string): Uint8Array | null {
  const clean = s.replace(/0x/gi, '').replace(/[\s,:-]/g, '');
  if (!clean || clean.length % 2 || /[^0-9a-f]/i.test(clean)) return null;
  return Uint8Array.from(clean.match(/../g)!.map((h) => parseInt(h, 16)));
}
