import { NotFoundScreen } from '@/components/errors/AppErrorScreens';
import { usePathname, useRouter } from 'expo-router';
import React from 'react';

// Any address with no screen behind it (an old notification, a link from
// before a screen moved) lands on HaNet's own error screen instead of
// expo-router's default.
export default function NotFound() {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <NotFoundScreen
      path={pathname}
      onHome={() => router.replace('/')}
      onBack={router.canGoBack() ? () => router.back() : undefined}
    />
  );
}
