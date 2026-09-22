import { deriveDataFunctionMetrics } from '../dataFunctionDerivation';

describe('deriveDataFunctionMetrics', () => {
  test('counts unique AI-identified candidates deterministically', () => {
    const input = {
      recordSubgroups: ['기본정보', '상세정보', '기본정보'],
      dataElements: ['ID', '이름', 'id', '상태'],
    };

    expect(deriveDataFunctionMetrics(input)).toMatchObject({
      ret: 2,
      det: 3,
      calculationPending: false,
    });
    expect(deriveDataFunctionMetrics(input)).toEqual(deriveDataFunctionMetrics(input));
  });

  test('marks rows without identified DET candidates as pending', () => {
    expect(deriveDataFunctionMetrics({ recordSubgroups: [] })).toMatchObject({
      ret: 1,
      det: 1,
      calculationPending: true,
      needsReview: true,
    });
  });

  test('clamps rule-derived counts to supported bounds', () => {
    const values = Array.from({ length: 120 }, (_, index) => `항목-${index}`);
    expect(deriveDataFunctionMetrics({ recordSubgroups: values, dataElements: values }))
      .toMatchObject({ ret: 6, det: 99, calculationPending: false });
  });
});
