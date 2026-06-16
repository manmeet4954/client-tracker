import type { MetadataRoute } from 'next';

// The web-spec share_target shape (object params, "GET") differs from Next's
// stricter type, so we cast just this piece. The runtime JSON is what Chrome
// needs for the install-to-share-sheet flow.
const shareTarget = {
  action: '/share-target',
  method: 'GET',
  params: { title: 'title', text: 'text', url: 'url' },
} as unknown as MetadataRoute.Manifest['share_target'];

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'My Clients',
    short_name: 'My Clients',
    description: 'Client content tracker — kanban, brand, studio',
    start_url: '/',
    display: 'standalone',
    background_color: '#1c1917',
    theme_color: '#1c1917',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
    // Lets the installed app appear in the OS share sheet (Android). Shared
    // links land on /share-target and get saved to References.
    share_target: shareTarget,
  };
}
