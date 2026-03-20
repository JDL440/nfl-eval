import { describe, it, expect } from 'vitest';
import { separateThinking } from '../../src/agents/runner.js';

describe('separateThinking', () => {
  it('extracts matched <think> pairs', () => {
    const input = '<think>reasoning here</think>actual output';
    const result = separateThinking(input);
    expect(result.thinking).toBe('reasoning here');
    expect(result.output).toBe('actual output');
  });

  it('extracts multiple matched pairs and combines thinking', () => {
    const input = '<think>part1</think>middle<think>part2</think>end';
    const result = separateThinking(input);
    expect(result.thinking).toBe('part1\n\npart2');
    // Tags are replaced in-place, no space injected between fragments
    expect(result.output).toBe('middleend');
  });

  it('handles Qwen bare close tag (no opening <think>)', () => {
    const input = 'reasoning here</think>actual output';
    const result = separateThinking(input);
    expect(result.thinking).toBe('reasoning here');
    expect(result.output).toBe('actual output');
  });

  it('returns null thinking when no thinking tokens present', () => {
    const input = 'Just regular content with no thinking tokens';
    const result = separateThinking(input);
    expect(result.thinking).toBeNull();
    expect(result.output).toBe('Just regular content with no thinking tokens');
  });

  it('treats empty thinking as empty string (trim of empty inner)', () => {
    const input = '<think></think>actual output';
    const result = separateThinking(input);
    // Empty inner text is captured and trimmed to '', still counted as a part
    expect(result.thinking).toBe('');
    expect(result.output).toBe('actual output');
  });

  it('handles <thinking> tags', () => {
    const input = '<thinking>deep thoughts</thinking>output';
    const result = separateThinking(input);
    expect(result.thinking).toBe('deep thoughts');
    expect(result.output).toBe('output');
  });

  it('handles <reasoning> tags', () => {
    const input = '<reasoning>analysis</reasoning>result';
    const result = separateThinking(input);
    expect(result.thinking).toBe('analysis');
    expect(result.output).toBe('result');
  });

  it('preserves markdown in output after thinking', () => {
    const input = '<think>analysis</think>\n# Title\n\nContent with **bold**';
    const result = separateThinking(input);
    expect(result.thinking).toBe('analysis');
    expect(result.output).toBe('# Title\n\nContent with **bold**');
  });

  it('trims whitespace from thinking and output', () => {
    const input = '<think>  padded thinking  </think>  padded output  ';
    const result = separateThinking(input);
    expect(result.thinking).toBe('padded thinking');
    expect(result.output).toBe('padded output');
  });

  it('is case-insensitive for tag names', () => {
    const input = '<THINK>uppercase</THINK>output';
    const result = separateThinking(input);
    expect(result.thinking).toBe('uppercase');
    expect(result.output).toBe('output');
  });

  it('handles multiline thinking content', () => {
    const input = '<think>\nLine 1\nLine 2\nLine 3\n</think>output here';
    const result = separateThinking(input);
    expect(result.thinking).toBe('Line 1\nLine 2\nLine 3');
    expect(result.output).toBe('output here');
  });

  it('falls back to original content when output would be empty', () => {
    const plain = 'no tags at all';
    const result = separateThinking(plain);
    expect(result.output).toBe('no tags at all');
    expect(result.thinking).toBeNull();
  });
});
