# ADR 0002: Client light widget state and actions

## Decision

The `v1` client-dashboard contract adds a typed `light` widget with a
server-owned device binding:

- `DashboardLightWidget.binding` contains only `deviceId` and the `light`
  capability;
- `LightState` contains `on`, nullable brightness, and nullable RGB values;
- `LightAction` supports `setOn`, `setBrightness`, and `setRgb`; and
- state and action wire messages use the existing versioned envelope and
  correlation ID.

`dashboard.light.state` is an Observer-style event. It identifies the
`instanceId` and `widgetId`, and carries the latest client-observed state.
`dashboard.light.action` is a Command-style message. It identifies the widget,
not a device, so the server must resolve the widget's configured binding before
authorizing and executing the intent.

## Boundary

Light state is transient client data and is not part of `DashboardInstance`
configuration. This module does not own canonical device state, admin/settings,
authorization, orchestration, or device execution. The DTO adapter functions
validate and copy state/actions across the wire boundary; they do not become a
second device gateway.

Brightness is represented as a percentage (`0..100`), RGB channels as integers
(`0..255`), and `null` means that a state value is unavailable or unsupported.
Unsupported capabilities are rejected by the server when an action is
executed, rather than inferred or simulated by this module.

The React `LightWidget` consumes an injected `LightWidgetAdapter`. The adapter
is the only observer/command boundary used by the component: it loads and
subscribes to canonical v1 `LightView` values for the instance/widget binding,
then sends typed server light commands. A host can map that small interface to
the canonical v1 events and command results without leaking envelope or
transport details into the widget.
