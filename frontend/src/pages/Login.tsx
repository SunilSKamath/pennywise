import { LogIn } from "lucide-react";
import { InstallPrompt } from "../components/InstallPrompt";
import { api } from "../lib/api";

export function Login() {
  return (
    <main className="grid min-h-screen place-items-center bg-mist px-4 py-8 text-ink dark:bg-stone-950 dark:text-stone-50">
      <section className="w-full max-w-md">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-fern text-xl font-extrabold text-white">P</div>
          <div>
            <h1 className="text-2xl font-extrabold">Pennywise</h1>
            <p className="text-sm text-stone-500 dark:text-stone-400">Family spending</p>
          </div>
        </div>

        <div className="panel p-5 sm:p-6">
          <p className="text-sm font-semibold text-fern">Account</p>
          <h2 className="mt-1 text-3xl font-extrabold">Sign in</h2>
          <p className="mt-3 text-sm leading-6 text-stone-500 dark:text-stone-400">
            Use your Google account to access your household expenses and shared spending history.
          </p>

          <a
            className="mt-6 inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-fern px-4 text-base font-bold text-white shadow-soft transition hover:bg-fern/90"
            href={api.loginURL()}
          >
            <LogIn className="h-5 w-5" />
            Continue with Google
          </a>
        </div>
      </section>
      <InstallPrompt />
    </main>
  );
}
