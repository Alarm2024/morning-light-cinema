import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatGeminiUserError,
  getGeminiModelChain,
  isFallbackEligibleGeminiError,
  isRetryableGeminiError,
} from './gemini.js';

const EXPECTED_CHAIN = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-3.6-flash',
];

test('getGeminiModelChain defaults to gemini-2.5-flash with fallbacks', () => {
  delete process.env.GEMINI_MODEL;
  assert.deepEqual(getGeminiModelChain(), EXPECTED_CHAIN);
});

test('getGeminiModelChain honors GEMINI_MODEL without duplicating fallbacks', () => {
  process.env.GEMINI_MODEL = 'gemini-3.6-flash';
  assert.deepEqual(getGeminiModelChain(), [
    'gemini-3.6-flash',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-3.5-flash-lite',
  ]);
  delete process.env.GEMINI_MODEL;
});

test('getGeminiModelChain has no gemini-1.5 in default chain', () => {
  delete process.env.GEMINI_MODEL;
  const chain = getGeminiModelChain();
  assert.equal(chain.some((m) => m.includes('1.5')), false);
  assert.equal(chain[0], 'gemini-2.5-flash');
});

test('isRetryableGeminiError detects 503 and UNAVAILABLE', () => {
  assert.equal(isRetryableGeminiError({ status: 503, message: 'Service Unavailable' }), true);
  assert.equal(isRetryableGeminiError(new Error('503 UNAVAILABLE: high demand')), true);
  assert.equal(isRetryableGeminiError(new Error('RESOURCE_EXHAUSTED')), true);
  assert.equal(isRetryableGeminiError({ status: 400, message: 'Bad request' }), false);
});

test('isFallbackEligibleGeminiError detects 404 NOT_FOUND for retired models', () => {
  assert.equal(isFallbackEligibleGeminiError({ status: 404, message: 'NOT_FOUND' }), true);
  assert.equal(isFallbackEligibleGeminiError(new Error('404 models/gemini-1.5-flash is not found')), true);
  assert.equal(isFallbackEligibleGeminiError({ status: 503, message: 'UNAVAILABLE' }), true);
  assert.equal(isFallbackEligibleGeminiError({ status: 400, message: 'Bad request' }), false);
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
