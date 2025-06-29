/**
 * Environment Canada Weather Service
 *
 * This service fetches and processes weather data from Environment Canada RSS feeds.
 * It provides current conditions and 7-day forecasts for major Canadian cities.
 *
 * @module EnvironmentCanadaWeatherService
 * @author AxleAPI
 * @version 1.0.0
 * @since 2025-06-28
 */

import axios, { AxiosResponse } from 'axios';
import { parseStringPromise } from 'xml2js';
import { logger } from '../utils/logger.js';

/**
 * Maximum age of weather data before warning (in hours)
 */
const MAX_DATA_AGE_HOURS = 3;

/**
 * HTTP request timeout in milliseconds
 */
const REQUEST_TIMEOUT_MS = 10000;

/**
 * Base URL for Environment Canada RSS feeds
 */
const RSS_BASE_URL = 'https://weather.gc.ca/rss/city';

/**
 * Coordinates to city code mapping for major Canadian cities.
 * Format: "lat,lon": "province-citycode"
 */
const CITY_CODE_MAP: Record<string, string> = {
	// Ottawa area
	'45.4,-75.7': 'on-118',
	'45.403,-75.687': 'on-118',
	'45.4,-75.69': 'on-118',
	// Toronto
	'43.65,-79.38': 'on-143',
	'43.7,-79.4': 'on-143',
	// Vancouver
	'49.25,-123.1': 'bc-74',
	'49.3,-123.1': 'bc-74',
	// Calgary
	'51.05,-114.07': 'ab-52',
	'51.0,-114.1': 'ab-52',
	// Edmonton
	'53.55,-113.5': 'ab-50',
	'53.5,-113.5': 'ab-50',
	// Montreal
	'45.5,-73.58': 'qc-147',
	'45.5,-73.6': 'qc-147',
	// Winnipeg
	'49.9,-97.1': 'mb-38',
	// Halifax
	'44.6,-63.6': 'ns-19',
	// Quebec City
	'46.8,-71.2': 'qc-133',
};

/**
 * Weather data structure for current conditions
 */
interface CurrentWeatherData {
	temperature: number | null;
	temperatureUnit: string;
	condition: string | null;
	humidity: number | null;
	humidityUnit: string | null;
	windSpeed: number | null;
	windSpeedUnit: string | null;
	windDirection: string | null;
	windDirectionUnit: string | null;
	windGust: number | null;
	windGustUnit: string | null;
	pressure: number | null;
	pressureUnit: string | null;
	pressureTendency: string | null;
	visibility: number | null;
	visibilityUnit: string | null;
	dewPoint: number | null;
	dewPointUnit: string | null;
	airQuality: number | null;
	airQualityUnit: string | null;
	stationName: string | null;
	stationId: string;
	observationTime: string | null;
	precipitation: {
		past1Hr: number | null;
		past3Hr: number | null;
		past6Hr: number | null;
		past24Hr: number | null;
		unit: string | null;
	};
	uvIndex: number | null;
	humidex: number | null;
	windChill: number | null;
	cloudCover: number | null;
	cloudCoverUnit: string | null;
	sunrise: string | null;
	sunset: string | null;
	moonPhase: string | null;
	moonrise: string | null;
	moonset: string | null;
	seaLevelPressure: number | null;
	seaLevelPressureUnit: string | null;
}

/**
 * Weather forecast data structure for 7-day forecasts
 */
interface ForecastData {
	period: string;
	date: string | null;
	temperature: number | null;
	temperatureType: string | null;
	temperatureUnit: string;
	condition: string | null;
	precipitationChance: number | null;
	precipitation: {
		type: string;
		amount: number;
		unit: string;
	} | null;
	windSummary: string | null;
	summary: string;
	fullSummary: string;
}

/**
 * Complete weather service response structure
 */
interface WeatherServiceResponse {
	current: CurrentWeatherData[];
	'7day': ForecastData[];
	alerts: Array<{ warning: string }>;
	hourly: never[];
	daily: never[];
	'14day': never[];
}

