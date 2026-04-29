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

  if (!loaded) return null;

  if (!user) {
    return (
      <Link href="/login" className="text-sm font-medium text-blue-700 hover:underline">
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-slate-600">{user.email}</span>
      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
        {user.role}
      </span>
      <button
        onClick={logout}
        className="text-slate-500 hover:text-slate-900"
        title="Sign out"
      >
        Sign out
      </button>
    </div>
  );
}
