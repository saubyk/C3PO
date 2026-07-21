// Alpha helper that works for hex colors AND var(--...) references, unlike
// string hex parsing — needed now that chip colors are theme variables.
export function withAlpha(color: string, percent: number): string {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}
