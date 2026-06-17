// Extracted import images come back as relative URLs (/api/import-image?path=…)
// served by the Laravel backend, which lives on a different origin than this app.
const BACKEND_ORIGIN = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export const resolveImageUrl = (url: string): string =>
  url.startsWith('http') ? url : `${BACKEND_ORIGIN}${url}`;
