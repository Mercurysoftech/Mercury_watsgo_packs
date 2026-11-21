const { Server } = require("socket.io");

let io;

const initSocket = (server) => {
  const apiPrefix = (process.env.API_PREFIX || '/packs/api').replace(/\/+$/, '');
  io = new Server(server, {
    path: `${apiPrefix}/socket.io/`,
    transports: ['polling', 'websocket'],
    cors: {
      origin: true, // Allow any origin safely
      methods: ["GET", "POST"]
    }
  });

  console.log("Socket.io initialized for Admin Panel 📡");

  io.on("connection", (socket) => {
    console.log(`New socket connected: ${socket.id}`);

    // Join room for specific user (e.g., admin_userID)
    socket.on("join_room", (roomId) => {
      socket.join(String(roomId));
      console.log(`Socket ${socket.id} joined room: ${roomId}`);
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

const getIo = () => {
  if (!io) {
    throw new Error("Socket.io has not been initialized!");
  }
  return io;
};

/**
 * sendRealTimeUpdate
 * Sends a message/event to a specific room
 */
const sendRealTimeUpdate = (roomId, eventName, data) => {
  if (io) {
    io.to(String(roomId)).emit(eventName, data);
    console.log(`[SOCKET] Emitted '${eventName}' to room ${roomId}`);
  }
};

/**
 * broadcastUpdate
 * Sends to everyone connected
 */
const broadcastUpdate = (eventName, data) => {
  if (io) {
    io.emit(eventName, data);
    console.log(`[SOCKET] Broadcasted '${eventName}'`);
  }
};

module.exports = { initSocket, getIo, sendRealTimeUpdate, broadcastUpdate };
