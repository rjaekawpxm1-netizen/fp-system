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
export const getFPPrompt = (functions) => `
${FP_CORE}
${FP_WEIGHTS}

산정순서: 1)ILF먼저(업무당1개이상) 2)EIF(외부연동) 3)EI/EO/EQ
ILF lv2="(데이터)", EIF lv2="(외부연계)"
EI복잡도: FTR≤1→L, FTR=2/DET≤4→L, FTR=2/DET5-15→A, FTR=2/DET16+→H, FTR3+/DET5+→H
JSON만 응답:
${JSON.stringify(functions.slice(0,30))}

{"fpList":[{"lv1":"","lv2":"","lv3":"","definition":"","fpType":"ILF","ftr":1,"det":10,"reuseType":"신규개발"}]}
`;

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
// RFP → 100개 기능목록 생성 파이프라인 프롬프트
// ══════════════════════════════════════════════════════════════

// 2단계: 청크에서 원문 요구사항 수집
export const getRFPChunkCollectPrompt = (chunkText, chunkIdx) => `
SW사업 BA전문가. RFP 청크에서 요구사항 항목을 원문 그대로 수집. JSON만.

수집 대상 (형식 무관):
- 코드형: FR-xxx, CNR-xxx, REQ-xxx, SFR-xxx, NFR-xxx, 1.1, 2.3.1 등
- 서술형: "~해야 한다", "~기능을 제공", "~구현", "~처리", "~관리"
- 업무명: 등록, 조회, 수정, 삭제, 승인, 반려, 처리, 분석, 보고 등이 포함된 문장

제외: 사업 일정, 제안서 양식, 평가기준, 납품물 목록

RFP 청크 ${chunkIdx}:
${chunkText}

{"requirements":["요구사항 원문1","요구사항 원문2"]}
`;

// 3단계: 수집된 요구사항 → 도메인(LV1) 분류
export const getRFPDomainPrompt = (requirements, systemName, overview) => `
SW사업 BA전문가. 수집된 요구사항을 업무 도메인(LV1)으로 분류. JSON만.

시스템명: ${systemName}
개요: ${overview}

요구사항 목록:
${requirements.slice(0, 60).map((r, i) => `${i + 1}. ${r}`).join('\n')}

규칙:
- LV1은 5~8개 (업무 대분류)
- 공통기능은 반드시 포함 (사용자/권한/시스템)
- ISP/컨설팅이면 분석관리, 전략관리 등도 포함
- 각 도메인에 해당 요구사항 번호 매핑

{"systemName":"","overview":"","domains":[{"lv1":"업무영역명","description":"영역 설명","requirements":["관련 요구사항 원문"],"expectedLv2":["예상 LV2 목록"]}]}
`;

// 4단계: 도메인별 기능 확장 (CRUD 완전 적용)
export const getRFPDomainExpandPrompt = (domain, systemName) => `
SW사업 BA전문가. 업무 도메인의 기능목록을 완전하게 생성. JSON만.

시스템명: ${systemName}
도메인(LV1): ${domain.lv1}
도메인 설명: ${domain.description}
관련 요구사항:
${(domain.requirements || []).slice(0, 15).join('\n')}
예상 LV2: ${(domain.expectedLv2 || []).join(', ')}

생성 규칙:
1. LV2는 4~6개 생성
2. 각 LV2마다 LV3 최소 5개 (등록/수정/삭제/목록조회/상세조회 기본 + 업무특화 추가)
3. 승인/반려/처리/확정 등 업무흐름 LV3 별도 생성
4. 집계/통계/보고서 기능도 포함
5. definition은 "~을 ~한다" 형식 15자 이내
6. 최소 25개 이상 생성 필수

{"functions":[{"lv1":"${domain.lv1}","lv2":"","lv3":"","definition":""}]}
`;
