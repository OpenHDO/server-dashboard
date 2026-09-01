import {
  DashboardValidationError,
  type DashboardClientConfig,
  type DashboardInstance,
  type DashboardInstanceScopeType,
  type DashboardValidationIssue,
  type DashboardWidget,
  type DashboardWidgetSource,
  parseDashboardInstance,
  validateDashboardInstance as validateModelDashboardInstance
} from "./model.js";
import {
  parseLightAction,
  parseLightState,
  type LightAction,
  type LightState,
  validateLightAction,
  validateLightState
} from "./light.js";

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

interface DashboardWidgetDtoBase {
  readonly id: string;
  readonly title: string;
  readonly placement: DashboardWidgetPlacementDto;
}

export interface DashboardValueWidgetDto extends DashboardWidgetDtoBase {
  readonly kind: "value";
  readonly source: DashboardWidgetSourceDto;
}

export interface DashboardControlWidgetDto extends DashboardWidgetDtoBase {
  readonly kind: "control";
  readonly source: DashboardWidgetSourceDto;
}

export interface DashboardLightDeviceBindingDto {
  readonly deviceId: string;
  readonly capability: "light";
}

export interface DashboardLightWidgetDto extends DashboardWidgetDtoBase {
  readonly kind: "light";
  readonly binding: DashboardLightDeviceBindingDto;
}

export type DashboardWidgetDto =
  | DashboardValueWidgetDto
  | DashboardControlWidgetDto
  | DashboardLightWidgetDto;

export interface DashboardWidgetPlacementDto {
  readonly column: number;
  readonly row: number;
  readonly columnSpan: number;
  readonly rowSpan: number;
}

export interface DashboardWidgetSourceDto {
  readonly type: DashboardWidgetSource["type"];
  readonly id: string;
  readonly path?: string;
}

export interface DashboardLightRgbDto {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export interface DashboardLightStateDto {
  readonly on: boolean;
  readonly brightness: number | null;
  readonly rgb: DashboardLightRgbDto | null;
}

export type DashboardLightActionDto =
  | { readonly type: "setOn"; readonly on: boolean }
  | { readonly type: "setBrightness"; readonly brightness: number }
  | { readonly type: "setRgb"; readonly rgb: DashboardLightRgbDto };

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

export interface DashboardLightActionCommandPayload {
  readonly type: "dashboard.light.action";
  readonly instanceId: string;
  readonly widgetId: string;
  readonly action: DashboardLightActionDto;
}

export type DashboardLightActionCommandDto = DashboardEnvelope<DashboardLightActionCommandPayload>;
export type DashboardRequestDto = DashboardInstanceGetRequestDto | DashboardLightActionCommandDto;

export interface DashboardLightStateEventPayload {
  readonly type: "dashboard.light.state";
  readonly instanceId: string;
  readonly widgetId: string;
  readonly state: DashboardLightStateDto;
}

export type DashboardLightStateEventDto = DashboardEnvelope<DashboardLightStateEventPayload>;

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
      widgets: page.widgets.map(widgetToDto)
    }))
  };
}

function widgetToDto(widget: DashboardWidget): DashboardWidgetDto {
  const base = {
    id: widget.id,
    title: widget.title,
    placement: { ...widget.placement }
  };
  if (widget.kind === "light") {
    return { ...base, kind: "light", binding: { ...widget.binding } };
  }
  return { ...base, kind: widget.kind, source: { ...widget.source } };
}

export function dashboardInstanceFromDto(input: unknown): DashboardInstance {
  return parseDashboardInstance(input);
}

/** Adapter from a wire state DTO to the client's typed, transient light state. */
export function lightStateFromDto(input: unknown): LightState {
  return parseLightState(input);
}

/** Adapter from a typed light action to its server-facing DTO shape. */
export function lightActionToDto(action: LightAction): DashboardLightActionDto {
  const value = parseLightAction(action);
  if (value.type === "setOn") {
    return { type: "setOn", on: value.on };
  }
  if (value.type === "setBrightness") {
    return { type: "setBrightness", brightness: value.brightness };
  }
  return { type: "setRgb", rgb: { ...value.rgb } };
}

/** Adapter from a client-facing action DTO to a typed server command intent. */
export function lightActionFromDto(input: unknown): LightAction {
  return parseLightAction(input);
}

export function lightStateToDto(state: LightState): DashboardLightStateDto {
  const value = parseLightState(state);
  return {
    on: value.on,
    brightness: value.brightness,
    rgb: value.rgb === null ? null : { ...value.rgb }
  };
}

export function createDashboardInstanceGetRequest(
  correlationId: string,
  instanceId: string
): DashboardInstanceGetRequestDto {
  const request = parseDashboardRequest({
    contract: DASHBOARD_CONTRACT,
    version: DASHBOARD_CONTRACT_VERSION,
    correlationId,
    payload: { type: "dashboard.instance.get", instanceId }
  });
  if (request.payload.type !== "dashboard.instance.get") {
    throw new Error("Unexpected dashboard request type");
  }
  return request as DashboardInstanceGetRequestDto;
}

