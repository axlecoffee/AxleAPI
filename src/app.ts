/**
 * Main Express app setup and server entry point
 * @module App
 */
import 'reflect-metadata';
import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { join } from 'path';
import { env } from './config/env';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './config/rateLimiter';
import routes from './config/routes';

/**
 * Application class encapsulating Express app setup and server logic.
 */
class App {
	/** Express application instance */
	public app: Application;

	/**
	 * Initializes the Express application, middleware, routes, and error handling.
	 */
	constructor() {
		this.app = express();
		this.initializeMiddleware();
		this.initializeRoutes();
		this.initializeErrorHandling();
		this.start();
	}

	/**
	 * Sets up global middleware for security, CORS, JSON parsing, rate limiting, and static docs.
	 */
	private initializeMiddleware(): void {
		this.app.use(helmet());
		this.app.use(cors());
		this.app.use(express.json());
		this.app.use(rateLimiter);

		// Serve static files from configurable directory
		const staticPath = env.staticDir.startsWith('/')
			? join(process.cwd(), env.staticDir.slice(1))
			: join(process.cwd(), env.staticDir);

		this.app.use('/static', express.static(staticPath));
		logger.info(`Serving static files from: ${staticPath}`);

		// Serve ReDoc static documentation at root
		this.app.use('/', express.static('public'));
	}

	/**
	 * Registers all API routes under /api.
	 */
	private initializeRoutes(): void {
		this.app.use('/api', routes);
	}

	/**
	 * Registers the global error handler middleware.
	 */
	private initializeErrorHandling(): void {
		this.app.use(errorHandler);
	}

	/**
	 * Starts the server unless running in test mode.
	 */
	private start(): void {
		if (process.env.NODE_ENV !== 'test') {
			this.app.listen(env.port, () => {
				logger.info(`Server running on port ${env.port}`);
			});
		}
	}
}

export default new App().app;
