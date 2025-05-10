import type { MetaFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { getHighScores } from "~/db.server";
import { Button } from "~/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table"; // Placeholder

export const meta: MetaFunction = () => {
  return [{ title: "High Scores - Space Combat" }];
};

interface HighScoreEntry {
  username: string;
  score: number;
  gameMode: string;
  achievedAt: string;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const gameMode = url.searchParams.get("gameMode") || undefined;
  const scores = await getHighScores(10, gameMode);
  return json({ scores });
}

export default function HighScoresPage() {
  const { scores } = useLoaderData<{ scores: HighScoreEntry[] }>();

  return (
    <div className="container mx-auto p-4">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold">High Scores</h1>
      </header>

      {/* TODO: Add filters for game mode */}

      {scores.length === 0 ? (
        <p className="text-center">No high scores yet. Go play!</p>
      ) : (
        <Table className="max-w-2xl mx-auto">
          <TableHeader>
            <TableRow>
              <TableHead>Rank</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Game Mode</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {scores.map((entry, index) => (
              <TableRow key={index}>
                <TableCell>{index + 1}</TableCell>
                <TableCell>{entry.username}</TableCell>
                <TableCell>{entry.score}</TableCell>
                <TableCell>{entry.gameMode}</TableCell>
                <TableCell>{new Date(entry.achievedAt).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <div className="text-center mt-8">
        <Link to="/lobby">
          <Button variant="outline">Back to Lobby</Button>
        </Link>
      </div>
    </div>
  );
}
