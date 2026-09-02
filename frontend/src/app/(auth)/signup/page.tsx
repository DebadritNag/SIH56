"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Loader2,
  Lock,
  Mail,
  User,
} from "lucide-react";

import { AuthShell } from "@/components/auth/AuthShell";
import { useAuth } from "@/lib/providers/AuthProvider";

export default function SignupPage() {
  const router = useRouter();
  const { signUp, session, loading, configured } = useAuth();
  const [fullName, setFullName] = useState("");
  const [organization, setOrganization] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);

  useEffect(() => {
    if (!loading && session) router.replace("/overview");
  }, [loading, session, router]);

  const passwordTooShort = password.length > 0 && password.length < 8;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    const { error: signUpError, needsConfirmation } = await signUp(email.trim(), password, {
      full_name: fullName.trim() || undefined,
      organization: organization.trim() || undefined,
    });
    setSubmitting(false);
    if (signUpError) {
      setError(signUpError);
      return;
    }
    if (needsConfirmation) {
      setConfirmSent(true);
      return;
    }
    // Session created immediately (email confirmation disabled) → dashboard.
    router.replace("/overview");
  };

  if (confirmSent) {
    return (
      <AuthShell
        title="Check your inbox"
        subtitle="Confirm your email to activate your account."
        footer={
          <Link href="/login" className="font-semibold text-sky-400 hover:text-sky-300 cursor-pointer">
            Back to sign in
          </Link>
        }
      >
        <div className="flex items-start gap-3 rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            We sent a confirmation link to <span className="font-semibold">{email}</span>. After
            confirming, sign in — you&apos;ll be provisioned with <strong>viewer</strong> clearance,
            which an administrator can elevate.
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Request access"
      subtitle="New accounts start with viewer clearance."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-sky-400 hover:text-sky-300 cursor-pointer">
            Sign in
          </Link>
        </>
      }
    >
      {!configured && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          Authentication is not configured (missing Supabase env vars).
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="fullName" className="mb-1.5 block text-xs font-semibold text-slate-300">
            Full name
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              id="fullName"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Dr. A. Sharma"
              className="w-full rounded-lg border border-white/10 bg-[#0A1428] py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
            />
          </div>
        </div>

        <div>
          <label htmlFor="org" className="mb-1.5 block text-xs font-semibold text-slate-300">
            Organization
          </label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              id="org"
              type="text"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              placeholder="MoSPI / RBI / Research"
              className="w-full rounded-lg border border-white/10 bg-[#0A1428] py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
            />
          </div>
        </div>

        <div>
          <label htmlFor="email" className="mb-1.5 block text-xs font-semibold text-slate-300">
            Official email address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="analyst@mospi.gov.in"
              className="w-full rounded-lg border border-white/10 bg-[#0A1428] py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-xs font-semibold text-slate-300">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full rounded-lg border border-white/10 bg-[#0A1428] py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
            />
          </div>
          {passwordTooShort && (
            <p className="mt-1 text-[11px] text-amber-300">Minimum 8 characters.</p>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-rose-400/30 bg-rose-500/10 p-3 text-xs text-rose-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !configured}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-500 py-2.5 text-sm font-bold text-white shadow-lg shadow-sky-500/20 transition-colors hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating account…
            </>
          ) : (
            <>
              Request access
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>
    </AuthShell>
  );
}
