'use client';

import { Suspense } from 'react';
import { ConectoresScreen } from '@/components/conectores/ConectoresScreen';

export default function ConectoresPage() {
  return (
    <Suspense fallback={null}>
      <ConectoresScreen />
    </Suspense>
  );
}
