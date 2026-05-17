// ============================================================
// fp-system systemPrompt.js - 완전 재작성
// 목적: RFP/기능정의서 → 정확한 기능목록 → FP 산정
// ============================================================

// ── FP 기준 상수 ─────────────────────────────────────────────
export const FP_CORE = `SW사업 대가산정 기준(IFPUG CPM 4.3.1):
ILF=내부논리파일(7/10/15pt), EIF=외부인터페이스(5/7/10pt)
EI=입력(3/4/6pt), EO=출력(4/5/7pt), EQ=조회(3/4/6pt)`;

export const FP_WEIGHTS_TABLE = `복잡도 가중치:
EI: L=3 M=4 H=6 | EO: L=4 M=5 H=7 | EQ: L=3 M=4 H=6
ILF: L=7 M=10 H=15 | EIF: L=5 M=7 H=10`;

// ── 단계1: 문서 분석 + 기능 생성 프롬프트 ────────────────────
// 1-1. 문서에서 사업 정보 추출
export const getProjectInfoPrompt = (text) => `
공공SW사업 BA 15년 전문가. 문서에서 구축 시스템 정보 추출. JSON만.

문서:
${text.slice(0, 3000)}

{"systemName":"","systemOverview":"","projectType":"SW개발|ISP|컨설팅|혼합","mainUsers":[""],"coreRequirements":["핵심 요구사항 원문 (최대 20개)"]}
`;

// 1-2. 요구사항 수집 (청크별)
export const getRequirementCollectPrompt = (chunkText, chunkIdx, systemName) => `
공공SW사업 BA 전문가. "${systemName}" 시스템의 기능 요구사항만 수집. JSON만.

## 수집 대상 (사용자가 시스템에서 직접 수행하는 업무)
- FR-xxx, CNR-xxx, REQ-xxx 등 코드형
- "~해야 한다", "~기능 제공", "~처리", "~관리" 서술형
- 등록/조회/수정/삭제/승인/반려/처리 등 업무 행위

## 절대 제외
- 사업자 수행 과업 (현황분석, 전략수립, 보고서 작성, 인터뷰 수행)
- 행정 절차 (납품, 검수, 평가기준)
- 하드웨어/네트워크 구축

청크 ${chunkIdx}:
${chunkText}

{"requirements":["요구사항 원문"]}
`;

// 1-3. 도메인 분류
export const getDomainClassifyPrompt = (requirements, systemName, description, mainUsers, projectType, userInput) => `
공공SW사업 BA 전문가. 요구사항을 "${systemName}" 시스템의 업무 도메인(LV1)으로 분류. JSON만.

시스템: ${systemName}
설명: ${description}
사용자: ${mainUsers.join(', ')}
유형: ${projectType}
${userInput ? `추가 설명: ${userInput}` : ''}

요구사항 (${requirements.length}개):
${requirements.slice(0, 60).map((r, i) => `${i+1}. ${r}`).join('\n')}

## 분류 규칙
- LV1은 실제 사용자 메뉴 대분류 기준 (5~10개)
- 요구사항이 없는 도메인 생성 금지
- 공통기능(사용자/권한/시스템관리) 항상 포함
- SW개발: 업무 도메인 기반
- ISP/컨설팅: 구축 결과물(시스템) 기준으로만

{"domains":[{"lv1":"","description":"","requirements":["관련요구사항"],"expectedLv2":["예상LV2"]}]}
`;

// 1-4. 도메인별 기능 확장 (Few-shot 포함 최강 버전)
export const getDomainExpandPrompt = (domain, systemName, mainUsers) => `
공공SW사업 BA 전문가. "${systemName}" > "${domain.lv1}" 업무영역 기능목록 생성. JSON만.

## 핵심 판단 기준
"로그인한 사용자가 이 화면의 버튼을 클릭하는가?"
YES → 포함 | NO (컨설팅 과업, 방법론) → 제외

## CRUD 확장 규칙 (반드시 준수)
- 데이터 관리: 등록/수정/삭제/목록조회/상세조회
- 처리 업무: 제출/승인/반려/확정/취소/처리이력조회
- 조회 전용: 목록조회/상세조회/검색/조건조회
- 통계/보고: 통계조회/현황조회/집계출력/보고서출력

## LV3 작성 규칙
- [명사]+[동사]: "출입신청 등록", "승인 처리"
- 15자 이내, 한국어, 코드번호 금지

## Few-shot 예시

### 예시1: 출입신청관리 > 출입신청
요구사항: "출입신청서 작성/제출/승인"
→ 출입신청 등록, 출입신청 수정, 출입신청 삭제, 출입신청 목록조회,
   출입신청 상세조회, 출입신청 제출, 출입신청 취소, 출입신청 현황조회

### 예시2: 승인처리관리 > 출입승인
요구사항: "담당자 승인/반려"
→ 승인대기 목록조회, 신청 상세조회, 승인 처리, 반려 처리,
   조건부승인 처리, 승인이력 조회, 승인현황 통계

### 예시3: 공통기능 > 사용자관리
→ 사용자 등록, 사용자 수정, 사용자 삭제, 사용자 목록조회,
   사용자 상세조회, 비밀번호 초기화, 계정 활성/비활성, 사용자 권한조회

## 생성 대상
LV1: ${domain.lv1}
설명: ${domain.description}
사용자: ${mainUsers.join(', ')}
관련 요구사항:
${(domain.requirements||[]).slice(0,15).map(r=>`- ${r}`).join('\n')}
예상 LV2: ${(domain.expectedLv2||[]).join(', ')}

## 생성 기준
- LV2: 4~7개
- 각 LV2당 LV3: 6~10개 (CRUD 완전 적용)
- 최소 30개 이상 생성 필수
- definition: "~을 ~한다" 20자 이내

{"functions":[{"lv1":"${domain.lv1}","lv2":"","lv3":"","definition":""}]}
`;

