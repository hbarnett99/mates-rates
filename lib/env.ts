// Public env vars. Each is read with a literal process.env.NEXT_PUBLIC_*
// expression so Next.js can inline it into the browser bundle.

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing environment variable ${name}. See .env.example.`);
  return value;
}

export function googleMapsApiKey(): string {
  return required('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);
}

export function googleMapId(): string {
  return required('NEXT_PUBLIC_GOOGLE_MAP_ID', process.env.NEXT_PUBLIC_GOOGLE_MAP_ID);
}
