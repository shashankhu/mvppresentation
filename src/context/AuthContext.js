"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { createClient as createSupabaseClient } from "@/utils/supabase/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      let supabaseSessionUser = null;
      try {
        const supabase = createSupabaseClient();
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.error("[auth] supabase session error", error);
        }
        supabaseSessionUser = data?.session?.user || null;
        console.log("[auth] current session user", supabaseSessionUser);
      } catch (err) {
        console.error("[auth] failed to read supabase session", err);
      }

      const storedToken = localStorage.getItem("diganta_token");
      const storedUser = localStorage.getItem("diganta_user");

      if (!storedToken) {
        if (supabaseSessionUser) {
          console.warn("[auth] supabase session exists without local API token", {
            supabaseUserId: supabaseSessionUser.id,
          });
        }
        if (isMounted) {
          setToken(null);
          setUser(null);
          setLoading(false);
        }
        return;
      }

      let parsedStoredUser = null;
      if (storedUser) {
        try {
          parsedStoredUser = JSON.parse(storedUser);
        } catch (err) {
          console.error("[auth] stored user JSON parse failed", err);
          localStorage.removeItem("diganta_user");
        }
      }

      try {
        const res = await fetch("/api/auth/me", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${storedToken}`,
          },
          cache: "no-store",
        });
        const data = await res.json();

        if (!res.ok || !data?.user) {
          throw new Error(data?.error || "Failed to load profile");
        }

        if (!isMounted) return;

        setToken(storedToken);
        setUser(data.user);
        localStorage.setItem("diganta_user", JSON.stringify(data.user));
        console.log("[auth] current role", data.user?.role || null);
      } catch (err) {
        console.error("[auth] profile fetch failed", err);
        if (!isMounted) return;

        setToken(storedToken);
        setUser(parsedStoredUser);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback((tokenValue, userData) => {
    setToken(tokenValue);
    setUser(userData);
    localStorage.setItem("diganta_token", tokenValue);
    localStorage.setItem("diganta_user", JSON.stringify(userData));
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("diganta_token");
    localStorage.removeItem("diganta_user");
  }, []);

  // Authenticated fetch wrapper
  const apiFetch = useCallback(
    async (url, options = {}) => {
      if (!token) {
        throw new Error("No active session");
      }

      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers,
      };

      const res = await fetch(url, {
        ...options,
        headers,
        cache: "no-store",
      });
      const data = await res.json();

      if (res.status === 401) {
        console.error("[apiFetch] session expired", { url, status: res.status });
        logout();
        throw new Error("Session expired");
      }

      if (!res.ok) {
        console.error("[apiFetch] request failed", { url, status: res.status, error: data?.error || null });
        throw new Error(data.error || "Request failed");
      }

      return data;
    },
    [token, logout]
  );

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, apiFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
