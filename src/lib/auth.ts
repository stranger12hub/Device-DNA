// src/lib/auth.ts
import type { ProfileRole } from '../types/database';

export function getUserRole(
  metadata: Record<string, unknown> | null | undefined,
): ProfileRole | null {
  const role = metadata?.role;

  return role === 'owner' || role === 'technician' ? role : null;
}
