import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Sample texts for races
const raceTexts = [
  "The quick brown fox jumps over the lazy dog. This pangram contains every letter of the English alphabet at least once.",
  "Programming is the process of creating a set of instructions that tell a computer how to perform a task. Programming can be done using a variety of computer programming languages.",
  "The Internet is a global system of interconnected computer networks that use the standard Internet protocol suite to link devices worldwide.",
  "Artificial intelligence is intelligence demonstrated by machines, as opposed to the natural intelligence displayed by humans or animals.",
  "Cloud computing is the on-demand availability of computer system resources, especially data storage and computing power, without direct active management by the user."
];

// Player colors
const playerColors = [
  "#3498db", "#e74c3c", "#2ecc71", "#f39c12",
  "#9b59b6", "#1abc9c", "#d35400", "#34495e"
];

// Bot names
const botNames = [
  "TypeBot", "SpeedTyper", "KeyMaster", "WordWizard",
  "RapidKeys", "SwiftFingers", "TypePro", "KeyboardKing",
  "QuickType", "FlashKeys", "TurboTyper", "NinjaKeys"
];

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

type Difficulty = 'easy' | 'medium' | 'hard' | string;

// Store active races
const races: Map<string, Race> = new Map();

class ComputerPlayer implements Player {
  id: string;
  name: string;
  progress: number = 0;
  wpm: number = 0;
  accuracy: number = 100;
  position: number = 0;
  finished: boolean = false;
  color: string;
  isBot: boolean = true;
  textLength: number;
  minWPM: number;
  maxWPM: number;
  errorRate: number;
  consistencyFactor: number;
  startTime: number | null = null;
  updateInterval: NodeJS.Timeout | null = null;

  constructor(id: string, name: string, color: string, difficulty: Difficulty, textLength: number) {
    this.id = id;
    this.name = name;
    this.color = color;
    this.textLength = textLength;

    // Bot typing characteristics
    switch (difficulty) {
      case "easy":
        this.minWPM = 20;
        this.maxWPM = 40;
        this.errorRate = 0.05;
        this.consistencyFactor = 0.7;
        break;
      case "medium":
        this.minWPM = 40;
        this.maxWPM = 70;
        this.errorRate = 0.03;
        this.consistencyFactor = 0.8;
        break;
      case "hard":
        this.minWPM = 70;
        this.maxWPM = 100;
        this.errorRate = 0.01;
        this.consistencyFactor = 0.9;
        break;
      default:
        this.minWPM = 30 + Math.floor(Math.random() * 50);
        this.maxWPM = this.minWPM + 20 + Math.floor(Math.random() * 30);
        this.errorRate = 0.01 + Math.random() * 0.05;
        this.consistencyFactor = 0.7 + Math.random() * 0.3;
    }

    this.wpm = this.minWPM + Math.random() * (this.maxWPM - this.minWPM);
  }

  startTyping(raceId: string): void {
    this.startTime = Date.now();

    this.updateInterval = setInterval(() => {
      if (!this.startTime || this.finished) return;

      const elapsedMinutes = (Date.now() - this.startTime) / 60000;
      const speedVariation = Math.sin(Date.now() / 5000) * (1 - this.consistencyFactor) * 10;
      const currentWPM = Math.max(this.minWPM, Math.min(this.maxWPM, this.wpm + speedVariation));

      const charsTyped = currentWPM * 5 * elapsedMinutes;
      this.progress = Math.min(100, (charsTyped / this.textLength) * 100);
      this.wpm = currentWPM;

      if (Math.random() < this.errorRate) {
        this.accuracy = Math.max(80, this.accuracy - Math.random() * 2);
      }

      if (this.progress >= 100) {
        this.progress = 100;
        this.finished = true;
        if (this.updateInterval) clearInterval(this.updateInterval);

        if (races.has(raceId)) {
          const race = races.get(raceId)!;
          this.position = race.players.filter(p => p.finished).length;
          
          if (race.players.every(p => p.finished)) {
            race.status = "finished";
            race.endTime = Date.now();
          }
          io.to(raceId).emit("gameState", race);
        }
      }

      if (races.has(raceId)) {
        io.to(raceId).emit("gameState", races.get(raceId));
      }
    }, 200);
  }

  stopTyping(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
  }
}

interface ProgressUpdate {
  progress: number;
  position: number;
  errors: number;
}

