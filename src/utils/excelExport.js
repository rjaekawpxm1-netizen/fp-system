/**
 * excelExport.js - ExcelJS 기반 공식 양식 Excel 생성
 * SW사업 대가산정 가이드 2025 기준
 * npm install exceljs file-saver
 */
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const C = {
  HEADER1: 'FFFF99', TOTAL: 'C5D9F1',
  SUMMARY: 'DAEEF3', RED: 'FF0000',
};
const thin = { style: 'thin', color: { argb: 'FF000000' } };
const BORDER = { top: thin, left: thin, bottom: thin, right: thin };

function applyCell(cell, value, {
  bg=null, bold=false, sz=10, align='center',
  border=true, wrap=true, color=null, numFmt=null,
}={}) {
  cell.value = value;
  cell.font = { name:'맑은 고딕', bold, size:sz, ...(color?{color:{argb:'FF'+color}}:{}) };
  cell.alignment = { horizontal:align, vertical:'middle', wrapText:wrap };
  if (bg) cell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:'FF'+bg} };
  if (border) cell.border = BORDER;
  if (numFmt) cell.numFmt = numFmt;
}

// 안전 병합 - 중복 병합 방지
function sm(ws, r1, c1, r2, c2) {
  if (r1===r2 && c1===c2) return;
  try { ws.mergeCells(r1,c1,r2,c2); } catch(e) {}
}

async function dl(wb, filename) {
  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}), filename);
}

const AVG = { EI:4.0, EO:5.2, EQ:3.9, ILF:7.5, EIF:5.4 };

function stdComp(t, ftr, det) {
  ftr=Number(ftr)||0; det=Number(det)||0;
  if (['ILF','EIF'].includes(t)) {
    if (ftr<=1&&det<=19) return 'L';
    if (ftr<=1&&det<=50) return 'A';
    if (ftr<=1) return 'H';
    if (ftr<=5&&det<=50) return 'A';
    return 'H';
  }
  if (t==='EI') {
    if (ftr<=1&&det<=15) return 'L';
    if (ftr<=1) return 'A';
    if (ftr===2&&det<=4) return 'L';
    if (ftr===2&&det<=15) return 'A';
    if (ftr===2) return 'H';
    if (ftr>=3&&det<=4) return 'A';
    return 'H';
  }
  if (t==='EO'||t==='EQ') {
    if (ftr<=1&&det<=19) return 'L';
    if (ftr<=1) return 'A';
    if (ftr<=3&&det<=19) return 'A';
    if (ftr<=3) return 'H';
    if (ftr>=4&&det<=4) return 'A';
    return 'H';
  }
  return 'A';
}
const SW = { EI:{L:3,A:4,H:6}, EO:{L:4,A:5,H:7}, EQ:{L:3,A:4,H:6}, ILF:{L:7,A:10,H:15}, EIF:{L:5,A:7,H:10} };
const stdW = (t,ftr,det) => (SW[t]||{})[stdComp(t,ftr,det)]||0;


