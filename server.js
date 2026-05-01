const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);

// ===== SOCKET.IO SETUP =====
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ["websocket", "polling"]
});

// ===== GLOBAL STATE =====
let transmitterSocket = null;
let receivers = new Map();
let messageCount = 0;

// ===== HEALTH ROUTE =====
app.get("/", (req, res) => {
  res.send("🚀 Walkie Server Running");
});

// ===== STATIC DASHBOARD (LATER USE) =====
app.use("/dashboard", express.static(path.join(__dirname, "public")));

// ===== SOCKET HANDLING =====
io.on("connection", (socket) => {

  console.log(`⚡ New connection: ${socket.id}`);

  // ===== DEVICE REGISTRATION =====
  socket.on("register", (data) => {
    const { type, name } = data;

    socket.deviceType = type;
    socket.deviceName = name || "Unknown";

    if (type === "transmitter") {
      transmitterSocket = socket;
      console.log(`🎤 Transmitter connected: ${socket.deviceName}`);
    }

    if (type === "receiver") {
      receivers.set(socket.id, socket);
      console.log(`🔊 Receiver connected: ${socket.deviceName}`);
    }

    // Send confirmation
    socket.emit("registered", {
      success: true,
      id: socket.id
    });
  });

  // ===== AUDIO STREAM =====
  socket.on("audio", (buffer) => {
    messageCount++;

    // Broadcast to all receivers
    receivers.forEach((client) => {
      client.emit("audio", buffer);
    });

    // Debug log every 50 packets
    if (messageCount % 50 === 0) {
      console.log(`📡 Packets streamed: ${messageCount}`);
    }
  });

  // ===== STATUS REQUEST =====
  socket.on("status", () => {
    socket.emit("status", {
      transmitter: transmitterSocket ? transmitterSocket.id : null,
      receiverCount: receivers.size,
      packets: messageCount
    });
  });

  // ===== DISCONNECT =====
  socket.on("disconnect", () => {
    console.log(`❌ Disconnected: ${socket.id}`);

    if (socket === transmitterSocket) {
      transmitterSocket = null;
      console.log("⚠️ Transmitter disconnected");
    }

    if (receivers.has(socket.id)) {
      receivers.delete(socket.id);
      console.log("⚠️ Receiver removed");
    }
  });
});

// ===== PORT CONFIG =====
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});