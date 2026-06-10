// ============================================================
// fp-system systemPrompt.js - 개정판
// 핵심 변경:
//  ① getDomainClassifyPrompt: 목표기능수 블록 이스케이프 버그 수정
//     (기존엔 \${...}로 이스케이프되어 평가되지 않은 리터럴 문자열이
//      프롬프트에 그대로 삽입되고 있었음)
//  ② getDomainExpandPrompt: "최소 40개 이상 필수" 제거 → 근거 기반 생성.
//     개수 강제는 기능수 인플레(313개 vs 적정 169개)의 직접 원인이었음.
//  ③ getFPPrompt 삭제 → getFPClassifyPrompt: AI는 유형분류+참조그룹만.
//     FTR/DET 숫자는 fpDerivation.js의 규칙표가 결정 (재현성+감리방어).
//  ④ getDataGroupPrompt 신설: ILF/EIF를 메뉴(LV2) 단위가 아니라
//     논리 데이터그룹 단위로 도출.
// ============================================================

export const FP_CORE = `SW사업 대가산정 기준(IFPUG CPM 4.3.1):
ILF=내부논리파일(7/10/15pt), EIF=외부인터페이스(5/7/10pt)
EI=입력(3/4/6pt), EO=출력(4/5/7pt), EQ=조회(3/4/6pt)`;

export const FP_WEIGHTS_TABLE = `복잡도 가중치:
EI: L=3 M=4 H=6 | EO: L=4 M=5 H=7 | EQ: L=3 M=4 H=6
ILF: L=7 M=10 H=15 | EIF: L=5 M=7 H=10`;

// ── 1. 프로젝트 정보 추출 ─────────────────────────────────────
export const getProjectInfoPrompt = (text) => `
당신은 공공SW사업 BA 전문가입니다. 아래 문서에서 구축 대상 시스템 정보를 추출하세요. JSON만 출력.

문서:
${text.slice(0, 4000)}

출력 형식:
{"systemName":"시스템명","systemOverview":"시스템 목적과 주요 기능 2~3줄 요약","projectType":"SW개발|ISP|컨설팅|혼합","mainUsers":["주요사용자1","주요사용자2"],"coreRequirements":["핵심요구사항1","핵심요구사항2"]}
`;

// ── 2. 요구사항 수집 ──────────────────────────────────────────
export const getRequirementCollectPrompt = (chunkText, chunkIdx, systemName) => `
당신은 공공SW사업 BA 전문가입니다. "${systemName}" 시스템의 기능 요구사항을 수집하세요. JSON만 출력.

## 포함 대상 (사용자가 시스템 화면에서 직접 수행하는 업무)
- FR-xxx, CNR-xxx, REQ-xxx 형태의 코드형 요구사항
- "~해야 한다", "~기능 제공", "~처리", "~관리" 형태의 서술형
- 등록/조회/수정/삭제/승인/반려/처리 등의 업무 행위

## 제외 대상
- 사업자 수행 과업 (현황분석, 전략수립, 보고서 작성)
- 행정 절차 (납품, 검수, 평가기준)
- 하드웨어/네트워크/인프라 구축
- 기술 방법론 (AI/ML 적용, AIOps, 클라우드 전환, 아키텍처 설계)
- "~자동화 구현", "~지능화" 형태의 기술 목표

문서 청크 ${chunkIdx}:
${chunkText}

{"requirements":["요구사항 원문 그대로"]}
`;

