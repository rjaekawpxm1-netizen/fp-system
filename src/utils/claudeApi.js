// ============================================================
// fp-system claudeApi.js - 완전 재작성
// ============================================================
import {
  getFPClassifyPrompt,
  getDataGroupPrompt,
  getProjectInfoPrompt,
  getRequirementCollectPrompt,
  getDomainClassifyPrompt,
  getDomainExpandPrompt,
  getDocParsePrompt,
  getAreaSuggestPrompt,
  getAreaExpandPrompt,
} from './systemPrompt';
import { deriveFPRow } from './fpDerivation';
import { splitTextChunks, prioritizeRfpText } from './textExtract';
import { classifyReuse, summarizeReuse, snapDomainsToExisting } from './upgradeMatch';
import { REUSE_TYPE } from './fpConstants';
import { deriveDataFunctionMetrics } from './dataFunctionDerivation';
import { getAuthHeaders } from './supabase';

const TEMPERATURE = 0;
const MODEL = 'claude-sonnet-4-5';
let activeProjectId = '';

export const setClaudeProjectContext = (projectId) => {
  activeProjectId = projectId || '';
};

// ── 기본 API 호출 (재시도 포함) ──────────────────────────────
export const callAPI = async (content, maxTokens = 2000, retries = 3) => {
  let lastStatus = null;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // 클라이언트 타임아웃: 게이트웨이(504)보다 먼저 끊어 명확한 메시지 제공
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 70000);
      let res;
      try {
        const authHeaders = await getAuthHeaders();
        res = await fetch('/api/claude', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Project-Id': activeProjectId, ...authHeaders },
          body: JSON.stringify({
            model: MODEL,
            max_tokens: maxTokens,
            temperature: TEMPERATURE,
            messages: [{ role: 'user', content }],
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const status = res.status;
        lastStatus = status;
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
        // 502/504 게이트웨이 타임아웃 → 재시도 (입력이 크거나 모델이 느릴 때)
        if (status === 502 || status === 504) {
          console.warn(`게이트웨이 타임아웃 (${status}), 재시도... (${attempt+1}/${retries})`);
          await sleep(2000);
          continue;
        }
        const serverMessage = typeof err.error === 'string' ? err.error : err.error?.message;
        throw new Error(serverMessage || `API 오류 (${status})`);
      }
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return data.content?.map(c => c.type === 'text' ? c.text : '').join('') || '';
    } catch (e) {
      const isTimeout = e.name === 'AbortError';
      if (attempt === retries - 1) {
        throw new Error(isTimeout
          ? '응답 시간 초과 — 입력이 너무 큽니다. 기능 수를 줄이거나 RFP를 나눠서 시도하세요.'
          : e.message);
      }
      console.warn(`시도 ${attempt+1} 실패: ${e.message}`);
      await sleep(isTimeout ? 500 : 1000);
    }
  }
  if (lastStatus === 502 || lastStatus === 504) {
    throw new Error(`게이트웨이 타임아웃 — 재시도 한도 초과 (${lastStatus})`);
  }
  if (lastStatus === 429) {
    throw new Error('요청 한도 초과(429) — 잠시 후 다시 시도하세요');
  }
  if (lastStatus === 503 || lastStatus === 529) {
    throw new Error(`AI 서버 과부하(${lastStatus}) — 잠시 후 다시 시도하세요`);
  }
  throw new Error('API 재시도 한도 초과');
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

// 공통 후처리: LV1이 달라도 LV2+LV3가 같으면 동일 기능 (도메인 간 중복)
// 도메인 독립 확장 구조에서 공통기능(사용자/권한/알림 등)이
// 여러 도메인에 중복 생성되는 것을 막는다.
const crossLv1Dedup = (funcs) => {
  const norm = (s) => (s || '').replace(/\s+/g, '');
  const seen = new Set();
  return funcs.filter(f => {
    const key = `${norm(f.lv2)}|${norm(f.lv3)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── 문서에서 프로젝트 정보 추출 ──────────────────────────────
export const extractProjectInfo = async (text) => {
  const raw = await callAPI(getProjectInfoPrompt(text), 2000);
  try { return parseJSON(raw); } catch (_) { return {}; }
};

// ── 문서 파싱 (기능정의서 docx/pdf) ─────────────────────────
export const parseDocumentFunctions = async (text) => {
  // [변경] 기존: text.slice(0,4000) 1회 호출 → 기능 60~80개 이상 문서는 잘림.
  // 줄 경계 청크(6000자, 오버랩 200)로 전체를 파싱하고 중복 제거.
  const chunks = splitTextChunks(text, 6000, 200);
  let all = [];
  const failedChunks = [];
  for (let i = 0; i < chunks.length; i++) {
    try {
      const raw = await callAPI(getDocParsePrompt(chunks[i]), 3000);
      const parsed = parseJSON(raw);
      all = [...all, ...(parsed.functions || [])];
    } catch (e) {
      failedChunks.push(`${i + 1}/${chunks.length}`);
      console.warn(`기능정의서 파싱 청크 ${i + 1} 실패:`, e.message);
    }
  }
  if (failedChunks.length > 0) {
    throw new Error(`기능정의서 청크 ${failedChunks.join(', ')} 파싱에 실패해 부분 결과를 적용하지 않았습니다.`);
  }
  // 오버랩으로 인한 중복 제거
  const seen = new Set();
  return all.filter(f => {
    if (!f.lv3) return false;
    const k = `${(f.lv1||'').replace(/\s/g,'')}|${(f.lv2||'').replace(/\s/g,'')}|${(f.lv3||'').replace(/\s/g,'')}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

// ── 1단계만: 정보추출 + 요구사항 + 도메인분류 ────────────────
export const extractDomainsOnly = async (text, userInput, onProgress, targetFuncCount = 0, existingLv1s = []) => {
  const report = (step, msg, pct) => onProgress && onProgress(step, msg, pct);
  const analysisStatus = {
    infoFailed: false,
    requirementChunks: { total: 0, succeeded: 0, failures: [] },
    domainFallback: false,
  };

  report(1, '문서에서 시스템 정보 추출 중...', 5);
  let info = {};
  try {
    const infoRaw = await callAPI(getProjectInfoPrompt(text + (userInput ? '\n\n추가설명:\n' + userInput : '')), 2000);
    info = parseJSON(infoRaw);
  } catch(e) {
    analysisStatus.infoFailed = true;
    console.warn('정보 추출 실패:', e.message);
  }

  const systemName = info.systemName || '정보시스템';
  const description = info.systemOverview || '';
  const mainUsers = info.mainUsers || ['사용자', '관리자'];
  const projectType = info.projectType || 'SW개발';

  report(1, `시스템: ${systemName}`, 12);

  // 요구사항 수집
  // [변경] Vercel Hobby 플랜은 서버리스 함수 실행시간이 60초 고정 상한이라
  // maxDuration을 코드로 못 늘린다. 8,000자 청크가 가끔 60초를 넘겨 504가 났음
  // (15개 중 1개 실패 사례 확인). 4,000자로 줄여 호출당 처리시간을 낮춘다.
  const bounded = prioritizeRfpText(text, 150000);
  const chunks = splitTextChunks(bounded, 4000, 200);
  analysisStatus.requirementChunks.total = chunks.length;

  let allReqs = [];
  // [변경] 재시도 3회를 다 써도 504가 계속 나면(청크 자체가 무거운 경우),
  // 그 청크를 절반으로 쪼개 한 번 더 시도한다 — 재시도만으로는 같은 크기를
  // 또 보내는 것이라 타임아웃이 반복될 수 있어 입력 크기 자체를 줄이는 안전망.
  const collectFromChunk = async (chunkText, label) => {
    try {
      const raw = await callAPI(getRequirementCollectPrompt(chunkText, label, systemName), 3000);
      const parsed = parseJSON(raw);
      return (parsed.requirements || []).filter(r => r?.length > 5);
    } catch (e) {
      if (/시간 초과|타임아웃/.test(e.message) && chunkText.length > 1200) {
        const half = Math.floor(chunkText.length / 2);
        const [a, b] = [chunkText.slice(0, half), chunkText.slice(half)];
        const [ra, rb] = await Promise.all([
          collectFromChunk(a, `${label}-1`).catch(() => []),
          collectFromChunk(b, `${label}-2`).catch(() => []),
        ]);
        return [...ra, ...rb];
      }
      throw e;
    }
  };

  for (let i = 0; i < chunks.length; i++) {
    report(2, `요구사항 수집 중... (${i+1}/${chunks.length})`, 12 + Math.round((i/chunks.length)*25));
    try {
      allReqs = [...allReqs, ...await collectFromChunk(chunks[i], i + 1)];
      analysisStatus.requirementChunks.succeeded += 1;
    } catch(e) {
      analysisStatus.requirementChunks.failures.push({
        chunk: i + 1,
        range: `${i + 1}/${chunks.length}`,
        message: e.message,
      });
      console.warn(`청크 ${i+1} 실패:`, e.message);
    }
  }

  if (userInput?.trim()) {
    const userLines = userInput.split(/[\n,。、]/).map(l => l.trim()).filter(l => l.length > 4);
    allReqs = [...allReqs, ...userLines];
  }
  allReqs = [...new Set(allReqs)].slice(0, 400);

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
      getDomainClassifyPrompt(allReqs, systemName, description, mainUsers, projectType, userInput, targetFuncCount, existingLv1s),
      2000
    );
    const parsed = parseJSON(domainRaw);
    domains = parsed.domains || [];
  } catch(e) { console.warn('도메인 분류 실패:', e.message); }

  if (domains.length === 0) {
    analysisStatus.domainFallback = true;
    domains = [
      { lv1:'업무관리', description:'폴백(검증 필요): 핵심 업무', requirements: allReqs.slice(0,15), expectedLv2:[], isFallback:true },
      { lv1:'현황 및 통계', description:'폴백(검증 필요): 조회/통계', requirements: allReqs.slice(15,30), expectedLv2:[], isFallback:true },
      { lv1:'시스템관리', description:'폴백(검증 필요): 사용자/권한/공통', requirements:[], expectedLv2:['사용자관리','권한관리'], isFallback:true },
    ];
  }

  // 고도화 안전망: AI가 기존 LV1을 새 이름으로 바꿨으면 기존 명칭으로 스냅
  // (프롬프트 지시가 안 지켜진 경우 결정론적으로 통일 — "연동계획관리"→"연동계획")
  if (existingLv1s && existingLv1s.length > 0) {
    domains = snapDomainsToExisting(domains, existingLv1s);
  }

  report(3, `LV1 ${domains.length}개 확인 필요`, 100);

  return { systemName, overview: description, projectType, mainUsers, allReqs, domains, analysisStatus, rfpText: text, userInput: userInput || '' };
};

// ── 2단계: 선택된 도메인으로 기능 확장 ────────────────────────
export const expandDomainsToFunctions = async (domains, info, onProgress, existingFunctions = [], onDomainDone, skipLv1s = []) => {
  const report = (step, msg, pct) => onProgress && onProgress(step, msg, pct);
  const { systemName, mainUsers = ['사용자','관리자'], allReqs = [], rfpText = '', userInput = '' } = info || {};

  // 도메인별 RFP 발췌: 도메인 토큰이 등장하는 줄을 모아 근거로 제공
  const rfpLines = (rfpText || '').split('\n').map(l => l.trim()).filter(l => l.length > 8);
  const rfpSnippetFor = (domain) => {
    const tokens = [domain.lv1, ...(domain.expectedLv2 || [])]
      .join(' ').split(/[\s/·,()>]+/).map(t => t.replace(/관리$|조회$|현황$/, '')).filter(t => t.length >= 2);
    const hits = rfpLines.filter(l => tokens.some(t => l.includes(t)));
    return hits.slice(0, 40).join('\n');
  };
  // 고도화: LV1별 기존 기능 목록 (중복 생성 방지용)
  const existingByLv1 = new Map();
  (existingFunctions || []).forEach(f => {
    if (!existingByLv1.has(f.lv1)) existingByLv1.set(f.lv1, []);
    existingByLv1.get(f.lv1).push(`${f.lv2} > ${f.lv3}`);
  });

  // [안전망] 도메인 분류가 requirements 배분을 비워서 주는 경우가 있다.
  // 확장 프롬프트는 요구사항 근거 기반이므로, 빈 도메인은 allReqs에서
  // 키워드 매칭으로 백필한다 (도메인명/예상LV2 토큰 포함 여부).
  const backfilled = domains.map(d => {
    if ((d.requirements || []).length > 0) return d;
    const tokens = [d.lv1, ...(d.expectedLv2 || [])]
      .join(' ')
      .split(/[\s/·,()>]+/)
      .map(t => t.replace(/관리$|조회$|현황$/, '').trim())
      .filter(t => t.length >= 2);
    const matched = allReqs.filter(r => tokens.some(t => r.includes(t))).slice(0, 30);
    return { ...d, requirements: matched };
  });

  let allFunctions = [];
  const failedDomains = [];
  const skippedLv1s = new Set(skipLv1s || []);
  for (let i = 0; i < backfilled.length; i++) {
    const domain = backfilled[i];
    if (skippedLv1s.has(domain.lv1)) continue;
    const pct = 42 + Math.round((i / backfilled.length) * 55);
    report(4, `[${i+1}/${backfilled.length}] "${domain.lv1}" 기능 확장 중...`, pct);
    // [안전망] 결과 0개면 1회 재시도 (모델이 빈 배열을 반환하는 경우 방지)
    let expanded = false;
    let lastError = '';
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const raw = await callAPI(getDomainExpandPrompt(domain, systemName, mainUsers, {
          userInput,
          rfpSnippet: rfpSnippetFor(domain),
          existingInDomain: existingByLv1.get(domain.lv1) || [],
        }), 6000);
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
        if (funcs.length === 0 && attempt === 0) {
          console.warn(`"${domain.lv1}" 0개 반환 — 재시도`);
          continue;
        }
        if (funcs.length === 0) {
          lastError = '유효한 기능 0개 반환';
          continue;
        }
        allFunctions = [...allFunctions, ...funcs];
        if (onDomainDone) await onDomainDone(domain, funcs);
        expanded = true;
        break;
      } catch(e) {
        lastError = e.message;
        console.warn(`"${domain.lv1}" 확장 실패 (시도 ${attempt+1}):`, e.message);
        if (attempt === 0) await sleep(2000);
      }
    }
    if (!expanded) failedDomains.push({ lv1: domain.lv1, message: lastError || '확장 실패' });
  }

  // [안전망] 전체 0개면 조용한 "완료! 0개" 대신 명시적 에러
  if (allFunctions.length === 0) {
    throw new Error('기능이 생성되지 않았습니다. 업로드 문서에 기능 요구사항이 충분한지, 브라우저 콘솔(F12)의 API 오류를 확인하세요.');
  }

  // 후처리: 컨설팅 과업 필터 + 중복 제거
  const BAD_LV1 = ['AI/ML','AIOps','클라우드 및 인프라','아키텍처 설계',
    '실시간 데이터 스트리밍','인프라 고도화','지능형 운영','운영 자동화',
    '포렌식','비즈니스연속성','사이버보안 통합'];
  // RFP 사업 수행 조건에서 유래하는 행정 도메인 — 단, 시스템명 자체가
  // 해당 업무를 다루면(예: 전사사업관리시스템) 정당한 도메인이므로 허용
  const ADMIN_LV1 = ['사업관리','품질관리','일정관리','위험관리','교육관리','유지보수'];
  const sysName = (systemName || '');
  const badAdmin = ADMIN_LV1.filter(kw => !sysName.includes(kw.slice(0, 2)));
  const BAD_LV3 = [/자동화\s*구현/,/지능화\s*적용/,/고도화\s*수행/,/아키텍처\s*설계/];

  const filtered = allFunctions.filter(f => {
    if (!f.lv1 || !f.lv2 || !f.lv3?.trim()) return false;
    if (BAD_LV1.some(kw => f.lv1.includes(kw))) return false;
    if (badAdmin.some(kw => f.lv1.replace(/\s/g,'') === kw)) return false;
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

  // LV3 동사 통일 ("~한다" 제거)
  const verbNormalized = deduped.map(f => ({
    ...f,
    lv3: (f.lv3 || '').replace(/\s*한다\.?$/, '').replace(/\s*합니다\.?$/, '').trim() || f.lv3,
  }));

  // LV1 자동 통합 (10개 초과 시)
  const lv1List = [...new Set(verbNormalized.map(f => f.lv1))];
  let finalFuncs = verbNormalized;
  if (lv1List.length > 10) {
    const mergeRules = [
      { pattern: /보안|인증|접근제어|감사/, target: '보안관리' },
      { pattern: /운영|모니터링|장애|알람|알림/, target: '운영관리' },
      { pattern: /통계|분석|현황|보고/, target: '통계및분석' },
    ];
    finalFuncs = verbNormalized.map(f => {
      for (const rule of mergeRules) {
        if (rule.pattern.test(f.lv1) && f.lv1 !== rule.target)
          return { ...f, lv1: rule.target };
      }
      return f;
    });
  }

  // 도메인 간 중복 제거 (LV1이 달라도 LV2+LV3 동일하면 같은 기능)
  finalFuncs = crossLv1Dedup(finalFuncs);

  // 고도화 모드: 기존 기능과 대조해 재사용/기능변경/신규 자동 분류
  // (기존 기능이 있을 때만 동작 — 신규 사업이면 영향 없음)
  if (existingFunctions && existingFunctions.length > 0) {
    finalFuncs = classifyReuse(finalFuncs, existingFunctions);
    const s = summarizeReuse(finalFuncs);
    report(4, `완료! 신규 ${s.신규개발} / 변경 ${s.기능변경} / 재사용 ${s.재사용}`, 100);
  } else {
    report(4, `완료! ${finalFuncs.length}개 기능 생성`, 100);
  }
  return { systemName, overview: info?.overview || '', functions: finalFuncs, failedDomains };
};

// ── 추가 영역 제안 ────────────────────────────────────────────
export const suggestAreas = async (systemName, rfpText, functions, targetCount, upgradeMode = false) => {
  const safeRfp = rfpText || '';
  // 재시도: 타임아웃/파싱 실패 시 1회 더 (기존엔 빈 배열 즉시 반환)
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await callAPI(
        getAreaSuggestPrompt(systemName, safeRfp, functions || [], targetCount, upgradeMode),
        3000
      );
      const parsed = parseJSON(raw);
      let suggestions = parsed.suggestions || [];
      // 근거 검증: RFP가 있는데 relatedRequirement가 비었거나 너무 짧으면
      // hallucination 가능성 → 표시(weakEvidence). 제거하진 않되 사용자가 인지.
      if (safeRfp.length > 100) {
        suggestions = suggestions.map(s => ({
          ...s,
          weakEvidence: !s.relatedRequirement || String(s.relatedRequirement).trim().length < 10,
        }));
      }
      return { ...parsed, suggestions };
    } catch (e) {
      console.warn(`영역 제안 시도 ${attempt + 1} 실패:`, e.message);
      if (attempt === 1) return { suggestions: [], analysis: `분석 실패: ${e.message}` };
      await sleep(1500);
    }
  }
  return { suggestions: [], analysis: '분석 실패' };
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
  let newFuncs = funcs.filter(f => !existingKeys.has(`${f.lv1}|${f.lv2}|${f.lv3}`));

  // 고도화 모드: 추가 영역의 기능도 기존 대비 변경/재사용 자동 분류
  if (existingFunctions && existingFunctions.length > 0) {
    newFuncs = classifyReuse(newFuncs, existingFunctions);
  }

  report(`${newFuncs.length}개 추가 완료`, 100);
  return newFuncs;
};

