/**
 * Next.js instrumentation file.
 * This runs once when the server starts (not on each request).
 * Used to initialize the scheduler for background tasks.
 */
export async function register() {
  // Only run on the Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("./lib/scheduler");
    startScheduler();
  }
}
