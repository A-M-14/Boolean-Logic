/**
 * board-game-room-manager.ts — Board Game Room Manager
 *
 * Manages all active 1v1 online board-game sessions.
 *
 * Responsibilities:
 *   - Creates rooms for matched player pairs; assigns colors (red / blue)
 *     and initialises an authoritative BoardState via the shared engine.
 *   - Validates and applies moves using the shared Board Game Engine.
 *   - Broadcasts authoritative state updates to both players after each move.
 *   - Detects game completion and emits board:game_end.
 *   - Cleans up room state on player disconnect.
 *
 * Socket.IO room IDs mirror the internal room IDs so that
 * io.to(roomId).emit(…) reaches exactly the two players in that game.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  initializeBoard,
  validateMove,
  applyMove,
} from '@boolean-logic/shared';
import type { Player, BitValue } from '@boolean-logic/shared';
import type { TypedSocket, TypedServer } from './types.js';

// ─── Internal data structures ─────────────────────────────────────────────────

interface BoardPlayer {
  socketId: string;
}

interface BoardRoom {
  roomId:     string;
  boardState: ReturnType<typeof initializeBoard>;
  players: {
    red:  BoardPlayer;
    blue: BoardPlayer;
  };
  /** Socket IDs of players who have emitted board:ready. Using a Set so that
   *  repeated signals from the same socket (e.g. React StrictMode double-invoke)
   *  are deduplicated; board:game_start is only sent once both distinct players signal. */
  readyPlayers: Set<string>;
}

// ─── Manager class ────────────────────────────────────────────────────────────

export class BoardGameRoomManager {
  /** All active board-game rooms keyed by room ID. */
  private readonly rooms = new Map<string, BoardRoom>();

  /** Reverse lookup: socket ID → room ID. */
  private readonly socketToRoom = new Map<string, string>();

  constructor(private readonly io: TypedServer) {}

  // ── Public API ─────────────────────────────────────────────────────────

  /**
   * Create a new board-game room for two matched players.
   *
   * Assigns the first socket as 'red' and the second as 'blue', joins both
   * sockets to the Socket.IO room, initialises the board, and emits
   * board:game_start to each player with their assigned color.
   *
   * @returns The new room ID.
   */
  createRoom(
    redSocket:  TypedSocket,
    blueSocket: TypedSocket,
  ): string {
    const roomId     = uuidv4();
    const boardState = initializeBoard('two-player');

    const room: BoardRoom = {
      roomId,
      boardState,
      players: {
        red:  { socketId: redSocket.id  },
        blue: { socketId: blueSocket.id },
      },
      readyPlayers: new Set(),
    };

    this.rooms.set(roomId, room);
    this.socketToRoom.set(redSocket.id,  roomId);
    this.socketToRoom.set(blueSocket.id, roomId);

    // Both sockets join the Socket.IO room so io.to(roomId) reaches both.
    redSocket.join(roomId);
    blueSocket.join(roomId);

    // board:game_start is deferred until both players emit board:ready.
    // This prevents the event from arriving before clients have mounted and
    // registered their listeners.

    console.log(
      `[BoardGameRoomManager] Room ${roomId} created — ` +
      `red: ${redSocket.id}, blue: ${blueSocket.id}`,
    );

    return roomId;
  }

  /**
   * Handle a board:ready event from a connected socket.
   *
   * The client emits this once it has mounted and registered all socket
   * listeners. board:game_start is sent to both players only after both
   * have signalled ready, guaranteeing the event arrives after listeners
   * are in place.
   */
  handleReady(socket: TypedSocket): void {
    const roomId = this.socketToRoom.get(socket.id);
    if (!roomId) return;
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.readyPlayers.add(socket.id);
    if (room.readyPlayers.size >= 2) {
      const redSocket  = this.io.sockets.sockets.get(room.players.red.socketId);
      const blueSocket = this.io.sockets.sockets.get(room.players.blue.socketId);
      redSocket?.emit('board:game_start',  { yourPlayer: 'red',  state: room.boardState });
      blueSocket?.emit('board:game_start', { yourPlayer: 'blue', state: room.boardState });
    }
  }

  /**
   * Handle a board:move event from a connected socket.
   *
   * Enforces turn order, validates the move via the shared engine,
   * applies it, and broadcasts the updated authoritative state.
   * On game completion emits board:game_end and cleans up the room.
   */
  handleMove(
    socket: TypedSocket,
    data:   { row: number; col: number; value: BitValue },
  ): void {
    const roomId = this.socketToRoom.get(socket.id);
    if (!roomId) {
      socket.emit('error', { message: 'You are not in an active board-game room.' });
      return;
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found.' });
      return;
    }

    // Identify which player color this socket corresponds to.
    const color: Player | null =
      room.players.red.socketId  === socket.id ? 'red'  :
      room.players.blue.socketId === socket.id ? 'blue' :
      null;

    if (!color) {
      socket.emit('error', { message: 'Unrecognised player.' });
      return;
    }

    // Enforce strict turn order.
    if (room.boardState.currentPlayer !== color) {
      socket.emit('error', { message: 'It is not your turn.' });
      return;
    }

    // Validate the move against the current authoritative state.
    const validation = validateMove(room.boardState, {
      row: data.row, col: data.col, value: data.value,
    });

    if (!validation.valid) {
      socket.emit('error', { message: validation.reason ?? 'Invalid move.' });
      return;
    }

    // Apply the move and update the room's authoritative board state.
    const { newState } = applyMove(room.boardState, {
      row: data.row, col: data.col, value: data.value,
    });
    room.boardState = newState;

    if (newState.isComplete) {
      // Board is full — broadcast the final state and end the game.
      this.io.to(roomId).emit('board:game_end', { finalState: newState });
      console.log(`[BoardGameRoomManager] Room ${roomId} game over — cleaning up.`);
      this.cleanupRoom(roomId);
    } else {
      // Broadcast the updated board to both players.
      this.io.to(roomId).emit('board:state_update', { state: newState });
    }
  }

  /**
   * Handle a socket disconnect while the player is in a board-game room.
   * Notifies the surviving opponent so they aren't left waiting, then
   * cleans up the room.
   */
  handleDisconnect(socketId: string): void {
    const roomId = this.socketToRoom.get(socketId);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (room) {
      // Determine the opponent and notify them before cleanup removes the room.
      const opponentId =
        room.players.red.socketId  === socketId ? room.players.blue.socketId :
        room.players.blue.socketId === socketId ? room.players.red.socketId  :
        null;

      if (opponentId) {
        this.io.to(opponentId).emit('opponent:disconnected', {
          message: 'Your opponent has left the game.',
        });
      }
    }

    console.log(
      `[BoardGameRoomManager] Player ${socketId} disconnected from room ${roomId}.`,
    );
    this.cleanupRoom(roomId);
  }

  /** Returns true if the given socket is currently in a board-game room. */
  isInRoom(socketId: string): boolean {
    return this.socketToRoom.has(socketId);
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private cleanupRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    this.socketToRoom.delete(room.players.red.socketId);
    this.socketToRoom.delete(room.players.blue.socketId);
    this.rooms.delete(roomId);
  }
}
