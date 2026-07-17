// Extract the shortcode from an Instagram post URL. The shortcode is the
// shared key between a card's pasted postUrl and the permalink the Graph API
// reports for the same post, so both sides run through this one function.
//
// Handles instagram.com/p/{code}, /reel/{code}, /reels/{code}, an optional
// username segment before it, www or not, trailing slash, query params.
export function extractIgShortcode(url: string | undefined | null): string | null {
  if (!url) return null;
  const m = url.match(/instagram\.com\/(?:[^/?#]+\/)?(?:p|reel|reels)\/([A-Za-z0-9_-]+)/i);
  return m ? m[1] : null;
}
