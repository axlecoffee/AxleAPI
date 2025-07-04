/**
 * Weather Cache Manager
 *
 * Manages cached weather data with automatic refresh every 10 minutes.
 * Provides immediate responses to API requests while keeping data fresh.
 *
 * @module WeatherCacheManager
 * @author AxleAPI
 * @version 1.0.0
 * @since 2025-06-28
 */

import { getAdvancedWeatherData } from './advancedWeatherService';
import { logger } from '../utils/logger';

/**
 * Cache refresh interval in milliseconds (10 minutes)
 */
const CACHE_REFRESH_INTERVAL_MS = 10 * 60 * 1000;

/**
 * Cache entry structure with metadata
 */
interface CacheEntry {
	data: any;
	timestamp: number;
	coordinates: {
		lat: string;
		lon: string;
	};
	lastError?: string;
	fetchCount: number;
	errorCount: number;
}

/**
 * Weather data cache with automatic refresh capability
 */
class WeatherCacheManager {
	private cache: Map<string, CacheEntry> = new Map();
	private refreshIntervals: Map<string, NodeJS.Timeout> = new Map();
	private isShuttingDown = false;

	/**
	 * Generates cache key from coordinates
	 */
	private getCacheKey(lat: string, lon: string): string {
		return `${lat},${lon}`;
	}

	/**
	 * Starts caching weather data for given coordinates
	 *
	 * @param lat - Latitude as string
	 * @param lon - Longitude as string
	 * @returns Promise resolving to initial weather data
	 */
	async startCaching(lat: string, lon: string): Promise<any> {
		const key = this.getCacheKey(lat, lon);

		logger.info(`Starting weather data caching for coordinates ${lat}, ${lon}`);

		// Fetch initial data
		const initialData = await this.fetchWeatherData(lat, lon);

		// Create cache entry
		const cacheEntry: CacheEntry = {
			data: initialData,
			timestamp: Date.now(),
			coordinates: { lat, lon },
			fetchCount: 1,
			errorCount: 0,
		};

		this.cache.set(key, cacheEntry);

		// Start periodic refresh
		this.startPeriodicRefresh(lat, lon);

		logger.info(
			`Weather data caching started for ${key} with ${CACHE_REFRESH_INTERVAL_MS / 1000}s refresh interval`,
		);

		return initialData;
	}

	/**
	 * Gets cached weather data for coordinates
	 *
	 * @param lat - Latitude as string
	 * @param lon - Longitude as string
	 * @returns Cached weather data or null if not cached
	 */
	getCachedData(lat: string, lon: string): any | null {
		const key = this.getCacheKey(lat, lon);
		const entry = this.cache.get(key);

		if (!entry) {
			return null;
		}

		// Add cache metadata to response
		return {
			...entry.data,
			metadata: {
				...entry.data.metadata,
				cache: {
					cached: true,
					timestamp: entry.timestamp,
					age: Date.now() - entry.timestamp,
					fetchCount: entry.fetchCount,
					errorCount: entry.errorCount,
					lastError: entry.lastError,
				},
			},
		};
	}

	/**
	 * Checks if coordinates are being cached
	 */
	isCaching(lat: string, lon: string): boolean {
		const key = this.getCacheKey(lat, lon);
		return this.cache.has(key);
	}

	/**
	 * Stops caching for specific coordinates
	 */
	stopCaching(lat: string, lon: string): void {
		const key = this.getCacheKey(lat, lon);

		// Clear interval
		const interval = this.refreshIntervals.get(key);
		if (interval) {
			clearInterval(interval);
			this.refreshIntervals.delete(key);
		}

		// Remove from cache
		this.cache.delete(key);

		logger.info(`Stopped weather data caching for ${key}`);
	}

	/**
	 * Gets all cached locations
	 */
	getCachedLocations(): Array<{ lat: string; lon: string; key: string }> {
		return Array.from(this.cache.entries()).map(([key, entry]) => ({
			lat: entry.coordinates.lat,
			lon: entry.coordinates.lon,
			key,
		}));
	}

	/**
	 * Gets cache statistics
	 */
	getCacheStats(): {
		totalLocations: number;
		totalFetches: number;
		totalErrors: number;
		averageAge: number;
	} {
		const entries = Array.from(this.cache.values());
		const now = Date.now();

		return {
			totalLocations: entries.length,
			totalFetches: entries.reduce((sum, entry) => sum + entry.fetchCount, 0),
			totalErrors: entries.reduce((sum, entry) => sum + entry.errorCount, 0),
			averageAge:
				entries.length > 0
					? entries.reduce((sum, entry) => sum + (now - entry.timestamp), 0) / entries.length
					: 0,
		};
	}

	/**
	 * Starts periodic refresh for coordinates
	 */
	private startPeriodicRefresh(lat: string, lon: string): void {
		const key = this.getCacheKey(lat, lon);

		// Clear existing interval if any
		const existingInterval = this.refreshIntervals.get(key);
		if (existingInterval) {
			clearInterval(existingInterval);
		}

		// Start new interval
		const interval = setInterval(async () => {
			if (this.isShuttingDown) {
				return;
			}

			try {
				await this.refreshCacheEntry(lat, lon);
			} catch (error) {
				logger.error(`Failed to refresh cache for ${key}: ${error instanceof Error ? error.message : error}`);
			}
		}, CACHE_REFRESH_INTERVAL_MS);

		this.refreshIntervals.set(key, interval);
	}

	/**
	 * Refreshes cache entry for coordinates
	 */
	private async refreshCacheEntry(lat: string, lon: string): Promise<void> {
		const key = this.getCacheKey(lat, lon);
		const entry = this.cache.get(key);

		if (!entry) {
			logger.error(`Cache entry not found for refresh: ${key}`);
			return;
		}

		try {
			logger.info(`Refreshing weather data cache for ${key}`);

			const freshData = await this.fetchWeatherData(lat, lon);

			// Update cache entry
			entry.data = freshData;
			entry.timestamp = Date.now();
			entry.fetchCount++;
			delete entry.lastError;

			logger.info(`Weather data cache refreshed successfully for ${key} (fetch #${entry.fetchCount})`);
		} catch (error) {
			entry.errorCount++;
			entry.lastError = error instanceof Error ? error.message : String(error);

			logger.error(`Cache refresh failed for ${key} (error #${entry.errorCount}): ${entry.lastError}`);
		}
	}

	/**
	 * Fetches weather data using the advanced weather service
	 */
	private async fetchWeatherData(lat: string, lon: string): Promise<any> {
		return await getAdvancedWeatherData(lat, lon);
	}

	/**
	 * Gracefully shuts down the cache manager
	 */
	shutdown(): void {
		logger.info('Shutting down weather cache manager...');

		this.isShuttingDown = true;

		// Clear all intervals
		for (const [key, interval] of this.refreshIntervals.entries()) {
			clearInterval(interval);
			logger.info(`Cleared refresh interval for ${key}`);
		}

		this.refreshIntervals.clear();
		this.cache.clear();

		logger.info('Weather cache manager shutdown complete');
	}
}

/**
 * Global weather cache manager instance
 */
export const weatherCacheManager = new WeatherCacheManager();

/**
 * Graceful shutdown handler
 */
process.on('SIGINT', () => {
	weatherCacheManager.shutdown();
	process.exit(0);
});

process.on('SIGTERM', () => {
	weatherCacheManager.shutdown();
	process.exit(0);
});
