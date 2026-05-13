/* eslint-disable no-useless-escape */

// ── 공통 상수 ────────────────────────────────────────────────
const FP_CORE = `SW사업 FP전문가. IFPUG CPM 4.3.1 기준.
EI=등록/수정/삭제/승인/업로드 EO=통계/보고서/집계 EQ=조회/검색/다운로드
ILF=내부유지데이터그룹 EIF=외부참조데이터그룹`;

const FP_WEIGHTS = `EI:L=3,A=4,H=6 EO:L=4,A=5,H=7 EQ:L=3,A=4,H=6 ILF:L=7,A=10,H=15 EIF:L=5,A=7,H=10
간이법: EI=4.0 EO=5.2 EQ=3.9 ILF=7.5 EIF=5.4`;

// ── 기능목록 생성 ─────────────────────────────────────────────
export const getLV123Prompt = (systemInfo, keyword) => `
${FP_CORE}
JSON만 응답. 한국어.
시스템: ${systemInfo}
${keyword ? `키워드: "${keyword}"` : ''}
${keyword ? 'LV2 2~3개, LV2당 LV3 4~6개. 총 20개 이내.' : 'LV1 3~5개, LV2당 LV3 4~6개. 총 40개 이내.'}
LV3 필수: 등록/수정/삭제/목록조회/상세조회. definition: "~을 ~한다" 15자 이내.
{"functions":[{"lv1":"","lv2":"","lv3":"","definition":""}]}
`;

export const getAutoGeneratePrompt = (systemName, systemOverview) => `
SW사업 BA전문가. JSON만 응답.
시스템명: ${systemName}
개요: ${systemOverview}
LV1 3~5개, LV2당 4~6개 LV3, 공통필수: 사용자관리/권한관리/시스템관리
{"functions":[{"lv1":"","lv2":"","lv3":"","definition":""}]}
`;

// ── FP 산정 ───────────────────────────────────────────────────
export const getFPPrompt = (functions) => {
  // 입력 압축: idx/l2/l3만 전달 (토큰 최소화)
  const compact = functions.map((f, i) => ({
    i,
    l2: f.lv2,
    l3: f.lv3.slice(0, 15),
  }));
  return `${FP_CORE}
${FP_WEIGHTS}

규칙: ILF=업무당1개, EI=등록/수정/삭제, EO=통계/보고서, EQ=조회/검색
입력 ${compact.length}개 전부 출력 필수. idx=i값 그대로.
lv1/lv2/lv3 생략해서 응답 최소화:
${JSON.stringify(compact)}

{"fpList":[{"idx":0,"fpType":"EI","ftr":1,"det":5,"reuseType":"신규개발"}]}`;
};

// ── 파싱 ─────────────────────────────────────────────────────
export const getParsePrompt = (text) => `
SW기능정의서에서 LV1/LV2/LV3/기능정의 추출. 병합셀=위행값. JSON만:
${text}
{"functions":[{"lv1":"","lv2":"","lv3":"","definition":""}]}
`;

export const getParseImagePrompt = () => `
이미지는 SW기능정의서. 표구조인식, LV1/LV2/LV3/기능정의 추출. 병합셀처리. JSON만:
{"functions":[{"lv1":"","lv2":"","lv3":"","definition":""}]}
`;

export const getSystemInfoPrompt = (text) => `
아래 문서에서 시스템 정보 추출. JSON만:
${text}
{"systemName":"","overview":"","mainFunctions":[],"relatedOrgs":[],"keywords":[]}
`;

export const getSystemInfoImagePrompt = () => `
이미지에서 시스템명/개요/주요기능/관련기관/키워드 추출. JSON만:
{"systemName":"","overview":"","mainFunctions":[],"relatedOrgs":[],"keywords":[]}
`;

