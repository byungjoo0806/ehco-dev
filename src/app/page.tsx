import { initializeAnalytics } from '@/lib/firebase';
import { logEvent } from 'firebase/analytics';

export default function Home() {
  return (
    <main>
      <h1>Welcome to my website</h1>
      <p>This will now show up at the root URL (/)</p>
    </main>
  );
}