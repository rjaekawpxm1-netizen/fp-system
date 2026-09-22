import { calcCostFP, calcTotalFP, getComplexity, getWeight, sumFPByReuseType } from '../fpCalculator';
import { REUSE_TYPE } from '../fpConstants';

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

describe('reuseType 공통 계약', () => {
  const rows = [
    { fpType: 'EI', ftr: 3, det: 5, reuseType: REUSE_TYPE.NEW },
    { fpType: 'EO', ftr: 2, det: 5, reuseType: REUSE_TYPE.CHANGED },
    { fpType: 'ILF', ftr: 1, det: 20, reuseType: REUSE_TYPE.REUSED },
  ];

  test('재사용 FP를 정통/간이 방식 모두 0이 아니게 집계', () => {
    expect(sumFPByReuseType(rows, REUSE_TYPE.REUSED, 'standard')).toBe(7);
    expect(sumFPByReuseType(rows, REUSE_TYPE.REUSED, 'simple')).toBe(7.5);
  });
});

describe('검토 대기 데이터 함수', () => {
  const pendingRow = {
    fpType: 'ILF', ftr: 1, det: 1,
    reuseType: REUSE_TYPE.NEW,
    calculationPending: true,
  };

  test('수동 확정 전에는 FP 및 개발비 합계에서 제외', () => {
    expect(calcTotalFP([pendingRow], 'standard').newDev).toBe('0.00');
    expect(calcCostFP([pendingRow], 'standard').totalFP).toBe(0);
  });
});

describe('유효하지 않은 행 합계 제외', () => {
  test('0/음수 및 변경량 초과 행을 FP 합계에 반영하지 않음', () => {
    const rows = [
      { fpType:'EI', ftr:0, det:5, reuseType:REUSE_TYPE.NEW, ftrChange:0, detChange:0 },
      { fpType:'EO', ftr:2, det:5, reuseType:REUSE_TYPE.CHANGED, ftrChange:3, detChange:0 },
    ];
    expect(calcTotalFP(rows)).toEqual({ newDev:'0.00', changed:'0.00' });
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
