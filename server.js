const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const next = require('next');
const cors = require('cors');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const PORT = process.env.PORT || 3000; // Use Railway's dynamic port or fallback to 3000
const FRONTEND_URL = dev ? "http://localhost:3000" : process.env.NEXT_PUBLIC_SOCKET_URL;

const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
const values = [
  { value: 2, code: '2' },
  { value: 3, code: '3' },
  { value: 4, code: '4' },
  { value: 5, code: '5' },
  { value: 6, code: '6' },
  { value: 7, code: '7' },
  { value: 8, code: '8' },
  { value: 9, code: '9' },
  { value: 10, code: '10' },
  { value: 11, code: 'J' },
  { value: 12, code: 'Q' },
  { value: 13, code: 'K' },
  { value: 14, code: 'A' },
];

function createDeck() {
  const deck = [];
  for (const suit of suits) {
    for (const value of values) {
      deck.push({
        suit,
        value: value.value,
        code: `${value.code}${suit[0].toUpperCase()}`,
      });
    }
  }
  return deck;
}

function shuffleDeck(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

app.prepare().then(() => {
  const server = express();
  const httpServer = http.createServer(server);

  // Use CORS middleware
  server.use(cors({
    origin: FRONTEND_URL,
    methods: ["GET", "POST"]
  }));

  const io = new Server(httpServer, {
    cors: {
      origin: FRONTEND_URL,
      methods: ["GET", "POST"]
    }
  });

  const rooms = {};

  io.on('connection', (socket) => {
    console.log('User connected', socket.id);

    socket.on('joinRoom', ({ room, username }) => {
      socket.join(room);
      console.log(`User ${username} with ID ${socket.id} joined room ${room}`);
      if (!rooms[room]) {
        const deck = shuffleDeck(createDeck());
        rooms[room] = {
          deck,
          players: [],
          selectedCards: {},
          playerNames: {},
          selections: {},
          countdown: null,
        };
      }
      rooms[room].players.push(socket.id);
      rooms[room].playerNames[socket.id] = username;
      io.to(room).emit('message', `${username} joined the room ${room}`);
      io.to(room).emit('updatePlayers', rooms[room].playerNames); // Emit updated player list
    });

    socket.on('selectCard', ({ room, cardIndex }) => {
      const roomData = rooms[room];
      if (!roomData || roomData.deck[cardIndex].selected) return;

      roomData.deck[cardIndex].selected = true;
      roomData.selectedCards[socket.id] = cardIndex;
      roomData.selections[socket.id] = true;

      io.to(room).emit('cardSelected', { id: socket.id, cardIndex });

      if (Object.keys(roomData.selections).length === 2) {
        io.to(room).emit('startCountdown', 5);
        let countdown = 5;

        roomData.countdown = setInterval(() => {
          countdown--;
          if (countdown > 0) {
            io.to(room).emit('countdown', countdown);
          } else {
            clearInterval(roomData.countdown);
            io.to(room).emit('countdown', 0);
            revealCards(room);
          }
        }, 1000);
      }
    });

    socket.on('unselectCard', ({ room, cardIndex }) => {
      const roomData = rooms[room];
      if (!roomData || !roomData.deck[cardIndex].selected) return;

      roomData.deck[cardIndex].selected = false;
      delete roomData.selectedCards[socket.id];
      delete roomData.selections[socket.id];

      io.to(room).emit('cardUnselected', { id: socket.id, cardIndex });
    });

    function revealCards(room) {
      const roomData = rooms[room];
      const playerCards = Object.values(roomData.selectedCards).map(index => roomData.deck[index]);
      io.to(room).emit('revealCards', playerCards);

      // Determine the winner
      let winnerId = null;
      let highestValue = 0;
      for (const [playerId, cardIndex] of Object.entries(roomData.selectedCards)) {
        const card = roomData.deck[cardIndex];
        if (card.value > highestValue) {
          highestValue = card.value;
          winnerId = playerId;
        }
      }

      if (winnerId) {
        const winnerName = roomData.playerNames[winnerId];
        const result = `The winner is ${winnerName}`;
        io.to(room).emit('message', result);
        io.to(room).emit('gameResult', result);
      }

      // Reset the room data
      roomData.selectedCards = {};
      roomData.selections = {};

      // Start a new game after a 3-second delay
      setTimeout(() => {
        const newDeck = shuffleDeck(createDeck());
        rooms[room].deck = newDeck;
        io.to(room).emit('startNewGame');
      }, 3000);
    }

    socket.on('disconnect', () => {
      console.log('User disconnected', socket.id);
      for (const room of socket.rooms) {
        if (room !== socket.id) {
          const roomData = rooms[room];
          if (roomData) {
            roomData.players = roomData.players.filter(id => id !== socket.id);
            delete roomData.playerNames[socket.id];
            if (roomData.players.length === 0) {
              clearInterval(roomData.countdown);
              delete rooms[room];
            } else {
              io.to(room).emit('updatePlayers', roomData.playerNames); // Emit updated player list
            }
          }
        }
      }
    });
  });

  server.all('*', (req, res) => {
    return handle(req, res);
  });

  httpServer.listen(PORT, '0.0.0.0', (err) => {
    if (err) throw err;
    console.log(`Socket.IO server is listening on ${dev ? 'http://localhost' : ''}:${PORT}`);
  });

  server.listen(PORT, '0.0.0.0', (err) => {
    if (err) throw err;
    console.log(`Next.js server is listening on ${dev ? 'http://localhost' : ''}:${PORT}`);
  });
});
