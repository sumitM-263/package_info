import React, { useEffect, useMemo, useState } from 'react';
import { loadPackage, loadAlternatives } from './api/npm';
import { normalize } from './logic/normalize';
import { detectIntent } from './logic/intent';

const compactNumber = (value) => {
  if (value == null || Number.isNaN(value)) return '—';
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatBytes = (value) => {
  if (value == null) return '—';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} kB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

const ago = (value) => {
  if (!value) return null;
  const diffDays = Math.floor((Date.now() - new Date(value)) / 86400000);
  if (diffDays < 1) return 'today';
  if (diffDays < 31) return `${diffDays} days ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${(diffDays / 365).toFixed(1)} years ago`;
};

const buildTakeaways = (packages) => {
  const ok = packages.filter((pkg) => pkg?.ok);
  const lines = [];

  if (ok.length < 2) return lines;

  const byDownloads = ok.filter((pkg) => pkg.weeklyDownloads != null).sort((a, b) => (b.weeklyDownloads || 0) - (a.weeklyDownloads || 0));
  if (byDownloads.length >= 2 && byDownloads[1].weeklyDownloads > 0) {
    const ratio = byDownloads[0].weeklyDownloads / byDownloads[1].weeklyDownloads;
    lines.push(`${byDownloads[0].name} has ${ratio.toFixed(1)}× the weekly downloads of ${byDownloads[1].name} (${compactNumber(byDownloads[0].weeklyDownloads)} vs ${compactNumber(byDownloads[1].weeklyDownloads)}).`);
  }

  const byRelease = ok.filter((pkg) => pkg.releasedAt).sort((a, b) => new Date(b.releasedAt) - new Date(a.releasedAt));
  if (byRelease.length >= 2) {
    lines.push(`${byRelease[0].name}'s latest release is the most recent (${formatDate(byRelease[0].releasedAt)}); ${byRelease[byRelease.length - 1].name}'s was ${formatDate(byRelease[byRelease.length - 1].releasedAt)}.`);
  }

  const bySize = ok.filter((pkg) => pkg.unpackedSize != null).sort((a, b) => a.unpackedSize - b.unpackedSize);
  if (bySize.length >= 2) {
    lines.push(`${bySize[0].name} has the smallest unpacked size (${formatBytes(bySize[0].unpackedSize)}); ${bySize[bySize.length - 1].name} is the largest (${formatBytes(bySize[bySize.length - 1].unpackedSize)}).`);
  }

  const depsFree = ok.filter((pkg) => pkg.dependencies === 0).map((pkg) => pkg.name);
  if (depsFree.length && depsFree.length < ok.length) {
    lines.push(`${depsFree.join(' and ')} ${depsFree.length > 1 ? 'have' : 'has'} no runtime dependencies.`);
  }

  ok.filter((pkg) => pkg.deprecated).forEach((pkg) => {
    lines.unshift(`⚠ ${pkg.name} is deprecated: ${pkg.deprecated}`);
  });

  const licenses = [...new Set(ok.map((pkg) => pkg.license).filter(Boolean))];
  if (licenses.length === 1 && ok.length > 1) {
    lines.push(`All compared packages use the ${licenses[0]} license.`);
  }

  return lines;
};

function PackageError({ pkg, onRetry }) {
  const message = pkg?.error?.kind ? {
    not_found: 'That package was not found on npm.',
    rate_limited: 'npm is rate-limiting requests right now. Try again in a moment.',
    timeout: 'npm took too long to respond.',
    network: 'Could not reach npm. Check your connection.',
    server: 'npm returned an error.',
    bad_data: 'npm returned unreadable data.',
  }[pkg.error.kind] || 'Could not load this package.' : 'Could not load this package.';

  return (
    <div style={{ border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', borderRadius: 12, padding: 16 }}>
      <div><strong>{pkg?.name || 'Package'}</strong>: {message}</div>
      <div style={{ marginTop: 12 }}>
        {onRetry ? <button type="button" onClick={onRetry}>Retry</button> : null}
      </div>
    </div>
  );
}

function StatCard({ label, value, tone = 'neutral' }) {
  return (
    <div style={{ flex: '1 1 120px', background: tone === 'accent' ? '#eef2ff' : '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: '10px 12px', minWidth: 120 }}>
      <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: '#111827' }}>{value}</div>
    </div>
  );
}

function DetailsView({ pkg, emphasis = 'default', onRetry }) {
  if (!pkg?.ok) return <PackageError pkg={pkg} onRetry={onRetry} />;

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {pkg.deprecated ? (
        <div style={{ border: '1px solid #fecaca', background: '#fff1f2', color: '#9f1239', borderRadius: 12, padding: 12, fontWeight: 700 }}>
          <strong>Deprecated</strong>
          <div style={{ marginTop: 4 }}>{pkg.deprecated}</div>
        </div>
      ) : null}

      <div>
        <div style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8 }}>Package</div>
        <div style={{ fontSize: emphasis === 'version' ? 32 : 28, fontWeight: 800, marginTop: 4 }}>{pkg.name}</div>
        <div style={{ fontSize: emphasis === 'version' ? 18 : 16, color: '#4b5563', marginTop: 6 }}>{pkg.description || 'No description provided.'}</div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <StatCard label="Version" value={pkg.version ? `v${pkg.version}` : '—'} tone={emphasis === 'version' ? 'accent' : 'neutral'} />
        <StatCard label="Weekly downloads" value={pkg.weeklyDownloads != null ? compactNumber(pkg.weeklyDownloads) : '—'} tone="accent" />
        <StatCard label="License" value={pkg.license || '—'} />
        <StatCard label="Release" value={pkg.releasedAt ? `${formatDate(pkg.releasedAt)} · ${ago(pkg.releasedAt)}` : '—'} />
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ fontWeight: 700, color: '#374151' }}>Overview</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ background: '#ecfdf5', color: '#065f46', padding: '6px 10px', borderRadius: 999, fontSize: 12 }}>Unpacked size: {formatBytes(pkg.unpackedSize)}</span>
          <span style={{ background: '#eef2ff', color: '#3730a3', padding: '6px 10px', borderRadius: 999, fontSize: 12 }}>Dependencies: {pkg.dependencies}</span>
          <span style={{ background: '#fef3c7', color: '#92400e', padding: '6px 10px', borderRadius: 999, fontSize: 12 }}>Versions: {pkg.versionCount ?? '—'}</span>
        </div>
      </div>

      {pkg.daily && pkg.daily.length > 1 ? <DownloadsChart series={[{ name: pkg.name, points: pkg.daily }]} /> : null}

      {pkg.partial ? <div style={{ color: '#6b7280', fontSize: 12 }}>Some data could not be loaded and is shown as “—”.</div> : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <a href={`https://www.npmjs.com/package/${pkg.name}`} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 600 }}>npm</a>
        {pkg.repository ? <a href={pkg.repository} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 600 }}>Repository</a> : null}
        {pkg.homepage ? <a href={pkg.homepage} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 600 }}>Homepage</a> : null}
      </div>
    </div>
  );
}

