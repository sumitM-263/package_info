const RE_COMPARE = /\b(compare|comparison|versus|vs\.?|difference between|differ|better than)\b/i;
const RE_ALTERNATIVES = /\b(alternatives?|similar|like|replacements?|replace|instead of|substitutes?)\b/i;
const RE_VERSION = /\b(latest|current|newest)\s+version\b/i;

export function detectIntent(query, names = []) {
  const safeQuery = (query || '').toLowerCase();

  if (names.length === 0) {
    return { intent: 'none', packages: [] };
  }

  const packages = names.slice(0, 3);

  if (names.length >= 2 && RE_COMPARE.test(safeQuery)) {
    return { intent: 'compare', packages, truncated: names.length > 3 };
  }
  if (RE_ALTERNATIVES.test(safeQuery)) {
    return { intent: 'alternatives', packages: [names[0]] };
  }
  if (RE_VERSION.test(safeQuery)) {
    return { intent: 'details', packages: [names[0]], emphasis: 'version' };
  }
  if (names.length >= 2) {
    return { intent: 'compare', packages, truncated: names.length > 3 };
  }

  return { intent: 'details', packages: [names[0]] };
}