// ── 3. 도메인 분류 ────────────────────────────────────────────
export const getDomainClassifyPrompt = (requirements, systemName, description, mainUsers, projectType, userInput, targetFuncCount = 0) => `
당신은 공공SW사업 BA 전문가입니다. 요구사항을 "${systemName}" 시스템의 업무 도메인(LV1)으로 분류하세요. JSON만 출력.

시스템: ${systemName}
설명: ${description}
사용자: ${mainUsers.join(', ')}
유형: ${projectType}
${userInput ? `추가 설명: ${userInput}` : ''}

요구사항 (${requirements.length}개):
${requirements.slice(0, 120).map((r, i) => `${i + 1}. ${r}`).join('\n')}

## LV1 작성 원칙

LV1 = 시스템 상단 메뉴바의 버튼 이름 (사용자가 클릭하는 메뉴 대분류)

### 실제 공공시스템 LV1 예시
- 전사사업관리시스템: 사업관리 / 내부행정 / 현황분석 / 시스템관리
- 출입관리시스템: 출입신청관리 / 출입승인관리 / 출입현황 / 시스템관리
- 연동관리시스템: 연동관리 / 운영관리 / 관제관리 / 체계관리 / 시스템관리

### 규칙
- LV1 개수: 5~10개 (메뉴바에 들어가는 수준)
- 기술용어(API, SLA, 메타데이터, AIOps)는 LV2로 내리기
- 유사한 업무는 하나의 LV1으로 통합
- 공통기능(사용자/권한/시스템관리) 반드시 포함
${targetFuncCount > 0 ? `
### 목표 기능수: ${targetFuncCount}개 (참고용)
- 이 규모에 맞는 LV1 개수와 범위로 도메인을 구성할 것
- 목표 기능수가 적으면(<150) LV1을 5개 이하로 좁게
- 목표 기능수가 많으면(>300) LV1을 7~10개로 넓게
- 단, 요구사항에 근거가 없는 도메인을 목표 달성을 위해 만들지 말 것` : ''}

### 절대 금지 LV1
❌ 메타데이터관리, SLA관리, 아키텍처설계, AI/ML, AIOps
❌ 클라우드인프라, 실시간스트리밍, 포렌식, 비즈니스연속성

{"domains":[{"lv1":"연동관리","description":"연동 업무 전반 관리","requirements":["관련요구사항"],"expectedLv2":["연동계획관리","연동운영관리"]}]}
`;