// ─── 간이법 시트 ──────────────────────────────────────────────
function buildSimple(wb, fpList, info) {
  const ws = wb.addWorksheet('FP산정(간이법)');
  ws.columns = [
    {width:2.5},{width:17},{width:16},{width:20},{width:26},
    {width:9.5},{width:7.5},{width:8},{width:10},{width:16},
    {width:7.5},{width:7.5},{width:7.5},{width:7.2},{width:7.5},
    {width:7.2},{width:9.5},{width:20},
  ];
  ws.getRow(1).height=22; ws.getRow(7).height=30; ws.getRow(8).height=38;

  // 1행 제목
  sm(ws,1,1,1,18);
  applyCell(ws.getCell(1,1),`기능점수 산정 (간이법) - ${info.systemName||''}`,{bold:true,sz:13,bg:C.SUMMARY,border:false});

  // 2~5행 요약 (우측 J~L)
  [['신규개발','신규개발'],['기능변경','기능변경'],['기능삭제',null],['수정없이 재사용','수정없이재사용']].forEach(([label,key],i)=>{
    const r=i+2;
    applyCell(ws.getCell(r,10),label,{bg:C.HEADER1,bold:true});
    sm(ws,r,11,r,12);
    const val = key ? fpList.filter(f=>f.reuseType===key).reduce((s,f)=>s+(AVG[f.fpType]||0),0) : '측정 비대상';
    applyCell(ws.getCell(r,11),typeof val==='number'?Math.round(val*100)/100:val,{bold:true,numFmt:'#,##0.00'});
  });

  // 6행 EIF 안내
  sm(ws,6,6,6,7); applyCell(ws.getCell(6,6),'EIF',{bold:true,sz:11,color:C.RED,border:false});
  sm(ws,6,8,6,18); applyCell(ws.getCell(6,8),'= 관리주체가 외부에 있으므로 기능변경 측정 대상이 아님에 유의',{sz:9,align:'left',border:false});

  // 7~8행 헤더: B~E는 7~8행 세로병합
  [[2,'①어플리케이션명'],[3,'②세부 업무명'],[4,'③단위프로세스명'],[5,'단위프로세스 설명']].forEach(([c,v])=>{
    sm(ws,7,c,8,c); applyCell(ws.getCell(7,c),v,{bg:C.HEADER1,bold:true});
  });
  // F7:H7 가로병합 (데이터 및 트랜잭션)
  sm(ws,7,6,7,8); applyCell(ws.getCell(7,6),'데이터 및 트랜잭션 기능',{bg:C.HEADER1,bold:true});
  // I~R 세로병합
  [[9,'FP 산출'],[10,'재사용유형'],[11,'FTR\n변경량'],[12,'DET\n변경량'],
   [13,'FTR\n변경률'],[14,'DET\n변경률'],[15,'기능\n변경률'],[16,'영향\n계수'],[17,'재사용\n기능점수'],[18,'비고']
  ].forEach(([c,v])=>{ sm(ws,7,c,8,c); applyCell(ws.getCell(7,c),v,{bg:C.HEADER1,bold:true}); });
  // 8행 F~H 소분류
  [[6,'④FP유형'],[7,'⑤FTR'],[8,'⑥DET']].forEach(([c,v])=>applyCell(ws.getCell(8,c),v,{bg:C.HEADER1,bold:true}));

  // 데이터
  const S=9;
  fpList.forEach((f,i)=>{
    const r=S+i; ws.getRow(r).height=15;
    const w=AVG[f.fpType]||0, reuse=f.reuseType||'신규개발', isChg=reuse==='기능변경';
    [[1,''],[2,f.lv1||'','left'],[3,f.lv2||'','left'],[4,f.lv3||'','left'],[5,f.definition||'','left'],
     [6,f.fpType||''],[7,['ILF','EIF'].includes(f.fpType)?'':(f.ftr||'')],[8,f.det||''],[9,w],
     [10,reuse,'left'],[11,isChg?(f.ftrChange||''):''],[12,isChg?(f.detChange||''):'']
    ].forEach(([c,v,a='center'])=>applyCell(ws.getCell(r,c),v,{align:a}));
    const fR=f.ftr?((Number(f.ftrChange)||0)/f.ftr):0, dR=f.det?((Number(f.detChange)||0)/f.det):0;
    const fnR=['ILF','EIF'].includes(f.fpType)?dR:(fR+dR)/2;
    const imp=fnR<=0.25?0.25:fnR<=0.5?0.5:fnR<=0.75?0.75:1.0;
    applyCell(ws.getCell(r,13),isChg?fR:'',{numFmt:'0.0%'});
    applyCell(ws.getCell(r,14),isChg?dR:'',{numFmt:'0.0%'});
    applyCell(ws.getCell(r,15),isChg?fnR:'',{numFmt:'0.0%'});
    applyCell(ws.getCell(r,16),isChg?imp:'');
    applyCell(ws.getCell(r,17),isChg?Math.round(w*imp*100)/100:'',{numFmt:'#,##0.00'});
    applyCell(ws.getCell(r,18),f.bigo||'');
  });

  // 합계
  const last=S+fpList.length-1, tr=last+1;
  sm(ws,tr,2,tr,8); applyCell(ws.getCell(tr,2),'합  계',{bg:C.TOTAL,bold:true});
  const tot=fpList.filter(f=>f.reuseType==='신규개발').reduce((s,f)=>s+(AVG[f.fpType]||0),0);
  applyCell(ws.getCell(tr,9),Math.round(tot*100)/100,{bg:C.TOTAL,bold:true,numFmt:'#,##0.00'});
  for(let c=10;c<=18;c++) applyCell(ws.getCell(tr,c),'',{bg:C.TOTAL});
}


