"use client";

import { useState, type FormEvent } from "react";
import { SettingsShell } from "@/components/settings/SettingsShell";
import { createClient } from "@/lib/supabase/client";

type PasswordSettingsProps = {
  projectId: string;
  projectName: string;
  userEmail: string | null;
};

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M3 3l18 18M10.5 10.7a2.5 2.5 0 0 0 3.3 3.3M9.9 5.6A10.4 10.4 0 0 1 12 5.3c5 0 9.3 3.4 10.5 6.7a11.4 11.4 0 0 1-4.1 4.8M6.1 6.2A11.5 11.5 0 0 0 1.5 12C2.7 15.3 7 18.7 12 18.7c1.4 0 2.7-.2 3.9-.7"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
  show,
  onToggleShow,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  placeholder: string;
  show: boolean;
  onToggleShow: () => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-[var(--foreground)]">
        {label}
      </span>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          required
          minLength={6}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="ui-input !rounded-xl !pr-11 !text-[14px]"
        />
        <button
          type="button"
          onClick={onToggleShow}
          aria-label={show ? "Hide password" : "Show password"}
          title={show ? "Hide password" : "Show password"}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-[var(--muted-soft)] transition hover:bg-[var(--surface-alt)] hover:text-[var(--foreground-soft)]"
        >
          <EyeIcon open={show} />
        </button>
      </div>
    </label>
  );
}

export function PasswordSettings({
  projectId,
  projectName,
  userEmail,
}: PasswordSettingsProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  async function sendCode() {
    setPasswordError("");
    setPasswordSuccess("");

    if (!userEmail) {
      setPasswordError("No signed-in account found.");
      return;
    }
    if (cooldown > 0) return;

    setSendingCode(true);
    const supabase = createClient();

    try {
      // Email OTP (6-digit). Template uses {{ .Token }}.
      const { error } = await supabase.auth.signInWithOtp({
        email: userEmail,
        options: { shouldCreateUser: false },
      });
      if (error) {
        setPasswordError(
          error.message || "Could not send verification code. Try again."
        );
        return;
      }
      setCodeSent(true);
      setCode("");
      setPasswordSuccess(`Code sent to ${userEmail}.`);
      setCooldown(60);
      const timer = window.setInterval(() => {
        setCooldown((s) => {
          if (s <= 1) {
            window.clearInterval(timer);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } catch {
      setPasswordError("Could not send verification code. Try again.");
    } finally {
      setSendingCode(false);
    }
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (!userEmail) {
      setPasswordError("No signed-in account found.");
      return;
    }
    if (!codeSent) {
      setPasswordError("Send a verification code to your email first.");
      return;
    }
    if (!/^\d{6}$/.test(code.trim())) {
      setPasswordError("Enter the 6-digit code from your email.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    setPasswordLoading(true);
    const supabase = createClient();
    const token = code.trim();

    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: userEmail,
        token,
        type: "email",
      });
      if (verifyError) {
        setPasswordError(
          verifyError.message?.toLowerCase().includes("expired")
            ? "Code expired. Request a new one."
            : "Invalid or expired code. Request a new one."
        );
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) {
        setPasswordError(updateError.message || "Could not update password.");
        return;
      }

      setNewPassword("");
      setConfirmPassword("");
      setCode("");
      setCodeSent(false);
      setPasswordSuccess("Password updated.");
      window.setTimeout(() => setPasswordSuccess(""), 2500);
    } catch {
      setPasswordError("Could not update password. Please try again.");
    } finally {
      setPasswordLoading(false);
    }
  }

  return (
    <SettingsShell
      projectId={projectId}
      projectName={projectName}
      userEmail={userEmail}
      title="Password"
      subtitle="Change your account password with an email code."
      backHref={`/projects/${projectId}/settings`}
      backLabel="← Settings"
      footer={false}
    >
      <section className="ui-card p-5 sm:p-6">
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4">
            <p className="text-[13px] text-[var(--muted)]">
              We&apos;ll send a 6-digit code to{" "}
              <span className="font-medium text-[var(--foreground)]">
                {userEmail || "your email"}
              </span>
              .
            </p>
            <button
              type="button"
              onClick={sendCode}
              disabled={sendingCode || !userEmail || cooldown > 0}
              className="ui-btn-secondary mt-3 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sendingCode
                ? "Sending…"
                : cooldown > 0
                  ? `Resend in ${cooldown}s`
                  : codeSent
                    ? "Resend code"
                    : "Send code"}
            </button>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-[var(--foreground)]">
              Verification code
            </span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={6}
              pattern="\d{6}"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="6-digit code"
              className="ui-input !rounded-xl !text-[14px] font-mono tracking-[0.35em]"
            />
          </label>

          <PasswordField
            label="New password"
            value={newPassword}
            onChange={setNewPassword}
            autoComplete="new-password"
            placeholder="At least 6 characters"
            show={showNew}
            onToggleShow={() => setShowNew((v) => !v)}
          />
          <PasswordField
            label="Confirm new password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
            placeholder="Repeat new password"
            show={showConfirm}
            onToggleShow={() => setShowConfirm((v) => !v)}
          />

          {passwordError ? (
            <p className="rounded-xl bg-[var(--danger-soft)] px-3.5 py-2.5 text-[13px] text-[var(--danger)]">
              {passwordError}
            </p>
          ) : null}
          {passwordSuccess ? (
            <p className="rounded-xl bg-[var(--success-soft)] px-3.5 py-2.5 text-[13px] text-[#027a48]">
              {passwordSuccess}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={passwordLoading || !userEmail || !codeSent}
            className="ui-btn-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {passwordLoading ? "Updating…" : "Update password"}
          </button>
        </form>
      </section>
    </SettingsShell>
  );
}
