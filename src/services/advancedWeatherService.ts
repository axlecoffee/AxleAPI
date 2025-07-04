/**
 * Advanced Weather Service
 *
 * This service combines Environment Canada RSS data with Open-Meteo API to provide
 * comprehensive weather information including current conditions, hourly forecasts,
 * 7-day forecasts, and 14-day extended forecasts.
 *
 * Features:
 * - Unified "feels like" temperature calculation using humidex, wind chill, or apparent temperature
 * - All temperatures rounded to nearest degree for consistency
 * - Wind data from both sources for comprehensive coverage
 * - Graceful fallback between data sources
 * - Production-ready error handling and logging
 *
 * @module AdvancedWeatherService
 * @author AxleAPI
 * @version 1.0.0
 * @since 2025-06-28
 */

import axios, { AxiosResponse, AxiosRequestConfig } from 'axios';
import { getWeatherData as getEnvironmentCanadaData } from './environmentCanadaWeatherService';
import { logger } from '../utils/logger';

/**
 * HTTP request timeout for Open-Meteo API calls (milliseconds)
 */
const OPEN_METEO_TIMEOUT_MS = 10000;

/**
 * Maximum forecast days supported by Open-Meteo
 */
const MAX_FORECAST_DAYS = 14;

/**
 * Temperature thresholds for feels-like calculations
 */
const FEELS_LIKE_THRESHOLDS = {
	HUMIDEX_MIN_TEMP: 20, // Use humidex above 20°C
	WIND_CHILL_MAX_TEMP: 10, // Use wind chill below 10°C
	HEAT_INDEX_MIN_HUMIDITY: 40, // Minimum humidity for heat index calculation
	WIND_CHILL_MIN_SPEED: 10, // Minimum wind speed for wind chill calculation
} as const;

/**
 * Configuration for weather data sources with priorities and capabilities
 */
const WEATHER_CONFIG = {
	environmentCanada: {
		priority: 1, // Highest priority for Canadian locations
		provides: ['current', '7day', 'alerts'],
		reliability: 0.95,
		description: 'Official Canadian weather service',
	},
	openMeteo: {
		priority: 2, // Fallback and supplement
		provides: ['hourly', '14day', 'current'],
		reliability: 0.9,
		baseUrl: 'https://api.open-meteo.com/v1/forecast',
		description: 'European weather model with global coverage',
	},
} as const;

/**
 * Weather data structure for combined results
 */
interface WeatherData {
	current: CurrentConditions[];
	hourly: HourlyForecast[];
	'7day': SevenDayForecast[];
	'14day': FourteenDayForecast[];
	alerts: WeatherAlert[];
	sources: DataSources;
}

/**
 * Current weather conditions interface
 */
interface CurrentConditions {
	temperature: number | null;
	temperatureUnit: string;
	feelsLike: number | null;
	feelsLikeUnit: string;
	condition: string | null;
	humidity: number | null;
	humidityUnit: string;
	windSpeed: number | null;
	windDirection: string | number | null;
	windSpeedUnit: string;
	windDirectionUnit: string;
	windGust: number | null;
	windGustUnit: string;
	pressure: number | null;
	pressureUnit: string;
	pressureTendency?: string | null;
	visibility: number | null;
	visibilityUnit: string;
	dewPoint: number | null;
	dewPointUnit: string;
	airQuality?: number | null;
	airQualityUnit?: string | null;
	stationName?: string | null;
	stationId?: string;
	observationTime?: string | null;
	precipitation?: any;
	uvIndex: number | null;
	cloudCover: number | null;
	cloudCoverUnit: string | null;
	sources: {
		primary: string;
		secondary?: string[];
		dataQuality?: string;
	};
}

/**
 * Hourly forecast data interface
 */
interface HourlyForecast {
	time: string;
	temperature: number | null;
	temperatureUnit: string;
	feelsLike: number | null;
	feelsLikeUnit: string;
	condition: string;
	humidity: number | null;
	humidityUnit: string;
	dewPoint: number | null;
	dewPointUnit: string;
	precipitationProbability: number | null;
	precipitation: number | null;
	precipitationUnit: string;
	windSpeed: number | null;
	windDirection: number | null;
	windGusts: number | null;
	windSpeedUnit: string;
	pressure: number | null;
	pressureUnit: string;
	cloudCover: number | null;
	cloudCoverUnit: string;
	visibility: number | null;
	visibilityUnit: string;
	uvIndex: number | null;
	source: string;
}

