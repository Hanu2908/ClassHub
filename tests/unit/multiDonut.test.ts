import { describe, it, expect } from 'vitest';
import { MultiDonut } from '../../src/components/Shared';

describe('MultiDonut component export', () => {
  it('exports a MultiDonut function/component', () => {
    expect(typeof MultiDonut).toBe('function');
  });
});
