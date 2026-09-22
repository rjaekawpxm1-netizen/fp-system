import { isValidFPRow, validateFPRowValues } from '../fpRowValidation';

describe('FP 행 값 검증', () => {
  test('음수·0·NaN과 변경량 총량 초과를 거부', () => {
    expect(isValidFPRow({ fpType:'EI', ftr:0, det:NaN, ftrChange:-1, detChange:2 })).toBe(false);
    expect(validateFPRowValues({ fpType:'EI', ftr:2, det:5, ftrChange:3, detChange:6 }).errors)
      .toEqual(expect.arrayContaining(['FTR/RET 변경량은 총량 이하', 'DET 변경량은 총량 이하']));
  });

  test('유효 범위의 행을 허용', () => {
    expect(isValidFPRow({ fpType:'EO', ftr:3, det:20, ftrChange:1, detChange:4 })).toBe(true);
    expect(isValidFPRow({ fpType:'ILF', ftr:6, det:51, ftrChange:0, detChange:0 })).toBe(true);
  });
});
