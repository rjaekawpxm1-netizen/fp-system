// Vercel Serverless Function (Node.js 런타임)
// [변경] Edge 런타임은 응답 스트리밍 없이는 ~25초에서 게이트웨이가 끊겨
// 504를 유발(영역 제안·FP 분류 등 긴 호출). Node 런타임 + maxDuration으로 해결.
export const config = {
  runtime: 'nodejs',
  maxDuration: 60, // Vercel Pro면 300까지 가능. Hobby는 60이 상한.
};

import claudeCore from './claudeCore.cjs';

export default async function handler(req, res) {
  return claudeCore.handleClaudeRequest(req, res);
}
