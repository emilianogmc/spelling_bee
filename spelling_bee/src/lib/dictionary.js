import { loadStored, saveStored } from "./progress.js";

/**
 * Definitions come from freedictionaryapi.com (Wiktionary data) rather than
 * being typed in by hand. A hardcoded list would have to be maintained for
 * however many words end up in the practice list, and would silently go
 * stale the moment someone edits the Word list in the Words tab — a custom
 * word would simply have no definition. Fetching means any word the speller
 * adds is definable on the same terms as the words shipped with the app.
 *
 * No key, 1,000 requests/hour/IP — generous next to what the client cache
 * below leaves it needing. It answers with HTTP 200 and an empty `entries`
 * array for a word it has nothing on, rather than a 404, so "not found" has
 * to be read out of the body, not the status line.
 */
const ENDPOINT = "https://freedictionaryapi.com/api/v1/entries/en/";

const KEY_DEFS = "sb-definitions";

// A definition never changes underneath a fixed English word, so the cache
// has no expiry — only a ceiling on how many distinct words it holds, so a
// long-lived custom word list can't grow it without bound.
const CACHE_LIMIT = 500;

let cache = null;
function store() {
  if (!cache) cache = loadStored(KEY_DEFS, {});
  return cache;
}

function cacheGet(word) {
  const entry = store();
  return Object.prototype.hasOwnProperty.call(entry, word) ? entry[word] : undefined;
}

function cacheSet(word, text) {
  const entry = store();
  entry[word] = text;
  // Insertion order in a plain object is preserved for string keys, and the
  // word practiced longest ago is the least likely to be asked for again.
  const keys = Object.keys(entry);
  if (keys.length > CACHE_LIMIT) delete entry[keys[0]];
  saveStored(KEY_DEFS, entry);
}

function titleCase(word) {
  return word ? word[0].toUpperCase() + word.slice(1) : word;
}

// Wiktionary definitions often lead with a usage note in parentheses —
// "(countable) An institution where…", "(chiefly historical) A person who…".
// Useful on a page, where it's read once and skimmed; spoken cold with no
// text alongside it, "countable" just sounds like a stray word before the
// actual definition starts. The same fact already lives in `tags`, unused
// here, so dropping it from speech loses nothing.
function stripLeadingTags(text) {
  return text.replace(/^(\([^()]*\)\s*)+/, "");
}

/**
 * One sentence, meant to be heard rather than read: the part of speech, then
 * the first sense the dictionary lists. Real bees name the part of speech
 * before the definition too — "noun, a feeling of..." — so a speller used to
 * the ritual hears the same shape here.
 */
export function spokenDefinition(data) {
  const entries = Array.isArray(data?.entries) ? data.entries : [];
  const entry = entries.find((e) => e.senses?.[0]?.definition);
  const definition = entry?.senses?.[0]?.definition;
  if (!definition) return null;
  const spoken = stripLeadingTags(definition);
  return entry.partOfSpeech ? `${titleCase(entry.partOfSpeech)}. ${spoken}` : spoken;
}

/**
 * Resolves to the spoken definition, `null` if the dictionary genuinely has
 * no entry for the word, or throws for anything that isn't a real answer —
 * offline, a timeout, the API itself being down — so the caller can tell
 * "not in the dictionary" apart from "couldn't ask the dictionary".
 */
export async function fetchDefinition(word, { signal } = {}) {
  const key = word.trim().toLowerCase();
  if (!key) return null;

  const cached = cacheGet(key);
  if (cached !== undefined) return cached;

  const res = await fetch(`${ENDPOINT}${encodeURIComponent(key)}`, { signal });
  if (!res.ok) throw new Error(`dictionary responded ${res.status}`);

  const data = await res.json();
  if (!data?.entries?.length) {
    cacheSet(key, null);
    return null;
  }

  const text = spokenDefinition(data);
  cacheSet(key, text);
  return text;
}
