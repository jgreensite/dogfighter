# Multiplayer 2.5D Space Combat Game: Technical Architecture & Development Plan

## 1. System Architecture

The game will employ a client-server architecture.

```
+---------------------+      +------------------------+      +---------------------+
|     Game Client     |----->|       Web Server       |<---->|      Database       |
| (Browser - React/TS)|      | (Node.js - Remix/Express)|      | (SQLite via sql.js) |
| - UI (Lobby, HUD)   |<-----+       (HTTP/REST)      +------+---------------------+
| - 3D Rendering (Three.js) |                            |
| - Asset Management  |      +------------------------+      |
| - Input Handling    |----->|   Real-time Server     |      |
| - Client-side Logic |      | (Node.js - Socket.IO)  |      |
+---------------------+<-----+      (WebSockets)       +------+
                             +------------------------+
```

**Components:**

*   **Game Client (Browser):**
    *   **UI Layer (React/Remix):** Manages the lobby, game creation/joining, settings, HUD, and high score display. Styled with Tailwind CSS (aiming for shadcn/ui component style).
    *   **Rendering Engine (Three.js):** Handles 2.5D/3D rendering of ships, projectiles, environment on an HTML5 Canvas.
    *   **Game Logic:** Manages client-side aspects of gameplay, input handling, prediction (for latency compensation), and interpolation of server states.
    *   **Networking Client (Socket.IO Client):** Communicates with the Real-time Server via WebSockets for game state synchronization and player actions.
    *   **Asset Manager:** Loads and manages game assets (3D models, textures, sounds).

*   **Web Server (Node.js - Remix/Express):**
    *   Serves the React application (HTML, CSS, JS bundles).
    *   Provides HTTP/REST APIs for non-real-time actions:
        *   User authentication (if implemented).
        *   Lobby creation and listing.
        *   High score table management.
    *   Integrates with the Database.

*   **Real-time Server (Node.js - Socket.IO on Express):**
    *   Manages active game sessions.
    *   Handles real-time communication with clients via WebSockets.
    *   Processes player inputs, updates game state authoritatively.
    *   Broadcasts game state changes to relevant clients.
    *   Manages game logic (rules, win/loss conditions, physics if server-authoritative).

*   **Database (SQLite via `sql.js`):**
    *   Stores persistent data:
        *   Player accounts (if applicable).
        *   High scores.
        *   Game session configurations/templates (potentially).
    *   `sql.js` runs SQLite compiled to WebAssembly, allowing it to run in the Node.js environment without native binaries and persist to a file.

**Interactions:**

1.  **Initial Load:** Client browser requests the game page from the Web Server. Remix serves the React application.
2.  **Lobby Operations:** Client interacts with the Web Server via HTTP/REST (Remix actions/loaders) or WebSockets to create, list, or join game lobbies/sessions.
3.  **Game Session:**
    *   Once a game starts, the client establishes a WebSocket connection with the Real-time Server.
    *   Player inputs (movement, shooting) are sent to the Real-time Server.
    *   The server processes inputs, updates the authoritative game state, and broadcasts updates to all clients in that session.
    *   Clients render the game based on server updates, applying client-side prediction and interpolation for smoothness.
4.  **High Scores:** Client can view high scores (fetched from Web Server API), and new scores are submitted to the Web Server API post-game.

## 2. Technology Choices

*   **Frontend Framework (UI):** **Remix (React)**
    *   **Justification:** Already set up in the project. Excellent for building web applications with server-side rendering and client-side interactivity. Good for the lobby, HUD, and other UI elements.
*   **Styling:** **Tailwind CSS**
    *   **Justification:** Already configured. Utility-first CSS framework for rapid UI development. We will aim to use components styled similarly to **shadcn/ui** (which is built on Tailwind CSS and Radix UI). `shadcn-ui` components can be added via its CLI (`npx shadcn-ui@latest add <component>`). Key dependencies for this approach (`tailwindcss-animate`, `class-variance-authority`, `clsx`, `lucide-react`) are included.
