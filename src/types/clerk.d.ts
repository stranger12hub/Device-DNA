// src/types/clerk.d.ts
import '@clerk/types';

declare module '@clerk/types' {
  interface UserPublicMetadata {
    role?: 'owner' | 'technician';
  }

  interface UserUnsafeMetadata {
    role?: 'owner' | 'technician';
  }
}
