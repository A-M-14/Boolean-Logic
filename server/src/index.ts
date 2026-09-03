/**
 * index.ts — Server Entry Point
 *
 * Loads environment variables from a .env file (if present), then
 * creates and starts the WebSocketManager which owns the HTTP server
 * and all Socket.IO infrastructure.
 *
 * Usage:
 *   Development:  npm run dev       (tsx watch — auto-restarts on changes)
 *   Production:   npm run build && npm start
 *
 * Required environment variables (see .env.example):
 *   PORT              — TCP port to listen on (default: 3001)
 *   CLIENT_URL        — Allowed CORS origin   (default: http://localhost:5173)
 *   CLIENT_SECRET_KEY — Auth token clients must supply in handshake.auth.token
 *
 * Note: @boolean-logic/shared must be built before starting the server.
 *   Run `npm run build --workspace=shared` from the repository root.
 */

import 'dotenv/config';
import { WebSocketManager } from './websocket-manager.js';

const manager = new WebSocketManager();
manager.listen();