// ── 단계2: 영역 추가 제안 프롬프트 ──────────────────────────
export const getAreaSuggestPrompt = (systemName, rfpText, functions, targetCount) => {
  const currentLV1 = [...new Set(functions.map(f => f.lv1))];
  const currentLV2 = [...new Set(functions.map(f => f.lv2))];
  const currentCount = functions.length;
  const rfpSnippet = rfpText.slice(0, 2000);

  return `공공SW사업 BA 전문가. 기능목록 확장을 위한 추가 업무 영역 제안. JSON만.

시스템: ${systemName}
현재 기능 수: ${currentCount}개 (목표: ${targetCount}개, 부족: ${targetCount - currentCount}개)
현재 LV1 (${currentLV1.length}개): ${currentLV1.join(', ')}
현재 LV2 (${currentLV2.length}개): ${currentLV2.slice(0,20).join(', ')}

RFP/문서 내용:
${rfpSnippet}

## 제안 기준
1. 현재 기능에 없는 업무 영역
2. 이 시스템에서 실제로 필요할 가능성이 높은 것
3. 각 영역 추가 시 생성 가능한 예상 기능 수 포함
4. 5~10개 영역 제안
5. expectedFunctions: 실제로 생성 가능한 현실적 수치 (LV2수×8 기준, 최대 80)

{"suggestions":[{
  "lv1":"업무영역명",
  "description":"이 영역이 필요한 이유",
  "expectedFunctions":40,
  "sampleLv2":["예상LV2-1","예상LV2-2","예상LV2-3","예상LV2-4","예상LV2-5"],
  "relatedRequirement":"관련 요구사항 또는 근거"
}],"analysis":"현재 기능목록 분석 요약"}`;
};

// 선택된 영역 기능 확장 (영역 추가용)
export const getAreaExpandPrompt = (area, systemName, existingLV2s, sameLV1LV3s) => {
  // existingLV2s: 전체 기존 LV2 목록 (이 LV2들은 이미 있음)
  // sameLV1LV3s: 같은 LV1 안의 기존 LV3 목록만 (중복 방지용, 최대 50개)
  return `공공SW사업 BA 전문가. "${systemName}" > "${area.lv1}" 영역 기능목록 생성. JSON만.

## 기존 LV2 현황 (참고용 - 이미 존재하는 LV2)
${existingLV2s.slice(0, 30).join(', ')}

## 같은 LV1("${area.lv1}") 안의 기존 LV3 (중복 생성 금지)
${sameLV1LV3s.slice(0, 50).join(', ') || '없음'}

## 생성 전략
1. 위 기존 LV2와 다른 새로운 LV2 우선 생성
2. 기존 LV2가 있더라도 누락된 CRUD 기능이 있으면 추가
3. 기존 LV3와 동일한 기능명은 생성 금지

## 생성 대상
영역: ${area.lv1}
설명: ${area.description}
예상 LV2: ${(area.sampleLv2||[]).join(', ')}

## CRUD 완전 적용 (각 LV2마다)
등록 / 수정 / 삭제 / 목록조회 / 상세조회 / 처리(업무특화) / 통계/현황

## 출력 규칙
- LV2: 5~8개 생성 (새로운 업무 단위 중심)
- LV3: LV2당 6~10개
- 최소 40개 이상 생성 필수
- definition: "~을 ~한다" 20자 이내

{"functions":[{"lv1":"${area.lv1}","lv2":"","lv3":"","definition":""}]}`;
};

// ── FP 산정 프롬프트 ─────────────────────────────────────────
export const getFPPrompt = (functions) => {
  const compact = functions.map((f, i) => ({
    i,
    l2: f.lv2,
    l3: f.lv3.slice(0, 15),
  }));
  return `${FP_CORE}
${FP_WEIGHTS_TABLE}

## FP 유형 분류 기준
- ILF: 시스템이 유지/관리하는 내부 데이터 그룹 (LV2 단위 1개)
- EIF: 외부 시스템 참조 데이터
- EI: 데이터 입력/수정/삭제 (등록,수정,삭제,처리,승인,반려,제출,확정)
- EO: 데이터 가공 출력 (통계,보고서,집계,출력,현황)
- EQ: 단순 조회 (조회,검색,목록,상세,확인)

## 규칙
- 입력 ${compact.length}개 전부 출력 필수 (idx=i값 그대로)
- lv1/lv2/lv3 생략해서 응답 최소화
- ILF는 LV2당 1개 배정 (EI/EO/EQ 기능들과 별도)

${JSON.stringify(compact)}

{"fpList":[{"idx":0,"fpType":"EI","ftr":1,"det":5,"reuseType":"신규개발"}]}`;
};

// ── 기능정의서 파싱 프롬프트 (docx/pdf용) ───────────────────
export const getDocParsePrompt = (text) => `
공공SW사업 BA 전문가. 문서에서 LV1/LV2/LV3 기능목록 추출. JSON만.

## 추출 규칙
- LV1: 업무 대분류
- LV2: 업무 중분류  
- LV3: 단위 기능 (화면/버튼 단위)
- definition: 기능 설명

문서:
${text.slice(0, 3000)}

{"functions":[{"lv1":"","lv2":"","lv3":"","definition":""}]}
`;
