import { useRouter } from 'expo-router';
import { useEffect } from 'react';

// Where the Google bridge page sends the phone back (services/google-sign-in.ts).
// On Android the link also reaches the router while the browser sheet hands
// the result to the app, so this screen only steps back to where the person was.
export default function GoogleAuthReturn() {
  const router = useRouter();
  useEffect(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);
  return null;
}
