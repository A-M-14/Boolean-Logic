/**
 * websocket-manager.ts — WebSocket Manager
 *
 * The top-level server component. Owns the HTTP server and the Socket.IO
 * instance, and wires all real-time traffic to the appropriate domain managers.
 *
 * Responsibilities:
 *   - Creates the HTTP server and the typed Socket.IO server.
 *   - Configures CORS to restrict connections to the CLIENT_URL origin.
 *   - Enforces handshake authentication: every connecting socket must supply
 *     a token in socket.handshake.auth.token that matches CLIENT_SECRET_KEY.
 *     Connections without a valid token are rejected immediately.
 *   - Assigns a stable session UUID to each accepted connection and maps it
 *     to the socket ID for the lifetime of the connection.
 *   - Delegates matchmaking, board-game, and formula-game events to the
 *     three specialised manager classes.
 */

import { createServer } from 'node:http';
import { Server }       from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
  TypedServer,
  TypedSocket,
  GameType,
} from './types.js';
import { MatchmakingQueue }         from './matchmaking-queue.js';
import { BoardGameRoomManager }     from './board-game-room-manager.js';
import { FormulaGamesRoomManager }  from './formula-games-room-manager.js';
import type { Difficulty }          from '@boolean-logic/shared';

// ─── Environment configuration ────────────────────────────────────────────────

const CLIENT_URL = process.env['CLIENT_URL']        ?? 'http://localhost:5173';
const SECRET_KEY = process.env['CLIENT_SECRET_KEY'];          // undefined → auth disabled
const PORT       = Number(process.env['PORT'] ?? 3001);

// ─── Manager class ────────────────────────────────────────────────────────────

export class WebSocketManager {
  private readonly httpServer;
  readonly io: TypedServer;

  private readonly matchmakingQueue:        MatchmakingQueue;
  private readonly boardGameRoomManager:     BoardGameRoomManager;
  private readonly formulaGamesRoomManager:  FormulaGamesRoomManager;

  /**
   * Maps a Socket.IO socket ID to the stable session UUID assigned at
   * connection time. Useful for debugging and future session-resumption logic.
   */
  private readonly socketToSession = new Map<string, string>();

  constructor() {
    this.httpServer = createServer();

    this.io = new Server<
      ClientToServerEvents,
      ServerToClientEvents,
      InterServerEvents,
      SocketData
    >(this.httpServer, {
      cors: {
        origin:  CLIENT_URL,
        methods: ['GET', 'POST'],
      },
      // Allow both WebSocket and HTTP long-polling transports.
      transports: ['websocket', 'polling'],
    });

    this.matchmakingQueue       = new MatchmakingQueue();
    this.boardGameRoomManager    = new BoardGameRoomManager(this.io);
    this.formulaGamesRoomManager = new FormulaGamesRoomManager(this.io);

    this.setupAuthMiddleware();
    this.setupConnectionHandlers();
  }

  // ── Public API ─────────────────────────────────────────────────────────

  /** Start the HTTP / WebSocket server. */
  listen(): void {
    this.httpServer.listen(PORT, () => {
      console.log(`[WebSocketManager] Listening on port ${PORT}`);
      console.log(`[WebSocketManager] Accepting connections from: ${CLIENT_URL}`);
      if (!SECRET_KEY) {
        console.warn('[WebSocketManager] CLIENT_SECRET_KEY is not set — handshake auth DISABLED');
      }
    });
  }

  // ── Private setup ─────────────────────────────────────────────────────

  /**
   * Socket.IO middleware that validates the auth token on every new connection.
   *
   * The client must pass the shared secret in socket.handshake.auth.token:
   *
   *   io('http://localhost:3001', { auth: { token: 'my-secret' } });
   *
   * If CLIENT_SECRET_KEY is not configured the check is skipped (dev mode).
   * If the token is missing or incorrect the connection is rejected with an
   * Unauthorized error, which the client receives as a connect_error event.
   */
  private setupAuthMiddleware(): void {
    this.io.use((socket, next) => {
      if (!SECRET_KEY) {
        // Development shortcut: no secret configured, allow all connections.
        return next();
      }

      const token = (socket.handshake.auth as Record<string, unknown>)['token'];

      if (typeof token !== 'string' || token !== SECRET_KEY) {
        return next(new Error('Unauthorized: invalid or missing auth token'));
      }

      next();
    });
  }

