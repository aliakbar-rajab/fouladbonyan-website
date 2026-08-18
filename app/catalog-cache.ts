type RetryableLoader<T> = {
  (): Promise<T>;
  getCached: () => T | undefined;
  setCached: (value: T) => void;
};

/**
 * Memoise an async loader, but only its successes.
 *
 * The obvious `cached ??= load()` caches the rejected promise too, so every
 * later call replays the original failure. That makes the retry the UI offers
 * ("لطفاً دوباره تلاش کنید") impossible to satisfy: the user reconnects, tries
 * again, and gets the same error forever. Clearing the slot on rejection means
 * the next call starts a fresh attempt, while concurrent callers still share
 * the one in flight.
 */
export function createRetryableLoader<T>(
  load: () => Promise<T>,
): RetryableLoader<T> {
  let pending: Promise<T> | undefined;
  let cachedValue: T | undefined;

  const fn = () => {
    if (cachedValue !== undefined) {
      return Promise.resolve(cachedValue);
    }
    pending ??= Promise.resolve()
      .then(load)
      .then((val) => {
        cachedValue = val;
        return val;
      })
      .catch((error: unknown) => {
        pending = undefined;
        throw error;
      });
    return pending;
  };

  fn.getCached = () => cachedValue;
  fn.setCached = (val: T) => {
    cachedValue = val;
    pending = Promise.resolve(val);
  };

  return fn;
}

