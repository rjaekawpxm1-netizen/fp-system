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
SW사업 BA전문가. RFP에서 "구축할 시스템의 기능요구사항"만 추출해서 LV1/LV2/LV3으로 변환. JSON만.

## 핵심 규칙
1. 추출 대상: 발주기관이 구축을 요구하는 SW 시스템의 기능
   예) "출입신청 기능을 제공해야 한다" → 출입신청관리 > 출입신청 > 출입신청 등록
   예) "승인/반려 처리 기능" → 출입신청관리 > 승인처리 > 승인처리 등록

2. 추출 제외 (이런 것들은 과업/컨설팅이지 SW기능이 아님):
   - "현황분석", "ISP수립", "전략수립", "계획수립" 등 컨설팅 과업
   - "제안서", "평가기준", "제출서류" 등 사업 행정 절차
   - "사업자가 해야 할 일" (수행사 의무사항)

3. FR-xxx, NFR-xxx 형태의 기능요구사항이 있으면 우선 활용

4. LV3는 반드시 한국어, 코드번호 제외
   예) "FR-001-C: 출입신청서 생성" → LV3: "출입신청 등록"

5. CRUD 패턴 적용: 등록/수정/삭제/목록조회/상세조회

6. 공통기능 추가: 사용자관리, 권한관리, 시스템관리

## 판단 기준
"이 기능이 완성된 SW 시스템에서 사용자가 클릭하는 화면/버튼인가?"
→ YES: 포함
→ NO (분석/계획/문서작성): 제외

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

// ── ❌ 요구사항 재생성 (Tier1 최적화) ───────────────────────
export const getRegenFromReqPrompt = (failedReqs, systemInfo, existingFunctions) => {
  const existingLV2 = [...new Set(existingFunctions.map(f => f.lv2))].slice(0, 20).join(',');
  const reqs = failedReqs.slice(0, 5).map((r, i) => `${i+1}.${r.req}`).join('\n');
  return `BA전문가. JSON만.
시스템:${systemInfo}
기존LV2:${existingLV2}
미반영요구사항→LV1/LV2/LV3변환(CRUD패턴,중복제외):
${reqs}
{"functions":[{"lv1":"","lv2":"","lv3":"","definition":"","fromReq":""}]}`;
};

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
