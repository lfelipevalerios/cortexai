'use client';

import { Suspense } from 'react';
import { BrainScreen } from '@/components/brain/BrainScreen';

export default function CerebroPage() {
  return (
    <Suspense>
      <BrainScreen />
    </Suspense>
  );
}
