import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Category } from "./api";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function categoryLabel(category: Pick<Category, "name" | "emoji">) {
  const emoji = category.emoji || "📦";
  return `${emoji} ${category.name}`;
}

export function categoryEmoji(category?: Pick<Category, "emoji">) {
  return category?.emoji || "📦";
}

export function formatMoney(minor: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(minor / 100);
}

export function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short"
  }).format(new Date(value));
}

export function inputDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function monthBounds(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const start = new Date(year, monthNumber - 1, 1);
  const end = new Date(year, monthNumber, 0);
  return {
    from: inputDate(start),
    to: inputDate(end)
  };
}

export function monthLabel(value: string) {
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

export function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}
