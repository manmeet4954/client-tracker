'use client';

import OrdersView from '@/components/OrdersView';

export default function OrdersPage({ params }: { params: { id: string } }) {
  return <OrdersView clientId={params.id} />;
}
