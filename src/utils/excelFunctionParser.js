const HEADER_ALIASES = {
  lv1: ['lv1', '레벨1', 'level1', '대분류', '업무대분류', '1레벨'],
  lv2: ['lv2', '레벨2', 'level2', '중분류', '업무중분류', '2레벨'],
  lv3: ['lv3', '레벨3', 'level3', '소분류', '단위기능', '세부기능', '기능명', '3레벨'],
  definition: ['기능정의', '기능설명', '상세설명', '기능내용', '정의', '설명'],
};

const normalizeHeader = value => String(value ?? '')
  .toLocaleLowerCase()
  .replace(/[\s_\-./()]/g, '');

const ALIAS_SETS = Object.fromEntries(
  Object.entries(HEADER_ALIASES).map(([key, values]) => [key, new Set(values.map(normalizeHeader))])
);

export const detectFunctionColumns = (rows, maxHeaderRows = 10) => {
  let best = { headerRow: -1, columns: {}, score: 0 };
  (rows || []).slice(0, maxHeaderRows).forEach((row, rowIndex) => {
    const columns = {};
    (row || []).forEach((value, columnIndex) => {
      const normalized = normalizeHeader(value);
      for (const [field, aliases] of Object.entries(ALIAS_SETS)) {
        if (columns[field] == null && aliases.has(normalized)) columns[field] = columnIndex;
      }
    });
    const score = ['lv1', 'lv2', 'lv3', 'definition'].filter(field => columns[field] != null).length;
    if (score > best.score) best = { headerRow: rowIndex, columns, score };
  });
  return {
    ...best,
    missing: ['lv1', 'lv2', 'lv3'].filter(field => best.columns[field] == null),
  };
};

export const columnLetterToIndex = value => {
  const text = String(value || '').trim().toUpperCase();
  if (!/^[A-Z]+$/.test(text)) return null;
  return [...text].reduce((index, char) => index * 26 + char.charCodeAt(0) - 64, 0) - 1;
};

export const parseManualColumnMapping = (value) => {
  const parts = String(value || '').split(',').map(columnLetterToIndex);
  if (parts.length < 3 || parts.slice(0, 3).some(column => column == null)) return null;
  return { lv1: parts[0], lv2: parts[1], lv3: parts[2], definition: parts[3] ?? null };
};

export const parseFunctionRows = (rows, columns, headerRow = 0) => {
  const seen = new Set();
  const functions = [];
  let sourceRows = 0;
  let incompleteRows = 0;
  let duplicateRows = 0;

  (rows || []).slice(headerRow + 1).forEach(row => {
    const get = field => columns[field] == null ? '' : String(row?.[columns[field]] ?? '').trim();
    const lv1 = get('lv1');
    const lv2 = get('lv2');
    const lv3 = get('lv3');
    const definition = get('definition');
    if (![lv1, lv2, lv3, definition].some(Boolean)) return;
    sourceRows += 1;
    if (!lv1 || !lv2 || !lv3) { incompleteRows += 1; return; }
    if (definition.endsWith('데이터정보') || lv3.endsWith('데이터정보')) return;
    const key = `${lv1}|${lv2}|${lv3}`;
    if (seen.has(key)) { duplicateRows += 1; return; }
    seen.add(key);
    functions.push({ lv1, lv2, lv3, definition: definition || `${lv3}을 처리한다` });
  });

  return {
    functions,
    stats: {
      sourceRows,
      incompleteRows,
      duplicateRows,
      missingRate: sourceRows ? incompleteRows / sourceRows : 0,
    },
  };
};
