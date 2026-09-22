import { isDataFunction, mergeRecalculatedFPRows } from '../fpList';

describe('mergeRecalculatedFPRows', () => {
  test('recalculation replaces transactions but preserves existing ILF and EIF rows', () => {
    const previousRows = [
      { id: 1, fpType: 'EI', lv3: 'old transaction' },
      { id: 2, fpType: 'ILF', lv3: 'customer', ftr: 3, det: 42, bigo: 'manual ILF' },
      { id: 3, fpType: 'EIF', lv3: 'external code', ftr: 2, det: 17, bigo: 'manual EIF' },
    ];
    const recalculated = [{ id: 4, fpType: 'EO', lv3: 'new transaction' }];

    const result = mergeRecalculatedFPRows(recalculated, previousRows);

    expect(result).toEqual([recalculated[0], previousRows[1], previousRows[2]]);
    expect(result[1]).toBe(previousRows[1]);
    expect(result[2]).toBe(previousRows[2]);
  });

  test.each(['ILF', 'EIF'])('%s is a data function', (fpType) => {
    expect(isDataFunction({ fpType })).toBe(true);
  });
});
