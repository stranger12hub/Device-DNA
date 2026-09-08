export type AppRoute =
  | { name: 'scan' }
  | { name: 'register' }
  | { name: 'timeline'; deviceId: string }
  | { name: 'logRepair'; deviceId: string };

const routeChangeEvent = 'repairpass:navigate';

export function getCurrentRoute(): AppRoute {
  const path = window.location.pathname;
  const timelineMatch = path.match(/^\/devices\/([^/]+)$/);
  const logRepairMatch = path.match(/^\/devices\/([^/]+)\/log$/);

  if (path === '/register') {
    return { name: 'register' };
  }

  if (timelineMatch) {
    return {
      name: 'timeline',
      deviceId: decodeURIComponent(timelineMatch[1]),
    };
  }

  if (logRepairMatch) {
    return {
      name: 'logRepair',
      deviceId: decodeURIComponent(logRepairMatch[1]),
    };
  }

  return { name: 'scan' };
}

export function navigateToRegister() {
  navigate('/register');
}

export function navigateToScanLookup() {
  navigate('/');
}

export function navigateToDeviceTimeline(deviceId: string) {
  navigate(`/devices/${encodeURIComponent(deviceId)}`);
}

export function navigateToLogRepair(deviceId: string) {
  navigate(`/devices/${encodeURIComponent(deviceId)}/log`);
}

export function subscribeToRouteChanges(callback: () => void): () => void {
  window.addEventListener('popstate', callback);
  window.addEventListener(routeChangeEvent, callback);

  return () => {
    window.removeEventListener('popstate', callback);
    window.removeEventListener(routeChangeEvent, callback);
  };
}

function navigate(path: string) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new Event(routeChangeEvent));
}
