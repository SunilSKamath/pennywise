import { usePreferences } from "./store";

export type Category = {
  id: number;
  name: string;
  emoji: string;
};

export type PaymentSource = {
  id: number;
  name: string;
  type: "bank_account" | "credit_card" | "upi" | "cash" | "other";
  currency_code: string;
};

export type Expense = {
  id: number;
  household_id: number;
  original_amount_minor: number;
  original_currency_code: string;
  converted_amount_minor: number;
  converted_currency_code: string;
  category_id: number;
  payment_source_id: number;
  merchant: string;
  notes: string;
  expense_date: string;
  tags: string[];
  created_at: string;
};

export type Tag = {
  id: number;
  household_id: number;
  name: string;
};

export type User = {
  id: number;
  household_id: number;
  google_id: string;
  email: string;
  name: string;
  picture_url: string;
  role: "admin" | "user";
  status: "pending" | "active";
  households: Household[];
};

export type Household = {
  id: number;
  name: string;
  base_currency_code: string;
};

export type DashboardSummary = {
  month_total: number;
  by_category: Array<{
    id: number;
    name: string;
    amount_minor: number;
    transaction_count: number;
    currency_code: string;
  }>;
  by_payment_source: Array<{
    id: number;
    name: string;
    amount_minor: number;
    transaction_count: number;
    currency_code: string;
  }>;
};

export type Budget = {
  id: number;
  household_id: number;
  category_id: number;
  month: string;
  amount_minor: number;
  currency_code: string;
  spent_minor: number;
  created_at: string;
  updated_at: string;
};

export type UpsertBudgetPayload = {
  category_id: number;
  month: string;
  amount_minor: number;
  currency_code: string;
};

export type CreateExpensePayload = {
  original_amount_minor: number;
  original_currency_code: string;
  category_id: number;
  payment_source_id: number;
  merchant: string;
  notes?: string;
  expense_date: string;
  metadata_json?: string;
  tags?: string[];
};

export type UpdateExpensePayload = Partial<CreateExpensePayload>;

export type ExpenseFilters = {
  search?: string;
  date_from?: string;
  date_to?: string;
  category_id?: number | "";
  payment_source_id?: number | "";
  tags?: string[];
  limit?: number;
  offset?: number;
};

function queryString(params: ExpenseFilters) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }
    if (Array.isArray(value)) {
      if (value.length > 0) {
        search.set(key, value.join(","));
      }
      return;
    }
    search.set(key, String(value));
  });
  const value = search.toString();
  return value ? `?${value}` : "";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = usePreferences.getState().apiBaseUrl;
  const selectedHouseholdID = usePreferences.getState().selectedHouseholdID;
  const response = await fetch(`${baseUrl}/api/v1${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(selectedHouseholdID ? { "X-Household-ID": String(selectedHouseholdID) } : {}),
      ...init?.headers
    }
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Something went wrong. Please try again.");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

function authURL(path: string) {
  return `${usePreferences.getState().apiBaseUrl}${path}`;
}

export const api = {
  me: () => request<User>("/me"),
  loginURL: () => authURL("/auth/google/login"),
  logout: async () => {
    const response = await fetch(authURL("/auth/logout"), {
      method: "POST",
      credentials: "include"
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? "Could not sign out. Please try again.");
    }
  },
  users: () => request<User[]>("/admin/users"),
  updateUserAccess: (id: number, payload: Pick<User, "role" | "status">) =>
    request<User>(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  households: () => request<Household[]>("/admin/households"),
  createHousehold: (payload: Pick<Household, "name" | "base_currency_code">) =>
    request<Household>("/admin/households", { method: "POST", body: JSON.stringify(payload) }),
  updateUserHouseholds: (id: number, householdIDs: number[]) =>
    request<User>(`/admin/users/${id}/households`, { method: "PATCH", body: JSON.stringify({ household_ids: householdIDs }) }),
  dashboard: (month = new Date().toISOString().slice(0, 7)) => request<DashboardSummary>(`/dashboard?month=${month}`),
  budgets: (month = new Date().toISOString().slice(0, 7)) => request<Budget[]>(`/budgets?month=${month}`),
  upsertBudget: (payload: UpsertBudgetPayload) =>
    request<Budget>("/budgets", { method: "PUT", body: JSON.stringify(payload) }),
  deleteBudget: (id: number) => request<void>(`/budgets/${id}`, { method: "DELETE" }),
  categories: () => request<Category[]>("/categories"),
  createCategory: (name: string, emoji = "📦") =>
    request<Category>("/categories", { method: "POST", body: JSON.stringify({ name, emoji }) }),
  paymentSources: () => request<PaymentSource[]>("/payment-sources"),
  createPaymentSource: (payload: Omit<PaymentSource, "id">) =>
    request<PaymentSource>("/payment-sources", { method: "POST", body: JSON.stringify(payload) }),
  tags: (search = "") => request<Tag[]>(`/tags${queryString({ search })}`),
  expenses: (filters: ExpenseFilters = { limit: 50 }) => request<Expense[]>(`/expenses${queryString(filters)}`),
  expense: (id: number) => request<Expense>(`/expenses/${id}`),
  createExpense: (payload: CreateExpensePayload) =>
    request<Expense>("/expenses", { method: "POST", body: JSON.stringify(payload) }),
  updateExpense: (id: number, payload: UpdateExpensePayload) =>
    request<Expense>(`/expenses/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteExpense: (id: number) => request<void>(`/expenses/${id}`, { method: "DELETE" })
};
