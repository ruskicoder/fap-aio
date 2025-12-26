// Tracking removed - no-op function for backward compatibility
export async function sendTrackingEvent(): Promise<void> {
  // Intentionally empty - tracking has been removed
  return Promise.resolve();
}
