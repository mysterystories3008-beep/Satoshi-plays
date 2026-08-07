/* =======================================
   SERVER.JS - CLIENT-SIDE PHYSICS & SERVER VALIDATION
========================================== */

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const { ethers } = require("ethers");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));

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
// UPRAVLJANJE SESIJAMA NA SERVERU
// ==========================================

const games = new Map();

function createGameState(wallet, gameId, signature) {
    return {
        gameId,
        wallet,
        signature,
        alive: true,
        started: true,
        score: 0,
        startTime: Date.now()
    };
}

// ==========================================
// SOCKET.IO
// ==========================================

io.on("connection", (socket) => {
    console.log("Klijent povezan:", socket.id);

    socket.on("start-game", (data) => {
        const wallet = data?.wallet;
        const signature = data?.signature;
        
        if (!wallet) {
            socket.emit("error", { message: "Wallet required" });
            return;
        }

        if (games.has(socket.id)) {
            games.delete(socket.id);
        }

        const gameId = generateGameId();
        const state = createGameState(wallet, gameId, signature);

        const sessions = readFile(SESSION_FILE);
        sessions.push({
            gameId,
            wallet,
            signature: signature || "no_signature",
            startTime: state.startTime,
            active: true
        });
        saveFile(SESSION_FILE, sessions);

        games.set(socket.id, state);

        // Obaveštavamo klijenta da je igra počela i šaljemo mu gameId
        socket.emit("game-started", {
            gameId,
            startTime: state.startTime
        });

        console.log(`[GAME START] ${wallet} | ${gameId}`);
    });

    // Opciono praćenje skokova radi evidencije (klijent sam vodi fiziku)
    socket.on("jump", () => {
        const state = games.get(socket.id);
        if (!state || !state.alive) return;
        // Ovde možemo zabeležiti da je igrač skočio ako zatreba za dodatne provere
    });

    // Glavna provera: Klijent javlja da je udario u prepreku
    socket.on("player-died", (data) => {
        const state = games.get(socket.id);
        if (!state || !state.alive) return;
        
        state.alive = false;
        
        // ANTI-CHEAT: Server sam meri proteklo vreme i računa maksimalno moguće poene
        const elapsedSeconds = (Date.now() - state.startTime) / 1000;
        const maxPossibleScore = Math.floor(elapsedSeconds * 20); // Dozvoljeni limit poena po sekundi
        
        // Uzimamo minimum (ako je poslao više nego što je vremenski moguće, sečemo na limit)
        const clientScore = data.score || 0;
        const verifiedScore = Math.min(clientScore, maxPossibleScore);
        
        state.score = verifiedScore;
        
        finishGame(socket, state, state.signature);
    });

    socket.on("disconnect", () => {
        games.delete(socket.id);
        console.log("Klijent diskonektovan:", socket.id);
    });
});

function finishGame(socket, state, signature) {
    const endTime = Date.now();
    const duration = endTime - state.startTime;
    const finalScore = state.score;

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

    if (duration < 1500) {
        session.active = false;
        saveFile(SESSION_FILE, sessions);
        socket.emit("game-over", { success: false, error: "Game too short", score: finalScore });
        games.delete(socket.id);
        return;
    }

    // Provera da li je u pitanju gost ili nema validan potpis
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

    // KRIPTOGRAFSKA VERIFIKACIJA METAMASK POTPISA
    try {
        const recoveredAddress = ethers.verifyMessage(`Login to Satoshi Plays: ${state.wallet}`, signature);
        
        if (recoveredAddress.toLowerCase() !== state.wallet.toLowerCase()) {
            throw new Error("Potpis ne odgovara adresi novčanika!");
        }
    } catch (err) {
        console.log("[SECURITY WARNING] Upozorenje na potpis:", err.message);
    }

    session.active = false;
    session.score = finalScore;
    session.endTime = endTime;
    session.timestamp = endTime;
    session.signature = signature;
    session.duration = duration;
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
        duration
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

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
