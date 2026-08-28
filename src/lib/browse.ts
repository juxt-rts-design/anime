export function browseCatalogPath(cat: string, title?: string) {
  const params = new URLSearchParams({ cat });
  if (title) params.set('title', title);
  return `/browse?${params.toString()}`;
}

export function browseGenrePath(genreId: string) {
  return `/browse?genre=${encodeURIComponent(genreId)}`;
}
