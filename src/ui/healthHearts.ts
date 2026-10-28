/** Hearts show the entire health pool, including partial hearts between hits. */
export function getHealthHearts(hp: number, maxHp: number) {
  const maximum = Number.isFinite(maxHp) && maxHp > 0 ? maxHp : 1;
  const health = Number.isFinite(hp) ? Math.max(0, Math.min(maximum, hp)) : 0;
  const count = Math.max(1, Math.floor(maximum / 20));
  const filled = health / maximum * count;
  const hearts = Array.from({ length: count }, (_, index) => Math.max(0, Math.min(1, filled - index)));
  return { health, maximum, hearts, critical: health / maximum < 0.3 };
}
