import type { MetaFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link, Form } from "@remix-run/react";
import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { Button } from "~/components/ui/button"; // Assuming shadcn/ui setup or manual creation
import { Input } from "~/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { getDb, saveDatabase } from "~/db.server"; // For managing game sessions via HTTP for now

export const meta: MetaFunction = () => {
  return [{ title: "Game Lobby - Space Combat" }];
};

interface GameSession {
  id: string;
  hostUsername: string;
  playerCount: number;
  maxPlayers: number;
  gameMode: string;
  status: string;
}

export async function loader({}: LoaderFunctionArgs) {
  const db = await getDb();
  const stmt = db.prepare("SELECT id, hostUsername, playerCount, maxPlayers, gameMode, status FROM GameSessions WHERE status = 'lobby'");
  const sessions: GameSession[] = [];
  while (stmt.step()) {
    sessions.push(stmt.getAsObject() as GameSession);
  }
  stmt.free();
  return json({ sessions });
}

export async function action({ request }: LoaderFunctionArgs) {
  const formData = await request.formData();
  const actionType = formData.get("_action");

  if (actionType === "create_session") {
    const db = await getDb();
    const sessionId = crypto.randomUUID();
    const hostUsername = formData.get("hostUsername") as string || "HostPlayer";
    const gameMode = formData.get("gameMode") as string || "deathmatch";
    const maxPlayers = parseInt(formData.get("maxPlayers") as string || "8", 10);

    db.run(
      "INSERT INTO GameSessions (id, hostUsername, playerCount, maxPlayers, gameMode, status) VALUES (?, ?, ?, ?, ?, ?)",
      [sessionId, hostUsername, 1, maxPlayers, gameMode, 'lobby']
    );
    await saveDatabase();
    return json({ success: true, sessionId });
  }
  return json({ error: "Invalid action" }, { status: 400 });
}


export default function LobbyPage() {
  const { sessions: initialSessions } = useLoaderData<typeof loader>();
  const [sessions, setSessions] = useState<GameSession[]>(initialSessions);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [username, setUsername] = useState<string>("Player" + Math.floor(Math.random() * 1000));

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on("connect", () => {
      console.log("Connected to lobby socket server");
    });
    
    // Example: Listen for lobby updates (you'd need to implement this on server)
    newSocket.on("lobby_list_updated", (updatedSessions: GameSession[]) => {
      setSessions(updatedSessions);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const handleJoinSession = (sessionId: string) => {
    if (socket) {
      socket.emit("join_lobby", sessionId); // Or navigate directly and handle join on game page
      // For now, let's navigate, game page will handle actual game session joining
      // navigate(`/game/${sessionId}`); // Needs navigate from remix
      console.log(`Attempting to join session: ${sessionId} - navigation placeholder`);
    }
  };


  return (
    <div className="container mx-auto p-4">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold">Game Lobby</h1>
        <p className="text-xl text-gray-600">Join a game or create your own!</p>
         <Input 
            type="text" 
            value={username} 
            onChange={(e) => setUsername(e.target.value)} 
            placeholder="Enter your username"
            className="mt-2 max-w-xs mx-auto"
          />
      </header>

      <section className="mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Create New Game Session</CardTitle>
            <CardDescription>Set up your own game.</CardDescription>
          </CardHeader>
          <Form method="post">
            <CardContent className="space-y-4">
              <input type="hidden" name="hostUsername" value={username} />
              <div>
                <label htmlFor="gameMode" className="block text-sm font-medium text-gray-700">Game Mode</label>
                <select 
                  id="gameMode" 
                  name="gameMode"
                  defaultValue="deathmatch"
                  className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="deathmatch">Deathmatch</option>
                  <option value="teamDeathmatch">Team Deathmatch</option>
                </select>
              </div>
              <div>
                <label htmlFor="maxPlayers" className="block text-sm font-medium text-gray-700">Max Players</label>
                <Input type="number" id="maxPlayers" name="maxPlayers" defaultValue="8" min="2" max="16" />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" name="_action" value="create_session">Create Session</Button>
            </CardFooter>
          </Form>
        </Card>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">Available Sessions</h2>
        {sessions.length === 0 ? (
          <p>No active sessions. Why not create one?</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sessions.map((session) => (
              <Card key={session.id}>
                <CardHeader>
                  <CardTitle>Session: {session.hostUsername}'s Game</CardTitle>
                  <CardDescription>Mode: {session.gameMode}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p>Players: {session.playerCount}/{session.maxPlayers}</p>
                  <p>Status: {session.status}</p>
                </CardContent>
                <CardFooter>
                   <Link to={`/game/${session.id}`}>
                    <Button>Join Session</Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
