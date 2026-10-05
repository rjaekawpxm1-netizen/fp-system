// ============================================================
// fp-system systemPrompt.js - 개정판
import { prioritizeRfpText } from './textExtract';
import { REUSE_TYPE } from './fpConstants';
import promptCore from './shared/promptCore';
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

// ── 공유 프롬프트 (서버 작업 경로와 동일 함수) ──────────────────
export const {
  getProjectInfoPrompt,
  getRequirementCollectPrompt,
  getDomainClassifyPrompt,
  getDomainExpandPrompt,
  getFPClassifyPrompt,
  getDataGroupPrompt,
} = promptCore;


// ── 5. 영역 추가 제안 ─────────────────────────────────────────
export const getAreaSuggestPrompt = (systemName, rfpText, functions, targetCount, upgradeMode = false) => {
  const currentLV1 = [...new Set(functions.map(f => f.lv1))];
  const currentLV2 = [...new Set(functions.map(f => f.lv2))];
  const currentCount = functions.length;
  // [504 대응] 15,000자 → 8,000자 + 행정 섹션 후순위. reqLines가 핵심을 따로
  // 뽑으므로 본문 축소해도 손실 적고, 응답 시간이 크게 단축된다.
  const rfpSnippet = prioritizeRfpText(rfpText || '', 8000);

  const reuseFuncs = functions.filter(f => f.reuseType === REUSE_TYPE.REUSED || f.reuseType === REUSE_TYPE.CHANGED);
  const newFuncs = functions.filter(f => !f.reuseType || f.reuseType === REUSE_TYPE.NEW);
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


// ── 9. 기능정의서 파싱 ────────────────────────────────────────
export const getDocParsePrompt = (text) => `
당신은 공공SW사업 BA 전문가입니다. 아래 문서에서 LV1/LV2/LV3 기능목록을 추출하세요. JSON만 출력.

## 추출 규칙
- LV1: 업무 대분류 (메뉴바 수준)
- LV2: 업무 중분류 (서브메뉴 수준)
- LV3: 단위 기능 (화면/버튼 단위)
- definition: 기능 설명 한 줄

문서:
${text.slice(0, 8000)}

{"functions":[{"lv1":"","lv2":"","lv3":"","definition":""}]}
`;
