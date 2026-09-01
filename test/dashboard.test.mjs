import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import {
  DASHBOARD_CONTRACT,
  DASHBOARD_CONTRACT_VERSION,
  Dashboard,
  DashboardGrid,
  DashboardInstance,
  DashboardShell,
  DashboardValidationError,
  DashboardWidgetFrame,
  LightValidationError,
  LightWidget,
  createDashboardInstanceGetRequest,
  createDashboardInstanceSnapshotResponse,
  createDashboardLightActionCommand,
  createDashboardLightStateEvent,
  dashboardInstanceFromDto,
  dashboardInstanceToDto,
  lightActionFromDto,
  lightActionToDto,
  lightStateFromDto,
  lightStateToDto,
  parseDashboardInstance,
  parseDashboardLightActionCommand,
  parseDashboardLightStateEvent,
  parseDashboardRequest,
  parseDashboardResponse,
  validateDashboardInstance
} from "../dist/index.js";

const dashboardInstanceDto = {
  id: "main",
  name: "Main dashboard",
  scope: { type: "global" },
  client: { renderMode: "responsive", theme: "system", showPageNavigation: true },
  defaultPageId: "overview",
  pages: [
    {
      id: "overview",
      slug: "overview",
      title: "Overview",
      layout: { columns: 12, rowHeight: 32 },
      widgets: [
        {
          id: "living-room-temperature",
          title: "Living room temperature",
          kind: "value",
          placement: { column: 0, row: 0, columnSpan: 4, rowSpan: 2 },
          source: { type: "device", id: "thermostat", path: "temperature" }
        },
        {
          id: "living-room-light",
          title: "Living room light",
          kind: "light",
          placement: { column: 4, row: 0, columnSpan: 4, rowSpan: 2 },
          binding: { deviceId: "living-room-light", capability: "light" }
        }
      ]
    }
  ]
};

test("parses multiple instances with independent scope and client rendering config", () => {
  const main = parseDashboardInstance(dashboardInstanceDto);
  const wallPanel = parseDashboardInstance({
    ...dashboardInstanceDto,
    id: "hallway-wall-panel",
    name: "Hallway wall panel",
    scope: { type: "panel", id: "hallway-panel" },
    client: { renderMode: "wall-panel", theme: "dark", showPageNavigation: false }
  });

  assert.equal(main.scope.type, "global");
  assert.equal(wallPanel.id, "hallway-wall-panel");
  assert.deepEqual(wallPanel.scope, { type: "panel", id: "hallway-panel" });
  assert.deepEqual(wallPanel.client, {
    renderMode: "wall-panel",
    theme: "dark",
    showPageNavigation: false
  });
  assert.deepEqual(main.pages[0].widgets[1].binding, {
    deviceId: "living-room-light",
    capability: "light"
  });
  for (const scope of [
    { type: "room", id: "living-room" },
    { type: "setup", id: "night-mode" }
  ]) {
    const instance = parseDashboardInstance({ ...dashboardInstanceDto, id: scope.id, scope });
    assert.deepEqual(instance.scope, scope);
  }
  assert.equal("state" in main.pages[0].widgets[0], false);
  assert.deepEqual(dashboardInstanceToDto(main), dashboardInstanceDto);
});

test("reports structural, scope, uniqueness, and placement validation issues", () => {
  const invalid = structuredClone(dashboardInstanceDto);
  invalid.scope = { type: "room" };
  invalid.pages[0].widgets[1].binding.capability = "switch";
  invalid.pages[0].slug = "Not a slug";
  invalid.pages[0].widgets.push({
    ...invalid.pages[0].widgets[0],
    id: invalid.pages[0].widgets[0].id,
    placement: { column: 10, row: 0, columnSpan: 4, rowSpan: 1 },
    state: { value: 21 }
  });

  const issues = validateDashboardInstance(invalid);
  assert.ok(issues.some((issue) => issue.path === "$.scope.id"));
  assert.ok(issues.some((issue) => issue.path === "$.pages[0].widgets[1].binding.capability"));
  assert.ok(issues.some((issue) => issue.path === "$.pages[0].slug"));
  assert.ok(issues.some((issue) => issue.path === "$.pages[0].widgets[2].id"));
  assert.ok(issues.some((issue) => issue.path === "$.pages[0].widgets[2].state" && issue.message.includes("v1 contract")));
  assert.ok(issues.some((issue) => issue.path === "$.pages[0].widgets[2].placement"));
  assert.throws(() => parseDashboardInstance(invalid), DashboardValidationError);
});

test("uses a versioned instance envelope and preserves correlation across request/reply", () => {
  const request = createDashboardInstanceGetRequest("trace-42", "main");
  assert.deepEqual(request, {
    contract: DASHBOARD_CONTRACT,
    version: DASHBOARD_CONTRACT_VERSION,
    correlationId: "trace-42",
    payload: { type: "dashboard.instance.get", instanceId: "main" }
  });
  assert.deepEqual(parseDashboardRequest(request), request);

  const response = createDashboardInstanceSnapshotResponse(
    request.correlationId,
    dashboardInstanceFromDto(dashboardInstanceDto)
  );
  assert.equal(response.correlationId, request.correlationId);
  assert.equal(response.payload.type, "dashboard.instance.snapshot");
  assert.equal(response.payload.instance.id, "main");
  assert.deepEqual(parseDashboardResponse(response), response);
});

