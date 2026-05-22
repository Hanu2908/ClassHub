/**
 * Process items in batches using Promise.allSettled for fault isolation.
 * One failed item won't block or cancel others.
 */
export async function processBatched<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  batchSize = 10,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}
