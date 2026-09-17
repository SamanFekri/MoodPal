import 'dotenv/config';

// Public domain where the API, the embed endpoints and the Telegram miniapp are served.
// SERVER_BASE_URL in .env overrides this (e.g. for local tunnels while developing).
export const DEFAULT_SERVER_BASE_URL = 'https://moodpal.samanfekri.me';

export const SERVER_BASE_URL = (process.env.SERVER_BASE_URL || DEFAULT_SERVER_BASE_URL).replace(/\/+$/, '');

// The miniapp is served from the root of the server
export const MINIAPP_URL = `${SERVER_BASE_URL}/`;
