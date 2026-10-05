import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const ROOT = process.cwd();
const FIXTURE = path.join(ROOT, 'eval', 'fixtures', 'nts_ai_ismp_rfp.pdf');
const MODEL = 'claude-sonnet-4-5';
const PRIORITY_BUDGET = 150_000;
const TO_BE_KEYWORDS = ['생성형', '챗봇', 'RAG', 'OCR', '상담', 'AI 서비스'];
const FUNC_KEYWORDS = /기능|요구사항|등록|조회|수정|삭제|처리|연동|관리|구현|제공|화면|SFR|FUR|REQ-|FR-/g;
const ADMIN_KEYWORDS = /제안서\s*작성|평가\s*(기준|방법|항목)|입찰|계약\s*조건|제출\s*서류|유의\s*사항|배점|협상|청렴|보안\s*서약|하도급|사업\s*관리\s*(방안|계획|체계)|사업\s*수행\s*(계획|조직|체계)|수행\s*계획서|투입\s*인력|품질\s*(관리|보증)\s*(방안|체계|활동)?|일정\s*관리|위험\s*관리|진척\s*관리|보고\s*체계|산출물\s*(관리|목록|제출)|교육\s*(계획|방안|훈련)|유지\s*보수|하자\s*보수|검수\s*(기준|절차)|착수\s*(보고|시)|준공|PMR-|QUR-|PSR-|COR-|TER-|PER-/g;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const loadDotEnv = async () => {
  try {
    const source = await fs.readFile(path.join(ROOT, '.env'), 'utf8');
    for (const rawLine of source.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const separator = line.indexOf('=');
      if (separator < 1) continue;
      const key = line.slice(0, separator).trim();
      let value = line.slice(separator + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
};

const reconstructPdfLines = (items, { yTolerance = 3, colGapRatio = 1.5 } = {}) => {
  const valid = (items || []).filter(item => item && typeof item.str === 'string' && Array.isArray(item.transform));
  if (valid.length === 0) return '';
  const sorted = [...valid].sort((a, b) => b.transform[5] - a.transform[5]);
  const lines = [];
  let current = null;
  for (const item of sorted) {
    const y = item.transform[5];
    if (current && Math.abs(current.y - y) <= yTolerance) current.items.push(item);
    else {
      current = { y, items: [item] };
      lines.push(current);
    }
  }
  return lines.map(line => {
    const xs = line.items.sort((a, b) => a.transform[4] - b.transform[4]);
    const widths = xs.filter(item => item.str.trim().length > 0 && item.width > 0)
      .map(item => item.width / Math.max(1, item.str.length));
    const avgChar = widths.length > 0 ? widths.reduce((sum, width) => sum + width, 0) / widths.length : 6;
    let output = '';
    let previousEnd = null;
    for (const item of xs) {
      const x = item.transform[4];
      if (previousEnd !== null) {
        const gap = x - previousEnd;
        if (gap > avgChar * colGapRatio * 2) output += '\t';
        else if (gap > avgChar * 0.3) output += ' ';
      }
      output += item.str;
      previousEnd = x + (item.width || item.str.length * avgChar);
    }
    return output;
  }).filter(line => line.trim().length > 0).join('\n');
};

const splitTextChunks = (text, size = 8000, overlap = 300) => {
  if (!text) return [];
  if (text.length <= size) return [text];
  const lines = text.split('\n');
  const chunks = [];
  let buffer = '';
  for (const line of lines) {
    if (line.length > size) {
      if (buffer) { chunks.push(buffer); buffer = ''; }
      for (let index = 0; index < line.length; index += size) chunks.push(line.slice(index, index + size));
      continue;
    }
    if (buffer.length + line.length + 1 > size) {
      chunks.push(buffer);
      buffer = overlap > 0 ? `${buffer.slice(-overlap)}\n${line}` : line;
    } else buffer = buffer ? `${buffer}\n${line}` : line;
  }
  if (buffer.trim()) chunks.push(buffer);
  return chunks;
};

const splitServerChunks = (text, size = 4000, overlap = 200) => {
  const chunks = [];
  for (let start = 0; start < text.length; start += Math.max(1, size - overlap)) {
    chunks.push(text.slice(start, start + size));
    if (start + size >= text.length) break;
  }
  return chunks;
};

const prioritizeRfpText = (text, budget = PRIORITY_BUDGET) => {
  if (!text || text.length <= budget) return text || '';
  const maxBlockSize = Math.max(1000, Math.min(12000, budget));
  const blocks = text.split(/\n{2,}/).filter(block => block.trim().length > 0)
    .flatMap(block => splitTextChunks(block, maxBlockSize, 0));
  const scored = blocks.map((block, index) => {
    const functions = (block.match(FUNC_KEYWORDS) || []).length;
    const administration = (block.match(ADMIN_KEYWORDS) || []).length;
    const divisor = Math.sqrt(block.length) || 1;
    return { index, block, score: functions / divisor - (administration / divisor) * 3 };
  });
  const ranked = [...scored].sort((a, b) => b.score - a.score);
  const picked = [];
  let used = 0;
  for (const candidate of ranked) {
    if (candidate.score < 0 || used + candidate.block.length + 2 > budget) continue;
    picked.push(candidate);
    used += candidate.block.length + 2;
  }
  if (picked.length === 0) {
    for (const candidate of ranked) {
      if (used + candidate.block.length + 2 > budget) continue;
      picked.push(candidate);
      used += candidate.block.length + 2;
    }
  }
  return picked.sort((a, b) => a.index - b.index).map(candidate => candidate.block).join('\n\n');
};

const extractPdf = async filePath => {
  const bytes = new Uint8Array(await fs.readFile(filePath));
  const document = await getDocument({ data: bytes, useSystemFonts: true }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(reconstructPdfLines(content.items));
  }
  return { text: pages.join('\n\n'), pageCount: document.numPages };
};

const projectInfoPrompt = text => `
당신은 공공SW사업 BA 전문가입니다. 아래 문서에서 구축 대상 시스템 정보를 추출하세요. JSON만 출력.

문서:
${text.slice(0, 4000)}

출력 형식:
{"systemName":"시스템명","systemOverview":"시스템 목적과 주요 기능 2~3줄 요약","projectType":"SW개발|ISP|컨설팅|혼합","mainUsers":["주요사용자1","주요사용자2"],"coreRequirements":["핵심요구사항1","핵심요구사항2"]}
`;

const requirementPrompt = (chunk, chunkIndex, systemName) => `
당신은 공공SW사업 BA 전문가입니다. "${systemName}" 시스템의 기능 요구사항을 수집하세요. JSON만 출력.

## 포함 대상 (사용자가 시스템 화면에서 직접 수행하는 업무)
- FR-xxx, CNR-xxx, REQ-xxx 형태의 코드형 요구사항
- "~해야 한다", "~기능 제공", "~처리", "~관리" 형태의 서술형
- 등록/조회/수정/삭제/승인/반려/처리 등의 업무 행위

## 제외 대상
- 사업자 수행 과업 (현황분석, 전략수립, 보고서 작성, 사업 수행 계획)
- 사업관리/품질/지원 요구사항: PMR-xxx, QUR-xxx, PSR-xxx, COR-xxx 등
  비기능 코드와 "사업관리, 품질관리, 일정관리, 위험관리, 교육, 유지보수,
  산출물 제출, 보고 체계" 류 — 이것은 시스템 기능이 아니라 사업 수행 조건이다
- 행정 절차 (납품, 검수, 평가기준)
- 하드웨어/네트워크/인프라 구축
- 기술 방법론 (AI/ML 적용, AIOps, 클라우드 전환, 아키텍처 설계)
- "~자동화 구현", "~지능화" 형태의 기술 목표
- 성능/보안 등 비기능 요구 (PER-xxx, SER-xxx) — 단, 보안 '기능'(로그인, 권한설정 화면)은 포함

문서 청크 ${chunkIndex}:
${chunk}

{"requirements":["요구사항 원문 그대로"]}
`;

const classifyJsonFailure = (text, error) => {
  const clean = String(text || '').replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (const character of clean) {
    if (escaped) { escaped = false; continue; }
    if (character === '\\' && inString) { escaped = true; continue; }
    if (character === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (character === '{' || character === '[') depth += 1;
    if (character === '}' || character === ']') depth -= 1;
  }
  if (depth > 0 || inString || /unterminated|end of json/i.test(error.message)) return `JSON 잘림: ${error.message}`;
  return `JSON 형식/파싱 실패: ${error.message}`;
};

const parseModelJson = text => {
  const clean = String(text || '').replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  try { return JSON.parse(clean); } catch (initialError) {
    const start = clean.indexOf('{');
    if (start >= 0) {
      for (let end = clean.length; end > start; end = clean.lastIndexOf('}', end - 1)) {
        if (end < 0) break;
        try { return JSON.parse(clean.slice(start, end + 1)); } catch (_) { /* retain original cause */ }
      }
    }
    throw Object.assign(initialError, { diagnostic: classifyJsonFailure(clean, initialError) });
  }
};

let apiCalls = 0;
const callAnthropic = async (prompt, maxTokens, retries = 3) => {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    apiCalls += 1;
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, temperature: 0, messages: [{ role: 'user', content: prompt }] }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message || `Anthropic API 오류 (${response.status})`);
      return body.content?.filter(item => item.type === 'text').map(item => item.text).join('') || '';
    } catch (error) {
      lastError = error;
      if (attempt < retries) await sleep(attempt * 1000);
    }
  }
  throw lastError;
};

