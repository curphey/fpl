export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-fpl-danger/30 bg-fpl-card p-8 text-center">
      <p className="text-lg font-semibold text-fpl-danger">
        Something went wrong
      </p>
      <p className="mt-1 text-sm text-fpl-muted">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 rounded-lg bg-fpl-purple-light px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-fpl-border"
        >
          Try again
        </button>
      )}
    </div>
  );
}
