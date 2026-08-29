import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { fetchDefinition, spokenDefinition } from "./dictionary.js";

test("the first sense with an actual definition wins, part of speech first", () => {
  const data = {
    entries: [
      { partOfSpeech: "noun", senses: [{ definition: "a feeling of evil to come" }] },
      { partOfSpeech: "verb", senses: [{ definition: "to sense trouble ahead" }] },
    ],
  };
  assert.equal(spokenDefinition(data), "Noun. a feeling of evil to come");
});

test("an entry with no senses is skipped for one that has them", () => {
  const data = {
    entries: [
      { partOfSpeech: "noun", senses: [] },
      { partOfSpeech: "adjective", senses: [{ definition: "prone to lying" }] },
    ],
  };
  assert.equal(spokenDefinition(data), "Adjective. prone to lying");
});

test("no usable definition anywhere reads as nothing to say", () => {
  assert.equal(spokenDefinition({ entries: [] }), null);
  assert.equal(spokenDefinition({ entries: [{ partOfSpeech: "noun", senses: [] }] }), null);
  assert.equal(spokenDefinition(null), null);
});

test("a definition with no part of speech is read on its own", () => {
  const data = { entries: [{ senses: [{ definition: "just the sense itself" }] }] };
  assert.equal(spokenDefinition(data), "just the sense itself");
});

test("a leading usage tag is dropped so speech starts on the definition itself", () => {
  const data = {
    entries: [
      {
        partOfSpeech: "noun",
        senses: [{ definition: "(countable) An institution where one can place money." }],
      },
    ],
  };
  assert.equal(spokenDefinition(data), "Noun. An institution where one can place money.");
});

test("more than one leading tag is dropped, not just the first", () => {
  const data = {
    entries: [{ partOfSpeech: "adjective", senses: [{ definition: "(UK) (dated) old-fashioned" }] }],
  };
  assert.equal(spokenDefinition(data), "Adjective. old-fashioned");
});

// fetchDefinition talks to a real endpoint, so these swap in a fake fetch
// rather than reaching the network. Each test uses its own word: the cache
// is a module-level singleton and persists across tests in this file.
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

test("a found word is parsed and only fetched once", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        entries: [{ partOfSpeech: "noun", senses: [{ definition: "a long journey" }] }],
      }),
    };
  };

  assert.equal(await fetchDefinition("peregrination"), "Noun. a long journey");
  assert.equal(await fetchDefinition("peregrination"), "Noun. a long journey");
  assert.equal(calls, 1); // the second call was served from cache
});

test("a word missing from the dictionary resolves to null, not an error", async () => {
  // This API answers 200 with an empty entries array rather than a 404.
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ word: "zzznotarealword", entries: [] }),
  });
  assert.equal(await fetchDefinition("zzznotarealword"), null);
});

test("a server problem throws, so it reads as unreachable rather than undefined", async () => {
  globalThis.fetch = async () => ({ ok: false, status: 503 });
  await assert.rejects(() => fetchDefinition("servertrouble"));
});
