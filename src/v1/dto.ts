import {
  Dashboard,
  DashboardValidationError,
  DashboardValidationIssue,
  DashboardWidget,
  parseDashboard,
  validateDashboard as validateModelDashboard
} from "./model.js";

export const DASHBOARD_CONTRACT = "openhdo.dashboard" as const;
export const DASHBOARD_CONTRACT_VERSION = 1 as const;
export const DASHBOARD_MEDIA_TYPE = "application/vnd.openhdo.dashboard.v1+json" as const;

export interface DashboardDto {
  readonly id: string;
  readonly name: string;
  readonly defaultPageId: string;
  readonly pages: readonly DashboardPageDto[];
}

export interface DashboardPageDto {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly layout: DashboardLayoutDto;
  readonly widgets: readonly DashboardWidgetDto[];
}

export interface DashboardLayoutDto {
  readonly columns: number;
  readonly rowHeight: number;
}

export interface DashboardWidgetDto {
  readonly id: string;
  readonly title: string;
  readonly kind: DashboardWidget["kind"];
  readonly placement: DashboardWidgetPlacementDto;
  readonly source: DashboardWidgetSourceDto;
}

export interface DashboardWidgetPlacementDto {
  readonly column: number;
  readonly row: number;
  readonly columnSpan: number;
  readonly rowSpan: number;
}

export interface DashboardWidgetSourceDto {
  readonly type: DashboardWidget["source"]["type"];
  readonly id: string;
  readonly path?: string;
}

export interface DashboardEnvelope<TPayload> {
  readonly contract: typeof DASHBOARD_CONTRACT;
  readonly version: typeof DASHBOARD_CONTRACT_VERSION;
  readonly correlationId: string;
  readonly payload: TPayload;
}

export interface DashboardGetRequestPayload {
  readonly type: "dashboard.get";
  readonly dashboardId: string;
}

export type DashboardGetRequestDto = DashboardEnvelope<DashboardGetRequestPayload>;
export type DashboardRequestDto = DashboardGetRequestDto;

export interface DashboardSnapshotPayload {
  readonly type: "dashboard.snapshot";
  readonly dashboard: DashboardDto;
}

export type DashboardErrorCode = "invalid_request" | "not_found" | "internal";

export interface DashboardErrorPayload {
  readonly type: "dashboard.error";
  readonly error: {
    readonly code: DashboardErrorCode;
    readonly message: string;
    readonly issues?: readonly DashboardValidationIssue[];
  };
}

export type DashboardResponsePayload = DashboardSnapshotPayload | DashboardErrorPayload;
export type DashboardResponseDto = DashboardEnvelope<DashboardResponsePayload>;

export function dashboardToDto(dashboard: Dashboard): DashboardDto {
  return dashboardToDtoValue(parseDashboard(dashboard));
}

function dashboardToDtoValue(dashboard: Dashboard): DashboardDto {
  return {
    id: dashboard.id,
    name: dashboard.name,
    defaultPageId: dashboard.defaultPageId,
    pages: dashboard.pages.map((page) => ({
      id: page.id,
      slug: page.slug,
      title: page.title,
      layout: { ...page.layout },
      widgets: page.widgets.map((widget) => ({
        id: widget.id,
        title: widget.title,
        kind: widget.kind,
        placement: { ...widget.placement },
        source: { ...widget.source }
      }))
    }))
  };
}

export function dashboardFromDto(input: unknown): Dashboard {
  return parseDashboard(input);
}

export function createDashboardGetRequest(
  correlationId: string,
  dashboardId: string
): DashboardGetRequestDto {
  return parseDashboardRequest({
    contract: DASHBOARD_CONTRACT,
    version: DASHBOARD_CONTRACT_VERSION,
    correlationId,
    payload: { type: "dashboard.get", dashboardId }
  });
}

export function createDashboardSnapshotResponse(
  correlationId: string,
  dashboard: Dashboard
): DashboardResponseDto {
  return parseDashboardResponse({
    contract: DASHBOARD_CONTRACT,
    version: DASHBOARD_CONTRACT_VERSION,
    correlationId,
    payload: { type: "dashboard.snapshot", dashboard: dashboardToDto(dashboard) }
  });
}

export function parseDashboardRequest(input: unknown): DashboardRequestDto {
  const issues: DashboardValidationIssue[] = [];
  const envelope = validateEnvelope(input, issues);
  if (envelope === undefined) {
    throw new DashboardValidationError(issues);
  }

  const payload = envelope.payload;
  if (!isRecord(payload)) {
    issues.push({ path: "$.payload", message: "must be an object" });
  } else {
    rejectUnknownKeys(payload, ["type", "dashboardId"], "$.payload", issues);
    if (payload.type !== "dashboard.get") {
      issues.push({ path: "$.payload.type", message: "must be dashboard.get" });
    }
    requiredString(payload.dashboardId, "$.payload.dashboardId", issues);
  }
  if (issues.length > 0) {
    throw new DashboardValidationError(issues);
  }

  const payloadValue = payload as Record<string, unknown>;
  return {
    ...envelope,
    payload: { type: "dashboard.get", dashboardId: payloadValue.dashboardId as string }
  };
}

