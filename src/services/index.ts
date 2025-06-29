/**
 * Weather Services Export Module
 *
 * Centralized exports for all weather-related services.
 * Provides clean import paths and service discovery.
 *
 * @module Services
 * @author AxleAPI
 * @version 1.0.0
 * @since 2025-06-28
 */

// Environment Canada Weather Service
export { getWeatherData as getEnvironmentCanadaData } from './environmentCanadaWeatherService.js';

// Advanced Weather Service (combines multiple sources)
export { getAdvancedWeatherData } from './advancedWeatherService.js';

// Weather Cache Manager (automatic refresh every 10 minutes)
export { weatherCacheManager } from './weatherCacheManager.js';

/**
 * Service configuration and metadata
 */
export const WEATHER_SERVICES = {
	environmentCanada: {
		name: 'Environment Canada Weather Service',
		description: 'Official Canadian weather data from RSS feeds',
		provides: ['current conditions', '7-day forecast', 'weather alerts'],
		coverage: 'Canada',
		updateFrequency: 'Hourly',
		reliability: 'Very High (Government Source)',
	},
	advanced: {
		name: 'Advanced Weather Service',
		description: 'Combined weather data from multiple sources',
		provides: [
			'current conditions',
			'hourly forecast (24h)',
			'7-day forecast',
			'14-day forecast',
			'weather alerts',
		],
		coverage: 'Global (with Canadian priority)',
		sources: ['Environment Canada', 'Open-Meteo'],
		updateFrequency: 'Hourly (current), Daily (forecasts)',
		reliability: 'High (Multiple Sources)',
		features: [
			'Unified feels-like temperature calculation',
			'Rounded temperatures for consistency',
			'Wind data from multiple sources',
			'Graceful fallback between sources',
			'Production-ready error handling',
		],
	},
} as const;

/**
 * Service health check function
 */
export async function getWeatherServiceHealth(): Promise<{
	environmentCanada: boolean;
	openMeteo: boolean;
	overall: 'healthy' | 'degraded' | 'unavailable';
}> {
	// Test coordinates (Ottawa)
	const testLat = '45.4215';
	const testLon = '-75.6998';

	try {
		const { getWeatherData } = await import('./environmentCanadaWeatherService.js');
		const { getAdvancedWeatherData } = await import('./advancedWeatherService.js');

		const [envTest, advancedTest] = await Promise.allSettled([
			getWeatherData(testLat, testLon),
			getAdvancedWeatherData(testLat, testLon),
		]);

		const environmentCanada = envTest.status === 'fulfilled';
		const openMeteo = advancedTest.status === 'fulfilled' && advancedTest.value.hourly.length > 0; // Open-Meteo provides hourly data

		let overall: 'healthy' | 'degraded' | 'unavailable';
		if (environmentCanada && openMeteo) {
			overall = 'healthy';
		} else if (environmentCanada || openMeteo) {
			overall = 'degraded';
		} else {
			overall = 'unavailable';
		}

		return {
			environmentCanada,
			openMeteo,
			overall,
		};
	} catch (error) {
		return {
			environmentCanada: false,
			openMeteo: false,
			overall: 'unavailable',
		};
	}
}
