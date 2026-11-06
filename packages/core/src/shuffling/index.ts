/** One pure Mulberry32 step: the caller explicitly threads the returned state. */
export function seededRandom(state: number): { state: number; value: number } {
  const next = (state + 0x6d2b79f5) >>> 0;
  let value = Math.imul(next ^ (next >>> 15), next | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return { state: next, value: ((value ^ (value >>> 14)) >>> 0) / 4294967296 };
}

export function shuffle<T>(items: readonly T[], seed: number): T[] {
  const result = [...items];
  let state = seed;
  for (let i = result.length - 1; i > 0; i--) {
    const random = seededRandom(state);
    state = random.state;
    const j = Math.floor(random.value * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

export function shuffleOptions<T extends { id: string }>(question: {
  options: readonly T[]; fixed_options_order?: boolean; options_order_fixed?: boolean;
}, seed: number): T[] {
  return question.fixed_options_order || question.options_order_fixed ? [...question.options] : shuffle(question.options, seed);
}

export interface ShuffleSection<T extends { id: string }> {
  id: string;
  items: readonly T[];
  fixed_groups: readonly (readonly string[])[];
  shuffle_questions: boolean;
}

/** Requires validated, nonoverlapping groups referencing existing item IDs. */
function groupedUnits<T extends { id: string }>(section: ShuffleSection<T>): T[][] {
  const byId = new Map(section.items.map(item => [item.id, item]));
  const groupById = new Map(section.fixed_groups.flatMap(group => group.map(id => [id, group] as const)));
  const seen = new Set<readonly string[]>();
  const units: T[][] = [];
  for (const item of section.items) {
    const group = groupById.get(item.id);
    if (!group) units.push([item]);
    else if (!seen.has(group)) {
      seen.add(group);
      units.push(group.map(id => byId.get(id)!));
    }
  }
  return units;
}

export function shuffleSection<T extends { id: string }>(section: ShuffleSection<T>, seed: number): ShuffleSection<T> {
  return { ...section, items: section.shuffle_questions ? shuffle(groupedUnits(section), seed).flat() : [...section.items] };
}

/** Produces display regions, retaining source section IDs and item snapshots/type metadata. */
export function shuffleMergedSections<T extends { id: string }>(
  sections: readonly ShuffleSection<T>[], selectedSectionIds: readonly string[], seed: number,
): { section_ids: string[]; items: T[] }[] {
  const selected = new Set(selectedSectionIds);
  const merged = sections.filter(section => selected.has(section.id));
  let emitted = false;
  return sections.flatMap(section => {
    if (!selected.has(section.id)) return [{ section_ids: [section.id], items: [...shuffleSection(section, seed).items] }];
    if (emitted) return [];
    emitted = true;
    return [{ section_ids: merged.map(s => s.id), items: shuffle(merged.flatMap(groupedUnits), seed).flat() }];
  });
}

/** A material and its ordered children are one value; anchored materials retain their slots. */
export function shuffleMaterials<T extends { children: readonly unknown[]; movable?: boolean }>(
  materials: readonly T[], seed: number,
): T[] {
  const movable = shuffle(materials.filter(material => material.movable !== false), seed);
  let index = 0;
  return materials.map(material => material.movable === false ? material : movable[index++]!);
}