*   **Frontend Game Engine (2.5D/3D Rendering):** **Three.js**
    *   **Justification:** Powerful and widely-used 3D library for JavaScript. Excellent performance, extensive features, large community, and good documentation. Well-suited for browser-based 3D games and can handle 2.5D perspectives effectively by using 3D models on a 2D plane with an orthographic or carefully configured perspective camera.
*   **Backend Framework (Web Server & Real-time Server Integration):** **Express.js (with Remix & Socket.IO)**
    *   **Justification:** Remix runs on an Express-based server by default (e.g. `remix-serve` or a custom setup). Express is mature, flexible, and has a vast ecosystem. Socket.IO integrates well with Express's HTTP server for WebSocket communication.
*   **Real-time Communication:** **Socket.IO**
    *   **Justification:** Simplifies WebSocket implementation, providing features like rooms (for game sessions/lobbies), automatic reconnection, and fallbacks (though WebSockets are widely supported now). Efficient for real-time data transfer.
*   **Database:** **SQLite (via `sql.js`)**
    *   **Justification:** `sql.js` is SQLite compiled to WebAssembly. It can run within Node.js without needing native binaries, which is crucial for WebContainer compatibility. It can read/write SQLite database files, providing simple persistence for high scores, user data, etc. For an MVP, this is lightweight and sufficient. The WASM file (`sql-wasm.wasm`) will be served statically.
*   **Programming Language:** **TypeScript**
    *   **Justification:** Superset of JavaScript adding static typing. Improves code quality, maintainability, and developer productivity, especially for larger projects. Already set up in the Remix template.

## 3. Data Models

*(Simplified for MVP)*

*   **Player:**
    *   `id`: STRING (Primary Key, e.g., Socket.IO client ID or a persistent UUID if accounts are added)
    *   `username`: STRING
    *   `currentSessionId`: STRING (Nullable, Foreign Key to GameSession)

*   **GameSession:**
    *   `id`: STRING (Primary Key, e.g., UUID)
    *   `hostId`: STRING (Foreign Key to Player)
    *   `status`: STRING (e.g., 'lobby', 'in-progress', 'finished')
    *   `maxPlayers`: INTEGER
    *   `gameMode`: STRING (e.g., 'deathmatch', 'teamDeathmatch')
    *   `gameSettings`: JSON (e.g., { timeLimit: 300, scoreLimit: 10 })
    *   `createdAt`: TIMESTAMP

*   **HighScore:**
    *   `id`: INTEGER (Primary Key, Auto-increment)
    *   `username`: STRING (Or `playerId` if accounts are implemented)
    *   `score`: INTEGER
    *   `gameMode`: STRING
    *   `achievedAt`: TIMESTAMP

**Database Schema (SQLite - conceptual):**

