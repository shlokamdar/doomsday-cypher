import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePrefersReducedMotion } from "../../hooks/store";
import { DoomScene, webglAvailable } from "./DoomScene";

/**
 * Full-screen fixed WebGL backdrop for the home page. Rendered into <body> through a portal so
 * route-transition transforms can't break `position: fixed`. Scroll progress drives the camera.
 */
export default function DoomCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = usePrefersReducedMotion();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // body paints a solid background over negative z-index layers; let the scene show through
    const prevBg = document.body.style.background;
    document.body.style.background = "transparent";
    const restoreBg = () => {
      document.body.style.background = prevBg;
    };
    const cv = ref.current;
    if (!cv) return restoreBg;
    if (!webglAvailable()) {
      setFailed(true);
      return restoreBg;
    }
    let scene: DoomScene;
    try {
      scene = new DoomScene(cv);
    } catch {
      setFailed(true);
      return restoreBg;
    }
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      scene.setScroll(max > 0 ? window.scrollY / max : 0);
      if (reduced) scene.renderStill();
    };
    const onPointer = (e: PointerEvent) => scene.setPointer(e.clientX / window.innerWidth - 0.5, e.clientY / window.innerHeight - 0.5);
    const onResize = () => {
      scene.resize();
      if (reduced) scene.renderStill();
    };
    const onVis = () => (document.hidden ? scene.stop() : !reduced && scene.start());
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVis);
    if (!reduced) window.addEventListener("pointermove", onPointer);
    onScroll();
    if (reduced) scene.renderStill();
    else scene.start();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointermove", onPointer);
      scene.dispose();
      restoreBg();
    };
  }, [reduced]);

  return createPortal(
    <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden>
      {failed ? (
        <div className="h-full w-full bg-[radial-gradient(ellipse_at_65%_45%,rgba(43,214,123,0.25),transparent_45%),radial-gradient(ellipse_at_70%_50%,rgba(224,64,138,0.18),transparent_60%)]" />
      ) : (
        <canvas ref={ref} className="h-full w-full" />
      )}
      {/* vignette + scanlines over the 3D */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(7,9,13,0.8)_100%)]" />
      <div className="scanlines absolute inset-0 opacity-50" />
    </div>,
    document.body,
  );
}
