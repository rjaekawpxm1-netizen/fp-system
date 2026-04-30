import {
  getLV123Prompt,
  getFPPrompt,
  getParsePrompt,
  getSystemInfoPrompt,
} from './systemPrompt';

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';
const API_KEY = process.env.REACT_APP_ANTHROPIC_API_KEY;

// 공통 API 호출
const callClaude = async (prompt) => {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err?.error?.message || 'API 호출 실패');
  }

  const data = await response.json();
  const text = data.content
    .map((c) => (c.type === 'text' ? c.text : ''))
    .join('');

  // JSON 파싱
  const clean = text
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .trim();

  return JSON.parse(clean);
};

// 1차 호출: LV1~LV3 기능목록 생성
export const generateFunctions = async (systemInfo, keyword) => {
  const prompt = getLV123Prompt(systemInfo, keyword);
  const result = await callClaude(prompt);
  return result.functions || [];
};

// 2차 호출: FP 산정표 자동완성
export const generateFPList = async (functions) => {
  const prompt = getFPPrompt(functions);
  const result = await callClaude(prompt);
  return result.fpList || [];
};

// 기능정의서 파싱
export const parseDocument = async (text) => {
  const prompt = getParsePrompt(text);
  const result = await callClaude(prompt);
  return result.functions || [];
};

// 시스템 개요 파싱
export const parseSystemInfo = async (text) => {
  const prompt = getSystemInfoPrompt(text);
  const result = await callClaude(prompt);
  return result;
};