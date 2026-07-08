/**
 * Simple in-memory cache for AI validation results.
 * Lives only for the duration of a review session.
 */

import type { AiValidationResult } from './types';

interface ValidationCacheEntry {
  result: AiValidationResult;
  timestamp: number;
}

/**
 * Session-local cache for validation results.
 * Each validation run is tied to a document + suggestion set.
 */
export class ValidationSessionCache {
  private readonly cache = new Map<string, ValidationCacheEntry>();
  private cacheKeyPrefix: string | null = null;

  /**
   * Initialize with a document hash to scope the cache.
   */
  initialize(docHash: string): void {
    this.cacheKeyPrefix = `val_${docHash}_`;
    this.cache.clear();
  }

  /**
   * Build a cache key for a suggestion.
   */
  private buildKey(suggestionId: string): string {
    return `${this.cacheKeyPrefix ?? 'val_'}${suggestionId}`;
  }

  /**
   * Get cached validation result for a suggestion.
   */
  get(suggestionId: string): AiValidationResult | null {
    const key = this.buildKey(suggestionId);
    const entry = this.cache.get(key);
    if (!entry) return null;
    return entry.result;
  }

  /**
   * Store validation result for a suggestion.
   */
  set(suggestionId: string, result: AiValidationResult): void {
    const key = this.buildKey(suggestionId);
    this.cache.set(key, {
      result,
      timestamp: Date.now(),
    });
  }

  /**
   * Check if a suggestion has been validated.
   */
  has(suggestionId: string): boolean {
    return this.cache.has(this.buildKey(suggestionId));
  }

  /**
   * Get all cached validation results.
   */
  getAll(): Map<string, AiValidationResult> {
    const result = new Map<string, AiValidationResult>();
    for (const [key, entry] of this.cache) {
      const suggestionId = key.replace(/^val_[^_]+_/, '');
      result.set(suggestionId, entry.result);
    }
    return result;
  }

  /**
   * Clear the cache.
   */
  clear(): void {
    this.cache.clear();
    this.cacheKeyPrefix = null;
  }
}

/** Global validation cache instance for the current review session. */
export const validationSessionCache = new ValidationSessionCache();
