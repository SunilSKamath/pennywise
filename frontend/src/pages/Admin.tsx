import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, ShieldCheck, UserCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { api, type Household, type User } from "../lib/api";

export function Admin({ currentUser }: { currentUser: User }) {
  const queryClient = useQueryClient();
  const [householdName, setHouseholdName] = useState("");
  const [householdCurrency, setHouseholdCurrency] = useState("INR");
  const users = useQuery({ queryKey: ["admin-users"], queryFn: api.users });
  const households = useQuery({ queryKey: ["admin-households"], queryFn: api.households });
  const updateAccess = useMutation({
    mutationFn: ({ id, role, status }: { id: number; role: User["role"]; status: User["status"] }) =>
      api.updateUserAccess(id, { role, status }),
    onSuccess: async (updated) => {
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      if (updated.id === currentUser.id) {
        queryClient.setQueryData(["me"], updated);
      }
    }
  });
  const updateHouseholds = useMutation({
    mutationFn: ({ id, householdIDs }: { id: number; householdIDs: number[] }) => api.updateUserHouseholds(id, householdIDs),
    onSuccess: async (updated) => {
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      if (updated.id === currentUser.id) {
        queryClient.setQueryData(["me"], updated);
      }
    }
  });
  const createHousehold = useMutation({
    mutationFn: api.createHousehold,
    onSuccess: async () => {
      setHouseholdName("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-households"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
        queryClient.invalidateQueries({ queryKey: ["me"] })
      ]);
    }
  });

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm font-semibold text-fern">Access control</p>
        <h1 className="page-title">Admin</h1>
      </header>

      <section className="panel p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-sky text-fern">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold">Households</h2>
            <p className="text-sm text-stone-500 dark:text-stone-400">Create households before assigning access.</p>
          </div>
        </div>
        <form
          className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_120px_48px]"
          onSubmit={(event) => {
            event.preventDefault();
            if (householdName.trim()) {
              createHousehold.mutate({ name: householdName.trim(), base_currency_code: householdCurrency });
            }
          }}
        >
          <input className="control min-w-0" value={householdName} onChange={(event) => setHouseholdName(event.target.value)} placeholder="Parents, Personal, Office" />
          <select className="control min-w-0" value={householdCurrency} onChange={(event) => setHouseholdCurrency(event.target.value)}>
            {["INR", "USD", "EUR", "GBP", "AED", "SGD"].map((currency) => (
              <option key={currency} value={currency}>{currency}</option>
            ))}
          </select>
          <Button className="w-12 px-0" aria-label="Create household" disabled={createHousehold.isPending}>
            <Plus className="h-5 w-5" />
          </Button>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          {(households.data ?? []).map((household) => (
            <span key={household.id} className="rounded-full bg-oat px-3 py-2 text-sm font-semibold dark:bg-stone-800">
              {household.name} / {household.base_currency_code}
            </span>
          ))}
        </div>
      </section>

      <section className="panel p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-sky text-fern">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold">Users</h2>
            <p className="text-sm text-stone-500 dark:text-stone-400">Approve household access and assign roles.</p>
          </div>
        </div>

        {users.isLoading || households.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        ) : (
          <div className="space-y-3">
            {(users.data ?? []).map((user) => (
              <UserAccessRow
                key={user.id}
                user={user}
                currentUserID={currentUser.id}
                isSaving={updateAccess.isPending}
                households={households.data ?? []}
                onChange={(role, status) => updateAccess.mutate({ id: user.id, role, status })}
                onHouseholdsChange={(householdIDs) => updateHouseholds.mutate({ id: user.id, householdIDs })}
              />
            ))}
          </div>
        )}

        {updateAccess.error && <p className="mt-3 rounded-xl bg-coral/10 p-3 text-sm font-semibold text-coral">{updateAccess.error.message}</p>}
        {updateHouseholds.error && <p className="mt-3 rounded-xl bg-coral/10 p-3 text-sm font-semibold text-coral">{updateHouseholds.error.message}</p>}
        {createHousehold.error && <p className="mt-3 rounded-xl bg-coral/10 p-3 text-sm font-semibold text-coral">{createHousehold.error.message}</p>}
      </section>
    </div>
  );
}

function UserAccessRow({
  user,
  currentUserID,
  isSaving,
  households,
  onChange
  ,onHouseholdsChange
}: {
  user: User;
  currentUserID: number;
  isSaving: boolean;
  households: Household[];
  onChange: (role: User["role"], status: User["status"]) => void;
  onHouseholdsChange: (householdIDs: number[]) => void;
}) {
  const initials = (user.name || user.email || "U").slice(0, 1).toUpperCase();
  const isSelf = user.id === currentUserID;

  return (
    <div className="grid gap-3 rounded-xl bg-mist p-3 dark:bg-stone-800">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_140px_140px_120px] lg:items-center">
      <div className="flex min-w-0 items-center gap-3">
        {user.picture_url ? (
          <img className="h-11 w-11 rounded-2xl object-cover" src={user.picture_url} alt="" />
        ) : (
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-fern text-sm font-extrabold text-white">{initials}</div>
        )}
        <div className="min-w-0">
          <p className="truncate font-bold">{user.name || "Unnamed user"} {isSelf && <span className="text-xs text-stone-500">(you)</span>}</p>
          <p className="truncate text-sm text-stone-500 dark:text-stone-400">{user.email}</p>
        </div>
      </div>

      <select className="control min-w-0" value={user.role} onChange={(event) => onChange(event.target.value as User["role"], user.status)} disabled={isSaving}>
        <option value="user">User</option>
        <option value="admin">Admin</option>
      </select>

      <select
        className="control min-w-0"
        value={user.status}
        onChange={(event) => onChange(user.role, event.target.value as User["status"])}
        disabled={isSaving || isSelf}
      >
        <option value="pending">Pending</option>
        <option value="active">Active</option>
      </select>

      {user.status === "pending" ? (
        <Button disabled={isSaving} onClick={() => onChange(user.role, "active")}>
          <UserCheck className="h-5 w-5" />
          Approve
        </Button>
      ) : (
        <span className="rounded-xl bg-white px-3 py-2 text-center text-sm font-bold text-fern dark:bg-stone-950">Active</span>
      )}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-stone-200 pt-3 dark:border-stone-700">
        {households.map((household) => {
          const checked = user.households.some((item) => item.id === household.id);
          return (
            <label key={household.id} className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-3 text-sm font-semibold dark:bg-stone-950">
              <input
                type="checkbox"
                checked={checked}
                onChange={(event) => {
                  const current = user.households.map((item) => item.id);
                  const next = event.target.checked
                    ? [...current, household.id]
                    : current.filter((id) => id !== household.id);
                  onHouseholdsChange(next);
                }}
              />
              {household.name}
            </label>
          );
        })}
      </div>
    </div>
  );
}
