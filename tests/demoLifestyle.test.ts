import { describe, expect, it } from 'vitest';
import { lifestyleQuestions } from '../src/components/onboarding/lifestyleQuestions';
import { DEMO_PROFILES } from '../src/data/demoProfiles';
import { matchingDemoHabits } from '../src/demo/matchingLifestyle';
import { demoProfiles } from '../src/demo/profiles';
import { priorityLabels } from '../src/lib/lifestyleDetails';

describe('fictional profile lifestyles', () => {
  it.each([
    ...demoProfiles.map(({ name, lifestyleAnswers }) => ({ name, answers: lifestyleAnswers })),
    ...DEMO_PROFILES.map(({ id, displayName }) => ({ name: displayName, answers: matchingDemoHabits[id] })),
  ])('has all quiz answers for $name', ({ answers }) => {
    expect(answers).toBeDefined();
    for (const { id, options } of lifestyleQuestions) {
      expect(options.some(({ value }) => value === answers?.[id])).toBe(true);
    }
    expect(answers?.priorities.length).toBeGreaterThan(0);
    expect(answers?.priorities.length).toBeLessThanOrEqual(2);
    expect(new Set(answers?.priorities).size).toBe(answers?.priorities.length);
    expect(answers?.priorities.every((priority) => priority in priorityLabels)).toBe(true);
  });
});
