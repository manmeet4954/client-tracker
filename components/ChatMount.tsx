'use client';

// Where the floating chat is allowed to exist.
//
// Her decision, 2026-08-04 (the restructure handoff): the desk IS a chat. Two
// chats on one screen is two answers to the same question, so the floating
// widget stands down on `/shelf` and stays exactly as it is everywhere else.
//
// This wrapper exists so that decision lives in one small file and
// `components/ChatWidget.tsx` is never touched.

import { usePathname } from 'next/navigation';
import ChatWidget from '@/components/ChatWidget';

export default function ChatMount() {
  const pathname = usePathname();
  if (pathname === '/shelf' || pathname?.startsWith('/shelf/')) return null;

  // Inside a profile on a phone the bottom bar owns the bottom of the screen,
  // and the chat button sits exactly on top of the third app. It is lifted
  // clear by one CSS rule in globals.css rather than by editing the widget,
  // which stays frozen until the chat gets its own redesign.
  const inProfile = pathname?.startsWith('/profile/');
  return <div className={inProfile ? 'chat-lifted' : undefined}><ChatWidget /></div>;
}
