// ============================================================
// textExtract.js — 입력 텍스트 정확도 유틸 (순수 함수, 테스트 대상)
// ============================================================

// ── D2. PDF 줄 재구성 ────────────────────────────────────────
// pdfjs getTextContent()의 items를 좌표 기반으로 줄/칸 복원한다.
// 기존: items.map(i=>i.str).join(' ') → 표의 행/셀 경계가 전부 소실,
// 요구사항 표(ID|요구사항명|상세설명)가 한 줄로 뭉개져 수집 단계에서 유실됐다.
// item.transform = [a,b,c,d,x,y] (x=transform[4], y=transform[5])
export const reconstructPdfLines = (items, opts = {}) => {
  const { yTolerance = 3, colGapRatio = 1.5 } = opts;
  const valid = (items || []).filter(
    it => it && typeof it.str === 'string' && Array.isArray(it.transform)
  );
  if (valid.length === 0) return '';

  // 1) y좌표(내림차순=위→아래)로 줄 그룹핑 (허용오차 내 같은 줄)
  const sorted = [...valid].sort((a, b) => b.transform[5] - a.transform[5]);
  const lines = [];
  let current = null;
  for (const it of sorted) {
    const y = it.transform[5];
    if (current && Math.abs(current.y - y) <= yTolerance) {
      current.items.push(it);
    } else {
      current = { y, items: [it] };
      lines.push(current);
    }
  }

  // 2) 줄 내부를 x좌표로 정렬, 큰 가로 간격은 셀 경계(탭)로 표기
  return lines
    .map(line => {
      const xs = line.items.sort((a, b) => a.transform[4] - b.transform[4]);
      // 평균 글자폭 추정 (width/글자수), 0 방지
      const widths = xs
        .filter(it => it.str.trim().length > 0 && it.width > 0)
        .map(it => it.width / Math.max(1, it.str.length));
      const avgChar = widths.length > 0
        ? widths.reduce((s, w) => s + w, 0) / widths.length
        : 6;
      let out = '';
      let prevEnd = null;
      for (const it of xs) {
        const x = it.transform[4];
        if (prevEnd !== null) {
          const gap = x - prevEnd;
          if (gap > avgChar * colGapRatio * 2) out += '\t'; // 셀 경계
          else if (gap > avgChar * 0.3) out += ' ';
        }
        out += it.str;
        prevEnd = x + (it.width || it.str.length * avgChar);
      }
      return out;
    })
    .filter(l => l.trim().length > 0)
    .join('\n');
};

// ── D3. 줄 경계 청크 분할 + 오버랩 ───────────────────────────
// 기존: 2,500자 고정 컷 → 청크 경계에 걸린 요구사항/표 행이 잘려 유실.
// 줄 단위로 자르고 청크 간 오버랩을 둬서 경계 유실을 막는다.
export const splitTextChunks = (text, size = 8000, overlap = 300) => {
  if (!text) return [];
  if (text.length <= size) return [text];
  const lines = text.split('\n');
  const chunks = [];
  let buf = '';
  for (const line of lines) {
    // 한 줄이 size를 초과하는 비정상 케이스: 강제 분할
    if (line.length > size) {
      if (buf) { chunks.push(buf); buf = ''; }
      for (let i = 0; i < line.length; i += size) chunks.push(line.slice(i, i + size));
      continue;
    }
    if (buf.length + line.length + 1 > size) {
      chunks.push(buf);
      buf = overlap > 0 ? buf.slice(-overlap) + '\n' + line : line;
    } else {
      buf = buf ? buf + '\n' + line : line;
    }
  }
  if (buf.trim()) chunks.push(buf);
  return chunks;
};

// ── D3. RFP 섹션 우선순위 컷 ─────────────────────────────────
// 예산(글자수)을 넘는 RFP는 무지성 앞부분 컷 대신,
// 기능 요구사항 밀도가 높은 블록을 우선 포함하고
// 행정 섹션(제안 안내/평가/계약)을 먼저 버린다.
const FUNC_KEYWORDS = /기능|요구사항|등록|조회|수정|삭제|처리|연동|관리|구현|제공|화면|SFR|FUR|REQ-|FR-/g;
// 사업관리/품질/교육/유지보수 등 RFP 행정 섹션 패턴.
// "관리" 단어만으로는 기능 섹션과 구분이 안 되므로(사업'관리' 방안 vs 사용자'관리' 기능)
// 행정 맥락의 복합 패턴 + 비기능 요구 ID(PMR/QUR 등)로 식별하고 페널티를 강하게 준다.
const ADMIN_KEYWORDS = /제안서\s*작성|평가\s*(기준|방법|항목)|입찰|계약\s*조건|제출\s*서류|유의\s*사항|배점|협상|청렴|보안\s*서약|하도급|사업\s*관리\s*(방안|계획|체계)|사업\s*수행\s*(계획|조직|체계)|수행\s*계획서|투입\s*인력|품질\s*(관리|보증)\s*(방안|체계|활동)?|일정\s*관리|위험\s*관리|진척\s*관리|보고\s*체계|산출물\s*(관리|목록|제출)|교육\s*(계획|방안|훈련)|유지\s*보수|하자\s*보수|검수\s*(기준|절차)|착수\s*(보고|시)|준공|PMR-|QUR-|PSR-|COR-|TER-|PER-/g;

