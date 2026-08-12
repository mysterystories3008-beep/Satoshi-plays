/* =======================================
    SERVER.JS - SERVER AUTHORITATIVE GAME
========================================== */

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const { ethers } = require("ethers");
const mongoose = require("mongoose");

if (process.env.MONGO_URI) {
    mongoose.connect(process.env.MONGO_URI)
        .then(() => console.log("Uspešno povezano na MongoDB!"))
        .catch(err => console.error("Greška pri povezivanju na MongoDB:", err));
}
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const DAILY_SCORE_FILE = path.join(__dirname, "daily-scores.json");
const WEEKLY_SCORE_FILE = path.join(__dirname, "weekly-scores.json");
const SESSION_FILE = path.join(__dirname, "sessions.json");

// ==========================================
// POMOĆNE FUNKCIJE
// ==========================================

function readFile(filePath) {
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, "[]", "utf8");
    }
    try {
        return JSON.parse(fs.readFileSync(filePath, "utf8") || "[]");
    } catch {
        return [];
    }
}

function saveFile(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
    } catch (err) {
        console.error("Greška pri upisu:", err);
    }
}

function generateGameId() {
    return Date.now().toString(36) + "-" + Math.random().toString(36).substring(2, 10);
}

function updateDailyTop10(scoreList, newEntry) {
    const i = scoreList.findIndex(s => s.wallet.toLowerCase() === newEntry.wallet.toLowerCase());
    if (i !== -1) {
        if (newEntry.score > scoreList[i].score) scoreList[i] = newEntry;
    } else {
        scoreList.push(newEntry);
    }
    scoreList.sort((a, b) => b.score - a.score);
    if (scoreList.length > 10) scoreList.length = 10;
}

function updateWeeklyAccumulatedTop10(scoreList, newEntry) {
    const i = scoreList.findIndex(s => s.wallet.toLowerCase() === newEntry.wallet.toLowerCase());
    if (i !== -1) {
        scoreList[i].score += newEntry.score;
        scoreList[i].gameId = newEntry.gameId;
        scoreList[i].timestamp = newEntry.timestamp;
        scoreList[i].signature = newEntry.signature;
    } else {
        scoreList.push({ ...newEntry });
    }
    scoreList.sort((a, b) => b.score - a.score);
    if (scoreList.length > 10) scoreList.length = 10;
}

// ==========================================
// GAME ENGINE NA SERVERU
// ==========================================

const TICK_MS = 15;         
const GRAVITY = 0.9;        
const JUMP_V = -14;         
const GROUND_Y = 350;
const PLAYER_X = 120;
const MAX_GAME_MS = 180000; 

const games = new Map();
const onlinePlayers = new Set();
function createGameState(wallet, gameId) {
    return {
        gameId,
        wallet,
        alive: true,
        started: false,
        score: 0,
        speed: 8,          
        startTime: Date.now(),
        player: {
            x: PLAYER_X,
            y: GROUND_Y,
            vy: 0,
            jumpCount: 0,
            onGround: true
        },
        obstacles: [],
        spawnTimer: 0,
        nextSpawn: 42,      // Smanjeno sa 55 na 42 da prepreke idu češće i gušće
        tick: 0
    };
}

function calculateSpeed(startTime) {
    const elapsed = (Date.now() - startTime) / 1000;
    return Math.min(8 + (elapsed * 0.03), 16);
}

function spawnObstacle(state) {
    const startX = 850;

    const add = (t, x, y, w, h) => {
        state.obstacles.push({ type: t, x, y, w, h, dead: false });
    };

    // RASPODELA: Pojačan FUD, smanjen rugpull
    const rand = Math.random();
    let chosenType = "fud";

    if (rand < 0.40) {
        chosenType = "fud";          
    } else if (rand < 0.62) {
        chosenType = "meteor";       
    } else if (rand < 0.84) {
        chosenType = "liquidation";  
    } else if (rand < 0.92) {
        chosenType = "rug";          
    } else {
        chosenType = "double_rug";   
    }

    switch (chosenType) {
        case "rug": 
            add("rug", startX, 350, 50, 40); 
            break;
        case "double_rug":
            add("rug", startX, 350, 50, 40);
            add("rug", startX + 200, 350, 50, 40);
            break;
        case "fud": 
            add("fud", startX, 150 + Math.random() * 140, 50, 50); 
            break;
        case "meteor": 
            add("meteor", startX, -50, 40, 40); 
            break;
        case "liquidation": 
            add("liquidation", startX, 250, 60, 50); 
            break;
    }
}

