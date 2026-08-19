/**
 * Bounded longest common subsequence index pairs.
 * Callers must enforce length limits; this is O(n * m).
 */
export function lcsIndexPairs(
  left: readonly string[],
  right: readonly string[],
): { left: number; right: number }[] {
  const n = left.length;
  const m = right.length;
  const dp: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));

  for (let i = 1; i <= n; i += 1) {
    const prev = dp[i - 1]!;
    const row = dp[i]!;
    const leftValue = left[i - 1];
    for (let j = 1; j <= m; j += 1) {
      row[j] =
        leftValue === right[j - 1]
          ? (prev[j - 1]! + 1) as number
          : Math.max(prev[j]!, row[j - 1]!);
    }
  }

  const pairs: { left: number; right: number }[] = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    if (left[i - 1] === right[j - 1]) {
      pairs.push({ left: i - 1, right: j - 1 });
      i -= 1;
      j -= 1;
    } else if (dp[i - 1]![j]! >= dp[i]![j - 1]!) {
      i -= 1;
    } else {
      j -= 1;
    }
  }

  pairs.reverse();
  return pairs;
}
