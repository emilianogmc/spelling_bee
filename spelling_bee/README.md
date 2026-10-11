# spelling.help: the app

Voice-driven spelling bee practice. React 18 + Vite 6 + Tailwind CSS v4 + lucide-react. No backend.

## Run it

```bash
npm install
npm run dev        # http://localhost:8000
npm test           # unit tests (node:test)
npm run build      # production build into dist/
```

Use the dev server rather than opening files directly. `file://` is an opaque origin, so Chrome can't remember the microphone permission and asks again on every attempt.

## How it works

Press **Start** and the word is read aloud. The mic opens on its own when the voice stops, so a whole pass runs hands-free. Spell out loud the way you would on stage: say the word, spell it, say it again. The parser strips the word itself from the transcript. Spelling the word correctly submits it the moment the letters match. Falling silent submits it too, after about three seconds, or four when you're one letter short, since that last letter is usually still being transcribed.

When the mic mishears a letter, the answer isn't scored: a sound-alike slip (P heard as B) or a cut-off ending is the microphone's fault, so the mic reopens for another try. Saying a NATO word ("papa" for P, "bravo" for B) comes through more reliably. "May I start over" gives one fresh attempt per word.

Three right in a row masters a word; a miss makes it hard. Typing is always available, and it's the whole path in browsers without speech recognition.

### The screen is the state

The practice screen is a colour field that names what's happening: ink while it waits on you, honey while the voice speaks, olive when you're right, cream when you're not, and vermilion when the mic or recognition can't work. While the mic is open the field stays ink and only the bar, dot and caret turn vermilion. On a miss, the letters you got wrong are vermilion in the correct spelling, and your attempt is lined up under it column by column.

### The comb

Progress is a comb: one hexagonal cell per word, in clusters of 19 consecutive words of your list. Each cell fills with honey to your real streak, a third at a time, until the word is mastered. A hard word is vermilion with a hole in it. Light up a set (hard, learning, untested, mastered) and the bar at the bottom drills exactly those. Pick a cell to see the word, its streak and its history (tries, misses, last practised, last misspelling), and to drill that word or its whole cluster. A find box and an "every word as a list" table give the same information without the comb.

## Structure

```
src/
  data/words.js                 162-word finals list
  lib/letters.js                transcript → letters, homophone + NATO maps, near-miss detection
  lib/scoring.js                judging an answer; letter alignment for the miss view
  lib/progress.js               statuses, sets, history, storage, migration from old keys
  lib/comb.js                   comb geometry: clusters, lattice, fill order, arrow-key neighbours
  lib/dictionary.js             definitions from freedictionaryapi.com, cached
  hooks/useDrill.js             passes, scoring, persistence
  hooks/useSpeechSynth.js       pronunciation (defensive against Chrome's wedged synthesiser)
  hooks/useSpeechRecognition.js continuous letter capture
  components/PracticeTab.jsx    the drill: stages, colour fields, the bar
  components/ProgressTab.jsx    Progress: the comb, its key, the inspector, lists
  components/ProgressComb.jsx   the comb itself
  components/WordInspector.jsx  one word, picked from the comb
  components/WordsTab.jsx       word list editor, voice settings, reset
  placard.css                   all of the above's styling
prototypes/                     dev-only design prototypes, served at /prototypes/ in dev, never built
```

## Storage

Everything stays in this browser's `localStorage`, on this device only:

| Key | What |
| --- | --- |
| `sb.progress` | `{ word: streak }`: 0 means missed last time |
| `sb.history` | `{ word: { tries, misses, last, lastMiss } }` |
| `sb.words` | the word list |
| `sb.automic` | whether the mic opens by itself |
| `sb.draft` | an unsaved word-list edit |
| `sb-definitions` | cached definitions |

The version that won the bee stored the same things under `sb-progress`, `sb-words`, `sb-automic` and `sb-words-draft`, with `{ streak, lastWrong }` records. On first load, `migrateStorage()` copies them to the new keys. It only fills a key that's empty, so it never overwrites newer data, and it leaves the old keys in place. Malformed data is skipped rather than carried over.

## Browser support

Speech recognition needs Chrome, Edge or Safari, plus an internet connection: Chrome sends audio to Google's servers to transcribe. Firefox has no support, so the app goes straight to typing, which works offline.

On iPhone or iPad, only Safari can use the speech APIs; Apple doesn't give them to third-party browsers there. Safari on iOS also only allows starting the mic from inside a direct tap, so the mic can't open by itself and every word needs a tap on the bar. That's a WebKit restriction, not a bug.

`?debug=tts` and `?debug=stt` show live diagnostics for the synthesiser and the recogniser.
