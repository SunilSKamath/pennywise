import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, Plus, Users, WalletCards } from "lucide-react";
import { useState } from "react";
import { Button } from "../components/Button";
import { api, type PaymentSource, type User } from "../lib/api";
import { usePreferences } from "../lib/store";
import { categoryLabel } from "../lib/utils";

const currencies = ["INR", "USD", "EUR", "GBP", "AED", "SGD"];

export function Settings({ user }: { user: User }) {
  const queryClient = useQueryClient();
  const categories = useQuery({ queryKey: ["categories"], queryFn: api.categories });
  const paymentSources = useQuery({ queryKey: ["payment-sources"], queryFn: api.paymentSources });
  const [categoryName, setCategoryName] = useState("");
  const [categoryEmoji, setCategoryEmoji] = useState("📦");
  const [sourceName, setSourceName] = useState("");
  const [sourceType, setSourceType] = useState<PaymentSource["type"]>("upi");
  const [sourceCurrency, setSourceCurrency] = useState("INR");
  const theme = usePreferences((state) => state.theme);
  const setTheme = usePreferences((state) => state.setTheme);

  const createCategory = useMutation({
    mutationFn: ({ name, emoji }: { name: string; emoji: string }) => api.createCategory(name, emoji),
    onSuccess: async () => {
      setCategoryName("");
      setCategoryEmoji("📦");
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
    }
  });

  const createSource = useMutation({
    mutationFn: api.createPaymentSource,
    onSuccess: async () => {
      setSourceName("");
      await queryClient.invalidateQueries({ queryKey: ["payment-sources"] });
    }
  });

  const logout = useMutation({
    mutationFn: api.logout,
    onSuccess: async () => {
      queryClient.setQueryData(["me"], null);
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    }
  });

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm font-semibold text-fern">Preferences</p>
        <h1 className="page-title">Settings</h1>
      </header>

      <section className="panel p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            {user.picture_url ? (
              <img className="h-14 w-14 rounded-2xl object-cover" src={user.picture_url} alt="" />
            ) : (
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-fern text-xl font-extrabold text-white">
                {(user.name || user.email || "U").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="truncate text-lg font-extrabold">{user.name || "Pennywise user"}</h2>
              <p className="truncate text-sm text-stone-500 dark:text-stone-400">{user.email || "Google account"}</p>
            </div>
          </div>
          <Button variant="secondary" onClick={() => logout.mutate()} disabled={logout.isPending}>
            <LogOut className="h-5 w-5" />
            {logout.isPending ? "Signing out" : "Sign out"}
          </Button>
        </div>
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-mist p-3 dark:bg-stone-800">
          <Users className="h-5 w-5 text-fern" />
          <div>
            <p className="text-sm font-bold">Household</p>
            <p className="text-xs text-stone-500 dark:text-stone-400">ID {user.household_id} / {user.role} / {user.status}</p>
          </div>
        </div>
        {logout.error && <p className="mt-3 rounded-xl bg-coral/10 p-3 text-sm font-semibold text-coral">{logout.error.message}</p>}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="panel p-4 sm:p-5">
          <h2 className="text-lg font-extrabold">Categories</h2>
          <form
            className="mt-4 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (categoryName.trim()) createCategory.mutate({ name: categoryName.trim(), emoji: categoryEmoji.trim() || "📦" });
            }}
          >
            <input className="control w-14 px-2 text-center text-xl" value={categoryEmoji} onChange={(event) => setCategoryEmoji(event.target.value)} aria-label="Category emoji" maxLength={4} />
            <input className="control min-w-0 flex-1" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="Food, Rent, Travel" />
            <Button className="w-12 px-0" aria-label="Add category"><Plus className="h-5 w-5" /></Button>
          </form>
          <div className="mt-4 flex flex-wrap gap-2">
            {(categories.data ?? []).map((category) => (
              <span key={category.id} className="rounded-full bg-oat px-3 py-2 text-sm font-semibold dark:bg-stone-800">{categoryLabel(category)}</span>
            ))}
          </div>
        </div>

        <div className="panel p-4 sm:p-5">
          <h2 className="text-lg font-extrabold">Payment Sources</h2>
          <form
            className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_96px] xl:grid-cols-[minmax(0,1fr)_140px_96px_48px]"
            onSubmit={(event) => {
              event.preventDefault();
              if (sourceName.trim()) {
                createSource.mutate({ name: sourceName.trim(), type: sourceType, currency_code: sourceCurrency.toUpperCase() });
              }
            }}
          >
            <input className="control min-w-0 sm:col-span-2 xl:col-span-1" value={sourceName} onChange={(event) => setSourceName(event.target.value)} placeholder="HDFC, Cash, UPI" />
            <select className="control min-w-0" value={sourceType} onChange={(event) => setSourceType(event.target.value as PaymentSource["type"])}>
              <option value="upi">UPI</option>
              <option value="credit_card">Credit Card</option>
              <option value="bank_account">Bank</option>
              <option value="cash">Cash</option>
              <option value="other">Other</option>
            </select>
            <select className="control min-w-0 px-3 text-center" value={sourceCurrency} onChange={(event) => setSourceCurrency(event.target.value)}>
              {currencies.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
            <Button className="w-12 px-0" aria-label="Add payment source"><Plus className="h-5 w-5" /></Button>
          </form>
          <div className="mt-4 space-y-2">
            {(paymentSources.data ?? []).map((source) => (
              <div key={source.id} className="flex items-center gap-3 rounded-xl bg-mist p-3 dark:bg-stone-800">
                <WalletCards className="h-5 w-5 text-fern" />
                <div>
                  <p className="font-bold">{source.name}</p>
                  <p className="text-xs text-stone-500 dark:text-stone-400">{source.type.replace("_", " ")} / {source.currency_code}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="panel p-4 sm:p-5">
        <h2 className="text-lg font-extrabold">Theme</h2>
        <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-oat p-1 dark:bg-stone-800">
          {(["system", "light", "dark"] as const).map((option) => (
            <button
              key={option}
              className={`h-11 rounded-xl text-sm font-bold capitalize transition ${theme === option ? "bg-white text-ink shadow-soft dark:bg-stone-950 dark:text-stone-50" : "text-stone-500"}`}
              onClick={() => setTheme(option)}
              type="button"
            >
              {option}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
