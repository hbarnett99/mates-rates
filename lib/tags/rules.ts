/**
 * The fixed tag list. Must match the check constraint on deals.tags in
 * db/migrations/0001_init.sql (rules.test.ts checks this).
 */
export const TAGS = [
  'steak',
  'parma',
  'roast',
  'burger',
  'pizza',
  'wings',
  'Mexican',
  'Asian',
  'Indian',
  'Italian',
  'seafood',
  'brunch',
  'lunch special',
  'happy hour',
  'pints',
  'cocktails',
  'wine',
  'trivia',
  'kids eat free',
] as const;

export type Tag = (typeof TAGS)[number];

const TAG_SET: ReadonlySet<string> = new Set(TAGS);

export function isTag(value: string): value is Tag {
  return TAG_SET.has(value);
}

/**
 * Keywords that add each tag. Matched case-insensitively as whole words, so
 * "bao" matches "Bao buns" but not "baobab". A trailing "s" is optional, so
 * "dumpling" also matches "dumplings".
 */
const KEYWORDS: Record<Tag, readonly string[]> = {
  steak: ['steak', 'scotch fillet', 'eye fillet', 'rump', 'sirloin', 'porterhouse', 't-bone', 'ribeye', 'rib eye'],
  parma: ['parma', 'parmi', 'parmy', 'parmigiana'],
  roast: ['roast'],
  burger: ['burger'],
  pizza: ['pizza'],
  wings: ['wing'],
  Mexican: ['mexican', 'taco', 'burrito', 'nacho', 'quesadilla', 'enchilada'],
  Asian: ['asian', 'ramen', 'pho', 'dumpling', 'bao', 'sushi', 'laksa'],
  Indian: ['indian', 'biryani', 'butter chicken', 'tandoori', 'tikka', 'naan'],
  Italian: ['italian', 'pasta', 'gnocchi', 'risotto', 'lasagne', 'lasagna', 'carbonara'],
  seafood: ['seafood', 'fish', 'oyster', 'mussel', 'prawn', 'calamari', 'scallop'],
  brunch: ['brunch'],
  'lunch special': ['lunch special', 'lunch deal'],
  'happy hour': ['happy hour'],
  pints: ['pint'],
  cocktails: ['cocktail', 'spritz', 'negroni', 'martini'],
  wine: ['wine', 'vino'],
  trivia: ['trivia', 'quiz'],
  'kids eat free': ['kids eat free', 'kids free'],
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const PATTERNS: ReadonlyArray<readonly [Tag, RegExp]> = TAGS.map((tag) => {
  const alternatives = KEYWORDS[tag].map((k) => escapeRegExp(k).replace(/ /g, '\\s+')).join('|');
  // Letters/digits either side would make it part of another word.
  return [tag, new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternatives})s?(?![\\p{L}\\p{N}])`, 'iu')] as const;
});

/** Tags the keyword rules find in a deal's title and notes, in TAGS order. */
export function tagsFromText(title: string, notes: string | null): Tag[] {
  const text = notes ? `${title}\n${notes}` : title;
  return PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([tag]) => tag);
}

/**
 * The tags to save: the ones picked by hand plus any the keyword rules find,
 * minus any rule tags the person untapped in the form. Unknown tags are
 * dropped. Returned in TAGS order with no duplicates.
 */
export function applyTagRules(input: {
  title: string;
  notes: string | null;
  tags: readonly string[];
  dismissed?: readonly string[];
}): Tag[] {
  const dismissed = new Set(input.dismissed ?? []);
  const chosen = new Set<string>(input.tags);
  for (const tag of tagsFromText(input.title, input.notes)) {
    if (!dismissed.has(tag)) chosen.add(tag);
  }
  return TAGS.filter((tag) => chosen.has(tag));
}
