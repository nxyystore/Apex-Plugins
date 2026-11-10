# More Alts!

Revenge plugin that lets you safely store and switch between multiple
Discord accounts, and unlocks Discord's own native multi-account switcher.

Migrated from the old Vendetta plugin API to
[Revenge](https://revenge.palmdevs.me/docs/plugin-development).

## What changed in the migration

- **Manifest:** now uses Revenge manifest `format: 1` (`id`, `version`,
  `dependencies`, `dist`). The old Vendetta `main` + `vendetta.icon` fields
  are gone; `revenge.api` is declared as a required dependency.
- **Entry point:** `plugin({ jsonStorage, start, SettingsComponent })` with
  `cleanup()` teardown instead of Vendetta's `onLoad`/`onUnload`.
- **Storage:** `api.jsonStorage` (`storage.json` in the plugin's data
  directory) instead of Vendetta's reactive `storage`. See `storage.js`.
- **Imports:** all `@vendetta/*` imports were replaced with
  `@revenge-mod/*` equivalents (patcher, module finders, Flux stores,
  design system, actions, assets, externals).
- **Settings:** sidebar row is now registered through
  `registerSettingsSection`/`registerSettingsItem`
  (`@revenge-mod/discord/modules/settings`); plugin toggles use the Discord
  design system (`TableRowGroup`/`TableSwitchRow`).
- **Removed:** Vendetta slash commands (`/accswitcher ...`), the fake
  `sendMessage` embed hack, and the old `UserProfileOverflow` context-menu
  patch (deep Vendetta internals with no Revenge equivalent). All other
  features (list/switch/add/remove accounts, token ops, export/import with
  password protection, native switcher unlock, force logout) are available
  from the settings page.
- Shared code from the repo-root `common/` folder is no longer needed and
  is not imported anymore.

## Building

This plugin requires the official Revenge Plugin CLI - the repo-root
`build.mjs` only understands the old Vendetta manifest and skips it.

```sh
npm install @revenge-mod/plugin-cli @revenge-mod/types   # or bun add
bunx --bun revenge-plugin build      # bundles to a distributable plugin ZIP
bunx --bun revenge-plugin serve      # serve locally to test on a device
```

> On Windows, plain `bunx revenge-plugin ...` can end up running the CLI
> through Node, which fails with
> `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING` (the CLI ships as
> TypeScript). Always pass `--bun` to force the Bun runtime, or run e.g.
> `bun run build` from a package.json script.
>
> Note: `bunx revenge-plugin build` (without a name) builds *all* plugins the
> CLI discovers and fails on the remaining Vendetta-style plugins in this
> repo; always build this plugin by name: `bunx --bun revenge-plugin build MoreAlts`.
