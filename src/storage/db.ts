import type { Project } from '../model/types';

const DB_NAME = 'rigipsiarz';
const DB_VERSION = 1;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const r = fn(t.objectStore(store));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export const listProjects = () =>
  tx<Project[]>('projects', 'readonly', (s) => s.getAll() as IDBRequest<Project[]>).then((l) =>
    l.sort((a, b) => b.updatedAt - a.updatedAt),
  );
export const getProject = (id: string) => tx<Project | undefined>('projects', 'readonly', (s) => s.get(id));
export const saveProject = (p: Project) => tx('projects', 'readwrite', (s) => s.put(p));
export const deleteProject = (id: string) => tx('projects', 'readwrite', (s) => s.delete(id));

export const getKV = <T>(key: string) => tx<T | undefined>('kv', 'readonly', (s) => s.get(key));
export const setKV = (key: string, value: unknown) => tx('kv', 'readwrite', (s) => s.put(value, key));

/** Prośba o trwałe przechowywanie, żeby przeglądarka nie usunęła projektów */
export async function requestPersistence() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {
    /* brak wsparcia */
  }
}
