/* =======================================
    SERVER.JS - PRODUCTION FINAL v6.5 (Anti-Bot Fixed)
========================================== */
require('dotenv').config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const cors = require("cors");
const crypto = require("crypto");
const { ethers } = require("ethers");
const { Pool } = require("pg");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const app = express();
const server = http.createServer(app);

// Omogućavamo ispravno prepoznavanje proxy/load balancer IP adresa (npr. Hetzner / Coolify / Render reverse proxy)
app.set('trust proxy', true);

const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://satoshiplays.com",
    "https://www.satoshiplays.com",
    "https://satoshi-plays.onrender.com"
];

app.use(cors({ origin: allowedOrigins, credentials: true }));

const io = new Server(server, {
    cors: { origin: allowedOrigins, methods: ["GET", "POST"] }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));

function generateGameId() {
    return Date.now().toString(36) + "-" + crypto.randomBytes(4).toString("hex");
}

function getCurrentDateString() {
    const d = new Date();
    return d.toISOString().split('T')[0];
}

function getCurrentWeekString() {
    const d = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${weekNo}`;
}

function getStartOfCurrentWeekTimestamp() {
    const now = new Date();
    const day = now.getUTCDay() || 7;
    const start = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - day + 1,
        0, 0, 0, 0
    ));
    return start.getTime();
}

// Memorijske mape i rate limiting
const games = new Map();                    // gameId -> state
const socketGameMap = new Map();            // socket.id -> gameId
const gameSocketMap = new Map();            // gameId -> socket.id
const disconnectTimeouts = new Map();       // gameId -> setTimeout (Grace period za reconnect)
const lastMessageTimes = new Map();         // socket.id -> timestamp
const lastJumpTimes = new Map();            // socket.id -> timestamp
const lastObstacleSpawnTime = new Map();    // gameId -> timestamp (Anti-Bot provera)
const walletGameStartTimes = new Map();     // wallet -> timestamp
const walletNonceRequestTimes = new Map();    // wallet -> timestamp
const ipStartGameTimes = new Map();         // ip -> { count, resetTime }
const onlinePlayers = new Set();

function checkIpRateLimit(ip) {
    const now = Date.now();
    let record = ipStartGameTimes.get(ip);
    if (!record || now > record.resetTime) {
        record = { count: 1, resetTime: now + 60000 };
        ipStartGameTimes.set(ip, record);
        return true;
    }
    if (record.count >= 20) {
        return false;
    }
    record.count++;
    return true;
}

// ==========================================
// INICIJALIZACIJA BAZE I POKRETANJE SERVERA (v6.5 FIX)
// ==========================================

async function initializeDatabaseAndServer() {
    try {
        // 1. Provera konekcije bez curenja pool klijenta
        await pool.query("SELECT 1");
        console.log("Uspešno povezano na PostgreSQL bazu!");

        // 2. Kreiranje tabela
        await pool.query(`
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
                type VARCHAR(50),
                CONSTRAINT unique_game_type UNIQUE (game_id, type)
            );

            CREATE TABLE IF NOT EXISTS game_sessions (
                game_id VARCHAR(255) PRIMARY KEY,
                wallet VARCHAR(255) NOT NULL,
                signature TEXT NOT NULL,
                start_time BIGINT NOT NULL,
                active BOOLEAN DEFAULT TRUE
            );

            CREATE TABLE IF NOT EXISTS auth_nonces (
                wallet_address VARCHAR(66) PRIMARY KEY,
                nonce VARCHAR(255) NOT NULL,
                expires_at BIGINT NOT NULL
            );
        `);

        // 3. Kreiranje indeksa i jedinstvenog parcijalnog indeksa
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_scores_wallet ON scores(wallet);
            CREATE INDEX IF NOT EXISTS idx_scores_verified ON scores(verified);
            CREATE INDEX IF NOT EXISTS idx_scores_type_verified_ts ON scores(type, verified, timestamp);
            
            CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_game_per_wallet 
            ON game_sessions(wallet) 
            WHERE active = TRUE;
        `);

        // 4. Crash Recovery
        const recoveryRes = await pool.query(`
            UPDATE game_sessions 
            SET active = FALSE 
            WHERE active = TRUE
        `);
        if (recoveryRes.rowCount > 0) {
            console.log(`[CRASH RECOVERY] Zatvoreno ${recoveryRes.rowCount} zaostalih aktivnih sesija.`);
        }

        console.log("Baza podataka uspešno inicijalizovana (v6.5 Production Final).");

        const PORT = process.env.PORT || 3000;
        server.listen(PORT, () => {
            console.log(`Secure Server v6.5 Production Final je pokrenut na portu ${PORT}`);
        });

    } catch (err) {
        console.error("Greška tokom inicijalizacije baze i pokretanja servera:", err);
        process.exit(1);
    }
}

