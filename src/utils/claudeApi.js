/* eslint-disable no-unused-vars */
import {
  getLV123Prompt,
  getFPPrompt,
  getParsePrompt,
  getParseImagePrompt,
  getSystemInfoPrompt,
  getSystemInfoImagePrompt,
} from './systemPrompt';

// JSON 안전 파싱 (잘림 방지)
const safeParseJSON = (text) => {
  // 마크다운 제거
  let clean = text.replace(/```json/g, '').replace(/```/g, '').trim();

  // 1차 시도
  try { return JSON.parse(clean); } catch (e1) {}

  // 2차: 마지막 완전한 객체까지
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start !== -1 && end !== -1) {
    try { return JSON.parse(clean.slice(start, end + 1)); } catch (e2) {}

    // 3차: 배열 마지막 완전한 항목까지
    const lastComma = clean.lastIndexOf('},');
    if (lastComma > 0) {
      // functions 배열인지 확인
      const prefix = clean.slice(start, lastComma + 1);
      // 어떤 키인지 찾기
      const keyMatch = prefix.match(/"(\w+)"\s*:\s*\[/);
      if (keyMatch) {
        const fixed = `{"${keyMatch[1]}":[${prefix.split('[').slice(1).join('[').slice(0, lastComma - prefix.indexOf('['))}]}`;
        try { return JSON.parse(fixed); } catch (e3) {}
      }
      // 단순 배열 복구
      const arrStart = clean.indexOf('[');
      if (arrStart !== -1) {
        const fixed2 = clean.slice(0, lastComma + 1) + ']}';
        try { return JSON.parse(fixed2); } catch (e4) {}
      }
    }
  }
  throw new Error('JSON 파싱 실패: ' + text.slice(0, 100));
};

// 텍스트 API 호출
const callClaude = async (content, maxTokens = 2000) => {
  const response = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      max_tokens: maxTokens,
      messages: [{ role: 'user', content }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const status = response.status;
    if (status === 504) throw new Error('504: 요청 시간 초과. 파일이 너무 크거나 텍스트가 길 수 있습니다.');
    throw new Error(err.error?.message || `API 오류 (${status})`);
  }

  const data = await response.json();
  if (data.error) throw new Error(data.error);
  const text = data.content?.map((c) => (c.type === 'text' ? c.text : '')).join('') || '';
  return safeParseJSON(text);
};

// 이미지 API 호출
const callClaudeWithImage = async (textPrompt, imageFile, maxTokens = 2000) => {
  const base64 = await fileToBase64(imageFile);
  const mediaType = imageFile.type || 'image/jpeg';

  const response = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      max_tokens: maxTokens,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: textPrompt },
        ],
      }],
    }),
  });

  if (!response.ok) {
    const status = response.status;
    if (status === 504) throw new Error('504: 이미지 처리 시간 초과. 이미지를 작게 줄여서 다시 시도하세요.');
    throw new Error(`이미지 API 오류 (${status})`);
  }

  const data = await response.json();
  if (data.error) throw new Error(data.error);
  const text = data.content?.map((c) => (c.type === 'text' ? c.text : '')).join('') || '';
  return safeParseJSON(text);
};

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result.split(',')[1]);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

