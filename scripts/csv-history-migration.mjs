/** Import-time migration only: editorial meanings/POS never overwrite the user's CSV. */
export function mergeCsvHistoryAliases(words, editorial) {
  const valid = answer => typeof answer === 'string' && /^[a-z]{3,18}$/.test(answer);
  const current = new Set(words.map(word => word.answer));
  const renamed = new Map();
  for (const patch of editorial?.corrections ?? []) {
    const from = patch?.answer, to = patch?.after?.answer;
    if (!valid(from) || !valid(to) || from === to) continue;
    const targets = renamed.get(from) ?? new Set();
    targets.add(to); renamed.set(from, targets);
  }
  const terminal = start => {
    const visited = new Set(); let answer = start;
    while (renamed.has(answer)) {
      if (visited.has(answer) || renamed.get(answer).size !== 1) return undefined;
      visited.add(answer); answer = [...renamed.get(answer)][0];
    }
    return answer;
  };
  const owners = new Map();
  const add = (alias, answer) => {
    if (!valid(alias) || !current.has(answer) || current.has(alias)) return;
    const candidates = owners.get(alias) ?? new Set(); candidates.add(answer); owners.set(alias, candidates);
  };
  for (const word of words) for (const alias of word.historyAliases ?? []) add(alias, word.answer);
  for (const alias of renamed.keys()) {
    const answer = terminal(alias);
    if (answer) add(alias, answer);
  }
  const aliases = new Map();
  for (const [alias, candidates] of owners) {
    if (candidates.size !== 1) continue;
    const answer = [...candidates][0], list = aliases.get(answer) ?? [];
    list.push(alias); aliases.set(answer, list);
  }
  return words.map(word => {
    const { historyAliases: _old, ...currentWord } = word;
    const migrated = aliases.get(word.answer)?.sort();
    return migrated?.length ? { ...currentWord, historyAliases: migrated } : currentWord;
  });
}
