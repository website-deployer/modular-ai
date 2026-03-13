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

// Cloud Sync Helpers
const syncNoteToCloud = async (note: Note) => {
    try {
        await fetch('/api/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(note)
        });
    } catch (err) {
        console.error("Cloud sync failed (save)", err);
    }
};

const deleteNoteFromCloud = async (id: string) => {
    try {
        await fetch('/api/notes', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
    } catch (err) {
        console.error("Cloud sync failed (delete)", err);
    }
};

export const saveNote = async (note: Note): Promise<void> => {
    const db = await openDB();
    // Save locally first
    await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction([NOTES_STORE], 'readwrite');
        const store = transaction.objectStore(NOTES_STORE);
        const request = store.put(note);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
    // Sync to cloud in background
    syncNoteToCloud(note);
};

export const deleteNote = async (id: string): Promise<void> => {
    const db = await openDB();
    // Delete locally
    await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction([NOTES_STORE], 'readwrite');
        const store = transaction.objectStore(NOTES_STORE);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
    // Sync to cloud in background
    deleteNoteFromCloud(id);
};

export const getAllNotes = async (): Promise<Note[]> => {
    const db = await openDB();
    const localNotes = await new Promise<Note[]>((resolve, reject) => {
        const transaction = db.transaction([NOTES_STORE], 'readonly');
        const store = transaction.objectStore(NOTES_STORE);
        const request = store.getAll();
        request.onsuccess = () => resolve((request.result as Note[]) || []);
        request.onerror = () => reject(request.error);
    });

    // If local is empty, try to fetch from cloud (one-time sync)
    if (localNotes.length === 0) {
        try {
            const res = await fetch('/api/notes');
            if (res.ok) {
                const cloudNotes = await res.json();
                if (cloudNotes && cloudNotes.length > 0) {
                    // Map back from snake_case to camelCase
                    const mappedNotes: Note[] = cloudNotes.map((n: any) => ({
                        ...n,
                        isBookmarked: n.is_bookmarked,
                        lastAccessed: n.last_accessed,
                        sourceData: n.source_data
                    }));
                    
                    // Save to local for next time
                    for (const note of mappedNotes) {
                        const transaction = db.transaction([NOTES_STORE], 'readwrite');
                        transaction.objectStore(NOTES_STORE).put(note);
                    }
                    
                    mappedNotes.sort((a, b) => {
                        const dateA = a.lastAccessed ? new Date(a.lastAccessed).getTime() : 0;
                        const dateB = b.lastAccessed ? new Date(b.lastAccessed).getTime() : 0;
                        return dateB - dateA;
                    });
                    return mappedNotes;
                }
            }
        } catch (err) {
            console.error("Cloud fetch failed", err);
        }
    }

    localNotes.sort((a, b) => {
        const dateA = a.lastAccessed ? new Date(a.lastAccessed).getTime() : 0;
        const dateB = b.lastAccessed ? new Date(b.lastAccessed).getTime() : 0;
        return dateB - dateA;
    });
    return localNotes;
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
