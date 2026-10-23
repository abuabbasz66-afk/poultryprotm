export const SITEMAP_BASE_URL = "https://poultrypro.life";
const PAGE_SIZE = 500;
const PUBLIC_PATHS = ["/", "/pricing", "/privacy", "/terms", "/academy", "/presentation", "/achievements"];

type Tutorial = { slug: string; is_published: boolean; is_archived: boolean };

export async function loadPublicTutorials(
  readPage: (offset: number, limit: number) => Promise<Tutorial[]>,
): Promise<Tutorial[]> {
  const tutorials: Tutorial[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await readPage(offset, PAGE_SIZE);
    tutorials.push(...page.filter((item) => item.is_published && !item.is_archived));
    if (page.length < PAGE_SIZE) return tutorials;
  }
}

function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };
    return entities[character] ?? character;
  });
}

export function buildPublicSitemap(tutorials: Tutorial[]): string {
  const paths = new Set(PUBLIC_PATHS);
  for (const tutorial of tutorials) {
    if (tutorial.is_published && !tutorial.is_archived && tutorial.slug.trim()) {
      paths.add(`/academy/${encodeURIComponent(tutorial.slug)}`);
    }
  }
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...Array.from(paths, (path) => `  <url><loc>${escapeXml(SITEMAP_BASE_URL + path)}</loc></url>`),
    '</urlset>',
  ].join("\n");
}