// @ts-nocheck
/**
 * Checks if a user has exceeded their rate limit.
 * Uses Deno KV to track requests in rolling time windows.
 * 
 * @param userId - Unique identifier of the authenticated user
 * @param maxRequests - Maximum allowed requests in the window
 * @param windowSeconds - Duration of the rolling window in seconds
 * @returns boolean - true if the user is rate limited, false otherwise
 */
export async function isRateLimited(
  userId: string,
  maxRequests: number,
  windowSeconds: number
): Promise<boolean> {
  // Open the default Deno KV database
  const kv = await Deno.openKv();
  
  // Create a time-windowed key for this specific user
  const currentWindowIndex = Math.floor(Date.now() / 1000 / windowSeconds);
  const key = ["rate_limit", userId, currentWindowIndex];
  
  // Retrieve the current count
  const entry = await kv.get<number>(key);
  const currentCount = entry.value ?? 0;
  
  if (currentCount >= maxRequests) {
    return true; // Exceeded limit
  }
  
  // Increment the counter and set a TTL (expireIn) slightly longer than the window 
  // to ensure stale keys are automatically cleaned up from Deno KV.
  await kv.set(key, currentCount + 1, { expireIn: windowSeconds * 1000 * 2 });
  
  return false;
}