export function parseDashboardResponse(input: unknown): DashboardResponseDto {
  const issues: DashboardValidationIssue[] = [];
  const envelope = validateEnvelope(input, issues);
  if (envelope === undefined) {
    throw new DashboardValidationError(issues);
  }

  const payload = envelope.payload;
  if (!isRecord(payload)) {
    issues.push({ path: "$.payload", message: "must be an object" });
  } else if (payload.type === "dashboard.snapshot") {
    rejectUnknownKeys(payload, ["type", "dashboard"], "$.payload", issues);
    issues.push(...validateDashboard(payload.dashboard, "$.payload.dashboard"));
  } else if (payload.type === "dashboard.error") {
    validateErrorPayload(payload, "$.payload", issues);
  } else {
    issues.push({ path: "$.payload.type", message: "must be dashboard.snapshot or dashboard.error" });
  }
  if (issues.length > 0) {
    throw new DashboardValidationError(issues);
  }

  const payloadValue = payload as Record<string, unknown>;
  if (payloadValue.type === "dashboard.snapshot") {
    return {
      ...envelope,
      payload: {
        type: "dashboard.snapshot",
        dashboard: dashboardToDtoValue(parseDashboard(payloadValue.dashboard))
      }
    };
  }

  return {
    ...envelope,
    payload: payloadValue as unknown as DashboardErrorPayload
  };
}

function validateEnvelope(
  input: unknown,
  issues: DashboardValidationIssue[]
): DashboardEnvelope<unknown> | undefined {
  if (!isRecord(input)) {
    issues.push({ path: "$", message: "must be an object" });
    return undefined;
  }
  rejectUnknownKeys(input, ["contract", "version", "correlationId", "payload"], "$", issues);
  if (input.contract !== DASHBOARD_CONTRACT) {
    issues.push({ path: "$.contract", message: `must be ${DASHBOARD_CONTRACT}` });
  }
  if (input.version !== DASHBOARD_CONTRACT_VERSION) {
    issues.push({ path: "$.version", message: `must be ${DASHBOARD_CONTRACT_VERSION}` });
  }
  requiredString(input.correlationId, "$.correlationId", issues);
  return {
    contract: DASHBOARD_CONTRACT,
    version: DASHBOARD_CONTRACT_VERSION,
    correlationId: input.correlationId as string,
    payload: input.payload
  };
}

function validateErrorPayload(
  payload: Record<string, unknown>,
  path: string,
  issues: DashboardValidationIssue[]
): void {
  rejectUnknownKeys(payload, ["type", "error"], path, issues);
  if (!isRecord(payload.error)) {
    issues.push({ path: `${path}.error`, message: "must be an object" });
    return;
  }
  rejectUnknownKeys(payload.error, ["code", "message", "issues"], `${path}.error`, issues);
  if (!["invalid_request", "not_found", "internal"].includes(payload.error.code as string)) {
    issues.push({ path: `${path}.error.code`, message: "has an unsupported error code" });
  }
  requiredString(payload.error.message, `${path}.error.message`, issues);
  if (payload.error.issues !== undefined) {
    if (!Array.isArray(payload.error.issues)) {
      issues.push({ path: `${path}.error.issues`, message: "must be an array" });
    } else {
      for (const [index, issue] of payload.error.issues.entries()) {
        const issuePath = `${path}.error.issues[${index}]`;
        if (!isRecord(issue)) {
          issues.push({ path: issuePath, message: "must be an object" });
          continue;
        }
        rejectUnknownKeys(issue, ["path", "message"], issuePath, issues);
        requiredString(issue.path, `${issuePath}.path`, issues);
        requiredString(issue.message, `${issuePath}.message`, issues);
      }
    }
  }
}

function requiredString(
  value: unknown,
  path: string,
  issues: DashboardValidationIssue[]
): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    issues.push({ path, message: "must be a non-empty string" });
  }
}

function rejectUnknownKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  issues: DashboardValidationIssue[]
): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) {
      issues.push({ path: `${path}.${key}`, message: "is not part of the v1 contract" });
    }
  }
}

function validateDashboard(
  input: unknown,
  path: string
): readonly DashboardValidationIssue[] {
  return validateDashboardValue(input, path);
}

function validateDashboardValue(
  input: unknown,
  path: string
): readonly DashboardValidationIssue[] {
  const issues = validateModelDashboard(input);
  return issues.map((issue) => ({ ...issue, path: issue.path === "$" ? path : `${path}${issue.path.slice(1)}` }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
