const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);

// ===== BASIC AUTH =====
const USER = "admin";
const PASS = "1234";

app.use((req, res, next) => {
  if (req.path === "/") return next();

  const auth = req.headers.authorization;
  if (!auth) {
    res.setHeader("WWW-Authenticate", "Basic");
    return res.status(401).send("Auth required");
  }

  const [user, pass] = Buffer.from(auth.split(" ")[1], "base64")
    .toString()
    .split(":");

  if (user === USER && pass === PASS) next();
  else res.status(403).send("Forbidden");
});

// ===== SOCKET.IO =====
const io = new Server(server, {
  cors: { origin: "*" },
  transports: ["websocket", "polling"]
});

// ===== STATE =====
let transmitter = null;
let receivers = new Map();
let packets = 0;

// ===== ROUTES =====
app.get("/", (req, res) => {
  res.send("🚀 Walkie Server Running");
});

app.use("/dashboard", express.static(path.join(__dirname, "public")));

// ===== SOCKET =====
io.on("connection", (socket) => {

  socket.on("register", ({ type, name }) => {
    socket.type = type;
    socket.name = name || "device";

    if (type === "transmitter") transmitter = socket;
    if (type === "receiver") receivers.set(socket.id, socket);

    socket.emit("registered", { ok: true });
  });

  socket.on("audio", (data) => {
    packets++;

    receivers.forEach(r => r.emit("audio", data));

    // Also send to dashboard clients
    socket.broadcast.emit("audio", data);
  });

  socket.on("status", () => {
    socket.emit("status", {
      transmitter: transmitter ? true : false,
      receiverCount: receivers.size,
      packets
    });
  });

  socket.on("disconnect", () => {
    if (socket === transmitter) transmitter = null;
    receivers.delete(socket.id);
  });
});

// ===== START =====
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server running:", PORT));