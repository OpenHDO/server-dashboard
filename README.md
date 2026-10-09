# OpenHDO Client Dashboard

## HDO plugin v1

This repository now ships an optional HDO plugin, not a built-in module. Its
`hdo.json`, `plugin.py` and `web/plugin.js` are ready to package with the separate
[plugin CLI](https://github.com/OpenHDO/plugin-cli):

```sh
hdop validate .
hdop pack . --out server-dashboard.hdop
```

Install the archive in HDO's Plugins tab and enable it. The host provides the
Python SDK, authentication, device/room services, automatic lifecycle cleanup
and private persistent storage in `/data/plugin-data/<plugin-id>`.


`server-dashboard` is a reusable client-dashboard module for configurable
dashboard instances. A host can serve independent instances such as the main
dashboard, an embedded wall panel, a room dashboard, or a setup-specific
dashboard.

## Boundary

The module owns client-facing dashboard composition and rendering configuration:
instance scope, client render mode/theme, pages, grid layouts, navigation, and
widgets. Widget sources are references to server-owned devices or flows.

The server owns canonical device state, settings/admin, authentication,
authorization, persistence, and orchestration/execution. This module does not
duplicate those concerns or embed a UI component library. It exports styled
React primitives while leaving the host in control of its Tailwind setup,
theme tokens, and application composition.

## Status

The repository contains the versioned `v1` contract, a small validated
`DashboardInstance` model, and the reusable React component surface. Run
`npm run typecheck`, `npm run build`, or the focused boundary checks with
`npm test`.

The public entry point is `src/index.ts`. Wire messages use a versioned
envelope with a correlation ID for request/reply tracing:

- `dashboard.instance.get` requests one instance by `instanceId`;
- `dashboard.instance.snapshot` returns its client configuration and pages; and
- `dashboard.error` reports a validated failure without exposing server state.

## Light widget

`kind: "light"` widgets bind to a server-owned device with
`{ deviceId, capability: "light" }`. The dashboard v1 DTO model supports
`on`, brightness as a `0..100` percentage, and RGB channels as `0..255`.

The client observes transient state through `dashboard.light.state` events and
sends `dashboard.light.action` commands for `setOn`, `setBrightness`, or
`setRgb`. Commands carry `instanceId` and `widgetId`, not a device ID; the host
server resolves the configured binding and owns authorization and execution.
Light state is never stored in a `DashboardInstance`.

The React `LightWidget` renders the canonical server v1 `LightView`: power,
brightness as an integer from `0..255`, RGB channels, capability support, and
the latest state revision. The dashboard DTO model and canonical server view
remain separate contracts.

## React components

The package exports `Dashboard`/`DashboardInstance` (also
`DashboardInstanceView`), `DashboardShell`, `DashboardGrid`,
`DashboardWidgetFrame`, and `LightWidget`.
`Dashboard` receives one `instance` prop, so each mounted dashboard keeps its
own page selection and instance scope. Mounting several instances does not
require a registry or singleton.

The component surface is className-first: the exported primitives include
small default utility classes and shadcn-style card, button, input, and status
variants built from semantic Tailwind tokens such as `bg-background`,
`bg-card`, and `text-foreground`. Hosts can extend those defaults with
`className` and provide the corresponding theme tokens. The package does not
bundle a Tailwind runtime, Tailwind config, or another UI dependency; inline
styles are kept for instance-specific grid geometry.

Light rendering receives a `LightWidgetAdapter` (also named
`LightWidgetTransport`) from the host:

```ts
interface LightWidgetAdapter {
  getLight(context: LightWidgetContext): Promise<LightView>;
  subscribeLight(
    context: LightWidgetContext,
    listener: (view: LightView) => void,
    onError?: (error: unknown) => void,
  ): () => void;
  sendLightCommand(
    context: LightWidgetContext,
    command: LightCommand,
  ): Promise<LightCommandResult>;
}
```

The host adapter maps these calls to the canonical v1 `LightView`,
`light.updated` event, and `light.command.*`/`command.result` messages. The
dashboard binding gives the adapter the abstract light identity; the widget
does not construct envelopes, resolve vendors, or own server authorization.
The package has no app import or platform runtime integration.

See the [project architecture](https://github.com/OpenHDO/about/blob/main/ARCHITECTURE.md)
and [server contracts](https://github.com/OpenHDO/server/tree/master/contracts/v1)
for the host-side state and orchestration boundary.

## Plugin dashboard

The plugin tab selects imported devices and persists the layout through its
`layout` API. It renders registered device models or the standard HDO device card.
Plugin widgets are referenced by `{type:"plugin.id:widget",config:{...}}` in the
layout's `widgets` array. Live state is fetched from HDO, and commands use its
validated action API. Existing v1 React components remain library exports.

## Repository and releases

One plugin = one repository, with exactly one root `hdo.json`. Contributions
and both runtimes belong to that plugin; dependencies are separate plugins in
separate repositories. Shared libraries and the SDK are not plugins.

The `Plugin CI and release` workflow uses HDO CLI v1.1.0 to build, validate and
package the root plugin. Pull requests and pushes create a downloadable Actions
artifact. To publish a GitHub Release, update `hdo.json` and push a matching tag:

```sh
git tag v1.0.0
git push origin v1.0.0
```

The tag must match the manifest version. Releases contain `<id>-<version>.hdop`
and its SHA-256 checksum; prerelease versions produce prereleases. Publishing
uses GitHub's built-in token; no additional repository secrets are needed.
Release creation runs only for tag pushes, not pull requests or manual reruns.
