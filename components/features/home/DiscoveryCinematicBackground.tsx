'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import styles from './TravelDiscovery.module.css';

type DeviceNavigator = Navigator & {
  deviceMemory?: number;
  connection?: EventTarget & { saveData?: boolean };
};

function subscribeVisibility(change: () => void) {
  document.addEventListener('visibilitychange', change);
  return () => document.removeEventListener('visibilitychange', change);
}
function readVisibility() { return !document.hidden; }

function subscribeCapability(change: () => void) {
  const connection = (navigator as DeviceNavigator).connection;
  const slowUpdate = window.matchMedia('(update: slow)');
  connection?.addEventListener('change', change);
  slowUpdate.addEventListener('change', change);
  return () => {
    connection?.removeEventListener('change', change);
    slowUpdate.removeEventListener('change', change);
  };
}
function readConstrainedDevice() {
  const device = navigator as DeviceNavigator;
  return Boolean(device.connection?.saveData
    || (device.hardwareConcurrency > 0 && device.hardwareConcurrency <= 2)
    || (device.deviceMemory !== undefined && device.deviceMemory <= 2)
    || window.matchMedia('(update: slow)').matches);
}

function subscribeMobileViewport(change: () => void) {
  const query = window.matchMedia('(max-width: 760px)');
  query.addEventListener('change', change);
  return () => query.removeEventListener('change', change);
}
function readMobileViewport() { return window.matchMedia('(max-width: 760px)').matches; }

function AtmosphereTexture({ kind, prioritize }: { kind: 'clouds' | 'mist'; prioritize: boolean }) {
  const [failed, setFailed] = useState(false);
  const element = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (failed || !prioritize || !element.current || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(entries => setInView(entries.some(entry => entry.isIntersecting)));
    observer.observe(element.current);
    return () => observer.disconnect();
  }, [prioritize, failed]);
  const urgent = prioritize && inView;
  if (failed) return null;
  return <div ref={element} className={styles[kind]} data-atmosphere={kind}>
    <picture>
      <source media="(max-width: 760px)" srcSet={'/discovery/cinematic/' + kind + '-layer-mobile-v1.webp'} type="image/webp" />
      <Image src={'/discovery/cinematic/' + kind + '-layer-v1.webp'} alt="" fill unoptimized loading={urgent ? 'eager' : 'lazy'} fetchPriority={urgent ? 'high' : 'auto'} decoding="async" sizes="130vw" onError={() => setFailed(true)} />
    </picture>
  </div>;
}

/** Decorative illustration only; independent of globe rendering and destination photographs. */
export default function DiscoveryCinematicBackground({ enabled, reducedMotion }: {
  enabled: boolean;
  reducedMotion: boolean;
}) {
  const layer = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [scene, setScene] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const mobileViewport = useSyncExternalStore(subscribeMobileViewport, readMobileViewport, () => false);
  const visible = useSyncExternalStore(subscribeVisibility, readVisibility, () => false);
  const constrained = useSyncExternalStore(subscribeCapability, readConstrainedDevice, () => true);

  useEffect(() => {
    if (!layer.current || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(entries => {
      setInView(entries.some(entry => entry.isIntersecting));
    });
    observer.observe(layer.current);
    return () => observer.disconnect();
  }, []);

  const motion = reducedMotion || constrained ? 'static' : enabled && inView && visible ? 'running' : 'paused';
  return (
    <div ref={layer} className={styles.cinematicBackground} aria-hidden="true"
      data-cinematic-background data-motion={motion} data-scene={enabled ? scene : 'idle'}>
      {enabled && scene !== 'unavailable' && <picture className={styles.scenery}>
        <source media="(max-width: 760px)" srcSet="/discovery/cinematic/tropical-sunset-mobile.webp" type="image/webp" />
        <source media="(max-width: 1100px)" srcSet="/discovery/cinematic/tropical-sunset-tablet.webp" type="image/webp" />
        <Image src="/discovery/cinematic/tropical-sunset-desktop.webp" alt="" fill unoptimized
          sizes="100vw" loading={inView && !mobileViewport ? 'eager' : 'lazy'}
          fetchPriority={inView && !mobileViewport ? 'high' : 'auto'} decoding="async"
          onLoad={() => setScene('ready')} onError={() => setScene('unavailable')} />
      </picture>}
      <div className={styles.sunlight} data-atmosphere="sunlight" />
      <div className={styles.sceneryShade} />
      {enabled && scene !== 'unavailable' && <>
        <AtmosphereTexture kind="clouds" prioritize={false} />
        <AtmosphereTexture kind="mist" prioritize={mobileViewport} />
      </>}
    </div>
  );
}
