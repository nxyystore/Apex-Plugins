import { Clipboard } from "@revenge-mod/externals/react-native-clipboard";
import { lookupModule } from "@revenge-mod/modules/finders";
import { withProps } from "@revenge-mod/modules/finders/filters";
import { Stores } from "@revenge-mod/discord/flux";
import { confirmDialog, showToast } from "./helpers";
import { addLog } from "./Logger";
import { simpleHash } from "./PasswordUtils";
import { readData, writeData, getAccounts } from "./storage";

// Lazy lookups - resolved on first call. All call sites are user-triggered
// actions, so the modules are guaranteed to be initialized by then.
const AuthActions = () =>
	lookupModule(withProps("login", "logout", "switchAccountToken"))[0];
const TokenManager = () => lookupModule(withProps("getToken"))[0];

export function getCurrentUser() {
	return Stores.UserStore.getCurrentUser();
}

export function getToken() {
	return TokenManager()?.getToken();
}

export async function switchToToken(token) {
	await AuthActions().switchAccountToken(token);
}

export async function logoutSession() {
	await lookupModule(withProps("login", "logout"))[0].logout();
}

export function exportAccounts(showPasswordDialog) {
	const checkPassword = (callback) => {
		if (readData()?.settings?.exportPasswordHash) {
			showPasswordDialog({
				type: "export",
				title: "Enter Export Password",
				message: "Enter your password to export accounts",
				callback: callback,
			});
		} else {
			callback();
		}
	};

	checkPassword(() => {
		confirmDialog({
			title: "⚠️ Export Accounts - Security Warning",
			message:
				"Exporting accounts is UNSAFE and may lead to account takeover if shared with others. The export contains sensitive authentication tokens that give full access to your accounts. Only proceed if you understand the risks and will keep the data secure.",
			confirmText: "I Understand - Export",
			onConfirm: async () => {
				try {
					addLog("info", "Starting account export");
					const accounts = getAccounts();
					const accountData = Object.values(accounts).map((account) => ({
						username: account.username,
						discriminator: account.discriminator,
						avatar: account.avatar,
						id: account.id,
						token: account.token,
						addedAt: account.addedAt || Date.now(),
					}));

					const exportData = {
						accounts: accountData,
						exportPasswordHash: readData()?.settings?.exportPasswordHash || null,
						exportedAt: Date.now(),
						version: "2.0",
					};

					Clipboard.setString(JSON.stringify(exportData, null, 2));
					addLog("info", "Accounts exported successfully", {
						count: accountData.length,
					});
					showToast(`Exported ${accountData.length} accounts to clipboard`);
				} catch (e) {
					addLog("error", "Failed to export accounts", { error: e.message });
					console.error("Export error:", e);
					showToast("Failed to export accounts", 1);
				}
			},
		});
	});
}

export function importAccounts(showPasswordDialog, importText) {
	const checkPassword = (callback) => {
		if (readData()?.settings?.exportPasswordHash) {
			showPasswordDialog({
				type: "import",
				title: "Enter Import Password",
				message: "Enter your password to import accounts",
				callback: callback,
			});
		} else {
			callback();
		}
	};

	checkPassword(() => {
		confirmDialog({
			title: "⚠️ Import Accounts - Security Warning",
			message:
				"Importing accounts is UNSAFE and may compromise your security if the data comes from untrusted sources. Only import data you exported yourself or from sources you completely trust. Malicious imports could lead to account takeover.",
			confirmText: "I Understand - Import",
			onConfirm: async () => {
				try {
					addLog("info", "Starting account import");
					let dataToImport = (importText ?? "").trim();
					if (!dataToImport) {
						try {
							dataToImport = ((await Clipboard.getString()) ?? "").trim();
						} catch (e) {
							addLog("error", "Failed to get clipboard data", {
								error: e.message,
							});
							showToast("No data in clipboard or input field", 1);
							return;
						}
					}

					if (!dataToImport) {
						addLog("warn", "No data to import");
						showToast("No data to import", 1);
						return;
					}

					const importData = JSON.parse(dataToImport);
					let accountsArray;
					let isNewFormat = false;

					if (
						importData.accounts &&
						Array.isArray(importData.accounts)
					) {
						const localHash = readData()?.settings?.exportPasswordHash;
						if (importData.exportPasswordHash) {
							if (
								!localHash ||
								localHash !== importData.exportPasswordHash
							) {
								addLog("error", "Import password mismatch");
								showToast(
									"Import password mismatch or not set locally",
									1,
								);
								return;
							}
						}
						accountsArray = importData.accounts;
						isNewFormat = true;
					} else if (Array.isArray(importData)) {
						accountsArray = importData;
						addLog("debug", "Using legacy import format");
					} else {
						addLog("error", "Invalid import format");
						showToast("Invalid import format", 1);
						return;
					}

					let importedCount = 0;
					let skippedCount = 0;

					await writeData((data) => {
						// Adopt a fresh export password hash from the import data
						if (
							isNewFormat &&
							importData.exportPasswordHash &&
							!data.settings.exportPasswordHash
						) {
							data.settings.exportPasswordHash =
								importData.exportPasswordHash;
							addLog(
								"info",
								"Import password hash set from import data",
							);
						}

						for (const accountData of accountsArray) {
							if (
								accountData.id &&
								accountData.token &&
								accountData.username
							) {
								if (!data.accounts[accountData.id]) {
									data.accounts[accountData.id] = {
										id: accountData.id,
										username: accountData.username,
										discriminator:
											accountData.discriminator || "0",
										avatar: accountData.avatar || null,
										displayName:
											accountData.displayName ||
											accountData.username,
										token: accountData.token,
										addedAt: accountData.addedAt || Date.now(),
									};

									if (
										!data.accountOrder.includes(accountData.id)
									) {
										data.accountOrder.push(accountData.id);
									}
									importedCount++;
								} else {
									skippedCount++;
								}
							}
						}
					});

					addLog("info", "Import completed", {
						imported: importedCount,
						skipped: skippedCount,
					});
					showToast(
						`Imported ${importedCount} accounts, skipped ${skippedCount} duplicates`,
					);
				} catch (e) {
					addLog("error", "Import failed", { error: e.message });
					console.error("Import error:", e);
					showToast(
						"Failed to import - invalid format or password mismatch",
						1,
					);
				}
			},
		});
	});
}

