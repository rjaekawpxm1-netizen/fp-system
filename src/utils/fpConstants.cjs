const REUSE_TYPE = Object.freeze({
  NEW: '신규개발',
  CHANGED: '기능변경',
  REUSED: '재사용',
});

const REUSE_TYPES = Object.freeze(Object.values(REUSE_TYPE));

const REUSE_TYPE_LABEL = Object.freeze({
  [REUSE_TYPE.NEW]: '신규개발',
  [REUSE_TYPE.CHANGED]: '기능변경',
  [REUSE_TYPE.REUSED]: '수정없이 재사용',
});

module.exports = { REUSE_TYPE, REUSE_TYPES, REUSE_TYPE_LABEL };
