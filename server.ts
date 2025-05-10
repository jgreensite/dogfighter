import { createRequestHandler } from "@remix-run/express";
import { installGlobals } from "@remix-run/node";
import compression from "compression";
import express from "express";
import morgan from "morgan";
import { createServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import path from "node:path";
import { fileURLToPath } from "node:url";

installGlobals();

const viteDevServer =
  process.env.NODE_ENV === "production"
    ? undefined
    : await import("vite").then((vite) =>
        vite.createServer({
          server: { middlewareMode: true },
        })
      );

const remixHandler = createRequestHandler({
  build: viteDevServer
    ? () => viteDevServer.ssrLoadModule("virtual:remix/server-build")
    : // @ts-ignore Element implicitly has an 'any' type because expression of type '"virtual:remix/server-build"' can't be used to index type 'typeof import("*.server")'.
      await import("./build/server/index.js"),
});

const app = express();

app.use(compression());

// http://expressjs.com/en/advanced/best-practice-security.html#at-a-minimum-disable-x-powered-by-header
app.disable("x-powered-by");

// Handle asset requests
if (viteDevServer) {
  app.use(viteDevServer.middlewares);
} else {
  // Vite fingerprints its assets so we can cache forever.
  app.use(
    "/assets",
    express.static("build/client/assets", { immutable: true, maxAge: "1y" })
  );
}

// Everything else (like favicon.ico) is cached for an hour. You may want to be
// more aggressive with this caching.
app.use(express.static("build/client", { maxAge: "1h" }));

// Serve sql-wasm.wasm
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(
  "/sql-wasm.wasm",
  express.static(path.join(__dirname, "node_modules/sql.js/dist/sql-wasm.wasm"))
);


app.use(morgan("tiny"));

// HTTP server setup for Socket.IO
const httpServer = createServer(app);

// Socket.IO setup
const io = new SocketIOServer(httpServer);

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Example: Handle a custom event from the client
  socket.on("chat message", (msg) => {
    console.log("message: " + msg);
    io.emit("chat message", msg); // Broadcast to everyone
  });

  socket.on("player_move", (data) => {
    // Handle player movement, validate, update game state
    // Broadcast to other players in the same game session
    socket.broadcast.to(data.sessionId).emit("player_moved", { playerId: socket.id, ...data.newState });
  });

  socket.on("join_lobby", (lobbyId) => {
    socket.join(lobbyId);
    console.log(socket.id, "joined lobby", lobbyId);
    // Notify others in lobby or send lobby state
  });
  
  socket.on("join_game_session", (sessionId) => {
    socket.join(sessionId); // Use Socket.IO rooms for game sessions
    console.log(socket.id, "joined game session", sessionId);
    // Send initial game state or notify other players
  });


  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    // Handle player disconnect, e.g., remove from game session
  });
});

// Handle all other requests with Remix
app.all("*", remixHandler);

const port = process.env.PORT || 3000;
httpServer.listen(port, () =>
  console.log(`Express server listening at http://localhost:${port}`)
);
