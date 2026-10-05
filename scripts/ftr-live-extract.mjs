// 국세청 RFP PDF → 우선순위 텍스트 (eval/out/nts_rfp.txt). API 호출 없음.
import fs from 'node:fs/promises';
import { extractPdf, prioritizeRfpText } from './diagnose-rfp.mjs';

const extracted = await extractPdf('eval/fixtures/nts_ai_ismp_rfp.pdf');
await fs.mkdir('eval/out', { recursive: true });
await fs.writeFile('eval/out/nts_rfp.txt', prioritizeRfpText(extracted.text), 'utf8');
console.log(`pages=${extracted.pageCount} chars=${extracted.text.length}`);
