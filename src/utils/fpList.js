const DATA_FUNCTION_TYPES = new Set(['ILF', 'EIF']);

export const isDataFunction = (row) => DATA_FUNCTION_TYPES.has(row?.fpType);

export const mergeRecalculatedFPRows = (transactionRows, previousRows) => [
  ...(transactionRows || []),
  ...(previousRows || []).filter(isDataFunction),
];
