import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, LogOut } from "lucide-react";
import { Button } from "../components/Button";
import { InstallPrompt } from "../components/InstallPrompt";
import { api, type User } from "../lib/api";

export function PendingApproval({ user }: { user: User }) {
  const queryClient = useQueryClient();
  const logout = useMutation({
    mutationFn: api.logout,
    onSuccess: async () => {
      queryClient.setQueryData(["me"], null);
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    }
  });

  return (
    <main className="grid min-h-screen place-items-center bg-mist px-4 py-8 text-ink dark:bg-stone-950 dark:text-stone-50">
      <section className="panel w-full max-w-md p-5 text-center sm:p-6">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-sky text-fern">
          <Clock className="h-7 w-7" />
        </div>
        <p className="text-sm font-semibold text-fern">Account pending</p>
        <h1 className="mt-1 text-2xl font-extrabold">Waiting for admin approval</h1>
        <p className="mt-3 text-sm leading-6 text-stone-500 dark:text-stone-400">
          {user.email} is signed in, but an admin needs to activate this account before Pennywise can show household data.
        </p>
        <Button className="mt-6 w-full" variant="secondary" onClick={() => logout.mutate()} disabled={logout.isPending}>
          <LogOut className="h-5 w-5" />
          {logout.isPending ? "Signing out" : "Sign out"}
        </Button>
      </section>
      <InstallPrompt />
    </main>
  );
}
