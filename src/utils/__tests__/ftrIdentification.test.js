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
