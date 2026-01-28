'use client';

import { useState } from 'react';
import { useManagerContext } from '@/lib/fpl/manager-context';

export function ManagerInput() {
  const { manager, isLoading, error, setManagerId, clearManager } = useManagerContext();
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const id = parseInt(inputValue, 10);
    if (!isNaN(id) && id > 0) {
      setManagerId(id);
      setInputValue('');
      setIsOpen(false);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    if (val === '' || /^\d+$/.test(val)) {
      setInputValue(val);
    }
  }

  // Connected state
  if (manager) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-fpl-green">{manager.name}</span>
        <button
          onClick={clearManager}
          className="rounded p-0.5 text-fpl-muted transition-colors hover:text-foreground"
          aria-label="Disconnect manager"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-fpl-muted">
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Connecting...
      </div>
    );
  }

  // Input open
  if (isOpen) {
    return (
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          type="text"
          inputMode="numeric"
          placeholder="Manager ID"
          value={inputValue}
          onChange={handleInputChange}
          autoFocus
          className={`w-28 rounded border bg-fpl-purple-light px-2 py-1 text-sm text-foreground placeholder-fpl-muted outline-none focus:border-fpl-green ${
            error ? 'border-fpl-danger' : 'border-fpl-border'
          }`}
        />
        <button
          type="submit"
          disabled={!inputValue}
          className="rounded bg-fpl-green px-2 py-1 text-xs font-semibold text-fpl-purple transition-opacity disabled:opacity-40"
        >
          Go
        </button>
        <button
          type="button"
          onClick={() => { setIsOpen(false); setInputValue(''); }}
          className="rounded p-0.5 text-fpl-muted transition-colors hover:text-foreground"
          aria-label="Cancel"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        {error && (
          <span className="text-xs text-fpl-danger">Not found</span>
        )}
      </form>
    );
  }

  // Default: show connect button
  return (
    <button
      onClick={() => setIsOpen(true)}
      className="rounded border border-fpl-border px-3 py-1 text-sm font-medium text-fpl-muted transition-colors hover:border-fpl-green hover:text-fpl-green"
    >
      Connect
    </button>
  );
}
