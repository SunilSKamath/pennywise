import { useQueryClient } from "@tanstack/react-query";
import { CirclePlus, CalendarRange, LayoutDashboard, List, Menu, Target, X } from "lucide-react";
import type { PropsWithChildren } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { InstallPrompt } from "./InstallPrompt";
import type { User } from "../lib/api";
import { usePreferences } from "../lib/store";
import { cn } from "../lib/utils";

const navItems = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/expenses", label: "Expenses", icon: List },
  { to: "/budgets", label: "Budgets", icon: Target },
  { to: "/yearly-budgets", label: "Yearly budgets", icon: CalendarRange }
];

type AppShellProps = PropsWithChildren<{
  user: User;
}>;

export function AppShell({ children, user }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const drawerRef = useRef<HTMLDialogElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const showAdd = location.pathname !== "/add" && !/^\/expenses\/[^/]+\/edit$/.test(location.pathname);
  const selectedHouseholdID = usePreferences((state) => state.selectedHouseholdID);
  const setSelectedHouseholdID = usePreferences((state) => state.setSelectedHouseholdID);
  const queryClient = useQueryClient();
  const households = user.households.length > 0 ? user.households : [{ id: user.household_id, name: `Household ${user.household_id}`, base_currency_code: "INR" }];
  const activeHouseholdID = selectedHouseholdID && households.some((household) => household.id === selectedHouseholdID) ? selectedHouseholdID : user.household_id;
  const titleId = useId();

  const closeSidebar = () => setSidebarOpen(false);

  useEffect(() => {
    const drawer = drawerRef.current;
    if (!drawer) return;

    if (sidebarOpen) {
      if (!drawer.open) drawer.showModal();
      return;
    }

    if (drawer.open) drawer.close();
  }, [sidebarOpen]);

  useEffect(() => {
    closeSidebar();
  }, [location.pathname]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const onChange = () => {
      if (media.matches) closeSidebar();
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const onHouseholdChange = async (householdId: number) => {
    setSelectedHouseholdID(householdId);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["expenses"] }),
      queryClient.invalidateQueries({ queryKey: ["budgets"] }),
      queryClient.invalidateQueries({ queryKey: ["yearly-budgets"] }),
      queryClient.invalidateQueries({ queryKey: ["categories"] }),
      queryClient.invalidateQueries({ queryKey: ["payment-sources"] }),
      queryClient.invalidateQueries({ queryKey: ["tags"] })
    ]);
  };

  const sidebarBody = (opts: { showClose: boolean; showDesktopAdd: boolean; onNavigate?: () => void }) => (
    <SidebarBody
      user={user}
      showAdd={showAdd}
      showClose={opts.showClose}
      showDesktopAdd={opts.showDesktopAdd}
      households={households}
      activeHouseholdID={activeHouseholdID}
      onHouseholdChange={onHouseholdChange}
      onClose={opts.onNavigate ?? closeSidebar}
      onNavigate={opts.onNavigate ?? closeSidebar}
    />
  );

  return (
    <div className="min-h-screen bg-mist text-ink dark:bg-stone-950 dark:text-stone-50">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-stone-200 bg-white/95 p-5 backdrop-blur md:flex dark:border-stone-800 dark:bg-stone-950/[0.96]">
        {sidebarBody({ showClose: false, showDesktopAdd: true })}
      </aside>

      <dialog
        ref={drawerRef}
        className="nav-drawer md:hidden"
        aria-labelledby={titleId}
        onCancel={closeSidebar}
        onClose={() => {
          setSidebarOpen(false);
          queueMicrotask(() => menuButtonRef.current?.focus({ preventScroll: true }));
        }}
        onClick={(event) => {
          if (event.target === drawerRef.current) closeSidebar();
        }}
      >
        <div className="nav-drawer__panel" onClick={(event) => event.stopPropagation()}>
          <span id={titleId} className="sr-only">
            Navigation
          </span>
          {sidebarBody({ showClose: true, showDesktopAdd: false, onNavigate: closeSidebar })}
        </div>
      </dialog>

      <div className="md:ml-72">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-stone-200/80 bg-mist/90 px-4 py-3 backdrop-blur md:hidden dark:border-stone-800 dark:bg-stone-950/90">
          <button
            ref={menuButtonRef}
            className="grid h-11 w-11 place-items-center rounded-xl border border-stone-200 bg-white text-ink shadow-soft dark:border-stone-700 dark:bg-stone-900"
            aria-label="Open navigation"
            aria-expanded={sidebarOpen}
            aria-haspopup="dialog"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{pageLabel(location.pathname)}</p>
            <p className="truncate text-xs text-stone-500 dark:text-stone-400">{user.name || user.email}</p>
          </div>
          {showAdd && <AddExpenseButton onNavigate={closeSidebar} />}
        </header>

        <main className="min-h-screen px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1.25rem+env(safe-area-inset-top))] md:px-8 md:pb-10 md:pt-8">
          <div className="mx-auto w-full max-w-[1200px]">{children}</div>
        </main>
      </div>

      <InstallPrompt />
    </div>
  );
}

