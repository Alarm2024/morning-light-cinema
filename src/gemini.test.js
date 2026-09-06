import test from 'node:test';
import assert from 'node:assert/strict';
import { formatGeminiUserError, getGeminiModelChain, isRetryableGeminiError } from './gemini.js';

test('getGeminiModelChain defaults to gemini-2.5-flash with fallbacks', () => {
  delete process.env.GEMINI_MODEL;
  assert.deepEqual(getGeminiModelChain(), ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash']);
});

test('getGeminiModelChain honors GEMINI_MODEL without duplicating fallbacks', () => {
  process.env.GEMINI_MODEL = 'gemini-2.0-flash';
  assert.deepEqual(getGeminiModelChain(), ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-1.5-flash']);
  delete process.env.GEMINI_MODEL;
});

test('isRetryableGeminiError detects 503 and UNAVAILABLE', () => {
  assert.equal(isRetryableGeminiError({ status: 503, message: 'Service Unavailable' }), true);
  assert.equal(isRetryableGeminiError(new Error('503 UNAVAILABLE: high demand')), true);
  assert.equal(isRetryableGeminiError(new Error('RESOURCE_EXHAUSTED')), true);
  assert.equal(isRetryableGeminiError({ status: 400, message: 'Bad request' }), false);
});

test('formatGeminiUserError returns friendly message for busy Gemini', () => {
  const err = new Error('{"error":{"code":503,"message":"UNAVAILABLE"}}');
  err.status = 503;
  assert.equal(formatGeminiUserError(err), 'Gemini busy — try again in a minute');
});

test('formatGeminiUserError avoids raw JSON dumps', () => {
  assert.equal(
    formatGeminiUserError(new Error('{"error":{"message":"something broke"}}')),
    'Gemini generation failed — please try again',
  );
});
