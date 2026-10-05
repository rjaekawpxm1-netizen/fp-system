const DATA_FUNCTION_TYPES = new Set(['ILF', 'EIF']);

const isDataFunction = (row) => DATA_FUNCTION_TYPES.has(row?.fpType);

const mergeRecalculatedFPRows = (transactionRows, previousRows) => [
  ...(transactionRows || []),
  ...(previousRows || []).filter(isDataFunction),
];

module.exports = { isDataFunction, mergeRecalculatedFPRows };
