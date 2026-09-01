export const DASHBOARD_INSTANCE_SCOPES = ["global", "panel", "room", "setup"] as const;
export type DashboardInstanceScopeType = (typeof DASHBOARD_INSTANCE_SCOPES)[number];

export const DASHBOARD_RENDER_MODES = ["responsive", "embedded", "wall-panel"] as const;
export type DashboardRenderMode = (typeof DASHBOARD_RENDER_MODES)[number];

export const DASHBOARD_THEMES = ["system", "light", "dark"] as const;
export type DashboardTheme = (typeof DASHBOARD_THEMES)[number];

export const WIDGET_KINDS = ["value", "control"] as const;
export type WidgetKind = (typeof WIDGET_KINDS)[number];

export const WIDGET_SOURCES = ["device", "flow"] as const;
export type WidgetSourceType = (typeof WIDGET_SOURCES)[number];

export interface DashboardInstance {
  readonly id: string;
  readonly name: string;
  readonly scope: DashboardInstanceScope;
  readonly client: DashboardClientConfig;
  readonly defaultPageId: string;
  readonly pages: readonly DashboardPage[];
}

export type DashboardInstanceScope =
  | { readonly type: "global" }
  | { readonly type: Exclude<DashboardInstanceScopeType, "global">; readonly id: string };

export interface DashboardClientConfig {
  readonly renderMode: DashboardRenderMode;
  readonly theme: DashboardTheme;
  readonly showPageNavigation: boolean;
}

export interface DashboardPage {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly layout: DashboardLayout;
  readonly widgets: readonly DashboardWidget[];
}

export interface DashboardLayout {
  readonly columns: number;
  readonly rowHeight: number;
}

export interface DashboardWidget {
  readonly id: string;
  readonly title: string;
  readonly kind: WidgetKind;
  readonly placement: DashboardWidgetPlacement;
  /** A reference to server-owned data; this module never stores its current state. */
  readonly source: DashboardWidgetSource;
}

export interface DashboardWidgetPlacement {
  readonly column: number;
  readonly row: number;
  readonly columnSpan: number;
  readonly rowSpan: number;
}

export interface DashboardWidgetSource {
  readonly type: WidgetSourceType;
  readonly id: string;
  readonly path?: string;
}

export interface DashboardValidationIssue {
  readonly path: string;
  readonly message: string;
}

export class DashboardValidationError extends Error {
  readonly issues: readonly DashboardValidationIssue[];

  constructor(issues: readonly DashboardValidationIssue[]) {
    super(`Dashboard validation failed with ${issues.length} issue(s)`);
    this.name = "DashboardValidationError";
    this.issues = issues;
  }
}

const MAX_ID_LENGTH = 128;
const MAX_NAME_LENGTH = 160;
const MAX_PAGE_COUNT = 100;
const MAX_WIDGET_COUNT = 100;
const MAX_TITLE_LENGTH = 160;
const MAX_PATH_LENGTH = 160;

export function validateDashboardInstance(input: unknown): readonly DashboardValidationIssue[] {
  const issues: DashboardValidationIssue[] = [];
  if (!isRecord(input)) {
    return [{ path: "$", message: "must be an object" }];
  }

  rejectUnknownKeys(input, ["id", "name", "scope", "client", "defaultPageId", "pages"], "$", issues);
  requiredString(input.id, "$.id", MAX_ID_LENGTH, issues);
  requiredString(input.name, "$.name", MAX_NAME_LENGTH, issues);
  validateScope(input.scope, "$.scope", issues);
  validateClient(input.client, "$.client", issues);
  const defaultPageId = requiredString(input.defaultPageId, "$.defaultPageId", MAX_ID_LENGTH, issues);

  const pages = input.pages;
  if (!Array.isArray(pages)) {
    issues.push({ path: "$.pages", message: "must be an array" });
    return issues;
  }
  if (pages.length === 0) {
    issues.push({ path: "$.pages", message: "must contain at least one page" });
  }
  if (pages.length > MAX_PAGE_COUNT) {
    issues.push({ path: "$.pages", message: `must contain at most ${MAX_PAGE_COUNT} pages` });
  }

  const pageIds = new Set<string>();
  for (const [pageIndex, page] of pages.entries()) {
    const pagePath = `$.pages[${pageIndex}]`;
    if (!isRecord(page)) {
      issues.push({ path: pagePath, message: "must be an object" });
      continue;
    }
    rejectUnknownKeys(page, ["id", "slug", "title", "layout", "widgets"], pagePath, issues);
    const pageId = requiredString(page.id, `${pagePath}.id`, MAX_ID_LENGTH, issues);
    requiredString(page.slug, `${pagePath}.slug`, MAX_ID_LENGTH, issues, isPageSlug);
    requiredString(page.title, `${pagePath}.title`, MAX_TITLE_LENGTH, issues);
    if (pageId !== undefined) {
      if (pageIds.has(pageId)) {
        issues.push({ path: `${pagePath}.id`, message: "must be unique across pages" });
      } else {
        pageIds.add(pageId);
      }
    }

    validateLayout(page.layout, `${pagePath}.layout`, issues);
    validateWidgets(page.widgets, `${pagePath}.widgets`, page.layout, issues);
  }

  if (defaultPageId !== undefined && !pageIds.has(defaultPageId)) {
    issues.push({ path: "$.defaultPageId", message: "must reference an existing page" });
  }
  return issues;
}

