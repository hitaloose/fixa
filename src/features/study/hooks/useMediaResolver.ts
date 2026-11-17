import { useCallback, useEffect, useRef } from "react";
import { runtime } from "../../../data/runtime";

/** Resolves stored media file names to blob: URLs, revoked when the screen closes. */
export function useMediaResolver() {
  const urls = useRef(new Map<string, string>());

  useEffect(() => {
    const cache = urls.current;
    return () => {
      for (const url of cache.values()) URL.revokeObjectURL(url);
      cache.clear();
    };
  }, []);

  return useCallback(async (fileName: string) => {
    const cached = urls.current.get(fileName);
    if (cached) return cached;
    const media = await runtime().repos.media.byFileName(fileName);
    if (!media) return undefined;
    const url = URL.createObjectURL(media.blob);
    urls.current.set(fileName, url);
    return url;
  }, []);
}