// ── FP 산정 ───────────────────────────────────────────────────
// [구조 변경] 기존: AI가 fpType+FTR+DET를 직접 생성
//   → 같은 입력에 다른 결과(재현 불가), 청크 실패 시 기본값(EI/1/5=L)이
//     조용히 유지되어 "복잡도 L 93.6%" 사고의 직접 원인이 됐음.
// 변경: AI는 fpType + refGroups(참조 데이터그룹 이름)만 분류하고,
//   FTR/DET 숫자는 fpDerivation.js의 결정론적 규칙표가 산출한다.
//   → 재현 가능 + 행마다 산정 근거(fpBasis) 보존 + 실패 행은 명시적 마킹.
const SLEEP_BETWEEN_CHUNKS = 0; // Tier2: 딜레이 없음
const FP_CHUNK = 25; // [변경] 50 → 25: 응답 잘림(JSON 부분복구→누락행 기본값)이
                     // L 도배의 한 원인이었음. 잘림 자체를 구조적으로 방지.

export const generateFPList = async (functions, onProgress, dataGroupNames = []) => {
  const chunks = [];
  for (let i = 0; i < functions.length; i += FP_CHUNK)
    chunks.push(functions.slice(i, i + FP_CHUNK));

  if (onProgress) onProgress(0, chunks.length);

  // idx 기반 결과 맵 — 누락 행은 폴백 분류로 채우되 '분류폴백' 마킹
  const classifiedMap = {}; // globalIdx → { fpType, refGroups }

  for (let ci = 0; ci < chunks.length; ci++) {
    if (onProgress) onProgress(ci + 1, chunks.length);
    const chunkOffset = ci * FP_CHUNK;

    // 청크당 1회 재시도 (기존: 실패 시 조용히 기본값 유지)
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const raw = await callAPI(getFPClassifyPrompt(chunks[ci], dataGroupNames), 4000);
        const parsed = parseJSON(raw);
        (parsed.fpList || []).forEach(fp => {
          const globalIdx = chunkOffset + (fp.idx ?? 0);
          if (functions[globalIdx]) {
            classifiedMap[globalIdx] = {
              fpType: fp.fpType,
              refGroups: Array.isArray(fp.refGroups) ? fp.refGroups : [],
            };
          }
        });
        break;
      } catch (e) {
        console.warn(`FP 분류 청크 ${ci + 1} 시도 ${attempt + 1} 실패:`, e.message);
        if (attempt === 0) await sleep(2000);
      }
    }

    if (SLEEP_BETWEEN_CHUNKS > 0 && ci < chunks.length - 1) await sleep(SLEEP_BETWEEN_CHUNKS);
  }

  // 분류 결과 + 결정론적 FTR/DET 도출 → FP 행 생성
  return functions.map((f, i) => {
    const derived = deriveFPRow(f, classifiedMap[i]);
    return {
      idx: i,
      lv1: f.lv1, lv2: f.lv2, lv3: f.lv3,
      definition: f.definition,
      fpType: derived.fpType,
      ftr: derived.ftr,
      det: derived.det,
      reuseType: REUSE_TYPE.NEW,
      classified: derived.classified,
      bigo: derived.classified ? derived.fpBasis : `분류폴백 | ${derived.fpBasis}`,
    };
  });
};

