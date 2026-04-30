/* eslint-disable no-unused-vars */
import {
  getLV123Prompt,
  getFPPrompt,
  getParsePrompt,
  getSystemInfoPrompt,
} from './systemPrompt';

const callClaude = async (content) => {
  const response = await fetch('/api/claude', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [
        {
          role: 'user',
          content: content,
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(JSON.stringify(err));
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