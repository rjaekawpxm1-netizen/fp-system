import { deriveFPRow, deriveDET, deriveFTR } from '../utils/fpDerivation';
import { deriveDataFunctionMetrics } from '../utils/dataFunctionDerivation';
import { REUSE_TYPE } from '../utils/fpConstants';
import { getDomainClassifyPrompt } from '../utils/systemPrompt';
import pipelineCore from '../utils/shared/pipelineCore';

const { buildInitialState, defaultExecuteStep } = require('../../api/jobsCore.cjs');

const functions = [
  { lv1: '회원', lv2: '회원정보', lv3: '회원 등록', definition: '회원을 등록한다' },
  { lv1: '회원', lv2: '회원정보', lv3: '회원 삭제', definition: '회원을 삭제한다' },
  { lv1: '회원', lv2: '회원정보', lv3: '회원 승인', definition: '회원을 승인한다' },
  { lv1: '회원', lv2: '회원정보', lv3: '회원 목록 출력', definition: '회원을 출력한다' },
  { lv1: '회원', lv2: '회원정보', lv3: '일괄 처리', definition: '일괄 처리한다' },
  { lv1: '현황', lv2: '통계', lv3: '회원 통계조회', definition: '통계를 조회한다' },
];
const dataGroups = {
  ilf: [
    { name: '회원', recordSubgroups: ['기본', '권한'], dataElements: ['ID', '이름', '상태'], relatedLv2: ['회원정보'] },
    { name: '이력', recordSubgroups: ['처리이력'], dataElements: ['일시', '내용'], relatedLv2: ['통계'] },
  ],
  eif: [{ name: '행정망 인사', recordSubgroups: ['인사'], dataElements: ['사번', '부서', '이름', '직급'], source: 'RFP 연동 근거 문장' }],
};
const classified = {
  0: { fpType: 'EI', refGroups: ['회원'] },
  1: { fpType: 'EI', refGroups: [] },
  3: { fpType: 'EO', refGroups: [] },
  5: { fpType: 'EO', refGroups: [] },
};

const runFinalize = async (state) => {
  const next = await defaultExecuteStep({ step: 0, state: { ...state, results: {} } }, { kind: 'fp_finalize' }, null);
  return next.finalFpList;
};
const fpState = (overrides = {}) => ({
  ...buildInitialState('fp', { functions, fpMethod: 'standard' }, {}),
  dataGroups,
  classified,
  ...overrides,
});

// 클라이언트(useFPCalculation) 산정 경로를 그대로 재현한다.
const clientCalc = () => {
  const rows = pipelineCore.applyFPClassifications(functions, classified, deriveFPRow, REUSE_TYPE.NEW);
  const groups = pipelineCore.normalizeDataGroups(dataGroups, deriveDataFunctionMetrics);
  const ilf = groups.ilf.map(group => ({ fpType: 'ILF', ftr: group.ret, det: group.det, lv3: `${group.name} (ILF)` }));
  const eif = groups.eif.map(group => ({ fpType: 'EIF', ftr: group.ret, det: group.det, lv3: `${group.name} (EIF)` }));
  return [...rows, ...ilf, ...eif];
};
const shape = row => [row.fpType, row.ftr, row.det];

describe('G1 서버 fp_finalize ILF/EIF 반영', () => {
  test('data_groups 결과의 ILF 2개·EIF 1개가 최종 fpList에 RET/DET 규칙값으로 존재', async () => {
    const list = await runFinalize(fpState());
    const ilf = list.filter(row => row.fpType === 'ILF');
    const eif = list.filter(row => row.fpType === 'EIF');
    expect(ilf).toHaveLength(2);
    expect(eif).toHaveLength(1);
    const expected = deriveDataFunctionMetrics(dataGroups.ilf[0]);
    expect([ilf[0].ftr, ilf[0].det]).toEqual([expected.ret, expected.det]);
    expect([ilf[0].ftr, ilf[0].det]).toEqual([2, 3]);
    expect([eif[0].ftr, eif[0].det]).toEqual([1, 4]);
  });

  test('기존 ILF/EIF 행이 있으면(keepDataRows) 기존 데이터 행을 유지하고 새 그룹은 쓰지 않는다', async () => {
    const existing = { id: 9, lv1: '데이터기능', lv2: '회원', lv3: '회원 (ILF)', fpType: 'ILF', ftr: 1, det: 10 };
    const list = await runFinalize(fpState({ existingRows: [existing] }));
    expect(list.filter(row => row.fpType === 'ILF')).toEqual([existing]);
  });
});

