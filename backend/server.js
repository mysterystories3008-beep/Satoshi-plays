/* =======================================
    SERVER.JS - SERVER AUTHORITATIVE GAME (PostgreSQL)
========================================== */
require('dotenv').config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const { ethers } = require("ethers");
const { Pool } = require("pg");
const crypto = require("crypto");



// Povezivanje na PostgreSQL bazu preko DATABASE_URL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

pool.connect()
    .then(() => console.log("Uspešno povezano na PostgreSQL bazu!"))
    .catch(err => console.error("Greška pri povezivanju na PostgreSQL:", err));

// Automatsko kreiranje tabele scores ako ne postoji
pool.query(`
    CREATE TABLE IF NOT EXISTS scores (
        id SERIAL PRIMARY KEY,
        game_id VARCHAR(255),
        wallet VARCHAR(255),
        start_time BIGINT,
        end_time BIGINT,
        score INT,
        timestamp BIGINT,
        signature TEXT,
        duration BIGINT,
        verified BOOLEAN,
        type VARCHAR(50)
    )
`).catch(err => console.error("Greška pri kreiranju tabele scores:", err));

// ==========================================
// NONCE TABELA ZA WALLET AUTENTIFIKACIJU
// KORAK 3
// ==========================================

pool.query(`
    CREATE TABLE IF NOT EXISTS auth_nonces (
        wallet_address VARCHAR(66) PRIMARY KEY,
        nonce TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL
    );

    ALTER TABLE auth_nonces
    ADD COLUMN IF NOT EXISTS created_at
    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

    ALTER TABLE auth_nonces
    ADD COLUMN IF NOT EXISTS expires_at
    TIMESTAMP WITH TIME ZONE;

    CREATE INDEX IF NOT EXISTS idx_auth_nonces_expires_at
    ON auth_nonces(expires_at);
`).catch(err => console.error("Greška pri kreiranju tabele auth_nonces:", err));



// ==========================================
// AUTH SESIJE
// Jedan MetaMask potpis -> kratkotrajna
// server-side autentifikovana sesija
// ==========================================

pool.query(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
        id SERIAL PRIMARY KEY,
        session_token_hash TEXT UNIQUE NOT NULL,
        wallet_address VARCHAR(66) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        revoked BOOLEAN NOT NULL DEFAULT FALSE
    );

    CREATE INDEX IF NOT EXISTS idx_auth_sessions_wallet
    ON auth_sessions(wallet_address);

    CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at
    ON auth_sessions(expires_at);

    CREATE INDEX IF NOT EXISTS idx_auth_sessions_active
    ON auth_sessions(wallet_address, revoked, expires_at);
`).catch(err =>
    console.error(
        "Greška pri kreiranju tabele auth_sessions:",
        err
    )
);




// ==========================================
// AUTH SESSION TABELA
// Jedan MetaMask potpis -> autentifikovana sesija
// ==========================================

pool.query(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
        id SERIAL PRIMARY KEY,
        session_token_hash VARCHAR(128) UNIQUE NOT NULL,
        wallet_address VARCHAR(66) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        revoked BOOLEAN DEFAULT FALSE
    );

    CREATE INDEX IF NOT EXISTS idx_auth_sessions_wallet
    ON auth_sessions(wallet_address);

    CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at
    ON auth_sessions(expires_at);

    CREATE INDEX IF NOT EXISTS idx_auth_sessions_token_hash
    ON auth_sessions(session_token_hash);
`).catch(err =>
    console.error(
        "Greška pri kreiranju auth_sessions tabele:",
        err
    )
);





// Automatsko kreiranje tabele user_scores za brzu rang listu
pool.query(`
    CREATE TABLE IF NOT EXISTS user_scores (
        wallet_address VARCHAR(66) PRIMARY KEY,
        weekly_total BIGINT DEFAULT 0,
        daily_best BIGINT DEFAULT 0,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_weekly_total ON user_scores(weekly_total DESC);
    CREATE INDEX IF NOT EXISTS idx_daily_best ON user_scores(daily_best DESC);
`).catch(err => console.error("Greška pri kreiranju tabele user_scores:", err));

