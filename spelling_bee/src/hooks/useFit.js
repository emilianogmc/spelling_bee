import { useLayoutEffect } from "react";

/**
 * Keeps a row of letters on one line inside its container. The CSS sizes the
 * letters from the word's length; this measures what actually rendered and,
 * only if it still overflows (wide capitals, a long custom word), sets --fit
 * to shrink it by exactly the overflow. Runs on every render because letters
 * arrive one at a time, and again on resize.
 */
export function useFit(ref) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => {
      el.style.setProperty("--fit", "1");
      const over = el.scrollWidth / Math.max(1, el.clientWidth);
      if (over > 1.001) el.style.setProperty("--fit", String(0.98 / over));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  });
}
