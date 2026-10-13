/**
 * Warm neutral ramp (no blue cast) with one quiet ink accent. Status colors are
 * muted so they read as information, not alarms. All text pairs clear 4.5:1.
 */
export const light = {
  background: "#F5F5F2",
  surface: "#FFFFFF",
  surfaceRaised: "#EFEFEB",
  textPrimary: "#1C1C1A",
  textSecondary: "#5E5E59",
  textMuted: "#6B6B66",
  separator: "#E3E3DE",
  controlBorder: "#8A8A84",
  accent: "#2F5276",
  onAccent: "#FFFFFF",
  accentSubtle: "#EAEFF4",
  present: "#2E6B4F",
  presentSubtle: "#EAF2EC",
  absent: "#A63D35",
  absentSubtle: "#F7ECEA",
  warning: "#8A5A12",
  warningSubtle: "#F6EFE2",
  neutral: "#5F6168",
  neutralSubtle: "#EFEFEC",
  scrim: "rgba(20,20,18,0.32)",
};
export type Palette = { [K in keyof typeof light]: string };
export const dark: Palette = {
  background: "#111111",
  surface: "#1B1B1A",
  surfaceRaised: "#262624",
  textPrimary: "#EDEDEA",
  textSecondary: "#A6A6A0",
  textMuted: "#8D8D88",
  separator: "#30302E",
  controlBorder: "#7C7C77",
  accent: "#9DB6D3",
  onAccent: "#152435",
  accentSubtle: "#1F2833",
  present: "#8CC7A6",
  presentSubtle: "#1B2A22",
  absent: "#E79A90",
  absentSubtle: "#2E1F1D",
  warning: "#D9B26E",
  warningSubtle: "#2C2519",
  neutral: "#B4B6BC",
  neutralSubtle: "#252525",
  scrim: "rgba(0,0,0,0.56)",
};
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  row: 16,
  gutter: 20,
  lg: 24,
  xl: 32,
  xxl: 40,
  hero: 48,
} as const;
export const radii = {
  small: 6,
  input: 8,
  card: 12,
  summary: 14,
  pill: 999,
} as const;
export const type = {
  statistic: { fontSize: 48, lineHeight: 56, fontWeight: "600" },
  heading: { fontSize: 22, lineHeight: 28, fontWeight: "600" },
  title: { fontSize: 17, lineHeight: 24, fontWeight: "600" },
  body: { fontSize: 17, lineHeight: 24, fontWeight: "400" },
  secondary: { fontSize: 15, lineHeight: 21, fontWeight: "400" },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: "500" },
} as const;
export const motion = {
  press: 100,
  release: 120,
  value: 180,
  toastOut: 150,
  toastDuration: 4000,
} as const;
