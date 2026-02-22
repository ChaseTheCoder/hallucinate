# Hallucinate (minimal)

Simple Next.js app with frontend and backend API routes to create and join games.

Install & run:

```bash
# macOS / zsh
cd hallucinate
npm install
npm run dev
```

## Pages
- `/` - Home (Join Game / Start Game)
- `/start` - Start a new game and get a join code
- `/join` - Enter name and join a game
- `/host/[code]` - Game lobby (host view)
- `/player/[code]` - Player view

## API Structure (App Router)

### REST API Endpoints

#### Create Game
- **Endpoint:** `POST /api/games`
- **File:** `app/api/games/route.ts`
- **Returns:** `{ code: string }`

```typescript
export async function POST(request: Request)
```

#### Get Game Info
- **Endpoint:** `GET /api/games/[code]`
- **File:** `app/api/games/[code]/route.ts`
- **Returns:** `{ code: string, players: Player[] }`

```typescript
export async function GET(request: Request, { params }: { params: { code: string } })
```

#### Join Game
- **Endpoint:** `POST /api/games/[code]/join`
- **File:** `app/api/games/[code]/join/route.ts`
- **Body:** `{ name: string }`
- **Returns:** `{ success: boolean, players: Player[] }`

```typescript
export async function POST(request: Request, { params }: { params: { code: string } })
```

#### Leave Game
- **Endpoint:** `POST /api/games/[code]/leave`
- **File:** `app/api/games/[code]/leave/route.ts`
- **Body:** `{ name: string }`
- **Returns:** `{ success: boolean, players: Player[] }`

```typescript
export async function POST(request: Request, { params }: { params: { code: string } })
```

### WebSocket API (Socket.IO)

**Endpoint:** `/api/socket` (Pages Router - required for Socket.IO)  
**File:** `pages/api/socket.ts`

Socket.IO requires the Pages Router API format because it needs access to the Node.js HTTP server, which isn't directly available in the App Router.

**Client Events (emit to server):**
- `subscribe-to-game` - Subscribe to real-time updates for a game
  - Payload: `code: string`
  - Joins socket room `game-${code}`
  - Receives immediate `players-updated` event with current players
- `broadcast-players-updated` - Manual trigger to broadcast player updates
  - Payload: `code: string`
  - Broadcasts `players-updated` to all clients in room
- `disconnect` - Automatic cleanup on client disconnect

**Server Events (listen on client):**
- `players-updated` - Broadcasted when players list changes
  - Payload: `Player[]`
- `error` - Error messages
  - Payload: `string`

## Data Models

All type definitions are in `types/game.ts`:

### Player
```typescript
interface Player {
  id: string       // UUID
  name: string
  eligible: boolean
  votes: number
  leader: boolean
}
```

### Game
```typescript
interface Game {
  players: Player[]
}
```

### GameStore
```typescript
interface GameStore {
  [code: string]: Game
}
```

## Architecture Notes

- **App Router** for REST API routes (all in `app/api/`)
- **Pages Router** for Socket.IO only (`pages/api/socket.ts`)
- **TypeScript** for type safety across API routes and data models
- **In-memory store** (server process memory). Not persistent.
- **REST + WebSocket hybrid**: REST for mutations, WebSocket for subscriptions

### App Router vs Pages Router

**App Router** (`app/api/`):
- Modern Next.js 13+ pattern
- Named HTTP method exports: `export async function GET()`, `POST()`, etc.
- Uses `Request` and `Response` web standards
- Route params come from function arguments: `{ params: { code: string } }`
- Request body: `await request.json()`

**Pages Router** (`pages/api/`):
- Legacy pattern, but required for Socket.IO
- Single default export: `export default function handler()`
- Uses `NextApiRequest` and `NextApiResponse`
- Only used for `/api/socket` endpoint

## Usage Pattern

### Client Flow
1. Call `POST /api/games/[code]/join` with `{ name: "Player Name" }` to join a game
2. Connect to Socket.IO endpoint `/api/socket`
3. Emit `subscribe-to-game` with the game code to receive real-time updates
4. After REST API calls, emit `broadcast-players-updated` to notify all connected clients
5. Listen for `players-updated` events to update UI

### Example Client Code
```typescript
// Join via REST API
const response = await fetch(`/api/games/${code}/join`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: playerName })
})

// Subscribe to real-time updates
socket.emit('subscribe-to-game', code)
socket.emit('broadcast-players-updated', code) // Trigger broadcast after join

// Listen for updates
socket.on('players-updated', (players: Player[]) => {
  // Update UI with new player list
})
```

## File Structure
```
app/
  api/
    games/
      route.ts              # POST /api/games (create game)
      [code]/
        route.ts            # GET /api/games/[code] (get game)
        join/
          route.ts          # POST /api/games/[code]/join
        leave/
          route.ts          # POST /api/games/[code]/leave
pages/
  api/
    socket.ts               # Socket.IO handler (Pages Router only)
server/
  gameStore.ts              # In-memory game store
types/
  game.ts                   # TypeScript interfaces
```

Designed for local development and demo only.