const app = express();
const server = http.createServer(app);
app.set("trust proxy", true);


// Dozvoljeni domeni za CORS (lokalno testiranje + tvoj live domen)
const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://satoshiplays.com",
    "https://www.satoshiplays.com"
];

app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));

const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"]
    }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));

const SESSION_FILE = path.join(__dirname, "sessions.json");

// ==========================================
// POMOĆNE FUNKCIJE ZA SESIJE
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
    return Date.now().toString(36) + "-" + crypto.randomBytes(4).toString("hex");
}


// ==========================================
// PROVERA POSTOJEĆE AUTH SESIJE
// ==========================================

async function verifyAuthSession(sessionToken, wallet) {

    if (
        typeof sessionToken !== "string" ||
        !sessionToken
    ) {
        return false;
    }

    if (
        typeof wallet !== "string" ||
        !/^0x[a-fA-F0-9]{40}$/.test(wallet.trim())
    ) {
        return false;
    }

    const normalizedWallet =
        wallet.trim().toLowerCase();

    const sessionTokenHash =
        crypto
            .createHash("sha256")
            .update(sessionToken)
            .digest("hex");

    const result = await pool.query(`
        SELECT wallet_address, expires_at, revoked
        FROM auth_sessions
        WHERE session_token_hash = $1
        LIMIT 1
    `, [
        sessionTokenHash
    ]);

    if (result.rows.length === 0) {
        return false;
    }

    const session =
        result.rows[0];

    if (
        session.revoked === true
    ) {
        return false;
    }

    if (
        session.wallet_address.toLowerCase() !==
        normalizedWallet
    ) {
        return false;
    }

    const expiresAt =
        new Date(session.expires_at).getTime();

    if (
        !Number.isFinite(expiresAt) ||
        Date.now() >= expiresAt
    ) {
        return false;
    }

    return true;
}




// ==========================================
// GAME ENGINE NA SERVERU
// ==========================================

const TICK_MS = 30;           
const GRAVITY = 1.7;        
const JUMP_V = -18;         
const GROUND_Y = 350;
const PLAYER_X = 120;
const MAX_GAME_MS = 180000; 

const games = new Map();
const lastMessageTimes = new Map();
const onlinePlayers = new Set();

function createGameState(wallet, gameId) {
    return {
        gameId,
        wallet,
        alive: true,
        started: false,
        score: 0,
        speed: 10,          
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
        nextSpawn: 42,      
        tick: 0
    };
}

function calculateSpeed(startTime) {
    const elapsed = (Date.now() - startTime) / 1000;
    return Math.min(10 + (elapsed * 0.3), 50);
}

