const normalizeForSimilarity = value => String(value || '')
  .replace(/\s+/g, '')
  .replace(/[()[\]·_/.,-]/g, '')
  .replace(/(한다|하기|함|조회|관리)$/g, '')
  .toLowerCase();

const diceSimilarity = (left, right) => {
  const a = normalizeForSimilarity(left);
  const b = normalizeForSimilarity(right);
  if (!a && !b) return 1;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const bigrams = value => {
    const result = new Map();
    for (let index = 0; index < value.length - 1; index += 1) {
      const pair = value.slice(index, index + 2);
      result.set(pair, (result.get(pair) || 0) + 1);
    }
    return result;
  };
  const aBigrams = bigrams(a);
  const bBigrams = bigrams(b);
  let overlap = 0;
  for (const [pair, count] of aBigrams) overlap += Math.min(count, bBigrams.get(pair) || 0);
  return (2 * overlap) / (a.length + b.length - 2);
};

module.exports = { diceSimilarity, normalizeForSimilarity };