/**
 * 7-day forecast data interface (Environment Canada format)
 */
interface SevenDayForecast {
	period: string;
	date: string | null;
	temperature: number | null;
	temperatureType: string | null;
	temperatureUnit: string;
	condition: string | null;
	precipitationChance: number | null;
	precipitation: any;
	windSummary: string | null;
	summary: string;
	fullSummary: string;
}

/**
 * 14-day forecast data interface (Open-Meteo format)
 */
interface FourteenDayForecast {
	date: string;
	temperatureMax: number | null;
	temperatureMin: number | null;
	temperatureUnit: string;
	feelsLikeMax: number | null;
	feelsLikeMin: number | null;
	feelsLikeUnit: string;
	condition: string;
	precipitationSum: number | null;
	precipitationProbability: number | null;
	precipitationUnit: string;
	windSpeedMax: number | null;
	windGustsMax: number | null;
	windDirection: number | null;
	windSpeedUnit: string;
	uvIndexMax: number | null;
	sunrise: string | null;
	sunset: string | null;
	daylightDuration: number | null;
	sunshineDuration: number | null;
	source: string;
}

/**
 * Weather alert interface
 */
interface WeatherAlert {
	warning?: string;
	[key: string]: any;
}

/**
 * Data sources metadata interface
 */
interface DataSources {
	primary: string;
	secondary: string[];
	confidence: number;
}

/**
 * Open-Meteo API response interface
 */
interface OpenMeteoResponse {
	current: {
		temperature_2m: number;
		relative_humidity_2m: number;
		apparent_temperature: number;
		weather_code: number;
		wind_speed_10m: number;
		wind_direction_10m: number;
		wind_gusts_10m: number;
		pressure_msl: number;
		cloud_cover: number;
		uv_index?: number;
		[key: string]: any;
	};
	hourly: {
		time: string[];
		temperature_2m: number[];
		relative_humidity_2m: number[];
		dew_point_2m: number[];
		apparent_temperature: number[];
		precipitation_probability: number[];
		precipitation: number[];
		weather_code: number[];
		pressure_msl: number[];
		cloud_cover: number[];
		visibility: number[];
		wind_speed_10m: number[];
		wind_direction_10m: number[];
		wind_gusts_10m: number[];
		uv_index: number[];
	};
	daily: {
		time: string[];
		weather_code: number[];
		temperature_2m_max: number[];
		temperature_2m_min: number[];
		apparent_temperature_max: number[];
		apparent_temperature_min: number[];
		sunrise: string[];
		sunset: string[];
		daylight_duration: number[];
		sunshine_duration: number[];
		uv_index_max: number[];
		precipitation_sum: number[];
		precipitation_probability_max: number[];
		wind_speed_10m_max: number[];
		wind_gusts_10m_max: number[];
		wind_direction_10m_dominant: number[];
	};
}

/**
 * Fetches weather data from Open-Meteo API with comprehensive parameters.
 *
 * @param lat - Latitude coordinate as string
 * @param lon - Longitude coordinate as string
 * @returns Promise resolving to Open-Meteo API response
 *
 * @throws {Error} When API request fails or returns invalid data
 *
 * @example
 * ```typescript
 * const data = await getOpenMeteoData("45.4215", "-75.6998");
 * console.log(`Current temp: ${data.current.temperature_2m}°C`);
 * ```
 */
