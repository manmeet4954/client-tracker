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
    // NOT cacheBust: it appends a query string to every image URL, and the
    // pictures reaching this point are already data URLs — appending to one
    // corrupts it. Cache-busting was for the old path where the browser
    // fetched them; `toDataUrl` does that now, with `cache: 'reload'`.
    cacheBust: false,
    backgroundColor: opts?.background,
    // The pictures live on Cloudinary, so they are fetched cross-origin before
    // being inlined. Without `mode: 'cors'` the browser taints the canvas, the
    // image is dropped WITHOUT AN ERROR, and the file comes back with an empty
    // avatar, empty highlight circles and a blank grid. That is exactly what
    // her first download looked like, and the silence is what made it hard to
    // see. The `<img>` tags ask for it too (crossOrigin), because both halves
    // are needed.
    fetchRequestInit: { mode: 'cors', cache: 'no-cache' },
  });

  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.png') ? filename : `${filename}.png`;
  a.click();
}

/**
 * Turn a remote picture into a data URL.
 *
 * 2026-08-17, and this is the second attempt at the same bug. Adding
 * `crossOrigin` to the tags was not enough: the browser had ALREADY cached
 * those images without CORS for the copy on screen, and it happily serves the
 * cached, unreadable one to the capture. The canvas is then tainted, the image
 * is dropped WITHOUT AN ERROR, and the file arrives with an empty avatar and a
 * blank grid — twice.
 *
 * So the pictures are fetched here, by us, and handed to the capture already
 * inlined. Nothing is left for the browser to refuse.
 *
 * A URL that cannot be read comes back as '' rather than throwing: one bad
 * picture should cost that picture, not the whole download.
 */
export async function toDataUrl(url: string): Promise<string> {
  if (!url || url.startsWith('data:')) return url;
  try {
    // THROUGH OUR OWN SERVER (2026-08-17, after three failed browser-side
    // attempts). The pictures live on another origin and the browser refused
    // to let the canvas read them, from cache and then on a direct fetch, each
    // time SILENTLY. A server has no same-origin rule, so `/api/img` fetches
    // the picture and hands it back from this app's address, and there is
    // nothing left to refuse.
    const res = await fetch(`/api/img?u=${encodeURIComponent(url)}`, { cache: 'no-store' });
    if (!res.ok) return '';
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
}

/**
 * Every picture in the node is decoded before the shot is taken. Without this
 * the capture can run a frame early and catch a half-drawn grid.
 */
export async function imagesReady(node: HTMLElement): Promise<void> {
  const imgs = Array.from(node.querySelectorAll('img'));
  await Promise.all(imgs.map(img => (
    img.complete ? img.decode().catch(() => undefined) : new Promise<void>(res => {
      img.onload = () => res();
      img.onerror = () => res();
    })
  )));
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