export async function setExportPassword(
	newPassword,
	confirmPassword,
	resetFields,
) {
	if (!newPassword.trim()) {
		showToast("Please enter a password", 1);
		return;
	}

	if (newPassword !== confirmPassword) {
		showToast("Passwords don't match", 1);
		return;
	}

	await writeData((data) => {
		data.settings.exportPasswordHash = simpleHash(newPassword);
	});
	resetFields?.();
	addLog("info", "Export password set successfully");
	showToast("Export password set successfully");
}

export function removeExportPassword(showPasswordDialog) {
	showPasswordDialog({
		type: "remove",
		title: "Enter Password to Remove",
		message: "Enter your current password to remove protection",
		callback: () => {
			confirmDialog({
				title: "Remove Export Password",
				message:
					"Are you sure you want to remove the export password? This will make exports/imports less secure.",
				confirmText: "Remove Password",
				destructive: true,
				onConfirm: async () => {
					await writeData((data) => {
						delete data.settings.exportPasswordHash;
					});
					addLog("info", "Export password removed");
					showToast("Export password removed");
				},
			});
		},
	});
}

export async function addAccountWithToken(tokenInput) {
	if (!readData()?.settings?.enableUnsafeFeatures) {
		showToast("Unsafe features are disabled", 1);
		return false;
	}

	addLog("info", "Starting token account addition");

	try {
		let token = (tokenInput ?? "").trim();
		if (!token) {
			token = getToken();
			addLog("debug", "Using current account token");
		}

		if (
			!token.startsWith("Bot ") &&
			!token.match(/^[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27,}$/)
		) {
			addLog("error", "Invalid token format provided");
			showToast("Invalid token format", 1);
			return false;
		}

		addLog("debug", "Fetching user info from Discord API");
		const response = await fetch("https://discord.com/api/v9/users/@me", {
			headers: {
				Authorization: token,
				"Content-Type": "application/json",
			},
		});

		if (!response.ok) {
			addLog("error", "Discord API request failed", {
				status: response.status,
				statusText: response.statusText,
			});
			showToast("Invalid or expired token", 1);
			return false;
		}

		const user = await response.json();
		addLog("info", "Successfully retrieved user info", {
			username: user.username,
			id: user.id,
		});

		if (getAccounts()[user.id]) {
			addLog("warn", "Account already exists", { username: user.username });
			showToast(`Account ${user.username} already saved`, 1);
			return false;
		}

		await writeData((data) => {
			data.accounts[user.id] = {
				id: user.id,
				username: user.username,
				discriminator: user.discriminator,
				avatar: user.avatar,
				displayName: user.global_name || user.username,
				token: token,
				addedAt: Date.now(),
			};
			if (!data.accountOrder.includes(user.id)) {
				data.accountOrder.push(user.id);
			}
		});

		addLog("info", "Account added successfully via token", {
			username: user.username,
		});
		showToast(`Account ${user.username} added!`);
		return true;
	} catch (e) {
		addLog("error", "Failed to add account via token", {
			error: e.message,
			stack: e.stack,
		});
		console.error("Add account error:", e);
		showToast("Failed to add account", 1);
		return false;
	}
}