async function getOpenMeteoData(lat: string, lon: string): Promise<OpenMeteoResponse> {
	const params = new URLSearchParams({
		latitude: lat,
		longitude: lon,
		// Current conditions parameters
		current: [
			'temperature_2m',
			'relative_humidity_2m',
			'apparent_temperature',
			'is_day',
			'precipitation',
			'weather_code',
			'cloud_cover',
			'pressure_msl',
			'surface_pressure',
			'wind_speed_10m',
			'wind_direction_10m',
			'wind_gusts_10m',
		].join(','),
		// Hourly forecast parameters (next 48 hours available)
		hourly: [
			'temperature_2m',
			'relative_humidity_2m',
			'dew_point_2m',
			'apparent_temperature',
			'precipitation_probability',
			'precipitation',
			'weather_code',
			'pressure_msl',
			'cloud_cover',
			'visibility',
			'wind_speed_10m',
			'wind_direction_10m',
			'wind_gusts_10m',
			'uv_index',
		].join(','),
		// Daily forecast parameters (up to 16 days available)
		daily: [
			'weather_code',
			'temperature_2m_max',
			'temperature_2m_min',
			'apparent_temperature_max',
			'apparent_temperature_min',
			'sunrise',
			'sunset',
			'daylight_duration',
			'sunshine_duration',
			'uv_index_max',
			'precipitation_sum',
			'precipitation_probability_max',
			'wind_speed_10m_max',
			'wind_gusts_10m_max',
			'wind_direction_10m_dominant',
		].join(','),
		timezone: 'auto',
		forecast_days: MAX_FORECAST_DAYS.toString(),
	});

	const requestConfig: AxiosRequestConfig = {
		timeout: OPEN_METEO_TIMEOUT_MS,
		headers: {
			'User-Agent': 'AxleAPI/1.0.0 (Advanced Weather Service)',
			Accept: 'application/json',
		},
	};

	try {
		const url = `${WEATHER_CONFIG.openMeteo.baseUrl}?${params}`;
		logger.info(`Fetching Open-Meteo data for coordinates ${lat}, ${lon}`);

		const response: AxiosResponse<OpenMeteoResponse> = await axios.get(url, requestConfig);

		if (response.status !== 200) {
			throw new Error(`HTTP ${response.status}: Failed to fetch Open-Meteo data`);
		}

		// Validate response structure
		if (!response.data || typeof response.data !== 'object') {
			throw new Error('Invalid response format from Open-Meteo API');
		}

		if (!response.data.current && !response.data.hourly && !response.data.daily) {
			throw new Error('Open-Meteo API returned no weather data');
		}

		logger.info('Open-Meteo data fetched successfully');
		return response.data;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		logger.error(`Open-Meteo API error: ${errorMessage}`);
		throw new Error(`Open-Meteo API unavailable: ${errorMessage}`);
	}
}

/**
 * Converts Open-Meteo weather codes to human-readable conditions.
 * Based on WMO weather interpretation codes.
 *
 * @param code - WMO weather code from Open-Meteo
 * @returns Human-readable weather condition string
 *
 * @example
 * ```typescript
 * const condition = interpretWeatherCode(61);
 * console.log(condition); // "Slight rain"
 * ```
 */
function interpretWeatherCode(code: number): string {
	const weatherCodes: Record<number, string> = {
		0: 'Clear sky',
		1: 'Mainly clear',
		2: 'Partly cloudy',
		3: 'Overcast',
		45: 'Fog',
		48: 'Depositing rime fog',
		51: 'Light drizzle',
		53: 'Moderate drizzle',
		55: 'Dense drizzle',
		56: 'Light freezing drizzle',
		57: 'Dense freezing drizzle',
		61: 'Slight rain',
		63: 'Moderate rain',
		65: 'Heavy rain',
		66: 'Light freezing rain',
		67: 'Heavy freezing rain',
		71: 'Slight snow',
		73: 'Moderate snow',
		75: 'Heavy snow',
		77: 'Snow grains',
		80: 'Slight rain showers',
		81: 'Moderate rain showers',
		82: 'Violent rain showers',
		85: 'Slight snow showers',
		86: 'Heavy snow showers',
		95: 'Thunderstorm',
		96: 'Thunderstorm with slight hail',
		99: 'Thunderstorm with heavy hail',
	};

	return weatherCodes[code] || `Unknown weather condition (code: ${code})`;
}

/**
 * Calculates weighted average of two numeric values with null handling.
 *
 * @param value1 - First value (given higher weight)
 * @param value2 - Second value
 * @param weight1 - Weight for first value (0-1, defaults to 0.6)
 * @returns Weighted average rounded to 1 decimal place, or null if both values are null
 *
 * @example
 * ```typescript
 * const avg = averageValues(20.5, 18.3, 0.7);
 * console.log(avg); // 19.7
 * ```
 */