/**
 * Finds the appropriate Environment Canada city code for given coordinates.
 * Uses a nearest-neighbor approach for unmapped coordinates.
 *
 * @param lat - Latitude as string
 * @param lon - Longitude as string
 * @returns Environment Canada city code (e.g., "on-118")
 *
 * @example
 * ```typescript
 * const cityCode = findCityCode("45.4215", "-75.6998");
 * console.log(cityCode); // "on-118"
 * ```
 */
function findCityCode(lat: string, lon: string): string {
	const latNum = parseFloat(lat);
	const lonNum = parseFloat(lon);

	// Validate coordinates
	if (isNaN(latNum) || isNaN(lonNum)) {
		logger.error(`Invalid coordinates provided: ${lat}, ${lon}. Using default Ottawa.`);
		return 'on-118';
	}

	// Try exact coordinate matches first
	const exactKey = `${lat},${lon}`;
	if (CITY_CODE_MAP[exactKey]) {
		return CITY_CODE_MAP[exactKey];
	}

	// Try rounded coordinates (1 decimal place)
	const coordKey = `${latNum.toFixed(1)},${lonNum.toFixed(1)}`;
	if (CITY_CODE_MAP[coordKey]) {
		return CITY_CODE_MAP[coordKey];
	}

	// Find nearest city using haversine distance
	let nearestCode = 'on-118'; // Default to Ottawa
	let minDistance = Infinity;

	for (const [coords, code] of Object.entries(CITY_CODE_MAP)) {
		const [cityLat, cityLon] = coords.split(',').map(Number);
		const distance = calculateHaversineDistance(latNum, lonNum, cityLat, cityLon);

		if (distance < minDistance) {
			minDistance = distance;
			nearestCode = code;
		}
	}

	logger.info(
		`Using nearest city code ${nearestCode} for coordinates ${lat}, ${lon} (distance: ${minDistance.toFixed(2)}km)`,
	);
	return nearestCode;
}

/**
 * Calculates the haversine distance between two coordinate points.
 *
 * @param lat1 - First latitude
 * @param lon1 - First longitude
 * @param lat2 - Second latitude
 * @param lon2 - Second longitude
 * @returns Distance in kilometers
 */
function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
	const R = 6371; // Earth's radius in kilometers
	const dLat = ((lat2 - lat1) * Math.PI) / 180;
	const dLon = ((lon2 - lon1) * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return R * c;
}

/**
 * Parses HTML summary from Environment Canada RSS feeds to extract structured weather data.
 * Handles various formats including CDATA sections and nested objects.
 *
 * @param htmlSummary - Raw HTML summary from RSS feed
 * @returns Parsed weather data as key-value pairs
 *
 * @example
 * ```typescript
 * const summary = "<![CDATA[<b>Condition:</b> Partly Cloudy<br/><b>Temperature:</b> 18.8°C]]>";
 * const data = parseWeatherSummary(summary);
 * console.log(data.condition); // "Partly Cloudy"
 * console.log(data.temperature); // "18.8°C"
 * ```
 */
