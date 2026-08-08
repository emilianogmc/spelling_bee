# Mac TTS silence — full investigation

**Symptom.** On the MacBook, pressing the speaker button or "Repeat word" produces no
audio. The mic button works, so speech *recognition* functions. On iPhone Safari the
same deployed app speaks correctly.

**Status.** Root cause identified with high confidence after the Step 1 triage below.
Fix shipped. This document is kept as the record of what was ruled out and how.

---

## Evidence from triage (2026-08-08)

Answers to the Step 1 questions, and what each one eliminated:

| Finding | Eliminates |
|---|---|
| **Browser is Chrome on macOS** | Safari-specific theories |
| **Fails identically on `localhost` AND the deployed URL** | Layer 0 entirely — stale bundle, Cloudflare cache, service worker, wrong URL, bad deploy |
| **Auto-mic unchecked + hard reload → still silent** | Layer 1 entirely — audio-session contention, mic/TTS coupling, Bluetooth HFP |
| **The speaker button never turns amber** | Everything downstream of `onstart`. `speaking` state never flips, so the utterance never *begins*. This is not a "sound is quiet / routed wrong" bug — it is a "the utterance never started" bug, which rules out Layer 0's mute/output-device causes too |

**Surviving explanation — Layer 2.2.** `App.jsx` called `say(current)` from a
`useEffect` the moment the first word was chosen, with no user gesture. Chrome has
refused `speechSynthesis.speak()` without user activation since M71, and the rejected
utterance leaves the queue wedged: every later, properly-gestured click queues behind
a corpse and never starts. `onstart` never fires, the button never lights, nothing
plays — for the whole life of that page load. A hard reload just repeats it.

iPhone Safari works because WebKit rejects the ungestured call harmlessly instead of
poisoning the queue.

Both earlier fixes were irrelevant to this: neither touched the page-load call.

### Fix applied

1. **No speech until the page has been interacted with.** The word-change effect
   checks a first-`pointerdown`/`keydown` flag before speaking, and `speak()` itself
   re-checks `navigator.userActivation.hasBeenActive` and refuses to hand anything to
   the queue when it is false. Nothing ever gets queued in the blocked state.
2. **`cancel()` only when something is actually speaking or pending.** When the queue
   is idle there is nothing to race, so `speak()` runs inside the click's own task,
   which also satisfies Safari's stricter synchronous-gesture expectation.
3. **`cancel()` removed from the voice-selection effect's cleanup** — voice loading no
   longer kills playback.
4. **`event.error` is surfaced** on screen instead of being discarded.
5. **`resume()` if the synthesiser is found paused**, which otherwise swallows the queue.
6. **Local voices preferred** over network-backed ones, and the utterance is held in a
   ref so Chromium cannot collect it before it plays.
7. **`?debug=tts`** renders a live diagnostics panel: voice count, chosen voice,
   `speaking`/`pending`/`paused`, activation state, and a timestamped event log.

---

## Read this first: what the two failed fixes tell us

| Shipped | Theory | Result |
|---|---|---|
| `fbbe98f` | WebKit drops an utterance queued in the same tick as `cancel()`; added a 50 ms `setTimeout` | No change |
| `9265adb` | macOS ducks playback while a `getUserMedia` stream is held open; removed the persistent stream | No change |

Two conclusions follow, and both constrain everything below:

1. **The bug predates the `setTimeout`.** Mac silence was reported *before* that code
   existed. So the timeout cannot be the original cause — though it may now be an
   additional, compounding one. Any theory that leads with "the setTimeout broke it"
   is falsified as a root-cause explanation.
2. **We have never once observed what the API is actually reporting.** `onerror`
   discards its error code. Every diagnosis so far has been inference from symptoms.
   That is why two confident fixes missed.

**Unknowns that are load-bearing and have never been established:**

- Which browser on the Mac — Safari or Chrome? They have different gesture rules,
  different voice-loading timing, and different failure modes. "It's a Mac" is not a
  diagnosis.
- Deployed Cloudflare URL, or `localhost:8000` dev server?
- Was the browser hard-reloaded after each deploy, or could it be running a cached
  pre-fix bundle?
- Does the on-screen "speaking" indicator light up when the button is pressed?
- Does audio from *any* other site work in that browser right now?

---

## Layer 0 — Is the problem even what we think it is?

The user's wording was *"the buttons don't work"* and *"It does nothing"* — which
describes an unresponsive UI, not silent audio. Those are different bugs. Nobody has
confirmed the click even reaches `speechSynthesis`.

| # | Cause | How to confirm | Cost |
|---|---|---|---|
| 0.1 | Mac output muted / volume at zero | Play any YouTube video in the same browser | Free |
| 0.2 | Output routed to a disconnected device (AirPlay, external display, AirPods in another room, aggregate/multi-output device) | System Settings → Sound → Output | Free |
| 0.3 | Chrome per-site tab mute set on the origin | Right-click the tab; check "Unmute site" | Free |
| 0.4 | Click handler never fires — JS error, hydration failure, or dead build | Does the **speaking indicator** (the round speaker button turns amber/filled) light up on press? Open DevTools console and screenshot on press | Free |
| 0.5 | Stale bundle — testing a cached pre-fix deploy, or a `dist/` build older than the source | Hard reload (Cmd+Shift+R); compare the JS filename in Network tab against the latest build hash | Free |
| 0.6 | Testing `localhost` while assuming it's the deployed site, or vice versa | Check the address bar | Free |

