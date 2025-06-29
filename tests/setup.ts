import { beforeAll, afterAll } from 'vitest';
import { createServer } from 'http';
import app from '../src/app';

let server: any;

beforeAll(async () => {
	server = createServer(app);
	server.listen(3001);
});

afterAll(async () => {
	server.close();
});
