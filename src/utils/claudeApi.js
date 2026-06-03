// ============================================================
// fp-system claudeApi.js - 완전 재작성
// ============================================================
import {
  getFPPrompt,
  getProjectInfoPrompt,
  getRequirementCollectPrompt,
  getDomainClassifyPrompt,
  getDomainExpandPrompt,
  getDocParsePrompt,
  getAreaSuggestPrompt,
  getAreaExpandPrompt,
} from './systemPrompt';

const TEMPERATURE = 0;
const MODEL = 'claude-sonnet-4-5';

// ── 기본 API 호출 (재시도 포함) ──────────────────────────────
const callAPI = async (content, maxTokens = 2000, retries = 3) => {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: maxTokens,
          temperature: TEMPERATURE,
          messages: [{ role: 'user', content }],
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const status = res.status;
        // 529 Overloaded → 재시도
        if (status === 529 || status === 503) {
          const wait = (attempt + 1) * 5000;
          console.warn(`Overloaded (${status}), ${wait/1000}초 후 재시도... (${attempt+1}/${retries})`);
          await sleep(wait);
          continue;
        }
        // 429 Rate Limit → 재시도
        if (status === 429) {
          const wait = (attempt + 1) * 10000;
          console.warn(`Rate Limit, ${wait/1000}초 후 재시도... (${attempt+1}/${retries})`);
          await sleep(wait);
          continue;
        }
        throw new Error(err.error?.message || `API 오류 (${status})`);
      }
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return data.content?.map(c => c.type === 'text' ? c.text : '').join('') || '';
    } catch (e) {
      if (attempt === retries - 1) throw e;
      console.warn(`시도 ${attempt+1} 실패: ${e.message}`);
      await sleep(1000); // Tier2: 재시도 대기 단축
    }
  }
};

