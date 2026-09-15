export const STORES = ['child', 'sleeps', 'wakings', 'milestones', 'adjustments'];
const DB_VERSION = 1;

export function openDb(name = 'baby-sleep') {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) {
        if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, storeName, mode) {
  return db.transaction(storeName, mode).objectStore(storeName);
}

export function put(db, storeName, record) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(storeName, 'readwrite');
    t.objectStore(storeName).put(record);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export function get(db, storeName, id) {
  return new Promise((resolve, reject) => {
    const r = tx(db, storeName, 'readonly').get(id);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export function getAll(db, storeName) {
  return new Promise((resolve, reject) => {
    const r = tx(db, storeName, 'readonly').getAll();
    r.onsuccess = () => resolve(r.result ?? []);
    r.onerror = () => reject(r.error);
  });
}

export function clearAll(db) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORES, 'readwrite');
    for (const s of STORES) t.objectStore(s).clear();
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}
