import { useEffect } from "react";

const FOCUSABLE =
  'input:not([type="hidden"]):not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly])';

/**
 * Låter Enter flytta fokus till nästa fält (som TAB) i hela appen.
 * Shift+Enter går bakåt.
 */
export function useEnterAsTab() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const tag = target.tagName;
      if (tag === "TEXTAREA" || tag === "BUTTON" || tag === "A" || tag === "SELECT") return;
      if (tag !== "INPUT") return;

      const nodes = Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === target,
      );
      const idx = nodes.indexOf(target);
      if (idx === -1) return;
      const next = nodes[idx + (e.shiftKey ? -1 : 1)];
      if (!next) return;
      e.preventDefault();
      next.focus();
      if (next instanceof HTMLInputElement) next.select();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
}