// ─── 정통법 시트 ──────────────────────────────────────────────
function buildStandard(wb, fpList, info) {
  const ws = wb.addWorksheet('FP산정(정통법)');
  ws.columns = [
    {width:2.5},{width:16.2},{width:15.9},{width:20.4},{width:26.4},
    {width:9.4},{width:10.9},{width:9.4},{width:8.8},{width:9.0},
    {width:16.4},{width:7.5},{width:7.5},{width:7.5},{width:7.2},
    {width:7.5},{width:7.1},{width:9.4},{width:20},
  ];
  ws.getRow(1).height=22; ws.getRow(7).height=30; ws.getRow(8).height=38;

  sm(ws,1,1,1,19);
  applyCell(ws.getCell(1,1),`기능점수 산정 (정통법) - ${info.systemName||''}`,{bold:true,sz:13,bg:C.SUMMARY,border:false});

  [['신규개발','신규개발'],['기능변경','기능변경'],['기능삭제',null],['수정없이 재사용','수정없이재사용']].forEach(([label,key],i)=>{
    const r=i+2;
    applyCell(ws.getCell(r,11),label,{bg:C.HEADER1,bold:true});
    sm(ws,r,12,r,13);
    const val=key?fpList.filter(f=>f.reuseType===key).reduce((s,f)=>s+stdW(f.fpType,f.ftr,f.det),0):'측정 비대상';
    applyCell(ws.getCell(r,12),typeof val==='number'?Math.round(val*100)/100:val,{bold:true,numFmt:'#,##0.00'});
  });

  sm(ws,6,6,6,8); applyCell(ws.getCell(6,6),'EIF',{bold:true,sz:11,color:C.RED,border:false});
  sm(ws,6,9,6,19); applyCell(ws.getCell(6,9),'= 관리주체가 외부에 있으므로 기능변경 측정 대상이 아님에 유의',{sz:9,align:'left',border:false});

  [[2,'①어플리케이션명'],[3,'②세부 업무명'],[4,'③단위프로세스명'],[5,'단위프로세스 설명']].forEach(([c,v])=>{
    sm(ws,7,c,8,c); applyCell(ws.getCell(7,c),v,{bg:C.HEADER1,bold:true});
  });
  sm(ws,7,6,7,10); applyCell(ws.getCell(7,6),'데이터 및 트랜잭션 기능',{bg:C.HEADER1,bold:true});
  [[11,'재사용유형'],[12,'FTR\n변경량'],[13,'DET\n변경량'],[14,'FTR\n변경률'],[15,'DET\n변경률'],
   [16,'기능\n변경률'],[17,'영향\n계수'],[18,'재사용\n기능점수'],[19,'비고']
  ].forEach(([c,v])=>{ sm(ws,7,c,8,c); applyCell(ws.getCell(7,c),v,{bg:C.HEADER1,bold:true}); });
  [[6,'④FP유형'],[7,'⑤RET/FTR'],[8,'⑥DET'],[9,'⑦복잡도'],[10,'⑧가중치']]
    .forEach(([c,v])=>applyCell(ws.getCell(8,c),v,{bg:C.HEADER1,bold:true}));

  const S=9;
  fpList.forEach((f,i)=>{
    const r=S+i; ws.getRow(r).height=15;
    const comp=stdComp(f.fpType,f.ftr,f.det), w=stdW(f.fpType,f.ftr,f.det);
    const reuse=f.reuseType||'신규개발', isChg=reuse==='기능변경';
    [[1,''],[2,f.lv1||'','left'],[3,f.lv2||'','left'],[4,f.lv3||'','left'],[5,f.definition||'','left'],
     [6,f.fpType||''],[7,f.ftr||''],[8,f.det||''],[9,comp],[10,w],[11,reuse,'left'],
     [12,isChg?(f.ftrChange||''):''],[13,isChg?(f.detChange||''):'']
    ].forEach(([c,v,a='center'])=>applyCell(ws.getCell(r,c),v,{align:a}));
    const fR=f.ftr?((Number(f.ftrChange)||0)/f.ftr):0, dR=f.det?((Number(f.detChange)||0)/f.det):0;
    const fnR=['ILF','EIF'].includes(f.fpType)?dR:(fR+dR)/2;
    const imp=fnR<=0.25?0.25:fnR<=0.5?0.5:fnR<=0.75?0.75:1.0;
    applyCell(ws.getCell(r,14),isChg?fR:'',{numFmt:'0.0%'});
    applyCell(ws.getCell(r,15),isChg?dR:'',{numFmt:'0.0%'});
    applyCell(ws.getCell(r,16),isChg?fnR:'',{numFmt:'0.0%'});
    applyCell(ws.getCell(r,17),isChg?imp:'');
    applyCell(ws.getCell(r,18),isChg?Math.round(w*imp*100)/100:'',{numFmt:'#,##0.00'});
    applyCell(ws.getCell(r,19),f.bigo||'');
  });

  const last=S+fpList.length-1, tr=last+1;
  sm(ws,tr,2,tr,9); applyCell(ws.getCell(tr,2),'합  계',{bg:C.TOTAL,bold:true});
  const tot=fpList.filter(f=>f.reuseType==='신규개발').reduce((s,f)=>s+stdW(f.fpType,f.ftr,f.det),0);
  applyCell(ws.getCell(tr,10),Math.round(tot*100)/100,{bg:C.TOTAL,bold:true,numFmt:'#,##0.00'});
  for(let c=11;c<=19;c++) applyCell(ws.getCell(tr,c),'',{bg:C.TOTAL});
}


