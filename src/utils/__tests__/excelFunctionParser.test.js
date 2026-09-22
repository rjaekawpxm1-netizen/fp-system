import {
  detectFunctionColumns,
  parseFunctionRows,
  parseManualColumnMapping,
} from '../excelFunctionParser';

describe('Excel 기능목록 열 탐지', () => {
  test('ID와 상태 열이 있어도 헤더 동의어로 LV 열을 찾는다', () => {
    const rows = [
      ['순번', '상태', '업무 대분류', '중분류', '기능명', '기능 설명'],
      [1, '확정', '민원', '신청', '신청 등록', '신청을 등록한다'],
    ];
    expect(detectFunctionColumns(rows)).toMatchObject({
      headerRow: 0,
      columns: { lv1: 2, lv2: 3, lv3: 4, definition: 5 },
      missing: [],
    });
  });

  test('10행 미만도 헤더 기반으로 파싱하고 품질 통계를 낸다', () => {
    const rows = [
      ['LV1', 'LV2', 'LV3', '정의'],
      ['민원', '신청', '등록', '등록한다'],
      ['민원', '', '조회', '조회한다'],
      ['민원', '신청', '등록', '중복'],
    ];
    const detected = detectFunctionColumns(rows);
    const result = parseFunctionRows(rows, detected.columns, detected.headerRow);
    expect(result.functions).toHaveLength(1);
    expect(result.stats).toMatchObject({ sourceRows: 3, incompleteRows: 1, duplicateRows: 1 });
  });

  test('불확실한 경우 A,B,C,D 수동 지정값을 해석한다', () => {
    expect(parseManualColumnMapping('B, C, D, F')).toEqual({ lv1: 1, lv2: 2, lv3: 3, definition: 5 });
    expect(parseManualColumnMapping('?, C, D')).toBeNull();
  });
});
