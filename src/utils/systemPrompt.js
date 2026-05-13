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
  // RFP 핵심만 1000자
  const rfp = rfpText.slice(0, 1000);
  // 기능목록 lv2>lv3 형식으로 최대 40개
  const funcs = functions.slice(0, 40).map(f => `${f.lv2}>${f.lv3}`).join('\n');
  return `BA검토전문가. JSON만.
RFP: ${rfp}
기능(${functions.length}개): ${funcs}
검증: 요구사항반영여부/CRUD누락/공통기능/누락기능추천
{"coverage":{"score":0,"items":[{"req":"","status":"✅","functions":[],"comment":""}]},"crudCheck":[{"lv2":"","missing":[],"ok":[]}],"commonCheck":{"userMgmt":true,"authMgmt":true,"sysMgmt":true},"suggestions":[{"lv1":"","lv2":"","lv3":"","definition":"","reason":""}],"summary":""}`;
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
// RFP → 시스템별 기능목록 생성 파이프라인 프롬프트 (최강 버전 v5)
// 설계원칙: Few-shot 5쌍 + Chain-of-Thought + Role + Constraint + 출력포맷 고정
// ══════════════════════════════════════════════════════════════

// 0단계: 시스템 탐지 + 사업 유형 판단
export const getRFPSystemDetectPrompt = (text) => `
당신은 15년 경력의 공공 SW사업 BA(업무분석가) 전문가입니다.
아래 RFP에서 "실제로 구축할 SW 시스템"을 탐지하고, 사업 유형을 판단하세요.

## 사업 유형 판단 기준
- ISP: "정보화전략계획", "ISP", "마스터플랜", "정보화기본계획" 키워드
- SW개발: "시스템 구축", "개발", "플랫폼 구축", "포털 구축" 키워드
- 컨설팅: "컨설팅", "진단", "분석", "수립" 키워드 (구축 없음)
- 혼합: ISP + 시스템 구축이 동시에 포함

## 구축 대상 시스템 탐지 기준
포함: 완성 후 사용자가 로그인해서 쓰는 SW 시스템
제외: 컨설팅 산출물, 방법론 과업, 하드웨어, 네트워크

## 판단 절차 (단계별로 생각하세요)
1단계: RFP에서 "구축", "개발", "시스템" 키워드를 찾는다
2단계: 각 키워드 주변 문맥을 읽어 실제 SW 시스템인지 판단한다
3단계: 시스템이 여러 개면 모두 추출한다
4단계: 사업 전체 유형을 판단한다

## 출력 (JSON만, 설명 없음)
RFP:
${text.slice(0, 4000)}

{"projectType":"SW개발|ISP|컨설팅|혼합","systems":[{"systemKey":"영문camelCase","systemName":"한국어명","description":"목적 1문장","mainUsers":["사용자유형"],"coreFeatures":["핵심기능키워드"]}]}
`;

// 2단계: 청크에서 요구사항 수집 (최강 버전)
export const getRFPChunkCollectPrompt = (chunkText, chunkIdx, systemName, coreFeatures) => `
당신은 15년 경력의 공공 SW사업 BA 전문가입니다.
RFP 청크에서 "${systemName}" 시스템의 요구사항을 수집합니다.

## 수집 판단 기준: "사용자가 시스템에서 직접 수행하는 업무인가?"
YES → 수집 (예: 출입신청서 등록, 승인/반려 처리, 현황 조회)
NO  → 제외 (예: 현황분석 수행, 전략 수립, 보고서 작성, 납품물 제출)

## 수집 형식 (모두 처리)
- FR-xxx, CNR-xxx, REQ-xxx, SFR-xxx, UC-xxx 등 코드형
- "~해야 한다", "~할 수 있어야 한다", "~기능 제공" 서술형
- "~관리", "~조회", "~등록", "~처리" 업무명 형태

## 절대 제외
- 사업자 의무사항: "사업자는 ~해야 한다", "수행사는 ~수행"
- 컨설팅 과업: "현황분석", "전략수립", "인터뷰 수행", "보고서 작성"
- 행정 절차: "납품", "검수", "입찰", "평가기준"
- 다른 시스템 요구사항

관련 키워드 (이 키워드 주변을 집중 확인): ${coreFeatures.join(', ')}

RFP 청크 ${chunkIdx}:
${chunkText}

{"requirements":["요구사항 원문 (최대한 원문 그대로)"]}
`;

