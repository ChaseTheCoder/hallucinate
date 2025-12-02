# Hallucinate (minimal)

Simple Next.js app with frontend and backend API routes to create and join games.

Install & run:

```bash
# macOS / zsh
cd hallucinate
npm install
npm run dev
```

Pages:
- `/` - Home (Join Game / Start Game)
- `/start` - Start a new game and get a join code
- `/join` - Enter name and join a game
- `/game/[code]` - Game lobby (shows players)

APIs:
- `POST /api/games` - create a game -> returns code
- `POST /api/games/[code]/join` - join game with body { name }
- `GET /api/games/[code]` - get game info

Notes:
- In-memory store (server process memory). Not persistent.
- Designed for local development and demo only.
