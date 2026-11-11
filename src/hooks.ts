import { useEffect, useState } from 'react';

function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

export const useDarkMode = () => useMedia('(prefers-color-scheme: dark)');
export const useReducedMotion = () => useMedia('(prefers-reduced-motion: reduce)');

const readHash = () => decodeURIComponent(window.location.hash.replace(/^#\/?/, ''));

export function useHashRoute(): string {
  const [route, setRoute] = useState(readHash);
  useEffect(() => {
    const onChange = () => setRoute(readHash());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
