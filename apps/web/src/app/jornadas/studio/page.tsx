'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Skeleton } from '@/components/ui';
import { Studio } from '@/components/studio/Studio';

function StudioRoute() {
  const params = useSearchParams();
  return <Studio journeyId={params.get('id') ?? undefined} />;
}

export default function StudioPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[calc(100vh-112px)] w-full" />}>
      <StudioRoute />
    </Suspense>
  );
}
