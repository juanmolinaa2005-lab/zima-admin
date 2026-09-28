import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <main
      id="main"
      tabIndex={-1}
      className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background p-5 outline-none"
    >
      <div aria-hidden className="login-aurora pointer-events-none absolute inset-0" />
      <div className="relative w-full max-w-[400px] animate-scale-in">
        <LoginForm />
        <p className="mt-6 text-center text-[12px] text-[var(--muted-soft)]">
          © Zima Admin
        </p>
      </div>
    </main>
  );
}