// ── RFP 파싱 ─────────────────────────────────────────────────
export const getRFPParsePrompt = (text) => `
SW사업 BA전문가. RFP에서 "구축할 시스템의 기능요구사항"을 추출해서 LV1/LV2/LV3으로 변환. JSON만.

## 인식할 요구사항 코드 형식 (모두 처리)
다음 중 어떤 형식이든 기능요구사항으로 인식:
- FR-xxx, FR_xxx : 기능요구사항
- CNR-xxx, CNR_xxx : 컨설팅/일반 요구사항
- SFR-xxx : 소프트웨어 기능요구사항  
- FRQ-xxx, REQ-xxx : 요구사항
- 숫자만: 1.1, 2.3.1 등 번호체계
- 코드 없이 "~해야 한다", "~기능을 제공", "~구현" 등 서술형도 포함

## 핵심 추출 규칙
1. 추출 대상: 발주기관이 구축을 요구하는 SW 시스템의 기능
   예) "출입신청 기능을 제공해야 한다" → 출입신청관리 > 출입신청 > 출입신청 등록
   예) "CNR-001: 현황분석 수행" → 현황분석 > 현황조사 > 현황조사 등록
   예) "이해관계자 인터뷰 수행" → 현황분석 > 인터뷰관리 > 인터뷰 등록

2. ISP/컨설팅 사업이면 컨설팅 과업도 SW 기능으로 변환:
   "현황분석" → 현황분석관리 LV2
   "전략수립" → 전략계획관리 LV2
   "로드맵 작성" → 로드맵관리 LV2
   "보고서 작성" → 보고서관리 LV2

3. 문서 전체에서 기능이 될 수 있는 모든 항목 추출 (최소 20개 이상 목표)

4. LV3는 반드시 한국어, 코드번호 제외
   CRUD 패턴 적용: 등록/수정/삭제/목록조회/상세조회

5. 공통기능 반드시 추가: 사용자관리/권한관리/시스템관리

## RFP 텍스트
${text.slice(0, 3000)}

{"systemName":"","overview":"","functions":[{"lv1":"","lv2":"","lv3":"","definition":""}]}
`;

// ── 요구사항 검증 (Tier1 최적화: 입력 최소화) ────────────────
export const getValidationPrompt = (rfpText, functions) => {
  const rfp = rfpText.slice(0, 2000);
  const funcs = functions.slice(0, 80).map(f => `${f.lv1}>${f.lv2}>${f.lv3}`).join('\n');
  return `공공SW사업 BA전문가. 요구사항 커버리지 검증. JSON만.

## 검증 방법
1. RFP에서 요구사항 문장 추출 (FR-xxx, CNR-xxx, "~해야 한다" 등)
2. 각 요구사항이 기능목록에 반영됐는지 확인
3. 반영: ✅ / 미반영: ❌ / 부분반영: ⚠️

## 판단 기준
- LV3 기능명이 요구사항의 핵심 업무를 포함하면 ✅
- 유사한 기능이 있으면 ⚠️
- 전혀 없으면 ❌

RFP:
${rfp}

기능목록(${functions.length}개):
${funcs}

{"coverage":{"score":0,"items":[{"req":"요구사항 원문","status":"✅","functions":["관련기능LV3"],"comment":""}]},"summary":"한줄요약"}`;
};

// ── 기능 품질 검증 (Tier1 최적화) ────────────────────────────
export const getQualityCheckPrompt = (functions) => {
  const funcs = functions.slice(0, 40).map(f => `${f.lv2}|${f.lv3}`).join('\n');
  return `BA품질검토. JSON만.
기능(${functions.length}개): ${funcs}
검증: 모호기능명/definition누락/CRUD불완전/중복
{"qualityScore":85,"issues":[{"type":"모호한기능명","severity":"warning","lv2":"","lv3":"","message":"","suggestion":""}],"crudGaps":[{"lv2":"","missing":[],"existing":[]}],"summary":""}`;
};

// ── FP 역검증 (Tier1 최적화) ─────────────────────────────────
export const getFPValidationPrompt = (fpList, totalFP) => {
  const byType = ['ILF','EIF','EI','EO','EQ']
    .map(t => `${t}:${fpList.filter(f=>f.fpType===t).length}`)
    .join(' ');
  return `FP검토전문가. JSON만.
총FP:${totalFP} 유형:${byType}
검증: ILF적정성/EQ비율/복잡도분포/EIF누락
{"fpScore":90,"issues":[{"type":"ILF부족","severity":"error","message":"","suggestion":""}],"summary":""}`;
};

// ── ❌ 요구사항 재생성 (토큰 증가 + 더 많이 생성) ───────────────────────
export const getRegenFromReqPrompt = (failedReqs, systemInfo, existingFunctions) => {
  const existingLV2 = [...new Set(existingFunctions.map(f => f.lv2))].slice(0, 20).join(',');
  const reqs = failedReqs.slice(0, 10).map((r, i) => `${i+1}.${r.req}`).join('\n');
  const count = Math.max(failedReqs.length * 3, 10); // 요구사항당 최소 3개 이상 생성
  return `BA전문가. JSON만.
시스템:${systemInfo}
기존LV2:${existingLV2}
미반영요구사항→LV1/LV2/LV3변환(CRUD패턴 완전적용, 중복제외, 최소${count}개 생성):
${reqs}

규칙:
- 각 요구사항에서 등록/수정/삭제/목록조회/상세조회 CRUD 패턴 모두 생성
- 승인/반려/처리 등 업무흐름도 별도 LV3 생성
- 최소 ${count}개 이상 생성 필수

{"functions":[{"lv1":"","lv2":"","lv3":"","definition":"","fromReq":""}]}`;
};

