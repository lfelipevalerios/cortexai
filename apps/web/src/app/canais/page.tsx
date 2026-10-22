'use client';

import { Suspense } from 'react';
import { CanaisView } from '@/components/canais/CanaisView';
import { Skeleton } from '@/components/ui';
import { useOptionalWs } from '@/lib/store';

export default function CanaisPage() {
  const ws = useOptionalWs();
  if (!ws) return null;
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <CanaisView />
    </Suspense>
  );
}