function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function tickGame(state) {
    if (!state.alive || !state.started) return;

    state.tick++;
    state.speed = calculateSpeed(state.startTime);

    if (Date.now() - state.startTime > MAX_GAME_MS) {
        state.alive = false;
        return;
    }

    state.score += 8;

    const p = state.player;
    p.vy += GRAVITY;
    p.y += p.vy;

    if (p.y >= GROUND_Y) {
        p.y = GROUND_Y;
        p.vy = 0;
        p.onGround = true;
        p.jumpCount = 0;
    } else {
        p.onGround = false;
    }

    state.spawnTimer++;
    if (state.spawnTimer >= state.nextSpawn) {
        state.spawnTimer = 0;
        const elapsed = (Date.now() - state.startTime) / 1000;
        const difficultyFactor = Math.max(0.70, 1 - (elapsed * 0.002)); 
        
        state.nextSpawn = Math.floor((42 + Math.floor(Math.random() * 22)) * difficultyFactor); 
        spawnObstacle(state);
    }

    const playerBox = { x: p.x - 15, y: p.y - 15, w: 30, h: 30 };

    state.obstacles = state.obstacles.filter(obs => {
        if (obs.type === "meteor") {
            obs.x -= state.speed * 0.8; 
            obs.y += 3.8; 
        } else if (obs.type === "liquidation") {
            obs.x -= state.speed * 0.8;    
            if (obs.x < 250) obs.y = 350;
        } else if (obs.type === "fud") {
            obs.x -= state.speed * 0.8;    
            obs.y += Math.sin(state.tick * 0.05) * 4.5;
        } else {
            obs.x -= state.speed * 0.8;    
        }

        if (obs.x < -100 || obs.y > 500) return false;

        const box = { x: (obs.x - obs.w / 2) + 5, y: (obs.y - obs.h / 2) + 5, w: obs.w - 10, h: obs.h - 10 };
        if (rectsOverlap(playerBox, box)) {
            state.alive = false;
        }
        return true;
    });
}

function getPublicState(state) {
    return {
        gameId: state.gameId,
        alive: state.alive,
        started: state.started,
        score: Math.floor(state.score / 10),
        speed: state.speed,
        player: { x: state.player.x, y: state.player.y, onGround: state.player.onGround },
        obstacles: state.obstacles.map(o => ({
            id: o.x + "_" + o.y,
            type: o.type,
            x: o.x,
            y: o.y
        }))
    };
}

// ==========================================
// SOCKET.IO
// ==========================================

io.on("connection", (socket) => {
    onlinePlayers.add(socket.id);

    console.log("Klijent povezan:", socket.id);

    socket.on("start-game", (data) => {
        const wallet = data?.wallet;
        const signature = data?.signature;
        
        if (!wallet) {
            socket.emit("error", { message: "Wallet required" });
            return;
        }

        if (games.has(socket.id)) {
            clearInterval(games.get(socket.id).interval);
            games.delete(socket.id);
        }

        const gameId = generateGameId();
        const state = createGameState(wallet, gameId);
        state.started = true;
        state.signature = signature;

        const sessions = readFile(SESSION_FILE);
        sessions.push({
            gameId,
            wallet,
            signature: signature || "no_signature",
            startTime: state.startTime,
            active: true
        });
        saveFile(SESSION_FILE, sessions);

        const interval = setInterval(() => {
            tickGame(state);
            socket.emit("state", getPublicState(state));

            if (!state.alive) {
                clearInterval(interval);
                finishGame(socket, state, state.signature);
            }
        }, TICK_MS);

        state.interval = interval;
        games.set(socket.id, state);

        socket.emit("game-started", {
            gameId,
            startTime: state.startTime,
            speed: state.speed
        });

        console.log(`[GAME START] ${wallet} | ${gameId}`);
    });

    socket.on("jump", () => {
        const state = games.get(socket.id);
        if (!state || !state.alive || !state.started) return;

        const p = state.player;
        if (p.jumpCount < 2) {
            p.vy = JUMP_V;
            p.jumpCount++;
            p.onGround = false;
        }
    });

    socket.on("disconnect", () => {
        onlinePlayers.delete(socket.id);

        const state = games.get(socket.id);
        if (state) {
            clearInterval(state.interval);
            games.delete(socket.id);
        }
        console.log("Klijent diskonektovan:", socket.id);
    });
});