  /**
   * Wire up connection lifecycle events and route domain events to
   * the appropriate manager (matchmaking / board game / formula game).
   */
  private setupConnectionHandlers(): void {
    this.io.on('connection', (socket: TypedSocket) => {
      // Assign and store a stable session UUID for this connection.
      const sessionId        = uuidv4();
      socket.data.sessionId  = sessionId;
      this.socketToSession.set(socket.id, sessionId);

      console.log(
        `[WebSocketManager] Connected: socket=${socket.id} session=${sessionId}`,
      );

      // ── Matchmaking events ─────────────────────────────────────────────

      socket.on('matchmaking:join', (data) => {
        const { gameType, difficulty } = data;
        const nickname = (data.nickname ?? '').trim() || 'Player';

        // Drop any previous queue position before re-queuing.
        this.matchmakingQueue.dequeue(socket.id);

        const opponent = this.matchmakingQueue.enqueue(socket, gameType, difficulty, nickname);

        if (opponent) {
          if (!opponent.socket.connected) {
            // Edge-case: opponent disconnected between enqueue and match.
            // Treat the current socket as still waiting.
            socket.emit('matchmaking:waiting');
          } else {
            // Pair found — create the game room and notify both players.
            this.handleMatch(socket, opponent.socket, gameType, difficulty, nickname, opponent.nickname);
          }
        } else {
          // No opponent yet — tell the client it is waiting.
          socket.emit('matchmaking:waiting');
        }
      });

      socket.on('matchmaking:leave', () => {
        this.matchmakingQueue.dequeue(socket.id);
        console.log(`[WebSocketManager] ${socket.id} left the matchmaking queue.`);
      });

      // ── Board game events ──────────────────────────────────────────────

      socket.on('board:ready', () => {
        this.boardGameRoomManager.handleReady(socket);
      });

      socket.on('board:move', (data) => {
        this.boardGameRoomManager.handleMove(socket, data);
      });

      // ── Formula game events ────────────────────────────────────────────

      socket.on('formula:ready', () => {
        this.formulaGamesRoomManager.handleReady(socket);
      });

      socket.on('formula:evaluation_answer', (data) => {
        this.formulaGamesRoomManager.handleEvaluationAnswer(socket, data);
      });

      socket.on('formula:equivalence_answer', (data) => {
        this.formulaGamesRoomManager.handleEquivalenceAnswer(socket, data);
      });

      // ── Disconnect ─────────────────────────────────────────────────────

      socket.on('disconnect', (reason) => {
        console.log(
          `[WebSocketManager] Disconnected: socket=${socket.id} reason=${reason}`,
        );

        // Remove from all tracking structures.
        this.matchmakingQueue.dequeue(socket.id);
        this.boardGameRoomManager.handleDisconnect(socket.id);
        this.formulaGamesRoomManager.handleDisconnect(socket.id);
        this.socketToSession.delete(socket.id);
      });
    });
  }

  /**
   * Create a game room for two matched players and notify both of the match.
   * Called from the matchmaking:join handler once an opponent is found.
   *
   * For board games, colors are assigned randomly.
   * For formula games, the room is created with the shared difficulty setting.
   */
  private handleMatch(
    socket1:          TypedSocket,
    socket2:          TypedSocket,
    gameType:         GameType,
    difficulty?:      Difficulty,
    socket1Nickname:  string = 'Player',
    socket2Nickname:  string = 'Player',
  ): void {
    let roomId: string;

    if (gameType === 'board') {
      // Randomly assign red / blue so neither player always goes first.
      const [redSocket, blueSocket] =
        Math.random() < 0.5
          ? [socket1, socket2]
          : [socket2, socket1];

      roomId = this.boardGameRoomManager.createRoom(redSocket, blueSocket);
    } else {
      const resolvedDifficulty: Difficulty = difficulty ?? 'easy';

      roomId = this.formulaGamesRoomManager.createRoom(
        socket1, socket2,
        gameType as 'evaluation' | 'equivalence',
        resolvedDifficulty,
      );
    }

    // Notify both players that a match was found before the game-start events
    // arrive, giving the client UI a chance to transition to the game screen.
    socket1.emit('matchmaking:matched', { roomId, opponentNickname: socket2Nickname });
    socket2.emit('matchmaking:matched', { roomId, opponentNickname: socket1Nickname });

    console.log(
      `[WebSocketManager] Match created — room=${roomId} ` +
      `${socket1.id} vs ${socket2.id} (${gameType})`,
    );
  }
}
