import { useEffect, useCallback } from 'react';

/**
 * Hook für dynamische Iframe-Höhenanpassung via postMessage.
 * Sendet die aktuelle Höhe des Dokuments an das Parent-Fenster.
 */
export function useIframeResize(dependencies: unknown[] = []) {
  const sendHeight = useCallback(() => {
    // Nur wenn wir in einem iframe sind
    if (window.parent === window) return;

    // Berechne die tatsächliche Höhe des Inhalts
    const height = Math.max(
      document.body.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.scrollHeight,
      document.documentElement.offsetHeight
    );

    // Sende Höhe an Parent
    window.parent.postMessage(
      { type: 'orthopaedie-booking-resize', height },
      '*'
    );
  }, []);

  useEffect(() => {
    // Initial senden
    sendHeight();

    // Bei Resize senden
    window.addEventListener('resize', sendHeight);

    // MutationObserver für DOM-Änderungen
    const observer = new MutationObserver(() => {
      // Kurze Verzögerung für Render-Abschluss
      requestAnimationFrame(sendHeight);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true
    });

    return () => {
      window.removeEventListener('resize', sendHeight);
      observer.disconnect();
    };
  }, [sendHeight]);

  // Bei Dependency-Änderungen (z.B. Step-Wechsel) erneut senden
  useEffect(() => {
    // Verzögerung für Animation/Transition
    const timeout = setTimeout(sendHeight, 100);
    return () => clearTimeout(timeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  return sendHeight;
}
