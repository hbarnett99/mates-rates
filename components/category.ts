import type { DealCategory } from '@/lib/db/types';

/** Pin and price-pill colours: food amber, drink teal, both violet, all with dark text. */
export const CATEGORY_CLASS: Record<DealCategory, string> = {
  food: 'bg-food text-pin-text',
  drink: 'bg-drink text-pin-text',
  both: 'bg-both text-pin-text',
};

export const CATEGORY_BG: Record<DealCategory, string> = {
  food: 'bg-food',
  drink: 'bg-drink',
  both: 'bg-both',
};

export const CATEGORY_LABEL: Record<DealCategory, string> = {
  food: 'Food',
  drink: 'Drink',
  both: 'Food & drink',
};
