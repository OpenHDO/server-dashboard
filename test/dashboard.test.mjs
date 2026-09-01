import assert from "node:assert/strict";
import test from "node:test";
import {
  DASHBOARD_CONTRACT,
  DASHBOARD_CONTRACT_VERSION,
  DashboardValidationError,
  createDashboardInstanceGetRequest,
  createDashboardInstanceSnapshotResponse,
  dashboardInstanceFromDto,
  dashboardInstanceToDto,
  parseDashboardInstance,
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
  invalid.pages[0].slug = "Not a slug";
  invalid.pages[0].widgets.push({
    ...invalid.pages[0].widgets[0],
    id: invalid.pages[0].widgets[0].id,
    placement: { column: 10, row: 0, columnSpan: 4, rowSpan: 1 },
    state: { value: 21 }
  });

  const issues = validateDashboardInstance(invalid);
  assert.ok(issues.some((issue) => issue.path === "$.scope.id"));
  assert.ok(issues.some((issue) => issue.path === "$.pages[0].slug"));
  assert.ok(issues.some((issue) => issue.path === "$.pages[0].widgets[1].id"));
  assert.ok(issues.some((issue) => issue.path === "$.pages[0].widgets[1].state" && issue.message.includes("v1 contract")));
  assert.ok(issues.some((issue) => issue.path === "$.pages[0].widgets[1].placement"));
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