// ── 4. 도메인별 기능 확장 ─────────────────────────────────────
export const getDomainExpandPrompt = (domain, systemName, mainUsers) => `
당신은 공공SW사업 BA 전문가입니다. "${systemName}" > "${domain.lv1}" 업무영역의 기능목록을 생성하세요. JSON만 출력.

## 핵심 판단 기준
"로그인한 사용자가 이 화면의 버튼을 클릭하는가?"
YES → 포함 | NO (기술 인프라, 컨설팅 과업) → 제외

## 기능 단위 원칙 (가장 중요)
기능(LV3)의 단위는 elementary process(독립적 업무 처리 단위)다.
- "조회"와 "검색"은 같은 기능이다. 목록조회 하나로 작성할 것 (검색은 목록조회의 조건일 뿐)
- 목록조회와 상세조회는 분리 가능 (처리 화면과 데이터 항목이 다름)
- 승인/반려는 요구사항에 결재 절차가 명시된 경우에만 생성
- 같은 데이터에 대한 동작을 화면 버튼 수만큼 쪼개지 말 것

## 절대 생성 금지
- "~자동화 구현", "~지능화 적용", "~고도화 수행" 형태
- "아키텍처 설계", "인프라 구성", "정책 수립" 형태
- LV3명 = LV2명 (의미 없는 중복)
- 코드번호 포함 (FR-001 등)
- 요구사항에 근거가 없는 기능 (개수를 채우기 위한 생성 금지)

## LV2 작성 (서브메뉴 수준)
- 업무 중분류로 표현 (기술용어 LV2에서는 허용)
- 예: 연동관리 > [연동계획관리] [연동운영관리] [연동현황조회]

## LV3 기본 구성 가이드
- 데이터 관리 LV2: 등록 / 수정 / 삭제 / 목록조회 / 상세조회 (요구사항상 불필요한 동작은 생략)
- 처리 업무 LV2: 처리 / 승인 / 반려 / 이력조회 (결재 절차가 있는 경우만)
- 통계/보고 LV2: 통계조회 / 현황조회 / 출력

## LV3 명칭 규칙 (반드시 준수)
- 형식: [업무명사] + [동사] → "연동합의서 등록", "사용자 목록조회"
- 동사는 반드시 아래 중 하나로 끝낼 것 (한다 붙이지 말 것)
- 등록|수정|삭제|목록조회|상세조회|처리|승인|반려|제출|취소|확정|출력|통계조회|현황조회|이력조회|설정|초기화|활성|비활성|배정|알림|업로드|다운로드
- ❌ 금지: "~등록한다", "~조회한다" (동사 뒤 "한다" 붙이지 말 것)
- ❌ 금지: "검색" 단독 사용 (목록조회에 포함)
- ❌ 금지: LV3가 LV2와 동일한 이름

## 기능정의(definition) 규칙
- "~을 ~한다" 형식으로 LV3보다 구체적으로 작성
- LV3명을 그대로 복붙하지 말 것
- 예시:
  LV3: "연동합의서 등록" → definition: "연동 대상 시스템 간 합의서를 등록한다"
  LV3: "사용자 목록조회" → definition: "등록된 사용자 목록을 조건별로 조회한다"
  LV3: "통계 조회" → definition: "기간/체계별 연동 통계를 집계하여 조회한다"

## Few-shot 예시

### 예시1: 연동관리 > 연동합의서관리 (결재 절차가 요구사항에 있는 경우)
→ 연동합의서 등록 (연동 대상 시스템 간 합의서를 등록한다)
  연동합의서 수정 (등록된 합의서 내용을 수정한다)
  연동합의서 삭제 (불필요한 합의서를 삭제한다)
  연동합의서 목록조회 (전체 연동합의서 목록을 조건별로 조회한다)
  연동합의서 상세조회 (선택한 합의서 상세 내용을 조회한다)
  연동합의서 승인 (제출된 합의서를 검토하고 승인한다)
  연동합의서 반려 (승인 불가한 합의서를 반려 처리한다)

### 예시2: 연동운영 > 연동현황조회
→ 연동종합현황 조회 (체계별 연동 종합 현황을 조회한다)
  연동통계 조회 (기간/체계별 연동 통계를 조회한다)
  연동보고서 출력 (일일/주간/월간 연동 보고서를 출력한다)

### 예시3: 시스템관리 > 사용자관리
→ 사용자 등록 (신규 사용자 정보를 시스템에 등록한다)
  사용자 수정 (기존 사용자 정보를 수정한다)
  사용자 삭제 (탈퇴 또는 불필요한 사용자를 삭제한다)
  사용자 목록조회 (등록된 사용자 목록을 조회한다)
  사용자 상세조회 (선택한 사용자 상세정보를 조회한다)
  비밀번호 초기화 (사용자 비밀번호를 초기화한다)

## 생성 대상
LV1: ${domain.lv1}
설명: ${domain.description}
사용자: ${mainUsers.join(', ')}
관련 요구사항 (이 요구사항에 맞는 기능을 생성할 것):
${(domain.requirements || []).slice(0, 15).map(r => `- ${r}`).join('\n')}
예상 LV2: ${(domain.expectedLv2 || []).join(', ')}

## 생성 기준
- LV2: 요구사항에서 도출된 것 우선, 통상 3~7개
- LV2당 LV3: 업무에 실제 필요한 수만큼 (통상 3~7개)
- 개수 목표 없음 — 요구사항 근거가 있는 기능만 생성할 것

{"functions":[{"lv1":"${domain.lv1}","lv2":"","lv3":"","definition":""}]}
`;