// ─── 기능목록 시트 ────────────────────────────────────────────
function buildFuncSheet(wb, functions) {
  const ws = wb.addWorksheet('기능목록');
  ws.columns = [{width:18},{width:18},{width:28},{width:50}];
  ws.getRow(1).height=20;
  ['LV1','LV2','LV3 (단위프로세스명)','기능 정의'].forEach((h,ci)=>
    applyCell(ws.getCell(1,ci+1),h,{bg:C.HEADER1,bold:true}));
  functions.forEach((f,i)=>{
    const r=i+2;
    [f.lv1||'',f.lv2||'',f.lv3||'',f.definition||''].forEach((v,ci)=>
      applyCell(ws.getCell(r,ci+1),v,{align:ci<2?'center':'left'}));
  });
}


// ─── 범용 시트 ────────────────────────────────────────────────
function buildGeneric(wb, name, headers, rows, widths=[]) {
  const ws = wb.addWorksheet(name);
  ws.columns = headers.map((_,i)=>({width:widths[i]||15}));
  ws.getRow(1).height=20;
  headers.forEach((h,ci)=>applyCell(ws.getCell(1,ci+1),h,{bg:C.HEADER1,bold:true}));
  rows.forEach((row,ri)=>{
    const r=ri+2;
    headers.forEach((h,ci)=>applyCell(ws.getCell(r,ci+1),row[h]??'',{align:'left'}));
  });
}


