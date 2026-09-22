const FP_TYPES = new Set(['EI', 'EO', 'EQ', 'ILF', 'EIF']);

const isPositiveInteger = value => Number.isInteger(Number(value)) && Number(value) > 0;
const isNonNegativeInteger = value => Number.isInteger(Number(value)) && Number(value) >= 0;

export const validateFPRowValues = (row) => {
  const errors = [];
  if (!FP_TYPES.has(row?.fpType)) errors.push('지원하지 않는 FP 유형');
  if (!isPositiveInteger(row?.ftr)) errors.push('FTR/RET는 1 이상의 정수');
  if (!isPositiveInteger(row?.det)) errors.push('DET는 1 이상의 정수');

  const maxFtr = ['ILF', 'EIF'].includes(row?.fpType) ? 6 : 5;
  if (isPositiveInteger(row?.ftr) && Number(row.ftr) > maxFtr) {
    errors.push(`${['ILF', 'EIF'].includes(row?.fpType) ? 'RET' : 'FTR'}는 ${maxFtr} 이하`);
  }

  for (const [changeField, totalField, label] of [
    ['ftrChange', 'ftr', 'FTR/RET 변경량'],
    ['detChange', 'det', 'DET 변경량'],
  ]) {
    const change = row?.[changeField] ?? 0;
    if (!isNonNegativeInteger(change)) errors.push(`${label}은 0 이상의 정수`);
    else if (isPositiveInteger(row?.[totalField]) && Number(change) > Number(row[totalField])) {
      errors.push(`${label}은 총량 이하`);
    }
  }

  return { valid: errors.length === 0, errors };
};

export const isValidFPRow = row => validateFPRowValues(row).valid;
