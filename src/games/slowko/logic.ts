export type Mark = 'correct' | 'present' | 'absent';
export const WORD_LEN = 5;
export const MAX_GUESSES = 6;

/** Two-pass Wordle scoring that handles repeated letters correctly. */
export function scoreGuess(guess: string, answer: string): Mark[] {
  const g = [...guess];
  const a = [...answer];
  const marks: Mark[] = g.map(() => 'absent');
  const remaining = new Map<string, number>();
  g.forEach((ch, i) => {
    if (ch === a[i]) marks[i] = 'correct';
    else remaining.set(a[i], (remaining.get(a[i]) ?? 0) + 1);
  });
  g.forEach((ch, i) => {
    if (marks[i] === 'correct') return;
    const n = remaining.get(ch) ?? 0;
    if (n > 0) {
      marks[i] = 'present';
      remaining.set(ch, n - 1);
    }
  });
  return marks;
}

const rank: Record<Mark, number> = { absent: 0, present: 1, correct: 2 };
export function keyboardMarks(guesses: string[], answer: string): Record<string, Mark> {
  const out: Record<string, Mark> = {};
  for (const g of guesses) {
    const m = scoreGuess(g, answer);
    [...g].forEach((ch, i) => {
      if (!out[ch] || rank[m[i]] > rank[out[ch]]) out[ch] = m[i];
    });
  }
  return out;
}

export interface SlowkoState {
  guesses: string[];
}

export function outcome(s: SlowkoState, answer: string) {
  const last = s.guesses[s.guesses.length - 1];
  if (last === answer) return { won: true, bucket: String(s.guesses.length) };
  if (s.guesses.length >= MAX_GUESSES) return { won: false, bucket: 'X' };
  return null;
}

export function shareGrid(guesses: string[], answer: string, highContrast: boolean): string {
  const sym: Record<Mark, string> = highContrast
    ? { correct: '🟧', present: '🟦', absent: '⬜' }
    : { correct: '🟩', present: '🟨', absent: '⬛' };
  return guesses.map((g) => scoreGuess(g, answer).map((m) => sym[m]).join('')).join('\n');
}