io.on('connection', (socket: Socket) => {
  console.log('New connection:', socket.id);

  const { raceId, playerName, isComputerMode, numBots, difficulty } = socket.handshake.query as {
    raceId?: string;
    playerName?: string;
    isComputerMode?: string;
    numBots?: string;
    difficulty?: Difficulty;
  };

  if (!raceId) {
    socket.emit('error', 'Race ID is required');
    socket.disconnect();
    return;
  }

  socket.join(raceId);

  if (!races.has(raceId)) {
    const raceText = raceTexts[Math.floor(Math.random() * raceTexts.length)];
    races.set(raceId, {
      id: raceId,
      status: 'waiting',
      players: [],
      text: raceText,
      startTime: null,
      endTime: null,
      isComputerMode: isComputerMode === 'true',
      computerPlayers: []
    });

    if (isComputerMode === 'true') {
      const race = races.get(raceId)!;
      const botCount = parseInt(numBots || '3', 10);

      for (let i = 0; i < botCount; i++) {
        const botName = botNames[Math.floor(Math.random() * botNames.length)] + (i + 1);
        const botColor = playerColors[(i + 1) % playerColors.length];
        const botId = `bot-${raceId}-${i}`;
        const botDifficulty = difficulty === 'mixed' ? 
          ['easy', 'medium', 'hard'][Math.floor(Math.random() * 3)] : 
          difficulty || 'medium';

        const computerPlayer = new ComputerPlayer(botId, botName, botColor, botDifficulty, race.text.length);
        race.players.push(computerPlayer);
        race.computerPlayers.push(computerPlayer);
      }
    }
  }

  const race = races.get(raceId)!;
  const playerColor = playerColors[race.players.length % playerColors.length];

  const player: Player = {
    id: socket.id,
    name: playerName || 'Anonymous',
    progress: 0,
    wpm: 0,
    accuracy: 100,
    position: 0,
    finished: false,
    color: playerColor,
    isBot: false
  };

  race.players.push(player);
  io.to(raceId).emit('gameState', race);

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    if (races.has(raceId)) {
      const race = races.get(raceId)!;
      race.players = race.players.filter(p => p.id !== socket.id);

      if (race.players.length === 0) {
        race.computerPlayers.forEach(bot => bot.stopTyping());
        races.delete(raceId);
      } else {
        io.to(raceId).emit('gameState', race);
      }
    }
  });

  socket.on('startRace', () => {
    if (!races.has(raceId)) return;
    
    const race = races.get(raceId)!;
    if (race.status !== 'waiting') return;

    race.status = 'countdown';
    io.to(raceId).emit('gameState', race);

    setTimeout(() => {
      race.status = 'racing';
      race.startTime = Date.now();
      race.computerPlayers.forEach(bot => bot.startTyping(raceId));
      io.to(raceId).emit('gameState', race);
    }, 5000);
  });

  socket.on('updateProgress', ({ progress, position, errors }: ProgressUpdate) => {
    if (!races.has(raceId)) return;
    
    const race = races.get(raceId)!;
    const player = race.players.find(p => p.id === socket.id);

    if (player && race.status === 'racing') {
      player.progress = progress;

      if (race.startTime) {
        const elapsedMinutes = (Date.now() - race.startTime) / 60000;
        if (elapsedMinutes > 0) {
          const words = position / 5;
          player.wpm = Math.round(words / elapsedMinutes);
        }
      }

      const totalTyped = position + errors;
      if (totalTyped > 0) {
        player.accuracy = Math.max(0, 100 - (errors / totalTyped) * 100);
      }

      io.to(raceId).emit('gameState', race);
    }
  });

  socket.on('playerFinished', () => {
    if (!races.has(raceId)) return;
    
    const race = races.get(raceId)!;
    const player = race.players.find(p => p.id === socket.id);

    if (player && race.status === 'racing' && !player.finished) {
      player.finished = true;
      player.position = race.players.filter(p => p.finished).length;

      if (race.players.every(p => p.finished)) {
        race.status = 'finished';
        race.endTime = Date.now();
        race.computerPlayers.forEach(bot => bot.stopTyping());
      }

      io.to(raceId).emit('gameState', race);
    }
  });
});

// Clean up inactive races
setInterval(() => {
  const now = Date.now();
  for (const [raceId, race] of races) {
    if (race.status === 'finished' && race.endTime && now - race.endTime > 10 * 60 * 1000) {
      race.computerPlayers.forEach(bot => bot.stopTyping());
      races.delete(raceId);
    }
    if (race.status === 'waiting' && race.players.length === 0) {
      races.delete(raceId);
    }
  }
}, 5 * 60 * 1000);

// Serve static files (optional, for development)
app.use(express.static('public'));

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});