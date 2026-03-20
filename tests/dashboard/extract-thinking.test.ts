import { describe, it, expect } from 'vitest';
import { extractThinking } from '../../src/dashboard/views/article.js';

describe('extractThinking (dashboard)', () => {
  it('extracts matched <think> pairs', () => {
    const result = extractThinking('<think>reasoning</think>output');
    expect(result.thinking).toBe('reasoning');
    expect(result.output).toBe('output');
  });

  it('extracts multiple matched pairs', () => {
    const result = extractThinking('<think>a</think>mid<think>b</think>end');
    expect(result.thinking).toBe('a\n\nb');
    // Tags replaced in-place, no space injected
    expect(result.output).toBe('midend');
  });

  it('handles Qwen bare close tag', () => {
    const result = extractThinking('reasoning here</think>actual output');
    expect(result.thinking).toBe('reasoning here');
    expect(result.output).toBe('actual output');
  });

  it('handles prose prefix (Thinking Process:)', () => {
    const input = 'Thinking Process:\nAnalysis of the data.\n# Article Title\nContent here.';
    const result = extractThinking(input);
    expect(result.thinking).toBe('Thinking Process:\nAnalysis of the data.');
    expect(result.output).toBe('# Article Title\nContent here.');
  });

  it('returns null thinking when no thinking tokens present', () => {
    const result = extractThinking('Just regular content');
    expect(result.thinking).toBeNull();
    expect(result.output).toBe('Just regular content');
  });

  it('treats empty thinking tags as empty string', () => {
    const result = extractThinking('<think></think>actual output');
    expect(result.thinking).toBe('');
    expect(result.output).toBe('actual output');
  });

  it('handles <thinking> tags', () => {
    const result = extractThinking('<thinking>deep thoughts</thinking>output');
    expect(result.thinking).toBe('deep thoughts');
    expect(result.output).toBe('output');
  });

  it('handles <reasoning> tags', () => {
    const result = extractThinking('<reasoning>analysis</reasoning>result');
    expect(result.thinking).toBe('analysis');
    expect(result.output).toBe('result');
  });

  it('preserves markdown in output', () => {
    const input = '<think>analysis</think>\n# Title\n\nContent with **bold**';
    const result = extractThinking(input);
    expect(result.thinking).toBe('analysis');
    expect(result.output).toBe('# Title\n\nContent with **bold**');
  });

  it('trims whitespace', () => {
    const result = extractThinking('<think>  padded  </think>  output  ');
    expect(result.thinking).toBe('padded');
    expect(result.output).toBe('output');
  });

  it('falls back to original content when stripped output is empty', () => {
    const result = extractThinking('<think>everything is thinking</think>');
    expect(result.thinking).toBe('everything is thinking');
    expect(result.output).toBe('<think>everything is thinking</think>');
  });
});