function averageValues(value1: number | null, value2: number | null, weight1: number = 0.6): number | null {
	// Validate weight parameter
	if (weight1 < 0 || weight1 > 1) {
		logger.error(`Invalid weight parameter: ${weight1}. Using default 0.6`);
		weight1 = 0.6;
	}

	if (value1 === null && value2 === null) return null;
	if (value1 === null) return value2;
	if (value2 === null) return value1;

	// Weighted average favoring the first source
	const result = value1 * weight1 + value2 * (1 - weight1);
	return Math.round(result * 10) / 10; // Round to 1 decimal place
}

/**
 * Calculates the unified "feels like" temperature using multiple methods.
 * Priority order: Humidex (warm weather) > Wind chill (cold weather) > Apparent temperature > Heat/wind calculations > Raw temperature
 *
 * @param temperature - Actual temperature in Celsius
 * @param humidity - Relative humidity percentage
 * @param windSpeed - Wind speed in km/h
 * @param apparentTemperature - Apparent temperature from Open-Meteo
 * @param humidex - Humidex value from Environment Canada
 * @param windChill - Wind chill value from Environment Canada
 * @returns Feels-like temperature rounded to nearest degree, or null if no data available
 *
 * @example
 * ```typescript
 * const feelsLike = calculateFeelsLike(25, 80, 10, 28, 32, null);
 * console.log(feelsLike); // 32 (uses humidex for warm, humid conditions)
 * ```
 */
function calculateFeelsLike(
	temperature: number | null,
	humidity: number | null,
	windSpeed: number | null,
	apparentTemperature: number | null,
	humidex: number | null,
	windChill: number | null,
): number | null {
	// Priority 1: Humidex for warm weather (> 20°C)
	if (humidex !== null && temperature !== null && temperature > FEELS_LIKE_THRESHOLDS.HUMIDEX_MIN_TEMP) {
		return Math.round(humidex);
	}

	// Priority 2: Wind chill for cold weather (< 10°C)
	if (windChill !== null && temperature !== null && temperature < FEELS_LIKE_THRESHOLDS.WIND_CHILL_MAX_TEMP) {
		return Math.round(windChill);
	}

	// Priority 3: Apparent temperature from Open-Meteo (comprehensive calculation)
	if (apparentTemperature !== null) {
		return Math.round(apparentTemperature);
	}

	// Priority 4: Fallback calculations when official feels-like data unavailable
	if (temperature !== null) {
		// Simple heat index for warm, humid weather
		if (
			temperature > FEELS_LIKE_THRESHOLDS.HUMIDEX_MIN_TEMP &&
			humidity !== null &&
			humidity > FEELS_LIKE_THRESHOLDS.HEAT_INDEX_MIN_HUMIDITY
		) {
			const heatIndex = temperature + (0.5 * (humidity - FEELS_LIKE_THRESHOLDS.HEAT_INDEX_MIN_HUMIDITY)) / 10;
			return Math.round(heatIndex);
		}

		// Simple wind chill for cold, windy weather
		if (
			temperature < FEELS_LIKE_THRESHOLDS.WIND_CHILL_MAX_TEMP &&
			windSpeed !== null &&
			windSpeed > FEELS_LIKE_THRESHOLDS.WIND_CHILL_MIN_SPEED
		) {
			const windChillCalc = temperature - windSpeed * 0.2;
			return Math.round(windChillCalc);
		}

		// Default: return actual temperature
		return Math.round(temperature);
	}

	return null;
}

/**
 * Processes Open-Meteo hourly data into standardized format.
 * Extracts next 24 hours starting from current time.
 *
 * @param data - Open-Meteo API response
 * @returns Array of hourly forecast objects
 */
