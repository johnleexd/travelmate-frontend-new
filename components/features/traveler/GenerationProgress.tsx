'use client';

import { useEffect, useState } from 'react';

export function GenerationProgress() {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return <div id="generation-progress" className="text-xs leading-5 text-white/65 md:col-span-2">
    <p role="status">{elapsed < 30 ? 'Checking verified places and arranging your itinerary.' : 'Location or AI services are taking longer than usual. Your request is still being processed; avoid starting it again.'}</p>
    <p className="mt-1" aria-live="off" data-generation-elapsed>{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')} elapsed. You can check a completed result in My Plan if you leave this page.</p>
  </div>;
}