describe('G2 서버 트랜잭션 행은 fpDerivation 규칙표 사용', () => {
  test.each([
    ['회원 삭제', 1], ['회원 승인', 2], ['회원 목록 출력', 3], ['일괄 처리', 4], ['회원 통계조회', 5],
  ])('%s의 DET·FTR이 규칙표 값과 일치', async (lv3, index) => {
    const list = await runFinalize(fpState({ classified: {} }));
    const row = list[index];
    expect(row.lv3).toBe(lv3);
    expect(row.det).toBe(deriveDET(lv3).det);
    expect(row.ftr).toBe(deriveFTR(lv3, []).ftr);
  });

  test('이전 인라인 정규식 값(삭제 8, 처리 8)이 아니라 규칙표 값(삭제 4, 처리 7)을 쓴다', async () => {
    const list = await runFinalize(fpState({ classified: {} }));
    expect(list[1].det).toBe(4);
    expect(list[4].det).toBe(7);
  });
});

describe('G3 서버 프롬프트는 공유 프롬프트 사용', () => {
  const capture = async (state, step) => {
    const callModel = jest.fn(async () => '{}');
    await defaultExecuteStep({ step: 0, state: { ...state, results: {} } }, step, callModel);
    return callModel.mock.calls[0][0];
  };

  test('domain_classify는 클라이언트와 동일 프롬프트(절대 금지 LV1 포함)', async () => {
    const state = { input: {}, info: { systemName: 'S', overview: 'O', mainUsers: ['사용자'], projectType: 'SW개발' }, allReqs: ['회원을 등록한다는 요구사항'], userInput: '' };
    const prompt = await capture(state, { kind: 'domain_classify' });
    expect(prompt).toContain('절대 금지 LV1');
    expect(prompt).toBe(getDomainClassifyPrompt(state.allReqs, 'S', 'O', ['사용자'], 'SW개발', '', 0, []));
  });

  test('domain_expand는 LV3 CRUD 가이드와 To-Be 분해 규칙을 포함', async () => {
    const prompt = await capture({ input: {}, info: { systemName: 'S' }, existingFunctions: [] }, { kind: 'domain_expand', domain: { lv1: 'A', requirements: [] } });
    expect(prompt).toContain('LV3 기본 구성 가이드');
    expect(prompt).toContain('To-Be AI 서비스 LV2 분해 규칙');
    expect(prompt).toContain('등록 / 수정 / 삭제 / 목록조회 / 상세조회');
  });

  test('data_groups는 recordSubgroups·dataElements·relatedLv2·source를 요구', async () => {
    const prompt = await capture({ input: { rfpText: '' }, functions, systemName: 'S' }, { kind: 'data_groups' });
    ['recordSubgroups', 'dataElements', 'relatedLv2', 'source'].forEach(key => expect(prompt).toContain(key));
  });

  test('requirements·fp_classify도 상세 프롬프트 사용', async () => {
    expect(await capture({ input: {}, info: { systemName: 'S' } }, { kind: 'requirements', chunk: '청크', label: 1 })).toContain('제외 대상');
    expect(await capture({ input: {}, dataGroupNames: ['회원'] }, { kind: 'fp_classify', chunk: functions, offset: 0 })).toContain('refGroups');
  });
});

describe('G4 필수 AI 영역은 체크 해제된 제안 도메인', () => {
  test('AI ISMP 사업의 domain_classify 결과에 enabled:false, suggested:true 도메인이 추가된다', async () => {
    const callModel = jest.fn(async () => JSON.stringify({ domains: [{ lv1: '회원관리', requirements: ['회원'] }] }));
    const state = {
      input: { rfpText: '생성형 AI와 LLM, RAG 에이전트 플랫폼 ISMP 컨설팅' },
      info: { systemName: 'S', projectType: 'AI ISMP 컨설팅' },
      allReqs: [],
      userInput: '',
    };
    const next = await defaultExecuteStep({ step: 0, state: { ...state, results: {} } }, { kind: 'domain_classify' }, callModel);
    expect(next.domains.map(domain => domain.lv1)).toEqual(['회원관리', 'AI 공통 플랫폼', 'AI 운영관리', '직원 업무지원 AI']);
    next.domains.slice(1).forEach(domain => expect(domain).toMatchObject({ enabled: false, suggested: true }));
  });

  test('일반 사업에는 제안 도메인이 없다', async () => {
    const callModel = jest.fn(async () => JSON.stringify({ domains: [{ lv1: '회원관리' }] }));
    const next = await defaultExecuteStep({ step: 0, state: { input: { rfpText: '회원' }, info: {}, allReqs: [], results: {} } }, { kind: 'domain_classify' }, callModel);
    expect(next.domains).toHaveLength(1);
  });
});

describe('G5 서버·클라이언트 산정 동등성', () => {
  test('행 수, fpType, ftr, det, ILF/EIF RET·DET가 모두 일치', async () => {
    const server = await runFinalize(fpState());
    const client = clientCalc();
    expect(server).toHaveLength(client.length);
    expect(server.map(shape)).toEqual(client.map(shape));
    expect(server.filter(row => row.fpType === 'ILF').map(row => row.lv3)).toEqual(client.filter(row => row.fpType === 'ILF').map(row => row.lv3));
    expect(server.filter(row => row.fpType === 'EIF').map(shape)).toEqual(client.filter(row => row.fpType === 'EIF').map(shape));
  });
});
