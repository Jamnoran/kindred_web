import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { auth } from "../api/endpoints";
import { ApiError, UNAUTHORIZED_EVENT, bootstrapCsrf } from "../api/http";
import type { UserResponse } from "../api/types";

interface AuthState {
  /** undefined = still restoring the session on boot */
  user: UserResponse | null | undefined;
  login: (email: string, password: string) => Promise<UserResponse>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserResponse | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await bootstrapCsrf(); // makes the server set the XSRF-TOKEN cookie
      try {
        const me = await auth.me();
        if (!cancelled) setUser(me);
      } catch {
        if (!cancelled) setUser(null);
      }
    })();

    const onUnauthorized = () => setUser(null);
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => {
      cancelled = true;
      window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const u = await auth.login(email, password);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    try {
      await auth.logout();
    } catch (err) {
      // A stale session already returns 401; treat as logged out either way.
      if (!(err instanceof ApiError)) throw err;
    }
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      setUser(await auth.me());
    } catch {
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
