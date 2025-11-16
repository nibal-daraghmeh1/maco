// IndexedDB wrapper module
// Provides a localStorage-like API using IndexedDB for better storage capacity and performance

const DB_NAME = 'macoAppDB';
const DB_VERSION = 2; // Increment version to add SOP files store
const STORE_NAME = 'keyValueStore';
const SOP_FILES_STORE = 'sopFilesStore';

let dbInstance = null;

/**
 * Initialize IndexedDB database
 * @returns {Promise<IDBDatabase>}
 */
function initDB() {
    return new Promise((resolve, reject) => {
        if (dbInstance) {
            resolve(dbInstance);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('IndexedDB error:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            dbInstance = request.result;
            resolve(dbInstance);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
            // Create SOP files store if it doesn't exist
            if (!db.objectStoreNames.contains(SOP_FILES_STORE)) {
                db.createObjectStore(SOP_FILES_STORE);
            }
        };
    });
}

/**
 * Get item from IndexedDB (localStorage-like API)
 * @param {string} key
 * @returns {Promise<string|null>}
 */
export async function getItem(key) {
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(key);

            request.onsuccess = () => {
                resolve(request.result || null);
            };

            request.onerror = () => {
                console.error(`Error getting item ${key}:`, request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error(`Error in getItem for ${key}:`, error);
        // Fallback to localStorage for backward compatibility
        try {
            return localStorage.getItem(key);
        } catch (e) {
            return null;
        }
    }
}

/**
 * Set item in IndexedDB (localStorage-like API)
 * @param {string} key
 * @param {string} value
 * @returns {Promise<void>}
 */
export async function setItem(key, value) {
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(value, key);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                console.error(`Error setting item ${key}:`, request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error(`Error in setItem for ${key}:`, error);
        // Fallback to localStorage for backward compatibility
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            console.error('Failed to save to both IndexedDB and localStorage:', e);
        }
    }
}

/**
 * Remove item from IndexedDB (localStorage-like API)
 * @param {string} key
 * @returns {Promise<void>}
 */
export async function removeItem(key) {
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(key);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                console.error(`Error removing item ${key}:`, request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error(`Error in removeItem for ${key}:`, error);
        // Fallback to localStorage for backward compatibility
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.error('Failed to remove from both IndexedDB and localStorage:', e);
        }
    }
}

/**
 * Clear all items from IndexedDB
 * @returns {Promise<void>}
 */
export async function clear() {
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear();

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                console.error('Error clearing IndexedDB:', request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error('Error in clear:', error);
        // Fallback to localStorage for backward compatibility
        try {
            localStorage.clear();
        } catch (e) {
            console.error('Failed to clear both IndexedDB and localStorage:', e);
        }
    }
}

/**
 * Get all keys from IndexedDB
 * @returns {Promise<string[]>}
 */
export async function getAllKeys() {
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAllKeys();

            request.onsuccess = () => {
                resolve(request.result.map(key => String(key)));
            };

            request.onerror = () => {
                console.error('Error getting all keys:', request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error('Error in getAllKeys:', error);
        // Fallback to localStorage for backward compatibility
        try {
            return Object.keys(localStorage);
        } catch (e) {
            return [];
        }
    }
}

/**
 * Migrate data from localStorage to IndexedDB
 * @returns {Promise<void>}
 */
export async function migrateFromLocalStorage() {
    try {
        const keys = Object.keys(localStorage);
        if (keys.length === 0) {
            return;
        }

        console.log(`Migrating ${keys.length} items from localStorage to IndexedDB...`);
        
        for (const key of keys) {
            try {
                const value = localStorage.getItem(key);
                if (value !== null) {
                    await setItem(key, value);
                }
            } catch (e) {
                console.error(`Error migrating key ${key}:`, e);
            }
        }

        console.log('Migration completed successfully');
    } catch (error) {
        console.error('Error during migration:', error);
    }
}

/**
 * Check if IndexedDB is available
 * @returns {boolean}
 */
export function isAvailable() {
    return typeof indexedDB !== 'undefined';
}

/**
 * Store SOP file in IndexedDB
 * @param {string} machineId - Machine ID
 * @param {string} fileName - File name
 * @param {string} fileData - Base64 encoded file data
 * @returns {Promise<void>}
 */
export async function storeSOPFile(machineId, fileName, fileData) {
    try {
        const db = await initDB();
        const key = `sop_${machineId}`;
        const fileInfo = {
            fileName: fileName,
            fileData: fileData,
            machineId: machineId,
            timestamp: Date.now()
        };
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([SOP_FILES_STORE], 'readwrite');
            const store = transaction.objectStore(SOP_FILES_STORE);
            const request = store.put(fileInfo, key);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                console.error(`Error storing SOP file for machine ${machineId}:`, request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error(`Error in storeSOPFile for machine ${machineId}:`, error);
        throw error;
    }
}

/**
 * Get SOP file from IndexedDB
 * @param {string} machineId - Machine ID
 * @returns {Promise<{fileName: string, fileData: string}|null>}
 */
export async function getSOPFile(machineId) {
    try {
        const db = await initDB();
        const key = `sop_${machineId}`;
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([SOP_FILES_STORE], 'readonly');
            const store = transaction.objectStore(SOP_FILES_STORE);
            const request = store.get(key);

            request.onsuccess = () => {
                const result = request.result;
                if (result) {
                    resolve({
                        fileName: result.fileName,
                        fileData: result.fileData
                    });
                } else {
                    resolve(null);
                }
            };

            request.onerror = () => {
                console.error(`Error getting SOP file for machine ${machineId}:`, request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error(`Error in getSOPFile for machine ${machineId}:`, error);
        return null;
    }
}

/**
 * Delete SOP file from IndexedDB
 * @param {string} machineId - Machine ID
 * @returns {Promise<void>}
 */
export async function deleteSOPFile(machineId) {
    try {
        const db = await initDB();
        const key = `sop_${machineId}`;
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([SOP_FILES_STORE], 'readwrite');
            const store = transaction.objectStore(SOP_FILES_STORE);
            const request = store.delete(key);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                console.error(`Error deleting SOP file for machine ${machineId}:`, request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error(`Error in deleteSOPFile for machine ${machineId}:`, error);
    }
}

