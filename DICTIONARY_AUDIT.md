# Vietnamese dictionary audit — 2026-10-26

The current bank contains 70,696 entries imported from the user's CSV. This work separates explicit linguistic corrections from mechanical review candidates. A mechanical scan of every row is **not** a semantic verification of every translation.

## Reviewed corrections

`scripts/data/vietnamese-corrections.json` contains 309 explicitly reviewed, paired Vietnamese/English meanings and their parts of speech. Each patch records the previous meaning/POS, replacement, reason, and reference. The source checksum is the original CSV checksum (`data.source.sha256`), not the hash of the generated runtime JSON.

The review covers the known irregular-form failures, the current level-1 vocabulary list, and all 66 level-1–4 entries left unresolved by the first English-source pass. Of that last group, 65 received paired corrections; `dont` remains a spelling issue because standard [don't contains an apostrophe](https://dictionary.cambridge.org/us/dictionary/english/don-t). It should not be presented as a correctly spelled headword in the current letters-only game. Examples of reviewed repairs:

| Entry | Previous problem | Selected game sense |
| --- | --- | --- |
| could | Copied the container noun sense of *can* | Modal verb expressing ability or possibility |
| bled | Had the blister noun definition of *bleb* | Past/participle of *bleed* |
| caught, built, driven, took, taken | Copied noun meanings from their base verbs | Inflected verb meanings |
| working | A general Vietnamese noun combined with an obscure English mining noun | Verb: doing work |
| are, break, die, last, say | Rare first source senses were inappropriate for the beginning level | Common verb/adjective senses |
| him, her, them, they | Pronouns labelled as nouns | Pronouns with useful Vietnamese meanings |
| this, that, these, those | Grammatical metadata displayed as the clue | Demonstrative determiner meanings |
| mom, few, welcome | Damaged Vietnamese text | Authored, readable definitions |
| gumshoe, teen, polyethylene, tranquility and seven others | Only a usage label such as `<mỹ>` | Actual lexical meanings with verified POS |
| tranquilizer, tranquillizer | Missing definition or source confusion with painkillers | A medicine for reducing anxiety or tension |
| PST, PDT | Source markup and noun labels | Time-zone abbreviations with the correct UTC offsets |
| underlaid | Source conflated *underlay* with *underlie* | Past/participle of placing a layer underneath |

Choosing a common game sense does not mean a different dictionary sense is invalid. Valid homographs such as *rose* (flower), *bent* (inclination), and *felt* (fabric) are not automatically rewritten by an inflection rule.

The paired English meanings are original wording intended to keep the selected sense and POS aligned. Consulted grammatical references include [Cambridge's irregular-verb table](https://dictionary.cambridge.org/grammar/british-grammar/irregular-verbs), [Cambridge on could](https://dictionary.cambridge.org/grammar/british-grammar/could), [British Council on can/could](https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/can-could), and [Cambridge's ailing entry](https://dictionary.cambridge.org/us/dictionary/english/ailing). Per-entry dictionary links support further review; they do not imply that every entry in the CSV was independently source-verified.

## Reproducible audit

Run:

```sh
node scripts/audit-vietnamese-dictionary.mjs
node node_modules/vitest/vitest.mjs run scripts/audit-vietnamese-dictionary.test.mjs
```

The CLI reads the existing bank, original CSV, and explicit correction file. It verifies the CSV checksum and produces `assets/dictionary-audit/vietnamese-audit.json`; it does **not** overwrite the bank or the source CSV. The detailed report is a generated local artifact under the ignored `assets/` directory and can be reproduced with the command above.

`applyVietnameseCorrections(data, edition)` is available for the integration pipeline. It validates all patches before applying them, refuses changed source or stale before-values, allows already-applied corrections, and preserves word IDs, ordering, learning levels, and history aliases. Regrading belongs to the existing grading pipeline. Map-based lookups protect real vocabulary such as `constructor` from inherited object properties.

## Source recovery and cleanup

`scripts/data/vietnamese-source-repairs.json` is a separate, guarded layer with 876 repairs:

- 401 replace grammatical metadata with a concrete definition already recorded under the **same headword and POS** in the CSV. For example, *adenoma* selects the source's `u tuyến` instead of its plural-form note.
- 475 expand a finite list of known domain/usage labels, remove the nonlexical `[tq]` code, and normalize trailing punctuation while retaining the lexical wording and POS.

Every repair retains exact before/after values, original CSV row numbers, its repair kind, and a reason. Repairs cannot overwrite an existing lexical sense under the guise of grammatical recovery. Unknown tags, conflicting source POS labels, and cross-headword markers are not guessed. Country/domain labels alone, such as `(Mỹ)`, are explicitly rejected as definitions. These safeguards check the source relationship and structure; they do **not** independently verify every specialized term recovered from the CSV.

The integration order is:

```js
const authored = applyVietnameseCorrections(data, reviewedEdition);
const corrected = applySourceRepairs(authored, sourceRepairEdition);
```

The source layer contains no invented English translations. The English importer must select definitions from its lexical sources using the corrected POS and retain the exact corrected Vietnamese meaning in its paired output.

Rebuild the source layer and audit after editing the reviewed edition:

```sh
node --input-type=module -e "import {runAudit} from './scripts/audit-vietnamese-dictionary.mjs'; await runAudit({sourceRepairsOutput:'scripts/data/vietnamese-source-repairs.json'});"
```

The audit itself never writes the runtime dictionary or original CSV. Both layers must be consumed by the integration pipeline before players see the changes.

## Remaining review candidates

Snapshot after applying both layers in memory: 2,871 mechanically flagged entries, with overlapping categories:

| Check | Candidates |
| --- | ---: |
| Missing part of speech | 2,736 |
| Grammatical metadata used as a definition | 92 |
| Source markup or usage-label-only clues | 0 |
| Unresolved cross-reference | 320 |
| Unbalanced delimiters | 157 |
| Embedded editorial code | 0 |

These are review candidates, not a count of proven mistranslations. Semantic errors such as *could* meaning a container often pass schema checks; the explicit reviewed patches are therefore separate from these counts.

The 320 cross-references are not blindly replaced from their target: the source sometimes asserts an incorrect equivalence, and a matching POS alone cannot establish that two headwords share a meaning. Remaining grammar flags include inflected and Latin plural forms requiring a verified lemma, as well as some legitimate grammatical terminology. English-source repair can resolve further candidates, but these counts describe this Vietnamese layer alone.

No bulk suffix guessing, silent deletions, fabricated translations, or assertion of complete semantic verification is part of this audit.

## Integrated playable edition

The later English-source and paired editorial layers resolve more candidates than the Vietnamese-only snapshot above. The integrated edition contains **65,573** playable bilingual entries: 65,432 retained original headwords plus 141 corrected canonical headwords. It migrates 575 proven spelling errors, excludes 9 malformed contractions, and quarantines 4,680 original entries with explicit reasons in both language modes.

See [the combined source and review document](ENGLISH_DICTIONARY_SOURCES.md) and [generated report](public/vocabulary/english-definition-report.json) for the final accounting. `scripts/bilingual-catalog.test.mjs` checks complete accounting of all 70,696 original entries, equal VI/EN pools, and preserved history through spelling migrations.
