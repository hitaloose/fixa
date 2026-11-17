import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { runtime } from "../data/runtime";
import { applyTheme, resolveTheme } from "../lib/theme";

/** Keeps <html data-theme> in step with the "Tema" setting and, for "system", the device. */
export function ThemeSync() {
  const preference = useLiveQuery(() => runtime().repos.settings.get("theme"), []);
  const [media] = useState(() => window.matchMedia("(prefers-color-scheme: dark)"));
  const [deviceDark, setDeviceDark] = useState(media.matches);

  useEffect(() => {
    const onChange = () => setDeviceDark(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [media]);

  useEffect(() => {
    if (!preference) return;
    applyTheme(
      resolveTheme(preference, { matches: deviceDark }),
      document.documentElement,
      document.querySelector('meta[name="theme-color"]'),
    );
  }, [preference, deviceDark]);

  return null;
}
