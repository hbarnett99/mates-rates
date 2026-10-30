import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applyTagRules, isTag, TAGS, tagsFromText } from './rules';

describe('TAGS', () => {
  it('matches the check constraint in the migration', () => {
    const sql = readFileSync(new URL('../../db/migrations/0001_init.sql', import.meta.url), 'utf8');
    const constraint = /tags <@ array\[([\s\S]*?)\]::text\[\]/.exec(sql);
    expect(constraint).not.toBeNull();
    const sqlTags = [...(constraint?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(sqlTags).toEqual([...TAGS]);
  });

  it('recognises only listed tags', () => {
    expect(isTag('parma')).toBe(true);
    expect(isTag('happy hour')).toBe(true);
    expect(isTag('Parma')).toBe(false);
    expect(isTag('tapas')).toBe(false);
  });
});

describe('tagsFromText', () => {
  it.each([
    ['Parma + pot', ['parma']],
    ['Chicken parmi Wednesday', ['parma']],
    ['$35 Sunday roast', ['roast']],
    ['Tonkotsu ramen', ['Asian']],
    ['Pho and a beer', ['Asian']],
    ['Pork dumplings x10', ['Asian']],
    ['Bao buns', ['Asian']],
    ['Sushi train', ['Asian']],
    ['Laksa lunch', ['Asian']],
    ['$1 wings', ['wings']],
    ['Taco Tuesday', ['Mexican']],
    ['$8 pints', ['pints']],
    ['Happy hour', ['happy hour']],
    ['Happy  Hour spritz', ['happy hour', 'cocktails']],
    ['Steak and a glass of wine', ['steak', 'wine']],
    ['Kids eat free', ['kids eat free']],
    ['Trivia night', ['trivia']],
  ])('%s -> %j', (title, tags) => {
    expect(tagsFromText(title, null)).toEqual(tags);
  });

  it('is case-insensitive', () => {
    expect(tagsFromText('PARMA', null)).toEqual(['parma']);
    expect(tagsFromText('RaMeN', null)).toEqual(['Asian']);
  });

  it('reads the notes as well as the title', () => {
    expect(tagsFromText('Wednesday special', 'Chicken parmi with chips')).toEqual(['parma']);
  });

  it('matches whole words only', () => {
    expect(tagsFromText('Baobab smoothie', null)).toEqual([]);
    expect(tagsFromText('Phone it in', null)).toEqual([]);
    expect(tagsFromText('Selfish', null)).toEqual([]);
    expect(tagsFromText('Pinto beans', null)).toEqual([]);
  });

  it('returns tags in list order without duplicates', () => {
    expect(tagsFromText('Ramen, then a parma, then more ramen', 'Pho too')).toEqual(['parma', 'Asian']);
  });

  it('finds nothing in unrelated text', () => {
    expect(tagsFromText('Two for one', 'Mains only')).toEqual([]);
  });
});

describe('applyTagRules', () => {
  it('adds rule tags to the hand-picked ones', () => {
    expect(applyTagRules({ title: 'Parma + pot', notes: null, tags: ['pints'] })).toEqual(['parma', 'pints']);
  });

  it('keeps hand-picked tags the rules would not find', () => {
    expect(applyTagRules({ title: 'Tuesday deal', notes: null, tags: ['trivia'] })).toEqual(['trivia']);
  });

  it('respects rule tags the person removed', () => {
    expect(applyTagRules({ title: 'Parma + pot', notes: null, tags: [], dismissed: ['parma'] })).toEqual([]);
  });

  it('keeps a dismissed tag if it was also picked by hand', () => {
    expect(applyTagRules({ title: 'Parma', notes: null, tags: ['parma'], dismissed: ['parma'] })).toEqual(['parma']);
  });

  it('drops tags that are not on the list', () => {
    expect(applyTagRules({ title: 'Ramen', notes: null, tags: ['tapas', 'Parma'] })).toEqual(['Asian']);
  });

  it('dedupes and sorts into list order', () => {
    expect(applyTagRules({ title: 'Ramen', notes: null, tags: ['wine', 'Asian', 'wine'] })).toEqual(['Asian', 'wine']);
  });
});
