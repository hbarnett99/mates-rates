import { appIcon } from '@/app/app-icon';

const SIZES = ['192', '512'] as const;

export const dynamicParams = false;

export function generateStaticParams() {
  return SIZES.map((size) => ({ size }));
}

/** /icons/192 and /icons/512 for the web manifest. */
export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  return appIcon(Number(size));
}