initializeDatabaseAndServer();

// Čišćenje starih sesija
setInterval(async () => {
    try {
        const threshold = Date.now() - (48 * 60 * 60 * 1000);
        await pool.query(`DELETE FROM game_sessions WHERE active = FALSE AND start_time < $1`, [threshold]);
    } catch (err) {
        console.error("Greška pri čišćenju starih sesija:", err);
    }
}, 24 * 60 * 60 * 1000);

// Čišćenje memorijskih mapa
setInterval(() => {
    const now = Date.now();
    const TTL = 10 * 60 * 1000;
    for (const [wallet, time] of walletGameStartTimes.entries()) {
        if (now - time > TTL) walletGameStartTimes.delete(wallet);
    }
    for (const [wallet, time] of walletNonceRequestTimes.entries()) {
        if (now - time > TTL) walletNonceRequestTimes.delete(wallet);
    }
    for (const [ip, record] of ipStartGameTimes.entries()) {
        if (now > record.resetTime) ipStartGameTimes.delete(ip);
    }
    for (const [gameId, time] of lastObstacleSpawnTime.entries()) {
        if (now - time > TTL) lastObstacleSpawnTime.delete(gameId);
    }
}, 10 * 60 * 1000);

// ==========================================
// GAME ENGINE NA SERVERU
// ==========================================

const BASE_TICK_MS = 33.33; 
const GRAVITY = 1.7;        
const JUMP_V = -18;         
const GROUND_Y = 350;
const PLAYER_X = 120;
const MAX_GAME_MS = 180000; 

function createGameState(wallet, gameId) {
    return {
        gameId,
        wallet,
        alive: true,
        started: false,
        score: 0,
        speed: 10,          
        startTime: Date.now(),
        lastTickTime: Date.now(),
        player: { x: PLAYER_X, y: GROUND_Y, vy: 0, jumpCount: 0, onGround: true },
        obstacles: [],
        spawnTimer: 0,
        nextSpawn: 42,      
        tick: 0,
        // --- ANTI-BOT STATS ---
        lastJumpTimestamp: 0,
        jumpIntervals: [], // Čuva poslednjih 15 razmaka između skokova
        botAnomalyScore: 0 // Akumulirani sumnjivi poeni
    };
}
function calculateSpeed(startTime) {
    const elapsed = (Date.now() - startTime) / 1000;
    return Math.min(10 + (elapsed * 0.3), 50);
}

function spawnObstacle(state) {
    const startX = 850;
    const add = (t, x, y, w, h) => {
        state.obstacles.push({ id: generateGameId(), type: t, x, y, w, h, dead: false });
    };

    const rand = Math.random();
    let chosenType = "fud";

    if (rand < 0.40) chosenType = "fud";          
    else if (rand < 0.62) chosenType = "meteor";      
    else if (rand < 0.84) chosenType = "liquidation";  
    else if (rand < 0.92) chosenType = "rug";          
    else chosenType = "double_rug"; 

    switch (chosenType) {
        case "rug": add("rug", startX, 350, 50, 40); break;
        case "double_rug":
            add("rug", startX, 350, 50, 40);
            add("rug", startX + 200, 350, 50, 40);
            break;
        case "fud": add("fud", startX, 230 + Math.random() * 140, 50, 50); break;
        case "meteor": add("meteor", startX, -50, 40, 40); break;
        case "liquidation": add("liquidation", startX, 250, 60, 50); break;
    }

    // Zabeležimo tačno vreme stvaranja nove prepreke radi anti-bot provere reakcije
    lastObstacleSpawnTime.set(state.gameId, Date.now());
}