// 3단계: 도메인 분류 (최강 버전 - few-shot 3쌍 포함)
export const getRFPDomainPrompt = (requirements, systemName, description, mainUsers, projectType) => `
당신은 15년 경력의 공공 SW사업 BA 전문가입니다.
수집된 요구사항을 "${systemName}"의 업무 도메인(LV1)으로 분류합니다.

## 도메인 분류 원칙
1. LV1은 사용자가 실제로 사용하는 "메뉴 대분류" 기준
2. 5~8개 (너무 세분화하거나 너무 광범위하게 묶지 말 것)
3. 공통기능(사용자관리/권한관리/시스템관리)은 항상 마지막에 포함
4. 요구사항이 없는 도메인은 만들지 말 것 ← 핵심 원칙

## 사업유형별 도메인 패턴 참고 (참고만 할 것, 요구사항 없으면 제외)
${projectType === 'ISP' ? `ISP사업: 현황분석관리, 환경분석관리, 아키텍처설계, 이행계획관리, 과제관리, 공통기능` :
  projectType === '컨설팅' ? `컨설팅: 현황조사관리, 분석관리, 전략수립관리, 로드맵관리, 보고서관리, 공통기능` :
  `SW개발: 요구사항에서 업무 대분류 추출, 공통기능 포함`}

## Few-shot 예시

### 예시1: 출입관리시스템
요구사항: ["출입신청서 제출", "관리자 승인/반려", "출입이력 조회", "사용자 등록"]
→ 도메인: [출입신청관리, 승인처리관리, 이력조회관리, 공통기능]

### 예시2: 과제관리시스템
요구사항: ["과제 신청", "과제 심사", "연구비 청구", "실적 등록", "보고서 제출"]
→ 도메인: [과제신청관리, 심사평가관리, 연구비관리, 성과관리, 공통기능]

### 예시3: 인사정보시스템
요구사항: ["직원 정보 등록", "발령 처리", "급여 산정", "휴가 신청", "교육 신청"]
→ 도메인: [인사기본관리, 발령관리, 급여관리, 복무관리, 교육관리, 공통기능]

## 분류 대상
시스템: ${systemName}
설명: ${description}
사용자: ${mainUsers.join(', ')}
사업유형: ${projectType || 'SW개발'}

요구사항 (${requirements.length}개):
${requirements.slice(0, 60).map((r, i) => `${i + 1}. ${r}`).join('\n')}

{"domains":[{"lv1":"도메인명","description":"1줄 설명","requirements":["관련요구사항"],"expectedLv2":["예상LV2"]}]}
`;

