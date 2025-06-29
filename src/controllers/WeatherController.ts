/**
 * WeatherController handles advanced weather data requests with caching.
 * Uses automatic 10-minute refresh intervals to keep data fresh.
 * @module WeatherController
 */
import { Request, Response, NextFunction } from 'express';
import { weatherCacheManager } from '../services/weatherCacheManager.js';
import { logger } from '../utils/logger';

/**
 * Validates latitude parameter
 */
function validateLatitude(lat: string): boolean {
	const latitude = parseFloat(lat);
	return !isNaN(latitude) && latitude >= -90 && latitude <= 90;
}

/**
 * Validates longitude parameter
 */
function validateLongitude(lon: string): boolean {
	const longitude = parseFloat(lon);
	return !isNaN(longitude) && longitude >= -180 && longitude <= 180;
}

/**
 * Formats the weather response with metadata
 */
function formatWeatherResponse(data: any, lat: string, lon: string) {
	return {
		location: {
			latitude: parseFloat(lat),
			longitude: parseFloat(lon),
			coordinates: `${lat}, ${lon}`,
		},
		timestamp: new Date().toISOString(),
		data: {
			current: data.current,
			hourly: data.hourly,
			forecast: {
				'7day': data['7day'],
				'14day': data['14day'],
			},
			alerts: data.alerts,
			sources: data.sources,
		},
		metadata: {
			note: 'Combines Environment Canada and Open-Meteo data for comprehensive coverage',
			capabilities: {
				current: 'Real-time conditions with feels-like temperature (humidex/wind chill/apparent temp)',
				hourly: 'Next 24 hours with detailed conditions from Open-Meteo',
				'7day': 'Weekly forecast from Environment Canada RSS',
				'14day': 'Extended daily forecast from Open-Meteo',
				alerts: 'Weather warnings and watches from Environment Canada',
			},
			limitations: {
				'30day': 'Not available - no free API provides reliable 30-day daily forecasts',
				seasonal: 'Only monthly/ensemble trends available from Open-Meteo seasonal API',
			},
			dataProcessing: {
				temperatures: 'All temperatures are rounded to nearest degree',
				feelsLike: 'Unified feels-like using humidex (>20°C), wind chill (<10°C), or apparent temperature',
				windData: 'Combined from both sources for comprehensive coverage',
			},
		},
	};
}

/**
 * Controller for weather-related endpoints.
 */
export class WeatherController {
	/**
	 * Handles GET /weather requests with comprehensive weather data.
	 * @param req Express request
	 * @param res Express response
	 * @param next Express next function
	 */
	public static async getWeather(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			// Extract and validate coordinates
			const lat = (req.query.lat as string) || '45.4215'; // Default to Ottawa
			const lon = (req.query.lon as string) || '-75.6998';

			// Validate coordinates
			if (!validateLatitude(lat)) {
				res.status(400).json({
					error: 'Invalid latitude',
					message: 'Latitude must be between -90 and 90',
					provided: lat,
				});
				return;
			}

			if (!validateLongitude(lon)) {
				res.status(400).json({
					error: 'Invalid longitude',
					message: 'Longitude must be between -180 and 180',
					provided: lon,
				});
				return;
			}

			logger.info(`Weather request for coordinates: ${lat}, ${lon}`);

			// Check if data is already cached
			let weatherData = weatherCacheManager.getCachedData(lat, lon);

			if (!weatherData) {
				// Start caching for this location (fetches initial data)
				logger.info(`Starting cache for new location: ${lat}, ${lon}`);
				weatherData = await weatherCacheManager.startCaching(lat, lon);
			}

			// Format and return response
			const response = formatWeatherResponse(weatherData, lat, lon);

			res.json(response);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			logger.error(`Advanced weather fetch error: ${errorMessage}`);

			// Provide helpful error response
			res.status(500).json({
				error: 'Weather service unavailable',
				message: 'Unable to fetch weather data from available sources',
				details: errorMessage,
				timestamp: new Date().toISOString(),
			});
		}
	}

	/**
	 * Gets cache status and statistics
	 */
	public static getCacheStatus(req: Request, res: Response, next: NextFunction) {
		try {
			const stats = weatherCacheManager.getCacheStats();
			const locations = weatherCacheManager.getCachedLocations();

			const response = {
				cache: {
					enabled: true,
					refreshInterval: '10 minutes',
					statistics: {
						totalLocations: stats.totalLocations,
						totalFetches: stats.totalFetches,
						totalErrors: stats.totalErrors,
						averageAge: `${Math.round(stats.averageAge / 1000)}s`,
					},
					locations: locations.map((loc) => ({
						coordinates: `${loc.lat}, ${loc.lon}`,
						key: loc.key,
					})),
				},
				timestamp: new Date().toISOString(),
			};

			res.json(response);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			logger.error(`Cache status error: ${errorMessage}`);

			res.status(500).json({
				error: 'Unable to retrieve cache status',
				message: errorMessage,
				timestamp: new Date().toISOString(),
			});
		}
	}
}
