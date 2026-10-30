import type { DealRow, VenueRow } from '@/lib/db/types';

/** A deal as the app uses it: joined to its venue and who added it. */
export type Deal = DealRow & {
  venue: VenueRow;
  creator: { display_name: string | null } | null;
};

/** Who is looking, for deciding what they can edit. */
export type Viewer = { id: string; isOwner: boolean };

export function canEdit(viewer: Viewer, row: { created_by: string | null }): boolean {
  return viewer.isOwner || row.created_by === viewer.id;
}
