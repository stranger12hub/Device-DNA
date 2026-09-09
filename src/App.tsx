import { useEffect, useState } from 'react';
import {
  getCurrentRoute,
  subscribeToRouteChanges,
  type AppRoute,
} from './lib/routes';
import AuthPage from './legacy-pages/AuthPage';
import LogRepair from './legacy-pages/LogRepair';
import Register from './legacy-pages/Register';
import ScanLookup from './legacy-pages/ScanLookup';
import Timeline from './legacy-pages/Timeline';

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

  if (route.name === 'signIn') {
    return <AuthPage mode="sign-in" />;
  }

  if (route.name === 'signUp') {
    return <AuthPage mode="sign-up" />;
  }

  return <ScanLookup />;
}

export default App;
