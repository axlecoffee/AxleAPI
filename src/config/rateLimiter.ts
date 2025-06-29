/**
 * Rate limiter middleware using cf-requesting-ip for Cloudflare support
 * @module config/rateLimiter
 */
import rateLimit from 'express-rate-limit';
import { env } from './env';
import { Request } from 'express';

/**
 * Express rate limiter instance configured for Cloudflare IP header.
 */
export const rateLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: env.rateLimitMax,
	keyGenerator: (req: Request) => (req.headers['cf-requesting-ip'] as string) || req.ip || '',
	standardHeaders: true,
	legacyHeaders: false,
});