**The mic working proves nothing about output.** Input and output are separate
hardware paths, separate permissions, separate subsystems. "Mic works, so audio is
fine" is a non sequitur and should be dropped as evidence.

---

## Layer 1 — Audio-session contention with the microphone (highest-value untested theory)

This is the theory the council's peer review flagged as most promising and least
explored, because **it varies exactly along the fault line between the two devices.**

Auto-mic is **on by default on Mac** and **disabled on iOS**. With it on, the
recogniser runs essentially continuously: `continuous = true`, and `onend` respawns a
fresh instance to bridge silence gaps. So on the Mac the microphone is live almost
all the time. On iPhone it is only open when deliberately pressed.

`say()` calls `resetMic()` and then speaks 50 ms later. Recognition `stop()` is
asynchronous — WebKit and Chromium can take far longer than 50 ms to tear down the
capture session. If macOS holds an exclusive or voice-processing audio session for
that capture, playback queued during the teardown window can be ducked to silence or
dropped entirely.

Note this survives the second failed fix: removing the `getUserMedia` stream did not
remove the capture session that `SpeechRecognition` itself opens.

| # | Cause | How to confirm | Cost |
|---|---|---|---|
| 1.1 | Recognition capture session starves synthesis playback | **Uncheck "Open the mic as soon as the word is read", hard-reload, press the speaker button.** The checkbox already exists in the UI — no deploy needed | Free |
| 1.2 | 50 ms is too short for the capture session to release | Same test as 1.1; if sound returns with auto-mic off, raise the gap and re-enable | Free to test |
| 1.3 | Bluetooth HFP profile switching — opening the mic forces AirPods into telephony mode; A2DP switchback has latency | Test on built-in speakers with Bluetooth off | Free — *folklore, not vendor-documented* |

**If test 1.1 restores audio, the root cause is found and the fix is a real
speaking↔listening state machine rather than a timing patch.**

---

## Layer 2 — Browser policy: user activation

`App.jsx` calls `say(current)` from a `useEffect` on page load, with **no user
gesture**. Browsers gate audio behind user activation.

| # | Cause | How to confirm | Cost |
|---|---|---|---|
| 2.1 | The ungestured page-load `speak()` is simply blocked | Watch whether the *first* word ever speaks on load, on any device | Free |
| 2.2 | An ungestured `speak()` leaves WebKit's synthesis queue wedged for the page's lifetime, so the *later* gestured click is doomed by the earlier call | Remove the load-time `say()`; if the button then works, confirmed | 1 deploy — *real, semi-documented WebKit quirk* |
| 2.3 | The 50 ms `setTimeout` breaks the synchronous gesture call stack. Safari desktop is stricter than iOS about requiring `speak()` inside the handler's own task | Revert the timeout, call `speak()` synchronously | 1 deploy — cannot be the *original* cause (predates it), but may compound |
| 2.4 | Chrome suspends `speechSynthesis` in backgrounded/unfocused tabs | Keep the tab focused while testing | Free |

---

## Layer 3 — The `cancel()` race: three independent callers

Three separate places can call `speechSynthesis.cancel()`, and any of them can kill an
utterance queued by another:

1. `speak()` itself, immediately before queueing.
2. The **voice-selection effect's cleanup** in `useSpeechSynth.js` — and this effect is
   wired to `voiceschanged`, which **macOS fires asynchronously and repeatedly** as it
   enumerates system voices. iOS enumerates once. That asymmetry matches the bug.
3. `cancel()` exported from the hook, called by `toggleMic`.

The 50 ms delay between `cancel()` and `speak()` **widens** the window for another
caller to cancel first. It may have made this worse, not better.

| # | Cause | How to confirm | Cost |
|---|---|---|---|
| 3.1 | Voice effect cleanup fires `cancel()` inside the 50 ms window | Remove `cancel()` from the effect cleanup — voice loading should never touch playback | 1 deploy |
| 3.2 | `voiceschanged` re-firing on macOS re-runs the effect repeatedly | Log how many times `pickVoice` runs on Mac vs iPhone | 1 deploy |
| 3.3 | React StrictMode double-invokes effects (mount→unmount→mount), firing the cleanup's `cancel()` | **Dev-only** — StrictMode does not double-invoke in production builds. Only relevant if testing `npm run dev` | Free to rule out |
| 3.4 | The token guard skips the queued `speak()` because `tokenRef` advanced during the 50 ms | Log token value at queue time vs fire time | 1 deploy |

---

## Layer 4 — Voice selection

`utterance.voice = voiceRef.current` assigns a `SpeechSynthesisVoice` object captured
earlier. This is a common silent-failure source.

