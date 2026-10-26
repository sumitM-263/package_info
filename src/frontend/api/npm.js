import { getJson } from './http';

const REGISTRY = 'https://registry.npmjs.org';
const DOWNLOADS = 'https://api.npmjs.org/downloads';
const enc = encodeURIComponent;

const normalizeLicense = (license) => {
  if (!license) return null;
  if (typeof license === 'string') return license;
  return license.type || null;
};

const repoUrl = (repository) => {
  const raw = typeof repository === 'string' ? repository : repository?.url;
  if (!raw) return null;
  return raw.replace(/^git\+/, '').replace(/\.git$/, '').replace(/^git:\/\//, 'https://');
};

const mapLimit = async (items, limit, fn) => {
  const results = new Array(items.length);
  let index = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (index < items.length) {
        const currentIndex = index++;
        results[currentIndex] = await fn(items[currentIndex]);
      }
    })
  );
  return results;
};

export const getLatest = (name) => getJson(`${REGISTRY}/${enc(name)}/latest`);
export const getRecord = (name) => getJson(`${REGISTRY}/${enc(name)}`);
export const getWeekly = (name) => getJson(`${DOWNLOADS}/point/last-week/${enc(name)}`);
export const getRange = (name) => getJson(`${DOWNLOADS}/range/last-month/${enc(name)}`);
export const searchPkgs = (text, size = 25) => getJson(`${REGISTRY}/-/v1/search?text=${enc(text)}&size=${size}`);

export async function loadPackage(name) {
  const [latestResult, recordResult, weeklyResult, monthResult] = await Promise.allSettled([
    getLatest(name),
    getRecord(name),
    getWeekly(name),
    getRange(name),
  ]);

  if (latestResult.status === 'rejected') {
    return { name, ok: false, error: latestResult.reason };
  }

  const latest = latestResult.value;
  const record = recordResult.status === 'fulfilled' ? recordResult.value : null;
  const weekly = weeklyResult.status === 'fulfilled' ? weeklyResult.value : null;
  const month = monthResult.status === 'fulfilled' ? monthResult.value : null;

  return {
    name,
    ok: true,
    version: latest.version || null,
    description: latest.description || '',
    license: normalizeLicense(latest.license),
    homepage: latest.homepage || null,
    repository: repoUrl(latest.repository),
    keywords: Array.isArray(latest.keywords) ? latest.keywords : [],
    deprecated: typeof latest.deprecated === 'string' ? latest.deprecated || 'This package is deprecated.' : null,
    releasedAt: record?.time?.[latest.version] || null,
    createdAt: record?.time?.created || null,
    versionCount: record && record.versions ? Object.keys(record.versions).length : null,
    dependencies: latest.dependencies ? Object.keys(latest.dependencies).length : 0,
    unpackedSize: latest.dist?.unpackedSize ?? null,
    weeklyDownloads: weekly?.downloads ?? null,
    daily: month?.downloads ?? null,
    partial: [recordResult, weeklyResult, monthResult].some((result) => result.status === 'rejected'),
  };
}

export async function loadAlternatives(name) {
  const target = await loadPackage(name);
  if (!target.ok) {
    return { target, items: [] };
  }

  const keywords = (target.keywords || []).slice(0, 4);
  const text = keywords.length
    ? keywords.join(' ')
    : (target.description || name).split(/\s+/).slice(0, 6).join(' ');

  const result = await getJson(`${REGISTRY}/-/v1/search?text=${enc(text)}&size=25`);
  const targetKeywords = new Set((target.keywords || []).map((word) => String(word).toLowerCase()));

  const candidates = (result.objects || [])
    .map((entry) => entry.package)
    .filter((pkg) => pkg && pkg.name !== name)
    .map((pkg) => {
      const shared = (pkg.keywords || []).filter((keyword) => targetKeywords.has(String(keyword).toLowerCase()));
      return {
        name: pkg.name,
        description: pkg.description || '',
        version: pkg.version || null,
        shared,
      };
    })
    .filter((pkg) => pkg.shared.length > 0 || targetKeywords.size === 0);

  const withDownloads = await mapLimit(candidates.slice(0, 15), 4, async (candidate) => {
    try {
      const weekly = await getWeekly(candidate.name);
      return {
        ...candidate,
        weeklyDownloads: weekly?.downloads ?? null,
      };
    } catch {
      return {
        ...candidate,
        weeklyDownloads: null,
      };
    }
  });

  withDownloads.sort((a, b) => {
    const sharedDelta = b.shared.length - a.shared.length;
    if (sharedDelta !== 0) return sharedDelta;
    return (b.weeklyDownloads || 0) - (a.weeklyDownloads || 0);
  });

  return { target, items: withDownloads.slice(0, 8), queryText: text };
}
