import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { Skeleton } from "./components/Skeleton";
import { api } from "./lib/api";
import { usePreferences } from "./lib/store";
import { AddExpense } from "./pages/AddExpense";
import { Budgets } from "./pages/Budgets";
import { Dashboard } from "./pages/Dashboard";
import { EditExpense } from "./pages/EditExpense";
import { Expenses } from "./pages/Expenses";
import { Login } from "./pages/Login";
import { Settings } from "./pages/Settings";
import { Admin } from "./pages/Admin";
import { PendingApproval } from "./pages/PendingApproval";

export default function App() {
  const theme = usePreferences((state) => state.theme);
  const setTheme = usePreferences((state) => state.setTheme);
  const me = useQuery({
    queryKey: ["me"],
    queryFn: api.me,
    retry: false
  });

  useEffect(() => {
    setTheme(theme);
  }, [setTheme, theme]);

  if (me.isLoading) {
    return (
      <div className="min-h-screen bg-mist p-4 dark:bg-stone-950 md:p-8">
        <div className="mx-auto max-w-xl space-y-4">
          <Skeleton className="h-16" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (me.isError || !me.data) {
    return <Login />;
  }

  if (me.data.status !== "active") {
    return <PendingApproval user={me.data} />;
  }

  return (
    <AppShell user={me.data}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/dashboard" element={<Navigate to="/" replace />} />
        <Route path="/reports" element={<Navigate to="/expenses" replace />} />
        <Route path="/month-review" element={<Navigate to="/expenses" replace />} />
        <Route path="/savings" element={<Navigate to="/budgets" replace />} />
        <Route path="/budgets" element={<Budgets />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/expenses/:id/edit" element={<EditExpense />} />
        <Route path="/add" element={<AddExpense />} />
        <Route path="/settings" element={<Settings user={me.data} />} />
        {me.data.role === "admin" && <Route path="/admin" element={<Admin currentUser={me.data} />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
