import {
  useEffect,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type ReactNode
} from "react";
import type {
  DashboardInstance as DashboardModel,
  DashboardInstanceScope,
  DashboardLayout,
  DashboardWidget,
  DashboardWidgetPlacement
} from "./v1/model.js";
import type { LightDeviceBinding } from "./v1/light.js";
import type {
  LightCommand,
  LightCommandResult,
  LightRgbColor,
  LightView
} from "./v1/server-light.js";

export interface LightWidgetAdapter {
  getLight(context: LightWidgetContext): Promise<LightView>;
  subscribeLight(
    context: LightWidgetContext,
    listener: (view: LightView) => void,
    onError?: (error: unknown) => void
  ): () => void;
  sendLightCommand(context: LightWidgetContext, command: LightCommand): Promise<LightCommandResult>;
}

export type LightWidgetTransport = LightWidgetAdapter;

export interface LightWidgetContext {
  readonly instanceId: string;
  readonly widgetId: string;
  readonly binding: LightDeviceBinding;
}

export interface DashboardShellProps {
  readonly instanceId: string;
  readonly scope: DashboardInstanceScope;
  readonly theme: DashboardModel["client"]["theme"];
  readonly renderMode: DashboardModel["client"]["renderMode"];
  readonly title: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly style?: CSSProperties;
}

export function DashboardShell({
  instanceId,
  scope,
  theme,
  renderMode,
  title,
  children,
  className,
  style
}: DashboardShellProps) {
  const scopeValue = scope.type === "global" ? "global" : `${scope.type}:${scope.id}`;
  const shellStyle: CSSProperties = {
    boxSizing: "border-box",
    colorScheme: theme === "system" ? "light dark" : theme,
    minHeight: "100%",
    padding: "1rem",
    ...style
  };

  return (
    <section
      aria-label={title}
      className={className}
      data-dashboard-instance={instanceId}
      data-dashboard-render-mode={renderMode}
      data-dashboard-scope={scopeValue}
      data-dashboard-theme={theme}
      style={shellStyle}
    >
      {children}
    </section>
  );
}

export interface DashboardInstanceProps {
  readonly instance: DashboardModel;
  readonly lightAdapter?: LightWidgetAdapter;
  readonly renderWidget?: (widget: DashboardWidget) => ReactNode;
  readonly className?: string;
  readonly style?: CSSProperties;
}

export function DashboardInstanceView({
  instance,
  lightAdapter,
  renderWidget,
  className,
  style
}: DashboardInstanceProps) {
  const [pageId, setPageId] = useState(instance.defaultPageId);

  useEffect(() => {
    setPageId(instance.defaultPageId);
  }, [instance.id, instance.defaultPageId]);

  const page = instance.pages.find((candidate) => candidate.id === pageId) ?? instance.pages[0];
  if (page === undefined) {
    return null;
  }

  return (
    <DashboardShell
      instanceId={instance.id}
      renderMode={instance.client.renderMode}
      scope={instance.scope}
      theme={instance.client.theme}
      title={instance.name}
      {...(className === undefined ? {} : { className })}
      {...(style === undefined ? {} : { style })}
    >
      <header>
        <h1>{instance.name}</h1>
        {instance.client.showPageNavigation && instance.pages.length > 1 ? (
          <nav aria-label={`${instance.name} pages`}>
            {instance.pages.map((candidate) => (
              <button
                aria-current={candidate.id === page.id ? "page" : undefined}
                key={candidate.id}
                onClick={() => setPageId(candidate.id)}
                type="button"
              >
                {candidate.title}
              </button>
            ))}
          </nav>
        ) : null}
      </header>
      <DashboardPageView
        instanceId={instance.id}
        page={page}
        {...(lightAdapter === undefined ? {} : { lightAdapter })}
        {...(renderWidget === undefined ? {} : { renderWidget })}
      />
    </DashboardShell>
  );
}

export const Dashboard = DashboardInstanceView;