function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function tickGame(state) {
    if (!state.alive || !state.started) return;

    const now = Date.now();
    const rawDt = (now - state.lastTickTime) / BASE_TICK_MS;
    state.lastTickTime = now;

    const dt = Math.max(0.2, Math.min(rawDt, 1.5));

    state.tick++;
    state.speed = calculateSpeed(state.startTime);

    if (now - state.startTime > MAX_GAME_MS) {
        state.alive = false;
        return;
    }

    state.score += 8 * Math.max(0.5, Math.min(dt, 2.0));

    const p = state.player;
    p.vy += GRAVITY * dt;
    p.y += p.vy * dt;

    if (p.y >= GROUND_Y) {
        p.y = GROUND_Y;
        p.vy = 0;
        p.onGround = true;
        p.jumpCount = 0;
    } else {
        p.onGround = false;
    }

    state.spawnTimer += dt;
    if (state.spawnTimer >= state.nextSpawn) {
        state.spawnTimer = 0;
        const elapsed = (now - state.startTime) / 1000;
        const difficultyFactor = Math.max(0.70, 1 - (elapsed * 0.002)); 
        state.nextSpawn = Math.floor((30 + Math.floor(Math.random() * 22)) * difficultyFactor); 
        spawnObstacle(state);
    }

    const playerBox = { x: p.x - 15, y: p.y - 15, w: 30, h: 30 };

    state.obstacles = state.obstacles.filter(obs => {
        const moveFactor = state.speed * 0.8 * dt;
        if (obs.type === "meteor") {
            obs.x -= moveFactor; 
            obs.y += 3.8 * dt; 
        } else if (obs.type === "liquidation") {
            obs.x -= moveFactor;    
            if (obs.x < 250) obs.y = 350;
        } else if (obs.type === "fud") {
            obs.x -= moveFactor;    
            obs.y += Math.sin(state.tick * 0.05) * 4.5 * dt;
        } else {
            obs.x -= moveFactor;    
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
        obstacles: state.obstacles.map(o => ({ id: o.id, type: o.type, x: o.x, y: o.y }))
    };
}

// ==========================================
// AUTH & NONCE API ENDPOINTS
// ==========================================

app.get("/api/auth/nonce/:wallet", async (req, res) => {
    const wallet = req.params.wallet;
    if (!ethers.isAddress(wallet)) {
        return res.status(400).json({ error: "Nevažeća wallet adresa." });
    }

    const now = Date.now();
    const normalizedWallet = wallet.toLowerCase();
    
    const lastNonceTime = walletNonceRequestTimes.get(normalizedWallet) || 0;
    if (now - lastNonceTime < 10000) {
        return res.status(429).json({ error: "Previše zahteva za nonce. Sačekajte malo pre ponovnog zahteva." });
    }
    walletNonceRequestTimes.set(normalizedWallet, now);

    const nonce = "SatoshiPlays-Auth-" + crypto.randomBytes(32).toString("hex");
    const expiresAt = now + (5 * 60 * 1000); 

    try {
        await pool.query(`
            INSERT INTO auth_nonces (wallet_address, nonce, expires_at)
            VALUES ($1, $2, $3)
            ON CONFLICT (wallet_address) DO UPDATE SET
              nonce = EXCLUDED.nonce,
              expires_at = EXCLUDED.expires_at;
        `, [normalizedWallet, nonce, expiresAt]);

        res.json({ nonce });
    } catch (err) {
        console.error("Greška pri generisanju nonca:", err);
        res.status(500).json({ error: "Greška na serveru." });
    }
});

// ==========================================
// SOCKET.IO (v6.5 ANTIBOT & RECONNECT)
// ==========================================

io.on("connection", (socket) => {
    onlinePlayers.add(socket.id);
    
    const clientIp = socket.handshake.headers["x-forwarded-for"] 
        ? socket.handshake.headers["x-forwarded-for"].split(',')[0].trim() 
        : socket.handshake.address;

    socket.on("start-game", async (data) => {
        if (!checkIpRateLimit(clientIp)) {
            socket.emit("error", { message: "Previše zahteva sa ove IP adrese. Sačekajte." });
            return;
        }

        const wallet = data?.wallet;
        const signature = data?.signature;
        
        if (!wallet || !ethers.isAddress(wallet)) {
            socket.emit("error", { message: "Validan wallet je obavezan." });
            return;
        }

        if (!signature || typeof signature !== "string") {
            socket.emit("error", { message: "Kriptografski potpis je obavezan." });
            return;
        }

        const normalizedWallet = wallet.toLowerCase();
        const now = Date.now();
        const lastStart = walletGameStartTimes.get(normalizedWallet) || 0;
        if (now - lastStart < 5000) {
            socket.emit("error", { message: "Prebrzo pokretanje nove igre za ovaj wallet." });
            return;
        }
        walletGameStartTimes.set(normalizedWallet, now);

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const activeSessionCheck = await client.query(`
                SELECT game_id FROM game_sessions 
                WHERE wallet = $1 AND active = TRUE 
                FOR UPDATE
            `, [normalizedWallet]);

            if (activeSessionCheck.rows.length > 0) {
                const activeGameId = activeSessionCheck.rows[0].game_id;
                
                if (games.has(activeGameId)) {
                    const oldState = games.get(activeGameId);
                    clearInterval(oldState.interval);
                    games.delete(activeGameId);
                }
                const oldSocketId = gameSocketMap.get(activeGameId);
                if (oldSocketId) {
                    socketGameMap.delete(oldSocketId);
                    gameSocketMap.delete(activeGameId);
                }
                if (disconnectTimeouts.has(activeGameId)) {
                    clearTimeout(disconnectTimeouts.get(activeGameId));
                    disconnectTimeouts.delete(activeGameId);
                }

                await client.query(`UPDATE game_sessions SET active = FALSE WHERE game_id = $1`, [activeGameId]);
            }

            const nonceRes = await client.query(`
                SELECT nonce, expires_at 
                FROM auth_nonces 
                WHERE wallet_address = $1 
                FOR UPDATE
            `, [normalizedWallet]);

            if (nonceRes.rows.length === 0) {
                await client.query('ROLLBACK');
                socket.emit("error", { message: "Nonce nije pronađen. Molimo osvežite prijavu." });
                return;
            }

            const { nonce, expires_at } = nonceRes.rows[0];
            if (Date.now() > expires_at) {
                await client.query('ROLLBACK');
                socket.emit("error", { message: "Nonce je istekao. Zatražite novi." });
                return;
            }

            const recoveredAddress = ethers.verifyMessage(nonce, signature);
            if (recoveredAddress.toLowerCase() !== normalizedWallet) {
                await client.query('ROLLBACK');
                socket.emit("error", { message: "Kriptografski potpis nije validan." });
                return;
            }

            await client.query(`DELETE FROM auth_nonces WHERE wallet_address = $1`, [normalizedWallet]);

            const gameId = generateGameId();
            const state = createGameState(normalizedWallet, gameId);
            state.started = true;
            state.signature = signature;

            await client.query(`
                INSERT INTO game_sessions (game_id, wallet, signature, start_time, active)
                VALUES ($1, $2, $3, $4, TRUE)
            `, [gameId, normalizedWallet, signature, state.startTime]);

            await client.query('COMMIT');

            socket.wallet = normalizedWallet;

            const existingGameId = socketGameMap.get(socket.id);
            if (existingGameId && games.has(existingGameId)) {
                const oldState = games.get(existingGameId);
                clearInterval(oldState.interval);
                games.delete(existingGameId);
                gameSocketMap.delete(existingGameId);
            }

            socketGameMap.set(socket.id, gameId);
            gameSocketMap.set(gameId, socket.id);

            const interval = setInterval(() => {
                tickGame(state);
                socket.emit("state", getPublicState(state));

                if (!state.alive) {
                    clearInterval(interval);
                    if (disconnectTimeouts.has(gameId)) {
                        clearTimeout(disconnectTimeouts.get(gameId));
                        disconnectTimeouts.delete(gameId);
                    }
                    finishGame(socket, state, signature);
                }
            }, 33);

            state.interval = interval;
            games.set(gameId, state);

            socket.emit("game-started", { gameId, startTime: state.startTime, speed: state.speed });

        } catch (err) {
            await client.query('ROLLBACK');
            console.error("[START GAME ERROR]:", err.message);
            socket.emit("error", { message: "Greška servera pri pokretanju igre." });
        } finally {
            client.release();
        }
    });

    socket.on("jump", () => {
        const now = Date.now();
        const lastJump = lastJumpTimes.get(socket.id) || 0;
        if (now - lastJump < 200) return; 
        
        const gameId = socketGameMap.get(socket.id);
        if (!gameId) return;
        const state = games.get(gameId);
        if (!state || !state.alive || !state.started) return;

        // ANTI-BOT PROVERA: Reakcija brža od 90ms na pojavu prepreke je fizički nemoguća za čoveka
        const lastSpawn = lastObstacleSpawnTime.get(gameId) || 0;
        if (lastSpawn > 0 && (now - lastSpawn < 90)) {
            console.log(`[ANTI-BOT] Detektovan bot/skripta (reakcija ${now - lastSpawn}ms) za wallet: ${state.wallet}`);
            state.alive = false;
            return;
        }

        lastJumpTimes.set(socket.id, now);

        const p = state.player;
        if (p.jumpCount < 2) {
            p.vy = JUMP_V;
            p.jumpCount++;
            p.onGround = false;
        }
    });

    socket.on("chat-message", (data) => {
        if (!socket.wallet || !ethers.isAddress(socket.wallet)) return; 
        if (!data || typeof data.message !== "string") return;
        
        const message = data.message.trim();
        if (!message || message.length > 200) return;

        const now = Date.now();
        const lastTime = lastMessageTimes.get(socket.id) || 0;
        if (now - lastTime < 2000) return;
        lastMessageTimes.set(socket.id, now);

        const displayWallet = socket.wallet.substring(0, 6) + "..." + socket.wallet.substring(socket.wallet.length - 4);

        io.emit("chat-message", { wallet: displayWallet, message, timestamp: Date.now() });
    });

    socket.on("disconnect", async () => {
        onlinePlayers.delete(socket.id);
        lastMessageTimes.delete(socket.id);
        lastJumpTimes.delete(socket.id);

        const gameId = socketGameMap.get(socket.id);
        if (gameId) {
            socketGameMap.delete(socket.id);
            gameSocketMap.delete(gameId);

            const timeout = setTimeout(async () => {
                disconnectTimeouts.delete(gameId);
                const state = games.get(gameId);
                if (state) {
                    clearInterval(state.interval);
                    games.delete(gameId);
                }

                try {
                    await pool.query(`UPDATE game_sessions SET active = FALSE WHERE game_id = $1 AND active = TRUE`, [gameId]);
                } catch (err) {
                    console.error("Greška pri zatvaranju sesije nakon isteklog grace perioda:", err);
                }
            }, 10000);

            disconnectTimeouts.set(gameId, timeout);
        }
    });
});

// ==========================================
// KRAJ IGRE I UPIS U BAZU
// ==========================================

async function finishGame(socket, state, signature) {
    const endTime = Date.now();
    const duration = endTime - state.startTime;
    const finalScore = Math.floor(state.score / 10);

    socketGameMap.delete(socket.id);
    gameSocketMap.delete(state.gameId);
    if (disconnectTimeouts.has(state.gameId)) {
        clearTimeout(disconnectTimeouts.get(state.gameId));
        disconnectTimeouts.delete(state.gameId);
    }
    lastObstacleSpawnTime.delete(state.gameId);

    const client = await pool.connect();
    let savedSuccessfully = false;

    try {
        await client.query('BEGIN');

        const sessionRes = await client.query(`
            SELECT active FROM game_sessions WHERE game_id = $1 FOR UPDATE
        `, [state.gameId]);

        if (sessionRes.rows.length === 0 || !sessionRes.rows[0].active) {
            await client.query('ROLLBACK');
            socket.emit("game-over", { success: false, error: "Invalid or expired session", score: finalScore });
            games.delete(state.gameId);
            return;
        }

        await client.query(`UPDATE game_sessions SET active = FALSE WHERE game_id = $1`, [state.gameId]);

        if (duration < 2000) {
            await client.query('ROLLBACK');
            socket.emit("game-over", { success: false, error: "Game too short", score: finalScore });
            games.delete(state.gameId);
            return;
        }

        const maxPossibleScore = Math.floor((duration / BASE_TICK_MS) * 8 / 10) + 50;
        if (finalScore > maxPossibleScore) {
            await client.query('ROLLBACK');
            console.log(`[SECURITY WARNING] Anomalija skora! Wallet: ${state.wallet}, Skor: ${finalScore}, Max: ${maxPossibleScore}`);
            socket.emit("game-over", { success: false, error: "Detektovana anomalija u skoru.", score: finalScore });
            games.delete(state.gameId);
            return;
        }

        const verified = true;

        const queryText = `
            INSERT INTO scores (game_id, wallet, start_time, end_time, score, timestamp, signature, duration, verified, type)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (game_id, type) DO NOTHING;
        `;
        
        await client.query(queryText, [state.gameId, state.wallet, state.startTime, endTime, finalScore, endTime, signature, duration, verified, "daily"]);
        await client.query(queryText, [state.gameId, state.wallet, state.startTime, endTime, finalScore, endTime, signature, duration, verified, "weekly"]);

        await client.query('COMMIT');
        savedSuccessfully = true;
        console.log(`[SECURE SCORE SAVED] ${state.wallet} | Score: ${finalScore}`);
    } catch (dbErr) {
        await client.query('ROLLBACK');
        console.error("Greška transakcije u bazi (Rollback izvršen):", dbErr);
    } finally {
        client.release();
    }

    if (!savedSuccessfully) {
        socket.emit("game-over", {
            success: false,
            score: finalScore,
            error: "Greška baze podataka. Rezultat nije sačuvan."
        });
        games.delete(state.gameId);
        return;
    }

    socket.emit("game-over", {
        success: true,
        score: finalScore,
        message: "Skor uspešno sačuvan na rang listi!"
    });

    games.delete(state.gameId);
}

// ==========================================
// API RUTE ZA RANG LISTE I STATISTIKU
// ==========================================

app.get("/get-scores/:type", async (req, res) => {
    try {
        const type = req.params.type; 
        if (type !== 'weekly' && type !== 'daily') {
            return res.status(400).json({ error: "Nevažeći tip rang liste." });
        }

        if (type === 'weekly') {
            const startOfWeekTs = getStartOfCurrentWeekTimestamp();
            const query = `
                SELECT wallet, MAX(score) as score
                FROM scores
                WHERE type = 'weekly' AND verified = true AND timestamp >= $1
                GROUP BY wallet
                ORDER BY score DESC
                LIMIT 10;
            `;
            const result = await pool.query(query, [startOfWeekTs]);
            return res.json(result.rows.map((row, index) => ({ rank: index + 1, wallet: row.wallet, score: Number(row.score) })));
        } else {
            const todayUtcString = getCurrentDateString();
            const startOfTodayTs = new Date(todayUtcString).getTime();
            const query = `
                SELECT wallet, MAX(score) as score
                FROM scores
                WHERE type = 'daily' AND verified = true AND timestamp >= $1
                GROUP BY wallet
                ORDER BY score DESC
                LIMIT 10;
            `;
            const result = await pool.query(query, [startOfTodayTs]);
            return res.json(result.rows.map((row, index) => ({ rank: index + 1, wallet: row.wallet, score: Number(row.score) })));
        }
    } catch (err) {
        console.error("Greška pri čitanju rang liste:", err);
        res.status(500).json([]);
    }
});

app.get("/api/game-stats", async (req, res) => {
    try {
        const wallet = req.query.wallet;
        const todayUtcString = new Date().toISOString().split('T')[0];
        const startOfTodayTs = new Date(todayUtcString).getTime();
        const startOfWeekTs = getStartOfCurrentWeekTimestamp();

        const globalTodayRes = await pool.query(`
            SELECT COUNT(*) FROM scores WHERE type = 'daily' AND verified = true AND timestamp >= $1
        `, [startOfTodayTs]);

        const globalWeekGamesRes = await pool.query(`
            SELECT COUNT(*) FROM scores WHERE type = 'weekly' AND verified = true AND timestamp >= $1
        `, [startOfWeekTs]);

        let myTodayCount = 0;
        let myWeekCount = 0;

        if (wallet && ethers.isAddress(wallet)) {
            const myTodayRes = await pool.query(`
                SELECT COUNT(*) FROM scores WHERE type = 'daily' AND verified = true AND LOWER(wallet) = LOWER($1) AND timestamp >= $2
            `, [wallet.toLowerCase(), startOfTodayTs]);

            const myWeekRes = await pool.query(`
                SELECT COUNT(*) FROM scores WHERE type = 'weekly' AND verified = true AND LOWER(wallet) = LOWER($1) AND timestamp >= $2
            `, [wallet.toLowerCase(), startOfWeekTs]);

            myTodayCount = parseInt(myTodayRes.rows[0].count, 10);
            myWeekCount = parseInt(myWeekRes.rows[0].count, 10);
        }

        res.json({
            myGamesToday: myTodayCount,
            myGamesWeek: myWeekCount,
            globalGamesToday: parseInt(globalTodayRes.rows[0].count, 10),
            globalGamesWeek: parseInt(globalWeekGamesRes.rows[0].count, 10)
        });
    } catch (err) {
        console.error("Greška pri dohvatanju statistike:", err);
        res.status(500).json({ myGamesToday: 0, myGamesWeek: 0, globalGamesToday: 0, globalGamesWeek: 0 });
    }
});

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
    res.json({ status: "Satoshi Plays Secure API & Game Server (v6.5 Production Final) is Running!" });
});

