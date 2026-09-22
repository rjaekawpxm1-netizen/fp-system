import { calcCostFP, getComplexity, getWeight } from '../fpCalculator';

describe('calcCostFP — 개발비 산정법 계약', () => {
  const rows = [{
    fpType: 'EI', ftr: 3, det: 5,
    reuseType: '신규개발',
  }];

  test('정통법은 EI/FTR=3/DET=5를 6FP로 계산', () => {
    expect(calcCostFP(rows, 'standard')).toEqual({
      summary: { newDev: '6.00', changed: '0.00' },
      rawFP: 6,
      totalFP: 6,
    });
  });

  test('간이법은 간이 가중치 4FP를 기준으로 계산', () => {
    const result = calcCostFP(rows, 'simple');
    expect(result.rawFP).toBe(4);
    expect(result.totalFP).toBeCloseTo(5.144);
  });
});

describe.each([
  ['ILF', { low: 7, medium: 10, high: 15 }],
  ['EIF', { low: 5, medium: 7, high: 10 }],
])('%s 복잡도 매트릭스', (fpType, weights) => {
  test.each([
    [1, 19, 'low'], [1, 20, 'low'], [1, 51, 'medium'],
    [2, 19, 'low'], [2, 20, 'medium'], [2, 51, 'high'],
    [6, 19, 'medium'], [6, 20, 'high'], [6, 51, 'high'],
  ])('RET=%i, DET=%i → %s', (ret, det, expected) => {
    expect(getComplexity(fpType, ret, det)).toBe(expected);
    expect(getWeight(fpType, ret, det)).toBe(weights[expected]);
  });
});
