# Spelling drill

Voice-driven spelling bee practice. React + Vite + Tailwind CSS v4 + lucide-react.

## Run it

```bash
npm install
npm run dev
```

Opens on `http://localhost:8000`. Use this URL rather than opening files
directly — `file://` is an opaque origin, so Chrome can't remember the
microphone permission and will re-prompt on every attempt.

## How it works

Tap the speaker to hear the word, then either type the spelling or spell it
aloud. Three correct answers in a row marks a word mastered; a miss drops it
into the Hard filter.

The mic opens on its own the moment the voice stops — after the word, after a
repeat, after "spell it to me", and again if a letter came through garbled — so
a whole pass runs hands-free. Uncheck "open the mic as soon as the word is read"
to go back to pressing it yourself; the choice is remembered.

Not on iPhone or iPad, though: Safari there only allows starting the mic from
inside a direct tap, so the checkbox is disabled and every word needs a tap on
the mic button. That's a WebKit restriction, not a bug — the mic still works
fine, it just can't open itself.

Spell out loud the way you would in competition — say the word, spell it, say it
again. The parser strips the word itself from the transcript.

When the mic mishears a letter, say the letter word instead: "papa" for P,
"bravo" for B, "delta" for D. Full NATO alphabet is supported.

## Structure

```
src/
  data/words.js              162-word finals list
  lib/letters.js             transcript → letters, homophone + NATO maps, near-miss detection
  lib/progress.js            mastery status, pooling, localStorage
  hooks/useSpeechSynth.js    pronunciation
  hooks/useSpeechRecognition.js  continuous letter capture
  hooks/useDrill.js          queue, scoring, persistence
  components/                DrillCard, ProgressComb, WordListEditor, and children
```

Progress (`sb-progress`), the word list (`sb-words`), and the auto-mic
preference (`sb-automic`) are stored in `localStorage`, so they survive
refreshes — per browser profile, on that machine only.

## Browser support

Speech recognition needs Chrome, Edge, or Safari and an internet connection —
Chrome sends audio to Google's servers to transcribe. Firefox has no support;
the mic button disables itself and typing still works offline.
