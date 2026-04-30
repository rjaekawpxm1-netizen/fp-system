/* eslint-disable no-unused-vars */
import {
  getLV123Prompt,
  getFPPrompt,
  getParsePrompt,
  getSystemInfoPrompt,
} from './systemPrompt';

const API_URL = process.env.NODE_ENV === 'production' 
  ? 'https://api.anthropic.com/v1/messages'
  : '/api/claude';
const API_KEY = process.env.REACT_APP_ANTHROPIC_API_KEY;

const callClaude = async (userPrompt) => {
  const body = {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    messages: [{ role: 'user', content: String(userPrompt) }],
  };

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': String(API_KEY),
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err?.error?.message || 'API 호출 실패');
  }

  const data = await response.json();
  const text = data.content
    .map((c) => (c.type === 'text' ? c.text : ''))
    .join('');

  const clean = text
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .trim();

  return JSON.parse(clean);
};

export const generateFunctions = async (systemInfo, keyword) => {
  const prompt = getLV123Prompt(systemInfo, keyword);
  const result = await callClaude(prompt);
  return result.functions || [];
};

export const generateFPList = async (functions) => {
  const prompt = getFPPrompt(functions);
  const result = await callClaude(prompt);
  return result.fpList || [];
};

export const parseDocument = async (text) => {
  const prompt = getParsePrompt(text);
  const result = await callClaude(prompt);
  return result.functions || [];
};

export const parseSystemInfo = async (text) => {
  const prompt = getSystemInfoPrompt(text);
  const result = await callClaude(prompt);
  return result;
};