// ── 데이터그룹(ILF/EIF) 도출 ─────────────────────────────────
// [구조 변경] 기존: LV2당 ILF 1개 자동배정 (ftr=1, det=10 고정)
//   → ILF는 논리 데이터그룹 단위인데 메뉴 단위로 배정하면
//     같은 엔터티(사용자 등)가 중복 계상됨. DIMS ILF 43개의 원인.
// 변경: AI가 기능 구조에서 논리 데이터그룹을 도출 (근거 LV2 목록 포함),
//   EIF는 RFP 근거 문장이 있는 것만.
export const deriveDataGroups = async (functions, systemName, rfpText = '') => {
  const raw = await callAPI(getDataGroupPrompt(functions, systemName, rfpText), 3000);
  const parsed = parseJSON(raw);
  const ilf = (parsed.ilf || [])
    .filter(g => g.name)
    .map(g => ({
      name: String(g.name).trim(),
      ...deriveDataFunctionMetrics(g),
      relatedLv2: Array.isArray(g.relatedLv2) ? g.relatedLv2 : [],
    }));
  const eif = (parsed.eif || [])
    .filter(g => g.name && g.source) // RFP 근거 없으면 제외
    .map(g => ({
      name: String(g.name).trim(),
      ...deriveDataFunctionMetrics(g),
      source: String(g.source).slice(0, 120),
    }));
  return { ilf, eif };
};
