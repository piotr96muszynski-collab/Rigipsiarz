// Połączenie z dalmierzem Bosch lub Leica DISTO przez Web Bluetooth. Pomiar odległości trafia do aktywnego pola wymiaru
// przez kanał z src/ui/measure.ts. Stan i dziennik surowych ramek są dostępne dla UI (useSyncExternalStore).

import { pushMeasurement } from '../ui/measure';
import { BOSCH_CHANNELS, BOSCH_NAME_PREFIXES, DIAG_CANDIDATE_SERVICES, distanceCm, ENABLE_SYNC, isBoschCharacteristic } from './bosch';
import { isLeicaCharacteristic, isLeicaDistance, LEICA_COMMAND, LEICA_DISTANCE, LEICA_NAME_PREFIXES, LEICA_SERVICE, leicaCharName, leicaDistanceCm } from './leica';
import { type BtCharacteristic, type BtDevice, getBluetooth, writeChar } from './webBluetooth';

export type LaserBrand = 'bosch' | 'leica';

export type LaserStatus = 'unsupported' | 'idle' | 'connecting' | 'connected' | 'reconnecting';

export interface LaserState {
  status: LaserStatus;
  deviceName?: string;
  /** rozpoznany protokół (w diagnostyce może go nie być) */
  brand?: LaserBrand;
  error?: string;
  /** ostatni pomiar; inserted = trafił do pola wymiaru */
  last?: { cm: number; at: number; inserted: boolean };
  /** tryb diagnostyczny: nasłuch wszystkich charakterystyk */
  diagnostic: boolean;
}

export interface LogEntry {
  id: number;
  at: number;
  kind: 'in' | 'out' | 'info' | 'error';
  char?: string;
  /** pełny UUID charakterystyki (do rozpoznania protokołu w diagnostyce) */
  uuid?: string;
  bytes?: Uint8Array;
  text?: string;
}

const LOG_MAX = 300;
const LEICA_NOTE =
  'Leica DISTO: obsługa zbudowana z publicznego opisu protokołu, jeszcze niesprawdzona na sprzęcie. Wykonaj pomiar – w dzienniku powinna pojawić się „Leica odległość” z 4 bajtami.';
let state: LaserState = { status: getBluetooth() ? 'idle' : 'unsupported', diagnostic: false };
let log: LogEntry[] = [];
let logId = 0;
const listeners = new Set<() => void>();

let device: BtDevice | null = null;
let commandChar: BtCharacteristic | null = null;
let manualDisconnect = false;

function emit() {
  for (const l of listeners) l();
}
function set(patch: Partial<LaserState>) {
  state = { ...state, ...patch };
  emit();
}
function addLog(e: Omit<LogEntry, 'id' | 'at'>) {
  log = [...log.slice(-(LOG_MAX - 1)), { ...e, id: ++logId, at: Date.now() }];
  emit();
}

export const laser = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => void listeners.delete(l);
  },
  getState: () => state,
  getLog: () => log,
  clearLog() {
    log = [];
    emit();
  },
};

const short = (uuid: string) =>
  isBoschCharacteristic(uuid) ? 'Bosch' : isLeicaCharacteristic(uuid) ? leicaCharName(uuid) : uuid.replace(/-0000-1000-8000-00805f9b34fb$/i, '').replace(/^0000/, '0x');

function onValue(this: BtCharacteristic) {
  const v = this.value;
  if (!v) return;
  const bytes = new Uint8Array(v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength));
  addLog({ kind: 'in', char: short(this.uuid), uuid: this.uuid.toLowerCase(), bytes });
  // Leica: czysty float z charakterystyki odległości; pozostałe dane próbujemy jako ramkę Bosch (ma nagłówek i CRC)
  const cm = isLeicaCharacteristic(this.uuid) ? leicaDistanceCm(this.uuid, bytes) : distanceCm(bytes);
  if (cm === null) return;
  const inserted = pushMeasurement(cm);
  if (inserted) navigator.vibrate?.(30);
  set({ last: { cm, at: Date.now(), inserted } });
}