// ════════════════════════════════════════════════════════════════
// 공개 API
// ════════════════════════════════════════════════════════════════
export const exportAllExcelNew = async (projectData, projectName) => {
  const wb = new ExcelJS.Workbook();
  const { functions=[], fpList=[], screenList=[], reqList=[],
    crudMatrix={}, ifList=[], wbsList=[], traceList=[],
    tcList=[], asisList=[], systemName='', projectNameStr='' } = projectData;
  const info = { systemName, projectName: projectNameStr };

  if (functions.length>0) buildFuncSheet(wb, functions);
  if (fpList.length>0) { buildSimple(wb,fpList,info); buildStandard(wb,fpList,info); }
  if (screenList.length>0) buildGeneric(wb,'화면목록',
    ['화면ID','화면명','화면유형','LV1','LV2','관련기능','비고'],
    screenList.map(s=>({'화면ID':s.screenId,'화면명':s.screenName,'화면유형':s.screenType,'LV1':s.lv1,'LV2':s.lv2,'관련기능':s.relatedFunctions,'비고':s.note||''})),
    [12,25,12,15,15,40,15]);
  if (reqList.length>0) buildGeneric(wb,'요구사항정의서',
    ['요구사항ID','유형','요구사항명','상세내용','관련화면','우선순위','비고'],
    reqList.map(r=>({'요구사항ID':r.reqId,'유형':r.type,'요구사항명':r.reqName,'상세내용':r.detail,'관련화면':r.relatedScreen,'우선순위':r.priority,'비고':r.note||''})),
    [12,10,25,50,12,10,15]);
  if ((crudMatrix.matrix||[]).length>0) {
    const ents=crudMatrix.entities||[];
    buildGeneric(wb,'CRUD분석',['LV1','LV2','LV3',...ents],
      (crudMatrix.matrix||[]).map(f=>({'LV1':f.lv1,'LV2':f.lv2,'LV3':f.lv3,...Object.fromEntries(ents.map(e=>[e,f.crud?.[e]||'']))})),
      [15,15,25,...ents.map(()=>10)]);
  }
  if (ifList.length>0) buildGeneric(wb,'인터페이스정의서',
    ['인터페이스ID','인터페이스명','송신시스템','수신시스템','연동방식','연동주기','주요데이터항목','비고'],
    ifList.map(f=>({'인터페이스ID':f.ifId,'인터페이스명':f.ifName,'송신시스템':f.sendSystem,'수신시스템':f.receiveSystem,'연동방식':f.method,'연동주기':f.cycle,'주요데이터항목':f.dataItems,'비고':f.note||''})),
    [14,25,20,20,12,12,40,15]);
  if (wbsList.length>0) buildGeneric(wb,'WBS',
    ['WBS ID','단계','작업명','LV1','LV2','공수(일)','담당자','비고'],
    wbsList.map(w=>({'WBS ID':w.wbsId,'단계':w.phase,'작업명':w.task,'LV1':w.lv1,'LV2':w.lv2,'공수(일)':w.workDays,'담당자':w.role,'비고':w.note||''})),
    [8,10,30,15,15,10,10,20]);
  if (traceList.length>0) buildGeneric(wb,'요구사항추적표',
    ['요구사항ID','요구사항명','관련기능','관련화면','테스트케이스ID','상태'],
    traceList.map(t=>({'요구사항ID':t.reqId,'요구사항명':t.reqName,'관련기능':t.relatedFunctions,'관련화면':t.relatedScreens,'테스트케이스ID':t.testId,'상태':t.status})),
    [12,25,30,20,14,10]);
  if (tcList.length>0) buildGeneric(wb,'테스트케이스',
    ['테스트케이스ID','관련요구사항','테스트케이스명','유형','사전조건','테스트절차','기대결과','테스트결과'],
    tcList.map(t=>({'테스트케이스ID':t.tcId,'관련요구사항':t.reqId,'테스트케이스명':t.tcName,'유형':t.type,'사전조건':t.precondition,'테스트절차':t.steps,'기대결과':t.expected,'테스트결과':t.result})),
    [14,12,30,8,20,40,30,10]);
  if (asisList.length>0) buildGeneric(wb,'AS-IS_TO-BE',
    ['LV1','LV2','AS-IS(현행)','TO-BE(목표)','기대효과','변화유형'],
    asisList.map(a=>({'LV1':a.lv1,'LV2':a.lv2,'AS-IS(현행)':a.asIs,'TO-BE(목표)':a.toBe,'기대효과':a.improvement,'변화유형':a.changeType})),
    [15,20,40,40,30,12]);

  if (wb.worksheets.length===0) { alert('출력할 데이터가 없습니다.'); return; }
  await dl(wb, `${projectName}_전체산출물.xlsx`);
};

export const exportFPExcel = async (fpList, info, method='both') => {
  const wb = new ExcelJS.Workbook();
  if (method==='simple'||method==='both') buildSimple(wb,fpList,info);
  if (method==='standard'||method==='both') buildStandard(wb,fpList,info);
  await dl(wb, `FP산정표_${info.systemName||''}.xlsx`);
};

