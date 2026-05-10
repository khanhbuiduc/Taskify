"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

const FAVICON_LIGHT = "/jarvis-light.png";
const FAVICON_DARK = "/jarvis-dark.png";

export function ThemeFavicon() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const iconUrl = resolvedTheme === "dark" ? FAVICON_DARK : FAVICON_LIGHT;
    const links = document.querySelectorAll<HTMLLinkElement>('link[rel*="icon"]');

    links.forEach((link) => {
      link.href = iconUrl;
    });
  }, [resolvedTheme]);

  return null;
}
