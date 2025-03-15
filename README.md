# Socket.IO Typing Race Server Documentation

## Overview
This server implements a real-time multiplayer typing race game using Express.js and Socket.IO. It supports both human vs human and human vs computer player modes, manages game states, and handles real-time progress updates.

> Take home asignment for Fullstack Engineer position

## Table of Contents
- [Socket.IO Typing Race Server Documentation](#socketio-typing-race-server-documentation)
  - [Overview](#overview)
  - [Table of Contents](#table-of-contents)
  - [Server Setup](#server-setup)
    - [Dependencies](#dependencies)
    - [Configuration](#configuration)
  - [Key Components](#key-components)
    - [Event Flow](#event-flow)
    - [Bot AI Implementation](#bot-ai-implementation)
    - [Error Handling](#error-handling)
    - [Bugs](#bugs)

## Server Setup

### Dependencies
- `express`: Web server framework
- `socket.io`: Real-time communication library
- `http`: Native Node.js HTTP module

```typescript
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});
```
### Configuration
- Port: 4000 (configurable via environment variable PORT)
- CORS: Enabled for all origins and GET, POST methods


## Key Components
1. Race Interface
```typescript
interface Race {
  id: string;
  status: 'waiting' | 'countdown' | 'racing' | 'finished';
  players: (Player | ComputerPlayer)[];
  text: string;
  startTime: number | null;
  endTime: number | null;
  isComputerMode: boolean;
  computerPlayers: ComputerPlayer[];
}
```
2. Player Interface
```typescript
interface Player {
  id: string;
  name: string;
  progress: number;
  wpm: number;
  accuracy: number;
  position: number;
  finished: boolean;
  color: string;
  isBot: boolean;
}
```
3. ComputerPlayer Class
Implements bot behavior with configurable difficulty levels and typing characteristics.

Socket.IO Events
Connection Handshake
Required parameters:

`raceId`: Unique room identifier

`playerName`: Display name for player

`isComputerMode`: 'true'/'false' for bot opponents

`numBots`: Number of bots (computer mode only)

`difficulty`: 'easy'/'medium'/'hard'/'mixed'

### Event Flow
1. Connection

```typescript
io.on('connection', (socket: Socket) => {
  // Handle new connection
});
```
2. Game State Updates

Emitted to all clients in race room when changes occur

```typescript
io.to(raceId).emit('gameState', race);
```
Client Events
| Event Name      | Parameters                    | Description                       |
|-----------------|-------------------------------|-----------------------------------|
| startRace       | None                         | Initiates race countdown         |
| updateProgress  | { progress, position, errors} | Updates player typing statistics |
| playerFinished  | None                         | Marks player as completed race   |

### Bot AI Implementation
Key Features
- Dynamic WPM calculation based on difficulty
- Simulated human typing patterns
- Configurable error rates
- Progress-based position updates

Difficulty Settings
| Difficulty | Min WPM | Max WPM | Error Rate | Consistency |
|------------|---------|---------|------------|-------------|
| Easy       | 20      | 40      | 5%         | 70%         |
| Medium     | 40      | 70      | 3%         | 80%         |
| Hard       | 70      | 100     | 1%         | 90%         |


### Error Handling
Common Errors
1. Missing Race ID
- Socket immediately disconnected
- Error message emitted

2. Invalid Parameters
- Default values used:
  - playerName: "Anonymous"
  - numBots: 3
  - difficulty: "medium"
  
3. Socket Disconnections
- Automatic player removal
- Race cleanup if empty

### Bugs
- Some players have experienced the need to refresh their page after joining a race to view other players.

