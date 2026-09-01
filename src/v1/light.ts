export interface LightDeviceBinding {
  readonly deviceId: string;
  readonly capability: "light";
}

export interface LightRgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export interface LightState {
  readonly on: boolean;
  /** Percentage from 0 to 100; null means unavailable or unsupported. */
  readonly brightness: number | null;
  /** RGB channels from 0 to 255; null means unavailable or unsupported. */
  readonly rgb: LightRgb | null;
}

export type LightAction =
  | { readonly type: "setOn"; readonly on: boolean }
  | { readonly type: "setBrightness"; readonly brightness: number }
  | { readonly type: "setRgb"; readonly rgb: LightRgb };

export interface LightValidationIssue {
  readonly path: string;
  readonly message: string;
}

export class LightValidationError extends Error {
  readonly issues: readonly LightValidationIssue[];

  constructor(issues: readonly LightValidationIssue[]) {
    super(`Light validation failed with ${issues.length} issue(s)`);
    this.name = "LightValidationError";
    this.issues = issues;
  }
}

const LIGHT_ACTION_TYPES = ["setOn", "setBrightness", "setRgb"] as const;
const MAX_DEVICE_ID_LENGTH = 128;

export function validateLightDeviceBinding(
  input: unknown,
  path = "$"
): readonly LightValidationIssue[] {
  const issues: LightValidationIssue[] = [];
  if (!isRecord(input)) {
    return [{ path, message: "must be an object" }];
  }
  rejectUnknownKeys(input, ["deviceId", "capability"], path, issues);
  requiredString(input.deviceId, `${path}.deviceId`, issues, MAX_DEVICE_ID_LENGTH);
  if (input.capability !== "light") {
    issues.push({ path: `${path}.capability`, message: "must be light" });
  }
  return issues;
}

export function parseLightDeviceBinding(input: unknown): LightDeviceBinding {
  const issues = validateLightDeviceBinding(input);
  if (issues.length > 0) {
    throw new LightValidationError(issues);
  }
  const value = input as Record<string, unknown>;
  return { deviceId: value.deviceId as string, capability: "light" };
}

export function validateLightState(input: unknown, path = "$"): readonly LightValidationIssue[] {
  const issues: LightValidationIssue[] = [];
  if (!isRecord(input)) {
    return [{ path, message: "must be an object" }];
  }
  rejectUnknownKeys(input, ["on", "brightness", "rgb"], path, issues);
  if (typeof input.on !== "boolean") {
    issues.push({ path: `${path}.on`, message: "must be a boolean" });
  }
  validateNullablePercent(input.brightness, `${path}.brightness`, issues);
  validateNullableRgb(input.rgb, `${path}.rgb`, issues);
  return issues;
}

export function parseLightState(input: unknown): LightState {
  const issues = validateLightState(input);
  if (issues.length > 0) {
    throw new LightValidationError(issues);
  }
  const value = input as Record<string, unknown>;
  return {
    on: value.on as boolean,
    brightness: value.brightness as number | null,
    rgb: value.rgb === null ? null : toRgb(value.rgb as Record<string, unknown>)
  };
}

export function validateLightAction(input: unknown, path = "$"): readonly LightValidationIssue[] {
  const issues: LightValidationIssue[] = [];
  if (!isRecord(input)) {
    return [{ path, message: "must be an object" }];
  }
  const type = input.type;
  if (typeof type !== "string" || !LIGHT_ACTION_TYPES.includes(type as (typeof LIGHT_ACTION_TYPES)[number])) {
    issues.push({ path: `${path}.type`, message: `must be one of: ${LIGHT_ACTION_TYPES.join(", ")}` });
    return issues;
  }
  if (type === "setOn") {
    rejectUnknownKeys(input, ["type", "on"], path, issues);
    if (typeof input.on !== "boolean") {
      issues.push({ path: `${path}.on`, message: "must be a boolean" });
    }
  } else if (type === "setBrightness") {
    rejectUnknownKeys(input, ["type", "brightness"], path, issues);
    validatePercent(input.brightness, `${path}.brightness`, issues);
  } else {
    rejectUnknownKeys(input, ["type", "rgb"], path, issues);
    validateRgb(input.rgb, `${path}.rgb`, issues);
  }
  return issues;
}

export function parseLightAction(input: unknown): LightAction {
  const issues = validateLightAction(input);
  if (issues.length > 0) {
    throw new LightValidationError(issues);
  }
  const value = input as Record<string, unknown>;
  if (value.type === "setOn") {
    return { type: "setOn", on: value.on as boolean };
  }
  if (value.type === "setBrightness") {
    return { type: "setBrightness", brightness: value.brightness as number };
  }
  return { type: "setRgb", rgb: toRgb(value.rgb as Record<string, unknown>) };
}

function validateNullablePercent(
  value: unknown,
  path: string,
  issues: LightValidationIssue[]
): void {
  if (value !== null) {
    validatePercent(value, path, issues);
  }
}

function validatePercent(value: unknown, path: string, issues: LightValidationIssue[]): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) {
    issues.push({ path, message: "must be a number from 0 to 100" });
  }
}

function validateNullableRgb(value: unknown, path: string, issues: LightValidationIssue[]): void {
  if (value !== null) {
    validateRgb(value, path, issues);
  }
}

function validateRgb(value: unknown, path: string, issues: LightValidationIssue[]): void {
  if (!isRecord(value)) {
    issues.push({ path, message: "must be an object" });
    return;
  }
  rejectUnknownKeys(value, ["r", "g", "b"], path, issues);
  for (const channel of ["r", "g", "b"]) {
    const channelValue = value[channel];
    if (typeof channelValue !== "number" || !Number.isInteger(channelValue) || channelValue < 0 || channelValue > 255) {
      issues.push({ path: `${path}.${channel}`, message: "must be an integer from 0 to 255" });
    }
  }
}

function toRgb(input: Record<string, unknown>): LightRgb {
  return { r: input.r as number, g: input.g as number, b: input.b as number };
}

function requiredString(
  value: unknown,
  path: string,
  issues: LightValidationIssue[],
  maxLength?: number
): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    issues.push({ path, message: "must be a non-empty string" });
  } else if (maxLength !== undefined && value.length > maxLength) {
    issues.push({ path, message: `must be at most ${maxLength} characters` });
  }
}

function rejectUnknownKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  issues: LightValidationIssue[]
): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) {
      issues.push({ path: `${path}.${key}`, message: "is not part of the v1 contract" });
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
