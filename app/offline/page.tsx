"use client";

export default function OfflinePage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-fpl-card">
        <svg
          className="h-10 w-10 text-fpl-muted"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z"
          />
        </svg>
      </div>
      <h1 className="mb-2 text-xl font-bold">You&apos;re Offline</h1>
      <p className="mb-6 max-w-sm text-sm text-fpl-muted">
        It looks like you&apos;ve lost your internet connection. Some features
        may be unavailable until you&apos;re back online.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="rounded-lg bg-fpl-green px-6 py-3 text-sm font-semibold text-fpl-purple transition-colors hover:bg-fpl-green-dark"
      >
        Try Again
      </button>
    </div>
  );
}