| # | Cause | How to confirm | Cost |
|---|---|---|---|
| 4.1 | `getVoices()` returned empty at pick time; `voiceRef` is null | Log `getVoices().length` | 1 deploy |
| 4.2 | Stale voice object — captured before re-enumeration, now invalid. Some Chromium builds fail silently on a stale voice | Drop `utterance.voice` entirely and rely on `utterance.lang` alone | 1 deploy |
| 4.3 | Selected an "Enhanced"/"Premium" Siri voice whose asset was never downloaded → silent failure at OS level | System Settings → Accessibility → Spoken Content → System Voice; check for a download arrow | Free — *real macOS behavior* |
| 4.4 | Selected a network-backed voice (Chrome's "Google US English") that fails without reaching its backend | Check `voice.localService`; prefer a local voice | 1 deploy |
| 4.5 | Voice/lang mismatch — voice is non-English while `utterance.lang = "en-US"` | Log the chosen voice's `name` and `lang` | 1 deploy |

---

## Layer 5 — Global `speechSynthesis` state

`speechSynthesis` is a **process-global singleton**. It can be left wedged in a state
that survives page reloads until the browser is restarted.

| # | Cause | How to confirm | Cost |
|---|---|---|---|
| 5.1 | Stuck in `paused` state — all speech silently queues forever | Log `speechSynthesis.paused`; call `resume()` before speaking | 1 deploy |
| 5.2 | Queue wedged with `pending` utterances that never drain | Log `.speaking`, `.pending` | 1 deploy |
| 5.3 | State poisoned by an earlier session and persisting across reloads | **Fully quit and reopen the browser**, then test | Free |
| 5.4 | Chrome's ~15 s utterance timeout (needs periodic `resume()`) | Not applicable — single words are far under 15 s | — |

---

## Layer 6 — Miscellaneous / lower probability

| # | Cause | Notes |
|---|---|---|
| 6.1 | Utterance garbage-collected before it plays — `const utterance` holds no external reference; a Chromium GC bug can reclaim it silently | *Widely repeated online, not vendor-documented.* Cheap to defend against: keep it in a ref |
| 6.2 | `rate = 0.75` out of range | No — valid range is 0.1–10 |
| 6.3 | Browser extension (ad blocker, privacy tool) interfering with Web Speech | Test in a private window with extensions off — free |
| 6.4 | macOS Focus mode / Do Not Disturb suppressing audio | Free to check |
| 6.5 | Multiple React roots mounting two hook instances that fight | Not present — single `createRoot` in `main.jsx` |
| 6.6 | Corporate/MDM policy blocking Web Speech | Unlikely on a personal machine |

---

## Recommended sequence

**Do not ship another blind fix.** The next action should produce a *measurement*.

### Step 1 — Free, no deploy, answers most of it

1. Which browser on the Mac? Safari or Chrome?
2. Deployed URL or `localhost`?
3. Play a YouTube video in that browser — does audio work at all?
4. Press the speaker button: does the round button **light up amber**? (That's the
   `speaking` state — it proves whether `onstart` fired.)
5. **Uncheck "Open the mic as soon as the word is read", hard-reload, press the
   speaker.** This is the single highest-value test in this document.
6. Quit the browser completely, reopen, try once more.

### Step 2 — One instrumented deploy, only if Step 1 doesn't resolve it

Add an on-screen diagnostic panel behind `?debug=tts` (console logging is useless
here — the developer cannot see the remote console). It should show, per attempt:

- `getVoices().length`, and the chosen voice's `name` / `lang` / `localService`
- `speechSynthesis.speaking` / `.pending` / `.paused`, before `speak()` and again on
  each event
- **the actual `event.error` string from `onerror`** — the one line missing this
  entire time
- elapsed time between calling `speak()` and `onstart` firing, or a timeout marker if
  it never fires

That screenshot sorts the bug into a named bucket instead of a theory.

### Step 3 — Also worth building: a minimal control page

A bare HTML file with nothing but a button calling `speechSynthesis.speak()` — no
React, no StrictMode, no effects, no mic. Open it on the same Mac and browser. It
bisects the entire problem space in one step: if the control page is silent too, the
cause is OS/browser/hardware and no amount of app-code work will fix it. If it speaks,
the cause is in this app's code.

---

## Fixes worth making regardless of root cause

These are correct independent of which theory wins:

1. **Surface `event.error` in `onerror`** instead of discarding it.
2. **Remove `cancel()` from the voice-selection effect's cleanup.** Voice loading
   should never touch playback.
3. **Drop the page-load ungestured `say()`**, or gate it behind first interaction.
   It is a browser policy to respect, not a bug to work around.
4. **Reconsider the 50 ms `setTimeout`.** It never helped, it widens the cancel race,
   and it may break Safari's synchronous-gesture requirement.
5. **Model speaking↔listening as one explicit state machine** (`idle → speaking →
   listening`) rather than two hooks calling each other through refs and `onEnd`
   callbacks.
