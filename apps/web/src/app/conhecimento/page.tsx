'use client';

import { Suspense } from 'react';
import { ConhecimentoPage } from '@/components/conhecimento/ConhecimentoPage';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ConhecimentoPage />
    </Suspense>
  );
}