// ── 5. 영역 추가 제안 ─────────────────────────────────────────
export const getAreaSuggestPrompt = (systemName, rfpText, functions, targetCount, upgradeMode = false) => {
  const currentLV1 = [...new Set(functions.map(f => f.lv1))];
  const currentLV2 = [...new Set(functions.map(f => f.lv2))];
  const currentCount = functions.length;
  const rfpSnippet = (rfpText || '').slice(0, 15000);

  const reuseFuncs = functions.filter(f => f.reuseType === '재사용' || f.reuseType === '기능변경');
  const newFuncs = functions.filter(f => !f.reuseType || f.reuseType === '신규개발');
  const reuseLV1 = [...new Set(reuseFuncs.map(f => f.lv1))];
  const newLV1 = [...new Set(newFuncs.map(f => f.lv1))];

  const reqLines = (rfpText || '').split('\n')
    .filter(l => /기능|업무|처리|관리|제공|구현|지원|연동|조회|등록/.test(l) && l.trim().length > 10)
    .slice(0, 30)
    .map(l => l.trim().slice(0, 80));

  return `당신은 공공SW사업 BA 전문가입니다. 기능목록에서 누락된 업무 영역을 제안하세요. JSON만 출력.

시스템: ${systemName}
현재 기능 수: ${currentCount}개 (목표: ${targetCount}개)
${upgradeMode ? `
[고도화 모드]
- 기존 기능(재사용/변경): ${reuseFuncs.length}개 → LV1: ${reuseLV1.join(', ')}
- 신규 추가 기능: ${newFuncs.length}개 → LV1: ${newLV1.join(', ')}
- 제안 우선순위: 기존에 없는 완전 신규 영역 위주` : ''}

현재 LV1 (${currentLV1.length}개): ${currentLV1.join(', ')}
현재 LV2 (${currentLV2.length}개): ${currentLV2.slice(0, 50).join(', ')}

RFP 핵심 요구사항:
${reqLines.length > 0 ? reqLines.map((l, i) => `${i + 1}. ${l}`).join('\n') : '(문서 없음)'}

RFP 전체:
${rfpSnippet}

## 제안 기준 (반드시 준수)
1. RFP에 명시된 요구사항인데 현재 기능목록에 없는 영역만 제안
2. relatedRequirement에 RFP 실제 문장을 인용할 것 — 인용할 문장이 없으면 그 영역은 제안하지 말 것
3. 목표 기능수를 채우기 위한 근거 없는 영역 제안 금지
4. 제안할 영역이 없으면 빈 배열을 반환할 것 (없는 것이 정상일 수 있음)
5. expectedFunctions: 실제 필요한 기능 수 추정 (LV2 수 × 5 내외, 최대 40)

{"suggestions":[{
  "lv1":"업무영역명",
  "description":"필요한 이유 (RFP 근거 포함)",
  "expectedFunctions":25,
  "sampleLv2":["LV2-1","LV2-2","LV2-3"],
  "relatedRequirement":"RFP 원문 인용 (필수)"
}],"analysis":"현재 기능목록 분석 요약"}`;
};

// ── 6. 영역 확장 ──────────────────────────────────────────────
export const getAreaExpandPrompt = (area, systemName, existingLV2s, sameLV1LV3s) => `
당신은 공공SW사업 BA 전문가입니다. "${systemName}" > "${area.lv1}" 영역의 기능목록을 생성하세요. JSON만 출력.

## 기존 LV2 (이미 존재 - 참고용)
${existingLV2s.slice(0, 30).join(', ')}

## 같은 LV1 내 기존 LV3 (중복 금지)
${sameLV1LV3s.slice(0, 50).join(', ') || '없음'}

## 생성 전략
1. 기존 LV2와 다른 새로운 LV2만 생성
2. 기능 단위는 elementary process — "검색"을 목록조회와 별도로 만들지 말 것
3. LV3는 등록|수정|삭제|목록조회|상세조회|처리|승인|반려|출력|설정 중 하나로 끝낼 것
4. "~자동화", "~지능화" 형태 LV3 금지
5. 개수 목표 없음 — 이 영역의 업무에 실제 필요한 기능만 생성

## 생성 대상
영역: ${area.lv1}
설명: ${area.description}
예상 LV2: ${(area.sampleLv2 || []).join(', ')}

- LV2: 통상 3~7개
- LV2당 LV3: 업무에 실제 필요한 수만큼 (통상 3~7개)

{"functions":[{"lv1":"${area.lv1}","lv2":"","lv3":"","definition":""}]}`;

