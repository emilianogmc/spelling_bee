import { useCallback, useEffect, useRef } from "react";
import { fetchDefinition } from "../lib/dictionary.js";

// Long enough for a slow connection, short enough that a dead one doesn't
// leave the speller staring at "Looking up the definition." indefinitely.
const TIMEOUT_MS = 8000;

/**
 * One lookup in flight at a time: starting a new one cancels whatever the
 * speller asked for previously, since by the time it would resolve the
 * question has moved on. `status` distinguishes a request that needs no
 * comment (superseded, "aborted") from ones that do: "not-found" for a word
 * the dictionary genuinely has nothing on, "error" for a request that never
 * got an answer at all.
 */
export function useDefinition() {
  const controllerRef = useRef(null);

  const define = useCallback(async (word) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const timer = setTimeout(() => controller.abort("timeout"), TIMEOUT_MS);

    try {
      const text = await fetchDefinition(word, { signal: controller.signal });
      return { text, status: text ? "ok" : "not-found" };
    } catch (err) {
      if (err.name === "AbortError") {
        const timedOut = controller.signal.reason === "timeout";
        return { text: null, status: timedOut ? "error" : "aborted" };
      }
      return { text: null, status: "error" };
    } finally {
      clearTimeout(timer);
    }
  }, []);

  useEffect(() => () => controllerRef.current?.abort(), []);

  return define;
}
