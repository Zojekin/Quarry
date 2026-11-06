import { describe, expect, it } from 'vitest';
import { scoreSingleChoice, scoreMultipleChoice, scoreIndefiniteChoice, scoreStrictFillInBlank,
  scoreQuestion, seededRandom, shuffle, shuffleOptions, shuffleSection, shuffleMergedSections,
  shuffleMaterials, splitDurationAcrossMidnight } from '../src/index.js';

describe('scoring', () => {
  it.each([['a', 5], ['b', 0], ['', 0], [undefined, 0]])('single %s', (answer, score) => {
    expect(scoreSingleChoice('a', answer, 5)).toEqual({ isGraded: true, score });
  });
  for (const grade of [scoreMultipleChoice, scoreIndefiniteChoice]) {
    it('grades exact sets, omissions, extras, duplicates and fractional scores', () => {
      expect(grade(['a', 'b'], ['b', 'a'], 5).score).toBe(5);
      expect(grade(['a', 'b'], ['a'], 5).score).toBe(0);
      expect(grade(['a', 'b'], ['a', 'b', 'c'], 5).score).toBe(0);
      expect(grade(['a', 'b'], [], 5, 'proportional').score).toBe(0);
      expect(grade(['a', 'b'], ['a', 'c'], 5, 'proportional').score).toBe(0);
      expect(grade(['a', 'b', 'c'], ['a', 'a'], 5, 'proportional').score).toBe((1 / 3) * 5);
      expect(grade(['a', 'a'], ['a'], 5).score).toBe(5);
      expect(grade([], [], 5).score).toBe(0);
    });
  }
  it('strict blanks preserve every character and accept alternatives', () => {
    const standards = [['A', 'a'], [' x '], ['Ａ']];
    expect(scoreStrictFillInBlank(standards, ['a', ' x ', 'Ａ'], 5).score).toBe(5);
    for (const answers of [['a', 'x', 'Ａ'], ['a', ' x ', 'A'], ['a', ' X ', 'Ａ']]) {
      expect(scoreStrictFillInBlank(standards, answers, 5).score).toBe(0);
      expect(scoreStrictFillInBlank(standards, answers, 5, 'proportional').score).toBe((2 / 3) * 5);
    }
    expect(scoreStrictFillInBlank([['A']], ['a'], 1).score).toBe(0);
    expect(scoreStrictFillInBlank(standards, [], 5).score).toBe(0);
    expect(scoreStrictFillInBlank([['a']], ['a', 'extra'], 5).score).toBe(0);
    expect(scoreStrictFillInBlank([], [], 5).score).toBe(0);
    expect(scoreStrictFillInBlank([['a'], ['b'], ['c']], ['a'], 1, 'proportional').score).toBe(1 / 3);
  });
  it('dispatches all six shared question variants', () => {
    const base = { max_score: 5, options: [{ id: 'a', is_correct: true }, { id: 'b', is_correct: false }] };
    expect(scoreQuestion({ ...base, type: 'single_choice' }, ['a']).score).toBe(5);
    expect(scoreQuestion({ ...base, type: 'single_choice' }, ['a', 'b']).score).toBe(0);
    expect(scoreQuestion({ ...base, type: 'single_choice' }, []).score).toBe(0);
    for (const type of ['multiple_choice', 'indefinite_choice'] as const)
      expect(scoreQuestion({ ...base, type, score_mode: 'proportional' }, ['a']).score).toBe(5);
    expect(scoreQuestion({ type: 'strict_fill_in_blank', max_score: 5, score_mode: 'all_or_nothing', blanks: [{ valid_answers: ['a'] }] }, ['a']).score).toBe(5);
    for (const type of ['free_fill_in_blank', 'subjective'] as const)
      expect(scoreQuestion({ type }, [])).toEqual({ isGraded: false, score: 0 });
  });
});

