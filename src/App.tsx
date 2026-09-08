import { useEffect, useState } from 'react';
import {
  getCurrentRoute,
  subscribeToRouteChanges,
  type AppRoute,
} from './lib/routes';
import LogRepair from './pages/LogRepair';
import Register from './pages/Register';
import ScanLookup from './pages/ScanLookup';
import Timeline from './pages/Timeline';

function App() {
  const [route, setRoute] = useState<AppRoute>(() => getCurrentRoute());

  useEffect(() => {
    return subscribeToRouteChanges(() => setRoute(getCurrentRoute()));
  }, []);

  if (route.name === 'timeline') {
    return <Timeline deviceId={route.deviceId} />;
  }

  if (route.name === 'logRepair') {
    return <LogRepair deviceId={route.deviceId} />;
  }

  if (route.name === 'register') {
    return <Register />;
  }

  return <ScanLookup />;
}

export default App;