// 텍스트 길이 제한 (토큰 절약)
const truncateText = (text, maxLen = 3000) => {
  if (!text || text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '\n...(이하 생략)';
};

// ============================================================
// 기능목록 생성 (2000토큰으로 줄여서 rate limit 회피)
// ============================================================
export const generateFunctions = async (systemInfo, keyword) => {
  const prompt = getLV123Prompt(systemInfo, keyword);
  const result = await callClaude(prompt, 2000);
  return result.functions || [];
};

// ============================================================
// FP 산정 (청크당 2000)
// ============================================================
export const generateFPList = async (functions) => {
  const CHUNK = 25;
  if (functions.length <= CHUNK) {
    const prompt = getFPPrompt(functions);
    const result = await callClaude(prompt, 2000);
    return result.fpList || [];
  }

  let allFP = [];
  for (let i = 0; i < functions.length; i += CHUNK) {
    const chunk = functions.slice(i, i + CHUNK);
    const prompt = getFPPrompt(chunk);
    const result = await callClaude(prompt, 2000);
    allFP = [...allFP, ...(result.fpList || [])];
  }
  return allFP;
};

// ============================================================
// 기능정의서 파싱 (청크당 4000)
// ============================================================
export const parseDocument = async (text, imageFile = null) => {
  if (imageFile) {
    const prompt = getParseImagePrompt();
    const result = await callClaudeWithImage(prompt, imageFile, 2000);
    return result.functions || [];
  }

  const MAX_CHUNK = 2000;
  if (!text || text.length === 0) throw new Error('파일에서 텍스트를 추출할 수 없습니다.');

  if (text.length <= MAX_CHUNK) {
    const prompt = getParsePrompt(truncateText(text, MAX_CHUNK));
    const result = await callClaude(prompt, 2000);
    return result.functions || [];
  }

  // 긴 문서: 청크별 파싱
  let allFunctions = [];
  const chunks = [];
  for (let i = 0; i < text.length; i += MAX_CHUNK) {
    chunks.push(text.slice(i, i + MAX_CHUNK));
  }

  for (const chunk of chunks.slice(0, 3)) {
    try {
      const prompt = getParsePrompt(chunk);
      const result = await callClaude(prompt, 2000);
      allFunctions = [...allFunctions, ...(result.functions || [])];
    } catch (e) {
      console.warn('청크 파싱 실패:', e.message);
    }
  }

  const seen = new Set();
  return allFunctions.filter(f => {
    const key = `${f.lv1}|${f.lv2}|${f.lv3}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

// ============================================================
// 시스템 개요 파싱 (간단 → 1000)
// ============================================================
export const parseSystemInfo = async (text, imageFile = null) => {
  if (imageFile) {
    const prompt = getSystemInfoImagePrompt();
    const result = await callClaudeWithImage(prompt, imageFile, 1000);
    return result;
  }
  const prompt = getSystemInfoPrompt(truncateText(text, 2000));
  const result = await callClaude(prompt, 1000);
  return result;
};

// ============================================================
// 텍스트 반환 (JSON 아닌 순수 텍스트 응답용)
// ============================================================
export const callClaudeText = async (content, maxTokens = 2000) => {
  const response = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      max_tokens: maxTokens,
      messages: [{ role: 'user', content }],
    }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `API 오류 (${response.status})`);
  }
  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data.content?.map(c => c.type === 'text' ? c.text : '').join('') || '';
};

// ============================================================
// ISP 정보화전략계획서 섹션 생성
// ============================================================
import { getISPDraftPrompt } from './systemPrompt';

export const generateISPSection = async (section, rfpText, systemName, overview, functions) => {
  const prompt = getISPDraftPrompt(section, rfpText, systemName, overview, functions);
  const text = await callClaudeText(prompt, 2000);
  // JSON 파싱
  let clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start !== -1 && end !== -1) {
    try { return JSON.parse(clean.slice(start, end + 1)); } catch (e) {}
  }
  throw new Error('ISP 섹션 파싱 실패');
};

// ============================================================
// 대용량 RFP 청크 처리 (3000자 제한 우회)
// ============================================================
export const parseRFPLarge = async (text) => {
  const CHUNK = 2500;
  const chunks = [];
  for (let i = 0; i < Math.min(text.length, 15000); i += CHUNK) {
    chunks.push(text.slice(i, i + CHUNK));
  }

  let allFunctions = [];
  let systemInfo = {};

  for (let i = 0; i < chunks.length; i++) {
    try {
      const isFirst = i === 0;
      const prompt = isFirst
        ? `SW사업 BA전문가. RFP 청크에서 모든 요구사항을 기능목록으로 변환. FR-xxx/CNR-xxx/REQ-xxx 등 코드 형식 무관하게 모두 처리. 서술형 요구사항도 포함. CRUD패턴 적용. JSON만.\n${chunks[i]}\n{"systemName":"","overview":"","functions":[{"lv1":"","lv2":"","lv3":"","definition":""}]}`
        : `SW사업 BA전문가. RFP 추가 청크에서 요구사항 추출. 코드형식 무관(FR/CNR/REQ 등), 서술형 포함. 중복제외. CRUD패턴. JSON만.\n${chunks[i]}\n{"functions":[{"lv1":"","lv2":"","lv3":"","definition":""}]}`;

      const text2 = await callClaudeText(prompt, 2000);
      let clean = text2.replace(/```json/g, '').replace(/```/g, '').trim();
      const s = clean.indexOf('{'), e2 = clean.lastIndexOf('}');
      if (s !== -1 && e2 !== -1) {
        const parsed = JSON.parse(clean.slice(s, e2 + 1));
        if (isFirst) {
          systemInfo = { systemName: parsed.systemName || '', overview: parsed.overview || '' };
        }
        allFunctions = [...allFunctions, ...(parsed.functions || [])];
      }
    } catch (err) {
      console.warn(`청크 ${i} 파싱 실패:`, err.message);
    }
  }

  // 중복 제거
  const seen = new Set();
  const deduped = allFunctions
    .filter(f => f.lv1 && f.lv2 && f.lv3)
    .filter(f => {
      const k = `${f.lv1}|${f.lv2}|${f.lv3}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

  return { ...systemInfo, functions: deduped };
};

// ══════════════════════════════════════════════════════════════
// RFP → 100개 기능목록 4단계 파이프라인
// ══════════════════════════════════════════════════════════════
import {
  getRFPChunkCollectPrompt,
  getRFPDomainPrompt,
  getRFPDomainExpandPrompt,
} from './systemPrompt';

// 내부 JSON 파싱 헬퍼
const parseJSON = (text) => {
  let clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
  const s = clean.indexOf('{'), e = clean.lastIndexOf('}');
  if (s !== -1 && e !== -1) {
    try { return JSON.parse(clean.slice(s, e + 1)); } catch (_) {}
  }
  // 잘린 배열 복구
  const arrEnd = clean.lastIndexOf('},');
  if (arrEnd > 0) {
    const partial = clean.slice(0, arrEnd + 1);
    const opens = (partial.match(/\[/g) || []).length;
    const closes = (partial.match(/\]/g) || []).length;
    try { return JSON.parse(partial + ']'.repeat(Math.max(0, opens - closes)) + '}'); } catch (_) {}
  }
  throw new Error('JSON 파싱 실패');
};

// 단계별 진행 콜백 타입: (step, message, progress) => void
export const parseRFPFull = async (text, onProgress) => {
  const report = (step, msg, pct) => onProgress && onProgress(step, msg, pct);

  // ── 1단계: 시스템 정보 추출 ──────────────────────────────
  report(1, 'RFP에서 사업명/개요 추출 중...', 5);
  let systemName = '', overview = '';
  try {
    const infoPrompt = `아래 문서에서 시스템 정보 추출. JSON만:\n${text.slice(0, 2000)}\n{"systemName":"","overview":"","projectType":"ISP또는SW개발또는컨설팅"}`;
    const infoText = await callClaudeText(infoPrompt, 800);
    const info = parseJSON(infoText);
    systemName = info.systemName || '';
    overview = info.overview || '';
  } catch (e) { console.warn('시스템정보 추출 실패:', e.message); }

  // ── 2단계: 청크별 요구사항 수집 ──────────────────────────
  report(2, 'RFP 전체 분석 중... (청크 분할)', 10);
  const CHUNK_SIZE = 2500;
  const MAX_TEXT = 20000;
  const chunks = [];
  const bounded = text.slice(0, MAX_TEXT);
  for (let i = 0; i < bounded.length; i += CHUNK_SIZE) {
    chunks.push(bounded.slice(i, i + CHUNK_SIZE));
  }

  let allRequirements = [];
  for (let i = 0; i < chunks.length; i++) {
    report(2, `요구사항 수집 중... (${i + 1}/${chunks.length} 청크)`, 10 + Math.round((i / chunks.length) * 25));
    try {
      const prompt = getRFPChunkCollectPrompt(chunks[i], i + 1);
      const resText = await callClaudeText(prompt, 1500);
      const parsed = parseJSON(resText);
      const reqs = (parsed.requirements || []).filter(r => r && r.length > 5);
      allRequirements = [...allRequirements, ...reqs];
    } catch (e) { console.warn(`청크 ${i + 1} 수집 실패:`, e.message); }
  }

  // 중복 제거
  allRequirements = [...new Set(allRequirements)].slice(0, 80);
  report(2, `요구사항 ${allRequirements.length}개 수집 완료`, 35);

  // 수집 실패 시 텍스트에서 직접 라인 추출
  if (allRequirements.length < 5) {
    const lines = text.split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 10 && l.length < 200)
      .filter(l => /관리|기능|처리|등록|조회|수정|삭제|승인|분석|수행|제공|구현/.test(l))
      .slice(0, 40);
    allRequirements = [...allRequirements, ...lines];
  }

  // ── 3단계: 도메인 분류 ───────────────────────────────────
  report(3, '업무 도메인 분류 중...', 40);
  let domains = [];
  try {
    const domainPrompt = getRFPDomainPrompt(allRequirements, systemName, overview);
    const domainText = await callClaudeText(domainPrompt, 2000);
    const domainParsed = parseJSON(domainText);
    domains = domainParsed.domains || [];
    if (domainParsed.systemName && !systemName) systemName = domainParsed.systemName;
    if (domainParsed.overview && !overview) overview = domainParsed.overview;
  } catch (e) { console.warn('도메인 분류 실패:', e.message); }

  // 도메인 분류 실패 시 기본 도메인 구성
  if (domains.length === 0) {
    domains = [
      { lv1: '업무관리', description: '핵심 업무 처리', requirements: allRequirements.slice(0, 10), expectedLv2: [] },
      { lv1: '현황관리', description: '현황 조회 및 분석', requirements: allRequirements.slice(10, 20), expectedLv2: [] },
      { lv1: '보고서관리', description: '보고서 및 통계', requirements: allRequirements.slice(20, 30), expectedLv2: [] },
      { lv1: '공통기능', description: '사용자/권한/시스템', requirements: [], expectedLv2: ['사용자관리', '권한관리', '시스템관리'] },
    ];
  }

  report(3, `도메인 ${domains.length}개 확인 완료`, 45);

  // ── 4단계: 도메인별 기능 확장 (순차 호출) ───────────────
  let allFunctions = [];
  for (let i = 0; i < domains.length; i++) {
    const domain = domains[i];
    report(4, `[${i + 1}/${domains.length}] "${domain.lv1}" 기능 확장 중...`, 45 + Math.round((i / domains.length) * 50));
    try {
      const expandPrompt = getRFPDomainExpandPrompt(domain, systemName);
      const expandText = await callClaudeText(expandPrompt, 3000);
      const expandParsed = parseJSON(expandText);
      const funcs = (expandParsed.functions || [])
        .filter(f => f.lv1 && f.lv2 && f.lv3)
        .map(f => ({
          ...f,
          lv1: domain.lv1, // 도메인명 고정
          lv3: f.lv3
            .replace(/^[A-Z]{2,}-\d+[-\w]*:\s*/i, '')
            .replace(/^[A-Z]{2,}-\d+\s*/i, '')
            .trim(),
          definition: f.definition || `${f.lv3}을 처리한다`,
        }))
        .filter(f => f.lv3.length > 0);
      allFunctions = [...allFunctions, ...funcs];
      report(4, `"${domain.lv1}" ${funcs.length}개 생성 완료`, 45 + Math.round(((i + 1) / domains.length) * 50));
    } catch (e) {
      console.warn(`도메인 "${domain.lv1}" 확장 실패:`, e.message);
    }
  }

  // ── 후처리: 중복 제거 ────────────────────────────────────
  report(4, '중복 제거 및 정리 중...', 96);
  const seen = new Set();
  const deduped = allFunctions.filter(f => {
    const key = `${f.lv1}|${f.lv2}|${f.lv3}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  report(4, `완료! 총 ${deduped.length}개 기능 생성`, 100);
  return { systemName, overview, functions: deduped };
};
