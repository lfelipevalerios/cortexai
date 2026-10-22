'use client';

import { Suspense } from 'react';
import { GovernancaView } from '@/components/governanca/GovernancaView';

export default function GovernancaPage() {
  return (
    <Suspense fallback={null}>
      <GovernancaView />
    </Suspense>
  );
}