export const exportCostExcel = async (data) => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('SW재개발비 산정');
  ws.columns = [{width:2},{width:28},{width:50},{width:18},{width:18}];
  const fmt = n => typeof n==='number'?n.toLocaleString('ko-KR'):(n||'');

  sm(ws,1,1,1,5);
  applyCell(ws.getCell(1,1),`「${data.projectName}」 소프트웨어 재개발비 산정`,{bold:true,sz:13,bg:C.SUMMARY,border:false});
  ws.getRow(1).height=24;
  sm(ws,2,1,2,5);
  applyCell(ws.getCell(2,1),`산정일자: ${new Date().toLocaleDateString('ko-KR')}  |  산정방법: ${data.method==='standard'?'정통법':'간이법'}`,{sz:9,align:'left',border:false});

  const sections=[
    {title:'① 기능점수(FP) 산출',rows:[
      ['총 기능점수',`${data.method==='standard'?'정통법':'간이법'} 기준`,`${data.totalFP} FP`,''],
      ['신규개발 FP','',`${data.fpSummary.newDev} FP`,''],
      ['기능변경 FP','',`${data.fpSummary.changed} FP`,''],
      ['기능삭제','','측정 비대상',''],
    ]},
    {title:'② 보정전 재개발원가',rows:[
      ['기능점수당 단가','행안부 고시 기준',`${data.fpUnitPrice.toLocaleString()}원/FP`,''],
      ['보정전 재개발원가','= 총 FP × 단가','',fmt(data.preCorrectionCost)+'원'],
    ]},
    {title:'③ 보정계수',rows:[
      ['① 규모 보정계수','= 0.4057×(log(FP)−7.1978)²+0.8878',data.sizeCoeff.toFixed(4),''],
      ['② 연계복잡성',data.linkLabel,data.linkCoeff.toFixed(2),''],
      ['③ 성능 요구수준',data.perfLabel,data.perfCoeff.toFixed(2),''],
      ['④ 운영환경 호환성',data.envLabel,data.envCoeff.toFixed(2),''],
      ['⑤ 보안성',data.secLabel,data.secCoeff.toFixed(2),''],
      ['총 보정계수','① × ② × ③ × ④ × ⑤',data.totalCoeff.toFixed(4),''],
    ]},
    {title:'④ 재개발비 산정',rows:[
      ['보정후 재개발원가','= 보정전 원가 × 총 보정계수','',fmt(data.devCost)+'원'],
      ['직접경비','','',fmt(data.directCost)+'원'],
      ['이윤',`개발원가의 ${data.profitRate}%`,'',fmt(data.profit)+'원'],
    ]},
  ];

  let row=4;
  sections.forEach(({title,rows:sRows})=>{
    sm(ws,row,2,row,5); applyCell(ws.getCell(row,2),title,{bg:C.HEADER1,bold:true,align:'left'});
    ws.getRow(row).height=18; row++;
    sRows.forEach(([l,d,v,m])=>{
      applyCell(ws.getCell(row,2),l,{bold:!!m,align:'left'});
      applyCell(ws.getCell(row,3),d,{align:'left',sz:9});
      applyCell(ws.getCell(row,4),v,{align:'center'});
      applyCell(ws.getCell(row,5),m,{align:'right',bold:!!m});
      row++;
    });
    row++;
  });

  sm(ws,row,2,row,4);
  applyCell(ws.getCell(row,2),'SW 개발비 합계 (부가세 별도)',{bg:C.SUMMARY,bold:true,sz:12,align:'left'});
  applyCell(ws.getCell(row,5),fmt(data.totalDevCost)+'원',{bg:C.SUMMARY,bold:true,sz:12,align:'right'});
  ws.getRow(row).height=22; row++;
  sm(ws,row,2,row,4);
  applyCell(ws.getCell(row,2),'SW 개발비 합계 (부가세 포함, VAT 10%)',{bg:C.TOTAL,bold:true,sz:12,align:'left'});
  applyCell(ws.getCell(row,5),fmt(data.totalWithVAT)+'원',{bg:C.TOTAL,bold:true,sz:12,align:'right'});
  ws.getRow(row).height=22;

  await dl(wb, `${data.projectName}_개발비산출서.xlsx`);
};

export const exportGenericExcel = async (sheetName, headers, rows, colWidths=[], projectName='') => {
  const wb = new ExcelJS.Workbook();
  buildGeneric(wb, sheetName, headers, rows, colWidths);
  await dl(wb, `${projectName}_${sheetName}.xlsx`);
};