describe('seeded shuffling', () => {
  const items = Array.from({ length: 12 }, (_, i) => ({ id: String(i) }));
  it('is deterministic, preserves identities and leaves inputs untouched', () => {
    const before = JSON.stringify(items);
    expect(shuffle(items, 42)).toEqual(shuffle(items, 42));
    expect(shuffle(items, 42)).not.toEqual(shuffle(items, 43));
    expect(new Set(shuffle(items, 42))).toEqual(new Set(items));
    expect(JSON.stringify(items)).toBe(before);
    expect(shuffle([], 0)).toEqual([]);
    expect(shuffle([1], 0)).toEqual([1]);
    expect(seededRandom(42)).toEqual(seededRandom(42));
    expect(seededRandom(42).value).toBeGreaterThanOrEqual(0);
    expect(seededRandom(42).value).toBeLessThan(1);
  });
  it('respects both fixed option spellings', () => {
    expect(shuffleOptions({ options: items }, 42)).toEqual(shuffle(items, 42));
    expect(shuffleOptions({ options: items, fixed_options_order: true }, 42)).toEqual(items);
    expect(shuffleOptions({ options: items, options_order_fixed: true }, 42)).toEqual(items);
  });
  it('moves fixed groups atomically in specified internal order', () => {
    const section = { id: 's', items, fixed_groups: [['3', '1', '2']], shuffle_questions: true };
    for (let seed = 0; seed < 30; seed++) {
      const result = shuffleSection(section, seed).items.map(i => i.id);
      expect(result.slice(result.indexOf('3'), result.indexOf('3') + 3)).toEqual(['3', '1', '2']);
      expect(new Set(result)).toEqual(new Set(items.map(i => i.id)));
    }
    expect(shuffleSection({ ...section, shuffle_questions: false }, 42).items).toEqual(items);
  });
  it('merges selected sections without disturbing unselected ones', () => {
    const sections = [{ id: 'a', items: items.slice(0, 4), fixed_groups: [['0', '1']], shuffle_questions: false },
      { id: 'b', items: items.slice(4, 8), fixed_groups: [], shuffle_questions: true },
      { id: 'c', items: items.slice(8), fixed_groups: [], shuffle_questions: false }];
    const result = shuffleMergedSections(sections, ['a', 'c'], 42);
    expect(result.map(s => s.section_ids)).toEqual([['a', 'c'], ['b']]);
    expect(new Set(result[0]!.items.map(i => i.id))).toEqual(new Set(['0', '1', '2', '3', '8', '9', '10', '11']));
    const ids = result[0]!.items.map(i => i.id);
    expect(ids[ids.indexOf('0') + 1]).toBe('1');
    expect(shuffleMergedSections(sections, [], 42)[0]!.items).toEqual(sections[0]!.items);
  });
  it('keeps material children ordered and immovable materials anchored', () => {
    const materials = items.map((item, i) => ({ ...item, children: [i, i + 1], movable: i !== 4 }));
    const result = shuffleMaterials(materials, 42);
    expect(result[4]).toBe(materials[4]);
    expect(new Set(result)).toEqual(new Set(materials));
    for (const item of result) expect(item.children).toEqual(materials[Number(item.id)]!.children);
    expect(shuffleMaterials([{ id: 'a', children: [1, 2] }], 1)).toEqual([{ id: 'a', children: [1, 2] }]);
  });
});

describe('calendar duration allocation', () => {
  const split = (start: string, end: string, seconds: number, zone?: string) =>
    splitDurationAcrossMidnight(Date.parse(start), Date.parse(end), seconds, zone);
  it('handles one day, exact midnight, multiple days and fractional seconds', () => {
    expect(split('2026-01-01T12:00Z', '2026-01-01T13:00Z', 10)).toEqual([{ date: '2026-01-01', seconds: 10 }]);
    expect(split('2026-01-01T23:00Z', '2026-01-02T00:00Z', 10)).toEqual([{ date: '2026-01-01', seconds: 10 }]);
    expect(split('2026-01-01T12:00Z', '2026-01-03T12:00Z', 100)).toEqual([
      { date: '2026-01-01', seconds: 25 }, { date: '2026-01-02', seconds: 50 }, { date: '2026-01-03', seconds: 25 }]);
    const result = split('2026-12-31T23:59:59Z', '2027-01-01T00:00:02Z', 1);
    expect(result[0]!.seconds).toBe(1 / 3);
    expect(result.reduce((sum, day) => sum + day.seconds, 0)).toBe(1);
  });
  it('uses explicit calendar zones including DST short and long days', () => {
    expect(split('2026-01-01T15:00Z', '2026-01-01T17:00Z', 10, 'Asia/Singapore')).toEqual([
      { date: '2026-01-01', seconds: 5 }, { date: '2026-01-02', seconds: 5 }]);
    expect(split('2026-03-08T05:00Z', '2026-03-10T04:00Z', 47, 'America/New_York')).toEqual([
      { date: '2026-03-08', seconds: 23 }, { date: '2026-03-09', seconds: 24 }]);
    expect(split('2026-11-01T04:00Z', '2026-11-03T05:00Z', 49, 'America/New_York')).toEqual([
      { date: '2026-11-01', seconds: 25 }, { date: '2026-11-02', seconds: 24 }]);
  });
  it('handles zero and rejects invalid intervals and zones', () => {
    expect(splitDurationAcrossMidnight(0, 0, 0)).toEqual([]);
    expect(splitDurationAcrossMidnight(0, 1, 0)).toEqual([]);
    for (const args of [[1, 0, 1], [0, 0, 1], [NaN, 1, 1], [0, Infinity, 1], [0, 1, -1], [0, 1, NaN], [9e15, 9e15 + 1, 1]])
      expect(() => splitDurationAcrossMidnight(...args as [number, number, number])).toThrow(RangeError);
    expect(() => splitDurationAcrossMidnight(0, 1, 1, 'invalid')).toThrow(RangeError);
  });
});
