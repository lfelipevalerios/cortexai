'use client';

import { Suspense } from 'react';
import { IniciativasScreen } from '@/components/iniciativas/IniciativasScreen';

export default function IniciativasPage() {
  return (
    <Suspense fallback={null}>
      <IniciativasScreen />
    </Suspense>
  );
}