function DownloadsChart({ series }) {
  const usable = series.filter((entry) => entry?.points && entry.points.length > 1);
  if (!usable.length) return <div style={{ color: '#6b7280', fontSize: 12 }}>Not enough download history to chart.</div>;

  const width = 560;
  const height = 180;
  const padding = { left: 44, right: 12, top: 10, bottom: 22 };
  const maxValue = Math.max(...usable.flatMap((entry) => entry.points.map((point) => point.downloads || 0)), 1);
  const totalPoints = Math.max(...usable.map((entry) => entry.points.length));
  const xFor = (index) => padding.left + (index / Math.max(totalPoints - 1, 1)) * (width - padding.left - padding.right);
  const yFor = (value) => padding.top + (1 - value / maxValue) * (height - padding.top - padding.bottom);

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ fontWeight: 700, color: '#374151' }}>Daily downloads</div>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', borderRadius: 8, background: '#f9fafb', border: '1px solid #e5e7eb' }} role="img" aria-label="Daily downloads chart">
        {[0, 0.5, 1].map((fraction) => {
          const tickValue = Math.round(maxValue * fraction);
          const y = yFor(tickValue);
          return (
            <g key={fraction}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#e5e7eb" strokeWidth="1" />
              <text x={padding.left - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#6b7280">{compactNumber(tickValue)}</text>
            </g>
          );
        })}

        {usable.map((entry, index) => {
          const stroke = ['#2563eb', '#f97316', '#16a34a'][index % 3];
          const points = entry.points.map((point, pointIndex) => `${xFor(pointIndex)},${yFor(point.downloads || 0)}`).join(' ');
          return <polyline key={entry.name} fill="none" stroke={stroke} strokeWidth="2" strokeDasharray={index % 2 ? '6 3' : ''} points={points} />;
        })}
      </svg>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, color: '#374151' }}>
        {usable.map((entry, index) => (
          <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, display: 'inline-block', borderRadius: 999, background: ['#2563eb', '#f97316', '#16a34a'][index % 3] }} />
            {entry.name}
          </div>
        ))}
      </div>
    </div>
  );
}