```sql
CREATE TABLE Players (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    currentSessionId TEXT,
    FOREIGN KEY (currentSessionId) REFERENCES GameSessions(id)
);

CREATE TABLE GameSessions (
    id TEXT PRIMARY KEY,
    hostId TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'lobby',
    maxPlayers INTEGER NOT NULL DEFAULT 8,
    gameMode TEXT NOT NULL DEFAULT 'deathmatch',
    gameSettings TEXT, -- JSON stored as TEXT
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE HighScores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    score INTEGER NOT NULL,
    gameMode TEXT NOT NULL,
    achievedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 4. API Design

**HTTP/REST APIs (Remix actions/loaders):**

*   `POST /api/lobbies`: Create a new game lobby/session.
    *   Request: `{ "maxPlayers": 8, "gameMode": "deathmatch", "settings": {...} }`
    *   Response: `{ "sessionId": "uuid", ...lobbyDetails }`
*   `GET /api/lobbies`: List available lobbies.
    *   Response: `[{ "sessionId": "uuid", "hostUsername": "...", "playerCount": 1, "maxPlayers": 8, "gameMode": "deathmatch" }, ...]`
*   `POST /api/highscores`: Submit a new high score.
    *   Request: `{ "username": "player1", "score": 1000, "gameMode": "deathmatch" }`
    *   Response: `{ "id": 1, ...scoreDetails }`
*   `GET /api/highscores`: Get high score table (with filtering options like gameMode).
    *   Query Params: `?gameMode=deathmatch&limit=10`
    *   Response: `[{ "username": "player1", "score": 1000, ... }, ...]`

**WebSocket Events (Socket.IO):**

*   **Client to Server:**
    *   `join_lobby { lobbyId }`: Client requests to join a specific lobby.
    *   `leave_lobby { lobbyId }`: Client leaves a lobby.
    *   `start_game { lobbyId, settings }`: Lobby host starts the game.
    *   `join_game_session { sessionId }`: Client attempts to join an active game session.
    *   `player_input { type: 'move', direction: {...}, timestamp: ... }`: Player movement input.
    *   `player_input { type: 'shoot', weapon: 'primary', timestamp: ... }`: Player shooting input.
    *   `chat_message { message: "Hello!" }` (In-lobby or in-game chat)

*   **Server to Client(s):**
    *   `lobby_updated { lobbyId, players: [...], settings: {...} }`: Sent when lobby state changes.
    *   `game_started { sessionId, initialState: {...} }`: Notifies clients game has started and provides initial state.
    *   `game_state_update { timestamp: ..., players: [{id, pos, rot, health}, ...], projectiles: [...], events: [...] }`: Periodic or event-driven game state broadcast.
    *   `player_joined { playerId, username }`: Notify clients in session/lobby about a new player.
    *   `player_left { playerId }`: Notify clients about a player leaving.
    *   `projectile_spawned { id, ownerId, type, pos, vel }`
    *   `ship_destroyed { victimId, attackerId, scoreUpdate: {...} }`
    *   `game_over { winner: "...", scores: [...] }`: Game session ended.
    *   `chat_message { senderId, username, message }`

## 5. Development Roadmap (MVP)

**Phase 1: Core Setup & Single Player Mechanics**

*   **Milestone 1.1: Basic Remix App & Three.js Integration**
    *   Set up Remix project (done by template import).
    *   Integrate Three.js: Create a canvas, basic scene, render a single 3D ship model.
    *   Implement ship movement controls (keyboard input) on a 2D plane.
*   **Milestone 1.2: Basic Combat**
    *   Implement primary weapon system (shooting projectiles).
    *   Basic projectile physics (movement).
    *   Dummy targets or simple AI for testing combat.
*   **Milestone 1.3: UI Shells**
    *   Basic React components for Lobby, HUD (placeholder data).
    *   Navigation between main menu, lobby, and game.

**Phase 2: Backend & Basic Multiplayer**

*   **Milestone 2.1: Server Setup**
    *   Set up custom Express server with Socket.IO.
    *   Implement `sql.js` for database interaction (simple schema for high scores).
*   **Milestone 2.2: Lobby System (Basic)**
    *   API/WebSocket messages for creating and listing "sessions" (not full lobbies yet).
    *   Clients can connect to a designated session.
*   **Milestone 2.3: Real-time Synchronization (Core)**
    *   Server authoritative ship movement: Client sends input, server updates state, broadcasts to clients.
    *   Basic state synchronization for player positions.
    *   Projectile spawning and movement synchronized.
*   **Milestone 2.4: Basic Multiplayer Gameplay**
    *   Multiple players can see each other and shoot.
    *   Simple hit detection and health system.
    *   Win/loss condition: First to X kills (Deathmatch).

**Phase 3: Polishing MVP Features**

*   **Milestone 3.1: Full Lobby System**
    *   UI for creating, joining, configuring game sessions (max players, game mode).
    *   Player list in lobby.
    *   Host controls (start game).
*   **Milestone 3.2: In-Game HUD**
    *   Display score, health, ammo.
    *   Basic mini-map (dots for players).
*   **Milestone 3.3: High Score Table**
    *   Persistent high scores using `sql.js`.
    *   UI to display leaderboard.
*   **Milestone 3.4: Basic 2.5D Polish**
    *   Improve visual depth with better camera setup and simple environmental elements.
    *   Basic power-ups (e.g., health pack, speed boost).

**MVP Deliverable:** A functional game with one game mode (e.g., Deathmatch), supporting 2-4 players, including a lobby system, basic combat, HUD, and a persistent high score table.

## 6. Key Challenges & Mitigation Strategies

*   **Real-time State Synchronization:**
    *   **Challenge:** Keeping all clients in sync with minimal perceived latency.
    *   **Mitigation:**
        *   **Server Authority:** Server is the source of truth for game state.
        *   **Client-Side Prediction:** Client predicts results of its own actions immediately for responsiveness.
        *   **Server Reconciliation:** Server corrects client if prediction was wrong.
        *   **Interpolation/Extrapolation:** Smooth rendering of other players' movements based on received states.
        *   **Delta Compression:** Send only changed state to reduce bandwidth.
        *   **Reliable UDP (over WebRTC) or Optimized WebSockets:** For MVP, WebSockets (Socket.IO) are fine. For lower latency, WebRTC data channels could be explored later, but add complexity.

*   **Latency Compensation:**
    *   **Challenge:** Network delay making interactions feel sluggish or unfair.
    *   **Mitigation:**
        *   Client-Side Prediction (as above).
        *   Lag compensation techniques on the server for hit detection (e.g., rewinding game state to when a shot was fired).

*   **Performance on Diverse Devices:**
    *   **Challenge:** Ensuring 60 FPS and fast load times across different browsers and hardware.
    *   **Mitigation:**
        *   **Optimization:** Efficient Three.js usage (geometry batching, instancing, careful material/shader use).
        *   **Asset Optimization:** Compress textures (e.g., WebP), use efficient 3D model formats (glTF/GLB).
        *   **Level of Detail (LOD):** Simpler models/effects for distant objects (post-MVP).
        *   **Throttling Updates:** Don't send updates more frequently than needed.
        *   **Performance Profiling:** Regularly use browser developer tools to identify bottlenecks.

*   **Asset Management & Load Times:**
    *   **Challenge:** Large 3D assets can lead to long initial load times.
    *   **Mitigation:**
        *   **Lazy Loading/Code Splitting:** Load assets and game code only when needed. Remix handles code splitting well.
        *   **Progressive Loading:** Show loading indicators and load critical assets first.
        *   **CDN for Assets:** (Post-MVP, for wider deployment).
        *   **Efficient Formats:** GLB for 3D models, WebP for textures.

*   **Cheat Prevention (Basic):**
    *   **Challenge:** Players modifying client-side code to gain unfair advantages.
    *   **Mitigation (MVP level):**
        *   **Server-Side Validation:** All critical actions (movement, shooting, scoring) validated by the server. Client inputs are requests, not commands.
        *   (Advanced, post-MVP: obfuscation, server-side physics, anomaly detection).

*   **Scalability (Server):**
    *   **Challenge:** Handling many concurrent game sessions and players.
    *   **Mitigation (MVP focus is on functionality, but to consider):**
        *   Efficient server-side code.
        *   Stateless game logic where possible to allow horizontal scaling (post-MVP).
        *   Optimize database queries.
        *   For WebContainer, scaling is limited by the single Node.js instance. True scalability would require a different deployment environment.

*   **Database in WebContainer:**
    *   **Challenge:** `sql.js` loads the entire database into memory if not configured for file persistence. File persistence in Node.js with `sql.js` involves reading/writing the DB file, which can have performance implications for frequent writes.
    *   **Mitigation:**
        *   For high scores, writes are infrequent.
        *   Load DB on server start, save periodically or on shutdown.
        *   Ensure the WASM file for `sql.js` is served correctly.

This plan provides a solid foundation. The key is to iterate, focusing on core gameplay loops first and then expanding features.
