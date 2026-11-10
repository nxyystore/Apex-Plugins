import {
	onSettingsModulesLoaded,
	registerSettingsSection,
	registerSettingsItem,
} from "@revenge-mod/discord/modules/settings";
import { getAssetIdByName } from "@revenge-mod/assets";
import { React, ReactNative } from "@revenge-mod/react";
import { initPluginStorage } from "./storage";
import { startNativeSwitcher } from "./NativeSwitcher";
import PluginSettings from "./Settings";
import AccountsManager from "./AccountsManager";

function UserSettingsIcon() {
	return React.createElement(ReactNative.Image, {
		source: getAssetIdByName("UserIcon"),
		style: { width: 24, height: 24 },
	});
}

export default plugin({
	// Eagerly load storage.json with the same shape as the old Vendetta
	// storage, extended with the Revenge-native settings keys.
	jsonStorage: {
		load: true,
		default: {
			accounts: {},
			accountOrder: [],
			settings: {
				addToSidebar: true,
				confirmBeforeDelete: true,
				enableUnsafeFeatures: false,
				enableNativeSwitcher: true,
			},
		},
	},

	start({ cleanup, jsonStorage }) {
		initPluginStorage(jsonStorage);

		// Unlock Discord's native multi-account switcher (no-op when disabled)
		cleanup(startNativeSwitcher());

		// Register "Account Switcher" in Discord's native settings navigator
		if (jsonStorage.cache?.settings?.addToSidebar !== false) {
			cleanup(
				onSettingsModulesLoaded(() => {
					cleanup(
						registerSettingsSection("MORE_ALTS", {
							label: "More Alts!",
							settings: ["MORE_ALTS_MANAGER"],
						}),
						registerSettingsItem("MORE_ALTS_MANAGER", {
							type: "route",
							title: () => "More Alts!",
							IconComponent: UserSettingsIcon,
							screen: {
								route: "MoreAltsAccountManager",
								getComponent: () => AccountsManager,
							},
						}),
					);
				}),
			);
		}
	},

	// Rendered by Revenge's plugin management UI
	SettingsComponent: PluginSettings,
});
