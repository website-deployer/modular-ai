import { Note, AppSettings } from '../types';

const DB_NAME = 'ModularAINotesDB';
const DB_VERSION = 1;
const NOTES_STORE = 'notes';
const SETTINGS_STORE = 'settings';

const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(NOTES_STORE)) {
                db.createObjectStore(NOTES_STORE, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
                db.createObjectStore(SETTINGS_STORE, { keyPath: 'id' });
            }
        };

        request.onsuccess = () => resolve(request.result);
    });
};

export const initDB = async (): Promise<void> => {
    await openDB();
};

export const saveNote = async (note: Note): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([NOTES_STORE], 'readwrite');
        const store = transaction.objectStore(NOTES_STORE);
        const request = store.put(note);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

export const deleteNote = async (id: string): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([NOTES_STORE], 'readwrite');
        const store = transaction.objectStore(NOTES_STORE);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

export const getAllNotes = async (): Promise<Note[]> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([NOTES_STORE], 'readonly');
        const store = transaction.objectStore(NOTES_STORE);
        const request = store.getAll();
        request.onsuccess = () => {
            // Sort by lastAccessed descending
            const notes = (request.result as Note[]) || [];
            if (notes && Array.isArray(notes)) {
                notes.sort((a, b) => {
                    const dateA = a.lastAccessed ? new Date(a.lastAccessed).getTime() : 0;
                    const dateB = b.lastAccessed ? new Date(b.lastAccessed).getTime() : 0;
                    return dateB - dateA;
                });
                resolve(notes);
            } else {
                resolve([]);
            }
        };
        request.onerror = () => reject(request.error);
    });
};

export const saveSettings = async (settings: AppSettings): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([SETTINGS_STORE], 'readwrite');
        const store = transaction.objectStore(SETTINGS_STORE);
        const request = store.put({ id: 'app_settings', ...settings });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

export const getSettings = async (): Promise<AppSettings | null> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([SETTINGS_STORE], 'readonly');
        const store = transaction.objectStore(SETTINGS_STORE);
        const request = store.get('app_settings');
        request.onsuccess = () => {
            if (request.result) {
                const { id, ...settings } = request.result;
                resolve(settings as AppSettings);
            } else {
                resolve(null);
            }
        };
        request.onerror = () => reject(request.error);
    });
};

export const deleteNotesBefore = async (date: Date): Promise<number> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([NOTES_STORE], 'readwrite');
        const store = transaction.objectStore(NOTES_STORE);
        const request = store.getAll();
        
        request.onsuccess = () => {
            const notes = request.result as Note[];
            let deletedCount = 0;
            const deletePromises: Promise<void>[] = [];

            notes.forEach(note => {
                const lastAccessed = note.lastAccessed ? new Date(note.lastAccessed) : new Date(0);
                if (lastAccessed < date) {
                    const deleteReq = store.delete(note.id);
                    deletePromises.push(new Promise((res, rej) => {
                        deleteReq.onsuccess = () => {
                            deletedCount++;
                            res();
                        };
                        deleteReq.onerror = () => rej(deleteReq.error);
                    }));
                }
            });

            Promise.all(deletePromises)
                .then(() => resolve(deletedCount))
                .catch(err => reject(err));
        };
        request.onerror = () => reject(request.error);
    });
};

export const clearAllNotes = async (): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([NOTES_STORE], 'readwrite');
        const store = transaction.objectStore(NOTES_STORE);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

export const migrateFromLocalStorage = async (): Promise<boolean> => {
    try {
        const localNotes = localStorage.getItem('app_notes');
        const localSettings = localStorage.getItem('app_settings');
        
        let migrated = false;

        if (localNotes) {
            const notes = JSON.parse(localNotes) as Note[];
            for (const note of notes) {
                await saveNote(note);
            }
            localStorage.removeItem('app_notes');
            migrated = true;
        }

        if (localSettings) {
            const settings = JSON.parse(localSettings) as AppSettings;
            await saveSettings(settings);
            localStorage.removeItem('app_settings');
            migrated = true;
        }
        
        return migrated;
    } catch (e) {
        console.error("Migration failed", e);
        return false;
    }
};