function processOpenMeteoHourly(data: OpenMeteoResponse): HourlyForecast[] {
	if (!data.hourly) {
		logger.error('No hourly data available from Open-Meteo');
		return [];
	}

	const hourly = data.hourly;
	const hourlyForecasts: HourlyForecast[] = [];
	const now = new Date();

	// Find starting index for current/next hour
	let startIndex = 0;
	for (let i = 0; i < hourly.time.length; i++) {
		const forecastTime = new Date(hourly.time[i]);
		if (forecastTime >= now) {
			startIndex = i;
			break;
		}
	}

	// Process next 24 hours
	const endIndex = Math.min(startIndex + 24, hourly.time.length);
	for (let i = startIndex; i < endIndex; i++) {
		const temperature = hourly.temperature_2m[i];
		const apparentTemperature = hourly.apparent_temperature[i];
		const windSpeed = hourly.wind_speed_10m[i];
		const humidity = hourly.relative_humidity_2m[i];

		const feelsLike = calculateFeelsLike(
			temperature,
			humidity,
			windSpeed,
			apparentTemperature,
			null, // No humidex in hourly data
			null, // No wind chill in hourly data
		);

		hourlyForecasts.push({
			time: hourly.time[i],
			temperature: temperature !== null ? Math.round(temperature) : null,
			temperatureUnit: '°C',
			feelsLike,
			feelsLikeUnit: '°C',
			condition: interpretWeatherCode(hourly.weather_code[i]),
			humidity,
			humidityUnit: '%',
			dewPoint: hourly.dew_point_2m[i] !== null ? Math.round(hourly.dew_point_2m[i]) : null,
			dewPointUnit: '°C',
			precipitationProbability: hourly.precipitation_probability[i],
			precipitation: hourly.precipitation[i],
			precipitationUnit: 'mm',
			windSpeed,
			windDirection: hourly.wind_direction_10m[i],
			windGusts: hourly.wind_gusts_10m[i],
			windSpeedUnit: 'km/h',
			pressure: hourly.pressure_msl[i],
			pressureUnit: 'hPa',
			cloudCover: hourly.cloud_cover[i],
			cloudCoverUnit: '%',
			visibility: hourly.visibility[i],
			visibilityUnit: 'm',
			uvIndex: hourly.uv_index[i],
			source: 'Open-Meteo',
		});
	}

	logger.info(`Processed ${hourlyForecasts.length} hourly forecasts from Open-Meteo`);
	return hourlyForecasts;
}

/**
 * Processes Open-Meteo daily data into 14-day forecast format.
 *
 * @param data - Open-Meteo API response
 * @returns Array of daily forecast objects
 */
function processOpenMeteoDaily(data: OpenMeteoResponse): FourteenDayForecast[] {
	if (!data.daily) {
		logger.error('No daily data available from Open-Meteo');
		return [];
	}

	const daily = data.daily;
	const dailyForecasts: FourteenDayForecast[] = [];

	for (let i = 0; i < daily.time.length; i++) {
		const tempMax = daily.temperature_2m_max[i];
		const tempMin = daily.temperature_2m_min[i];
		const apparentTempMax = daily.apparent_temperature_max[i];
		const apparentTempMin = daily.apparent_temperature_min[i];

		// Use apparent temperature as feels-like, fallback to actual temperature
		const feelsLikeMax =
			apparentTempMax !== null ? Math.round(apparentTempMax) : tempMax !== null ? Math.round(tempMax) : null;
		const feelsLikeMin =
			apparentTempMin !== null ? Math.round(apparentTempMin) : tempMin !== null ? Math.round(tempMin) : null;

		dailyForecasts.push({
			date: daily.time[i],
			temperatureMax: tempMax !== null ? Math.round(tempMax) : null,
			temperatureMin: tempMin !== null ? Math.round(tempMin) : null,
			temperatureUnit: '°C',
			feelsLikeMax,
			feelsLikeMin,
			feelsLikeUnit: '°C',
			condition: interpretWeatherCode(daily.weather_code[i]),
			precipitationSum: daily.precipitation_sum[i],
			precipitationProbability: daily.precipitation_probability_max[i],
			precipitationUnit: 'mm',
			windSpeedMax: daily.wind_speed_10m_max[i],
			windGustsMax: daily.wind_gusts_10m_max[i],
			windDirection: daily.wind_direction_10m_dominant[i],
			windSpeedUnit: 'km/h',
			uvIndexMax: daily.uv_index_max[i],
			sunrise: daily.sunrise[i],
			sunset: daily.sunset[i],
			daylightDuration: daily.daylight_duration[i],
			sunshineDuration: daily.sunshine_duration[i],
			source: 'Open-Meteo',
		});
	}

	logger.info(`Processed ${dailyForecasts.length} daily forecasts from Open-Meteo`);
	return dailyForecasts;
}

