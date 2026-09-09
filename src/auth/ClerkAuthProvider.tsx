// src/auth/ClerkAuthProvider.tsx
import { ClerkProvider, useAuth } from '@clerk/clerk-react';
import { type ReactNode, useEffect } from 'react';
import { setSupabaseAccessTokenGetter } from '../lib/supabase';

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

type ClerkAuthProviderProps = {
  children: ReactNode;
};

export default function ClerkAuthProvider({ children }: ClerkAuthProviderProps) {
  if (!publishableKey) {
    return <>{children}</>;
  }

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
    >
      <SupabaseTokenBridge>{children}</SupabaseTokenBridge>
    </ClerkProvider>
  );
}

type SupabaseTokenBridgeProps = {
  children: ReactNode;
};

function SupabaseTokenBridge({ children }: SupabaseTokenBridgeProps) {
  const { getToken } = useAuth();

  useEffect(() => {
    setSupabaseAccessTokenGetter(() =>
      getToken({
        template: 'supabase',
      }),
    );

    return () => setSupabaseAccessTokenGetter(null);
  }, [getToken]);

  return <>{children}</>;
}