const keywordMatches = requirements => Object.fromEntries(TO_BE_KEYWORDS.map(keyword => [
  keyword,
  requirements.filter(requirement => String(requirement).toLocaleLowerCase('ko-KR').includes(keyword.toLocaleLowerCase('ko-KR'))).length,
]));

const main = async () => {
  if (!process.argv.includes('--live')) {
    console.error('실제 API 비용이 발생합니다. 실행하려면 --live 옵션을 명시하세요.');
    process.exitCode = 2;
    return;
  }
  await loadDotEnv();
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY가 없습니다. .env 또는 실행 환경에 설정하세요.');
  try { await fs.access(FIXTURE); } catch (_) {
    throw new Error(`평가 PDF가 없습니다: ${path.relative(ROOT, FIXTURE)}\n이 파일은 gitignore 대상이며 사람이 직접 배치해야 합니다.`);
  }

  const extracted = await extractPdf(FIXTURE);
  const prioritized = prioritizeRfpText(extracted.text);
  const legacyChunks = splitTextChunks(prioritized);
  const serverChunks = splitServerChunks(prioritized);
  console.log(JSON.stringify({
    stage: 'input',
    pages: extracted.pageCount,
    extractedCharacters: extracted.text.length,
    prioritizedCharacters: prioritized.length,
    legacyLineChunks8000: legacyChunks.length,
    currentServerChunks4000: serverChunks.length,
    chunkCountDifference: serverChunks.length - legacyChunks.length,
  }));

  const infoText = await callAnthropic(projectInfoPrompt(prioritized), 2000);
  const info = parseModelJson(infoText);
  const allRequirements = [];
  const failures = [];
  for (let index = 0; index < serverChunks.length; index += 1) {
    try {
      const responseText = await callAnthropic(requirementPrompt(serverChunks[index], index + 1, info.systemName || '정보시스템'), 3000);
      const parsed = parseModelJson(responseText);
      const requirements = Array.isArray(parsed.requirements) ? parsed.requirements.filter(item => String(item).length > 5) : [];
      allRequirements.push(...requirements);
      console.log(JSON.stringify({ stage: 'chunk', chunk: index + 1, characters: serverChunks[index].length, requirements: requirements.length, toBe: keywordMatches(requirements), status: 'ok' }));
    } catch (error) {
      const reason = error.diagnostic || `API/기타 실패: ${error.message}`;
      failures.push({ chunk: index + 1, reason });
      console.log(JSON.stringify({ stage: 'chunk', chunk: index + 1, characters: serverChunks[index].length, requirements: 0, toBe: keywordMatches([]), status: 'failed', reason }));
    }
  }
  const uniqueRequirements = [...new Set(allRequirements)];
  console.log(JSON.stringify({
    stage: 'summary',
    systemName: info.systemName || '',
    requirements: uniqueRequirements.length,
    toBe: keywordMatches(uniqueRequirements),
    failures,
    apiCalls,
    chunkCountExplanation: `8,000자 줄 단위=${legacyChunks.length}, 4,000자/200자 오버랩=${serverChunks.length}; 크기와 오버랩 정책 차이=${serverChunks.length - legacyChunks.length}개`,
  }));
};

export { extractPdf, prioritizeRfpText };

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(`[diagnose-rfp] ${error.message}`);
    process.exitCode = 1;
  });
}
