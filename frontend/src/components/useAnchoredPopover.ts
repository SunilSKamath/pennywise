import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

type PopoverElement = HTMLElement & {
  showPopover?: () => void;
  hidePopover?: () => void;
};

function supportsPopover(element: HTMLElement | null): element is PopoverElement {
  return Boolean(element && typeof (element as PopoverElement).showPopover === "function");
}

function placePanel(trigger: HTMLElement, panel: HTMLElement) {
  const rect = trigger.getBoundingClientRect();
  const gap = 8;
  const viewportPadding = 8;
  const maxHeight = Math.min(256, window.innerHeight - viewportPadding * 2);
  panel.style.position = "fixed";
  panel.style.width = `${rect.width}px`;
  panel.style.maxHeight = `${maxHeight}px`;
  panel.style.zIndex = "50";
  panel.style.margin = "0";
  panel.style.inset = "unset";

  const spaceBelow = window.innerHeight - rect.bottom - gap;
  const spaceAbove = rect.top - gap;
  const openUp = spaceBelow < Math.min(maxHeight, 180) && spaceAbove > spaceBelow;

  if (openUp) {
    const height = Math.min(maxHeight, spaceAbove);
    panel.style.maxHeight = `${height}px`;
    panel.style.top = `${Math.max(viewportPadding, rect.top - gap - height)}px`;
  } else {
    const height = Math.min(maxHeight, Math.max(spaceBelow, 120));
    panel.style.maxHeight = `${height}px`;
    panel.style.top = `${rect.bottom + gap}px`;
  }

  const left = Math.min(Math.max(viewportPadding, rect.left), window.innerWidth - rect.width - viewportPadding);
  panel.style.left = `${Math.max(viewportPadding, left)}px`;
  panel.style.right = "auto";
  panel.style.bottom = "auto";
}

export function useAnchoredPopover() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const trigger = triggerRef.current;
    if (!open || !panel || !trigger) return;

    placePanel(trigger, panel);
    if (supportsPopover(panel)) {
      try {
        panel.showPopover?.();
      } catch {
        // Already open or unsupported in this context.
      }
    }
  }, [open]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || !open) return;

    const onToggle = (event: Event) => {
      const toggle = event as ToggleEvent;
      if (toggle.newState === "closed") setOpen(false);
    };
    panel.addEventListener("toggle", onToggle);
    return () => panel.removeEventListener("toggle", onToggle);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onReposition = () => {
      const panel = panelRef.current;
      const trigger = triggerRef.current;
      if (panel && trigger) placePanel(trigger, panel);
    };
    const onPointerDown = (event: MouseEvent) => {
      const panel = panelRef.current;
      const trigger = triggerRef.current;
      const target = event.target as Node;
      if (panel?.contains(target) || trigger?.contains(target)) return;
      if (supportsPopover(panel) && panel.matches(":popover-open")) return;
      setOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

  return {
    open,
    setOpen,
    triggerRef,
    panelRef,
    panelId,
    panelProps: {
      id: panelId,
      popover: "auto" as const,
      className: "popover-panel"
    }
  };
}
