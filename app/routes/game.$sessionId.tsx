import type { MetaFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useParams } from "@remix-run/react";
import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { GameClient } from "~/game/client"; // Placeholder for game client logic
import { getDb } from "~/db.server";

export const meta: MetaFunction<typeof loader> = ({ params }) => {
  return [{ title: `Game Session: ${params.sessionId} - Space Combat` }];
};

export async function loader({ params }: LoaderFunctionArgs) {
  const sessionId = params.sessionId;
  if (!sessionId) {
    return redirect("/lobby");
  }

  const db = await getDb();
  const stmt = db.prepare("SELECT id, gameMode, gameSettings FROM GameSessions WHERE id = ? AND status != 'finished'");
  const sessionInfo = stmt.get([sessionId]);
  stmt.free();

  if (!sessionInfo) {
    // Optionally, redirect to lobby if session not found or not joinable
    // For now, let's allow joining and let socket handle full validation
    console.warn(`Session ${sessionId} not found or not joinable via DB query.`);
    // return redirect("/lobby"); 
  }
  
  return json({ sessionId, sessionInfo });
}

export default function GameSessionPage() {
  const { sessionId, sessionInfo } = useLoaderData<typeof loader>();
  const params = useParams(); // sessionId is also here
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameClient, setGameClient] = useState<GameClient | null>(null);
  const [connectionStatus, setConnectionStatus] = useState("Connecting...");

  useEffect(() => {
    if (!params.sessionId) return;

    const newSocket = io(); // Connect to the server
    setSocket(newSocket);

    newSocket.on("connect", () => {
      setConnectionStatus(`Connected. Joining session: ${params.sessionId}`);
      newSocket.emit("join_game_session", params.sessionId);
    });

    newSocket.on("disconnect", () => {
      setConnectionStatus("Disconnected from server.");
    });

    newSocket.on("connect_error", (err) => {
      setConnectionStatus(`Connection Error: ${err.message}`);
    });
    
    // Placeholder: listen for game state or other relevant events
    newSocket.on("game_state_update", (state) => {
      // console.log("Received game state:", state);
      if (gameClient) {
        gameClient.updateGameState(state);
      }
    });

    newSocket.on("player_moved", (data) => {
      if (gameClient) {
        gameClient.updatePlayerPosition(data.playerId, data);
      }
    });

    // Initialize game client
    if (canvasRef.current && newSocket) {
      const client = new GameClient(canvasRef.current, newSocket, params.sessionId);
      setGameClient(client);
      client.start();
    }

    return () => {
      newSocket.disconnect();
      if (gameClient) {
        gameClient.stop();
      }
    };
  }, [params.sessionId]); // Re-run if sessionId changes (though typically it won't on this page)

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
      <h1 className="text-3xl font-bold mb-2">Game Session: {sessionId}</h1>
      <p className="mb-4">Status: {connectionStatus}</p>
      {sessionInfo && <p className="mb-1">Mode: {(sessionInfo as any).gameMode}</p>}
      <canvas ref={canvasRef} className="border-2 border-gray-700 rounded-lg"></canvas>
      <div className="mt-4 p-4 bg-gray-800 rounded w-full max-w-3xl">
        <h2 className="text-xl font-semibold">Controls:</h2>
        <p>W/A/S/D or Arrow Keys: Move</p>
        <p>Spacebar: Shoot</p>
        <p className="text-sm text-gray-400 mt-2"> (Game client logic is a placeholder)</p>
      </div>
    </div>
  );
}