/**
 * Combines current weather conditions from Environment Canada and Open-Meteo.
 * Uses weighted averaging for numerical values and prioritizes Environment Canada for categorical data.
 *
 * @param envCanadaData - Environment Canada weather data
 * @param openMeteoData - Open-Meteo API response
 * @returns Array containing single combined current conditions object
 */
function combineCurrent(envCanadaData: any, openMeteoData: OpenMeteoResponse): CurrentConditions[] {
	const envCurrent = envCanadaData.current[0] || {};
	const openMeteoCurrent = openMeteoData.current || {};

	// Calculate weighted average temperature
	const temperature = averageValues(
		envCurrent.temperature,
		openMeteoCurrent.temperature_2m,
		0.7, // Favor Environment Canada slightly
	);
	const roundedTemperature = temperature !== null ? Math.round(temperature) : null;

	// Calculate unified feels-like temperature
	const feelsLike = calculateFeelsLike(
		roundedTemperature,
		averageValues(envCurrent.humidity, openMeteoCurrent.relative_humidity_2m, 0.7),
		averageValues(envCurrent.windSpeed, openMeteoCurrent.wind_speed_10m, 0.7),
		openMeteoCurrent.apparent_temperature,
		envCurrent.humidex,
		envCurrent.windChill,
	);

	const combined: CurrentConditions = {
		// Temperature data (averaged and rounded)
		temperature: roundedTemperature,
		temperatureUnit: envCurrent.temperatureUnit || '°C',
		feelsLike,
		feelsLikeUnit: '°C',

		// Conditions (prefer Environment Canada)
		condition: envCurrent.condition || interpretWeatherCode(openMeteoCurrent.weather_code),

		// Atmospheric data (averaged where available)
		humidity: averageValues(envCurrent.humidity, openMeteoCurrent.relative_humidity_2m, 0.7),
		humidityUnit: '%',

		// Wind data (prefer Environment Canada for direction, average speed)
		windSpeed: averageValues(envCurrent.windSpeed, openMeteoCurrent.wind_speed_10m, 0.7),
		windDirection: envCurrent.windDirection || openMeteoCurrent.wind_direction_10m,
		windSpeedUnit: envCurrent.windSpeedUnit || 'km/h',
		windDirectionUnit: envCurrent.windDirectionUnit || '°',
		windGust: envCurrent.windGust || openMeteoCurrent.wind_gusts_10m,
		windGustUnit: envCurrent.windGustUnit || 'km/h',

		// Pressure (prefer Environment Canada, convert Open-Meteo hPa to kPa)
		pressure:
			envCurrent.pressure ||
			(openMeteoCurrent.pressure_msl ? Math.round(openMeteoCurrent.pressure_msl / 10) / 10 : null),
		pressureUnit: envCurrent.pressureUnit || 'kPa',
		pressureTendency: envCurrent.pressureTendency,

		// Visibility (prefer Environment Canada, convert Open-Meteo m to km)
		visibility:
			envCurrent.visibility ||
			(openMeteoCurrent.visibility ? Math.round((openMeteoCurrent.visibility / 1000) * 10) / 10 : null),
		visibilityUnit: envCurrent.visibilityUnit || 'km',

		// Environment Canada exclusive fields
		dewPoint: envCurrent.dewPoint ? Math.round(envCurrent.dewPoint) : null,
		dewPointUnit: envCurrent.dewPointUnit,
		airQuality: envCurrent.airQuality,
		airQualityUnit: envCurrent.airQualityUnit,
		stationName: envCurrent.stationName,
		stationId: envCurrent.stationId,
		observationTime: envCurrent.observationTime,
		precipitation: envCurrent.precipitation,

		// Open-Meteo supplementary fields
		uvIndex: openMeteoCurrent.uv_index || null,
		cloudCover: openMeteoCurrent.cloud_cover || null,
		cloudCoverUnit: openMeteoCurrent.cloud_cover ? '%' : null,

		// Metadata
		sources: {
			primary: 'Environment Canada',
			secondary: ['Open-Meteo'],
			dataQuality: 'Combined',
		},
	};

	logger.info('Successfully combined current conditions from both sources');
	return [combined];
}