export function parseDashboardInstance(input: unknown): DashboardInstance {
  const issues = validateDashboardInstance(input);
  if (issues.length > 0) {
    throw new DashboardValidationError(issues);
  }

  const value = input as Record<string, unknown>;
  return {
    id: value.id as string,
    name: value.name as string,
    scope: toScope(value.scope as Record<string, unknown>),
    client: toClient(value.client as Record<string, unknown>),
    defaultPageId: value.defaultPageId as string,
    pages: (value.pages as readonly Record<string, unknown>[]).map((page) => ({
      id: page.id as string,
      slug: page.slug as string,
      title: page.title as string,
      layout: {
        columns: (page.layout as Record<string, unknown>).columns as number,
        rowHeight: (page.layout as Record<string, unknown>).rowHeight as number
      },
      widgets: (page.widgets as readonly Record<string, unknown>[]).map((widget) => ({
        id: widget.id as string,
        title: widget.title as string,
        kind: widget.kind as WidgetKind,
        placement: {
          column: (widget.placement as Record<string, unknown>).column as number,
          row: (widget.placement as Record<string, unknown>).row as number,
          columnSpan: (widget.placement as Record<string, unknown>).columnSpan as number,
          rowSpan: (widget.placement as Record<string, unknown>).rowSpan as number
        },
        source: toSource(widget.source as Record<string, unknown>)
      }))
    }))
  };
}

function validateScope(input: unknown, path: string, issues: DashboardValidationIssue[]): void {
  if (!isRecord(input)) {
    issues.push({ path, message: "must be an object" });
    return;
  }
  rejectUnknownKeys(input, ["type", "id"], path, issues);
  const scopeType = enumValue(input.type, DASHBOARD_INSTANCE_SCOPES, `${path}.type`, issues);
  if (scopeType === "global" && input.id !== undefined) {
    issues.push({ path: `${path}.id`, message: "must be omitted for a global instance" });
  } else if (scopeType !== undefined && scopeType !== "global") {
    requiredString(input.id, `${path}.id`, MAX_ID_LENGTH, issues);
  }
}

function validateClient(input: unknown, path: string, issues: DashboardValidationIssue[]): void {
  if (!isRecord(input)) {
    issues.push({ path, message: "must be an object" });
    return;
  }
  rejectUnknownKeys(input, ["renderMode", "theme", "showPageNavigation"], path, issues);
  enumValue(input.renderMode, DASHBOARD_RENDER_MODES, `${path}.renderMode`, issues);
  enumValue(input.theme, DASHBOARD_THEMES, `${path}.theme`, issues);
  if (typeof input.showPageNavigation !== "boolean") {
    issues.push({ path: `${path}.showPageNavigation`, message: "must be a boolean" });
  }
}

function validateLayout(input: unknown, path: string, issues: DashboardValidationIssue[]): void {
  if (!isRecord(input)) {
    issues.push({ path, message: "must be an object" });
    return;
  }
  rejectUnknownKeys(input, ["columns", "rowHeight"], path, issues);
  const columns = integer(input.columns, `${path}.columns`, issues);
  const rowHeight = integer(input.rowHeight, `${path}.rowHeight`, issues);
  if (columns !== undefined && (columns < 1 || columns > 12)) {
    issues.push({ path: `${path}.columns`, message: "must be between 1 and 12" });
  }
  if (rowHeight !== undefined && (rowHeight < 16 || rowHeight > 240)) {
    issues.push({ path: `${path}.rowHeight`, message: "must be between 16 and 240" });
  }
}

