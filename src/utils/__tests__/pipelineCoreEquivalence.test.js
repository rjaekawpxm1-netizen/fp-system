import pipelineCore from '../pipelineCore.cjs';
import { deriveFPRow } from '../fpDerivation';
import { deriveDataFunctionMetrics } from '../dataFunctionDerivation';
import { isDataFunction, mergeRecalculatedFPRows } from '../fpList';
import { REUSE_TYPE } from '../fpConstants';

const identityCalc = (row, method) => ({ ...row, method });
const baseFunctions = [
  { lv1: '회원관리', lv2: '회원정보', lv3: '회원 등록', definition: '회원을 등록한다' },
  { lv1: '회원관리', lv2: '회원정보', lv3: '회원 목록조회', definition: '회원을 조회한다' },
];

describe('공유 파이프라인 코어 동등성', () => {
  test('신규 모드 기능 후처리 결과가 기존 스냅샷과 동일', () => {
    const result = pipelineCore.finalizeDomainFunctions([
      { ...baseFunctions[0], lv3: '회원 등록한다' },
      { ...baseFunctions[1] },
      { ...baseFunctions[1] },
    ], { systemName: '회원시스템', overview: '회원 업무' });

    expect(result).toEqual({
      systemName: '회원시스템',
      overview: '회원 업무',
      functions: baseFunctions,
    });
  });

  test('고도화 모드 분류와 기존 기능 병합 결과가 기존 스냅샷과 동일', () => {
    const existing = [{ ...baseFunctions[0], id: 1, reuseType: REUSE_TYPE.REUSED }];
    const classified = pipelineCore.finalizeDomainFunctions(baseFunctions, { systemName: '회원시스템' }, existing, {
      classifyReuse: rows => rows.map(row => ({ ...row, reuseType: row.lv3.includes('등록') ? REUSE_TYPE.REUSED : REUSE_TYPE.NEW })),
      summarizeReuse: () => ({ 신규개발: 1, 기능변경: 0, 재사용: 1 }),
    });
    const merged = pipelineCore.mergeGeneratedFunctions(classified.functions, existing, true, 100);

    expect(merged).toEqual([
      existing[0],
      { ...baseFunctions[1], reuseType: REUSE_TYPE.NEW, id: 101 },
    ]);
  });

  test.each(['standard', 'simple'])('%s FP 조립 결과가 기존 스냅샷과 동일', method => {
    const transactionRows = pipelineCore.applyFPClassifications(
      baseFunctions,
      { 0: { fpType: 'EI', refGroups: ['회원'] }, 1: { fpType: 'EQ', refGroups: ['회원'] } },
      deriveFPRow,
      REUSE_TYPE.NEW
    );
    const result = pipelineCore.assembleFPList({
      transactionRows,
      dataGroups: { ilf: [{ name: '회원', ret: 1, det: 10, metricBasis: 'RET 1 / DET 10', relatedLv2: ['회원정보'] }], eif: [] },
      functions: baseFunctions,
      fpMethod: method,
      upgradeMode: false,
      autoCalcRow: identityCalc,
      isDataFunction,
      mergeRecalculatedFPRows,
      reuseTypes: REUSE_TYPE,
      idBase: 1000,
    });

    expect(result.fpList.map(row => [row.fpType, row.lv3, row.method])).toEqual([
      ['EI', '회원 등록', method],
      ['EQ', '회원 목록조회', method],
      ['ILF', '회원 (ILF)', method],
    ]);
  });

  test('ILF 유지 재산정은 기존 데이터 행을 그대로 보존', () => {
    const previousIlf = { id: 77, lv1: '데이터기능', lv2: '회원', lv3: '회원 (ILF)', fpType: 'ILF' };
    const result = pipelineCore.assembleFPList({
      transactionRows: [{ ...baseFunctions[0], fpType: 'EI', ftr: 1, det: 5 }],
      previousRows: [previousIlf],
      functions: baseFunctions,
      fpMethod: 'standard',
      upgradeMode: false,
      autoCalcRow: identityCalc,
      isDataFunction,
      mergeRecalculatedFPRows,
      reuseTypes: REUSE_TYPE,
      idBase: 1000,
    });

    expect(result.keepExistingDataRows).toBe(true);
    expect(result.fpList[1]).toBe(previousIlf);
  });

  test('데이터그룹 AI 응답 정규화가 기존 결과와 동일', () => {
    const parsed = { ilf: [{ name: ' 회원 ', ret: 1, det: 10, relatedLv2: ['회원정보'] }], eif: [] };
    expect(pipelineCore.normalizeDataGroups(parsed, deriveDataFunctionMetrics).ilf[0]).toEqual(expect.objectContaining({
      name: '회원',
      relatedLv2: ['회원정보'],
    }));
  });
});
