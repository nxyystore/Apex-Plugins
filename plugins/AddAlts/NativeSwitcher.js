import { after } from "@revenge-mod/patcher";
import { getModules } from "@revenge-mod/modules/finders";
import { withProps } from "@revenge-mod/modules/finders/filters";
import { getStore } from "@revenge-mod/discord/flux";
import { readData } from "./storage";

/**
 * Forces Discord's own native multi-account switcher to be usable,
 * regardless of how many accounts are actually signed in.
 */
export function startNativeSwitcher() {
	if (!readData()?.settings?.enableNativeSwitcher) {
		return () => {};
	}

	const unpatches = [];

	// Force getCanUseMultiAccountMobile() to true. `getModules` fires
	// immediately if the module is already initialized, otherwise when it
	// initializes.
	getModules(withProps("getCanUseMultiAccountMobile"), (dispatcher) => {
		// after hooks receive (args, ret, self) and must return the return value
		unpatches.push(
			after(dispatcher, "getCanUseMultiAccountMobile", () => true),
		);
	});

	// Expose multi-account notifications on the store
	getStore("MultiAccountStore", (store) => {
		Object.defineProperty(store, "canUseMultiAccountNotifications", {
			get: () => true,
			configurable: true,
		});
		unpatches.push(() => {
			delete store.canUseMultiAccountNotifications;
		});
	});

	return () => {
		for (const unpatch of unpatches) unpatch();
	};
}
