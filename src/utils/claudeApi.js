/* eslint-disable no-unused-vars */
import {
  getLV123Prompt,
  getFPPrompt,
  getParsePrompt,
  getParseImagePrompt,
  getSystemInfoPrompt,
  getSystemInfoImagePrompt,
  getISPDraftPrompt,
  getRFPSystemDetectPrompt,
  getRFPChunkCollectPrompt,
  getRFPDomainPrompt,
  getRFPDomainExpandPrompt,
} from './systemPrompt';

// temperature: 0 → 재현성 보장
const STABLE_TEMP = 0;

// JSON 안전 파싱 - 잘린 응답 완벽 복구
const safeParseJSON = (text) => {
  let clean = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  try { return JSON.parse(clean); } catch (_) {}
  const start = clean.indexOf('{');
  if (start === -1) throw new Error('JSON 파싱 실패: JSON을 찾을 수 없습니다');
  clean = clean.slice(start);
  for (let end = clean.length; end > 0; ) {
    const pos = clean.lastIndexOf('}', end - 1);
    if (pos === -1) break;
    try { return JSON.parse(clean.slice(0, pos + 1)); } catch (_) { end = pos; }
  }
  // 잘린 배열 복구
  const repairJSON = (str) => {
    let depth = 0, lastComplete = -1, inStr = false, escape = false;
    for (let i = 0; i < str.length; i++) {
      const c = str[i];
      if (escape) { escape = false; continue; }
      if (c === '\\' && inStr) { escape = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === '{') depth++;
      if (c === '}') { depth--; if (depth === 1) lastComplete = i; }
    }
    if (lastComplete === -1) return null;
    const truncated = str.slice(0, lastComplete + 1);
    let opens = 0, closes = 0, arrOpens = 0, arrCloses = 0;
    inStr = false; escape = false;
    for (const c of truncated) {
      if (escape) { escape = false; continue; }
      if (c === '\\' && inStr) { escape = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === '{') opens++;
      if (c === '}') closes++;
      if (c === '[') arrOpens++;
      if (c === ']') arrCloses++;
    }
    const suffix = ']'.repeat(Math.max(0, arrOpens - arrCloses)) + '}'.repeat(Math.max(0, opens - closes));
    try { return JSON.parse(truncated + suffix); } catch (_) { return null; }
  };
  const repaired = repairJSON(clean);
  if (repaired) return repaired;
  throw new Error('JSON 파싱 실패: 응답이 잘렸거나 형식이 올바르지 않습니다');
};

// 텍스트 API 호출
const callClaude = async (content, maxTokens = 2000) => {
  const response = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      max_tokens: maxTokens,
      temperature: STABLE_TEMP,
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
// FP 산정 (청크 5개 + idx 매핑으로 누락 완전 방지)
// ============================================================
const sleep = (ms) => new Promise(res => setTimeout(res, ms));

const callClaudeWithRetry = async (prompt, maxTokens, retries = 5) => {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await callClaude(prompt, maxTokens);
    } catch (err) {
      const msg = err.message || '';
      const isRateLimit = msg.includes('rate limit') || msg.includes('10,000') || msg.includes('529') || msg.includes('overloaded');
      if (isRateLimit && attempt < retries - 1) {
        const waitSec = [20, 40, 60, 90][attempt] || 90;
        console.warn(`Rate limit. ${waitSec}초 대기 후 재시도 (${attempt+1}/${retries})`);
        await sleep(waitSec * 1000);
      } else {
        throw err;
      }
    }
  }
};

