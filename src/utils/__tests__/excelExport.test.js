import { getStandardExportValues } from '../excelExport';

describe('Excel 정통법과 FP 계산기 계약', () => {
  test.each([
    ['EO', 2, 5, 'L', 4],
    ['EQ', 2, 5, 'L', 3],
    ['EO', 4, 5, 'A', 5],
    ['ILF', 1, 20, 'L', 7],
    ['ILF', 6, 19, 'A', 10],
    ['EIF', 1, 51, 'A', 7],
  ])('%s/FTR(RET)=%i/DET=%i → %s/%iFP', (type, ftr, det, complexity, weight) => {
    expect(getStandardExportValues(type, ftr, det)).toEqual({ complexity, weight });
  });
});