function validateWidgets(
  input: unknown,
  path: string,
  layout: unknown,
  issues: DashboardValidationIssue[]
): void {
  if (!Array.isArray(input)) {
    issues.push({ path, message: "must be an array" });
    return;
  }
  if (input.length > MAX_WIDGET_COUNT) {
    issues.push({ path, message: `must contain at most ${MAX_WIDGET_COUNT} widgets` });
  }

  const columns = isRecord(layout) && typeof layout.columns === "number" ? layout.columns : undefined;
  const widgetIds = new Set<string>();
  for (const [widgetIndex, widget] of input.entries()) {
    const widgetPath = `${path}[${widgetIndex}]`;
    if (!isRecord(widget)) {
      issues.push({ path: widgetPath, message: "must be an object" });
      continue;
    }
    rejectUnknownKeys(widget, ["id", "title", "kind", "placement", "source"], widgetPath, issues);
    const widgetId = requiredString(widget.id, `${widgetPath}.id`, MAX_ID_LENGTH, issues);
    requiredString(widget.title, `${widgetPath}.title`, MAX_TITLE_LENGTH, issues);
    enumValue(widget.kind, WIDGET_KINDS, `${widgetPath}.kind`, issues);
    if (widgetId !== undefined) {
      if (widgetIds.has(widgetId)) {
        issues.push({ path: `${widgetPath}.id`, message: "must be unique within the page" });
      } else {
        widgetIds.add(widgetId);
      }
    }

    validatePlacement(widget.placement, `${widgetPath}.placement`, columns, issues);
    validateSource(widget.source, `${widgetPath}.source`, issues);
  }
}

function validatePlacement(
  input: unknown,
  path: string,
  columns: number | undefined,
  issues: DashboardValidationIssue[]
): void {
  if (!isRecord(input)) {
    issues.push({ path, message: "must be an object" });
    return;
  }
  rejectUnknownKeys(input, ["column", "row", "columnSpan", "rowSpan"], path, issues);
  const column = integer(input.column, `${path}.column`, issues, 0);
  integer(input.row, `${path}.row`, issues, 0);
  const columnSpan = integer(input.columnSpan, `${path}.columnSpan`, issues, 1);
  integer(input.rowSpan, `${path}.rowSpan`, issues, 1);
  if (column !== undefined && columns !== undefined && column + (columnSpan ?? 0) > columns) {
    issues.push({ path, message: "must fit within the page layout columns" });
  }
}

function validateSource(input: unknown, path: string, issues: DashboardValidationIssue[]): void {
  if (!isRecord(input)) {
    issues.push({ path, message: "must be an object" });
    return;
  }
  rejectUnknownKeys(input, ["type", "id", "path"], path, issues);
  enumValue(input.type, WIDGET_SOURCES, `${path}.type`, issues);
  requiredString(input.id, `${path}.id`, MAX_ID_LENGTH, issues);
  if (input.path !== undefined) {
    requiredString(input.path, `${path}.path`, MAX_PATH_LENGTH, issues);
  }
}

function toScope(input: Record<string, unknown>): DashboardInstanceScope {
  const type = input.type as DashboardInstanceScopeType;
  if (type === "global") {
    return { type };
  }
  return { type, id: input.id as string };
}

function toClient(input: Record<string, unknown>): DashboardClientConfig {
  return {
    renderMode: input.renderMode as DashboardRenderMode,
    theme: input.theme as DashboardTheme,
    showPageNavigation: input.showPageNavigation as boolean
  };
}

function toSource(input: Record<string, unknown>): DashboardWidgetSource {
  const source: DashboardWidgetSource = {
    type: input.type as WidgetSourceType,
    id: input.id as string
  };
  if (input.path !== undefined) {
    return { ...source, path: input.path as string };
  }
  return source;
}

function requiredString(
  value: unknown,
  path: string,
  maxLength: number,
  issues: DashboardValidationIssue[],
  extraCheck: (value: string) => boolean = () => true
): string | undefined {
  if (typeof value !== "string" || value.trim().length === 0) {
    issues.push({ path, message: "must be a non-empty string" });
    return undefined;
  }
  if (value.length > maxLength) {
    issues.push({ path, message: `must be at most ${maxLength} characters` });
  }
  if (!extraCheck(value)) {
    issues.push({ path, message: "has an invalid format" });
  }
  return value;
}

function integer(
  value: unknown,
  path: string,
  issues: DashboardValidationIssue[],
  minimum?: number
): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    issues.push({ path, message: "must be an integer" });
    return undefined;
  }
  if (minimum !== undefined && value < minimum) {
    issues.push({ path, message: `must be at least ${minimum}` });
  }
  return value;
}

function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  path: string,
  issues: DashboardValidationIssue[]
): T | undefined {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    issues.push({ path, message: `must be one of: ${allowed.join(", ")}` });
    return undefined;
  }
  return value as T;
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

function isPageSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
