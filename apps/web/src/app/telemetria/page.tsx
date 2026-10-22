'use client';

import { Suspense } from 'react';
import { TelemetriaView } from '@/components/telemetria/TelemetriaView';

export default function TelemetriaPage() {
  return (
    <Suspense fallback={null}>
      <TelemetriaView />
    </Suspense>
  );
}
