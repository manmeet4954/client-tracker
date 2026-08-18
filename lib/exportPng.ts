// Save a piece of the page as a PNG — 2026-08-17.
//
// The pattern already existed twice (StudioTemplates, StudioFreeform) and this
// is it, named once so the mockup does not become a third copy. Those two are
// left alone deliberately: moving them is a refactor nobody asked for.
//
// WHY IT TAKES AN OFFSCREEN NODE. The mockup on screen is inside a
// `transform: scale()` — that is what makes it responsive — so capturing what
// is visible would bake in whatever size the window happened to be, and hand
// her a small, soft picture. The caller renders the same components once more
// at their TRUE width, offscreen, and points this at that instead.

export async function downloadPng(node: HTMLElement, filename: string, opts?: {
  background?: string;
  /** 2 is a retina-quality file. Higher is bigger, not sharper, past a point. */
  pixelRatio?: number;
}): Promise<void> {
  const { toPng } = await import('html-to-image');

  // Fonts first: capturing before they load renders the fallback face, and the
  // difference is obvious on a profile mockup where the type IS the design.
  const fonts = (document as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts;
  if (fonts?.ready) await fonts.ready;

  const url = await toPng(node, {
    pixelRatio: opts?.pixelRatio ?? 2,
    cacheBust: true,
    backgroundColor: opts?.background,
  });

  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.png') ? filename : `${filename}.png`;
  a.click();
}

/** "riti-profile-2026-08-17.png" — readable in a downloads folder a year later. */
export function pngName(parts: (string | undefined)[]): string {
  const slug = parts
    .filter(Boolean)
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'mockup'}.png`;
}
