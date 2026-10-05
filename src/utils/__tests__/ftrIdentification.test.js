import { deriveFTR, deriveFPRow } from '../fpDerivation';
import { getComplexity } from '../fpCalculator';
import pipelineCore from '../shared/pipelineCore';
import ftrReportModule from '../shared/ftrReport';
import { getFPClassifyPrompt } from '../systemPrompt';

const { buildFtrReport, formatFtrReport } = ftrReportModule;

describe('J1 FTR 도출', () => {
  test('refGroups 수와 동사 폴백 중 큰 값을 쓴다', () => {
    expect(deriveFTR('세무조사 통계조회', ['세무조사']).ftr).toBe(3);
    expect(deriveFTR('신고서 승인 처리', ['신고서']).ftr).toBe(2);
    expect(deriveFTR('신고서 등록', ['신고서']).ftr).toBe(1);
    expect(deriveFTR('신고서 상세조회', ['신고서', '사용자', '납세자', 'AI모델']).ftr).toBe(4);
    expect(deriveFTR('세무조사 통계조회', ['a', 'b', 'c', 'd', 'e', 'f']).ftr).toBe(5);
  });

  test('refGroups가 없으면 동사 폴백, 근거 문자열을 남긴다', () => {
    expect(deriveFTR('승인 처리', [])).toEqual({ ftr: 2, basis: '동사규칙(폴백)' });
    expect(deriveFTR('신고서 등록', [])).toEqual({ ftr: 1, basis: '단일참조(폴백)' });
    expect(deriveFTR('통계조회', ['세무조사']).basis).toContain('동사규칙 보정');
  });

  test('writes/reads/refGroups를 합쳐 복수 그룹으로 파싱하고 목록 밖 이름은 버린다', () => {
    const known = ['신고서', '사용자', '납세자'];
    const parsed = pipelineCore.parseClassifiedRow({ fpType: 'EI', writes: ['신고서'], reads: ['사 용자', '엉뚱한그룹'], refGroups: ['신고서', '납세자'] }, known);
    expect(parsed).toEqual({ fpType: 'EI', refGroups: ['신고서', '사용자', '납세자'] });
    expect(pipelineCore.parseClassifiedRow({ fpType: 'EQ', refGroups: ['임의'] }, []).refGroups).toEqual(['임의']);
    expect(pipelineCore.parseClassifiedRow({ fpType: 'EQ', refGroups: ['임의'] }, known).refGroups).toEqual([]);
  });

  test('프롬프트는 읽기·쓰기 전부, 예시 3개, 데이터그룹 목록, 기능정의를 포함', () => {
    const prompt = getFPClassifyPrompt([{ lv2: '신고', lv3: '신고서 승인 처리', definition: '신고서를 승인한다' }], ['신고서', '사용자']);
    expect(prompt).toContain('읽거나 쓰는 ILF·EIF 이름 전부');
    ['신고서 승인 처리', '세무조사 통계조회', 'AI모델 상세조회'].forEach(example => expect(prompt).toContain(example));
    expect(prompt).toContain('신고서, 사용자');
    expect(prompt).toContain('신고서를 승인한다');
  });
});

describe('FTR/복잡도 분포 리포트', () => {
  test('FTR 1/2/3+ 와 복잡도 분포를 계산한다', () => {
    const functions = [
      { lv3: '신고서 등록' }, { lv3: '신고서 승인 처리' }, { lv3: '세무조사 통계조회' }, { lv3: '신고서 상세조회' },
    ];
    const classified = { 0: { fpType: 'EI', refGroups: ['신고서'] }, 1: { fpType: 'EI', refGroups: ['신고서', '사용자'] }, 2: { fpType: 'EO', refGroups: ['세무조사'] }, 3: { fpType: 'EQ', refGroups: ['신고서', '사용자', '납세자'] } };
    const rows = functions.map((func, index) => ({ ...func, ...deriveFPRow(func, classified[index]) }));
    const report = buildFtrReport([...rows, { fpType: 'ILF', ftr: 1, det: 5 }], getComplexity);
    expect(report.transactionCount).toBe(4);
    expect(report.ftr['1'].count).toBe(1);
    expect(report.ftr['2'].count).toBe(1);
    expect(report.ftr['3+'].count).toBe(2);
    expect(report.ftr['3+'].pct).toBe(50);
    expect(Object.values(report.complexity).reduce((sum, item) => sum + item.count, 0)).toBe(4);
    expect(formatFtrReport(report)).toContain('FTR 분포');
  });
});

describe('J2 EIF 발췌 / J3 DET 지시 / J4 분포 검증 연결', () => {
  const { summarizeDistribution } = require('../fpValidation');
  const { getDataGroupPrompt } = require('../systemPrompt');

  test('extractInterfaceText는 연계·연동 문단을 우선하고 8,000자 이내', () => {
    const filler = Array.from({ length: 300 }, (_, i) => `일반 문단 ${i} 사업 개요 설명`).join('\n\n');
    const text = `${filler}\n\n국세청은 행정안전부 통합인증 API와 연계한다.\n\n${filler}\n\n타 시스템 연동 대상: 홈택스`;
    const out = pipelineCore.extractInterfaceText(text, 8000);
    expect(out).toContain('통합인증 API');
    expect(out).toContain('홈택스');
    expect(out).not.toContain('일반 문단');
    expect(out.length).toBeLessThanOrEqual(8000);
    expect(pipelineCore.extractInterfaceText('관련 키워드가 없는 일반 텍스트', 8000)).toBe('관련 키워드가 없는 일반 텍스트'.slice(0, 8000));
  });

  test('데이터그룹 프롬프트는 DET 합집합 지시와 RFP source 필수를 유지', () => {
    const prompt = getDataGroupPrompt([{ lv1: 'A', lv2: 'B' }], 'S', 'RFP 연계 문단');
    expect(prompt).toContain('입력·조회 항목 합집합');
    expect(prompt).toContain('식별자·상태·일시·등록자');
    expect(prompt).toContain('근거 문장이 없으면 생성하지 말 것');
  });

  test('EIF 0건·L 편중은 사용자에게 보일 요약 메시지로 나온다', () => {
    const rows = Array.from({ length: 25 }, () => ({ fpType: 'EQ', ftr: 1, det: 8 }));
    const notes = summarizeDistribution([...rows, { fpType: 'ILF', ftr: 1, det: 10 }]);
    expect(notes.some(note => note.includes('EIF 0건 — RFP 연계 요구 확인'))).toBe(true);
    expect(notes.some(note => note.includes('복잡도 L'))).toBe(true);
    expect(summarizeDistribution([...rows, { fpType: 'EIF', ftr: 1, det: 5 }]).some(note => note.includes('EIF 0건'))).toBe(false);
  });
});