interface DashboardPageViewProps {
  readonly instanceId: string;
  readonly lightAdapter?: LightWidgetAdapter;
  readonly page: DashboardModel["pages"][number];
  readonly renderWidget?: (widget: DashboardWidget) => ReactNode;
}

function DashboardPageView({
  instanceId,
  lightAdapter,
  page,
  renderWidget
}: DashboardPageViewProps) {
  return (
    <main aria-label={page.title}>
      <h2>{page.title}</h2>
      <DashboardGrid layout={page.layout}>
        {page.widgets.map((widget) => (
          <DashboardWidgetFrame key={widget.id} placement={widget.placement} title={widget.title}>
            {widget.kind === "light" && lightAdapter !== undefined ? (
              <LightWidget
                adapter={lightAdapter}
                binding={widget.binding}
                instanceId={instanceId}
                title={widget.title}
                widgetId={widget.id}
              />
            ) : widget.kind === "light" ? (
              <output>Light state unavailable</output>
            ) : (
              renderWidget?.(widget) ?? <output>{widget.kind} widget</output>
            )}
          </DashboardWidgetFrame>
        ))}
      </DashboardGrid>
    </main>
  );
}

export interface DashboardGridProps {
  readonly layout: DashboardLayout;
  readonly children: ReactNode;
  readonly className?: string;
  readonly style?: CSSProperties;
}

