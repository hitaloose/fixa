import { useCallback, useEffect, useRef } from "react";
import { runtime } from "../../../data/runtime";

/** Stores picked files and resolves stored file names to blob: URLs (revoked on unmount). */
export function useMedia() {
  const urls = useRef(new Map<string, string>());

  useEffect(() => {
    const cache = urls.current;
    return () => {
      for (const url of cache.values()) URL.revokeObjectURL(url);
      cache.clear();
    };
  }, []);

  const store = useCallback(
    async (file: File) => (await runtime().repos.media.storeFile(file, file.name)).fileName,
    [],
  );

  const resolve = useCallback(async (fileName: string) => {
    const cached = urls.current.get(fileName);
    if (cached) return cached;
    const media = await runtime().repos.media.byFileName(fileName);
    if (!media) return undefined;
    const url = URL.createObjectURL(media.blob);
    urls.current.set(fileName, url);
    return url;
  }, []);

  return { store, resolve };
}
