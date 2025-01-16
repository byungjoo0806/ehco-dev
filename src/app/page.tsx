import { analytics } from '@/lib/firebase';
import { logEvent } from 'firebase/analytics';

export default function Home() {
  // When you want to log an event
  if (analytics) {
    logEvent(analytics, 'page_view', {
      page_title: document.title,
      page_location: window.location.href,
    });
  }

  return (
    <main>
      <h1>Welcome to my website</h1>
      <p>This will now show up at the root URL (/)</p>
    </main>
  );
}