function SidebarBody({
  user,
  showAdd,
  showClose,
  showDesktopAdd,
  households,
  activeHouseholdID,
  onHouseholdChange,
  onClose,
  onNavigate
}: {
  user: User;
  showAdd: boolean;
  showClose: boolean;
  showDesktopAdd: boolean;
  households: User["households"];
  activeHouseholdID: number;
  onHouseholdChange: (id: number) => Promise<void>;
  onClose: () => void;
  onNavigate: () => void;
}) {
  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-fern text-lg font-extrabold text-white">P</div>
          <div>
            <p className="text-lg font-extrabold">Pennywise</p>
            <p className="text-xs text-stone-500 dark:text-stone-400">Family spending</p>
            <p className="text-xs text-stone-500 dark:text-stone-400">v{__APP_VERSION__}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {showAdd && showDesktopAdd && <AddExpenseButton className="hidden md:grid" onNavigate={onNavigate} />}
          {showClose && (
            <button
              className="grid h-11 w-11 place-items-center rounded-xl text-stone-500 transition hover:bg-stone-100 dark:hover:bg-stone-900"
              aria-label="Close menu"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto overscroll-contain">
        <p className="mb-2 px-3 text-xs font-bold uppercase tracking-wide text-stone-400">Pages</p>
        {navItems.map((item) => (
          <NavItem key={item.to} {...item} onNavigate={onNavigate} />
        ))}
      </nav>

      {households.length > 1 && (
        <label className="mt-4 block space-y-2">
          <span className="text-xs font-bold uppercase text-stone-500 dark:text-stone-400">Household</span>
          <select
            className="control h-11 w-full text-sm"
            value={activeHouseholdID}
            onChange={(event) => {
              void onHouseholdChange(Number(event.target.value));
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

      <Link
        to="/settings"
        onClick={onNavigate}
        className="mt-4 block rounded-2xl border border-stone-200 bg-mist p-3 dark:border-stone-800 dark:bg-stone-900"
      >
        <UserBadge user={user} />
      </Link>
    </>
  );
}

function UserBadge({ user }: { user: User }) {
  const initials = (user.name || user.email || "U").slice(0, 1).toUpperCase();

  return (
    <div className="flex min-w-0 items-center gap-3">
      {user.picture_url ? (
        <img className="h-10 w-10 rounded-2xl object-cover" src={user.picture_url} alt="" loading="lazy" decoding="async" />
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

function pageLabel(pathname: string) {
  return (
    navItems.find((item) => item.to === pathname)?.label ??
    (pathname === "/settings"
      ? "Settings"
      : pathname === "/admin"
        ? "Admin"
        : pathname === "/add"
          ? "Add expense"
          : pathname.endsWith("/edit")
            ? "Edit expense"
            : "Pennywise")
  );
}

function AddExpenseButton({ className, onNavigate }: { className?: string; onNavigate?: () => void }) {
  return (
    <Link
      className={cn("grid h-11 w-11 place-items-center rounded-xl bg-fern text-white shadow-soft", className)}
      to="/add"
      aria-label="Add expense"
      onClick={onNavigate}
    >
      <CirclePlus className="h-5 w-5" />
    </Link>
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
  icon: typeof LayoutDashboard;
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
