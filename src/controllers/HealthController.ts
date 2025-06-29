/**
 * Health check controller
 * @module controllers/HealthController
 */
import { Request, Response } from 'express';
import { BaseController } from './BaseController';

/**
 * Controller for health check endpoint.
 * @class
 * @extends BaseController
 */
export class HealthController extends BaseController {
	/**
	 * Handles GET /api/health
	 * @param {Request} req - Express request object
	 * @param {Response} res - Express response object
	 * @returns {void}
	 */
	public getHealth = (req: Request, res: Response): void => {
		res.status(200).json({ status: 'ok' });
	};
}