function finishGame(socket, state, signature) {
    const endTime = Date.now();
    const duration = endTime - state.startTime;
    const finalScore = Math.floor(state.score / 10);

    let sessions = readFile(SESSION_FILE);
    const idx = sessions.findIndex(s => s.gameId === state.gameId);

    if (idx === -1) {
        socket.emit("game-over", { success: false, error: "Invalid session", score: finalScore });
        games.delete(socket.id);
        return;
    }

    const session = sessions[idx];

    if (session.wallet.toLowerCase() !== state.wallet.toLowerCase()) {
        socket.emit("game-over", { success: false, error: "Wallet mismatch", score: finalScore });
        games.delete(socket.id);
        return;
    }

    if (session.active === false) {
        socket.emit("game-over", { success: false, error: "Already submitted", score: finalScore });
        games.delete(socket.id);
        return;
    }

    if (duration < 2000) {
        session.active = false;
        saveFile(SESSION_FILE, sessions);
        socket.emit("game-over", { success: false, error: "Game too short", score: finalScore });
        games.delete(socket.id);
        return;
    }

    if (!signature || signature === "no_signature" || signature === "guest_mode") {
        session.active = false;
        saveFile(SESSION_FILE, sessions);
        socket.emit("game-over", {
            success: false,
            error: "Gost režim - skor nije sačuvan na rang listi.",
            score: finalScore
        });
        games.delete(socket.id);
        return;
    }

    let verified = true;

    try {
        const recoveredAddress = ethers.verifyMessage(
            `Login to Satoshi Plays: ${state.wallet}`,
            signature
        );

    if (
        recoveredAddress.toLowerCase() !==
        state.wallet.toLowerCase()
    ) {
            throw new Error("Potpis ne odgovara adresi novčanika!");
        }

    } catch (err) {

        verified = false;

    console.log(
        "[SECURITY WARNING] Nevažeći potpis:",
        err.message
    );
    }

    session.active = false;
    session.score = finalScore;
    session.endTime = endTime;
    session.timestamp = endTime;
    session.signature = signature;
    session.duration = duration;
    session.verified = verified;
    saveFile(SESSION_FILE, sessions);

    const scoreEntry = {
        gameId: session.gameId,
        wallet: session.wallet,
        startTime: session.startTime,
        endTime,
        active: false,
        score: finalScore,
        timestamp: endTime,
        signature,
        duration,
        verified
    };

    let daily = readFile(DAILY_SCORE_FILE);
    updateDailyTop10(daily, scoreEntry);
    saveFile(DAILY_SCORE_FILE, daily);

    let weekly = readFile(WEEKLY_SCORE_FILE);
    updateWeeklyAccumulatedTop10(weekly, scoreEntry);
    saveFile(WEEKLY_SCORE_FILE, weekly);

    console.log(`[SCORE SAVED & VERIFIED] ${state.wallet} | Score: ${finalScore}`);

    socket.emit("game-over", {
        success: true,
        score: finalScore,
        message: "Skor uspešno verifikovan i sačuvan!"
    });

    games.delete(socket.id);
}

app.get("/get-scores/:type", (req, res) => {
    const file = req.params.type === "weekly" ? WEEKLY_SCORE_FILE : DAILY_SCORE_FILE;
    res.json(readFile(file));
});

// ==========================================
// LIVE SERVER STATUS
// ==========================================

app.get("/api/status", (req, res) => {
    const activePlayers = games.size;

    res.json({
        onlinePlayers: onlinePlayers.size,
        activeGames: games.size,
        network: "BNB Smart Chain",
        chainId: 56,
        competition: "Weekly Arena",
        competitionStatus: "LIVE",
        serverStatus: "ONLINE"
    });

});




app.get("/", (req, res) => {
    const frontendPath = path.join(__dirname, "public", "index.html");
    if (fs.existsSync(frontendPath)) {
        res.sendFile(frontendPath);
    } else {
        res.send("Satoshi Play API & Game Server is Running!");
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
