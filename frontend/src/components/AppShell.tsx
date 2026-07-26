import { useQueryClient } from "@tanstack/react-query";
import { CalendarRange, CirclePlus, Home, LayoutDashboard, List, Menu, PiggyBank, Settings, ShieldCheck, Target, X } from "lucide-react";
import type { PropsWithChildren } from "react";
import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { InstallPrompt } from "./InstallPrompt";
import type { User } from "../lib/api";
import { usePreferences } from "../lib/store";
import { cn } from "../lib/utils";

const baseNavItems = [
  { to: "/", label: "Home", icon: Home },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/expenses", label: "Expenses", icon: List },
  { to: "/reports", label: "Reports", icon: CalendarRange },
  { to: "/month-review", label: "Month review", icon: CalendarRange },
  { to: "/savings", label: "Savings", icon: PiggyBank },
  { to: "/add", label: "Add expense", icon: CirclePlus },
  { to: "/budgets", label: "Budgets", icon: Target },
  { to: "/settings", label: "Settings", icon: Settings }
];

const adminNavItem = { to: "/admin", label: "Admin", icon: ShieldCheck };

type AppShellProps = PropsWithChildren<{
  user: User;
}>;

export function AppShell({ children, user }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navItems = user.role === "admin" ? [...baseNavItems, adminNavItem] : baseNavItems;
  const selectedHouseholdID = usePreferences((state) => state.selectedHouseholdID);
  const setSelectedHouseholdID = usePreferences((state) => state.setSelectedHouseholdID);
  const queryClient = useQueryClient();
  const households = user.households.length > 0 ? user.households : [{ id: user.household_id, name: `Household ${user.household_id}`, base_currency_code: "INR" }];
  const activeHouseholdID = selectedHouseholdID && households.some((household) => household.id === selectedHouseholdID) ? selectedHouseholdID : user.household_id;

  return (
    <div className="min-h-screen bg-mist text-ink dark:bg-stone-950 dark:text-stone-50">
      {sidebarOpen && (
        <button
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-stone-200 bg-white/95 p-5 backdrop-blur transition-transform duration-200 dark:border-stone-800 dark:bg-stone-950/[0.96]",
          "md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-fern text-lg font-extrabold text-white">P</div>
            <div>
              <p className="text-lg font-extrabold">Pennywise</p>
              <p className="text-xs text-stone-500 dark:text-stone-400">Family spending</p>
            </div>
          </div>
          <button
            className="grid h-10 w-10 place-items-center rounded-xl text-stone-500 transition hover:bg-stone-100 md:hidden dark:hover:bg-stone-900"
            aria-label="Close menu"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto">
          <p className="mb-2 px-3 text-xs font-bold uppercase tracking-wide text-stone-400">Pages</p>
          {navItems.map((item) => (
            <NavItem key={item.to} {...item} onNavigate={() => setSidebarOpen(false)} />
          ))}
        </nav>

        {households.length > 1 && (
          <label className="mt-4 block space-y-2">
            <span className="text-xs font-bold uppercase text-stone-500 dark:text-stone-400">Household</span>
            <select
              className="control h-11 w-full text-sm"
              value={activeHouseholdID}
              onChange={async (event) => {
                setSelectedHouseholdID(Number(event.target.value));
                await Promise.all([
                  queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
                  queryClient.invalidateQueries({ queryKey: ["expenses"] }),
                  queryClient.invalidateQueries({ queryKey: ["budgets"] })
                ]);
              }}
            >
              {households.map((household) => (
                <option key={household.id} value={household.id}>
                  {household.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="mt-4 rounded-2xl border border-stone-200 bg-mist p-3 dark:border-stone-800 dark:bg-stone-900">
          <UserBadge user={user} />
        </div>
      </aside>

      <div className="md:ml-72">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-stone-200/80 bg-mist/90 px-4 py-3 backdrop-blur md:hidden dark:border-stone-800 dark:bg-stone-950/90">
          <button
            className="grid h-11 w-11 place-items-center rounded-xl border border-stone-200 bg-white text-ink shadow-soft dark:border-stone-700 dark:bg-stone-900"
            aria-label="Open navigation"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{navItems.find((item) => item.to === location.pathname)?.label ?? "Pennywise"}</p>
            <p className="truncate text-xs text-stone-500 dark:text-stone-400">{user.name || user.email}</p>
          </div>
        </header>

        <main className="min-h-screen px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1.25rem+env(safe-area-inset-top))] md:px-8 md:pb-10 md:pt-8">
          <div className="mx-auto w-full max-w-[1200px]">{children}</div>
        </main>
      </div>

      <InstallPrompt />
    </div>
  );
}

function UserBadge({ user }: { user: User }) {
  const initials = (user.name || user.email || "U").slice(0, 1).toUpperCase();

  return (
    <div className="flex min-w-0 items-center gap-3">
      {user.picture_url ? (
        <img className="h-10 w-10 rounded-2xl object-cover" src={user.picture_url} alt="" />
      ) : (
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-fern text-sm font-extrabold text-white">{initials}</div>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-bold">{user.name || "Signed in"}</p>
        <p className="truncate text-xs text-stone-500 dark:text-stone-400">
          {user.role}
          {user.role === "admin" ? " · admin access" : ""}
        </p>
      </div>
    </div>
  );
}

function NavItem({
  to,
  label,
  icon: Icon,
  onNavigate
}: {
  to: string;
  label: string;
  icon: typeof Home;
  onNavigate?: () => void;
}) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "flex h-12 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition",
          isActive ? "bg-fern text-white shadow-soft" : "text-stone-500 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-900"
        )
      }
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span>{label}</span>
    </NavLink>
  );
}
