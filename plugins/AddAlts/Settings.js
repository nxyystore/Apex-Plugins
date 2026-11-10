import { Design } from "@revenge-mod/discord/design";
import { React, ReactNative } from "@revenge-mod/react";
import { Clipboard } from "@revenge-mod/externals/react-native-clipboard";
import { confirmDialog, showToast } from "./helpers";
import { getPluginStorage, writeData } from "./storage";
import { addLog, getLogs, clearLogs } from "./Logger";

const { TableRowGroup, TableSwitchRow, TableRow } = Design;

async function updateSetting(key, value) {
	await writeData((data) => {
		data.settings[key] = value;
	});
	addLog("info", `Setting updated: ${key}`, { newValue: value });
}

function copyLogs() {
	const logs = getLogs();
	const logsText = logs
		.map(
			(log) =>
				`[${log.timestamp}] ${log.type.toUpperCase()}: ${log.message}${
					log.data ? " | Data: " + JSON.stringify(log.data) : ""
				}`,
		)
		.join("\n");
	Clipboard.setString(logsText);
	addLog("info", "Logs copied to clipboard", { count: logs.length });
	showToast(`Copied ${logs.length} log entries to clipboard`);
}

function enableUnsafeFeatures(value) {
	if (value) {
		confirmDialog({
			title: "⚠️ Enable Unsafe Features - Security Warning",
			message:
				"Unsafe features include token copying, manual token adding, and detailed logging. These features can compromise your account security if misused. Tokens provide full access to accounts and should never be shared. Only enable if you understand the security implications.",
			confirmText: "I Understand - Enable",
			onConfirm: () => updateSetting("enableUnsafeFeatures", true),
		});
	} else {
		updateSetting("enableUnsafeFeatures", false);
	}
}

// Revenge plugin settings page (rendered by the plugin management UI)
export default function PluginSettings({ api }) {
	const storage = api?.jsonStorage ?? getPluginStorage();
	const data = storage.use();

	// use() returns undefined until the storage file is loaded
	if (!data) return null;

	const settings = data.settings;

	return React.createElement(
		ReactNative.ScrollView,
		{ style: { flex: 1 }, contentContainerStyle: { padding: 8 } },
		React.createElement(
			TableRowGroup,
			{ title: "General" },
			React.createElement(TableSwitchRow, {
				key: "sidebar",
				label: "Add to settings sidebar",
				subLabel:
					"Show Account Switcher in Discord's settings (restart app to apply)",
				value: settings.addToSidebar,
				onValueChange: (v) => {
					updateSetting("addToSidebar", v);
					showToast("Restart app to apply");
				},
			}),
			React.createElement(TableSwitchRow, {
				key: "confirm",
				label: "Confirm before delete",
				subLabel: "Ask what to do when removing a saved account",
				value: settings.confirmBeforeDelete,
				onValueChange: (v) => updateSetting("confirmBeforeDelete", v),
			}),
			React.createElement(TableSwitchRow, {
				key: "native",
				label: "Native multi-account switcher",
				subLabel:
					"Unlocks Discord's built-in account switcher (restart app to apply)",
				value: settings.enableNativeSwitcher,
				onValueChange: (v) => {
					updateSetting("enableNativeSwitcher", v);
					showToast("Restart app to apply");
				},
			}),
		),
		React.createElement(
			TableRowGroup,
			{ title: "Unsafe features" },
			React.createElement(TableSwitchRow, {
				key: "unsafe",
				label: "Enable unsafe features",
				subLabel:
					"Allows token operations, detailed logging, and troubleshooting",
				value: settings.enableUnsafeFeatures,
				onValueChange: enableUnsafeFeatures,
			}),
			settings.enableUnsafeFeatures
				? React.createElement(
						React.Fragment,
						{},
						React.createElement(TableRow, {
							key: "copy-logs",
							label: `Copy logs (${getLogs().length})`,
							onPress: copyLogs,
						}),
						React.createElement(TableRow, {
							key: "clear-logs",
							label: "Clear logs",
							onPress: () => {
								clearLogs();
								showToast("Logs cleared");
							},
						}),
					)
				: null,
		),
	);
}
