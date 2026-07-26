import { create } from "zustand";

type Theme = "system" | "light" | "dark";

type PreferencesState = {
  apiBaseUrl: string;
  theme: Theme;
  selectedHouseholdID: number | null;
  setApiBaseUrl: (value: string) => void;
  setTheme: (theme: Theme) => void;
  setSelectedHouseholdID: (householdID: number | null) => void;
};

export const usePreferences = create<PreferencesState>((set) => ({
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "",
  theme: "system",
  selectedHouseholdID: Number(window.localStorage.getItem("selected_household_id")) || null,
  setApiBaseUrl: (apiBaseUrl) => set({ apiBaseUrl }),
  setTheme: (theme) => {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", theme === "dark" || (theme === "system" && prefersDark));
    set({ theme });
  },
  setSelectedHouseholdID: (selectedHouseholdID) => {
    if (selectedHouseholdID) {
      window.localStorage.setItem("selected_household_id", String(selectedHouseholdID));
    } else {
      window.localStorage.removeItem("selected_household_id");
    }
    set({ selectedHouseholdID });
  }
}));