function spawnObstacle(state) {
    const startX = 850;

    const add = (t, x, y, w, h) => {
        state.obstacles.push({
            id: generateGameId(),
            type: t,
            x,
            y,
            w,
            h,
            dead: false
        });
    };

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
            add("fud", startX, 230 + Math.random() * 140, 50, 50); 
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
        
        state.nextSpawn = Math.floor((30 + Math.floor(Math.random() * 22)) * difficultyFactor); 
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
            id: o.id,
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




socket.on("start-game", async (data) => {
    const wallet = data?.wallet;
    const signature = data?.signature;
    const nonceFromClient = data?.nonce;
    const sessionToken = data?.sessionToken;



    if (!wallet) {
        socket.emit("error", { message: "Wallet required" });
        return;
    }


        // ==========================================
    // POSTOJEĆA AUTH SESIJA
    // Ako je korisnik već jednom potpisao MetaMask,
    // koristi postojeći sessionToken bez novog potpisa.
    // ==========================================

    if (sessionToken) {

        const normalizedWallet =
            typeof wallet === "string"
                ? wallet.trim().toLowerCase()
                : "";

        if (!/^0x[a-fA-F0-9]{40}$/.test(normalizedWallet)) {

            socket.emit("error", {
                message: "Invalid wallet address"
            });

            return;
        }

        const sessionValid =
            await verifyAuthSession(
                sessionToken,
                normalizedWallet
            );

        if (sessionValid) {

            console.log(
                `[AUTH SESSION REUSED] ${normalizedWallet}`
            );

            // Ako je neka prethodna igra ostala aktivna
            if (games.has(socket.id)) {

                clearInterval(
                    games.get(socket.id).interval
                );

                games.delete(socket.id);
            }

            const gameId =
                generateGameId();

            const state =
                createGameState(
                    normalizedWallet,
                    gameId
                );

            state.started = true;

            // Nema potrebe za novim MetaMask potpisom
            state.signature = "session_auth";

            // Sesija je već server-side verifikovana
            state.authVerified = true;

            const sessions =
                readFile(SESSION_FILE);

            sessions.push({
                gameId,
                wallet: normalizedWallet,
                signature: "session_auth",
                startTime: state.startTime,
                active: true,
                authVerified: true
            });

            saveFile(
                SESSION_FILE,
                sessions
            );

            const interval =
                setInterval(() => {

                    tickGame(state);

                    socket.emit(
                        "state",
                        getPublicState(state)
                    );

                    if (!state.alive) {

                        clearInterval(interval);

                        finishGame(
                            socket,
                            state,
                            state.signature
                        );
                    }

                }, TICK_MS);

            state.interval =
                interval;

            games.set(
                socket.id,
                state
            );

            socket.emit(
                "game-started",
                {
                    gameId,
                    startTime: state.startTime,
                    speed: state.speed,

                    // Vrati isti token klijentu
                    // da ostane sačuvan.
                    sessionToken
                }
            );

            console.log(
                `[GAME START - EXISTING SESSION] ${normalizedWallet} | ${gameId}`
            );

            return;
        }

        // Token postoji, ali nije validan.
        // Očisti ga na klijentu preko posebne poruke.
        socket.emit("auth-session-invalid", {
            message: "Authentication session expired or invalid"
        });

        return;
    }


    // ==========================================
    // GUEST MODE
    // ==========================================

    if (!signature || signature === "guest_mode") {
        if (games.has(socket.id)) {
            clearInterval(games.get(socket.id).interval);
            games.delete(socket.id);
        }

        const gameId = generateGameId();
        const state = createGameState(wallet, gameId);

        state.started = true;
        state.signature = "guest_mode";
        state.authVerified = false;

        const sessions = readFile(SESSION_FILE);

        sessions.push({
            gameId,
            wallet,
            signature: "guest_mode",
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

        console.log(`[GAME START - GUEST] ${wallet} | ${gameId}`);
        return;
    }

    // ==========================================
    // WALLET AUTHENTICATION - NONCE
    // ==========================================

    if (!nonceFromClient) {
        socket.emit("error", {
            message: "Authentication nonce required"
        });
        return;
    }

    const normalizedWallet = wallet.trim().toLowerCase();

    if (!/^0x[a-fA-F0-9]{40}$/.test(normalizedWallet)) {
        socket.emit("error", {
            message: "Invalid wallet address"
        });
        return;
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const nonceResult = await client.query(`
            SELECT wallet_address, nonce, expires_at
            FROM auth_nonces
            WHERE wallet_address = $1
            FOR UPDATE
        `, [normalizedWallet]);

        if (nonceResult.rows.length === 0) {
            await client.query("ROLLBACK");

            socket.emit("error", {
                message: "Authentication nonce not found"
            });

            return;
        }

        const nonceRecord = nonceResult.rows[0];

        if (nonceRecord.nonce !== nonceFromClient) {
            await client.query("ROLLBACK");

            socket.emit("error", {
                message: "Invalid authentication nonce"
            });

            return;
        }

        const expiresAt = Number(nonceRecord.expires_at);

        if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
            await client.query("ROLLBACK");

            socket.emit("error", {
                message: "Authentication nonce expired"
            });

            return;
        }

        const authMessage =
            `Login to Satoshi Plays\n` +
            `Wallet: ${normalizedWallet}\n` +
            `Nonce: ${nonceFromClient}`;

        let recoveredAddress;

        try {
            recoveredAddress = ethers.verifyMessage(
                authMessage,
                signature
            );
        } catch (err) {
            await client.query("ROLLBACK");

            console.log(
                "[SECURITY WARNING] Nevažeći auth potpis:",
                err.message
            );

            socket.emit("error", {
                message: "Invalid wallet signature"
            });

            return;
        }

        if (recoveredAddress.toLowerCase() !== normalizedWallet) {
            await client.query("ROLLBACK");

            console.log(
                `[SECURITY WARNING] Wallet mismatch | Expected: ${normalizedWallet} | Recovered: ${recoveredAddress}`
            );

            socket.emit("error", {
                message: "Signature does not match wallet"
            });

            return;
        }

        // ==========================================
        // NONCE SE TROŠI
        // ==========================================

        await client.query(`
            DELETE FROM auth_nonces
            WHERE wallet_address = $1
        `, [normalizedWallet]);

        await client.query("COMMIT");



// ==========================================
// KREIRANJE AUTH SESSION
// Potpis je uspešno verifikovan.
// Od sada wallet koristi session token.
// ==========================================

const sessionToken =
    crypto.randomBytes(32).toString("hex");

const sessionTokenHash =
    crypto
        .createHash("sha256")
        .update(sessionToken)
        .digest("hex");

const sessionExpiresAt =
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

// Očisti eventualne stare sesije ovog walleta
await pool.query(`
    UPDATE auth_sessions
    SET revoked = TRUE
    WHERE wallet_address = $1
      AND revoked = FALSE
`, [normalizedWallet]);

// Sačuvaj novu sesiju
await pool.query(`
    INSERT INTO auth_sessions (
        session_token_hash,
        wallet_address,
        created_at,
        expires_at,
        revoked
    )
    VALUES ($1, $2, NOW(), $3, FALSE)
`, [
    sessionTokenHash,
    normalizedWallet,
    sessionExpiresAt
]);

console.log(
    `[AUTH SESSION CREATED] ${normalizedWallet}`
);

socket.emit("auth-session-created", {
    sessionToken,
    expiresAt: sessionExpiresAt.getTime()
});






        // ==========================================
        // AUTHENTICATED GAME
        // ==========================================

        if (games.has(socket.id)) {
            clearInterval(games.get(socket.id).interval);
            games.delete(socket.id);
        }

        const gameId = generateGameId();
        const state = createGameState(wallet, gameId);

        state.started = true;
        state.signature = signature;
        state.authVerified = true;

        const sessions = readFile(SESSION_FILE);

        sessions.push({
            gameId,
            wallet,
            signature,
            startTime: state.startTime,
            active: true,
            authVerified: true
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
    speed: state.speed,
    sessionToken
});

        console.log(
            `[GAME START - AUTHENTICATED] ${wallet} | ${gameId}`
        );

    } catch (err) {
        try {
            await client.query("ROLLBACK");
        } catch {}

        console.error(
            "Greška pri wallet autentifikaciji:",
            err
        );

        socket.emit("error", {
            message: "Authentication failed"
        });

    } finally {
        client.release();
    }
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

    // ==========================================
    // GLOBAL CHAT
    // ==========================================

    socket.on("chat-message", (data) => {
        if (!data || typeof data.message !== "string") return;

        const message = data.message.trim();
        if (!message) return;

        // Zaštita od predugačkih poruka
        if (message.length > 200) return;

        // RATE LIMITING (1 poruka na svake 2 sekunde)
        const now = Date.now();
        const lastTime = lastMessageTimes.get(socket.id) || 0;
        const cooldown = 2000;

        if (now - lastTime < cooldown) {
            const timeLeft = ((cooldown - (now - lastTime)) / 1000).toFixed(1);
            socket.emit("chat-error", { 
                message: `Sačekaj još ${timeLeft}s pre sledeće poruke.` 
            });
            return;
        }

        lastMessageTimes.set(socket.id, now);

      const wallet = typeof data.wallet === "string"
    ? data.wallet.trim()
    : "";

let displayWallet = "Guest";

if (wallet) {
    displayWallet =
        wallet.substring(0, 6) +
        "..." +
        wallet.substring(wallet.length - 4);
}

const chatMessage = {
    wallet: displayWallet,
    message,
    timestamp: Date.now()
};

        // ŠALJE PORUKU SVIM POVEZANIM KORISNICIMA
        io.emit("chat-message", chatMessage);
    });

    socket.on("disconnect", () => {
        onlinePlayers.delete(socket.id);
        lastMessageTimes.delete(socket.id);

        const state = games.get(socket.id);
        if (state) {
            clearInterval(state.interval);
            games.delete(socket.id);
        }
        console.log("Klijent diskonektovan:", socket.id);
    });
}); // <--- OVDE JE ISPRAVNO ZATVOREN io.on("connection") BLOK

// ==========================================
// FUNKCIJE ZA ZAVRŠETAK IGRE
// ==========================================

async function finishGame(socket, state, signature) {
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

    const verified = state.authVerified === true;

    session.active = false;
    session.score = finalScore;
    session.endTime = endTime;
    session.timestamp = endTime;
    session.signature = signature;
    session.duration = duration;
    session.verified = verified;
    saveFile(SESSION_FILE, sessions);

    try {
        const queryText = `
            INSERT INTO scores (game_id, wallet, start_time, end_time, score, timestamp, signature, duration, verified, type)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `;

        await pool.query(queryText, [
            session.gameId, session.wallet, session.startTime, endTime, finalScore, endTime, signature, duration, verified, "daily"
        ]);
        await pool.query(queryText, [
            session.gameId, session.wallet, session.startTime, endTime, finalScore, endTime, signature, duration, verified, "weekly"
        ]);

        const userScoresQuery = `
            INSERT INTO user_scores (wallet_address, weekly_total, daily_best, updated_at)
            VALUES ($1, $2, $2, NOW())
            ON CONFLICT (wallet_address) DO UPDATE SET
              weekly_total = user_scores.weekly_total + EXCLUDED.weekly_total,
              daily_best = GREATEST(user_scores.daily_best, EXCLUDED.daily_best),
              updated_at = NOW();
        `;
        await pool.query(userScoresQuery, [session.wallet, finalScore]);

        console.log(`[SCORE SAVED & VERIFIED IN DB] ${state.wallet} | Score: ${finalScore}`);
    } catch (dbErr) {
        console.error("Greška pri upisu skora u PostgreSQL:", dbErr);
    }

    socket.emit("game-over", {
        success: true,
        score: finalScore,
        message: "Skor uspešno verifikovan i sačuvan u bazu!"
    });

    games.delete(socket.id);
}


// ==========================================
// AUTH NONCE API
// KORAK 4
// ==========================================

app.get("/api/auth/nonce", async (req, res) => {
    try {
        const wallet = req.query.wallet;

        if (!wallet || typeof wallet !== "string") {
            return res.status(400).json({
                success: false,
                error: "Wallet address required"
            });
        }

        const normalizedWallet = wallet.trim().toLowerCase();

        // Osnovna validacija Ethereum/BSC wallet adrese
        if (!/^0x[a-fA-F0-9]{40}$/.test(normalizedWallet)) {
            return res.status(400).json({
                success: false,
                error: "Invalid wallet address"
            });
        }

        // Generisanje kriptografski sigurnog nonce-a
        const nonce = crypto.randomBytes(32).toString("hex");

        // Nonce važi 5 minuta
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        await pool.query(`
            INSERT INTO auth_nonces (
                wallet_address,
                nonce,
                created_at,
                expires_at
            )
            VALUES ($1, $2, NOW(), $3)
            ON CONFLICT (wallet_address)
            DO UPDATE SET
                nonce = EXCLUDED.nonce,
                created_at = NOW(),
                expires_at = EXCLUDED.expires_at
        `, [
            normalizedWallet,
            nonce,
            expiresAt.getTime()
        ]);

        res.json({
            success: true,
            wallet: normalizedWallet,
            nonce,
            expiresAt: expiresAt.getTime()
        });

    } catch (err) {
        console.error("Greška pri generisanju auth nonce-a:", err);

        res.status(500).json({
            success: false,
            error: "Failed to generate authentication nonce"
        });
    }
});





// ==========================================
// API RUTE ZA SKOROVE (USER_SCORES)
// ==========================================

app.get("/get-scores/:type", async (req, res) => {
    try {
        const type = req.params.type; 
        const scoreColumn = type === 'weekly' ? 'weekly_total' : 'daily_best';

        const query = `
            SELECT wallet_address AS wallet, ${scoreColumn} AS score 
            FROM user_scores 
            WHERE ${scoreColumn} > 0 
            ORDER BY ${scoreColumn} DESC 
            LIMIT 10
        `;

        const result = await pool.query(query);

        const formattedScores = result.rows.map((row, index) => ({
            rank: index + 1,
            wallet: row.wallet,
            score: Number(row.score)
        }));

        res.json(formattedScores);
    } catch (err) {
        console.error("Greška pri čitanju rang liste:", err);
        res.status(500).json([]);
    }
});

// ==========================================
// API RUTA ZA MOJ RANG I MOJ SKOR
// DAILY / WEEKLY
// ==========================================

app.get("/get-my-rank/:type", async (req, res) => {
    try {

        const type = req.params.type;
        const wallet = req.query.wallet;

        if (
            !wallet ||
            typeof wallet !== "string"
        ) {
            return res.status(400).json({
                success: false,
                error: "Wallet address required"
            });
        }

        const normalizedWallet =
            wallet.trim().toLowerCase();

        if (
            !/^0x[a-fA-F0-9]{40}$/.test(
                normalizedWallet
            )
        ) {
            return res.status(400).json({
                success: false,
                error: "Invalid wallet address"
            });
        }

        // DAILY = daily_best
        // WEEKLY = weekly_total

        const scoreColumn =
            type === "weekly"
                ? "weekly_total"
                : "daily_best";


        // ==========================================
        // PRONAĐI MOJ SKOR
        // ==========================================

        const userResult =
            await pool.query(
                `
                SELECT
                    wallet_address AS wallet,
                    ${scoreColumn} AS score
                FROM user_scores
                WHERE LOWER(wallet_address) = $1
                LIMIT 1
                `,
                [
                    normalizedWallet
                ]
            );


        // Wallet još nema rezultat

        if (
            userResult.rows.length === 0
        ) {

            return res.json({
                success: true,
                rank: null,
                wallet: normalizedWallet,
                score: 0
            });
        }


        const myScore =
            Number(
                userResult.rows[0].score
            );


        // ==========================================
        // IZRAČUNAJ MOJ RANG
        // ==========================================

        const rankResult =
            await pool.query(
                `
                SELECT COUNT(*) AS higher
                FROM user_scores
                WHERE ${scoreColumn} > $1
                  AND ${scoreColumn} > 0
                `,
                [
                    myScore
                ]
            );


        const playersAhead =
            Number(
                rankResult.rows[0].higher
            );


        const myRank =
            playersAhead + 1;


        // ==========================================
        // ODGOVOR
        // ==========================================

        res.json({
            success: true,
            rank: myRank,
            wallet: normalizedWallet,
            score: myScore
        });

    } catch (err) {

        console.error(
            "Greška pri računanju mog ranga:",
            err
        );

        res.status(500).json({
            success: false,
            rank: null,
            wallet: null,
            score: 0
        });
    }
});


// ==========================================
// API - MY DAILY & WEEKLY RANK
// ==========================================

app.get("/api/my-rank", async (req, res) => {
    try {
        const wallet = req.query.wallet;

        if (!wallet) {
            return res.json({ daily: null, weekly: null });
        }

        const normalized = wallet.toLowerCase();

        // DAILY
        const daily = await pool.query(`
            SELECT rank, wallet_address, daily_best AS score
            FROM (
                SELECT
                    wallet_address,
                    daily_best,
                    RANK() OVER (ORDER BY daily_best DESC) AS rank
                FROM user_scores
                WHERE daily_best > 0
            ) t
            WHERE LOWER(wallet_address) = $1
        `, [normalized]);

        // WEEKLY
        const weekly = await pool.query(`
            SELECT rank, wallet_address, weekly_total AS score
            FROM (
                SELECT
                    wallet_address,
                    weekly_total,
                    RANK() OVER (ORDER BY weekly_total DESC) AS rank
                FROM user_scores
                WHERE weekly_total > 0
            ) t
            WHERE LOWER(wallet_address) = $1
        `, [normalized]);

        res.json({
            daily: daily.rows[0] || null,
            weekly: weekly.rows[0] || null
        });

    } catch (err) {
        console.error("My Rank API:", err);
        res.status(500).json({
            daily: null,
            weekly: null
        });
    }
});



// ==========================================
// API RUTA ZA STATISTIKU IGRE (MY & GLOBAL)
// ==========================================

app.get("/api/game-stats", async (req, res) => {
    try {
        const wallet = req.query.wallet;
        const now = Date.now();

        const startOfToday = now - (24 * 60 * 60 * 1000);
        const startOfWeek = now - (7 * 24 * 60 * 60 * 1000);

        const globalTodayQuery = `
            SELECT COUNT(*)
            FROM scores
            WHERE type = 'daily'
            AND timestamp >= $1
        `;

        const globalWeekQuery = `
            SELECT COUNT(*)
            FROM scores
            WHERE type = 'weekly'
            AND timestamp >= $1
        `;

        const globalTodayRes = await pool.query(globalTodayQuery, [startOfToday]);
        const globalWeekRes = await pool.query(globalWeekQuery, [startOfWeek]);

        let myTodayCount = 0;
        let myWeekCount = 0;

        if (wallet && wallet !== "undefined" && wallet !== "null") {
            const myTodayQuery = `
                SELECT COUNT(*)
                FROM scores
                WHERE type = 'daily'
                AND LOWER(wallet) = LOWER($1)
                AND timestamp >= $2
            `;

            const myWeekQuery = `
                SELECT COUNT(*)
                FROM scores
                WHERE type = 'weekly'
                AND LOWER(wallet) = LOWER($1)
                AND timestamp >= $2
            `;

            const myTodayRes = await pool.query(myTodayQuery, [wallet, startOfToday]);
            const myWeekRes = await pool.query(myWeekQuery, [wallet, startOfWeek]);

            myTodayCount = parseInt(myTodayRes.rows[0].count, 10);
            myWeekCount = parseInt(myWeekRes.rows[0].count, 10);
        }

        res.json({
            myGamesToday: myTodayCount,
            myGamesWeek: myWeekCount,
            globalGamesToday: parseInt(globalTodayRes.rows[0].count, 10),
            globalGamesWeek: parseInt(globalWeekRes.rows[0].count, 10)
        });

    } catch (err) {
        console.error("Greška pri dohvatanju statistike igre:", err);
        res.status(500).json({
            myGamesToday: 0,
            myGamesWeek: 0,
            globalGamesToday: 0,
            globalGamesWeek: 0
        });
    }
});

// ==========================================
// LIVE SERVER STATUSnode 
// ==========================================

app.get("/api/status", (req, res) => {
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
    res.json({ status: "Satoshi Plays API & Game Server is Running!" });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
