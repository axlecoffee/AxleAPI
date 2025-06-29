/**
 * Loads and validates environment variables
 * @module config/env
 */
import dotenv from 'dotenv';
import Joi from 'joi';

dotenv.config();

/**
 * Joi schema for environment variable validation.
 */
const envSchema = Joi.object({
	NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
	PORT: Joi.number().default(3000),
	RATE_LIMIT_MAX: Joi.number().default(100),
	STATIC_DIR: Joi.string().default('/public/'),
}).unknown();

const { value: envVars, error } = envSchema.validate(process.env);

if (error) {
	throw new Error(`Config validation error: ${error.message}`);
}

/**
 * Validated environment variables.
 * @typedef {Object} Env
 * @property {string} nodeEnv - The current environment.
 * @property {number} port - The port number.
 * @property {number} rateLimitMax - Max requests per window per IP.
 * @property {string} staticDir - Static files directory path.
 */
export const env = {
	nodeEnv: envVars.NODE_ENV,
	port: envVars.PORT,
	rateLimitMax: envVars.RATE_LIMIT_MAX,
	staticDir: envVars.STATIC_DIR,
};
