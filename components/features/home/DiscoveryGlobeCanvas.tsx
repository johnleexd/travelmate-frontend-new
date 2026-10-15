'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { countryBoundaryPositions, globePoint, globeQuality, globeZoom, shortestLongitude } from '@/lib/discovery-globe';
import { countryAt, smallCountryAt, type Country, type CountryIndex } from '@/lib/discovery-countries';
import { loadCountryPhoto } from '@/lib/discovery-country-photos';
import { discoveryCountryFlag, loadCountryFlag } from '@/lib/discovery-country-flags';
import styles from './TravelDiscovery.module.css';

type Props = { countries: CountryIndex | null; selectedCountryId: string | null; onCountrySelect: (country: Country) => void; active: boolean; paused: boolean; onUnavailable: () => void };
type Controller = { update: (props: Pick<Props, 'active' | 'paused' | 'countries' | 'selectedCountryId' | 'onCountrySelect'>) => void; zoom: (step: number) => void };

export default function DiscoveryGlobeCanvas({ active, paused, onUnavailable, countries, selectedCountryId, onCountrySelect }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const controller = useRef<Controller | null>(null);
  const latest = useRef({ active, paused, countries, selectedCountryId, onCountrySelect });

  useEffect(() => {
    latest.current = { active, paused, countries, selectedCountryId, onCountrySelect };
    controller.current?.update(latest.current);
  }, [active, paused, countries, selectedCountryId, onCountrySelect]);

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    const element = container;
    // Each effect owns a fresh canvas, including React Strict Mode remounts.
    // A context explicitly lost during cleanup cannot be reused by a new renderer.
    const surface = document.createElement('canvas');
    surface.className = styles.canvas;
    surface.setAttribute('aria-label', 'Interactive Earth. Drag horizontally to rotate; click a country or use the country selector. Hover for destination photos.');
    element.prepend(surface);
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    const constrained = window.matchMedia('(pointer: coarse)').matches || !!connection?.saveData || (navigator.hardwareConcurrency || 8) <= 4;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ canvas: surface, alpha: true, antialias: !constrained, powerPreference: 'low-power' }); }
    catch { surface.remove(); onUnavailable(); return; }

    const quality = globeQuality(constrained);
    let targetFps = quality.fps, pixelRatio = Math.min(window.devicePixelRatio || 1, quality.maxDpr);
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reduced = motion.matches, disposed = false, ready = false, dragging = false;
    let visible = latest.current.active, stopped = latest.current.paused;
    let latitude = 18, longitude = 125, distance = 3.2, targetLat = latitude, targetLon = longitude, focusing = false;
    let resumeAt = 0, wakeTimer: ReturnType<typeof setTimeout> | undefined;
    let lastFrame = 0, nextFrameAt = 0, frames = 0, sampleStarted = 0, slowFrames = 0, slowSamples = 0, drawing = false;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 20);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.setPixelRatio(pixelRatio);
    const geometry = new THREE.SphereGeometry(1, quality.segments, quality.segments / 2);
    const material = new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 18, specular: 0x122c40, emissive: 0x122d50, emissiveIntensity: 0.4 });
    scene.add(new THREE.Mesh(geometry, material));
    scene.add(new THREE.AmbientLight(0xffffff, 1.35));
    scene.add(new THREE.HemisphereLight(0xd9efff, 0x546f73, 1.5));
    // Keep the sunlight just above/left of the view so every selected continent stays readable.
    const sunlight = new THREE.DirectionalLight(0xfff1df, 1.8);
    sunlight.position.set(-3, 2.5, 4);
    camera.add(sunlight);
    scene.add(camera, sunlight.target);
    // A thin back-facing shell shares the Earth geometry: one draw, no bloom or extra texture.
    const atmosphereMaterial = new THREE.MeshBasicMaterial({
      color: 0x79b8da, side: THREE.BackSide, transparent: true, opacity: 0.16, depthWrite: false, toneMapped: false,
    });
    const atmosphere = new THREE.Mesh(geometry, atmosphereMaterial);
    atmosphere.scale.setScalar(constrained ? 1.007 : 1.01);
    scene.add(atmosphere);
    let countryIndex = latest.current.countries;
    let countrySelection: string | null = null;
    const outlineMaterial = new LineMaterial({ color: 0xffd782, linewidth: 1.8, transparent: true, opacity: 1, depthWrite: false, toneMapped: false });
    let outline: LineSegments2 | null = null;
    let outlinedCode: string | null = null;
    surface.dataset.outlinedCountry = '';
    surface.dataset.outlineSegments = '0';
    function setOutline(country: Country | null) {
      if ((country?.code || null) === outlinedCode) return;
      if (outline) { scene.remove(outline); outline.geometry.dispose(); outline = null; }
      outlinedCode = country?.code || null;
      surface.dataset.outlinedCountry = outlinedCode || '';
      surface.dataset.outlineSegments = '0';
      if (country) {
        const positions = countryBoundaryPositions(country);
        const border = new LineSegmentsGeometry().setPositions(positions);
        outline = new LineSegments2(border, outlineMaterial);
        scene.add(outline);
        surface.dataset.outlineSegments = String(positions.length / 6);
      }
      requestRender();
    }
    const raycaster = new THREE.Raycaster(), sphere = new THREE.Sphere(new THREE.Vector3(), 1);
    const pointer = new THREE.Vector2(), hit = new THREE.Vector3();
    const photoCard = element.querySelector<HTMLDivElement>('[data-country-photo]');
    let hoveredCode: string | null = null, loadedPhoto: HTMLImageElement | null = null;
    let pointerInside = false, hoverGeneration = 0;
    let hoverFrame = 0, nextHoverAt = 0, hoverX = 0, hoverY = 0;
    function countryUnder(x: number, y: number) {
      if (!ready || !countryIndex) return null;
      const rect = surface.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      pointer.set((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      if (!raycaster.ray.intersectSphere(sphere, hit)) return null;
      const lat = Math.asin(THREE.MathUtils.clamp(hit.y, -1, 1)) * 180 / Math.PI;
      const lon = Math.atan2(-hit.z, hit.x) * 180 / Math.PI;
      const exact = countryAt(countryIndex, lat, lon);
      // A real hit on a tiny area wins over a neighboring area's enlarged target.
      if (exact && countryIndex.smallCodes.has(exact.code)) return exact;
      const tolerance = Math.min(.8, 4 * (distance - 1) * Math.tan(21 * Math.PI / 180) * 2 / rect.height * 180 / Math.PI);
      return smallCountryAt(countryIndex, lat, lon, tolerance) || exact;
    }
    function clearHover() {
      pointerInside = false;
      cancelAnimationFrame(hoverFrame); hoverFrame = 0;
      if (photoCard) photoCard.hidden = true;
      setOutline(null);
      surface.dataset.hoveredCountry = '';
      hoveredCode = null; loadedPhoto = null; hoverGeneration++;
    }
    function hover(now: number) {
      if (disposed || !visible || document.hidden || dragging || !pointerInside) { hoverFrame = 0; return; }
      if (now < nextHoverAt) { hoverFrame = requestAnimationFrame(hover); return; }
      nextHoverAt = now + 40; hoverFrame = 0;
      const country = countryUnder(hoverX, hoverY);
      surface.dataset.hoveredCountry = country?.code || '';
      setOutline(country);
      if (photoCard) {
        if ((country?.code || null) !== hoveredCode) {
          hoveredCode = country?.code || null; loadedPhoto = null;
          photoCard.hidden = true;
          const generation = ++hoverGeneration;
          if (country) void Promise.all([loadCountryPhoto(country.code), loadCountryFlag(country.code, country.name)]).then(([photo, flag]) => {
            if (disposed || generation !== hoverGeneration || !pointerInside) return;
            if (photo && (!discoveryCountryFlag(country.code) || flag)) {
              loadedPhoto = photo.cloneNode() as HTMLImageElement;
              const identity = document.createElement('div');
              identity.className = styles.hoverIdentity;
              if (flag) identity.append(flag.cloneNode());
              const name = document.createElement('span');
              name.dataset.countryName = country.code;
              name.textContent = country.name;
              identity.append(name);
              photoCard.replaceChildren(loadedPhoto, identity);
              photoCard.dataset.country = country.code;
            }
            surface.dataset.photoStatus = loadedPhoto ? 'ready' : photo ? 'flag-unavailable' : 'unresolved';
          });
        }
        const show = !!loadedPhoto && loadedPhoto.complete && loadedPhoto.naturalWidth > 0;
        photoCard.hidden = !show;
        if (show) {
          const rect = surface.getBoundingClientRect();
          const x = hoverX - rect.left, y = hoverY - rect.top;
          const width = photoCard.offsetWidth, height = photoCard.offsetHeight;
          // Flip at the right/bottom edges; the entire overlay stays in the globe column.
          photoCard.style.left = Math.max(8, Math.min(x + 22 + width <= rect.width - 8 ? x + 22 : x - width - 22, rect.width - width - 8)) + 'px';
          photoCard.style.top = Math.max(8, Math.min(y - height - 22 >= 8 ? y - height - 22 : y + 22, rect.height - height - 8)) + 'px';
        }
      }
      // Re-pick with the current camera even if the pointer stays still as Earth rotates.
      hoverFrame = requestAnimationFrame(hover);
    }

    function allowed() { return ready && visible && !document.hidden && !disposed; }
    function rotating() { return !reduced && !stopped && !dragging && performance.now() >= resumeAt; }
    function requestRender() {
      if (!allowed() || drawing) return;
      drawing = true;
      surface.dataset.rendering = 'true';
      renderer.setAnimationLoop(render);
    }
    function halt() { renderer.setAnimationLoop(null); drawing = false; surface.dataset.rendering = 'false'; lastFrame = 0; nextFrameAt = 0; sampleStarted = 0; frames = 0; slowSamples = 0; }
    function scheduleResume() {
      resumeAt = performance.now() + 1800;
      clearTimeout(wakeTimer);
      wakeTimer = setTimeout(requestRender, 1850);
    }
    function render(now: number) {
      if (!allowed()) { halt(); return; }
      if (nextFrameAt && now < nextFrameAt - 1) return;
      // Retain the deadline remainder: a 30 FPS cap must not become 25 FPS on a 50 Hz display.
      nextFrameAt = nextFrameAt ? Math.max(nextFrameAt + 1000 / targetFps, now) : now + 1000 / targetFps;
      const elapsed = lastFrame ? Math.min((now - lastFrame) / 1000, 0.1) : 0;
      lastFrame = now;
      if (focusing) {
        const blend = reduced ? 1 : 1 - Math.exp(-elapsed * 7);
        latitude += (targetLat - latitude) * blend;
        longitude += (targetLon - longitude) * blend;
        if (Math.abs(targetLat - latitude) + Math.abs(targetLon - longitude) < 0.12 || reduced) {
          latitude = targetLat; longitude = targetLon; focusing = false;
        }
      } else if (rotating()) longitude += elapsed * 2;
      camera.position.set(...globePoint(latitude, longitude)).multiplyScalar(distance);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();
      const before = performance.now();
      renderer.render(scene, camera);
      surface.dataset.lines = String(renderer.info.render.lines);
      surface.dataset.points = String(renderer.info.render.points);
      const renderTime = performance.now() - before;
      if (renderTime > 24) slowFrames++; else slowFrames = Math.max(0, slowFrames - 1);
      if (slowFrames > 20 && targetFps > 30) {
        targetFps = 30; pixelRatio = 1; renderer.setPixelRatio(pixelRatio);
        renderer.setSize(element.clientWidth, element.clientHeight, false);
        surface.dataset.quality = 'reduced'; atmosphere.visible = false; slowFrames = 0;
      }
      // Low-frequency diagnostics support real measurements without React frame updates.
      frames++;
      if (!sampleStarted) sampleStarted = now;
      if (now - sampleStarted >= 1000) {
        const fps = Math.round(frames * 1000 / (now - sampleStarted));
        surface.dataset.fps = String(fps);
        slowSamples = fps < 42 ? slowSamples + 1 : 0;
        if (slowSamples >= 3 && targetFps > 30) {
          targetFps = 30; pixelRatio = 1; renderer.setPixelRatio(pixelRatio);
          renderer.setSize(element.clientWidth, element.clientHeight, false);
          surface.dataset.quality = 'reduced'; atmosphere.visible = false;
        }
        sampleStarted = now; frames = 0;
      }
      surface.dataset.longitude = longitude.toFixed(2);
      surface.dataset.latitude = latitude.toFixed(2);
      surface.dataset.distance = distance.toFixed(2);
      surface.dataset.selectedCountry = countrySelection || '';
      surface.dataset.state = focusing ? 'focusing' : rotating() ? 'rotating' : 'paused';
      if (!focusing && !rotating()) halt();
    }
    function resize() {
      if (disposed) return;
      const width = element.clientWidth, height = element.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      requestRender();
    }
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    function update(next: Pick<Props, 'active' | 'paused' | 'countries' | 'selectedCountryId' | 'onCountrySelect'>) {
      visible = next.active; stopped = next.paused; countryIndex = next.countries;
      if (next.selectedCountryId !== countrySelection) {
        countrySelection = next.selectedCountryId;
        const country = countryIndex?.countries.find(item => item.id === countrySelection);
        if (country) {
          targetLat = country.center[1]; targetLon = shortestLongitude(longitude, country.center[0]);
          focusing = true; scheduleResume();
        }
        clearHover();
      }
      if (!visible) clearHover();
      if (allowed()) requestRender(); else halt();
    }
    controller.current = {
      update,
      zoom(step) { distance = globeZoom(distance + step); scheduleResume(); requestRender(); },
    };
    let pointerId: number | null = null, previousX = 0, previousY = 0, startX = 0, startY = 0, moved = false;
    function down(event: PointerEvent) {
      if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return;
      pointerId = event.pointerId; previousX = event.clientX; previousY = event.clientY;
      startX = event.clientX; startY = event.clientY; moved = false;
      clearHover(); dragging = true; focusing = false;
      surface.setPointerCapture(event.pointerId);
      requestRender();
    }
    function move(event: PointerEvent) {
      if (pointerId === null && event.pointerType === 'mouse') {
        if ((event.target as HTMLElement).closest('[data-globe-zoom]')) { clearHover(); return; }
        pointerInside = true;
        hoverX = event.clientX; hoverY = event.clientY;
        if (!hoverFrame) hoverFrame = requestAnimationFrame(hover);
        return;
      }
      if (event.pointerId !== pointerId) return;
      moved ||= Math.hypot(event.clientX - startX, event.clientY - startY) > 5;
      longitude -= (event.clientX - previousX) * 0.3;
      if (event.pointerType === 'mouse') latitude = THREE.MathUtils.clamp(latitude + (event.clientY - previousY) * 0.25, -75, 75);
      previousX = event.clientX; previousY = event.clientY;
      requestRender();
    }
    function up(event: PointerEvent) {
      if (event.pointerId !== pointerId) return;
      if (surface.hasPointerCapture(event.pointerId)) surface.releasePointerCapture(event.pointerId);
      pointerId = null; dragging = false;
      if (!moved && event.type === 'pointerup') {
        const country = countryUnder(event.clientX, event.clientY);
        if (country) latest.current.onCountrySelect(country);
      }
      scheduleResume(); requestRender();
    }
    function leave() { clearHover(); }
    function visibility() { if (document.hidden) { clearHover(); halt(); } else requestRender(); }
    function motionChange() { reduced = motion.matches; requestRender(); }
    function contextLost(event: Event) { event.preventDefault(); halt(); onUnavailable(); }
    surface.addEventListener('pointerdown', down);
    element.addEventListener('pointermove', move);
    surface.addEventListener('pointerup', up);
    surface.addEventListener('pointercancel', up);
    element.addEventListener('pointerleave', leave);
    document.addEventListener('visibilitychange', visibility);
    motion.addEventListener('change', motionChange);
    surface.addEventListener('webglcontextlost', contextLost);
    surface.dataset.quality = constrained ? 'reduced' : 'standard';
    const texture = new THREE.TextureLoader().load('/discovery/earth-' + quality.texture + '.webp', loaded => {
      if (disposed) { loaded.dispose(); return; }
      loaded.colorSpace = THREE.SRGBColorSpace;
      loaded.minFilter = THREE.LinearMipmapLinearFilter;
      loaded.magFilter = THREE.LinearFilter;
      loaded.anisotropy = Math.min(constrained ? 2 : 4, Math.max(1, renderer.capabilities.getMaxAnisotropy()));
      loaded.needsUpdate = true;
      material.map = loaded; material.needsUpdate = true; ready = true;
      surface.dataset.ready = 'true'; resize(); update(latest.current);
    }, undefined, () => { if (!disposed) onUnavailable(); });

    return () => {
      disposed = true; controller.current = null; halt(); cancelAnimationFrame(hoverFrame); clearTimeout(wakeTimer); observer.disconnect();
      surface.removeEventListener('pointerdown', down);
      element.removeEventListener('pointermove', move);
      surface.removeEventListener('pointerup', up);
      surface.removeEventListener('pointercancel', up);
      element.removeEventListener('pointerleave', leave);
      document.removeEventListener('visibilitychange', visibility);
      motion.removeEventListener('change', motionChange);
      surface.removeEventListener('webglcontextlost', contextLost);
      geometry.dispose(); material.dispose(); atmosphereMaterial.dispose(); texture?.dispose();
      outline?.geometry.dispose(); outlineMaterial.dispose();
      scene.clear(); renderer.dispose(); renderer.forceContextLoss(); surface.remove();
    };
  }, [onUnavailable]);

  return (
    <div ref={host} className={styles.canvasHost}>
      <div hidden data-country-photo className={styles.hoverPhoto} />
      <div data-globe-zoom className={styles.zoom}>
        <button type="button" aria-label="Zoom in globe" onClick={() => controller.current?.zoom(-0.25)}>+</button>
        <button type="button" aria-label="Zoom out globe" onClick={() => controller.current?.zoom(0.25)}>−</button>
      </div>
    </div>
  );
}
