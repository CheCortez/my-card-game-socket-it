"use client";

import { useEffect, useState } from "react";
import io from "socket.io-client";
import { motion } from "framer-motion";
import Cookies from "js-cookie";

import { cn } from '@/lib/utils';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";

// Use environment variable for backend URL
const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001');

type CardType = {
  suit: string;
  value: number;
  code: string;
  selected?: boolean;
};

const colors = ["Red", "Blue", "Green", "Yellow", "Purple"];
const foods = ["Apple", "Banana", "Carrot", "Donut", "Eggplant"];

function getRandomName() {
  const color = colors[Math.floor(Math.random() * colors.length)];
  const food = foods[Math.floor(Math.random() * foods.length)];
  return `${color} ${food}`;
}

export default function HomePage() {
  const [room, setRoom] = useState("");
  const [joined, setJoined] = useState(false);
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const [cards, setCards] = useState<(CardType | null)[]>([null, null, null]);
  const [revealed, setRevealed] = useState(false);
  const [message, setMessage] = useState("");
  const [scoreboard, setScoreboard] = useState<string[]>([]);
  const [username, setUsername] = useState<string>("");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [opponentCard, setOpponentCard] = useState<number | null>(null);

  useEffect(() => {
    const storedName = Cookies.get('username');
    if (storedName) {
      setUsername(storedName);
    } else {
      const randomName = getRandomName();
      setUsername(randomName);
      Cookies.set('username', randomName);
    }

    socket.on("message", (msg) => setMessage(msg));

    socket.on("cardSelected", ({ id, cardIndex }) => {
      setCards((prevCards) => {
        const newCards = [...prevCards];
        const existingCard = newCards[cardIndex];
        if (existingCard) {
          newCards[cardIndex] = { ...existingCard, selected: true };
        }
        return newCards;
      });
      if (id !== socket.id) setOpponentCard(cardIndex);
    });

    socket.on("cardUnselected", ({ id, cardIndex }) => {
      setCards((prevCards) => {
        const newCards = [...prevCards];
        const existingCard = newCards[cardIndex];
        if (existingCard) {
          newCards[cardIndex] = { ...existingCard, selected: false };
        }
        return newCards;
      });
      if (id !== socket.id) setOpponentCard(null);
    });

    socket.on("revealCards", (playerCards: CardType[]) => {
      setCards(playerCards);
      setRevealed(true);

      setTimeout(() => {
        setRevealed(false);
        setCards([null, null, null]);
        setSelectedCard(null);
        setOpponentCard(null);
      }, 3000);
    });

    socket.on("gameResult", (result: string) => {
      setScoreboard((prev) => [result, ...prev]);
    });

    socket.on("startCountdown", (time) => {
      setCountdown(time);
    });

    socket.on("countdown", (time) => {
      setCountdown(time);
    });

    socket.on("startNewGame", () => {
      setRevealed(false);
      setCards([null, null, null]);
      setSelectedCard(null);
      setOpponentCard(null);
      setCountdown(null);
    });

    return () => {
      socket.off("message");
      socket.off("cardSelected");
      socket.off("cardUnselected");
      socket.off("revealCards");
      socket.off("gameResult");
      socket.off("startCountdown");
      socket.off("countdown");
      socket.off("startNewGame");
    };
  }, [room]);

  const joinRoom = () => {
    socket.emit("joinRoom", { room, username });
    setJoined(true);
  };

  const selectCard = (index: number) => {
    if (selectedCard === index) {
      socket.emit("unselectCard", { room, cardIndex: index });
      setSelectedCard(null);
    } else if (selectedCard === null && cards[index]?.selected !== true) {
      setSelectedCard(index);
      socket.emit("selectCard", { room, cardIndex: index });
    }
  };

  const revealCards = () => {
    if (selectedCard !== null && opponentCard !== null) {
      socket.emit("revealCards", room);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "20px" }}>
      <Text variant="h1">Card Game</Text>
      {!joined ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <Input
            type="text"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            placeholder="Enter room name"
            style={{ marginBottom: "10px" }}
          />
          <Input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your name"
            style={{ marginBottom: "10px" }}
          />
          <Button onClick={joinRoom}>Join Room</Button>
        </div>
      ) : (
        <div>
          <Text>{message}</Text>
          <div style={{ display: "flex", justifyContent: "center", marginTop: "20px" }}>
            {cards.map((card, index) => (
              <motion.div
                key={index}
                initial={{ rotateY: 180 }}
                animate={{ rotateY: revealed ? 0 : 180 }}
                transition={{ duration: 0.5 }}
                style={{
                  width: "100px",
                  height: "150px",
                  margin: "10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: selectedCard === index ? "blue" : opponentCard === index ? "red" : revealed ? "white" : "gray",
                  cursor: cards[index]?.selected ? "default" : "pointer",
                  borderRadius: "10px",
                  boxShadow: "0 4px 8px rgba(0,0,0,0.1)"
                }}
                onClick={() => selectCard(index)}
              >
                {revealed && card !== null ? `${card.code}` : "?"}
              </motion.div>
            ))}
          </div>
          {countdown !== null && (
            <div style={{ marginTop: "20px" }}>
              <Text variant="h2">Revealing in {countdown} seconds...</Text>
            </div>
          )}
          <Button onClick={revealCards} disabled={selectedCard === null || opponentCard === null || revealed} style={{ marginTop: "20px" }}>
            Reveal Cards
          </Button>
        </div>
      )}
      <div style={{ marginTop: "40px", width: "300px" }}>
        <Card>
          <Text variant="h2">Scoreboard</Text>
          <ul style={{ padding: "0 20px" }}>
            {scoreboard.map((score, index) => (
              <li key={index}>{score}</li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
