"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, auth } from "@/lib/api";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="text-sm text-slate-500">Loading…</div>}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res =
        mode === "login"
          ? await api.login({ email, password })
          : await api.register({
              email,
              password,
              full_name: fullName || undefined,
            });
      auth.setToken(res.access_token);
      router.push(next);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-2 text-2xl font-semibold">
        {mode === "login" ? "Sign in" : "Create account"}
      </h1>
      <p className="mb-6 text-sm text-slate-600">
        {mode === "login" ? (
          <>
            Need an account?{" "}
            <button
              onClick={() => setMode("register")}
              className="text-blue-700 hover:underline"
            >
              Register
            </button>
            . The first registered user becomes the admin.
          </>
        ) : (
          <>
            Already have one?{" "}
            <button
              onClick={() => setMode("login")}
              className="text-blue-700 hover:underline"
            >
              Sign in
            </button>
            .
          </>
        )}
      </p>

      <form onSubmit={onSubmit} className="space-y-4 rounded border border-slate-200 bg-white p-5 shadow-sm">
        {mode === "register" && (
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Full name</span>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2"
            />
          </label>
        )}
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Password</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>
        {err && <div className="rounded bg-red-50 p-2 text-sm text-red-700">{err}</div>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {busy ? "…" : mode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>
    </div>
  );
}
