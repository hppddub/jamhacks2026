'use client';

import { useEffect, useState } from 'react';

export function ThemeToggle() {
  // Start from the server default (dark) so the first client render matches the
  // server HTML — reading localStorage during render would cause a hydration mismatch.
  const [isDark, setIsDark] = useState(true);
  const [mounted, setMounted] = useState(false);

  // After mount, read the persisted choice and reconcile state + DOM class.
  useEffect(() => {
    setIsDark(localStorage.getItem('theme') !== 'light');
    setMounted(true);
  }, []);

  // Sync the DOM class whenever the React state changes (external system sync, no setState here)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      suppressHydrationWarning
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-navy-700 bg-navy-900 text-cream-200 transition-colors hover:bg-navy-800 hover:text-cream-50"
    >
      {!mounted ? null : isDark ? (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="5" />
          <path strokeLinecap="round" d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      ) : (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
      )}
    </button>
  );
}
