'use client';

import CostumeView from '@/components/CostumeView';

/** Spec 24 §3.2: the costume surface opens from "Make a piece from this", on a
 *  locked seed, at creation/engine/costume/<seed id> inside the profile. */
export default function CostumePage({ params }: { params: { id: string; seedId: string } }) {
  return <CostumeView clientId={params.id} seedId={params.seedId} />;
}
