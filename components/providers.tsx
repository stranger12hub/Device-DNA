'use client';

import { ClerkProvider, useAuth, useUser } from '@clerk/clerk-react';
import { createContext, type ReactNode, useContext, useEffect } from 'react';
import { setSupabaseAccessTokenGetter } from '@/src/lib/supabase';
import { getUserRole } from '@/src/lib/auth';
import type { ProfileRole } from '@/src/types/database';

export type ViewerContextValue = {
  configured: boolean;
  ready: boolean;
  signedIn: boolean;
  id: string | null;
  role: ProfileRole | null;
  name: string;
  email: string;
  phone: string;
  imageUrl?: string;
};

const guestViewer: ViewerContextValue = {
  configured: false,
  ready: true,
  signedIn: false,
  id: null,
  role: null,
  name: 'Visitor',
  email: 'No email on account',
  phone: 'No phone on account',
};

const ViewerContext = createContext<ViewerContextValue>(guestViewer);

const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export function AppProviders({ children }: { children: ReactNode }) {
  if (!publishableKey) {
    return (
      <ViewerContext.Provider value={guestViewer}>
        {children}
      </ViewerContext.Provider>
    );
  }

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      signInUrl="/"
      signUpUrl="/"
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
    >
      <ViewerBridge>{children}</ViewerBridge>
    </ClerkProvider>
  );
}

export function useViewerContext() {
  return useContext(ViewerContext);
}

function ViewerBridge({ children }: { children: ReactNode }) {
  const { getToken, isLoaded, isSignedIn, userId } = useAuth();
  const { user } = useUser();
  const metadata = user?.publicMetadata as Record<string, unknown> | undefined;
  const role = getUserRole(metadata);

  useEffect(() => {
    setSupabaseAccessTokenGetter(() =>
      getToken({
        template: 'supabase',
      }),
    );

    return () => setSupabaseAccessTokenGetter(null);
  }, [getToken]);

  const viewer: ViewerContextValue = {
    configured: true,
    ready: isLoaded,
    signedIn: Boolean(isSignedIn),
    id: userId ?? null,
    role,
    name: user?.fullName ?? user?.username ?? 'Device DNA user',
    email: user?.primaryEmailAddress?.emailAddress ?? 'No email on account',
    phone: user?.primaryPhoneNumber?.phoneNumber ?? 'No phone on account',
    imageUrl: user?.imageUrl,
  };

  return (
    <ViewerContext.Provider value={viewer}>
      {children}
    </ViewerContext.Provider>
  );
}
