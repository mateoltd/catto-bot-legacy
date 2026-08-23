/**
 * Lightweight subsequence fuzzy scorer.
 * Returns a score between 0 and 1, where 1 is an exact match.
 * Returns 0 if the query is not a subsequence of the target.
 */
export function fuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  if (q.length === 0) return 1;
  if (q.length > t.length) return 0;

  let qi = 0;
  let consecutiveBonus = 0;
  let score = 0;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      // Bonus for matching at word boundaries
      const atBoundary = ti === 0 || t[ti - 1] === ' ' || t[ti - 1] === '-' || t[ti - 1] === ':';
      score += atBoundary ? 2 : 1;
      // Bonus for consecutive matches
      consecutiveBonus += 1;
      score += consecutiveBonus;
      qi++;
    } else {
      consecutiveBonus = 0;
    }
  }

  if (qi < q.length) return 0; // Not a complete subsequence

  // Normalize: higher score for shorter targets (more specific match)
  const maxPossible = q.length * 4; // max if all chars at boundary + all consecutive
  return score / maxPossible;
}

/**
 * Filter function compatible with cmdk's `filter` prop.
 * Returns 0 (no match) or 1 (match) with score-based ranking.
 */
export function fuzzyFilter(value: string, search: string): number {
  const score = fuzzyScore(search, value);
  return score > 0 ? score : 0;
}