/**
 * Main function to retrieve comprehensive weather data from multiple sources.
 * Combines Environment Canada RSS feeds with Open-Meteo API for complete coverage.
 *
 * @param lat - Latitude coordinate as string
 * @param lon - Longitude coordinate as string
 * @returns Promise resolving to comprehensive weather data
 *
 * @throws {Error} When all weather sources fail or return invalid data
 *
 * @example
 * ```typescript
 * try {
 *   const weather = await getAdvancedWeatherData("45.4215", "-75.6998");
 *   console.log(`Current: ${weather.current[0].temperature}°C`);
 *   console.log(`Hourly forecasts: ${weather.hourly.length}`);
 *   console.log(`7-day periods: ${weather['7day'].length}`);
 *   console.log(`14-day forecasts: ${weather['14day'].length}`);
 * } catch (error) {
 *   console.error('Weather service error:', error.message);
 * }
 * ```
 */
export async function getAdvancedWeatherData(lat: string, lon: string): Promise<WeatherData> {
	const startTime = Date.now();

	// Validate input coordinates
	const latNum = parseFloat(lat);
	const lonNum = parseFloat(lon);
	if (isNaN(latNum) || isNaN(lonNum) || latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) {
		throw new Error(`Invalid coordinates: latitude ${lat}, longitude ${lon}`);
	}

	logger.info(`Starting advanced weather data fetch for coordinates ${lat}, ${lon}`);

	try {
		// Fetch data from both sources in parallel for optimal performance
		const [envCanadaResult, openMeteoResult] = await Promise.allSettled([
			getEnvironmentCanadaData(lat, lon),
			getOpenMeteoData(lat, lon),
		]);

		// Extract successful results
		const envData = envCanadaResult.status === 'fulfilled' ? envCanadaResult.value : null;
		const meteoData = openMeteoResult.status === 'fulfilled' ? openMeteoResult.value : null;

		// Log source availability
		if (envCanadaResult.status === 'rejected') {
			logger.error(`Environment Canada source failed: ${envCanadaResult.reason}`);
		}
		if (openMeteoResult.status === 'rejected') {
			logger.error(`Open-Meteo source failed: ${openMeteoResult.reason}`);
		}

		// Require at least one successful source
		if (!envData && !meteoData) {
			throw new Error('Failed to fetch data from all weather sources');
		}

		// Initialize result structure
		const result: WeatherData = {
			current: [],
			hourly: [],
			'7day': [],
			'14day': [],
			alerts: [],
			sources: {
				primary: 'Environment Canada',
				secondary: [],
				confidence: 0.85,
			},
		};

		// Process current conditions
		if (envData && meteoData) {
			// Best case: combine both sources
			result.current = combineCurrent(envData, meteoData);
			result.sources.secondary.push('Open-Meteo');
			result.sources.confidence = 0.95;
			logger.info('Combined current conditions from both sources');
		} else if (envData) {
			// Environment Canada only - adapt to our interface
			const envCurrent = envData.current[0];
			const adaptedCurrent: CurrentConditions = {
				temperature: envCurrent.temperature,
				temperatureUnit: envCurrent.temperatureUnit,
				feelsLike: envCurrent.temperature ? Math.round(envCurrent.temperature) : null,
				feelsLikeUnit: '°C',
				condition: envCurrent.condition,
				humidity: envCurrent.humidity,
				humidityUnit: envCurrent.humidityUnit || '%',
				windSpeed: envCurrent.windSpeed,
				windDirection: envCurrent.windDirection,
				windSpeedUnit: envCurrent.windSpeedUnit || 'km/h',
				windDirectionUnit: envCurrent.windDirectionUnit || '°',
				windGust: envCurrent.windGust,
				windGustUnit: envCurrent.windGustUnit || 'km/h',
				pressure: envCurrent.pressure,
				pressureUnit: envCurrent.pressureUnit || 'kPa',
				pressureTendency: envCurrent.pressureTendency,
				visibility: envCurrent.visibility,
				visibilityUnit: envCurrent.visibilityUnit || 'km',
				dewPoint: envCurrent.dewPoint,
				dewPointUnit: envCurrent.dewPointUnit || '°C',
				airQuality: envCurrent.airQuality,
				airQualityUnit: envCurrent.airQualityUnit,
				stationName: envCurrent.stationName,
				stationId: envCurrent.stationId,
				observationTime: envCurrent.observationTime,
				precipitation: envCurrent.precipitation,
				uvIndex: envCurrent.uvIndex,
				cloudCover: envCurrent.cloudCover,
				cloudCoverUnit: envCurrent.cloudCoverUnit,
				sources: { primary: 'Environment Canada' },
			};
			result.current = [adaptedCurrent];
			result.sources.confidence = 0.9;
			logger.info('Using Environment Canada current conditions only');
		} else if (meteoData) {
			// Open-Meteo only (fallback)
			const temperature = meteoData.current.temperature_2m;
			const roundedTemperature = temperature !== null ? Math.round(temperature) : null;
			const feelsLike = calculateFeelsLike(
				roundedTemperature,
				meteoData.current.relative_humidity_2m,
				meteoData.current.wind_speed_10m,
				meteoData.current.apparent_temperature,
				null,
				null,
			);

			result.current = [
				{
					temperature: roundedTemperature,
					temperatureUnit: '°C',
					feelsLike,
					feelsLikeUnit: '°C',
					condition: interpretWeatherCode(meteoData.current.weather_code),
					humidity: meteoData.current.relative_humidity_2m,
					humidityUnit: '%',
					windSpeed: meteoData.current.wind_speed_10m,
					windDirection: meteoData.current.wind_direction_10m,
					windSpeedUnit: 'km/h',
					windDirectionUnit: '°',
					windGust: meteoData.current.wind_gusts_10m,
					windGustUnit: 'km/h',
					pressure: Math.round(meteoData.current.pressure_msl / 10) / 10,
					pressureUnit: 'kPa',
					visibility: null,
					visibilityUnit: 'km',
					dewPoint: null,
					dewPointUnit: '°C',
					uvIndex: meteoData.current.uv_index || null,
					cloudCover: meteoData.current.cloud_cover,
					cloudCoverUnit: '%',
					sources: { primary: 'Open-Meteo' },
				},
			];
			result.sources.primary = 'Open-Meteo';
			result.sources.confidence = 0.8;
			logger.info('Using Open-Meteo current conditions only');
		}

		// Process 7-day forecast (Environment Canada preferred)
		if (envData && envData['7day'] && envData['7day'].length > 0) {
			result['7day'] = envData['7day'];
			logger.info(`Added ${envData['7day'].length} periods from Environment Canada 7-day forecast`);
		}

		// Process hourly forecast (Open-Meteo only)
		if (meteoData) {
			result.hourly = processOpenMeteoHourly(meteoData);
			if (!result.sources.secondary.includes('Open-Meteo')) {
				result.sources.secondary.push('Open-Meteo');
			}
		}

		// Process 14-day forecast (Open-Meteo only)
		if (meteoData) {
			result['14day'] = processOpenMeteoDaily(meteoData);
		}

		// Process alerts (Environment Canada only)
		if (envData && envData.alerts) {
			result.alerts = envData.alerts;
			logger.info(`Added ${envData.alerts.length} weather alerts`);
		}

		const responseTime = Date.now() - startTime;
		logger.info(
			`Advanced weather data compilation completed in ${responseTime}ms with confidence ${result.sources.confidence}`,
		);

		return result;
	} catch (error) {
		const responseTime = Date.now() - startTime;
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';

		logger.error(`Advanced weather service failed after ${responseTime}ms: ${errorMessage}`);
		throw new Error(`Advanced weather service unavailable: ${errorMessage}`);
	}
}
