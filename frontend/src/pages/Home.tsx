import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, CalendarRange, CirclePlus, LayoutDashboard, List, PiggyBank, Settings, Target } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";
import { ExpenseRow } from "../components/ExpenseRow";
import { Skeleton } from "../components/Skeleton";
import { api } from "../lib/api";
import { formatMoney } from "../lib/utils";

const quickLinks = [
  { to: "/dashboard", label: "Dashboard", description: "Monthly overview and trends", icon: LayoutDashboard },
  { to: "/expenses", label: "Expenses", description: "Review and search all entries", icon: List },
  { to: "/reports", label: "Reports", description: "Date range analysis and filters", icon: CalendarRange },
  { to: "/month-review", label: "Month review", description: "Evaluate a month against budgets", icon: CalendarRange },
  { to: "/savings", label: "Savings", description: "Track budget surplus", icon: PiggyBank },
  { to: "/budgets", label: "Budgets", description: "Set category spending limits", icon: Target },
  { to: "/settings", label: "Settings", description: "Profile, categories, theme", icon: Settings }
];

export function Home() {
  const dashboard = useQuery({ queryKey: ["dashboard"], queryFn: () => api.dashboard() });
  const expenses = useQuery({ queryKey: ["expenses"], queryFn: () => api.expenses() });
  const categories = useQuery({ queryKey: ["categories"], queryFn: api.categories });
  const paymentSources = useQuery({ queryKey: ["payment-sources"], queryFn: api.paymentSources });

  const recentExpenses = expenses.data?.slice(0, 5) ?? [];
  const currency = dashboard.data?.by_category[0]?.currency_code ?? "INR";

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-fern">Welcome back</p>
          <h1 className="page-title">Home</h1>
        </div>
        <Link className="grid h-12 w-12 place-items-center rounded-2xl bg-fern text-white shadow-soft" to="/add" aria-label="Add expense">
          <CirclePlus className="h-6 w-6" />
        </Link>
      </header>

      <section className="panel overflow-hidden">
        <div className="bg-fern p-6 text-white">
          <p className="text-sm font-medium text-white/75">This month</p>
          {dashboard.isLoading ? <Skeleton className="mt-3 h-10 w-44 bg-white/20" /> : <p className="mt-2 text-4xl font-extrabold">{formatMoney(dashboard.data?.month_total ?? 0, currency)}</p>}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        {quickLinks.map((item) => (
          <Link key={item.to} className="panel flex items-center gap-4 p-4 transition hover:border-fern/30" to={item.to}>
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-mist dark:bg-stone-800">
              <item.icon className="h-5 w-5 text-fern" />
            </div>
            <div className="min-w-0">
              <p className="font-extrabold">{item.label}</p>
              <p className="text-sm text-stone-500 dark:text-stone-400">{item.description}</p>
            </div>
          </Link>
        ))}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold">Recent expenses</h2>
          <Link className="inline-flex items-center gap-1 text-sm font-semibold text-fern" to="/expenses">
            View all <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
        {expenses.isLoading ? (
          <div className="panel p-4">
            <Skeleton className="mb-3 h-14" />
            <Skeleton className="mb-3 h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : recentExpenses.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="panel overflow-hidden px-4">
            {recentExpenses.map((expense) => (
              <ExpenseRow key={expense.id} expense={expense} categories={categories.data ?? []} paymentSources={paymentSources.data ?? []} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