// ══════════════════════════════════════════════════════════════
// RFP → 시스템별 기능목록 생성 파이프라인 프롬프트
// ══════════════════════════════════════════════════════════════

// 0단계: RFP에서 구축 대상 시스템 목록 탐지
export const getRFPSystemDetectPrompt = (text) => `
SW사업 BA전문가. RFP에서 "실제로 구축(개발)할 SW 시스템" 목록을 탐지. JSON만.

## 구축 대상 시스템이란
- 발주기관이 사업자에게 개발을 의뢰하는 소프트웨어 시스템
- 완성 후 사용자가 로그인해서 실제로 사용하는 시스템
- 예) "연구정보시스템 구축", "과제관리시스템 개발", "포털 구축"

## 제외 대상 (시스템 아님)
- ISP/마스터플랜 등 컨설팅 산출물
- 현황분석, 전략수립 등 방법론 과업
- 하드웨어, 네트워크 장비

## RFP 텍스트
${text.slice(0, 4000)}

각 시스템마다:
- systemKey: 영문 camelCase 식별자 (예: researchInfoSystem)
- systemName: 한국어 시스템명
- description: 시스템 목적 1~2문장
- mainUsers: 주요 사용자 (예: ["연구원","관리자"])
- coreFeatures: RFP에서 언급된 핵심 기능 키워드 목록

{"systems":[{"systemKey":"","systemName":"","description":"","mainUsers":[],"coreFeatures":[]}]}
`;

// 2단계: 청크에서 특정 시스템의 요구사항만 수집
export const getRFPChunkCollectPrompt = (chunkText, chunkIdx, systemName, coreFeatures) => `
SW사업 BA전문가. RFP 청크에서 "${systemName}"에 관련된 요구사항만 수집. JSON만.

## 수집 기준: "${systemName}" 시스템의 요구사항
관련 키워드: ${coreFeatures.join(', ')}

## 수집 대상 (형식 무관)
- 코드형: FR-xxx, CNR-xxx, REQ-xxx, SFR-xxx 등
- 서술형: "~해야 한다", "~기능을 제공", "~처리", "~관리"
- 해당 시스템 사용자가 직접 수행하는 업무 기능

## 절대 수집 제외
- 컨설턴트/사업자가 수행하는 방법론 과업 (현황분석 수행, 전략수립, 보고서 작성 등)
- 다른 시스템의 요구사항
- 납품물, 일정, 평가기준

RFP 청크 ${chunkIdx}:
${chunkText}

{"requirements":["요구사항 원문1","요구사항 원문2"]}
`;

// 3단계: 수집된 요구사항 → 도메인(LV1) 분류
export const getRFPDomainPrompt = (requirements, systemName, description, mainUsers) => `
SW사업 BA전문가. 수집된 요구사항을 "${systemName}"의 업무 도메인(LV1)으로 분류. JSON만.

시스템 설명: ${description}
주요 사용자: ${mainUsers.join(', ')}

요구사항 목록:
${requirements.slice(0, 60).map((r, i) => `${i + 1}. ${r}`).join('\n')}

## 분류 규칙
- LV1은 5~8개 (실제 업무 대분류)
- 반드시 사용자가 실제로 쓰는 업무 영역 기준으로 분류
- 예) 과제관리, 연구비관리, 보고서관리, 성과관리, 공통기능
- 공통기능(사용자/권한/시스템관리) 반드시 포함
- 각 도메인에 해당 요구사항 번호 매핑

{"domains":[{"lv1":"업무영역명","description":"영역 설명","requirements":["관련 요구사항 원문"],"expectedLv2":["예상 LV2 목록"]}]}
`;

// 4단계: 도메인별 기능 확장
export const getRFPDomainExpandPrompt = (domain, systemName, mainUsers) => `
SW사업 BA전문가. "${systemName}"의 "${domain.lv1}" 업무영역 기능목록 생성. JSON만.

주요 사용자: ${mainUsers.join(', ')}
관련 요구사항:
${(domain.requirements || []).slice(0, 15).join('\n')}
예상 LV2: ${(domain.expectedLv2 || []).join(', ')}

## 생성 기준: 사용자가 시스템에서 직접 클릭하는 화면/버튼
판단 기준: "로그인한 사용자가 이 기능의 버튼/메뉴를 클릭하는가?"
→ YES: 포함 (등록화면, 조회화면, 처리버튼 등)
→ NO: 제외 (컨설턴트 작업, 방법론, 문서 작성 등)

## 생성 규칙
1. LV2는 4~6개 (실제 업무 메뉴 단위)
2. 각 LV2마다 LV3 최소 5개:
   - 기본 CRUD: 등록 / 수정 / 삭제 / 목록조회 / 상세조회
   - 업무특화: 승인 / 반려 / 제출 / 확정 / 취소 등
   - 집계/통계/출력: 통계조회 / 보고서출력 / 현황조회 등
3. definition: "~을 ~한다" 형식 15자 이내
4. 최소 25개 이상 생성 필수

{"functions":[{"lv1":"${domain.lv1}","lv2":"","lv3":"","definition":""}]}
`;

