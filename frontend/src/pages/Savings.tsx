import { useQuery } from "@tanstack/react-query";
import { PiggyBank, Target, TrendingDown } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Skeleton } from "../components/Skeleton";
import { api } from "../lib/api";
import { categoryLabel, currentMonth, formatMoney, monthLabel } from "../lib/utils";

export function Savings() {
  const [month, setMonth] = useState(currentMonth);
  const dashboard = useQuery({ queryKey: ["dashboard", month], queryFn: () => api.dashboard(month) });
  const budgets = useQuery({ queryKey: ["budgets", month], queryFn: () => api.budgets(month), retry: false });
  const categories = useQuery({ queryKey: ["categories"], queryFn: api.categories });

  const currency = budgets.data?.[0]?.currency_code ?? dashboard.data?.by_category[0]?.currency_code ?? "INR";
  const planned = useMemo(() => (budgets.data ?? []).reduce((sum, budget) => sum + budget.amount_minor, 0), [budgets.data]);
  const spent = dashboard.data?.month_total ?? 0;
  const remaining = planned - spent;
  const savingsRate = planned > 0 ? Math.max(0, (remaining / planned) * 100) : 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-fern">Plan surplus</p>
          <h1 className="page-title">Savings</h1>
        </div>
        <input className="control h-11 w-[9.5rem] text-sm" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
      </header>

      <section className="panel overflow-hidden">
        <div className="bg-fern p-6 text-white">
          <p className="text-sm font-medium text-white/75">{monthLabel(month)} available after budget</p>
          {dashboard.isLoading || budgets.isLoading ? (
            <Skeleton className="mt-3 h-10 w-44 bg-white/20" />
          ) : (
            <p className="mt-2 text-4xl font-extrabold">{formatMoney(Math.max(0, remaining), currency)}</p>
          )}
          <p className="mt-2 text-sm text-white/75">
            {planned > 0 ? `${savingsRate.toFixed(0)}% of planned budget left` : "Set budgets to estimate savings"}
          </p>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <Stat icon={Target} label="Planned budget" value={formatMoney(planned, currency)} loading={budgets.isLoading} />
        <Stat icon={TrendingDown} label="Spent" value={formatMoney(spent, currency)} loading={dashboard.isLoading} />
        <Stat icon={PiggyBank} label={remaining >= 0 ? "Remaining" : "Over plan"} value={formatMoney(Math.abs(remaining), currency)} loading={dashboard.isLoading || budgets.isLoading} tone={remaining >= 0 ? "fern" : "coral"} />
      </section>

      <section className="panel p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold">Savings by category plan</h2>
          <Link className="text-sm font-semibold text-fern" to="/budgets">Manage budgets</Link>
        </div>
        {(budgets.data ?? []).length === 0 ? (
          <p className="text-sm text-stone-500 dark:text-stone-400">Create category budgets to track what remains available each month.</p>
        ) : (
          <div className="space-y-4">
            {(budgets.data ?? []).map((budget) => {
              const category = categories.data?.find((item) => item.id === budget.category_id);
              const left = budget.amount_minor - budget.spent_minor;
              const percent = budget.amount_minor > 0 ? Math.min(100, (budget.spent_minor / budget.amount_minor) * 100) : 0;
              return (
                <div key={budget.id}>
                  <div className="mb-1 flex justify-between gap-3 text-sm">
                    <span className="truncate font-semibold">{category ? categoryLabel(category) : `Category ${budget.category_id}`}</span>
                    <span className={left >= 0 ? "font-bold text-fern" : "font-bold text-coral"}>
                      {left >= 0 ? `${formatMoney(left, budget.currency_code)} left` : `${formatMoney(Math.abs(left), budget.currency_code)} over`}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700">
                    <div className={left >= 0 ? "h-full rounded-full bg-fern" : "h-full rounded-full bg-coral"} style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  loading,
  tone = "fern"
}: {
  icon: typeof PiggyBank;
  label: string;
  value: string;
  loading?: boolean;
  tone?: "fern" | "coral";
}) {
  return (
    <article className="panel p-4">
      <Icon className={tone === "coral" ? "h-5 w-5 text-coral" : "h-5 w-5 text-fern"} />
      <p className="mt-3 text-xs font-bold uppercase tracking-wide text-stone-500 dark:text-stone-400">{label}</p>
      {loading ? <Skeleton className="mt-2 h-8 w-24" /> : <p className="mt-1 text-2xl font-extrabold">{value}</p>}
    </article>
  );
}
