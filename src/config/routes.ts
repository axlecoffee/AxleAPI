/**
 * API route definitions
 * @module config/routes
 */
import { Router } from 'express';
import { HealthController } from '../controllers/HealthController';
import { WeatherController } from '../controllers/WeatherController';
import { DiscordController } from '../controllers/DiscordController';

/**
 * Express router instance for API endpoints.
 */
const router = Router();
const healthController = new HealthController();

/**
 * Health check endpoint
 * @name GET /api/health
 * @function
 * @memberof module:config/routes
 */
router.get('/health', healthController.getHealth);

/**
 * Weather endpoint
 * @name GET /api/weather
 * @function
 * @memberof module:config/routes
 */
router.get('/weather', WeatherController.getWeather);

/**
 * Weather cache status endpoint
 * @name GET /api/weather/cache
 * @function
 * @memberof module:config/routes
 */
router.get('/weather/cache', WeatherController.getCacheStatus);

/**
 * Discord active accounts endpoint
 * @name GET /api/discord/accounts
 * @function
 * @memberof module:config/routes
 */
router.get('/discord/accounts', DiscordController.getActiveAccounts);

export default router;