export function forceLogout() {
	confirmDialog({
		title: "Force Logout",
		message:
			"This will logout your current session by using an invalid token. Your saved accounts will remain intact. Continue?",
		confirmText: "Force Logout",
		destructive: true,
		onConfirm: async () => {
			try {
				addLog("info", "Starting force logout");
				const fakeToken =
					"MTx.GxxxXx.xXxXxXxXxXxXxXxXxXxXxXxXxXxXxXx";
				await switchToToken(fakeToken);
				addLog("info", "Force logout completed successfully");
				showToast(
					"Force logout successful - you can now login to a different account",
				);
			} catch (e) {
				addLog("warn", "Force logout completed with error", {
					error: e.message,
				});
				console.error("Force logout error:", e);
				showToast("Force logout completed");
			}
		},
	});
}

export async function addAccountWithCredentials(email, password) {
	if (!email.trim() || !password.trim()) {
		showToast("Please enter both email and password", 1);
		return false;
	}

	addLog("info", "Starting credential-based account addition", {
		email: email.trim(),
	});

	try {
		const response = await fetch("https://discord.com/api/v9/auth/login", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"User-Agent":
					"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
			},
			body: JSON.stringify({
				login: email.trim(),
				password: password.trim(),
			}),
		});

		const loginData = await response.json();

		if (!response.ok || !loginData.token) {
			addLog("error", "Discord login failed", {
				status: response.status,
				message: loginData.message,
				errors: loginData.errors,
				captchaRequired: !!loginData.captcha_key,
			});

			let errorMessage = "Login failed";

			if (loginData.captcha_key) {
				errorMessage = "Captcha required - please login through Discord first";
			} else if (loginData.message) {
				const msg = loginData.message.toLowerCase();
				if (
					msg.includes("invalid") &&
					(msg.includes("email") ||
						msg.includes("phone") ||
						msg.includes("login"))
				) {
					errorMessage = "Invalid email or username";
				} else if (msg.includes("password")) {
					errorMessage = "Invalid password";
				} else if (msg.includes("account")) {
					errorMessage = "Account issue - check your credentials";
				} else if (msg.includes("rate limit") || msg.includes("too many")) {
					errorMessage = "Too many attempts - please wait and try again";
				} else if (
					msg.includes("mfa") ||
					msg.includes("2fa") ||
					msg.includes("verification")
				) {
					errorMessage = "2FA/MFA accounts not supported via credentials";
				} else {
					errorMessage = "Login failed - check your credentials";
				}
			} else if (loginData.errors) {
				const errors = loginData.errors;
				if (errors.login) {
					errorMessage = "Invalid email or username";
				} else if (errors.password) {
					errorMessage = "Invalid password";
				} else {
					errorMessage = "Invalid credentials";
				}
			} else if (response.status === 401) {
				errorMessage = "Invalid credentials";
			} else if (response.status === 429) {
				errorMessage = "Rate limited - please wait and try again";
			} else if (response.status >= 500) {
				errorMessage =
					"Discord servers are having issues - try again later";
			}

			showToast(errorMessage, 1);
			return false;
		}

		addLog("debug", "Login successful, fetching user info");
		const userResponse = await fetch("https://discord.com/api/v9/users/@me", {
			headers: { Authorization: loginData.token },
		});

		if (!userResponse.ok) {
			addLog("error", "Failed to get user info after login", {
				status: userResponse.status,
			});
			showToast("Login succeeded but failed to get user info - check logs", 1);
			return false;
		}

		const user = await userResponse.json();

		if (getAccounts()[user.id]) {
			addLog("warn", "Account already exists", { username: user.username });
			showToast(`Account ${user.username} already saved`, 1);
			return false;
		}

		await writeData((data) => {
			data.accounts[user.id] = {
				id: user.id,
				username: user.username,
				discriminator: user.discriminator,
				avatar: user.avatar,
				displayName: user.global_name || user.username,
				token: loginData.token,
				addedAt: Date.now(),
			};
			if (!data.accountOrder.includes(user.id)) {
				data.accountOrder.push(user.id);
			}
		});

		addLog("info", "Account added successfully via credentials", {
			username: user.username,
		});
		showToast(`Account ${user.username} added successfully!`);
		return true;
	} catch (e) {
		addLog("error", "Credential login failed", {
			error: e.message,
			stack: e.stack,
		});
		console.error("Login error:", e);

		let errorMessage = "Login failed - check logs for more info";
		if (e.message.includes("network") || e.message.includes("fetch")) {
			errorMessage = "Network error - check your connection";
		} else if (e.message.includes("timeout")) {
			errorMessage = "Request timed out - try again";
		}

		showToast(errorMessage, 1);
		return false;
	}
}
