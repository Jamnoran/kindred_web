import { useEffect } from "react";

/** Sets the tab title to "<title> · Kindred" while the page is mounted. */
export function usePageTitle(title: string | null | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · Kindred` : "Kindred";
    return () => {
      document.title = "Kindred";
    };
  }, [title]);
}
