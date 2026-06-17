'use client';

import OnboardingView from '@/components/OnboardingView';

export default function OnboardingPage({ params }: { params: { id: string } }) {
  return <OnboardingView clientId={params.id} />;
}