function errText(e: unknown): string {
  const name = (e as { name?: string })?.name;
  if (name === 'NotFoundError') return 'Nie wybrano dalmierza.';
  if (name === 'SecurityError') return 'Przeglądarka zablokowała Bluetooth (wymagane HTTPS i kliknięcie przycisku).';
  if (name === 'NetworkError') return 'Nie udało się połączyć. Włącz dalmierz i Bluetooth (ikona BT na ekranie dalmierza) i spróbuj ponownie.';
  return (e as Error)?.message || String(e);
}

async function setup(dev: BtDevice, diagnostic: boolean) {
  const server = await dev.gatt!.connect();
  addLog({ kind: 'info', text: `Połączono z ${dev.name ?? 'urządzeniem'}` });
  commandChar = null;
  let brand: LaserBrand | undefined;

  if (diagnostic) {
    const services = await server.getPrimaryServices().catch((e) => {
      addLog({ kind: 'error', text: `Lista usług: ${(e as Error)?.name ?? ''} ${(e as Error)?.message ?? e}` });
      return [];
    });
    if (!services.length) addLog({ kind: 'error', text: 'Dalmierz nie pokazał żadnej z usług z listy kandydatów.' });
    for (const s of services) {
      addLog({ kind: 'info', text: `Usługa ${s.uuid}` });
      for (const c of await s.getCharacteristics().catch(() => [] as BtCharacteristic[])) {
        const p = c.properties;
        const flags = ['read', 'write', 'writeWithoutResponse', 'notify', 'indicate'].filter((k) => p[k as keyof typeof p]).join(', ');
        addLog({ kind: 'info', text: `  charakterystyka ${c.uuid} [${flags}]` });
        if (p.notify || p.indicate) {
          c.addEventListener('characteristicvaluechanged', onValue);
          await c.startNotifications().catch((e) => addLog({ kind: 'error', text: `  nasłuch ${short(c.uuid)}: ${errText(e)}` }));
        }
        if (p.read) {
          const v = await c.readValue().catch(() => null);
          if (v) addLog({ kind: 'in', char: `${short(c.uuid)} (odczyt)`, uuid: c.uuid.toLowerCase(), bytes: new Uint8Array(v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength)) });
        }
        if (isBoschCharacteristic(c.uuid)) {
          commandChar = c;
          brand = 'bosch';
        } else if (c.uuid.toLowerCase() === LEICA_COMMAND && brand !== 'bosch') {
          commandChar = c;
          brand = 'leica';
        } else if (isLeicaDistance(c.uuid) && !brand) brand = 'leica';
      }
    }
    if (!brand) addLog({ kind: 'error', text: 'Brak znanej usługi Bosch (00005301-… ani 02a6c0d0-…) ani Leica (3ab10100-…). Wpisz UUID usługi w „Dodatkowe usługi”.' });
    if (brand === 'leica') addLog({ kind: 'info', text: LEICA_NOTE });
  } else {
    // Różne modele mają różne usługi BLE – próbujemy znanych po kolei
    for (const ch of BOSCH_CHANNELS) {
      try {
        const svc = await server.getPrimaryService(ch.service);
        commandChar = await svc.getCharacteristic(ch.characteristic);
        break;
      } catch {
        /* następna usługa */
      }
    }
    if (commandChar) {
      brand = 'bosch';
      addLog({ kind: 'info', text: `Usługa pomiarów ${short(commandChar.uuid)} (${commandChar.uuid})` });
      commandChar.addEventListener('characteristicvaluechanged', onValue);
      await commandChar.startNotifications();
    } else {
      // Leica DISTO: odległość przychodzi sama po naciśnięciu przycisku, polecenia są opcjonalne
      const svc = await server.getPrimaryService(LEICA_SERVICE).catch(() => null);
      const dist = svc && (await svc.getCharacteristic(LEICA_DISTANCE).catch(() => null));
      if (!svc || !dist) throw new Error('Dalmierz nie udostępnia znanej usługi pomiarów (Bosch ani Leica DISTO). Otwórz diagnostykę dalmierza i wyślij dziennik.');
      brand = 'leica';
      addLog({ kind: 'info', text: `Usługa pomiarów Leica DISTO (${LEICA_SERVICE})` });
      addLog({ kind: 'info', text: LEICA_NOTE });
      dist.addEventListener('characteristicvaluechanged', onValue);
      await dist.startNotifications();
      commandChar = await svc.getCharacteristic(LEICA_COMMAND).catch(() => null);
    }
  }

  if (commandChar && brand === 'bosch') await send(ENABLE_SYNC);
  set({ status: 'connected', deviceName: dev.name, brand, error: undefined, diagnostic });
}

