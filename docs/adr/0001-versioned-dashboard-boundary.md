# ADR 0001: Versioned dashboard boundary

## Decision

The dashboard module exposes a small `v1` contract consisting of:

- a dashboard model containing pages, grid layouts, and widgets;
- device/flow references on widgets, never live device state;
- strict validation for model and wire input; and
- request/reply DTO envelopes with a contract version and correlation ID.

The public entry point is `src/index.ts`, which currently re-exports `v1`.
Future incompatible changes should be introduced under a new versioned module
instead of changing `v1` in place.

## Rationale

The repository owns dashboard composition, not device state, automation
execution, authentication, or persistence. A small grid model is enough for
the server to store and serve dashboard configuration without coupling it to a
UI component library. The envelope gives server adapters one stable place for
version checks and correlation identifiers without introducing a message bus.

Unknown fields are rejected in `v1` so accidental state leakage and contract
drift fail at the boundary. Limits on page/widget counts and grid dimensions
also keep untrusted payloads bounded.
