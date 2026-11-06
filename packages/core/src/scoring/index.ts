/** Scores retain IEEE-754 precision; rounding belongs to presentation. */
export interface ScoreResult { isGraded: boolean; score: number }
export type ScoringMode = 'all_or_nothing' | 'proportional';

export function scoreSingleChoice(standard: string, answer: string | undefined, fullScore: number): ScoreResult {
  return { isGraded: true, score: answer === standard ? fullScore : 0 };
}

export function scoreMultipleChoice(
  standards: readonly string[], answers: readonly string[], fullScore: number,
  mode: ScoringMode = 'all_or_nothing',
): ScoreResult {
  const correct = new Set(standards);
  const selected = new Set(answers);
  const valid = correct.size > 0 && [...selected].every(id => correct.has(id));
  const fraction = valid ? selected.size / correct.size : 0;
  return { isGraded: true, score: (mode === 'proportional' ? fraction : Number(fraction === 1)) * fullScore };
}

export const scoreIndefiniteChoice = scoreMultipleChoice;

export function scoreStrictFillInBlank(
  standards: readonly (readonly string[])[], answers: readonly string[], fullScore: number,
  mode: ScoringMode = 'all_or_nothing',
): ScoreResult {
  const correct = standards.filter((valid, index) => valid.some(answer => answer === answers[index])).length;
  const fraction = standards.length > 0 && answers.length <= standards.length ? correct / standards.length : 0;
  return { isGraded: true, score: (mode === 'proportional' ? fraction : Number(fraction === 1)) * fullScore };
}

/** Structural subset of shared Question, permitting readonly snapshots. */
export type ScorableQuestion =
  | { type: 'single_choice'; max_score: number; options: readonly { id: string; is_correct: boolean }[] }
  | { type: 'multiple_choice' | 'indefinite_choice'; max_score: number; score_mode: ScoringMode;
      options: readonly { id: string; is_correct: boolean }[] }
  | { type: 'strict_fill_in_blank'; max_score: number; score_mode: ScoringMode;
      blanks: readonly { valid_answers: readonly string[] }[] }
  | { type: 'free_fill_in_blank' | 'subjective' };

export function scoreQuestion(question: ScorableQuestion, answers: readonly string[]): ScoreResult {
  switch (question.type) {
    case 'single_choice':
      return scoreMultipleChoice(question.options.filter(o => o.is_correct).map(o => o.id), answers, question.max_score);
    case 'multiple_choice':
    case 'indefinite_choice':
      return scoreMultipleChoice(question.options.filter(o => o.is_correct).map(o => o.id), answers,
        question.max_score, question.score_mode);
    case 'strict_fill_in_blank':
      return scoreStrictFillInBlank(question.blanks.map(b => b.valid_answers), answers, question.max_score, question.score_mode);
    case 'free_fill_in_blank':
    case 'subjective':
      return { isGraded: false, score: 0 };
  }
}