function CompareView({ packages, truncated = false }) {
  const rows = [
    ['Latest version', (pkg) => pkg.version ? `v${pkg.version}` : '—'],
    ['Released', (pkg) => pkg.releasedAt ? formatDate(pkg.releasedAt) : '—'],
    ['Weekly downloads', (pkg) => pkg.weeklyDownloads != null ? compactNumber(pkg.weeklyDownloads) : '—'],
    ['License', (pkg) => pkg.license || '—'],
    ['Unpacked size', (pkg) => formatBytes(pkg.unpackedSize)],
    ['Dependencies', (pkg) => String(pkg.dependencies ?? '—')],
    ['Status', (pkg) => (pkg.deprecated ? 'Deprecated' : 'Active')],
  ];

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ fontSize: 28, fontWeight: 800 }}>{packages.map((pkg) => pkg.name).join(' vs ')}</div>
      {truncated ? <div style={{ color: '#6b7280', fontSize: 12 }}>Showing the first 3 packages from your query.</div> : null}
      <ul style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 6 }}>
        {buildTakeaways(packages).map((line, index) => (
          <li key={`${line}-${index}`} style={{ color: '#374151' }}>{line}</li>
        ))}
      </ul>

      {packages.some((pkg) => pkg.ok && pkg.daily && pkg.daily.length > 1) ? (
        <DownloadsChart series={packages.filter((pkg) => pkg.ok && pkg.daily && pkg.daily.length > 1).map((pkg) => ({ name: pkg.name, points: pkg.daily }))} />
      ) : null}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 540 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '10px 8px', color: '#6b7280' }}>Metric</th>
              {packages.map((pkg) => (
                <th key={pkg.name} style={{ textAlign: 'left', padding: '10px 8px', color: '#111827', fontWeight: 700 }}>{pkg.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, formatter]) => (
              <tr key={label}>
                <td style={{ padding: '10px 8px', color: '#6b7280', fontWeight: 600 }}>{label}</td>
                {packages.map((pkg) => (
                  <td key={`${pkg.name}-${label}`} style={{ padding: '10px 8px' }}>
                    {pkg.ok ? formatter(pkg) : <em>Couldn’t load</em>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AlternativesView({ target, items, queryText, onRetry }) {
  if (!target?.ok) return <PackageError pkg={target} onRetry={onRetry} />;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ fontSize: 28, fontWeight: 800 }}>Alternatives to {target.name}</div>
      {target.deprecated ? (
        <div style={{ border: '1px solid #fecaca', background: '#fff1f2', color: '#9f1239', borderRadius: 12, padding: 12, fontWeight: 700 }}>
          <strong>Deprecated</strong>
          <div style={{ marginTop: 4 }}>{target.deprecated}</div>
        </div>
      ) : null}
      <div style={{ color: '#4b5563', fontSize: 12 }}>Ranked by shared keywords, then weekly downloads. Search text: {queryText}</div>
      <div style={{ display: 'grid', gap: 10 }}>
        {items.length ? items.map((pkg) => (
          <div key={pkg.name} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, background: '#f9fafb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{pkg.name}</div>
              <div style={{ color: '#374151', fontWeight: 600 }}>{pkg.weeklyDownloads != null ? `${compactNumber(pkg.weeklyDownloads)} / week` : 'Downloads unavailable'}</div>
            </div>
            <div style={{ marginTop: 6, color: '#4b5563' }}>{pkg.description || 'Alternative package.'}</div>
            {pkg.shared && pkg.shared.length ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {pkg.shared.map((keyword) => (
                  <span key={`${pkg.name}-${keyword}`} style={{ background: '#e5e7eb', borderRadius: 999, padding: '4px 8px', fontSize: 11, color: '#374151' }}>{keyword}</span>
                ))}
              </div>
            ) : null}
          </div>
        )) : (
          <div style={{ color: '#6b7280', fontSize: 12 }}>No similar packages found for {target.name}. <button type="button" onClick={onRetry}>Retry</button></div>
        )}
      </div>
    </div>
  );
}

const extractNames = (rawQuery) => {
  if (!rawQuery) return [];
  const stopWords = new Set(['npm', 'package', 'packages', 'info', 'details', 'latest', 'current', 'version', 'of', 'to', 'for', 'and', 'vs', 'versus', 'compare', 'alternative', 'alternatives', 'similar', 'like', 'show', 'what', 'is', 'the', 'with', 'find', 'between']);
  return [...new Set(rawQuery
    .replace(/[^a-zA-Z0-9@._/\-,\s]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim().replace(/,$/, ''))
    .filter(Boolean)
    .filter((token) => !stopWords.has(token.toLowerCase()))
    .filter((token) => /^[a-zA-Z0-9@._/-]+$/.test(token))
    .slice(0, 3))];
};

const getEmptyStateMessage = (query) => {
  const trimmed = (query || '').trim();
  if (!trimmed) {
    return 'Search for an npm package, such as react, express, or compare react vs vue.';
  }
  return `I couldn’t find a package in “${trimmed}”. Try a package name like react, express, or request.`;
};

export default function PackageLens(props) {
  const { searchData, searchQuery, messageHandlers, format } = props;
  const [state, setState] = useState({ status: 'loading' });
  const [retryToken, setRetryToken] = useState(0);

  const normalized = useMemo(() => normalize(searchData, searchQuery), [searchData, searchQuery]);
  const resolvedNames = useMemo(() => {
    if (normalized.names.length) return normalized.names;
    return extractNames(searchQuery || normalized.query).slice(0, 3);
  }, [normalized.names, normalized.query, searchQuery]);
  const intent = useMemo(() => detectIntent(normalized.query || searchQuery || '', resolvedNames), [normalized.query, searchQuery, resolvedNames]);

  useEffect(() => {
    messageHandlers?.componentLoaded?.();
  }, [messageHandlers]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setState({ status: 'loading' });

        if (intent.intent === 'none' || resolvedNames.length === 0) {
          if (!cancelled) setState({ status: 'none', query: (searchQuery || normalized.query || '').trim() });
          return;
        }

        if (intent.intent === 'alternatives') {
          const data = await loadAlternatives(intent.packages[0]);
          if (!cancelled) setState({ status: 'ready', data, intent: intent.intent });
          return;
        }

        const data = await Promise.all(intent.packages.map((name) => loadPackage(name)));
        if (!cancelled) setState({ status: 'ready', data, intent: intent.intent, emphasis: intent.emphasis || 'default' });
      } catch (error) {
        if (!cancelled) setState({ status: 'error', error });
      }
    };

    load();
    return () => { cancelled = true; };
  }, [normalized.query, searchQuery, resolvedNames.join('|'), intent.intent, intent.packages.join('|'), retryToken]);

  if (state.status === 'loading') {
    return (
      <div style={{ maxWidth: format === 'sidebar' ? 360 : 820, margin: '0 auto', padding: 18, border: '1px solid #e5e7eb', borderRadius: 16, background: '#fff' }}>
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ height: 24, background: '#f1f5f9', borderRadius: 8 }} />
          <div style={{ height: 14, background: '#f1f5f9', borderRadius: 8 }} />
          <div style={{ height: 14, background: '#f1f5f9', borderRadius: 8 }} />
          <div style={{ height: 14, background: '#f1f5f9', borderRadius: 8 }} />
        </div>
      </div>
    );
  }

  if (state.status === 'none') {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: 18 }}>
        <div style={{ border: '1px solid #e5e7eb', background: '#f9fafb', borderRadius: 12, padding: 16 }}>
          {getEmptyStateMessage(state.query || searchQuery || '')}
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: 18 }}>
        <div style={{ border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', borderRadius: 12, padding: 16 }}>
          {state.error?.message || 'Unable to load package metadata'}
          <div style={{ marginTop: 12 }}><button type="button" onClick={() => setRetryToken((value) => value + 1)}>Retry</button></div>
        </div>
      </div>
    );
  }

  if (state.intent === 'alternatives') {
    return (
      <div style={{ maxWidth: format === 'sidebar' ? 360 : 920, margin: '0 auto', padding: 18, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 18 }}>
        <AlternativesView target={state.data.target} items={state.data.items} queryText={state.data.queryText} onRetry={() => setRetryToken((value) => value + 1)} />
      </div>
    );
  }

  const packages = state.data || [];
  if (state.intent === 'compare' && packages.length > 1) {
    return (
      <div style={{ maxWidth: format === 'sidebar' ? 360 : 920, margin: '0 auto', padding: 18, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 18 }}>
        <CompareView packages={packages} truncated={intent.truncated || false} />
      </div>
    );
  }

  const primary = packages[0] || { name: intent.packages[0], ok: false };
  return (
    <div style={{ maxWidth: format === 'sidebar' ? 360 : 920, margin: '0 auto', padding: 18, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 18 }}>
      <DetailsView pkg={primary} emphasis={state.emphasis || 'default'} onRetry={() => setRetryToken((value) => value + 1)} />
    </div>
  );
}
