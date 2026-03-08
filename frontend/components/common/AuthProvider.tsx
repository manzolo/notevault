'use client';

import { ReactNode } from 'react';
import { AuthContext, useAuthState } from '@/hooks/useAuth';

export default function AuthProvider({ children }: { children: ReactNode }) {
  const authState = useAuthState();
  return <AuthContext.Provider value={authState}>{children}</AuthContext.Provider>;
}
