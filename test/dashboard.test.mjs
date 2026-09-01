import assert from "node:assert/strict";
import test from "node:test";
import {
  DASHBOARD_CONTRACT,
  DASHBOARD_CONTRACT_VERSION,
  DashboardValidationError,
  createDashboardGetRequest,
  createDashboardSnapshotResponse,
  dashboardFromDto,
  dashboardToDto,
  parseDashboard,
  parseDashboardRequest,
  parseDashboardResponse,
  validateDashboard
} from "../dist/index.js";

const dashboardDto = {
  id: "home",
  name: "Home",
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

test("parses a valid dashboard and keeps device state outside the model", () => {
  const model = parseDashboard(dashboardDto);

  assert.equal(model.pages[0].widgets[0].source.id, "thermostat");
  assert.equal("state" in model.pages[0].widgets[0], false);
  assert.deepEqual(dashboardToDto(model), dashboardDto);
});

test("reports structural, uniqueness, and placement validation issues", () => {
  const invalid = structuredClone(dashboardDto);
  invalid.pages[0].slug = "Not a slug";
  invalid.pages[0].widgets.push({
    ...invalid.pages[0].widgets[0],
    id: invalid.pages[0].widgets[0].id,
    placement: { column: 10, row: 0, columnSpan: 4, rowSpan: 1 },
    state: { value: 21 }
  });

  const issues = validateDashboard(invalid);
  assert.ok(issues.some((issue) => issue.path === "$.pages[0].slug"));
  assert.ok(issues.some((issue) => issue.path === "$.pages[0].widgets[1].id"));
  assert.ok(issues.some((issue) => issue.path === "$.pages[0].widgets[1].state" && issue.message.includes("v1 contract")));
  assert.ok(issues.some((issue) => issue.path === "$.pages[0].widgets[1].placement"));
  assert.throws(() => parseDashboard(invalid), DashboardValidationError);
});

test("uses a versioned envelope and preserves correlation across request/reply", () => {
  const request = createDashboardGetRequest("trace-42", "home");
  assert.deepEqual(request, {
    contract: DASHBOARD_CONTRACT,
    version: DASHBOARD_CONTRACT_VERSION,
    correlationId: "trace-42",
    payload: { type: "dashboard.get", dashboardId: "home" }
  });
  assert.deepEqual(parseDashboardRequest(request), request);

  const response = createDashboardSnapshotResponse(request.correlationId, dashboardFromDto(dashboardDto));
  assert.equal(response.correlationId, request.correlationId);
  assert.equal(response.payload.type, "dashboard.snapshot");
  assert.deepEqual(parseDashboardResponse(response), response);
});

test("rejects an unsupported contract version at the server boundary", () => {
  assert.throws(
    () => parseDashboardRequest({ ...createDashboardGetRequest("trace-42", "home"), version: 2 }),
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
      error: { code: "not_found", message: "Dashboard home was not found" }
    }
  };

  assert.deepEqual(parseDashboardResponse(errorReply), errorReply);
});
