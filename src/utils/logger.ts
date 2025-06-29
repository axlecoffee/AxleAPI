/**
 * Logger utility with API, DATABASE, and ERROR levels
 * @module utils/logger
 */
const getTimestamp = (): string => {
	const now = new Date();
	return now.toLocaleTimeString('en-US', { hour12: false });
};

/**
 * Logger object for API, DATABASE, and ERROR logs.
 * @property {function(string):void} info - Logs API messages
 * @property {function(string):void} database - Logs database messages
 * @property {function(string):void} error - Logs error messages
 */
export const logger = {
	info: (msg: string) => console.log(`[${getTimestamp()}] [API] ${msg}`),
	database: (msg: string) => console.log(`[${getTimestamp()}] [DATABASE] ${msg}`),
	error: (msg: string) => console.error(`[${getTimestamp()}] [ERROR] ${msg}`),
};
