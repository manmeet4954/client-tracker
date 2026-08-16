'use client';

// Intake — the door. It renders `Known`, and that is the whole screen.
//
// It used to be a segmented shell over "Rounds" and "Curation", two screens
// holding one set of information under two nouns she never chose. Her verdict
// on 2026-08-10 was "you have not understood the terminologies", and on
// 2026-08-11: "make it simple... what will proceed where."
//
// So this file keeps only what a door owes: the owner check and the body gate.
// Everything else moved into `Known`, which is the store of what is known about
// a client, with three equal ways in.
//
// The old screens are NOT deleted. Strategy → Intake history still renders
// `Rounds` and `Curation` over the rounds that already exist, so every question
// asked and every answer filed before today reads exactly as it did.

import Known from './Known';

export default function IntakeApp({ clientId }: { clientId: string }) {
  return <Known clientId={clientId} />;
}