// ── 7. FP 유형 분류 (FTR/DET 산정 아님 — 분류만) ──────────────
// 기존 getFPPrompt를 대체한다.
// AI는 ① fpType(EI/EO/EQ) ② 이 기능이 참조하는 데이터그룹 이름만 출력.
// FTR/DET 숫자는 fpDerivation.js의 결정론적 규칙표가 산출한다.
export const getFPClassifyPrompt = (functions, dataGroupNames = []) => {
  const compact = functions.map((f, i) => ({
    i, l2: f.lv2, l3: (f.lv3 || '').slice(0, 25),
  }));
  return `공공SW 기능점수 유형 분류 작업입니다. JSON만 출력.

## fpType 분류 기준
- EI: 등록,수정,삭제,처리,승인,반려,제출,확정,설정,업로드,배정,초기화,활성,비활성 → 데이터 입력/변경
- EO: 통계,보고서,집계,출력,현황,그래프,분석,다운로드 → 파생/가공 데이터 출력
- EQ: 목록조회,상세조회,검색,확인,이력조회 → 저장된 데이터 단순 조회

## refGroups: 이 기능이 읽거나 쓰는 데이터그룹 이름 (1~3개)
- 기능이 다루는 주 데이터 1개는 반드시 포함 (예: "사용자 등록" → ["사용자"])
- 처리 중 함께 참조하는 데이터가 명확할 때만 추가 (예: "합의서 승인" → ["연동합의서","결재이력"])
- 통계/현황은 집계 대상 데이터를 나열 (예: "연동통계 조회" → ["연동이력","연동체계"])
- 확실하지 않으면 주 데이터 1개만. 부풀리지 말 것.
${dataGroupNames.length > 0 ? `- 가능하면 다음 데이터그룹 명칭을 사용: ${dataGroupNames.slice(0, 30).join(', ')}` : ''}

## 출력 규칙
- 입력 ${compact.length}개 전부 출력 필수, idx는 입력의 i값 그대로
- 설명/주석 없이 JSON만

${JSON.stringify(compact)}

{"fpList":[{"idx":0,"fpType":"EI","refGroups":["사용자"]}]}`;
};

// ── 8. 데이터그룹(ILF/EIF) 도출 ───────────────────────────────
// 기존의 "LV2당 ILF 1개 자동배정"을 대체한다.
// ILF는 메뉴가 아니라 논리적 데이터그룹 단위다 — 메뉴 단위 배정은
// 같은 엔터티(예: 사용자)를 여러 번 계상해 FP를 부풀린다.
export const getDataGroupPrompt = (functions, systemName, rfpSnippet = '') => {
  const lv1lv2 = [...new Set(functions.map(f => `${f.lv1} > ${f.lv2}`))];
  return `공공SW 기능점수 데이터 기능(ILF/EIF) 도출 작업입니다. JSON만 출력.

시스템: ${systemName}

## 기능 구조 (LV1 > LV2)
${lv1lv2.slice(0, 80).join('\n')}
${rfpSnippet ? `\n## RFP 발췌 (외부 연동체계 식별용)\n${rfpSnippet.slice(0, 5000)}` : ''}

## ILF (내부논리파일) 도출 원칙
- ILF = 이 시스템이 직접 생성/수정하는 "논리적 데이터그룹" (엔터티 군)
- 메뉴 단위가 아니다. 여러 LV2가 같은 데이터그룹을 공유할 수 있다
  (예: 사용자관리/권한관리 → 동일 ILF "사용자")
- 통상 중형 시스템 기준 8~20개. 그 이상이면 그룹핑을 다시 검토할 것
- ret: 레코드 서브그룹 수 (단순 엔터티=1, 마스터+상세=2, 복합=3+)
- det: 주요 데이터 항목 수 추정 (10~30 통상)
- relatedLv2: 이 데이터를 다루는 LV2 목록 (근거)

## EIF (외부연계파일) 도출 원칙
- EIF = 외부 시스템이 관리하고 이 시스템은 참조만 하는 데이터
- RFP에 명시된 연동 대상만. source에 RFP 근거 문장을 인용할 것
- 근거 문장이 없으면 생성하지 말 것

{"ilf":[{"name":"사용자","ret":1,"det":15,"relatedLv2":["사용자관리","권한관리"]}],
"eif":[{"name":"행정망 인사정보","ret":1,"det":10,"source":"RFP 근거 문장"}]}`;
};

// ── 9. 기능정의서 파싱 ────────────────────────────────────────
export const getDocParsePrompt = (text) => `
당신은 공공SW사업 BA 전문가입니다. 아래 문서에서 LV1/LV2/LV3 기능목록을 추출하세요. JSON만 출력.

## 추출 규칙
- LV1: 업무 대분류 (메뉴바 수준)
- LV2: 업무 중분류 (서브메뉴 수준)
- LV3: 단위 기능 (화면/버튼 단위)
- definition: 기능 설명 한 줄

문서:
${text.slice(0, 4000)}

{"functions":[{"lv1":"","lv2":"","lv3":"","definition":""}]}
`;
