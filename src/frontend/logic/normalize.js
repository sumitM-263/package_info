export function normalize(searchData, fallbackQuery = '') {
  const sd = Array.isArray(searchData) ? searchData[0] : searchData;
  const query = (sd?.query || fallbackQuery || '').trim();
  const entities = Array.isArray(sd?.entities) ? sd.entities : [];
  const seen = new Set();
  const names = [];

  for (const entity of entities) {
    const sourceID = entity?.sourceID || entity?.word || entity?.name;
    if (!sourceID || seen.has(sourceID)) continue;
    seen.add(sourceID);
    names.push(sourceID);
  }

  return { query, names };
}
