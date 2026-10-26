# Bilingual dictionary sources and review

The game uses a reviewed layer over the original **70,696-word English–Vietnamese CSV catalog**. English clues come from Open English WordNet and English Wiktionary, with explicit paired editorial corrections. Missing words are never filled with a generic invented definition. The original `public/vocabulary/en-vi.json` remains unchanged for provenance and history migration.

This is a source-based and structural audit, **not a claim that every Vietnamese translation or every selected bilingual sense has been manually verified**. When no Vietnamese translation is attached to a source sense, automated English selection can be a different legitimate sense of the same headword and part of speech. The paired editorial layers explicitly align their own EN/VI senses.

## Pinned primary sources

| Source | Snapshot | License |
| --- | --- | --- |
| [Open English WordNet](https://en-word.net/) | [2025 common-word edition](https://github.com/globalwordnet/english-wordnet/tree/2025-edition) | CC BY 4.0, retaining Princeton WordNet notice |
| [English Wiktionary via Kaikki / Wiktextract](https://kaikki.org/dictionary/English/) | 21 October 2026 extraction of 1 October 2026 enwiktionary dump | [CC BY-SA 4.0](https://en.wiktionary.org/wiki/Wiktionary:Copyrights) |

Open English WordNet is credited to **The Open English WordNet Team**, incorporating **Princeton University WordNet**. Wiktionary content is credited to **Wiktionary contributors**; extraction is provided by **Kaikki.org / Wiktextract**. Neither source endorses this game.

- OEWN archive: [english-wordnet-2025-json.zip](https://en-word.net/static/english-wordnet-2025-json.zip), SHA-256 `7d749f6e2c39e6970e4997839dcf6e42fd281f3c2fae0171d2192bae8cfa4b51`.
- Kaikki archive: [English JSONL gzip](https://kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl.gz), **534,135,938 bytes**, SHA-256 `cabb3a13b7179d5f8c5909e06b1dcd2e2ae6465d05f35de56509a5b4e2bf0a49`. The upstream URL can change; a different checksum must be reviewed as a new snapshot.
- The Kaikki stream contains 1,499,162 rows. Extraction retained 107,033 rows for game headwords, plus 5,587 referenced lemmas. Two malformed JSONL lines, 30,467–30,468, were skipped and recorded; their text was not guessed or repaired.
- Source license copies: `public/vocabulary/LICENSE-OPEN-ENGLISH-WORDNET.md`, `LICENSE-PRINCETON-WORDNET.txt`, and `LICENSE-CC-BY-SA-4.0.txt`. The Princeton notice retains the upstream file's original line labels.

The public [source manifest](public/vocabulary/english-source-manifest.json) records archive checksums, compressed source subsets, every editorial input, and the output checksum. Frozen Kaikki subsets in `scripts/data/*.json.gz` preserve source glosses, POS, sense IDs, tags, grammatical links, and sense-specific Vietnamese translations. They are adaptations under CC BY-SA 4.0, committed for reproducible rebuilds. The 534 MB raw source stays in ignored `.cache/english-wordnet/` and is not deployed.

## Selection and corrections

The build applies these layers in order:

1. Guarded paired Vietnamese corrections: **309 entries**, including common irregular forms and misleading beginner senses.
2. Guarded same-headword CSV repairs: **876 entries** — 401 recover a real later source sense; 475 clean known markup. These do not independently certify source semantics.
3. OEWN exact lemma / same POS selection, followed by sense-aware Wiktionary enrichment.
4. Paired editorial supplements: **164** long/reference clues, **269** Vietnamese variant-only clues, **143** verified POS repairs, and **150** spelling/canonical-sense entries.
5. **575** proven malformed spellings migrate to canonical answers with history aliases; **9** malformed contractions are excluded from the current `a–z`, 3–18-character typing mechanism.
6. A bilingual quality gate quarantines unresolved English, unreviewed POS, and structurally unusable Vietnamese clues. Quarantine means **not yet verified for play**, not “this is not an English word.”

The resolver prefers a source sense whose own Vietnamese translation matches the current clue. It never transfers translations between unrelated senses. POS changes require a matching Vietnamese source translation, an unambiguous single-POS lemma for an unspecified CSV tag, or an explicit paired editorial review. Common nouns cannot silently acquire an unrelated proper-name definition.

Explicit inflections, alternative spellings, and synonyms resolve to a real base definition with cycle/depth protection; 64 Vietnamese grammar-only clues were recovered using a verified base-form relation and a lexical Vietnamese base meaning. English entries record a source URL/sense or OEWN synset. The resolver preserves the definition of physiological “contraction” rather than trusting an erroneous abbreviation tag in the extraction.

Clues are normalized to NFC and single spaces. English clues are at most **240 characters**; Vietnamese clues are at most **120 characters**. Long English definitions are explicitly edited with a citation or left for review, never cut mid-sentence. Whole answer tokens are masked with `_____`; substrings inside other words remain intact. No remote API or translation service is called during play.

## Coverage on 26 October 2026

| Accounting of original catalog | Entries |
| --- | ---: |
| Original entries active with English clues | 65,432 |
| Explicit spelling/contraction exclusions | 584 |
| Quarantined for further review | 4,680 |
| Original catalog total | 70,696 |
| New canonical spellings added | 141 |
| **Final active bilingual catalog** | **65,573** |

The active catalog contains 36,559 OEWN clues, 27,980 Wiktionary clues, 308 guarded authored corrections, and 726 editorial supplement clues. One original correction is superseded by a later explicit layer. The JSON is 12,189,887 bytes before HTTP compression.

| Quarantine reason | Entries |
| --- | ---: |
| No exact lemma in either pinned source | 2,587 |
| Part of speech still needs editorial review | 1,737 |
| Only references, overlong definitions, or unusable source senses | 230 |
| Vietnamese punctuation/delimiters require review | 113 |
| Vietnamese clue still a grammatical note | 13 |

All 575 canonical migration targets have active EN/VI entries. Both language modes use this same active bank while the raw source and review records remain available. Every unresolved answer and reason, with source gloss samples where available, appears in `public/vocabulary/english-definition-report.json`. Do not describe these 4,680 entries as deleted, proven wrong, or fully corrected.

## Rebuild and verification

From the repository root with Node.js 22.12 or later:

```sh
# First checkout: fetch and verify the small pinned OEWN archive.
node scripts/import-english-definitions.mjs --download
# REQUIRED final step: apply Wiktionary, corrections, migrations and quality gate.
node scripts/enrich-english-definitions.mjs
node node_modules/vitest/vitest.mjs run scripts/import-english-definitions.test.mjs scripts/enrich-english-definitions.test.mjs scripts/audit-vietnamese-dictionary.test.mjs scripts/bilingual-catalog.test.mjs
```

The first command alone produces only an intermediate OEWN catalog. Always run enrichment before shipping. Subsequent builds use the local OEWN cache and committed frozen Kaikki subsets, so they need no source network requests. Ordinary app builds use the committed final JSON directly.

For a deliberate full source regeneration, `node scripts/enrich-english-definitions.mjs --download --freeze-sources` downloads the large Kaikki archive only when absent, verifies its pinned checksum, streams it, and rewrites filtered gzip snapshots. This is a maintenance operation, not deployment. Do not update a source checksum merely to bypass a mismatch.

The output has `entries`, `excluded`, and `quarantined` as separate categories. English entries contain `meaning`, `partOfSpeech`, and source identifiers; changed VI/POS entries also contain `vietnameseMeaning`. Tests check source selection, sense isolation, grammatical references, stale correction guards, typo migration, complete accounting, and the bilingual quality gate. Commit source/report files together with generated output.

The user-supplied CSV has no known license notice. Its origin is recorded separately; the open dictionary licenses are not falsely applied to that raw CSV. Wiktionary-derived definitions and translations retain CC BY-SA attribution and source links, while OEWN material retains its own notices.
