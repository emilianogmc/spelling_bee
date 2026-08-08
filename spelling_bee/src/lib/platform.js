/**
 * iOS/iPadOS Safari (and any WebKit wrapper on those OSes) only allows
 * SpeechRecognition.start() inside a direct user gesture — a call from a
 * timer or a callback is rejected with a "not-allowed" error even when the
 * mic permission was already granted. Desktop and Android browsers have no
 * such restriction.
 */
export function isIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ reports as "Macintosh" but, unlike a real Mac, has a touchscreen.
  return ua.includes("Macintosh") && navigator.maxTouchPoints > 1;
}
