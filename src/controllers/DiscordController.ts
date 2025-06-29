/**
 * Discord Controller
 *
 * Handles Discord-related API endpoints including active accounts.
 *
 * @module controllers/DiscordController
 * @author AxleAPI
 * @version 1.0.0
 * @since 2025-06-28
 */

import { Request, Response } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';
import { BaseController } from './BaseController.js';
import { logger } from '../utils/logger.js';

/**
 * Discord controller class extending BaseController
 */
export class DiscordController extends BaseController {
	/**
	 * Gets active Discord account IDs from static JSON file
	 *
	 * @param req - Express request object
	 * @param res - Express response object
	 */
	static async getActiveAccounts(req: Request, res: Response): Promise<void> {
		try {
			const filePath = join(process.cwd(), 'static', 'active_accounts.json');
			const fileContent = readFileSync(filePath, 'utf8');
			const activeAccounts = JSON.parse(fileContent);

			logger.info('Retrieved active Discord accounts');

			res.json({
				success: true,
				data: activeAccounts,
				count: activeAccounts.length,
				timestamp: new Date().toISOString(),
			});
		} catch (error) {
			logger.error(`Failed to retrieve active accounts: ${error instanceof Error ? error.message : error}`);

			res.status(500).json({
				success: false,
				error: 'Failed to retrieve active accounts',
				timestamp: new Date().toISOString(),
			});
		}
	}
}
