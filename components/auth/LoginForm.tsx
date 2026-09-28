"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, Input, Label, TextField } from "@heroui/react";
import { createClient } from "@/lib/supabase/client";

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

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        setError(
          signInError.message === "Invalid login credentials"
            ? "Correo o contraseña incorrectos."
            : signInError.message
        );
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("No se pudo entrar. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full border border-[var(--border)] shadow-[var(--shadow-lg)]">
      <Card.Header>
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-bold text-[var(--accent-foreground)] shadow-[0_4px_12px_rgba(99,91,255,0.35)]">
          Z
        </div>
        <Card.Title className="text-[22px] font-semibold tracking-tight">Entrar a Zima</Card.Title>
        <Card.Description className="text-[14px] text-[var(--muted)]">
          Accede a tu panel de administración.
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <TextField isRequired type="email" value={email} onChange={setEmail} autoComplete="email">
            <Label>Email</Label>
            <Input placeholder="you@company.com" />
          </TextField>
          <TextField
            isRequired
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            minLength={6}
          >
            <Label>Contraseña</Label>
            <div className="relative">
              <Input className="w-full pr-10" placeholder="••••••••" />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-[var(--muted)]"
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
          </TextField>
          {error ? (
            <Alert status="danger">
              <Alert.Description>{error}</Alert.Description>
            </Alert>
          ) : null}
          <Button
            type="submit"
            variant="primary"
            fullWidth
            isDisabled={loading}
            className="mt-1 h-10 rounded-lg font-semibold shadow-[0_2px_6px_rgba(99,91,255,0.3)]"
          >
            {loading ? "Entrando…" : "Entrar"}
          </Button>
        </form>
      </Card.Content>
      <Card.Footer className="justify-center">
        <Link href="/docs" className="text-sm font-medium text-[var(--muted)] transition hover:text-[var(--accent)]">
          Ver documentación →
        </Link>
      </Card.Footer>
    </Card>
  );
}