// ── JSON 파싱 (잘림 복구) ────────────────────────────────────
const parseJSON = (text) => {
  let clean = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  try { return JSON.parse(clean); } catch (_) {}
  const s = clean.indexOf('{');
  if (s !== -1) clean = clean.slice(s);
  // 끝에서부터 } 찾아서 시도
  for (let end = clean.length; end > 0;) {
    const pos = clean.lastIndexOf('}', end - 1);
    if (pos === -1) break;
    try { return JSON.parse(clean.slice(0, pos + 1)); } catch (_) { end = pos; }
  }
  // 잘린 배열 복구
  let depth = 0, lastObjEnd = -1, inStr = false, esc = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (esc) { esc = false; continue; }
    if (c === '\\' && inStr) { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{') depth++;
    if (c === '}') { depth--; if (depth === 1) lastObjEnd = i; }
  }
  if (lastObjEnd > 0) {
    const truncated = clean.slice(0, lastObjEnd + 1);
    let o = 0, c2 = 0, ao = 0, ac = 0;
    inStr = false; esc = false;
    for (const ch of truncated) {
      if (esc) { esc = false; continue; }
      if (ch === '\\' && inStr) { esc = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === '{') o++; if (ch === '}') c2++;
      if (ch === '[') ao++; if (ch === ']') ac++;
    }
    const suffix = ']'.repeat(Math.max(0, ao - ac)) + '}'.repeat(Math.max(0, o - c2));
    try { return JSON.parse(truncated + suffix); } catch (_) {}
  }
  throw new Error('JSON 파싱 실패');
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── 문서에서 프로젝트 정보 추출 ──────────────────────────────
export const extractProjectInfo = async (text) => {
  const raw = await callAPI(getProjectInfoPrompt(text), 2000);
  try { return parseJSON(raw); } catch (_) { return {}; }
};

// ── 문서 파싱 (기능정의서 docx/pdf) ─────────────────────────
export const parseDocumentFunctions = async (text) => {
  const raw = await callAPI(getDocParsePrompt(text), 2000);
  const parsed = parseJSON(raw);
  return parsed.functions || [];
};

// ── 1단계만: 정보추출 + 요구사항 + 도메인분류 ────────────────
export const extractDomainsOnly = async (text, userInput, onProgress) => {
  const report = (step, msg, pct) => onProgress && onProgress(step, msg, pct);

  report(1, '문서에서 시스템 정보 추출 중...', 5);
  let info = {};
  try {
    const infoRaw = await callAPI(getProjectInfoPrompt(text + (userInput ? '\n\n추가설명:\n' + userInput : '')), 2000);
    info = parseJSON(infoRaw);
  } catch(e) { console.warn('정보 추출 실패:', e.message); }

  const systemName = info.systemName || '정보시스템';
  const description = info.systemOverview || '';
  const mainUsers = info.mainUsers || ['사용자', '관리자'];
  const projectType = info.projectType || 'SW개발';

  report(1, `시스템: ${systemName}`, 12);

  // 요구사항 수집
  const CHUNK = 2500;
  const bounded = text.slice(0, 40000);
  const chunks = [];
  for (let i = 0; i < bounded.length; i += CHUNK)
    chunks.push(bounded.slice(i, i + CHUNK));

  let allReqs = [];
  for (let i = 0; i < chunks.length; i++) {
    report(2, `요구사항 수집 중... (${i+1}/${chunks.length})`, 12 + Math.round((i/chunks.length)*25));
    try {
      const raw = await callAPI(getRequirementCollectPrompt(chunks[i], i+1, systemName), 2000);
      const parsed = parseJSON(raw);
      allReqs = [...allReqs, ...(parsed.requirements||[]).filter(r => r?.length > 5)];
    } catch(e) { console.warn(`청크 ${i+1} 실패`); }
  }

  if (userInput?.trim()) {
    const userLines = userInput.split(/[\n,。、]/).map(l => l.trim()).filter(l => l.length > 4);
    allReqs = [...allReqs, ...userLines];
  }
  allReqs = [...new Set(allReqs)].slice(0, 150);

  if (allReqs.length < 5) {
    const lines = text.split('\n').map(l=>l.trim()).filter(l=>l.length>10&&l.length<200)
      .filter(l=>/관리|기능|처리|등록|조회|수정|삭제|승인/.test(l)).slice(0, 40);
    allReqs = [...allReqs, ...lines];
  }

  report(2, `요구사항 ${allReqs.length}개 수집`, 37);

  // 도메인 분류
  report(3, '업무 도메인 분류 중...', 40);
  let domains = [];
  try {
    const domainRaw = await callAPI(
      getDomainClassifyPrompt(allReqs, systemName, description, mainUsers, projectType, userInput),
      2000
    );
    const parsed = parseJSON(domainRaw);
    domains = parsed.domains || [];
  } catch(e) { console.warn('도메인 분류 실패:', e.message); }

  if (domains.length === 0) {
    domains = [
      { lv1:'업무관리', description:'핵심 업무', requirements: allReqs.slice(0,15), expectedLv2:[] },
      { lv1:'현황 및 통계', description:'조회/통계', requirements: allReqs.slice(15,30), expectedLv2:[] },
      { lv1:'시스템관리', description:'사용자/권한/공통', requirements:[], expectedLv2:['사용자관리','권한관리'] },
    ];
  }

  report(3, `LV1 ${domains.length}개 확인 필요`, 100);

  return { systemName, overview: description, projectType, mainUsers, allReqs, domains };
};

// ── 2단계: 선택된 도메인으로 기능 확장 ────────────────────────
export const expandDomainsToFunctions = async (domains, info, onProgress) => {
  const report = (step, msg, pct) => onProgress && onProgress(step, msg, pct);
  const { systemName, mainUsers = ['사용자','관리자'] } = info || {};

  let allFunctions = [];
  for (let i = 0; i < domains.length; i++) {
    const domain = domains[i];
    const pct = 42 + Math.round((i / domains.length) * 55);
    report(4, `[${i+1}/${domains.length}] "${domain.lv1}" 기능 확장 중...`, pct);
    try {
      const raw = await callAPI(getDomainExpandPrompt(domain, systemName, mainUsers), 6000);
      const parsed = parseJSON(raw);
      const funcs = (parsed.functions || [])
        .filter(f => f.lv2 && f.lv3)
        .map(f => ({
          lv1: domain.lv1,
          lv2: f.lv2 || '',
          lv3: (f.lv3 || '').replace(/^[A-Z]{2,}-\d+[-\w]*:\s*/i,'').trim(),
          definition: f.definition || `${f.lv3||f.lv2}을 처리한다`,
        }))
        .filter(f => f.lv3.length > 0);
      allFunctions = [...allFunctions, ...funcs];
    } catch(e) { console.warn(`"${domain.lv1}" 확장 실패:`, e.message); }
  }

  // 후처리: 컨설팅 과업 필터 + 중복 제거
  const BAD_LV1 = ['AI/ML','AIOps','클라우드 및 인프라','아키텍처 설계',
    '실시간 데이터 스트리밍','인프라 고도화','지능형 운영','운영 자동화',
    '포렌식','비즈니스연속성','사이버보안 통합'];
  const BAD_LV3 = [/자동화\s*구현/,/지능화\s*적용/,/고도화\s*수행/,/아키텍처\s*설계/];

  const filtered = allFunctions.filter(f => {
    if (!f.lv1 || !f.lv2 || !f.lv3?.trim()) return false;
    if (BAD_LV1.some(kw => f.lv1.includes(kw))) return false;
    if (BAD_LV3.some(p => p.test(f.lv3))) return false;
    if (f.lv3.trim() === f.lv2.trim()) return false;
    return true;
  });

  const seen = new Set();
  const deduped = filtered.filter(f => {
    const key = `${f.lv1}|${f.lv2}|${f.lv3}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // LV1 자동 통합 (10개 초과 시)
  const lv1List = [...new Set(deduped.map(f => f.lv1))];
  let finalFuncs = deduped;
  if (lv1List.length > 10) {
    const mergeRules = [
      { pattern: /보안|인증|접근제어|감사/, target: '보안관리' },
      { pattern: /운영|모니터링|장애|알람|알림/, target: '운영관리' },
      { pattern: /통계|분석|현황|보고/, target: '통계및분석' },
    ];
    finalFuncs = deduped.map(f => {
      for (const rule of mergeRules) {
        if (rule.pattern.test(f.lv1) && f.lv1 !== rule.target)
          return { ...f, lv1: rule.target };
      }
      return f;
    });
  }

  report(4, `완료! ${finalFuncs.length}개 기능 생성`, 100);
  return { systemName, overview: info?.overview || '', functions: finalFuncs };
};

// ── 핵심: RFP/문서 → 기능목록 생성 파이프라인 ───────────────
// onProgress(step, msg, pct)
export const generateFunctionsFromDoc = async (text, userInput, onProgress) => {
  const report = (step, msg, pct) => onProgress && onProgress(step, msg, pct);

  // ── 1단계: 프로젝트 정보 추출 ───────────────────────────
  report(1, '문서에서 시스템 정보 추출 중...', 5);
  let info = {};
  try {
    const infoRaw = await callAPI(getProjectInfoPrompt(text + (userInput ? '\n\n추가설명:\n' + userInput : '')), 2000);
    info = parseJSON(infoRaw);
  } catch (e) { console.warn('정보 추출 실패:', e.message); }

  const systemName = info.systemName || '정보시스템';
  const description = info.systemOverview || '';
  const mainUsers = info.mainUsers || ['사용자', '관리자'];
  const projectType = info.projectType || 'SW개발';

  report(1, `시스템: ${systemName} (${projectType})`, 10);

  // ── 2단계: 요구사항 수집 (청크) ─────────────────────────
  const CHUNK = 2500;
  const MAX_TEXT = 40000; // Tier2: 텍스트 제한 확대
  const bounded = text.slice(0, MAX_TEXT);
  const chunks = [];
  for (let i = 0; i < bounded.length; i += CHUNK)
    chunks.push(bounded.slice(i, i + CHUNK));

  let allReqs = [];
  for (let i = 0; i < chunks.length; i++) {
    report(2, `요구사항 수집 중... (${i+1}/${chunks.length})`, 10 + Math.round((i/chunks.length)*25));
    try {
      const raw = await callAPI(getRequirementCollectPrompt(chunks[i], i+1, systemName), 2000);
      const parsed = parseJSON(raw);
      allReqs = [...allReqs, ...(parsed.requirements||[]).filter(r => r?.length > 5)];
    } catch (e) { console.warn(`청크 ${i+1} 실패`); }
  }

  // 추가 입력 텍스트 → 요구사항으로 처리 (구어체/문장 모두 인식)
  if (userInput?.trim()) {
    const userLines = userInput
      .split(/[\n,。、]/)  // 줄바꿈 + 쉼표 + 문장부호 분리
      .map(l => l.trim())
      .filter(l => l.length > 4);
    // 구어체 패턴도 요구사항으로 변환
    const normalized = userLines.map(l =>
      l.replace(/~이?\s*필요/, '기능 필요')
       .replace(/~해야\s*한다?/, '처리 필요')
       .replace(/~있으면\s*좋겠/, '기능 필요')
       .replace(/^[-•·]\s*/, '') // 불릿 제거
    );
    allReqs = [...allReqs, ...normalized];
  }

  allReqs = [...new Set(allReqs)].slice(0, 150); // Tier2: 요구사항 수집 확대

  // 폴백: 텍스트에서 직접 라인 추출
  if (allReqs.length < 5) {
    const lines = text.split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 10 && l.length < 200)
      .filter(l => /관리|기능|처리|등록|조회|수정|삭제|승인|분석|제공|구현/.test(l))
      .slice(0, 40);
    allReqs = [...allReqs, ...lines];
  }

  report(2, `요구사항 ${allReqs.length}개 수집 완료`, 35);

  // ── 3단계: 도메인 분류 ───────────────────────────────────
  report(3, '업무 도메인 분류 중...', 38);
  let domains = [];
  try {
    const domainRaw = await callAPI(
      getDomainClassifyPrompt(allReqs, systemName, description, mainUsers, projectType, userInput),
      2000
    );
    const domainParsed = parseJSON(domainRaw);
    domains = domainParsed.domains || [];
  } catch (e) { console.warn('도메인 분류 실패:', e.message); }

  if (domains.length === 0) {
    domains = [
      { lv1:'업무관리', description:'핵심 업무', requirements: allReqs.slice(0,15), expectedLv2:[] },
      { lv1:'현황 및 통계', description:'조회/통계', requirements: allReqs.slice(15,30), expectedLv2:[] },
      { lv1:'공통기능', description:'사용자/권한/시스템', requirements:[], expectedLv2:['사용자관리','권한관리','시스템관리'] },
    ];
  }

  report(3, `도메인 ${domains.length}개 확정`, 42);

  // ── 4단계: 도메인별 기능 확장 ───────────────────────────
  let allFunctions = [];
  for (let i = 0; i < domains.length; i++) {
    const domain = domains[i];
    const pct = 42 + Math.round((i / domains.length) * 55);
    report(4, `[${i+1}/${domains.length}] "${domain.lv1}" 기능 확장 중...`, pct);

    try {
      const raw = await callAPI(getDomainExpandPrompt(domain, systemName, mainUsers), 6000); // Tier2
      const parsed = parseJSON(raw);
      const funcs = (parsed.functions || [])
        .filter(f => f.lv2 && f.lv3)
        .map(f => ({
          lv1: domain.lv1,
          lv2: f.lv2 || '',
          lv3: (f.lv3 || '').replace(/^[A-Z]{2,}-\d+[-\w]*:\s*/i,'').replace(/^[A-Z]{2,}-\d+\s*/i,'').trim(),
          definition: f.definition || `${f.lv3 || f.lv2}을 처리한다`,
        }))
        .filter(f => f.lv3.length > 0);
      allFunctions = [...allFunctions, ...funcs];
      report(4, `"${domain.lv1}" ${funcs.length}개 생성`, pct + Math.round(55/domains.length * 0.8));
    } catch (e) {
      console.warn(`"${domain.lv1}" 확장 실패:`, e.message);
    }

    // Tier2: Rate Limit 딜레이 없음
  }

  // ── 후처리: 컨설팅 과업 필터링 + 중복 제거 ─────────────────
  // 시스템 기능이 아닌 LV1 키워드 필터
  const BAD_LV1 = ['AI/ML','AIOps','클라우드 및 인프라','아키텍처 설계',
    '실시간 데이터 스트리밍','인프라 고도화','지능형 운영','운영 자동화',
    '포렌식','비즈니스연속성','사이버보안 통합'];
  // LV3 금지 패턴
  const BAD_LV3 = [/자동화\s*구현/,/지능화\s*적용/,/고도화\s*수행/,/아키텍처\s*설계/,/인프라\s*구성/,/정책\s*수립/];

  const filtered = allFunctions.filter(f => {
    if (!f.lv1 || !f.lv2 || !f.lv3?.trim()) return false;
    if (BAD_LV1.some(kw => f.lv1.includes(kw))) return false;
    if (BAD_LV3.some(p => p.test(f.lv3))) return false;
    if (f.lv3.trim() === f.lv2.trim()) return false; // LV3=LV2 제외
    return true;
  });

  const seen = new Set();
  const deduped = filtered.filter(f => {
    const key = `${f.lv1}|${f.lv2}|${f.lv3}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // ── LV1 자동 통합 후처리 (15개 초과 시) ──────────────────────
  const lv1List = [...new Set(deduped.map(f => f.lv1))];
  let finalFuncs = deduped;
  if (lv1List.length > 15) {
    report(4, `LV1 ${lv1List.length}개 → 통합 중...`, 95);
    // 유사 LV1 통합 규칙
    const mergeRules = [
      { pattern: /보안|인증|접근제어|감사/, target: '보안관리' },
      { pattern: /운영|모니터링|장애|알람|알림/, target: '운영관리' },
      { pattern: /통계|분석|현황|보고/, target: '통계및분석' },
      { pattern: /연동|인터페이스|API|Gateway/, target: '연동관리' },
      { pattern: /사용자|권한|메뉴|코드|공통/, target: '시스템관리' },
    ];
    finalFuncs = deduped.map(f => {
      // 이미 적절한 LV1이면 유지
      if (lv1List.length <= 15) return f;
      for (const rule of mergeRules) {
        if (rule.pattern.test(f.lv1) && f.lv1 !== rule.target) {
          return { ...f, lv1: rule.target };
        }
      }
      return f;
    });
    const newLv1Count = [...new Set(finalFuncs.map(f => f.lv1))].length;
    report(4, `LV1 ${lv1List.length}개 → ${newLv1Count}개로 통합`, 97);
  }

  report(4, `완료! ${finalFuncs.length}개 기능 생성`, 100);

  return {
    systemName,
    overview: description,
    projectType,
    functions: finalFuncs,
  };
};

// ── 추가 영역 제안 ────────────────────────────────────────────
export const suggestAreas = async (systemName, rfpText, functions, targetCount, upgradeMode = false) => {
  const safeRfp = rfpText || '';
  const raw = await callAPI(
    getAreaSuggestPrompt(systemName, safeRfp, functions || [], targetCount, upgradeMode),
    3000  // 응답 더 많이 받기 위해 2000→3000
  );
  try {
    const parsed = parseJSON(raw);
    return parsed;
  } catch(e) {
    console.warn('영역 제안 파싱 실패:', e.message);
    return { suggestions: [], analysis: '분석 실패' };
  }
};

// ── 선택된 영역 기능 생성 ────────────────────────────────────
export const expandArea = async (area, systemName, existingFunctions, onProgress) => {
  const report = (msg, pct) => onProgress && onProgress(msg, pct);
  report(`"${area.lv1}" 기능 생성 중...`, 0);

  // 기존 LV2 목록 (전체 - 이미 있는 LV2 파악용)
  const existingLV2s = [...new Set(existingFunctions.map(f => f.lv2))];

  // 같은 LV1 안의 LV3만 중복 방지용으로 전달 (토큰 절약)
  const sameLV1LV3s = existingFunctions
    .filter(f => f.lv1 === area.lv1)
    .map(f => f.lv3);

  const raw = await callAPI(
    getAreaExpandPrompt(area, systemName, existingLV2s, sameLV1LV3s),
    6000  // Tier2: 토큰 확대
  );
  const parsed = parseJSON(raw);
  const funcs = (parsed.functions || [])
    .filter(f => f.lv2 && f.lv3)
    .map(f => ({
      lv1: area.lv1,
      lv2: f.lv2 || '',
      lv3: (f.lv3 || '').replace(/^[A-Z]{2,}-\d+[-\w]*:\s*/i,'').trim(),
      definition: f.definition || `${f.lv3 || f.lv2}을 처리한다`,
    }))
    .filter(f => f.lv3.length > 0);

  // 중복 제거는 코드에서 처리 (AI에게 맡기지 않음)
  // 전체 lv1|lv2|lv3 키로 완전 중복 제거
  const existingKeys = new Set(existingFunctions.map(f => `${f.lv1}|${f.lv2}|${f.lv3}`));
  const newFuncs = funcs.filter(f => !existingKeys.has(`${f.lv1}|${f.lv2}|${f.lv3}`));

  report(`${newFuncs.length}개 추가 완료`, 100);
  return newFuncs;
};

// ── FP 산정 ───────────────────────────────────────────────────
const SLEEP_BETWEEN_CHUNKS = 0; // Tier2: 딜레이 없음

export const generateFPList = async (functions, onProgress) => {
  const CHUNK = 50; // Tier2: 청크 크기 50개
  const chunks = [];
  for (let i = 0; i < functions.length; i += CHUNK)
    chunks.push(functions.slice(i, i + CHUNK));

  if (onProgress) onProgress(0, chunks.length);

  // idx 기반 결과 맵 (누락 방지)
  const resultMap = {};
  functions.forEach((f, i) => {
    resultMap[i] = {
      idx: i, lv1: f.lv1, lv2: f.lv2, lv3: f.lv3,
      definition: f.definition,
      fpType: 'EI', ftr: 1, det: 5, reuseType: '신규개발',
    };
  });

  for (let ci = 0; ci < chunks.length; ci++) {
    if (onProgress) onProgress(ci + 1, chunks.length);
    const chunkOffset = ci * CHUNK;

    try {
      const raw = await callAPI(getFPPrompt(chunks[ci]), 2500); // Sonnet: 토큰 상향
      const parsed = parseJSON(raw);
      (parsed.fpList || []).forEach(fp => {
        const globalIdx = chunkOffset + (fp.idx ?? 0);
        const orig = functions[globalIdx];
        if (orig) {
          resultMap[globalIdx] = {
            idx: globalIdx,
            lv1: orig.lv1, lv2: orig.lv2, lv3: orig.lv3,
            definition: orig.definition,
            fpType: fp.fpType || 'EI',
            ftr: Number(fp.ftr) || 1,
            det: Number(fp.det) || 5,
            reuseType: fp.reuseType || '신규개발',
          };
        }
      });
    } catch (e) {
      console.warn(`FP 청크 ${ci+1} 실패 (기본값 유지):`, e.message);
    }

    if (SLEEP_BETWEEN_CHUNKS > 0 && ci < chunks.length - 1) await sleep(SLEEP_BETWEEN_CHUNKS);
  }

  return Object.values(resultMap).sort((a, b) => a.idx - b.idx);
};
