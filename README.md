# OpenHDO Dashboard

`server-dashboard` is the server-side module for configurable dashboards. It
owns pages, layouts, navigation, widgets, visibility rules, and device/flow
control views.

## Boundary

The module contributes a small explicit surface to `openhdo-server`: settings,
health, permissions, entities, and panel routes. It does not own device state,
automation execution, authentication, or a second persistence model.

## Status

Repository scaffold. The first implementation should stabilize the dashboard
contract against the server API before adding a large widget library.

See the [project architecture](https://github.com/OpenHDO/about/blob/main/ARCHITECTURE.md)
and [server contracts](https://github.com/OpenHDO/server/tree/master/contracts/v1).
