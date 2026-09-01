# ADR 0001: Versioned client-dashboard boundary

## Decision

The client-dashboard module exposes a small `v1` contract consisting of:

- a reusable `DashboardInstance` model containing an instance scope, client
  rendering configuration, pages, grid layouts, and widgets;
- device/flow references on widgets, never live device state;
- strict validation for model and wire input; and
- request/reply DTO envelopes with a contract version and correlation ID.

Instance scopes cover global/main, embedded panel, room, and setup dashboards.
The public entry point is `src/index.ts`, which re-exports `v1` and the
reusable React component surface. Future incompatible wire changes should be
introduced under a new versioned module instead of changing `v1` in place.

## Rationale

The repository owns reusable client-dashboard composition, not canonical device
state, server settings/admin, authentication/authorization, persistence, or
automation/orchestration execution. A small grid and client configuration are
enough to render several dashboard instances without coupling this module to a
UI component library. The envelope gives client/server adapters one stable place
for version checks and correlation identifiers without introducing a message
bus.

Unknown fields are rejected in `v1` so accidental state leakage and contract
drift fail at the boundary. Limits on page/widget counts and grid dimensions
also keep untrusted payloads bounded.
