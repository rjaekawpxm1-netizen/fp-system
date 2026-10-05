const { diceSimilarity } = require('./textSimilarity.cjs');

const ACTION_VERB = /(등록|수정|삭제|목록\s*조회|상세\s*조회|조회|검색|처리|실행|요청|확정|반려|설정|승인|출력|발급|배포|모니터링|진단|검증|분석|탐지|추천|작성|전송|접수|변환|분류|관리)$/;
const NON_FUNCTIONAL = /(대용량|병렬|분산\s*처리|실시간\s*연동|백업|복구|시스템\s*인프라|보안\s*관리|암호화|성능|가용성|생체\s*인증|접근\s*제어|인터페이스)/;
const AI_SIGNAL = /(생성형\s*AI|LLM|RAG|에이전트|AI\s*플랫폼|인공지능)/i;
const CONSULTING_ISMP = /(ISMP|ISP|컨설팅)/i;

const normalize = value => String(value || '').replace(/\s+/g, '').replace(/[()[\]{}_/.,-]/g, '').toLowerCase();
const stripActionVerb = value => String(value || '').replace(/\s+/g, '')
  .replace(/(등록|수정|삭제|목록조회|상세조회|조회|검색|처리|실행|요청|확정|반려|설정|승인|출력|발급|배포|모니터링|진단|검증|분석|탐지|추천|작성|전송|접수|변환|분류|관리)$/g, '');
const lv1DiceSimilarity = (left, right) => diceSimilarity(stripActionVerb(left), stripActionVerb(right));
const hasActionVerb = value => ACTION_VERB.test(String(value || '').trim());
const hasExecutionVerb = value => ACTION_VERB.test(String(value || '').trim().replace(/관리$/, ''));
const isAiService = func => /AI|인공지능|LLM|RAG|에이전트|모델/i.test(`${func.lv1} ${func.lv2} ${func.lv3}`);

const expandManagement = func => {
  const name = String(func.lv3 || '').trim();
  if (!/관리$/.test(name)) return [func];
  const entity = name.replace(/관리$/, '').trim() || String(func.lv2 || '').trim();
  return ['등록', '수정', '삭제', '목록조회', '상세조회'].map(action => ({
    ...func,
    lv3: `${entity} ${action}`,
    definition: func.definition || `${entity}을 ${action}한다`,
    expandedFrom: name,
  }));
};

const mergeSimilarLv1s = functions => {
  const lv1s = [...new Set(functions.map(func => func.lv1))];
  const targetBySource = new Map();
  for (let left = 0; left < lv1s.length; left += 1) {
    for (let right = left + 1; right < lv1s.length; right += 1) {
      const source = lv1s[right];
      const target = lv1s[left];
      if (lv1DiceSimilarity(source, target) < 0.85) continue;
      const sourceLv2 = functions.filter(func => func.lv1 === source).map(func => func.lv2);
      const targetLv2 = functions.filter(func => func.lv1 === target).map(func => func.lv2);
      const relatedLv2 = sourceLv2.some(a => targetLv2.some(b => {
        const A = normalize(a), B = normalize(b);
        return A === B || A.includes(B) || B.includes(A) || diceSimilarity(a, b) >= 0.6;
      }));
      if (relatedLv2) targetBySource.set(source, target);
    }
  }
  const resolve = value => {
    const visited = new Set();
    let current = value;
    while (targetBySource.has(current) && !visited.has(current)) {
      visited.add(current);
      current = targetBySource.get(current);
    }
    return current;
  };
  return {
    functions: functions.map(func => {
      const target = resolve(func.lv1);
      return target === func.lv1 ? func : { ...func, lv1: target, mergedFrom: func.lv1 };
    }),
    mergedLv1Count: targetBySource.size,
  };
};

const isAiIsmpProject = info => {
  const sourceText = [info?.rfpText, info?.overview, info?.projectType, ...(info?.allReqs || [])].join('\n');
  return CONSULTING_ISMP.test(sourceText) && AI_SIGNAL.test(sourceText);
};

const renameInfraForAi = (functions, info) => {
  if (!isAiIsmpProject(info)) return functions;
  return functions.map(func => (
    /시스템\s*인프라/.test(func.lv1) ? { ...func, lv1: 'AI 운영관리', mergedFrom: func.lv1 } : func
  ));
};

// 필수 AI 영역은 기능을 직접 추가하지 않고, 체크 해제 상태의 제안 도메인으로만 노출한다.
const REQUIRED_AI_DOMAINS = [
  { lv1: 'AI 공통 플랫폼', description: 'AI/LLM/RAG 공통 플랫폼 (지식베이스·프롬프트·에이전트 관리)', expectedLv2: ['지식베이스', '프롬프트관리', '에이전트관리'] },
  { lv1: 'AI 운영관리', description: 'AI 모델 운영 (모델·성능·거버넌스 관리)', expectedLv2: ['모델관리', '성능관리', '거버넌스'] },
  { lv1: '직원 업무지원 AI', description: '직원 업무지원 AI (법령검색·문서초안)', expectedLv2: ['법령검색', '문서초안'] },
];

const buildRequiredAiDomains = (info, existingLv1s = []) => {
  if (!isAiIsmpProject(info)) return [];
  const present = new Set((existingLv1s || []).map(normalize));
  return REQUIRED_AI_DOMAINS
    .filter(domain => !present.has(normalize(domain.lv1)))
    .map(domain => ({ ...domain, requirements: [], enabled: false, suggested: true }));
};

const applyToBeFunctionRules = (functions, info = {}) => {
  const excluded = [];
  const candidates = (functions || []).filter(func => {
    const label = `${func.lv2 || ''} ${func.lv3 || ''}`.trim();
    if (NON_FUNCTIONAL.test(label) && !hasExecutionVerb(label)) {
      excluded.push({ ...func, reason: '비기능 항목' });
      return false;
    }
    return true;
  });
  const expanded = candidates.flatMap(expandManagement);
  const reviewed = expanded.map(func => {
    if (func.needsReview || (isAiService(func) && !hasActionVerb(func.lv3))) {
      return { ...func, needsReview: true };
    }
    return func;
  });
  const merged = mergeSimilarLv1s(reviewed);
  const required = renameInfraForAi(merged.functions, info);
  const seen = new Set();
  const deduped = required.filter(func => {
    const key = `${normalize(func.lv1)}|${normalize(func.lv2)}|${normalize(func.lv3)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { functions: deduped, excluded, mergedLv1Count: merged.mergedLv1Count };
};

module.exports = { applyToBeFunctionRules, buildRequiredAiDomains, hasActionVerb };