// ── ISP 정보화전략계획서 생성 ─────────────────────────────────
export const getISPDraftPrompt = (section, rfpText, systemName, overview, functions) => {
  const funcSample = functions.slice(0, 30).map(f => `${f.lv1} > ${f.lv2} > ${f.lv3}`).join('\n');
  const rfpSnippet = rfpText.slice(0, 1500);

  const sectionPrompts = {
    executive: `
SW사업 ISP 전문가. JSON만 응답. 한국어.
아래 정보를 바탕으로 정보화전략계획서의 "경영진 요약(Executive Summary)" 섹션을 작성하라.

시스템명: ${systemName}
개요: ${overview}
RFP 주요내용: ${rfpSnippet}

{"title":"경영진 요약","content":"300자 이내 경영진 요약","keyPoints":["핵심포인트1","핵심포인트2","핵심포인트3"],"investmentValue":"투자 가치 및 기대효과 1문장"}
`,
    background: `
SW사업 ISP 전문가. JSON만 응답. 한국어.
아래 정보를 바탕으로 정보화전략계획서의 "사업 배경 및 목적" 섹션을 작성하라.

시스템명: ${systemName}
개요: ${overview}
RFP 주요내용: ${rfpSnippet}

{"title":"사업 배경 및 목적","background":"사업추진 배경 200자","purpose":"사업 목적 200자","goals":["목표1","목표2","목표3"],"scope":"사업 범위 설명"}
`,
    asIs: `
SW사업 ISP 전문가. JSON만 응답. 한국어.
아래 정보를 바탕으로 정보화전략계획서의 "현황 분석(AS-IS)" 섹션을 작성하라.

시스템명: ${systemName}
RFP 주요내용: ${rfpSnippet}

{"title":"현황 분석","currentStatus":"현재 업무 처리 현황 200자","problems":["문제점1","문제점2","문제점3","문제점4"],"limitations":"현재 시스템의 한계 150자","improvementNeeds":"개선 필요사항 150자"}
`,
    toBe: `
SW사업 ISP 전문가. JSON만 응답. 한국어.
아래 정보를 바탕으로 정보화전략계획서의 "목표 시스템(TO-BE)" 섹션을 작성하라.

시스템명: ${systemName}
개요: ${overview}
주요기능(상위 30개):
${funcSample}

{"title":"목표 시스템(TO-BE)","vision":"목표 시스템 비전 1문장","architecture":"시스템 아키텍처 설명 200자","coreFeatures":["핵심기능1","핵심기능2","핵심기능3","핵심기능4","핵심기능5"],"expectedEffects":["기대효과1","기대효과2","기대효과3"],"technicalStack":"활용 기술스택 및 플랫폼"}
`,
    requirements: `
SW사업 ISP 전문가. JSON만 응답. 한국어.
아래 기능목록을 바탕으로 정보화전략계획서의 "기능 요구사항 정의" 섹션을 작성하라.

시스템명: ${systemName}
기능목록:
${funcSample}

{"title":"기능 요구사항 정의","summary":"기능 요구사항 개요 150자","functionalAreas":[{"area":"업무영역명","description":"영역 설명","keyFunctions":["주요기능1","주요기능2"]}],"nonFunctional":["비기능요구사항1","비기능요구사항2","비기능요구사항3"]}
`,
    implementation: `
SW사업 ISP 전문가. JSON만 응답. 한국어.
아래 정보를 바탕으로 정보화전략계획서의 "구현 전략 및 추진 로드맵" 섹션을 작성하라.

시스템명: ${systemName}
개요: ${overview}
기능수: ${functions.length}개

{"title":"구현 전략 및 추진 로드맵","strategy":"구현 전략 200자","phases":[{"phase":"1단계","period":"1~3개월","tasks":["과제1","과제2"],"deliverables":["산출물1"]},{"phase":"2단계","period":"4~6개월","tasks":["과제1","과제2"],"deliverables":["산출물1"]},{"phase":"3단계","period":"7~9개월","tasks":["과제1","과제2"],"deliverables":["산출물1"]}],"risks":["리스크1","리스크2","리스크3"],"successFactors":["성공요인1","성공요인2"]}
`,
  };

  return sectionPrompts[section] || sectionPrompts.background;
};
