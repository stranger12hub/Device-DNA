// src/pages/AuthPage.tsx
import { SignIn, SignUp } from '@clerk/clerk-react';

type AuthPageProps = {
  mode: 'sign-in' | 'sign-up';
};

export default function AuthPage({ mode }: AuthPageProps) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#FAFAFA] px-4 py-8 font-['Helvetica_Neue',Helvetica,Arial,sans-serif] text-[#171717]">
      <section className="grid w-full max-w-md gap-6">
        <header className="border-b border-[#171717] pb-5">
          <p className="text-xs font-medium uppercase text-[#171717]/60">
            RepairPass / Account
          </p>
          <h1 className="mt-3 font-['PP_Neue_Montreal','Helvetica_Neue',Helvetica,Arial,sans-serif] text-4xl font-medium leading-none">
            {mode === 'sign-in' ? 'Sign in' : 'Create account'}
          </h1>
        </header>

        {mode === 'sign-in' ? (
          <SignIn routing="path" path="/sign-in" />
        ) : (
          <SignUp routing="path" path="/sign-up" />
        )}
      </section>
    </main>
  );
}