export const prioritizeRfpText = (text, budget = 150000) => {
  if (!text || text.length <= budget) return text || '';
  // 빈 줄 2개 이상 또는 장 표제 기준으로 블록 분할 (공백 블록 제외)
  const blocks = text.split(/\n{2,}/).filter(b => b.trim().length > 0);
  const scored = blocks.map((b, i) => {
    const func = (b.match(FUNC_KEYWORDS) || []).length;
    const admin = (b.match(ADMIN_KEYWORDS) || []).length;
    const density = b.length > 0 ? func / Math.sqrt(b.length) : 0;
    const adminDensity = b.length > 0 ? admin / Math.sqrt(b.length) : 0;
    // 행정 패턴이 명확한 블록은 기능 키워드가 많아도 강하게 후순위
    return { i, b, score: density - adminDensity * 3 };
  });
  // 점수 내림차순으로 예산까지 채우되, 원문 순서로 재배열 (문맥 유지)
  // 음수 점수(행정 패턴 우세) 블록은 예산이 남아도 제외 — 사업관리/품질/교육
  // 섹션이 요구사항 수집을 오염시켜 "사업관리" 같은 가짜 도메인을 만든다
  const ranked = [...scored].sort((a, b) => b.score - a.score);
  const picked = [];
  let used = 0;
  for (const s of ranked) {
    if (s.score < 0) continue;
    if (used + s.b.length + 2 > budget) continue;
    picked.push(s);
    used += s.b.length + 2;
  }
  // 가드: 양성 블록이 하나도 없을 때만 점수순 백필 (빈 결과 방지).
  // 주의: "결과가 작으면 백필" 조건은 기능 섹션이 작은 RFP에서
  // 행정 블록을 도로 채워넣는 역효과가 있어 금지.
  if (picked.length === 0) {
    for (const s of ranked) {
      if (used + s.b.length + 2 > budget) continue;
      picked.push(s);
      used += s.b.length + 2;
    }
  }
  return picked.sort((a, b) => a.i - b.i).map(s => s.b).join('\n\n');
};

// ── D1. 기능목록 문서 감지 ───────────────────────────────────
// 기존 기능목록을 PDF/DOCX로 업로드하면 RFP 텍스트로 삼켜져
// 고도화가 무효화되는 사고 방지. 휴리스틱:
//  - LV 헤더 토큰 존재
//  - 줄 끝이 CRUD 동사로 끝나는 짧은 행의 비율
//  - "A > B > C" 계층 구분자 비율
export const detectFunctionListPattern = (text) => {
  if (!text || text.length < 200) return { isFunctionList: false, score: 0 };
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 10) return { isFunctionList: false, score: 0 };

  const sample = lines.slice(0, 300);
  const hasLvHeader = /LV\s*1|LV\s*2|LV\s*3|대분류.*중분류|단위\s*업무|기능\s*분해/i.test(
    sample.slice(0, 30).join(' ')
  );
  const CRUD = '등록|수정|삭제|조회|검색|처리|승인|반려|출력|설정|업로드|다운로드|초기화|활성|비활성|관리|모니터링|재시작';
  // 신호1: 줄 끝이 CRUD 동사 (탭/번호 제거 후)
  const verbEndRe = new RegExp(`(${CRUD})\\s*$`);
  const verbEnd = sample.filter(l =>
    l.length < 80 && verbEndRe.test(l.replace(/[\d.\s)]+$/, ''))
  ).length;
  // 신호2: CRUD 동사가 줄 중간에 단어로 등장 (기능명 컬럼 + 기능정의 컬럼 패턴)
  const verbMidRe = new RegExp(`(${CRUD})(\\s|\\t)`);
  const verbMid = sample.filter(l => l.length < 200 && verbMidRe.test(l)).length;
  // 신호3: 계층 구분자
  const hierarchy = sample.filter(l => /\s>\s.*\s>\s|\t.*\t/.test(l)).length;
  // 신호4: 첫 토큰(LV1 컬럼) 반복률 — 기능목록은 대분류가 수십 번 반복된다
  const firstTokens = sample.map(l => l.split(/[\s\t]+/)[0]).filter(t => t && t.length >= 2);
  const tokenCounts = {};
  firstTokens.forEach(t => { tokenCounts[t] = (tokenCounts[t] || 0) + 1; });
  const top5 = Object.values(tokenCounts).sort((a, b) => b - a).slice(0, 5)
    .reduce((s, c) => s + c, 0);
  const repeatRatio = firstTokens.length > 0 ? top5 / firstTokens.length : 0;
  // 음성 신호: 요구사항 서술형이 많으면 RFP다
  const reqStyle = sample.filter(l => /해야\s*한다|하여야\s*한다|을\s*제공|요구사항\s*ID|있어야\s*한다/.test(l)).length;

  const verbRatio = verbEnd / sample.length;
  const verbMidRatio = verbMid / sample.length;
  const hierRatio = hierarchy / sample.length;
  const reqRatio = reqStyle / sample.length;

  let score = verbRatio * 2
    + verbMidRatio * 0.6
    + hierRatio * 1.2
    + (repeatRatio > 0.5 ? 0.4 : 0)
    + (hasLvHeader ? 0.3 : 0)
    - reqRatio * 2;
  return {
    isFunctionList: score >= 0.5 && reqRatio < 0.15,
    score: Math.round(score * 100) / 100,
  };
};
