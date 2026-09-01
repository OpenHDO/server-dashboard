# OpenHDO Dashboard

`server-dashboard` is the server-side module for configurable dashboards. It
owns pages, layouts, navigation, widgets, visibility rules, and device/flow
control views.

## Boundary

The module contributes a small explicit surface to `openhdo-server`: settings,
health, permissions, entities, and panel routes. It does not own device state,
automation execution, authentication, or a second persistence model.

## Status

The repository now contains the versioned `v1` contract and a small validated
model. Build with `npm run build` and run the focused boundary checks with
`npm test`.

The public entry point is `src/index.ts`. It exposes pages, grid layouts, and
widgets whose `source` is only a device/flow reference; current device state
stays in the server-owned device module. Wire messages use a versioned envelope
with a correlation ID for request/reply tracing.

See the [project architecture](https://github.com/OpenHDO/about/blob/main/ARCHITECTURE.md)
and [server contracts](https://github.com/OpenHDO/server/tree/master/contracts/v1).
