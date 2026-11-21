import { io, Socket } from "socket.io-client";

const API_URL = import.meta.env.VITE_API_URL;
const API_ENDPOINT = API_URL ? new URL(API_URL) : null;

class SocketService {
  private socket: Socket | null = null;

  connect() {
    if (!this.socket) {
      let baseUrl = API_ENDPOINT?.origin || window.location.origin;
      let socketPath = API_ENDPOINT
        ? `${API_ENDPOINT.pathname.replace(/\/+$/, '')}/socket.io/`
        : '/packs/api/socket.io/';

      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        baseUrl = API_ENDPOINT?.origin || 'http://localhost:5000';
      }

      this.socket = io(baseUrl, {
        path: socketPath,
        autoConnect: true,
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
      });

      this.socket.on("connect", () => {
        console.log("Connected to Admin Socket 📡");
      });

      this.socket.on("disconnect", () => {
        console.log("Disconnected from Admin Socket 📡");
      });
    }
    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  joinRoom(roomId: string | number) {
    if (this.socket) {
      this.socket.emit("join_room", String(roomId));
    }
  }

  on(eventName: string, callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on(eventName, callback);
    }
  }

  off(eventName: string) {
    if (this.socket) {
      this.socket.off(eventName);
    }
  }

  emit(eventName: string, data: any) {
    if (this.socket) {
      this.socket.emit(eventName, data);
    }
  }
}

export const socketService = new SocketService();