test("adapts light actions and observes transient RGB light state", () => {
  const state = { on: true, brightness: 72, rgb: { r: 255, g: 80, b: 10 } };
  assert.deepEqual(lightStateFromDto(state), state);
  assert.deepEqual(lightStateToDto(state), state);

  for (const action of [
    { type: "setOn", on: false },
    { type: "setBrightness", brightness: 45 },
    { type: "setRgb", rgb: { r: 10, g: 20, b: 30 } }
  ]) {
    const command = createDashboardLightActionCommand("trace-light", "main", "living-room-light", action);
    assert.deepEqual(command.payload, {
      type: "dashboard.light.action",
      instanceId: "main",
      widgetId: "living-room-light",
      action
    });
    assert.equal("deviceId" in command.payload, false);
    assert.deepEqual(lightActionFromDto(command.payload.action), action);
    assert.deepEqual(lightActionToDto(action), action);
    assert.deepEqual(parseDashboardRequest(command), command);
    assert.deepEqual(parseDashboardLightActionCommand(command), command);
  }

  const event = createDashboardLightStateEvent("trace-light", "main", "living-room-light", state);
  assert.deepEqual(event.payload, {
    type: "dashboard.light.state",
    instanceId: "main",
    widgetId: "living-room-light",
    state
  });
  assert.deepEqual(parseDashboardLightStateEvent(event), event);
});

test("rejects invalid light state and actions at the DTO boundary", () => {
  assert.throws(
    () => createDashboardLightStateEvent("trace-light", "main", "living-room-light", {
      on: true,
      brightness: 101,
      rgb: { r: 256, g: 0, b: 0 }
    }),
    LightValidationError
  );
  assert.throws(
    () => createDashboardLightActionCommand("trace-light", "main", "living-room-light", {
      type: "setBrightness",
      brightness: -1
    }),
    LightValidationError
  );
  assert.throws(
    () => parseDashboardLightStateEvent({
      contract: DASHBOARD_CONTRACT,
      version: DASHBOARD_CONTRACT_VERSION,
      correlationId: "trace-light",
      payload: {
        type: "dashboard.light.state",
        instanceId: "main",
        widgetId: "living-room-light",
        state: { on: true, brightness: 50, rgb: { r: 0, g: 0, b: 300 } }
      }
    }),
    DashboardValidationError
  );
});

test("rejects an unsupported contract version at the client boundary", () => {
  assert.throws(
    () => parseDashboardRequest({ ...createDashboardInstanceGetRequest("trace-42", "main"), version: 2 }),
    (error) => error instanceof DashboardValidationError && error.issues.some((issue) => issue.path === "$.version")
  );
});

test("accepts a validated error reply using the same correlation envelope", () => {
  const errorReply = {
    contract: DASHBOARD_CONTRACT,
    version: DASHBOARD_CONTRACT_VERSION,
    correlationId: "trace-42",
    payload: {
      type: "dashboard.error",
      error: { code: "not_found", message: "Dashboard instance main was not found" }
    }
  };

  assert.deepEqual(parseDashboardResponse(errorReply), errorReply);
});

test("exports a reusable React component surface with instance-scoped primitives", () => {
  assert.equal(typeof Dashboard, "function");
  assert.equal(DashboardInstance, Dashboard);
  assert.equal(typeof LightWidget, "function");

  const mainElement = createElement(Dashboard, { instance: parseDashboardInstance(dashboardInstanceDto) });
  const panelElement = createElement(Dashboard, {
    instance: parseDashboardInstance({
      ...dashboardInstanceDto,
      id: "hallway-wall-panel",
      scope: { type: "panel", id: "hallway-panel" }
    })
  });
  assert.equal(mainElement.props.instance.id, "main");
  assert.deepEqual(panelElement.props.instance.scope, { type: "panel", id: "hallway-panel" });

  const shell = DashboardShell({
    children: "content",
    instanceId: "hallway-wall-panel",
    renderMode: "wall-panel",
    scope: { type: "panel", id: "hallway-panel" },
    theme: "dark",
    title: "Hallway wall panel"
  });
  assert.equal(shell.type, "section");
  assert.equal(shell.props["data-dashboard-instance"], "hallway-wall-panel");
  assert.equal(shell.props["data-dashboard-scope"], "panel:hallway-panel");

  const grid = DashboardGrid({
    children: "widgets",
    layout: { columns: 12, rowHeight: 32 }
  });
  assert.equal(grid.props["data-dashboard-grid"], true);
  assert.equal(grid.props.style.gridTemplateColumns, "repeat(12, minmax(0, 1fr))");

  const frame = DashboardWidgetFrame({
    children: "widget",
    placement: { column: 4, row: 2, columnSpan: 3, rowSpan: 2 },
    title: "Light"
  });
  assert.equal(frame.props.style.gridColumn, "5 / span 3");
  assert.equal(frame.props.style.gridRow, "3 / span 2");
});