function onDisconnected() {
  addLog({ kind: 'info', text: 'Rozłączono' });
  commandChar = null;
  if (manualDisconnect || !device) {
    set({ status: 'idle' });
    return;
  }
  void reconnect(device, state.diagnostic);
}

async function reconnect(dev: BtDevice, diagnostic: boolean) {
  set({ status: 'reconnecting' });
  for (const delay of [500, 1500, 4000]) {
    await new Promise((r) => setTimeout(r, delay));
    if (manualDisconnect || device !== dev) return;
    try {
      await setup(dev, diagnostic);
      return;
    } catch (e) {
      addLog({ kind: 'error', text: `Ponowne łączenie: ${errText(e)}` });
    }
  }
  set({ status: 'idle', error: 'Dalmierz się rozłączył (mógł się wyłączyć). Połącz ponownie.' });
}

/**
 * Wybór dalmierza i połączenie. Musi być wywołane z kliknięcia (wymóg przeglądarki).
 * diagnostic = pokaż wszystkie urządzenia BLE i nasłuchuj wszystkich charakterystyk.
 */
export async function connectLaser(opts: { diagnostic?: boolean; extraServices?: string[] } = {}) {
  const bt = getBluetooth();
  if (!bt) {
    set({ status: 'unsupported' });
    return;
  }
  const diagnostic = !!opts.diagnostic;
  set({ status: 'connecting', error: undefined });
  try {
    const optionalServices = [...(diagnostic ? DIAG_CANDIDATE_SERVICES : [...BOSCH_CHANNELS.map((c) => c.service), LEICA_SERVICE, 'battery_service', 'device_information']), ...(opts.extraServices ?? [])];
    const dev = await bt.requestDevice(
      diagnostic
        ? { acceptAllDevices: true, optionalServices }
        : {
            filters: [
              ...[...BOSCH_NAME_PREFIXES, ...LEICA_NAME_PREFIXES].map((namePrefix) => ({ namePrefix })),
              ...BOSCH_CHANNELS.map((c) => ({ services: [c.service] })),
              { services: [LEICA_SERVICE] },
            ],
            optionalServices,
          },
    );
    if (device && device !== dev) disconnectLaser();
    manualDisconnect = false;
    device = dev;
    dev.removeEventListener('gattserverdisconnected', onDisconnected);
    dev.addEventListener('gattserverdisconnected', onDisconnected);
    await setup(dev, diagnostic);
  } catch (e) {
    const msg = errText(e);
    const chosen = !!device;
    if (chosen) addLog({ kind: 'error', text: `${(e as Error)?.name ?? 'Błąd'}: ${(e as Error)?.message ?? msg}` });
    else if ((e as { name?: string })?.name !== 'NotFoundError') addLog({ kind: 'error', text: msg });
    // nieudane połączenie nie powinno uruchamiać automatycznych ponownych prób
    manualDisconnect = true;
    device?.gatt?.connected && device.gatt.disconnect();
    set({ status: 'idle', error: !chosen && (e as { name?: string })?.name === 'NotFoundError' ? undefined : msg });
  }
}

export function disconnectLaser() {
  manualDisconnect = true;
  device?.gatt?.disconnect();
  device = null;
  commandChar = null;
  set({ status: getBluetooth() ? 'idle' : 'unsupported', deviceName: undefined, brand: undefined });
}

/** Wysyła surowe bajty do charakterystyki poleceń (Bosch albo Leica; diagnostyka) */
export async function send(bytes: Uint8Array) {
  if (!commandChar) {
    addLog({ kind: 'error', text: 'Brak charakterystyki do zapisu' });
    return;
  }
  addLog({ kind: 'out', char: short(commandChar.uuid), bytes });
  try {
    await writeChar(commandChar, bytes);
  } catch (e) {
    addLog({ kind: 'error', text: `Zapis: ${errText(e)}` });
  }
}

