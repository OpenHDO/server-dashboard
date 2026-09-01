# ADR 0003: Reusable React dashboard component boundary

## Decision

`server-dashboard` owns the reusable visual composition for a dashboard:

- `Dashboard` renders one validated `DashboardInstance` at a time;
- `DashboardShell`, `DashboardGrid`, and `DashboardWidgetFrame` are the small
  layout primitives;
- `LightWidget` is vendor-neutral and receives a `LightWidgetAdapter`; and
- all instance identity is passed through props and retained in the rendered
  scope attributes.

The adapter exposes canonical server v1 light view loading, view subscription,
and typed light command dispatch. The host maps it to `light.updated`,
`light.command.*`, and `command.result` messages, including correlation IDs
and transport details. The React components never construct envelopes or
authorize, persist, simulate, or execute device state.

## Rationale

The package is the product boundary for dashboard rendering; the app is only a
packager/host. Keeping the observer subscription and command boundary at one
injected interface lets each dashboard instance remain independent without a
global store, vendor branches, or a second server gateway. Inline baseline
styles and native form controls are sufficient for this small surface, so no
UI framework or browser runtime is added.
