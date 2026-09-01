# OpenHDO Client Dashboard

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
duplicate those concerns or embed a UI component library.

## Status

The repository contains the versioned `v1` contract and a small validated
`DashboardInstance` model. Build with `npm run build` and run the focused
boundary checks with `npm test`.

The public entry point is `src/index.ts`. Wire messages use a versioned
envelope with a correlation ID for request/reply tracing:

- `dashboard.instance.get` requests one instance by `instanceId`;
- `dashboard.instance.snapshot` returns its client configuration and pages; and
- `dashboard.error` reports a validated failure without exposing server state.

See the [project architecture](https://github.com/OpenHDO/about/blob/main/ARCHITECTURE.md)
and [server contracts](https://github.com/OpenHDO/server/tree/master/contracts/v1)
for the host-side state and orchestration boundary.
