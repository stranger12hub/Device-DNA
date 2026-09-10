'use client';

import { ClerkProvider, useAuth, useUser } from '@clerk/clerk-react';
import { createContext, type ReactNode, useContext, useEffect } from 'react';
import { setSupabaseAccessTokenGetter } from '@/src/lib/supabase';
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
  phone: 'Phone number not added',
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

  useEffect(() => {
    setSupabaseAccessTokenGetter(async () => {
      try {
        return (
          (await getToken({
            template: 'supabase',
          })) ?? (await getToken())
        );
      } catch {
        return getToken();
      }
    });

    return () => setSupabaseAccessTokenGetter(null);
  }, [getToken]);

  const viewer: ViewerContextValue = {
    configured: true,
    ready: isLoaded,
    signedIn: Boolean(isSignedIn),
    id: userId ?? null,
    role: null,
    name: user?.fullName ?? user?.username ?? 'Device DNA user',
    email: user?.primaryEmailAddress?.emailAddress ?? 'No email on account',
    phone: user?.primaryPhoneNumber?.phoneNumber ?? 'Phone number not added',
    imageUrl: user?.imageUrl,
  };

  return (
    <ViewerContext.Provider value={viewer}>
      {children}
    </ViewerContext.Provider>
  );
}
