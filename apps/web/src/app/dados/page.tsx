'use client';

import { Suspense } from 'react';
import { DadosPage } from '@/components/dados/DadosPage';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <DadosPage />
    </Suspense>
  );
}
