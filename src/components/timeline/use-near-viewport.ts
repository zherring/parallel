"use client";

import { useEffect, useState } from "react";

/**
 * `[ref, near]`: `near` turns true, and stays true, once the element the ref is attached to comes
 * within `rootMargin` of the viewport. Without IntersectionObserver it turns true right after
 * mounting, so whatever waits for it is never held back. It is false on the server and for the
 * first client render, so the HTML the server sent always hydrates cleanly.
 */
export function useNearViewport(rootMargin = "300px 0px"): [(node: Element | null) => void, boolean] {
  const [node, setNode] = useState<Element | null>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    if (!node || near) return;

    if (typeof IntersectionObserver === "undefined") {
      const timer = setTimeout(() => setNear(true), 0);
      return () => clearTimeout(timer);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setNear(true);
        observer.disconnect();
      },
      { rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, near, rootMargin]);

  return [setNode, near];
}
