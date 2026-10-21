import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cn, monthLabel } from "../lib/utils";

const weekdays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function useNativePicker() {
  const [native, setNative] = useState(() => window.matchMedia("(pointer: coarse)").matches);

  useEffect(() => {
    const media = window.matchMedia("(pointer: coarse)");
    const update = () => setNative(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return native;
}

function useCloseOnOutsideClick(open: boolean, close: () => void) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [close, open]);

  return rootRef;
}

function localDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function formatDateLabel(value: string, placeholder: string) {
  const date = parseDate(value);
  if (!date) return placeholder;
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function sameDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}

function Trigger({
  label,
  text,
  placeholder,
  open,
  controls,
  className,
  onClick
}: {
  label: string;
  text: string;
  placeholder: boolean;
  open: boolean;
  controls: string;
  className?: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn("control flex w-full items-center justify-between gap-3 text-left", className)}
      type="button"
      aria-label={label}
      aria-expanded={open}
      aria-controls={controls}
      onClick={onClick}
    >
      <span className={cn("min-w-0 flex-1 truncate text-center", placeholder && "text-stone-400")}>{text}</span>
    </button>
  );
}

export function DateField({
  label = "Date",
  value,
  onChange,
  placeholder = "Choose date",
  className
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const native = useNativePicker();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const rootRef = useCloseOnOutsideClick(open, close);
  const panelId = useId();
  const selected = parseDate(value) ?? new Date();
  const [visible, setVisible] = useState(selected);

  if (native) {
    return <input className={cn("control w-full", className)} type="date" aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} />;
  }

  const year = visible.getFullYear();
  const month = visible.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: Date[] = [];
  for (let index = 0; index < firstWeekday; index += 1) days.push(new Date(year, month, index - firstWeekday + 1));
  for (let day = 1; day <= daysInMonth; day += 1) days.push(new Date(year, month, day));
  while (days.length % 7 !== 0) {
    const last = days[days.length - 1];
    days.push(new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1));
  }
  const today = new Date();

  return (
    <div className="relative" ref={rootRef}>
      <Trigger
        label={label}
        text={formatDateLabel(value, placeholder)}
        placeholder={!value}
        open={open}
        controls={panelId}
        className={className}
        onClick={() => {
          setVisible(parseDate(value) ?? new Date());
          setOpen((current) => !current);
        }}
      />
      {open && (
        <div id={panelId} className="absolute left-0 z-30 mt-2 w-[19.5rem] rounded-2xl border border-stone-200 bg-white p-3 shadow-soft dark:border-stone-700 dark:bg-stone-950">
          <div className="mb-2 flex items-center justify-between">
            <NavButton label="Previous month" onClick={() => setVisible(new Date(year, month - 1, 1))} />
            <p className="text-sm font-extrabold">{new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(visible)}</p>
            <NavButton label="Next month" onClick={() => setVisible(new Date(year, month + 1, 1))} direction="next" />
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-stone-400">
            {weekdays.map((weekday) => (
              <span key={weekday} className="grid h-8 place-items-center">{weekday}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((date) => {
              const inMonth = date.getMonth() === month;
              const chosen = Boolean(parseDate(value) && sameDay(date, parseDate(value)!));
              const isToday = sameDay(date, today);
              return (
                <button
                  key={localDate(date.getFullYear(), date.getMonth(), date.getDate())}
                  className={cn(
                    "grid h-9 place-items-center rounded-full text-sm font-semibold transition",
                    !inMonth && "text-stone-300 dark:text-stone-600",
                    inMonth && !chosen && "hover:bg-oat dark:hover:bg-stone-800",
                    isToday && !chosen && "text-fern",
                    chosen && "bg-fern text-white"
                  )}
                  type="button"
                  onClick={() => {
                    onChange(localDate(date.getFullYear(), date.getMonth(), date.getDate()));
                    close();
                  }}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
          <button
            className="mt-2 h-9 w-full rounded-xl text-sm font-bold text-fern transition hover:bg-fern/10"
            type="button"
            onClick={() => {
              onChange(localDate(today.getFullYear(), today.getMonth(), today.getDate()));
              close();
            }}
          >
            Today
          </button>
        </div>
      )}
    </div>
  );
}

export function MonthField({
  label = "Month",
  value,
  onChange,
  className,
  plain = false
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  plain?: boolean;
}) {
  const native = useNativePicker();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const rootRef = useCloseOnOutsideClick(open, close);
  const panelId = useId();
  const [yearText, monthText] = value.split("-");
  const selectedYear = Number(yearText) || new Date().getFullYear();
  const selectedMonth = Number(monthText) || new Date().getMonth() + 1;
  const [year, setYear] = useState(selectedYear);

  if (native) {
    return (
      <input
        className={cn(plain ? "h-11 w-[9.5rem] bg-transparent px-2 text-center text-sm outline-none" : "control", className)}
        type="month"
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  return (
    <div className="relative" ref={rootRef}>
      <Trigger
        label={label}
        text={value ? monthLabel(value) : "Choose month"}
        placeholder={!value}
        open={open}
        controls={panelId}
        className={cn(plain && "h-11 w-[9.5rem] rounded-none border-y-0 bg-transparent px-2 text-sm shadow-none focus:ring-0 dark:bg-transparent", className)}
        onClick={() => {
          setYear(selectedYear);
          setOpen((current) => !current);
        }}
      />
      {open && (
        <div id={panelId} className="absolute right-0 z-30 mt-2 w-64 rounded-2xl border border-stone-200 bg-white p-3 shadow-soft dark:border-stone-700 dark:bg-stone-950">
          <div className="mb-3 flex items-center justify-between">
            <NavButton label="Previous year" onClick={() => setYear((current) => current - 1)} />
            <p className="text-sm font-extrabold">{year}</p>
            <NavButton label="Next year" onClick={() => setYear((current) => current + 1)} direction="next" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {monthNames.map((name, index) => {
              const chosen = year === selectedYear && index + 1 === selectedMonth;
              return (
                <button
                  key={name}
                  className={cn(
                    "h-10 rounded-xl text-sm font-semibold transition hover:bg-oat dark:hover:bg-stone-800",
                    chosen && "bg-fern text-white hover:bg-fern"
                  )}
                  type="button"
                  onClick={() => {
                    onChange(`${year}-${String(index + 1).padStart(2, "0")}`);
                    close();
                  }}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function NavButton({ label, onClick, direction = "previous" }: { label: string; onClick: () => void; direction?: "previous" | "next" }) {
  const Icon = direction === "next" ? ChevronRight : ChevronLeft;
  return (
    <button className="grid h-9 w-9 place-items-center rounded-full text-stone-500 transition hover:bg-oat hover:text-fern dark:hover:bg-stone-800" type="button" aria-label={label} onClick={onClick}>
      <Icon className="h-4 w-4" />
    </button>
  );
}
