/**
 * Rate limiter middleware using cf-requesting-ip for Cloudflare support
 */
import rateLimit from 'express-rate-limit';
import { env } from './env';
import { Request, Response } from 'express';

/**
 * Express rate limiter instance configured for Cloudflare IP header
 */
export const rateLimiter = rateLimit({
	windowMs: 60 * 1000,
	max: env.rateLimitMax,
	keyGenerator: (req: Request) => (req.headers['cf-requesting-ip'] as string) || req.ip || '',
	standardHeaders: true,
	legacyHeaders: false,
	skipSuccessfulRequests: false,
	skipFailedRequests: false,
	store: undefined,
	message: {
		error: 'Too many requests from this IP, please try again later.',
		retryAfter: 60,
	},
	handler: (req: Request, res: Response) => {
		const resetTime = Date.now() + 60 * 1000;
		res.status(429).json({
			error: 'Too many requests from this IP, please try again later.',
			retryAfter: Math.ceil(resetTime / 1000),
		});
	},
});