function parseWeatherSummary(htmlSummary: any): Record<string, string> {
	const data: Record<string, string> = {};

	try {
		// Handle different possible formats of the summary
		let summaryText: string;
		if (typeof htmlSummary === 'string') {
			summaryText = htmlSummary;
		} else if (htmlSummary && typeof htmlSummary === 'object' && htmlSummary._) {
			summaryText = htmlSummary._;
		} else if (htmlSummary && typeof htmlSummary === 'object' && htmlSummary.content) {
			summaryText = htmlSummary.content;
		} else {
			logger.error(`Unexpected summary format: ${JSON.stringify(htmlSummary)}`);
			return data;
		}

		// Remove CDATA wrapper and normalize line breaks
		const cleanText = summaryText
			.replace(/<!\[CDATA\[|\]\]>/g, '')
			.replace(/<br\/?>/gi, '\n')
			.replace(/&nbsp;/g, ' ');

		const lines = cleanText.split('\n').filter((line) => line.trim());

		// Parse each line looking for pattern: <b>Key:</b> Value
		lines.forEach((line) => {
			const match = line.match(/<b>([^:]+):<\/b>\s*(.+)/i);
			if (match) {
				const key = match[1].trim().toLowerCase().replace(/\s+/g, ' ');
				const value = match[2].trim().replace(/<[^>]*>/g, ''); // Remove remaining HTML
				data[key] = value;
			}
		});

		return data;
	} catch (error) {
		logger.error(`Error parsing weather summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
		return data;
	}
}

/**
 * Validates and parses numeric values with error handling.
 *
 * @param value - String value to parse
 * @param fieldName - Name of field for error logging
 * @returns Parsed number or null if invalid
 */
function safeParseFloat(value: string | undefined, fieldName: string): number | null {
	if (!value || typeof value !== 'string') return null;

	const parsed = parseFloat(value.replace(/[^\d.-]/g, ''));
	if (isNaN(parsed)) {
		logger.error(`Invalid numeric value for ${fieldName}: ${value}`);
		return null;
	}

	return parsed;
}

/**
 * Checks if weather data is stale and creates appropriate warnings.
 *
 * @param observationTime - ISO timestamp of last observation
 * @returns Warning message if data is stale, null otherwise
 */
function checkDataAge(observationTime: string): string | null {
	try {
		const observationDate = new Date(observationTime);
		const now = new Date();
		const ageHours = (now.getTime() - observationDate.getTime()) / (1000 * 60 * 60);

		if (ageHours > MAX_DATA_AGE_HOURS) {
			return `Data is ${Math.round(ageHours)} hours old. Latest observation: ${observationDate.toISOString()}`;
		}

		return null;
	} catch (error) {
		logger.error(`Unable to parse observation time: ${observationTime}`);
		return null;
	}
}

/**
 * Fetches and processes weather data from Environment Canada RSS feeds.
 * Provides current conditions and 7-day forecasts for Canadian locations.
 *
 * @param lat - Latitude coordinate as string
 * @param lon - Longitude coordinate as string
 * @returns Promise resolving to structured weather data
 *
 * @throws {Error} When RSS feed is unavailable or data cannot be parsed
 *
 * @example
 * ```typescript
 * try {
 *   const weatherData = await getWeatherData("45.4215", "-75.6998");
 *   console.log(`Current temperature: ${weatherData.current[0].temperature}°C`);
 *   console.log(`7-day forecast has ${weatherData['7day'].length} periods`);
 * } catch (error) {
 *   console.error('Weather service error:', error.message);
 * }
 * ```
 */
export async function getWeatherData(lat: string, lon: string): Promise<WeatherServiceResponse> {
	const startTime = Date.now();
	const cityCode = findCityCode(lat, lon);
	const endpoint = `${RSS_BASE_URL}/${cityCode}_e.xml`;

	try {
		logger.info(`Fetching Environment Canada weather data for ${lat}, ${lon} using city code ${cityCode}`);

		// Fetch RSS feed with timeout and error handling
		const response: AxiosResponse = await axios.get(endpoint, {
			timeout: REQUEST_TIMEOUT_MS,
			headers: {
				'User-Agent': 'AxleAPI/1.0.0 (Weather Service)',
				Accept: 'application/xml, text/xml, */*',
			},
		});

		if (response.status !== 200) {
			throw new Error(`HTTP ${response.status}: Failed to fetch weather data from ${endpoint}`);
		}

		// Parse XML to JSON with comprehensive options
		const result = await parseStringPromise(response.data, {
			trim: true,
			explicitArray: false,
			mergeAttrs: true,
			normalize: true,
			normalizeTags: false,
			explicitRoot: false,
		});

		// The parsed result has feed properties at root level due to explicitRoot: false
		const feed = result;
		if (!feed || !feed.entry) {
			throw new Error('Invalid RSS feed structure: missing feed or entries');
		}

		const entries = Array.isArray(feed.entry) ? feed.entry : [feed.entry];

		// Find current conditions entry
		const currentConditionsEntry = entries.find((entry: any) => entry.category?.term === 'Current Conditions');

		if (!currentConditionsEntry) {
			throw new Error('Current conditions not found in RSS feed');
		}

		// Parse weather data from HTML summary
		const weatherData = parseWeatherSummary(currentConditionsEntry.summary);

		// Extract forecast entries (next 6 periods for 3-day forecast)
		const forecastEntries = entries
			.filter((entry: any) => entry.category?.term === 'Weather Forecasts')
			.slice(0, 6);

		// Check data age and generate warnings
		const dataAgeWarning = currentConditionsEntry.updated ? checkDataAge(currentConditionsEntry.updated) : null;

		// Parse current conditions with enhanced error handling
		const current = parseCurrentConditions(weatherData, cityCode, currentConditionsEntry.updated);
		const forecast = parseForecastData(forecastEntries);

		const responseTime = Date.now() - startTime;
		logger.info(`Environment Canada weather data fetched successfully in ${responseTime}ms`);

		return {
			current: [current],
			'7day': forecast,
			alerts: dataAgeWarning ? [{ warning: dataAgeWarning }] : [],
			hourly: [], // RSS doesn't provide hourly data
			daily: [], // RSS doesn't provide structured daily data
			'14day': [], // RSS only provides 6-period forecast
		};
	} catch (error) {
		const responseTime = Date.now() - startTime;
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';

		logger.error(
			`Environment Canada weather service error after ${responseTime}ms: ${errorMessage} | Endpoint: ${endpoint} | City: ${cityCode} | Coords: ${lat}, ${lon}`,
		);

		throw new Error(`Environment Canada weather service unavailable: ${errorMessage}`);
	}
}

/**
 * Parses current weather conditions from Environment Canada data.
 *
 * @param weatherData - Parsed weather data from RSS summary
 * @param cityCode - Environment Canada city code
 * @param observationTime - Time of observation
 * @returns Structured current weather data
 */
function parseCurrentConditions(
	weatherData: Record<string, string>,
	cityCode: string,
	observationTime: string | null,
): CurrentWeatherData {
	// Parse temperature with enhanced regex
	const tempMatch = weatherData.temperature?.match(/(-?\d+\.?\d*)\s*°?([CF])?/);
	const temperature = tempMatch ? safeParseFloat(tempMatch[1], 'temperature') : null;
	const temperatureUnit = tempMatch?.[2] ? `°${tempMatch[2]}` : '°C';

	// Parse pressure with tendency
	const pressureMatch = weatherData['pressure / tendency']?.match(/(\d+\.?\d*)\s*(\w+)\s*(\w+)?/);
	const pressure = pressureMatch ? safeParseFloat(pressureMatch[1], 'pressure') : null;
	const pressureUnit = pressureMatch?.[2] || null;
	const pressureTendency = pressureMatch?.[3] || null;

	// Enhanced wind parsing with gust detection
	const windMatch = weatherData.wind?.match(/([NSEW]+)\s+(\d+)\s+(\w+\/?\w*)/);
	const windSpeed = windMatch ? safeParseFloat(windMatch[2], 'windSpeed') : null;
	const windDirection = windMatch?.[1] || null;
	const windSpeedUnit = windMatch?.[3] || null;

	// Extract wind gusts
	const windGustMatch = weatherData.wind?.match(/gusting?\s+to\s+(\d+)/i);
	const windGust = windGustMatch ? safeParseFloat(windGustMatch[1], 'windGust') : null;
	const windGustUnit = windGust ? windSpeedUnit : null;

	// Parse visibility
	const visibilityMatch = weatherData.visibility?.match(/(\d+\.?\d*)\s*(\w+)/);
	const visibility = visibilityMatch ? safeParseFloat(visibilityMatch[1], 'visibility') : null;
	const visibilityUnit = visibilityMatch?.[2] || null;

	// Parse humidity
	const humidityMatch = weatherData.humidity?.match(/(\d+)\s*%?/);
	const humidity = humidityMatch ? safeParseFloat(humidityMatch[1], 'humidity') : null;

	// Parse dewpoint
	const dewpointMatch = weatherData.dewpoint?.match(/(-?\d+\.?\d*)\s*°?([CF])?/);
	const dewPoint = dewpointMatch ? safeParseFloat(dewpointMatch[1], 'dewPoint') : null;
	const dewPointUnit = dewpointMatch?.[2] ? `°${dewpointMatch[2]}` : '°C';

	// Parse Air Quality Health Index
	const aqhiMatch = weatherData['air quality health index']?.match(/(\d+)/);
	const airQuality = aqhiMatch ? safeParseFloat(aqhiMatch[1], 'airQuality') : null;

	return {
		temperature,
		temperatureUnit,
		condition: weatherData.condition || null,
		humidity,
		humidityUnit: humidity !== null ? '%' : null,
		windSpeed,
		windSpeedUnit,
		windDirection,
		windDirectionUnit: windDirection ? '°' : null,
		windGust,
		windGustUnit,
		pressure,
		pressureUnit,
		pressureTendency,
		visibility,
		visibilityUnit,
		dewPoint,
		dewPointUnit,
		airQuality,
		airQualityUnit: airQuality !== null ? 'AQHI' : null,
		stationName: weatherData['observed at'] || null,
		stationId: cityCode,
		observationTime,
		precipitation: {
			past1Hr: null,
			past3Hr: null,
			past6Hr: null,
			past24Hr: null,
			unit: null,
		},
		uvIndex: null,
		humidex: null,
		windChill: null,
		cloudCover: null,
		cloudCoverUnit: null,
		sunrise: null,
		sunset: null,
		moonPhase: null,
		moonrise: null,
		moonset: null,
		seaLevelPressure: null,
		seaLevelPressureUnit: null,
	};
}

/**
 * Parses 7-day forecast data from Environment Canada RSS entries.
 *
 * @param forecastEntries - Array of RSS forecast entries
 * @returns Array of structured forecast data
 */
function parseForecastData(forecastEntries: any[]): ForecastData[] {
	return forecastEntries.map((entry: any) => {
		const title = entry.title || '';
		let summary = '';

		// Handle different summary formats
		if (typeof entry.summary === 'string') {
			summary = entry.summary;
		} else if (entry.summary && typeof entry.summary === 'object' && entry.summary._) {
			summary = entry.summary._;
		} else if (entry.summary && typeof entry.summary === 'object' && entry.summary.content) {
			summary = entry.summary.content;
		}

		// Clean summary of HTML tags
		summary = summary
			.replace(/<[^>]*>/g, '')
			.replace(/\s+/g, ' ')
			.trim();

		// Extract period (e.g., "Saturday night:" -> "Saturday night")
		const periodMatch = title.match(/^([^:]+):/);
		const period = periodMatch ? periodMatch[1] : title;

		// Extract temperature with enhanced parsing
		const tempMatch = title.match(/(High|Low)\s+(-?\d+)/i);
		const tempValue = tempMatch ? parseInt(tempMatch[2]) : null;
		const tempType = tempMatch ? tempMatch[1].toLowerCase() : null;

		// Extract precipitation probability
		const popMatch = title.match(/POP\s+(\d+)%/i);
		const precipitationChance = popMatch ? parseInt(popMatch[1]) : null;

		// Extract wind information from summary
		const windSummaryMatch = summary.match(/wind\s+[^.]*(\d+)\s*km\/h[^.]*/i);
		const windSummary = windSummaryMatch ? windSummaryMatch[0] : null;

		// Extract precipitation details
		const precipMatch = summary.match(/(rain|snow|showers|flurries)[^.]*amount[^.]*(\d+(?:\.\d+)?)[^.]*(mm|cm)/i);
		const precipitation = precipMatch
			? {
					type: precipMatch[1],
					amount: parseFloat(precipMatch[2]),
					unit: precipMatch[3],
				}
			: null;

		return {
			period,
			date: entry.updated || null,
			temperature: tempValue,
			temperatureType: tempType,
			temperatureUnit: '°C',
			condition: summary.split('.')[0] || null,
			precipitationChance,
			precipitation,
			windSummary,
			summary,
			fullSummary: summary,
		};
	});
}