export function DashboardGrid({ layout, children, className, style }: DashboardGridProps) {
  return (
    <div
      className={className}
      data-dashboard-grid
      role="list"
      style={{
        display: "grid",
        gap: "0.75rem",
        gridAutoRows: `${layout.rowHeight}px`,
        gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`,
        ...style
      }}
    >
      {children}
    </div>
  );
}

export interface DashboardWidgetFrameProps {
  readonly title: string;
  readonly placement: DashboardWidgetPlacement;
  readonly children: ReactNode;
  readonly className?: string;
  readonly style?: CSSProperties;
}

export function DashboardWidgetFrame({
  title,
  placement,
  children,
  className,
  style
}: DashboardWidgetFrameProps) {
  return (
    <article
      aria-label={title}
      className={className}
      role="listitem"
      style={{
        gridColumn: `${placement.column + 1} / span ${placement.columnSpan}`,
        gridRow: `${placement.row + 1} / span ${placement.rowSpan}`,
        ...style
      }}
    >
      {children}
    </article>
  );
}

export interface LightWidgetProps {
  readonly instanceId: string;
  readonly widgetId: string;
  readonly title: string;
  readonly binding: LightDeviceBinding;
  readonly adapter: LightWidgetAdapter;
  readonly initialView?: LightView | null;
  readonly className?: string;
  readonly style?: CSSProperties;
}

export function LightWidget({
  instanceId,
  widgetId,
  title,
  binding,
  adapter,
  initialView = null,
  className,
  style
}: LightWidgetProps) {
  const context: LightWidgetContext = { binding, instanceId, widgetId };
  const [light, setLight] = useState<LightView | null>(initialView);
  const [syncStatus, setSyncStatus] = useState<"loading" | "synced" | "syncing" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLight(initialView);
    setSyncStatus("loading");
    setError(null);
    let unsubscribe = () => {};
    try {
      unsubscribe = adapter.subscribeLight(
        context,
        (nextLight) => {
          if (!active) return;
          setLight(nextLight);
          setSyncStatus("synced");
          setError(null);
        },
        (reason) => {
          if (!active) return;
          setSyncStatus("error");
          setError(reason instanceof Error ? reason.message : "Unable to observe Light state");
        }
      );
    } catch (reason: unknown) {
      setSyncStatus("error");
      setError(reason instanceof Error ? reason.message : "Unable to observe Light state");
    }
    void Promise.resolve().then(() => adapter.getLight(context)).then((nextLight) => {
      if (!active) return;
      setLight(nextLight);
      setSyncStatus("synced");
    }).catch((reason: unknown) => {
      if (!active) return;
      setSyncStatus("error");
      setError(reason instanceof Error ? reason.message : "Unable to load Light state");
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [adapter, initialView, instanceId, widgetId, binding]);

  const send = (command: LightCommand): void => {
    setSyncStatus("syncing");
    setError(null);
    try {
      void adapter.sendLightCommand(context, command).then((result) => {
        if (result.light_id !== binding.deviceId) {
          throw new Error("Light command response does not match the requested Light");
        }
        if (result.state !== null) {
          setLight((current) => current === null ? current : { ...current, state: result.state });
        }
        if (result.status === "rejected" || result.status === "failed") {
          throw new Error(result.error ?? `Light command ${result.status}`);
        }
        setSyncStatus(result.status === "accepted" ? "syncing" : "synced");
      }).catch((reason: unknown) => {
        setSyncStatus("error");
        setError(reason instanceof Error ? reason.message : "Unable to update Light state");
      });
    } catch {
      setSyncStatus("error");
      setError("Unable to update Light state");
    }
  };

  const changeRgb = (channel: keyof LightRgbColor, event: ChangeEvent<HTMLInputElement>): void => {
    const state = light?.state;
    if (state === undefined || state === null) {
      return;
    }
    send({
      type: "rgb_color",
      rgb_color: { ...state.rgb_color, [channel]: clampByte(Number(event.currentTarget.value)) }
    });
  };

  const state = light?.state ?? null;
  const colorSupported = light?.capability.color_modes?.some((mode) => mode === "RGB" || mode === "RGBW") ?? false;

  return (
    <section aria-label={title} className={className} data-dashboard-widget="light" style={style}>
      <header>
        <h3>{light?.name ?? title}</h3>
        <output aria-live="polite">{state === null ? "Unavailable" : state.power ? "On" : "Off"}</output>
      </header>
      <p>Light binding: {light?.light_id ?? binding.deviceId}</p>
      <p aria-live="polite">{syncStatus === "loading" ? "Loading" : syncStatus === "syncing" ? "Syncing" : syncStatus === "error" ? "Error" : "Synced"}</p>
      {state !== null && light?.capability.power ? (
      <button
        aria-pressed={state.power}
        onClick={() => send({ type: "power", power: !state.power })}
        type="button"
      >
        {state.power ? "Turn off" : "Turn on"}
      </button>
      ) : null}
      {state !== null && light?.capability.brightness ? (
      <label>
        Brightness: <output>{state.brightness} / {light.capability.brightness.max}</output>
        <input
          max={light.capability.brightness.max}
          min={light.capability.brightness.min}
          onChange={(event) => send({ type: "brightness", brightness: Number(event.currentTarget.value) })}
          type="range"
          value={state.brightness}
        />
      </label>
      ) : null}
      {state !== null && colorSupported ? <fieldset>
        <legend>RGB</legend>
        <input
          aria-label="RGB color picker"
          onChange={(event) => send({ type: "rgb_color", rgb_color: hexToRgb(event.currentTarget.value) })}
          type="color"
          value={rgbToHex(state.rgb_color)}
        />
        {(["r", "g", "b"] as const).map((channel) => (
          <label key={channel}>
            {channel.toUpperCase()}
            <input
              aria-label={`${channel} channel, 0 to 255`}
              max={255}
              min={0}
              onChange={(event) => changeRgb(channel, event)}
              type="number"
              value={state.rgb_color[channel]}
            />
          </label>
        ))}
      </fieldset> : null}
      {state === null ? <p>Light state unavailable</p> : null}
      {state !== null ? <p>State revision {state.state_revision}</p> : null}
      {error !== null ? <p role="alert">{error}</p> : null}
    </section>
  );
}

function clampByte(value: number): number {
  return Number.isFinite(value) ? Math.min(255, Math.max(0, Math.round(value))) : 0;
}

function rgbToHex(color: LightRgbColor): string {
  return `#${[color.r, color.g, color.b].map((value) => clampByte(value).toString(16).padStart(2, "0")).join("")}`;
}

function hexToRgb(value: string): LightRgbColor {
  const hex = value.replace(/^#/, "");
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16)
  };
}
