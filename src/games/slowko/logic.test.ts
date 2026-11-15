import { describe, expect, it } from 'vitest';
import { scoreGuess, keyboardMarks, outcome, shareGrid } from './logic';
import answers from './answers.json';

describe('słówko scoring', () => {
  it('marks exact, present and absent letters', () => {
    expect(scoreGuess('kotek', 'kotka')).toEqual(['correct', 'correct', 'correct', 'absent', 'present']);
  });
  it('handles repeated letters: only as many presents as remain in answer', () => {
    expect(scoreGuess('aabbb', 'ccaac')).toEqual(['present', 'present', 'absent', 'absent', 'absent']);
    expect(scoreGuess('lalka', 'palec')).toEqual(['absent', 'correct', 'correct', 'absent', 'absent']);
    expect(scoreGuess('kotek', 'kokos')).toEqual(['correct', 'correct', 'absent', 'absent', 'present']);
  });
  it('treats Polish diacritics as distinct letters', () => {
    expect(scoreGuess('łąka', 'laka')).toEqual(['absent', 'absent', 'correct', 'correct']);
    expect(scoreGuess('łąkaa', 'alaka')[0]).toBe('absent');
  });
  it('keyboard keeps the best mark per letter', () => {
    const k = keyboardMarks(['lalka'], 'palec');
    expect(k.l).toBe('correct');
    expect(k.a).toBe('correct');
    expect(k.k).toBe('absent');
  });
  it('win and loss outcomes', () => {
    expect(outcome({ guesses: ['palec'] }, 'palec')).toEqual({ won: true, bucket: '1' });
    expect(outcome({ guesses: Array(6).fill('kotek') }, 'palec')).toEqual({ won: false, bucket: 'X' });
    expect(outcome({ guesses: ['kotek'] }, 'palec')).toBeNull();
  });
  it('share grid contains no letters', () => {
    const s = shareGrid(['kotek', 'palec'], 'palec', false);
    expect(s).not.toMatch(/[a-ząęółśżźćń]/i);
    expect(s.split('\n')).toHaveLength(2);
  });
  it('answer list: unique, 5 letters, Polish alphabet only', () => {
    expect(new Set(answers).size).toBe(answers.length);
    for (const w of answers) expect(w).toMatch(/^[aąbcćdeęfghijklłmnńoóprsśtuwyzźż]{5}$/);
    expect(answers.length).toBeGreaterThan(300);
  });
});
