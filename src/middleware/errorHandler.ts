/**
 * Global error handler middleware
 * @module middleware/errorHandler
 */
import { Request, Response, NextFunction } from 'express';

/**
 * Handles errors and sends a JSON response with error message.
 * @function
 * @param {Error} err - The error object
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next middleware function
 * @returns {void}
 */
export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
	res.status(500).json({ error: err.message });
}
