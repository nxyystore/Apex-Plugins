import { React, ReactNative } from "@revenge-mod/react";
import { Clipboard } from "@revenge-mod/externals/react-native-clipboard";
import { showToast, formatAccountName } from "./helpers";
import { addLog } from "./Logger";
import { readData, writeData, getPluginStorage } from "./storage";
import { PasswordPrompt } from "./PassPrompt";
import {
	exportAccounts,
	importAccounts,
	setExportPassword,
	removeExportPassword,
	addAccountWithToken,
	addAccountWithCredentials,
	forceLogout,
	switchToToken,
	logoutSession,
	getCurrentUser,
	getToken,
} from "./AccountActions";

const { ScrollView, View, Text, TextInput, TouchableOpacity, Image, Alert } =
	ReactNative;

const COLORS = {
	bg: "#2f3136",
	header: "#202225",
	border: "#40444b",
	input: "#40444b",
	text: "#ffffff",
	subtext: "#b9bbbe",
	muted: "#72767d",
	accent: "#7289da",
	accentPressed: "#5c6bc0",
	green: "#43b581",
	red: "#f04747",
	neutral: "#36393f",
	neutralAccent: "#4f545c",
	currentRowBg: "#7289da20",
};

export default function AccountsManager() {
	const data = getPluginStorage().use();

	const settings = data?.settings ?? {};
	const accounts = data?.accounts ?? {};
	const accountOrder = data?.accountOrder ?? [];

	const currentUserId = getCurrentUser()?.id;

	const [showAddDialog, setShowAddDialog] = React.useState(false);
	const [showPasswordDialog, setShowPasswordDialog] = React.useState(null);
	const [switchingTo, setSwitchingTo] = React.useState(null);
	const [email, setEmail] = React.useState("");
	const [password, setPassword] = React.useState("");
	const [tokenInput, setTokenInput] = React.useState("");
	const [isAdding, setIsAdding] = React.useState(false);
	const [importText, setImportText] = React.useState("");
	const [newPassword, setNewPassword] = React.useState("");
	const [confirmPassword, setConfirmPassword] = React.useState("");

	const orderedAccounts = accountOrder
		.filter((id) => accounts[id])
		.map((id) => accounts[id]);

	const handlePasswordCancel = () => setShowPasswordDialog(null);

	const handlePasswordSuccess = () => {
		const callback = showPasswordDialog.callback;
		setShowPasswordDialog(null);
		callback();
	};

	const removeAccount = (accountId) => {
		const account = accounts[accountId];
		if (!account) return;

		const isCurrent = accountId === currentUserId;
		const accountName = formatAccountName(account);
		addLog("info", "Attempting to remove account", {
			username: accountName,
			isCurrent,
		});

		const deleteFromStorage = () =>
			writeData((data) => {
				delete data.accounts[accountId];
				data.accountOrder = data.accountOrder.filter(
					(id) => id !== accountId,
				);
			});

		const removeFromSwitcherOnly = async () => {
			await deleteFromStorage();
			addLog("info", "Account removed from switcher only", {
				username: accountName,
			});
			showToast(`Account ${accountName} removed from switcher`);
		};

		const logoutAndDelete = async () => {
			try {
				addLog("info", "Starting account removal and logout", {
					username: accountName,
				});
				const currentToken = getToken();

				await switchToToken(account.token);
				addLog("debug", "Switched to account for logout");

				await logoutSession();
				addLog("debug", "Account logged out from Discord");

				setTimeout(async () => {
					try {
						await switchToToken(currentToken);
						addLog("debug", "Switched back to original account");
					} catch (e) {
						addLog("warn", "Could not switch back to original account", {
							error: e.message,
						});
					}
				}, 100);
			} catch (e) {
				addLog("error", "Failed to logout account from Discord", {
					error: e.message,
				});
				showToast("Failed to logout, but removed from switcher", 1);
			}

			await deleteFromStorage();
			addLog("info", "Account removed and logged out", {
				username: accountName,
			});
			showToast(`Account ${accountName} removed and logged out`);
		};

		if (settings.confirmBeforeDelete) {
			Alert.alert(
				isCurrent ? "Remove Current Account" : "Remove Account",
				isCurrent
					? "Do you want to remove the current account from the switcher? (To logout, use Force Logout in the tools below)"
					: `What do you want to do with ${accountName}?`,
				[
					{ text: "Cancel", style: "cancel" },
					{
						text: "Remove from switcher only",
						onPress: removeFromSwitcherOnly,
					},
					!isCurrent && {
						text: "Remove and logout",
						style: "destructive",
						onPress: logoutAndDelete,
					},
				].filter(Boolean),
			);
		} else {
			if (isCurrent) removeFromSwitcherOnly();
			else logoutAndDelete();
		}
	};

	const switchToAccount = async (accountId) => {
		const account = accounts[accountId];
		if (!account) return;
		setSwitchingTo(accountId);

		addLog("info", "Starting account switch", {
			username: account.username,
		});

		try {
			showToast(`Switching to ${formatAccountName(account)}...`);
			await switchToToken(account.token);
			addLog("info", "Account switch successful", {
				username: account.username,
			});
			showToast(`Switched to ${formatAccountName(account)}!`);
		} catch (e) {
			addLog("error", "Account switch failed", {
				username: account.username,
				error: e.message,
			});
			console.error("Switch error:", e);
			showToast(`Failed to switch: ${e.message}`, 1);
		}
		setSwitchingTo(null);
	};

	const copyToken = (accountId) => {
		if (!settings.enableUnsafeFeatures) return;
		const account = accounts[accountId];
		if (!account) return;

		Clipboard.setString(account.token);
		addLog("info", "Token copied to clipboard", {
			username: account.username,
		});
		showToast(`Token for ${account.username} copied`);
	};

	const addCurrentAccount = async () => {
		setIsAdding(true);
		addLog("info", "Adding current account");

		try {
			const token = getToken();
			const currentUser = getCurrentUser();

			if (!currentUser) {
				addLog("warn", "Failed to get current user");
				showToast("Failed to get current user", 1);
				return;
			}

			if (accounts[currentUser.id]) {
				addLog("warn", "Current account already saved", {
					userId: currentUser.id,
				});
				showToast("Current account already saved", 1);
				return;
			}

			await writeData((data) => {
				data.accounts[currentUser.id] = {
					id: currentUser.id,
					username: currentUser.username,
					discriminator: currentUser.discriminator,
					avatar: currentUser.avatar,
					displayName: currentUser.globalName || currentUser.username,
					token: token,
					addedAt: Date.now(),
				};
				if (!data.accountOrder.includes(currentUser.id)) {
					data.accountOrder.push(currentUser.id);
				}
			});

			addLog("info", "Current account added successfully", {
				username: currentUser.username,
			});
			showToast(`Current account ${currentUser.username} added!`);
			setShowAddDialog(false);
		} catch (e) {
			addLog("error", "Failed to add current account", { error: e.message });
			console.error("Add current account error:", e);
			showToast("Failed to add current account", 1);
		} finally {
			setIsAdding(false);
		}
	};

	const onAddWithCredentials = async () => {
		setIsAdding(true);
		try {
			const ok = await addAccountWithCredentials(email, password);
			if (ok) {
				setEmail("");
				setPassword("");
				setShowAddDialog(false);
			}
		} finally {
			setIsAdding(false);
		}
	};

	const onAddWithToken = async () => {
		setIsAdding(true);
		try {
			const ok = await addAccountWithToken(tokenInput);
			if (ok) setTokenInput("");
		} finally {
			setIsAdding(false);
		}
	};

	const formatDate = (timestamp) => {
		const date = new Date(timestamp);
		return date.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	};

	// Password prompt overrides the whole page while visible
	if (showPasswordDialog) {
		return React.createElement(PasswordPrompt, {
			dialogInfo: showPasswordDialog,
			onCancel: handlePasswordCancel,
			onSuccess: handlePasswordSuccess,
		});
	}

	// Add account page
	if (showAddDialog) {
		return React.createElement(
			View,
			{ style: { flex: 1, backgroundColor: COLORS.bg } },
			[
				React.createElement(
					View,
					{
						key: "add-header",
						style: {
							flexDirection: "row",
							alignItems: "center",
							padding: 16,
							backgroundColor: COLORS.header,
							borderBottomWidth: 1,
							borderBottomColor: COLORS.border,
						},
					},
					[
						React.createElement(
							TouchableOpacity,
							{
								key: "back",
								onPress: () => {
									setShowAddDialog(false);
									setEmail("");
									setPassword("");
								},
								style: { marginRight: 16 },
							},
							React.createElement(
								Text,
								{ style: { color: COLORS.accent, fontSize: 16 } },
								"← Back",
							),
						),
						React.createElement(
							Text,
							{
								key: "title",
								style: {
									color: COLORS.text,
									fontSize: 18,
									fontWeight: "bold",
								},
							},
							"Add Account",
						),
					],
				),

				React.createElement(
					ScrollView,
					{
						key: "add-content",
						style: { flex: 1 },
						contentContainerStyle: { padding: 16, paddingBottom: 100 },
					},
					[
						React.createElement(
							Text,
							{
								key: "instruction",
								style: {
									color: COLORS.subtext,
									fontSize: 16,
									marginBottom: 20,
									textAlign: "center",
								},
							},
							"Enter your Discord account credentials or add your current account",
						),

						React.createElement(TextInput, {
							key: "email-input",
							placeholder: "Email address",
							placeholderTextColor: COLORS.muted,
							value: email,
							onChangeText: setEmail,
							keyboardType: "email-address",
							autoCapitalize: "none",
							style: {
								backgroundColor: COLORS.input,
								color: COLORS.text,
								padding: 16,
								borderRadius: 8,
								marginBottom: 12,
								fontSize: 16,
							},
						}),

						React.createElement(TextInput, {
							key: "password-input",
							placeholder: "Password",
							placeholderTextColor: COLORS.muted,
							value: password,
							onChangeText: setPassword,
							secureTextEntry: true,
							style: {
								backgroundColor: COLORS.input,
								color: COLORS.text,
								padding: 16,
								borderRadius: 8,
								marginBottom: 20,
								fontSize: 16,
							},
						}),

						React.createElement(
							TouchableOpacity,
							{
								key: "login-btn",
								onPress: onAddWithCredentials,
								disabled: isAdding,
								style: {
									backgroundColor: isAdding
										? COLORS.accentPressed
										: COLORS.accent,
									paddingVertical: 16,
									paddingHorizontal: 20,
									borderRadius: 8,
									alignItems: "center",
									marginBottom: 12,
									opacity: isAdding ? 0.6 : 1,
								},
							},
							React.createElement(
								Text,
								{
									style: {
										color: COLORS.text,
										fontSize: 18,
										fontWeight: "bold",
									},
								},
								isAdding ? "Adding Account..." : "Add Account with Email & Password",
							),
						),

						React.createElement(View, {
							key: "divider",
							style: {
								height: 1,
								backgroundColor: COLORS.border,
								marginVertical: 16,
							},
						}),

						React.createElement(
							TouchableOpacity,
							{
								key: "add-current-btn",
								onPress: addCurrentAccount,
								disabled: isAdding,
								style: {
									backgroundColor: isAdding
										? COLORS.accentPressed
										: COLORS.green,
									paddingVertical: 16,
									paddingHorizontal: 20,
									borderRadius: 8,
									alignItems: "center",
									opacity: isAdding ? 0.6 : 1,
								},
							},
							React.createElement(
								Text,
								{
									style: {
										color: COLORS.text,
										fontSize: 18,
										fontWeight: "bold",
									},
								},
								isAdding ? "Adding..." : "Add Current Account",
							),
						),
					],
				),
			],
		);
	}

	// Main account list page
	return React.createElement(View, { style: { flex: 1, backgroundColor: COLORS.bg } }, [
		React.createElement(
			View,
			{
				key: "header",
				style: {
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
					padding: 16,
					backgroundColor: COLORS.header,
					borderBottomWidth: 1,
					borderBottomColor: COLORS.border,
				},
			},
			React.createElement(
				Text,
				{
					key: "title",
					style: { color: COLORS.text, fontSize: 20, fontWeight: "bold" },
				},
				"Account Switcher",
			),
		),

		React.createElement(
			ScrollView,
			{
				key: "content",
				style: { flex: 1, padding: 16 },
				contentContainerStyle: { paddingBottom: 120 },
			},
			[
				React.createElement(
					Text,
					{
						key: "section-title",
						style: {
							color: COLORS.subtext,
							fontSize: 14,
							fontWeight: "bold",
							marginBottom: 12,
						},
					},
					`SAVED ACCOUNTS (${orderedAccounts.length})`,
				),

				orderedAccounts.length === 0
					? React.createElement(
							View,
							{
								key: "empty",
								style: {
									alignItems: "center",
									justifyContent: "center",
									paddingVertical: 40,
								},
							},
							[
								React.createElement(
									Text,
									{
										key: "empty-text",
										style: {
											color: COLORS.muted,
											fontSize: 16,
											marginBottom: 8,
										},
									},
									"No accounts saved yet",
								),
								React.createElement(
									Text,
									{
										key: "empty-hint",
										style: {
											color: COLORS.muted,
											fontSize: 14,
											textAlign: "center",
										},
									},
									"Use the \u201CAdd Account\u201D button below to get started.",
								),
							],
						)
					: orderedAccounts.map((account, index) => {
							const isCurrent = account.id === currentUserId;
							const isSwitching = switchingTo === account.id;

							let avatarUrl = "https://cdn.discordapp.com/embed/avatars/1.png";
							if (account.avatar) {
								avatarUrl = `https://cdn.discordapp.com/avatars/${account.id}/${account.avatar}.png?size=48`;
							}

							return React.createElement(
								View,
								{
									key: account.id,
									style: {
										flexDirection: "row",
										alignItems: "center",
										backgroundColor: isCurrent
											? COLORS.currentRowBg
											: COLORS.neutral,
										borderWidth: isCurrent ? 2 : 0,
										borderColor: COLORS.accent,
										borderRadius: 12,
										padding: 12,
										marginBottom: 12,
									},
								},
								[
									React.createElement(
										TouchableOpacity,
										{
											key: "avatar",
											onPress: () => switchToAccount(account.id),
											disabled: isCurrent || isSwitching,
											style: { marginRight: 12 },
										},
										React.createElement(Image, {
											source: { uri: avatarUrl },
											style: {
												width: 48,
												height: 48,
												borderRadius: 24,
												opacity: isCurrent || isSwitching ? 0.7 : 1,
											},
										}),
									),

									React.createElement(
										View,
										{ key: "info", style: { flex: 1 } },
										[
											React.createElement(
												Text,
												{
													key: "name",
													style: {
														color: COLORS.text,
														fontSize: 16,
														fontWeight: "bold",
													},
												},
												`${index + 1}. ${formatAccountName(account)}`,
											),
											React.createElement(
												Text,
												{
													key: "status",
													style: {
														color: isCurrent
															? COLORS.green
															: COLORS.muted,
														fontSize: 12,
														marginTop: 2,
													},
												},
												isCurrent
													? "✓ Current Account"
													: isSwitching
														? "Switching..."
														: "Tap avatar to switch",
											),
											React.createElement(
												Text,
												{
													key: "date",
													style: {
														color: COLORS.muted,
														fontSize: 11,
														marginTop: 2,
													},
												},
												`Added: ${formatDate(account.addedAt || Date.now())}`,
											),
										],
									),

									React.createElement(
										View,
										{
											key: "actions",
											style: {
												flexDirection: "column",
												alignItems: "flex-end",
											},
										},
										[
											settings.enableUnsafeFeatures
												? React.createElement(
														TouchableOpacity,
														{
															key: "copy",
															onPress: () => copyToken(account.id),
															style: {
																backgroundColor:
																	COLORS.neutralAccent,
																paddingHorizontal: 12,
																paddingVertical: 6,
																borderRadius: 6,
																minWidth: 80,
																alignItems: "center",
																marginBottom: 6,
															},
														},
														React.createElement(
															Text,
															{
																style: {
																	color: COLORS.text,
																	fontSize: 12,
																	fontWeight: "bold",
																},
															},
															"Copy Token",
														),
													)
												: null,

											React.createElement(
												TouchableOpacity,
												{
													key: "remove",
													onPress: () => removeAccount(account.id),
													style: {
														backgroundColor: COLORS.red,
														paddingHorizontal: 12,
														paddingVertical: 6,
														borderRadius: 6,
														minWidth: 80,
														alignItems: "center",
													},
												},
												React.createElement(
													Text,
													{
														style: {
															color: COLORS.text,
															fontSize: 12,
															fontWeight: "bold",
														},
													},
													"Remove",
												),
											),
										],
									),
								],
							);
						}),

				// ── Tools & backup ──────────────────────────────────────────
				React.createElement(
					Text,
					{
						key: "tools-title",
						style: {
							color: COLORS.subtext,
							fontSize: 14,
							fontWeight: "bold",
							marginTop: 16,
							marginBottom: 12,
						},
					},
					"BACKUP & RESTORE",
				),

				React.createElement(
					TouchableOpacity,
					{
						key: "export-btn",
						onPress: () => exportAccounts(setShowPasswordDialog),
						style: {
							backgroundColor: COLORS.accent,
							paddingVertical: 12,
							paddingHorizontal: 16,
							borderRadius: 8,
							marginBottom: 12,
							alignItems: "center",
						},
					},
					React.createElement(
						Text,
						{ style: { color: COLORS.text, fontSize: 16, fontWeight: "bold" } },
						"📤 Export Accounts to Clipboard",
					),
				),

				React.createElement(TextInput, {
					key: "import-input",
					placeholder: "Paste exported account data here (or leave empty to use clipboard)...",
					placeholderTextColor: COLORS.muted,
					value: importText,
					onChangeText: setImportText,
					multiline: true,
					numberOfLines: 4,
					style: {
						backgroundColor: COLORS.input,
						color: COLORS.text,
						padding: 12,
						borderRadius: 8,
						marginBottom: 12,
						fontSize: 14,
						textAlignVertical: "top",
					},
				}),

				React.createElement(
					TouchableOpacity,
					{
						key: "import-btn",
						onPress: () => importAccounts(setShowPasswordDialog, importText),
						style: {
							backgroundColor: COLORS.green,
							paddingVertical: 12,
							paddingHorizontal: 16,
							borderRadius: 8,
							marginBottom: 12,
							alignItems: "center",
						},
					},
					React.createElement(
						Text,
						{ style: { color: COLORS.text, fontSize: 16, fontWeight: "bold" } },
						"📥 Import Accounts",
					),
				),

				React.createElement(
					TouchableOpacity,
					{
						key: "force-logout-btn",
						onPress: forceLogout,
						style: {
							backgroundColor: COLORS.red,
							paddingVertical: 12,
							paddingHorizontal: 16,
							borderRadius: 8,
							alignItems: "center",
						},
					},
					React.createElement(
						Text,
						{ style: { color: COLORS.text, fontSize: 16, fontWeight: "bold" } },
						"🚪 Force Logout",
					),
				),

				// ── Export password protection ──────────────────────────────
				React.createElement(
					Text,
					{
						key: "password-title",
						style: {
							color: COLORS.subtext,
							fontSize: 14,
							fontWeight: "bold",
							marginTop: 24,
							marginBottom: 12,
						},
					},
					"EXPORT PASSWORD PROTECTION",
				),

				settings.exportPasswordHash
					? React.createElement(View, { key: "password-set" }, [
							React.createElement(
								Text,
								{
									key: "status",
									style: { color: COLORS.green, fontSize: 16, marginBottom: 12 },
								},
								"✓ Export password is set (hashed)",
							),
							React.createElement(
								TouchableOpacity,
								{
									key: "remove-pwd",
									onPress: () =>
										removeExportPassword(setShowPasswordDialog),
									style: {
										backgroundColor: COLORS.red,
										paddingVertical: 12,
										paddingHorizontal: 16,
										borderRadius: 8,
										alignItems: "center",
									},
								},
								React.createElement(
									Text,
									{
										style: {
											color: COLORS.text,
											fontSize: 16,
											fontWeight: "bold",
										},
									},
									"Remove Password",
								),
							),
						])
					: React.createElement(View, { key: "password-unset" }, [
							React.createElement(
								Text,
								{
									key: "desc",
									style: {
										color: COLORS.muted,
										fontSize: 14,
										marginBottom: 12,
									},
								},
								"Set a password to protect your account exports and imports (will be hashed for security)",
							),

							React.createElement(TextInput, {
								key: "new-password",
								placeholder: "New password",
								placeholderTextColor: COLORS.muted,
								value: newPassword,
								onChangeText: setNewPassword,
								secureTextEntry: true,
								style: {
									backgroundColor: COLORS.input,
									color: COLORS.text,
									padding: 12,
									borderRadius: 8,
									marginBottom: 8,
									fontSize: 14,
								},
							}),

							React.createElement(TextInput, {
								key: "confirm-password",
								placeholder: "Confirm password",
								placeholderTextColor: COLORS.muted,
								value: confirmPassword,
								onChangeText: setConfirmPassword,
								secureTextEntry: true,
								style: {
									backgroundColor: COLORS.input,
									color: COLORS.text,
									padding: 12,
									borderRadius: 8,
									marginBottom: 12,
									fontSize: 14,
								},
							}),

							React.createElement(
								TouchableOpacity,
								{
									key: "set-password",
									onPress: () => {
										setExportPassword(
											newPassword,
											confirmPassword,
											() => {
												setNewPassword("");
												setConfirmPassword("");
											},
										);
									},
									style: {
										backgroundColor: COLORS.accent,
										paddingVertical: 12,
										paddingHorizontal: 16,
										borderRadius: 8,
										alignItems: "center",
									},
								},
								React.createElement(
									Text,
									{
										style: {
											color: COLORS.text,
											fontSize: 16,
											fontWeight: "bold",
										},
									},
									"Set Password",
								),
							),
						]),

				// ── Unsafe features ─────────────────────────────────────────
				settings.enableUnsafeFeatures
					? React.createElement(View, { key: "unsafe-tools" }, [
							React.createElement(
								Text,
								{
									key: "token-title",
									style: {
										color: COLORS.subtext,
										fontSize: 14,
										fontWeight: "bold",
										marginTop: 24,
										marginBottom: 8,
									},
								},
								"ADD ACCOUNT VIA TOKEN",
							),

							React.createElement(TextInput, {
								key: "token-input",
								placeholder: "Paste account token here (leave empty to add current account)...",
								placeholderTextColor: COLORS.muted,
								value: tokenInput,
								onChangeText: setTokenInput,
								secureTextEntry: true,
								style: {
									backgroundColor: COLORS.input,
									color: COLORS.text,
									padding: 12,
									borderRadius: 8,
									marginBottom: 12,
									fontSize: 14,
								},
							}),

							React.createElement(
								TouchableOpacity,
								{
									key: "add-btn",
									onPress: onAddWithToken,
									disabled: isAdding,
									style: {
										backgroundColor: isAdding
											? COLORS.accentPressed
											: COLORS.accent,
										paddingVertical: 12,
										paddingHorizontal: 20,
										borderRadius: 8,
										alignItems: "center",
										opacity: isAdding ? 0.6 : 1,
									},
								},
								React.createElement(
									Text,
									{
										style: {
											color: COLORS.text,
											fontSize: 16,
											fontWeight: "bold",
										},
									},
									isAdding
										? "Adding..."
										: tokenInput.trim()
											? "Add Account"
											: "Add Current Account",
								),
							),
						])
					: null,
			],
		),

		React.createElement(
			View,
			{
				key: "bottom-actions",
				style: {
					position: "absolute",
					bottom: 0,
					left: 0,
					right: 0,
					backgroundColor: COLORS.header,
					borderTopWidth: 1,
					borderTopColor: COLORS.border,
					paddingVertical: 12,
					paddingHorizontal: 16,
					paddingBottom: 40,
				},
			},
			React.createElement(
				TouchableOpacity,
				{
					key: "add",
					onPress: () => setShowAddDialog(true),
					style: {
						backgroundColor: COLORS.accent,
						paddingVertical: 16,
						paddingHorizontal: 20,
						borderRadius: 8,
						alignItems: "center",
						flexDirection: "row",
						justifyContent: "center",
					},
				},
				[
					React.createElement(
						Text,
						{
							key: "add-icon",
							style: { color: COLORS.text, fontSize: 20, marginRight: 8 },
						},
						"+",
					),
					React.createElement(
						Text,
						{
							key: "add-text",
							style: { color: COLORS.text, fontSize: 18, fontWeight: "bold" },
						},
						"Add Account",
					),
				],
			),
		),
	]);
}