export function createDashboardLightActionCommand(
  correlationId: string,
  instanceId: string,
  widgetId: string,
  action: LightAction
): DashboardLightActionCommandDto {
  return parseDashboardLightActionCommand({
    contract: DASHBOARD_CONTRACT,
    version: DASHBOARD_CONTRACT_VERSION,
    correlationId,
    payload: {
      type: "dashboard.light.action",
      instanceId,
      widgetId,
      action: lightActionToDto(action)
    }
  });
}

export function createDashboardLightStateEvent(
  correlationId: string,
  instanceId: string,
  widgetId: string,
  state: LightState
): DashboardLightStateEventDto {
  return parseDashboardLightStateEvent({
    contract: DASHBOARD_CONTRACT,
    version: DASHBOARD_CONTRACT_VERSION,
    correlationId,
    payload: { type: "dashboard.light.state", instanceId, widgetId, state: lightStateToDto(state) }
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
  } else if (payload.type === "dashboard.instance.get") {
    rejectUnknownKeys(payload, ["type", "instanceId"], "$.payload", issues);
    requiredString(payload.instanceId, "$.payload.instanceId", issues);
  } else if (payload.type === "dashboard.light.action") {
    validateLightActionCommandPayload(payload, "$.payload", issues);
  } else {
    issues.push({ path: "$.payload.type", message: "must be dashboard.instance.get or dashboard.light.action" });
  }
  if (issues.length > 0) {
    throw new DashboardValidationError(issues);
  }

  const payloadValue = payload as Record<string, unknown>;
  if (payloadValue.type === "dashboard.light.action") {
    return {
      ...envelope,
      payload: {
        type: "dashboard.light.action",
        instanceId: payloadValue.instanceId as string,
        widgetId: payloadValue.widgetId as string,
        action: lightActionToDto(parseLightAction(payloadValue.action))
      }
    };
  }
  return {
    ...envelope,
    payload: { type: "dashboard.instance.get", instanceId: payloadValue.instanceId as string }
  };
}

export function parseDashboardLightActionCommand(input: unknown): DashboardLightActionCommandDto {
  const issues: DashboardValidationIssue[] = [];
  const envelope = validateEnvelope(input, issues);
  if (envelope === undefined) {
    throw new DashboardValidationError(issues);
  }
  if (!isRecord(envelope.payload)) {
    issues.push({ path: "$.payload", message: "must be an object" });
  } else {
    validateLightActionCommandPayload(envelope.payload, "$.payload", issues);
  }
  if (issues.length > 0) {
    throw new DashboardValidationError(issues);
  }
  const payload = envelope.payload as Record<string, unknown>;
  return {
    ...envelope,
    payload: {
      type: "dashboard.light.action",
      instanceId: payload.instanceId as string,
      widgetId: payload.widgetId as string,
      action: lightActionToDto(parseLightAction(payload.action))
    }
  };
}

export function parseDashboardLightStateEvent(input: unknown): DashboardLightStateEventDto {
  const issues: DashboardValidationIssue[] = [];
  const envelope = validateEnvelope(input, issues);
  if (envelope === undefined) {
    throw new DashboardValidationError(issues);
  }
  if (!isRecord(envelope.payload)) {
    issues.push({ path: "$.payload", message: "must be an object" });
  } else {
    const payload = envelope.payload;
    rejectUnknownKeys(payload, ["type", "instanceId", "widgetId", "state"], "$.payload", issues);
    if (payload.type !== "dashboard.light.state") {
      issues.push({ path: "$.payload.type", message: "must be dashboard.light.state" });
    }
    requiredString(payload.instanceId, "$.payload.instanceId", issues);
    requiredString(payload.widgetId, "$.payload.widgetId", issues);
    issues.push(...validateLightState(payload.state, "$.payload.state"));
  }
  if (issues.length > 0) {
    throw new DashboardValidationError(issues);
  }
  const payload = envelope.payload as Record<string, unknown>;
  return {
    ...envelope,
    payload: {
      type: "dashboard.light.state",
      instanceId: payload.instanceId as string,
      widgetId: payload.widgetId as string,
      state: lightStateToDto(parseLightState(payload.state))
    }
  };
}

function validateLightActionCommandPayload(
  payload: Record<string, unknown>,
  path: string,
  issues: DashboardValidationIssue[]
): void {
  rejectUnknownKeys(payload, ["type", "instanceId", "widgetId", "action"], path, issues);
  if (payload.type !== "dashboard.light.action") {
    issues.push({ path: `${path}.type`, message: "must be dashboard.light.action" });
  }
  requiredString(payload.instanceId, `${path}.instanceId`, issues);
  requiredString(payload.widgetId, `${path}.widgetId`, issues);
  issues.push(...validateLightAction(payload.action, `${path}.action`));
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
