/* eslint-disable no-useless-escape */

// FP 산정 핵심 규칙 (공통 - 간결하게)
const FP_CORE = `FP전문가. IFPUG CPM ISO/IEC 20926 기준.
EI=등록/수정/삭제/설정/승인/업로드/일괄등록(ILF유지)
EO=통계/보고서/그래프/집계/계산현황(수학공식/파생데이터포함)
EQ=목록조회/상세조회/검색/다운로드/로그인/공간정보연동(단순출력,계산없음)
제외=로그아웃/코드/임시/이력/첨부
ILF=내부유지데이터그룹 EIF=외부참조데이터그룹
공통컴포넌트(로그인/권한/코드/메뉴관리)=수정없이재사용
EIF외부연계=기능변경측정대상아님`;

// FP 가중치 테이블 (간결하게)
const FP_WEIGHTS = `EI복잡도(FTR/DET): 0-1/1-4=3, 0-1/5-15=3, 0-1/16+=4, 2/1-4=3, 2/5-15=4, 2/16+=6, 3+/1-4=4, 3+/5-15=6, 3+/16+=6
EO복잡도(FTR/DET): 0-1/1-5=4, 0-1/6-19=4, 0-1/20+=5, 2-3/1-5=4, 2-3/6-19=5, 2-3/20+=7, 4+/1-5=5, 4+/6-19=7, 4+/20+=7
EQ복잡도(FTR/DET): 1/1-5=3, 1/6-19=3, 1/20+=4, 2-3/1-5=3, 2-3/6-19=4, 2-3/20+=6, 4+/1-5=4, 4+/6-19=6, 4+/20+=6
간이법: EI=4.0 EO=5.2 EQ=3.9 ILF=7.5 EIF=5.4`;

// FTR/DET 추론 기준 (간결하게)
const FTR_DET_GUIDE = `검색조건EI:FTR1,DET3-5 | 목록조회EQ:FTR1-3,DET5-20 | 상세조회EQ:FTR1-5,DET10-30
등록EI:FTR1-3,DET10-26 | 수정EI:FTR1-3,DET10-26 | 삭제EI:FTR1,DET3-5
공간정보EQ:FTR1,DET3-5 | 통계/보고서EO:FTR2-5,DET10-30 | 업로드EI:FTR2-6,DET10-20`;

// 재사용유형/영향계수
const REUSE_GUIDE = `신규개발=새기능 | 기능변경=기존수정(변경률25%이하=0.25, 26-50%=0.50, 51-75%=0.75, 76%+=1.00) | 기능삭제=측정비대상 | 수정없이재사용=변경없음`;

// 시스템유형별 특이사항
const SYSTEM_TYPES = `GIS:공간조회=EQ,공간등록=EI,공간분석=EO | DW:ETT=EI,OLAP조회=EQ | ERP:패키지기본=재사용,커스텀=신규/변경 | 모바일:동일기능모바일=별도산정 | 배치:ILF유지=EI,주기다른배치=별도트랜잭션`;

// LV1~LV3 기능목록 생성 (경량 프롬프트)
export const getLV123Prompt = (systemInfo, keyword) => `
${FP_CORE}
JSON만 응답. 한국어.

시스템: ${systemInfo}
키워드: "${keyword}"

"${keyword}" 관련 기능목록 생성.
업무단위별 표준패턴: 검색조건(EI), 목록조회(EQ), 상세조회(EQ), 등록(EI), 수정(EI), 삭제(EI), 공간정보연동(EQ,해당시), 통계(EO,해당시), 승인/처리(EI,해당시)
제외: 로그아웃/코드/임시/이력/첨부, 중복기능
LV2=업무분류, LV3=단위기능명 명확히 구분.

{"functions":[{"lv1":"","lv2":"","lv3":"","definition":""}]}
`;

// FP 산정 프롬프트 (핵심 규칙 모두 포함)
export const getFPPrompt = (functions) => `
${FP_CORE}

복잡도가중치:
${FP_WEIGHTS}

FTR/DET기준:
${FTR_DET_GUIDE}

재사용유형:
${REUSE_GUIDE}

시스템유형:
${SYSTEM_TYPES}

DET제외항목: 고정제목/화면ID/열제목, 시스템생성날짜시간스탬프, 페이지변수/커서위치, 이전/다음/처음/마지막네비게이션, 코드데이터
FTR규칙: 단위프로세스수행중 유지/읽기/참조하는ILF및EIF. 수정+조회동시=1개로만카운트.

아래 기능목록 FP산정:
${JSON.stringify(functions, null, 2)}

각기능: EI/EO/EQ/ILF/EIF분류, FTR숫자, DET숫자, 재사용유형 판별.
JSON만 응답:
{"fpList":[{"lv1":"","lv2":"","lv3":"","definition":"","fpType":"EI또는EO또는EQ또는ILF또는EIF","ftr":1,"det":5,"reuseType":"신규개발또는기능변경또는기능삭제또는수정없이재사용"}]}
`;

// 기능정의서 파싱 프롬프트
export const getParsePrompt = (text) => `
SW기능정의서에서 LV1/LV2/LV3/기능정의 추출.
규칙: 병합셀=위행값사용, LV2=세부업무, LV3=단위기능명, 잘린글자=문맥완성, 중복제거.
JSON만 응답:

${text}

{"functions":[{"lv1":"","lv2":"","lv3":"","definition":""}]}
`;

// 이미지 기반 기능정의서 파싱 프롬프트
export const getParseImagePrompt = () => `
이미지는 SW기능정의서입니다. 표구조인식하여 모든행 추출.
LV1=최상위분류(왼쪽열), LV2=업무분류(2번째열), LV3=단위기능명(3번째열), 기능정의=설명(오른쪽열).
병합셀=해당범위모든행에동일값적용. 흐린글자=문맥추론완성. 중복제거.
JSON만 응답:
{"functions":[{"lv1":"","lv2":"","lv3":"","definition":""}]}
`;

// 시스템 개요 파싱 프롬프트
export const getSystemInfoPrompt = (text) => `
아래 문서에서 시스템 정보 추출. JSON만 응답:
${text}
{"systemName":"","overview":"","mainFunctions":[],"relatedOrgs":[],"keywords":[]}
`;

// 이미지 기반 시스템 개요 파싱
export const getSystemInfoImagePrompt = () => `
이미지는 시스템개요 문서. 시스템명/개요/주요기능/관련기관/업무키워드 추출. JSON만 응답:
{"systemName":"","overview":"","mainFunctions":[],"relatedOrgs":[],"keywords":[]}
`;