export const generateFPList = async (functions, onProgress) => {
  const CHUNK = 5;        // 5개씩 → 응답 토큰 ~200개로 확실히 제한
  const DELAY_MS = 3000;  // 3초 대기 (5개×~200토큰 = ~1000토큰/청크, 분당 20청크 가능)

  const chunks = [];
  for (let i = 0; i < functions.length; i += CHUNK)
    chunks.push(functions.slice(i, i + CHUNK));

  if (onProgress) onProgress(0, chunks.length);

  // idx 기반 결과 맵 (누락 방지)
  const resultMap = {};
  // 기본값 먼저 채움
  functions.forEach((f, i) => {
    resultMap[i] = {
      idx: i, lv1: f.lv1, lv2: f.lv2, lv3: f.lv3,
      definition: f.definition,
      fpType: 'EI', ftr: 1, det: 5, reuseType: '신규개발',
    };
  });

  for (let ci = 0; ci < chunks.length; ci++) {
    if (onProgress) onProgress(ci + 1, chunks.length);
    const chunk = chunks[ci];
    const chunkOffset = ci * CHUNK;
    const prompt = getFPPrompt(chunk);

    try {
      const result = await callClaudeWithRetry(prompt, 1500);
      const fpList = result.fpList || [];
      fpList.forEach(fp => {
        // idx가 있으면 원본 함수 정보와 합쳐서 저장
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
    } catch (err) {
      console.error(`청크 ${ci+1} 실패 (기본값 유지):`, err.message);
    }

    if (ci < chunks.length - 1) await sleep(DELAY_MS);
  }

  // idx 순서대로 정렬해서 반환
  return Object.values(resultMap).sort((a, b) => a.idx - b.idx);
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
      temperature: STABLE_TEMP,
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

// parseRFPFull: RFP → 시스템별 기능목록 생성
// onProgress(step, msg, pct, systemIdx, totalSystems)
export const parseRFPFull = async (text, onProgress) => {
  const report = (step, msg, pct, sIdx=0, sTotal=1) =>
    onProgress && onProgress(step, msg, pct, sIdx, sTotal);

  // ── 0단계: 구축 대상 시스템 탐지 ────────────────────────
  report(1, 'RFP에서 구축 대상 시스템 탐지 중...', 3);
  let systems = [];
  try {
    const detectPrompt = getRFPSystemDetectPrompt(text);
    const detectText = await callClaudeText(detectPrompt, 1500);
    const detected = parseJSON(detectText);
    systems = (detected.systems || []).filter(s => s.systemName && s.systemKey);
  } catch (e) { console.warn('시스템 탐지 실패:', e.message); }

  // 탐지 실패 시 기본 1개 시스템으로
  if (systems.length === 0) {
    systems = [{
      systemKey: 'mainSystem',
      systemName: '정보시스템',
      description: 'RFP에서 구축하는 정보시스템',
      mainUsers: ['사용자', '관리자'],
      coreFeatures: [],
    }];
  }

  report(1, `시스템 ${systems.length}개 탐지 완료: ${systems.map(s=>s.systemName).join(', ')}`, 8);

  // ── 시스템별 파이프라인 실행 ─────────────────────────────
  const allResults = [];
  const pctPerSystem = 90 / systems.length;

  for (let si = 0; si < systems.length; si++) {
    const sys = systems[si];
    const basePct = 8 + si * pctPerSystem;
    const rpt = (step, msg, pct) => report(step, `[${sys.systemName}] ${msg}`, basePct + pct * pctPerSystem / 100, si, systems.length);

    rpt(2, '요구사항 수집 중...', 0);

    // ── 청크별 요구사항 수집 ──────────────────────────────
    const CHUNK_SIZE = 2500;
    const MAX_TEXT = 20000;
    const chunks = [];
    for (let i = 0; i < Math.min(text.length, MAX_TEXT); i += CHUNK_SIZE)
      chunks.push(text.slice(i, i + CHUNK_SIZE));

    let sysRequirements = [];
    for (let ci = 0; ci < chunks.length; ci++) {
      rpt(2, `요구사항 수집 중... (${ci+1}/${chunks.length})`, (ci/chunks.length)*30);
      try {
        const prompt = getRFPChunkCollectPrompt(chunks[ci], ci+1, sys.systemName, sys.coreFeatures || []);
        const resText = await callClaudeText(prompt, 1500);
        const parsed = parseJSON(resText);
        const reqs = (parsed.requirements || []).filter(r => r && r.length > 5);
        sysRequirements = [...sysRequirements, ...reqs];
      } catch (e) { console.warn(`[${sys.systemName}] 청크 ${ci+1} 실패:`, e.message); }
    }

    sysRequirements = [...new Set(sysRequirements)].slice(0, 80);

    // 수집 실패 시 폴백
    if (sysRequirements.length < 5) {
      const lines = text.split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 10 && l.length < 200)
        .filter(l => /관리|기능|처리|등록|조회|수정|삭제|승인/.test(l))
        .slice(0, 30);
      sysRequirements = [...sysRequirements, ...lines];
    }

    rpt(3, `요구사항 ${sysRequirements.length}개 → 도메인 분류 중...`, 35);

    // ── 도메인 분류 ───────────────────────────────────────
    let domains = [];
    try {
      const domainPrompt = getRFPDomainPrompt(
        sysRequirements, sys.systemName,
        sys.description, sys.mainUsers || ['사용자','관리자']
      );
      const domainText = await callClaudeText(domainPrompt, 2000);
      const domainParsed = parseJSON(domainText);
      domains = domainParsed.domains || [];
    } catch (e) { console.warn(`[${sys.systemName}] 도메인 분류 실패:`, e.message); }

    if (domains.length === 0) {
      domains = [
        { lv1:'업무관리', description:'핵심 업무', requirements: sysRequirements.slice(0,15), expectedLv2:[] },
        { lv1:'현황 및 통계', description:'조회 및 통계', requirements: sysRequirements.slice(15,30), expectedLv2:[] },
        { lv1:'공통기능', description:'사용자/권한/시스템', requirements:[], expectedLv2:['사용자관리','권한관리','시스템관리'] },
      ];
    }

    rpt(3, `도메인 ${domains.length}개 → 기능 확장 중...`, 45);

    // ── 도메인별 기능 확장 ────────────────────────────────
    let sysFunctions = [];
    for (let di = 0; di < domains.length; di++) {
      const domain = domains[di];
      rpt(4, `"${domain.lv1}" 기능 확장 중... (${di+1}/${domains.length})`, 45 + (di/domains.length)*50);
      try {
        const expandPrompt = getRFPDomainExpandPrompt(domain, sys.systemName, sys.mainUsers || ['사용자','관리자']);
        const expandText = await callClaudeText(expandPrompt, 3000);
        const expandParsed = parseJSON(expandText);
        const funcs = (expandParsed.functions || [])
          .filter(f => f.lv2 && f.lv3)
          .map(f => ({
            lv1: domain.lv1,
            lv2: f.lv2,
            lv3: f.lv3.replace(/^[A-Z]{2,}-\d+[-\w]*:\s*/i,'').replace(/^[A-Z]{2,}-\d+\s*/i,'').trim(),
            definition: f.definition || `${f.lv3}을 처리한다`,
            systemKey: sys.systemKey,
            systemName: sys.systemName,
          }))
          .filter(f => f.lv3.length > 0);
        sysFunctions = [...sysFunctions, ...funcs];
        rpt(4, `"${domain.lv1}" ${funcs.length}개 완료`, 45 + ((di+1)/domains.length)*50);
      } catch (e) { console.warn(`[${sys.systemName}] "${domain.lv1}" 확장 실패:`, e.message); }
    }

    // 중복 제거
    const seen = new Set();
    const deduped = sysFunctions.filter(f => {
      const k = `${f.lv1}|${f.lv2}|${f.lv3}`;
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });

    allResults.push({
      systemKey: sys.systemKey,
      systemName: sys.systemName,
      description: sys.description,
      functions: deduped,
    });

    rpt(4, `완료! ${deduped.length}개 기능`, 98);
  }

  report(4, `전체 완료! ${allResults.map(r=>r.systemName+'('+r.functions.length+'개)').join(', ')}`, 100);

  // 단일 시스템이면 기존 호환 형태로도 반환
  const allFunctions = allResults.flatMap(r => r.functions);
  return {
    systemName: allResults[0]?.systemName || '',
    overview: systems[0]?.description || '',
    systems: allResults,          // 시스템별 분리 결과
    functions: allFunctions,      // 전체 합산 (기존 호환)
    multiSystem: allResults.length > 1,
  };
};