// 4단계: 도메인별 기능 확장 (최강 버전 - few-shot 완전판)
export const getRFPDomainExpandPrompt = (domain, systemName, mainUsers, projectType) => `
당신은 15년 경력의 공공 SW사업 BA 전문가입니다.
"${systemName}"의 "${domain.lv1}" 업무영역 기능목록을 생성합니다.

## 핵심 판단 기준 (이것만 기억)
"로그인한 사용자가 이 화면의 버튼을 클릭하는가?"
→ YES: 기능으로 포함
→ NO: 제외

## CRUD 확장 규칙 (반드시 준수)
모든 LV2에 대해 해당하는 LV3를 빠짐없이 생성:
- 데이터 입력 업무: 등록 / 수정 / 삭제 / 목록조회 / 상세조회
- 처리 업무: 처리(승인/반려/확정/취소) / 처리이력 조회
- 조회 업무: 목록조회 / 상세조회 / 검색 / 출력(Excel/PDF)
- 통계 업무: 통계조회 / 현황조회 / 집계출력

## LV3 작성 규칙
- 형식: [명사] + [동사] (예: "출입신청 등록", "승인 처리")
- 코드 번호 절대 포함 금지 (FR-001 같은 것)
- 15자 이내
- 한국어만

## Few-shot 예시 (이 패턴을 반드시 따를 것)

### 예시1: LV1=출입신청관리, LV2=출입신청
관련 요구사항: "출입신청서를 작성하고 제출할 수 있어야 한다"
생성 기능:
- 출입신청관리 > 출입신청 > 출입신청 등록
- 출입신청관리 > 출입신청 > 출입신청 수정
- 출입신청관리 > 출입신청 > 출입신청 삭제
- 출입신청관리 > 출입신청 > 출입신청 목록조회
- 출입신청관리 > 출입신청 > 출입신청 상세조회
- 출입신청관리 > 출입신청 > 출입신청 제출
- 출입신청관리 > 출입신청 > 출입신청 취소

### 예시2: LV1=승인처리관리, LV2=출입승인
관련 요구사항: "담당자가 출입신청을 승인하거나 반려할 수 있어야 한다"
생성 기능:
- 승인처리관리 > 출입승인 > 신청목록 조회
- 승인처리관리 > 출입승인 > 신청 상세조회
- 승인처리관리 > 출입승인 > 승인 처리
- 승인처리관리 > 출입승인 > 반려 처리
- 승인처리관리 > 출입승인 > 승인이력 조회
- 승인처리관리 > 출입승인 > 승인현황 통계

### 예시3: LV1=연구비관리, LV2=연구비청구
관련 요구사항: "연구원이 연구비를 청구하고, 관리자가 검토 후 지급할 수 있어야 한다"
생성 기능:
- 연구비관리 > 연구비청구 > 청구서 등록
- 연구비관리 > 연구비청구 > 청구서 수정
- 연구비관리 > 연구비청구 > 청구서 삭제
- 연구비관리 > 연구비청구 > 청구목록 조회
- 연구비관리 > 연구비청구 > 청구 상세조회
- 연구비관리 > 연구비청구 > 청구서 제출
- 연구비관리 > 연구비청구 > 검토 처리
- 연구비관리 > 연구비청구 > 지급 처리
- 연구비관리 > 연구비청구 > 청구이력 조회

### 예시4: LV1=공통기능, LV2=사용자관리
생성 기능 (항상 포함):
- 공통기능 > 사용자관리 > 사용자 등록
- 공통기능 > 사용자관리 > 사용자 수정
- 공통기능 > 사용자관리 > 사용자 삭제
- 공통기능 > 사용자관리 > 사용자 목록조회
- 공통기능 > 사용자관리 > 사용자 상세조회
- 공통기능 > 사용자관리 > 비밀번호 초기화
- 공통기능 > 사용자관리 > 사용자 활성/비활성

### 예시5: LV1=보고서관리 (ISP/컨설팅 사업)
관련 요구사항: "현황분석 보고서를 작성하고 승인받을 수 있어야 한다"
생성 기능:
- 보고서관리 > 현황분석보고서 > 보고서 작성
- 보고서관리 > 현황분석보고서 > 보고서 수정
- 보고서관리 > 현황분석보고서 > 보고서 목록조회
- 보고서관리 > 현황분석보고서 > 보고서 상세조회
- 보고서관리 > 현황분석보고서 > 보고서 제출
- 보고서관리 > 현황분석보고서 > 보고서 승인
- 보고서관리 > 현황분석보고서 > 보고서 반려
- 보고서관리 > 현황분석보고서 > 보고서 출력

## 절대 금지 사항
- 방법론/컨설팅 과업을 기능으로 만들기 (현황분석 "수행", 전략 "수립" 등)
- 동일한 LV3 중복 생성
- 관련 요구사항에 없는 내용으로 과도하게 확장

## 지금 생성할 도메인
LV1: ${domain.lv1}
설명: ${domain.description}
관련 요구사항:
${(domain.requirements || []).slice(0, 15).map((r, i) => `- ${r}`).join('\n')}
예상 LV2: ${(domain.expectedLv2 || []).join(', ')}

## 생성 규칙 요약
- LV2: 4~6개
- LV3: 각 LV2당 5~9개 (CRUD + 업무특화)
- 최소 총 25개 이상 생성
- definition: "~을 ~한다" 형식, 20자 이내

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
