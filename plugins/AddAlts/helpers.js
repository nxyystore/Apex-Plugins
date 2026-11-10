import { ToastActionCreators } from "@revenge-mod/discord/actions";
import { ReactNative } from "@revenge-mod/react";

/**
 * Shows a toast. Tries the modern (key, options) signature first and falls
 * back to the legacy single-object signature on older Discord versions.
 */
export function showToast(text, critical = false) {
	const key = "morealts.toast";
	try {
		ToastActionCreators.open(key, {
			text,
			variant: critical ? "critical" : "default",
		});
	} catch {
		try {
			ToastActionCreators.open({ key, content: text });
		} catch (e) {
			console.warn("[MoreAlts] Failed to show toast:", e);
		}
	}
}

/**
 * Confirmation dialog built on React Native's Alert (no Discord internals
 * to survive app updates).
 */
export function confirmDialog({
	title,
	message,
	confirmText = "Confirm",
	cancelText = "Cancel",
	destructive = false,
	onConfirm,
	onCancel,
}) {
	ReactNative.Alert.alert(title, message, [
		{ text: cancelText, style: "cancel", onPress: onCancel },
		{
			text: confirmText,
			style: destructive ? "destructive" : "default",
			onPress: onConfirm,
		},
	]);
}

/** Formats a stored account for display. */
export function formatAccountName(account) {
	if (!account || !account.username) return "Unknown Account";
	return account.displayName || account.username;
}
