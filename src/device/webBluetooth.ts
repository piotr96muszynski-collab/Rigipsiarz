// Minimalne typy Web Bluetooth (nie ma ich w lib.dom). Tylko to, czego używa aplikacja.

export interface BtCharacteristic extends EventTarget {
  uuid: string;
  value?: DataView;
  properties: { read: boolean; write: boolean; writeWithoutResponse: boolean; notify: boolean; indicate: boolean };
  startNotifications(): Promise<BtCharacteristic>;
  stopNotifications(): Promise<BtCharacteristic>;
  readValue(): Promise<DataView>;
  writeValue(v: BufferSource): Promise<void>;
  writeValueWithResponse?(v: BufferSource): Promise<void>;
  writeValueWithoutResponse?(v: BufferSource): Promise<void>;
}
export interface BtService {
  uuid: string;
  getCharacteristic(uuid: string): Promise<BtCharacteristic>;
  getCharacteristics(): Promise<BtCharacteristic[]>;
}
export interface BtServer {
  connected: boolean;
  connect(): Promise<BtServer>;
  disconnect(): void;
  getPrimaryService(uuid: string): Promise<BtService>;
  getPrimaryServices(): Promise<BtService[]>;
}
export interface BtDevice extends EventTarget {
  id: string;
  name?: string;
  gatt?: BtServer;
}
export interface BtRequestOptions {
  filters?: ({ services?: string[] } | { namePrefix: string } | { name: string })[];
  acceptAllDevices?: boolean;
  optionalServices?: string[];
}
export interface Bluetooth {
  requestDevice(o: BtRequestOptions): Promise<BtDevice>;
  getAvailability?(): Promise<boolean>;
}

export function getBluetooth(): Bluetooth | null {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator ? (navigator as unknown as { bluetooth: Bluetooth }).bluetooth : null;
}

/** Zapis z potwierdzeniem, a gdy charakterystyka go nie obsługuje – bez potwierdzenia */
export async function writeChar(c: BtCharacteristic, data: Uint8Array) {
  const buf = new Uint8Array(data) as Uint8Array<ArrayBuffer>;
  if (c.properties.write && c.writeValueWithResponse) return c.writeValueWithResponse(buf);
  if (c.properties.writeWithoutResponse && c.writeValueWithoutResponse) return c.writeValueWithoutResponse(buf);
  return c.writeValue(buf);
}
