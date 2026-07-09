'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/contexts/AppContext';
import ContainerMapView from '@/components/ContainerMapView';
import { buildContainerSeed } from '@/lib/containerSeed';

export default function MapPage() {
  const { role, state, dispatch } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (role !== 'owner') router.replace('/clients');
  }, [role, router]);

  // First open: lay the Container plan out. Never touches a non-empty map.
  const empty = (state.containerMap?.nodes?.length ?? 0) === 0;
  useEffect(() => {
    if (role === 'owner' && empty) {
      dispatch({ type: 'SEED_CONTAINER_MAP', payload: { nodes: buildContainerSeed() } });
    }
  }, [role, empty, dispatch]);

  if (role !== 'owner') return null;
  return <ContainerMapView />;
}
