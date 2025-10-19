// src/services/cache.ts  — NOOP cache để tránh lỗi ioredis typings
// Khi cần bật Redis thật, ping mình để chuyển sang bản có ioredis.

export async function cacheGet<T = unknown>(_key: string): Promise<T | null> {
  return null;
}

export async function cacheSet(_key: string, _value: unknown, _ttlSec = 3600): Promise<void> {
  /* no-op */
}
