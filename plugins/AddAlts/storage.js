// Per-plugin JSON storage (storage.json inside the plugin's data directory),
// created by the Revenge Plugin API plugin and passed to us in `start`.
let jsonStorage = null;

export function initPluginStorage(instance) {
	jsonStorage = instance;
}

export function getPluginStorage() {
	if (!jsonStorage) {
		throw new Error("[MoreAlts] Plugin storage accessed before plugin start");
	}
	return jsonStorage;
}

/** Synchronous read of the persisted data (immutable cache view). */
export function readData() {
	return getPluginStorage().cache;
}

/**
 * Applies `mutator(data)` to a deep clone of the current data and persists
 * the whole snapshot (jsonStorage.set() in replace mode, since merge mode
 * cannot delete keys).
 */
export async function writeData(mutator) {
	const storage = getPluginStorage();
	const data = JSON.parse(JSON.stringify(storage.cache ?? {}));
	mutator(data);
	await storage.set(data, true);
}

// Convenience getters used across modules
export function getAccounts() {
	return readData()?.accounts ?? {};
}

export function getAccountOrder() {
	return readData()?.accountOrder ?? [];
}

export function getSettings() {
	return readData()?.settings ?? {};
}
