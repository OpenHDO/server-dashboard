import {
  DashboardValidationError,
  type DashboardClientConfig,
  type DashboardInstance,
  type DashboardInstanceScopeType,
  type DashboardValidationIssue,
  type DashboardWidget,
  parseDashboardInstance,
  validateDashboardInstance as validateModelDashboardInstance
} from "./model.js";

export const DASHBOARD_CONTRACT = "openhdo.dashboard" as const;
export const DASHBOARD_CONTRACT_VERSION = 1 as const;
export const DASHBOARD_MEDIA_TYPE = "application/vnd.openhdo.dashboard.v1+json" as const;

export interface DashboardInstanceDto {
  readonly id: string;
  readonly name: string;
  readonly scope: DashboardInstanceScopeDto;
  readonly client: DashboardClientConfigDto;
  readonly defaultPageId: string;
  readonly pages: readonly DashboardPageDto[];
}

export type DashboardInstanceScopeDto =
  | { readonly type: "global" }
  | { readonly type: Exclude<DashboardInstanceScopeType, "global">; readonly id: string };

export interface DashboardClientConfigDto {
  readonly renderMode: DashboardClientConfig["renderMode"];
  readonly theme: DashboardClientConfig["theme"];
  readonly showPageNavigation: boolean;
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

export interface DashboardInstanceGetRequestPayload {
  readonly type: "dashboard.instance.get";
  readonly instanceId: string;
}

export type DashboardInstanceGetRequestDto = DashboardEnvelope<DashboardInstanceGetRequestPayload>;
export type DashboardRequestDto = DashboardInstanceGetRequestDto;

export interface DashboardInstanceSnapshotPayload {
  readonly type: "dashboard.instance.snapshot";
  readonly instance: DashboardInstanceDto;
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

export type DashboardResponsePayload = DashboardInstanceSnapshotPayload | DashboardErrorPayload;
export type DashboardResponseDto = DashboardEnvelope<DashboardResponsePayload>;

export function dashboardInstanceToDto(instance: DashboardInstance): DashboardInstanceDto {
  return dashboardInstanceToDtoValue(parseDashboardInstance(instance));
}

function dashboardInstanceToDtoValue(instance: DashboardInstance): DashboardInstanceDto {
  return {
    id: instance.id,
    name: instance.name,
    scope: { ...instance.scope },
    client: { ...instance.client },
    defaultPageId: instance.defaultPageId,
    pages: instance.pages.map((page) => ({
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

export function dashboardInstanceFromDto(input: unknown): DashboardInstance {
  return parseDashboardInstance(input);
}

export function createDashboardInstanceGetRequest(
  correlationId: string,
  instanceId: string
): DashboardInstanceGetRequestDto {
  return parseDashboardRequest({
    contract: DASHBOARD_CONTRACT,
    version: DASHBOARD_CONTRACT_VERSION,
    correlationId,
    payload: { type: "dashboard.instance.get", instanceId }
  });
}

export function createDashboardInstanceSnapshotResponse(
  correlationId: string,
  instance: DashboardInstance
): DashboardResponseDto {
  return parseDashboardResponse({
    contract: DASHBOARD_CONTRACT,
    version: DASHBOARD_CONTRACT_VERSION,
    correlationId,
    payload: { type: "dashboard.instance.snapshot", instance: dashboardInstanceToDto(instance) }
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
    rejectUnknownKeys(payload, ["type", "instanceId"], "$.payload", issues);
    if (payload.type !== "dashboard.instance.get") {
      issues.push({ path: "$.payload.type", message: "must be dashboard.instance.get" });
    }
    requiredString(payload.instanceId, "$.payload.instanceId", issues);
  }
  if (issues.length > 0) {
    throw new DashboardValidationError(issues);
  }

  const payloadValue = payload as Record<string, unknown>;
  return {
    ...envelope,
    payload: { type: "dashboard.instance.get", instanceId: payloadValue.instanceId as string }
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
  } else if (payload.type === "dashboard.instance.snapshot") {
    rejectUnknownKeys(payload, ["type", "instance"], "$.payload", issues);
    issues.push(...validateDashboardInstance(payload.instance, "$.payload.instance"));
  } else if (payload.type === "dashboard.error") {
    validateErrorPayload(payload, "$.payload", issues);
  } else {
    issues.push({ path: "$.payload.type", message: "must be dashboard.instance.snapshot or dashboard.error" });
  }
  if (issues.length > 0) {
    throw new DashboardValidationError(issues);
  }

  const payloadValue = payload as Record<string, unknown>;
  if (payloadValue.type === "dashboard.instance.snapshot") {
    return {
      ...envelope,
      payload: {
        type: "dashboard.instance.snapshot",
        instance: dashboardInstanceToDtoValue(parseDashboardInstance(payloadValue.instance))
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

function validateDashboardInstance(
  input: unknown,
  path: string
): readonly DashboardValidationIssue[] {
  const issues = validateModelDashboardInstance(input);
  return issues.map((issue) => ({ ...issue, path: issue.path === "$" ? path : `${path}${issue.path.slice(1)}` }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
