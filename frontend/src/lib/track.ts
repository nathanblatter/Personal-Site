/** Fire a custom Umami event (no-op when the script is blocked/absent). */
export function track(event: string, data?: Record<string, unknown>) {
  const umami = (window as unknown as {
    umami?: { track: (name: string, data?: Record<string, unknown>) => void }
  }).umami
  umami?.track(event, data)
}
