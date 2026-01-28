'use client';

import { useState } from 'react';
import { useManagerContext } from '@/lib/fpl/manager-context';

export function ConnectPrompt() {
  const { isLoading, error, setManagerId } = useManagerContext();
  const [inputValue, setInputValue] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const id = parseInt(inputValue, 10);
    if (!isNaN(id) && id > 0) {
      setManagerId(id);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    if (val === '' || /^\d+$/.test(val)) {
      setInputValue(val);
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-md rounded-lg border border-fpl-border bg-fpl-card p-8 text-center">
        <svg
          className="mx-auto mb-4 text-fpl-muted"
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
          <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
          <path d="M4 22h16" />
          <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
          <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
          <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
        </svg>

        <h2 className="mb-2 text-xl font-bold text-foreground">Connect Your FPL Account</h2>
        <p className="mb-6 text-sm text-fpl-muted">
          Enter your FPL Manager ID to view your mini-league standings.
          Find your ID in the URL when viewing your team on the FPL website.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="text"
            inputMode="numeric"
            placeholder="e.g. 123456"
            value={inputValue}
            onChange={handleInputChange}
            className={`w-full rounded-lg border bg-fpl-purple-light px-4 py-2.5 text-center text-foreground placeholder-fpl-muted outline-none focus:border-fpl-green ${
              error ? 'border-fpl-danger' : 'border-fpl-border'
            }`}
          />
          {error && (
            <p className="text-sm text-fpl-danger">Manager not found. Please check the ID and try again.</p>
          )}
          <button
            type="submit"
            disabled={!inputValue || isLoading}
            className="rounded-lg bg-fpl-green px-4 py-2.5 text-sm font-bold text-fpl-purple transition-opacity disabled:opacity-40"
          >
            {isLoading ? 'Connecting...' : 'Connect'}
          </button>
        </form>

        <p className="mt-4 text-xs text-fpl-muted">
          Go to fantasy.premierleague.com → Points → check the URL for /entry/<strong>YOUR_ID</strong>/
        </p>
      </div>
    </div>
  );
}
