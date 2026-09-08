const publicAppUrl = import.meta.env.VITE_PUBLIC_APP_URL;

export function buildDeviceTimelineUrl(deviceId: string): string {
  return `${getAppBaseUrl()}/devices/${encodeURIComponent(deviceId)}`;
}

export function parseDeviceTimelineCode(value: string): string {
  const code = value.trim();

  try {
    const url = new URL(code);
    const match = url.pathname.match(/\/devices\/([^/]+)$/);

    if (match) {
      return decodeURIComponent(match[1]);
    }
  } catch {
    return code;
  }

  return code;
}

function getAppBaseUrl(): string {
  const configuredUrl = publicAppUrl?.trim();

  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, '');
  }

  return window.location.origin;
}
