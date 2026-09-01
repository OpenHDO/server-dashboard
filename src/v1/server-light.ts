export interface LightRgbColor {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export interface LightCapability {
  readonly kind: "light";
  readonly power: boolean;
  readonly brightness: { readonly min: 0; readonly max: 255 };
  readonly color_modes: readonly ("RGB" | "RGBW" | "CCT")[] | null;
  readonly rgb_channel_range: { readonly min: 0; readonly max: 255 } | null;
}

export interface LightStateView {
  readonly light_id: string;
  readonly power: boolean;
  readonly brightness: number;
  readonly rgb_color: LightRgbColor;
  readonly state_revision: number;
}

export interface LightView {
  readonly light_id: string;
  readonly name: string;
  readonly linker_id: string;
  readonly capability: LightCapability;
  readonly state: LightStateView | null;
  readonly updated_at: string | null;
}

export type LightCommand =
  | { readonly type: "power"; readonly power: boolean }
  | { readonly type: "brightness"; readonly brightness: number }
  | { readonly type: "rgb_color"; readonly rgb_color: LightRgbColor };

export type LightCommandResultStatus = "accepted" | "applied" | "rejected" | "failed";

export interface LightCommandResult {
  readonly status: LightCommandResultStatus;
  readonly light_id: string;
  readonly command_id: string;
  readonly idempotency_key: string;
  readonly error: string | null;
  readonly state: LightStateView | null;
}
