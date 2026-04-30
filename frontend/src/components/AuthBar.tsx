"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, auth, AuthUser } from "@/lib/api";

export default function AuthBar() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!auth.getToken()) {
      setLoaded(true);
      return;
    }
    api
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoaded(true));
  }, []);

  function logout() {
    auth.setToken(null);
    setUser(null);
    router.push("/login");
  }

  if (!loaded) return <div className="h-7 w-20" />;

  if (!user) {
    return (
      <Link
        href="/login"
        className="inline-flex items-center rounded-lg bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-700"
      >
        Sign in
      </Link>
    );
  }

  const initial = (user.full_name || user.email).charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
          {initial}
        </span>
        <span className="hidden sm:inline text-slate-700">{user.email}</span>
        <span className="pill pill-indigo">{user.role}</span>
      </div>
      <button
        onClick={logout}
        className="text-slate-500 transition-colors hover:text-slate-900"
        title="Sign out"
      >
        Sign out
      </button>
    </div>
  );
}
