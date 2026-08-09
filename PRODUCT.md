# Product

## Register

product

## Users

One adult speller practicing for a spelling bee final, drilling alone, usually
on a phone held in one hand and often out loud in a quiet room. The job is
narrow and repetitive: hear a word, spell it back, find out immediately whether
it was right, move to the next one. Sessions are short and frequent, so the
cost of any friction is paid dozens of times per sitting.

The speller's hands and eyes are partly occupied. They are speaking, not
typing, most of the time. The interface has to be operable without close
reading and without two hands.

## Product Purpose

Turn a fixed word list into repeated, self-scoring practice. The app reads a
word aloud, listens to the speller spell it back letter by letter, judges it,
and tracks which words are learned and which keep failing. Success is a session
where the speller never has to think about the app, only about the word, and
finishes knowing exactly which words still need work.

Practice happens by voice on both ends. Typing is the fallback, not the
default.

## Brand Personality

Focused, warm, unfussy. The identity is warm charcoal and honey: it reads as a
study lamp at night rather than a game. Feedback is plain and immediate, never
congratulatory theatre and never scolding. A miss is information, not a
penalty.

Three accents, one meaning each, and they never trade jobs. **Honey** is the
identity: the primary action, progress, and anything currently selected.
**Vermilion** is live state and trouble, kept rare so it still means
something: the mic being open, an error, a word that keeps failing.
**Olive** marks a correct answer and nothing else.

So right and wrong are olive and cream rather than green and red. Neither
reads as a scolding, both stay distinguishable under every kind of colour
blindness, and vermilion is left free to mean "look here".

Voice: short, literal, second person. "Not quite. It's P-R-O-F-L-I-G-A-T-E."
Never "Oops!", never exclamation marks, never streak-shaming.

## Anti-references

- **Duolingo's look.** Its structure is the reference (one job per screen, a
  single chunky primary action, a bottom tab bar, unmistakable verdicts), its
  bright saturated palette and mascot-driven personality are not.
- **Dashboards.** No stat tiles, no metric hero, no charts. This is a drill,
  not an analytics surface.
- **The current crammed layout.** Two competing cards side by side, three
  buttons that all trigger speech, and controls that belong to different jobs
  stacked in one column.
- Gamified pressure: no timers, no scores, no loss animations.

## Design Principles

1. **One job per screen.** Practicing, reviewing progress, and editing the word
   list are three separate jobs. Nothing that belongs to one appears while
   doing another.
2. **Thumb-first.** Anything pressed repeatedly during a drill lives in the
   bottom third of the screen. The top is for information, the bottom for
   action.
3. **One primary action at a time.** Repeating the word, spelling it aloud,
   skipping, and checking are not four equal buttons. Exactly one action is
   primary in any given state.
4. **The verdict is unmissable.** Right or wrong is legible from across the
   room without reading, then the correct spelling is available on the miss.
5. **Voice is the main path.** The interface assumes the speller is talking,
   not typing, and never requires a tap that voice could replace.

## Accessibility & Inclusion

- **WCAG 2.1 AA.** Body text at 4.5:1 minimum against its own background, large
  text at 3:1. Visible focus rings on every interactive element. Full keyboard
  operation.
- **Large touch targets.** 44px minimum on every control, more on the ones used
  every word.
- **Dyslexia-conscious text.** Generous letter spacing on any spelled-out
  letters, no tightly tracked display type in the drill itself, body text no
  smaller than 15px, and spellings always shown letter-separated rather than as
  a solid word.
- **One-handed phone use.** Primary controls reachable in the bottom third.
- **Reduced motion.** Every transition has a `prefers-reduced-motion`
  alternative; nothing conveys state through motion alone.
- Speech recognition is not available in every browser, so typing must remain a
  complete path to every outcome.
