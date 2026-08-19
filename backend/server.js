/* =======================================
    SERVER.JS - SERVER AUTHORITATIVE GAME
    PostgreSQL + Socket.IO
========================================== */

require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const { ethers } = require("ethers");
const { Pool } = require("pg");


/* =========================================================
   POSTGRESQL
========================================================= */

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,

    // Render / production PostgreSQL
    ssl:
        process.env.NODE_ENV === "production"
            ? { rejectUnauthorized: false }
            : false
});


pool.connect()
    .then(client => {

        console.log(
            "Uspešno povezano na PostgreSQL bazu!"
        );

        client.release();

    })
    .catch(err => {

        console.error(
            "Greška pri povezivanju na PostgreSQL:",
            err
        );

    });


/* =========================================================
   DATABASE INITIALIZATION
========================================================= */

async function initializeDatabase() {

    try {

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
                verified BOOLEAN DEFAULT FALSE,
                type VARCHAR(50)
            )
        `);


        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_scores (
                wallet_address VARCHAR(66) PRIMARY KEY,
                weekly_total BIGINT DEFAULT 0,
                daily_best BIGINT DEFAULT 0,
                updated_at TIMESTAMP WITH TIME ZONE
                    DEFAULT CURRENT_TIMESTAMP
            )
        `);


        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_weekly_total
            ON user_scores(weekly_total DESC)
        `);


        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_daily_best
            ON user_scores(daily_best DESC)
        `);


        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_scores_verified
            ON scores(verified)
        `);


        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_scores_wallet
            ON scores(wallet)
        `);


        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_scores_timestamp
            ON scores(timestamp)
        `);


        console.log(
            "PostgreSQL tabele i indeksi su spremni."
        );

    } catch (err) {

        console.error(
            "Greška pri inicijalizaciji PostgreSQL baze:",
            err
        );

    }
}


initializeDatabase();


/* =========================================================
   EXPRESS
========================================================= */

const app = express();

const server =
    http.createServer(app);


/* =========================================================
   CORS
========================================================= */

const allowedOrigins = [

    "http://localhost:5173",

    "http://localhost:3000",

    "https://satoshiplays.com",

    "https://www.satoshiplays.com",

    "https://satoshi-plays.onrender.com"
];


app.use(
    cors({

        origin: function (
            origin,
            callback
        ) {

            /*
             * Zahtevi bez Origin headera
             * mogu da prođu.
             */

            if (!origin) {

                return callback(
                    null,
                    true
                );
            }


            if (
                allowedOrigins.includes(origin)
            ) {

                return callback(
                    null,
                    true
                );
            }


            console.warn(
                "CORS blokiran za origin:",
                origin
            );


            return callback(
                new Error(
                    "Not allowed by CORS"
                )
            );
        },

        credentials: true
    })
);


app.use(
    express.json()
);


/* =========================================================
   SOCKET.IO
========================================================= */

const io =
    new Server(
        server,
        {

            cors: {

                origin:
                    allowedOrigins,

                methods: [
                    "GET",
                    "POST"
                ],

                credentials: true
            },

            transports: [
                "websocket",
                "polling"
            ]
        }
    );


/* =========================================================
   STATIC FRONTEND
========================================================= */

const frontendPath =
    path.join(
        __dirname,
        "../frontend"
    );


if (
    fs.existsSync(frontendPath)
) {

    app.use(
        express.static(
            frontendPath
        )
    );
}


/* =========================================================
   SESSION FILE
========================================================= */

const SESSION_FILE =
    path.join(
        __dirname,
        "sessions.json"
    );


/* =========================================================
   SESSION HELPERS
========================================================= */

function readFile(filePath) {

    if (
        !fs.existsSync(filePath)
    ) {

        try {

            fs.writeFileSync(
                filePath,
                "[]",
                "utf8"
            );

        } catch (err) {

            console.error(
                "Greška pri kreiranju fajla:",
                err
            );

            return [];
        }
    }


    try {

        return JSON.parse(
            fs.readFileSync(
                filePath,
                "utf8"
            ) || "[]"
        );

    } catch (err) {

        console.error(
            "Greška pri čitanju JSON fajla:",
            err
        );

        return [];
    }
}


function saveFile(
    filePath,
    data
) {

    try {

        fs.writeFileSync(
            filePath,
            JSON.stringify(
                data,
                null,
                2
            ),
            "utf8"
        );

    } catch (err) {

        console.error(
            "Greška pri upisu:",
            err
        );
    }
}


/* =========================================================
   GAME ID
========================================================= */

function generateGameId() {

    return (
        Date.now().toString(36) +
        "-" +
        Math.random()
            .toString(36)
            .substring(2, 10)
    );
}


/* =========================================================
   WALLET VALIDATION
========================================================= */

function isValidWallet(wallet) {

    if (
        typeof wallet !== "string" ||
        !wallet.trim()
    ) {

        return false;
    }


    try {

        return ethers.isAddress(
            wallet.trim()
        );

    } catch {

        return false;
    }
}


/* =========================================================
   GAME ENGINE
   !!! LOGIKA NIJE MENJANA !!!
========================================================= */

const TICK_MS = 30;

const GRAVITY = 1.7;

const JUMP_V = -18;

const GROUND_Y = 350;

const PLAYER_X = 120;

const MAX_GAME_MS = 180000;

const MIN_GAME_MS = 2000;


/* =========================================================
   MEMORY
========================================================= */

const games =
    new Map();

const lastMessageTimes =
    new Map();

const onlinePlayers =
    new Set();


/* =========================================================
   SECURITY RATE LIMITS
========================================================= */

const START_COOLDOWN_MS = 3000;

const CHAT_COOLDOWN_MS = 2000;

const lastGameStarts =
    new Map();


/* =========================================================
   CREATE GAME STATE
========================================================= */

function createGameState(
    wallet,
    gameId
) {

    return {

        gameId,

        wallet,

        alive: true,

        started: false,

        finished: false,

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

        tick: 0,

        interval: null,

        signature: null
    };
}


/* =========================================================
   SPEED
   !!! ORIGINAL LOGIC !!!
========================================================= */

function calculateSpeed(
    startTime
) {

    const elapsed =
        (
            Date.now() -
            startTime
        ) / 1000;


    return Math.min(
        10 +
            (
                elapsed *
                0.3
            ),
        50
    );
}


/* =========================================================
   SPAWN OBSTACLE
   !!! ORIGINAL LOGIC !!!
========================================================= */

function spawnObstacle(
    state
) {

    const startX = 850;


    const add = (
        t,
        x,
        y,
        w,
        h
    ) => {

        state.obstacles.push({

            id:
                generateGameId(),

            type:
                t,

            x,

            y,

            w,

            h,

            dead:
                false
        });
    };


    const rand =
        Math.random();


    let chosenType =
        "fud";


    if (
        rand < 0.40
    ) {

        chosenType =
            "fud";

    } else if (
        rand < 0.62
    ) {

        chosenType =
            "meteor";

    } else if (
        rand < 0.84
    ) {

        chosenType =
            "liquidation";

    } else if (
        rand < 0.92
    ) {

        chosenType =
            "rug";

    } else {

        chosenType =
            "double_rug";
    }


    switch (
        chosenType
    ) {

        case "rug":

            add(
                "rug",
                startX,
                350,
                50,
                40
            );

            break;


        case "double_rug":

            add(
                "rug",
                startX,
                350,
                50,
                40
            );

            add(
                "rug",
                startX + 200,
                350,
                50,
                40
            );

            break;


        case "fud":

            add(
                "fud",
                startX,
                230 +
                    Math.random() *
                    140,
                50,
                50
            );

            break;


        case "meteor":

            add(
                "meteor",
                startX,
                -50,
                40,
                40
            );

            break;


        case "liquidation":

            add(
                "liquidation",
                startX,
                250,
                60,
                50
            );

            break;
    }
}


/* =========================================================
   COLLISION
========================================================= */

function rectsOverlap(
    a,
    b
) {

    return (
        a.x <
            b.x + b.w &&

        a.x + a.w >
            b.x &&

        a.y <
            b.y + b.h &&

        a.y + a.h >
            b.y
    );
}


/* =========================================================
   SERVER GAME TICK
   !!! ORIGINAL LOGIC !!!
========================================================= */

function tickGame(
    state
) {

    if (
        !state.alive ||
        !state.started
    ) {

        return;
    }


    state.tick++;


    state.speed =
        calculateSpeed(
            state.startTime
        );


    if (
        Date.now() -
            state.startTime >
        MAX_GAME_MS
    ) {

        state.alive =
            false;

        return;
    }


    state.score += 8;


    const p =
        state.player;


    p.vy +=
        GRAVITY;


    p.y +=
        p.vy;


    if (
        p.y >= GROUND_Y
    ) {

        p.y =
            GROUND_Y;

        p.vy =
            0;

        p.onGround =
            true;

        p.jumpCount =
            0;

    } else {

        p.onGround =
            false;
    }


    state.spawnTimer++;


    if (
        state.spawnTimer >=
        state.nextSpawn
    ) {

        state.spawnTimer =
            0;


        const elapsed =
            (
                Date.now() -
                state.startTime
            ) / 1000;


        const difficultyFactor =
            Math.max(
                0.70,
                1 -
                    (
                        elapsed *
                        0.002
                    )
            );


        state.nextSpawn =
            Math.floor(
                (
                    30 +
                    Math.floor(
                        Math.random() *
                        22
                    )
                ) *
                    difficultyFactor
            );


        spawnObstacle(
            state
        );
    }


    const playerBox = {

        x:
            p.x - 15,

        y:
            p.y - 15,

        w:
            30,

        h:
            30
    };


    state.obstacles =
        state.obstacles.filter(
            obs => {

                if (
                    obs.type ===
                    "meteor"
                ) {

                    obs.x -=
                        state.speed *
                        0.8;

                    obs.y +=
                        3.8;

                } else if (
                    obs.type ===
                    "liquidation"
                ) {

                    obs.x -=
                        state.speed *
                        0.8;

                    if (
                        obs.x < 250
                    ) {

                        obs.y =
                            350;
                    }

                } else if (
                    obs.type ===
                    "fud"
                ) {

                    obs.x -=
                        state.speed *
                        0.8;

                    obs.y +=
                        Math.sin(
                            state.tick *
                            0.05
                        ) *
                        4.5;

                } else {

                    obs.x -=
                        state.speed *
                        0.8;
                }


                if (
                    obs.x < -100 ||
                    obs.y > 500
                ) {

                    return false;
                }


                const box = {

                    x:
                        (
                            obs.x -
                            obs.w / 2
                        ) + 5,

                    y:
                        (
                            obs.y -
                            obs.h / 2
                        ) + 5,

                    w:
                        obs.w - 10,

                    h:
                        obs.h - 10
                };


                if (
                    rectsOverlap(
                        playerBox,
                        box
                    )
                ) {

                    state.alive =
                        false;
                }


                return true;
            }
        );
}


/* =========================================================
   PUBLIC GAME STATE
========================================================= */

function getPublicState(
    state
) {

    return {

        gameId:
            state.gameId,

        alive:
            state.alive,

        started:
            state.started,

        score:
            Math.floor(
                state.score / 10
            ),

        speed:
            state.speed,

        player: {

            x:
                state.player.x,

            y:
                state.player.y,

            onGround:
                state.player.onGround
        },

        obstacles:
            state.obstacles.map(
                o => ({

                    id:
                        o.id,

                    type:
                        o.type,

                    x:
                        o.x,

                    y:
                        o.y
                })
            )
    };
}


/* =========================================================
   SOCKET.IO
========================================================= */

io.on(
    "connection",
    (socket) => {

        onlinePlayers.add(
            socket.id
        );


        console.log(
            "Klijent povezan:",
            socket.id
        );


        /* =================================================
           START GAME
        ================================================= */

        socket.on(
            "start-game",
            (data) => {

                const wallet =
                    typeof data?.wallet ===
                    "string"
                        ? data.wallet.trim()
                        : "";


                const signature =
                    typeof data?.signature ===
                    "string"
                        ? data.signature.trim()
                        : "";


                /* ==========================================
                   SECURITY:
                   VALID WALLET
                ========================================== */

                if (
                    !isValidWallet(
                        wallet
                    )
                ) {

                    socket.emit(
                        "error",
                        {
                            message:
                                "Invalid wallet address."
                        }
                    );

                    return;
                }


                /* ==========================================
                   SECURITY:
                   START RATE LIMIT
                ========================================== */

                const clientIp =
                    socket.handshake.address ||
                    "unknown";


                const rateKey =
                    wallet.toLowerCase() +
                    "_" +
                    clientIp;


                const now =
                    Date.now();


                const lastStart =
                    lastGameStarts.get(
                        rateKey
                    ) || 0;


                if (
                    now -
                        lastStart <
                    START_COOLDOWN_MS
                ) {

                    socket.emit(
                        "error",
                        {
                            message:
                                "Previše brz pokušaj pokretanja igre. Sačekajte malo."
                        }
                    );

                    return;
                }


                lastGameStarts.set(
                    rateKey,
                    now
                );


                /* ==========================================
                   PREVIOUS GAME
                ========================================== */

                if (
                    games.has(
                        socket.id
                    )
                ) {

                    const previous =
                        games.get(
                            socket.id
                        );


                    if (
                        previous.interval
                    ) {

                        clearInterval(
                            previous.interval
                        );
                    }


                    games.delete(
                        socket.id
                    );
                }


                /* ==========================================
                   NEW GAME
                ========================================== */

                const gameId =
                    generateGameId();


                const state =
                    createGameState(
                        wallet,
                        gameId
                    );


                state.started =
                    true;


                state.signature =
                    signature;


                /* ==========================================
                   SESSION
                ========================================== */

                const sessions =
                    readFile(
                        SESSION_FILE
                    );


                sessions.push({

                    gameId,

                    wallet,

                    signature:
                        signature ||
                        "no_signature",

                    startTime:
                        state.startTime,

                    active:
                        true,

                    verified:
                        false
                });


                saveFile(
                    SESSION_FILE,
                    sessions
                );


                /* ==========================================
                   GAME INTERVAL
                ========================================== */

                const interval =
                    setInterval(
                        () => {

                            tickGame(
                                state
                            );


                            socket.emit(
                                "state",
                                getPublicState(
                                    state
                                )
                            );


                            if (
                                !state.alive
                            ) {

                                clearInterval(
                                    interval
                                );


                                state.interval =
                                    null;


                                finishGame(
                                    socket,
                                    state,
                                    state.signature
                                );
                            }

                        },
                        TICK_MS
                    );


                state.interval =
                    interval;


                games.set(
                    socket.id,
                    state
                );


                /* ==========================================
                   START CONFIRMATION
                ========================================== */

                socket.emit(
                    "game-started",
                    {

                        gameId,

                        startTime:
                            state.startTime,

                        speed:
                            state.speed
                    }
                );


                console.log(
                    `[GAME START] ${wallet} | ${gameId}`
                );
            }
        );


        /* =================================================
           JUMP
           !!! ORIGINAL LOGIC !!!
        ================================================= */

        socket.on(
            "jump",
            () => {

                const state =
                    games.get(
                        socket.id
                    );


                if (
                    !state ||
                    !state.alive ||
                    !state.started ||
                    state.finished
                ) {

                    return;
                }


                const p =
                    state.player;


                if (
                    p.jumpCount < 2
                ) {

                    p.vy =
                        JUMP_V;

                    p.jumpCount++;

                    p.onGround =
                        false;
                }
            }
        );


        /* =================================================
           GLOBAL CHAT
        ================================================= */

        socket.on(
            "chat-message",
            (data) => {

                if (
                    !data ||
                    typeof data.message !==
                        "string"
                ) {

                    return;
                }


                const message =
                    data.message.trim();


                if (
                    !message
                ) {

                    return;
                }


                if (
                    message.length > 200
                ) {

                    socket.emit(
                        "chat-error",
                        {
                            message:
                                "Poruka je predugačka."
                        }
                    );

                    return;
                }


                /* ==========================================
                   CHAT RATE LIMIT
                ========================================== */

                const now =
                    Date.now();


                const lastTime =
                    lastMessageTimes.get(
                        socket.id
                    ) || 0;


                if (
                    now -
                        lastTime <
                    CHAT_COOLDOWN_MS
                ) {

                    const timeLeft =
                        (
                            CHAT_COOLDOWN_MS -
                            (
                                now -
                                lastTime
                            )
                        ) /
                        1000;


                    socket.emit(
                        "chat-error",
                        {
                            message:
                                `Sačekaj još ${timeLeft.toFixed(1)}s pre sledeće poruke.`
                        }
                    );

                    return;
                }


                lastMessageTimes.set(
                    socket.id,
                    now
                );


                /* ==========================================
                   WALLET
                ========================================== */

                const wallet =
                    typeof data.wallet ===
                        "string"
                        ? data.wallet.trim()
                        : "";


                let displayWallet =
                    "Guest";


                if (
                    isValidWallet(
                        wallet
                    )
                ) {

                    displayWallet =
                        wallet.substring(
                            0,
                            6
                        ) +
                        "..." +
                        wallet.substring(
                            wallet.length - 4
                        );
                }


                const chatMessage = {

                    wallet:
                        displayWallet,

                    message,

                    timestamp:
                        Date.now()
                };


                io.emit(
                    "chat-message",
                    chatMessage
                );
            }
        );


        /* =================================================
           DISCONNECT
        ================================================= */

        socket.on(
            "disconnect",
            () => {

                onlinePlayers.delete(
                    socket.id
                );


                lastMessageTimes.delete(
                    socket.id
                );


                const state =
                    games.get(
                        socket.id
                    );


                if (
                    state
                ) {

                    if (
                        state.interval
                    ) {

                        clearInterval(
                            state.interval
                        );
                    }


                    games.delete(
                        socket.id
                    );
                }


                console.log(
                    "Klijent diskonektovan:",
                    socket.id
                );
            }
        );
    }
);


/* =========================================================
   FINISH GAME
========================================================= */

async function finishGame(
    socket,
    state,
    signature
) {

    /* ==========================================
       SECURITY:
       PREVENT DOUBLE FINISH
    ========================================== */

    if (
        state.finished
    ) {

        return;
    }


    state.finished =
        true;


    if (
        state.interval
    ) {

        clearInterval(
            state.interval
        );

        state.interval =
            null;
    }


    const endTime =
        Date.now();


    const duration =
        endTime -
        state.startTime;


    const finalScore =
        Math.floor(
            state.score / 10
        );


    /* =================================================
       SESSION
    ================================================= */

    let sessions =
        readFile(
            SESSION_FILE
        );


    const idx =
        sessions.findIndex(
            s =>
                s.gameId ===
                state.gameId
        );


    if (
        idx === -1
    ) {

        socket.emit(
            "game-over",
            {

                success:
                    false,

                error:
                    "Invalid session",

                score:
                    finalScore
            }
        );


        games.delete(
            socket.id
        );

        return;
    }


    const session =
        sessions[idx];


    /* =================================================
       SECURITY:
       WALLET MATCH
    ================================================= */

    if (
        !session.wallet ||
        session.wallet.toLowerCase() !==
            state.wallet.toLowerCase()
    ) {

        session.active =
            false;

        session.verified =
            false;


        saveFile(
            SESSION_FILE,
            sessions
        );


        socket.emit(
            "game-over",
            {

                success:
                    false,

                error:
                    "Wallet mismatch",

                score:
                    finalScore
            }
        );


        games.delete(
            socket.id
        );

        return;
    }


    /* =================================================
       ALREADY SUBMITTED
    ================================================= */

    if (
        session.active ===
        false
    ) {

        socket.emit(
            "game-over",
            {

                success:
                    false,

                error:
                    "Already submitted",

                score:
                    finalScore
            }
        );


        games.delete(
            socket.id
        );

        return;
    }


    /* =================================================
       MINIMUM GAME TIME
    ================================================= */

    if (
        duration <
        MIN_GAME_MS
    ) {

        session.active =
            false;

        session.verified =
            false;

        session.endTime =
            endTime;

        session.score =
            finalScore;

        session.duration =
            duration;


        saveFile(
            SESSION_FILE,
            sessions
        );


        socket.emit(
            "game-over",
            {

                success:
                    false,

                error:
                    "Game too short",

                score:
                    finalScore
            }
        );


        games.delete(
            socket.id
        );

        return;
    }


    /* =================================================
       SECURITY:
       SCORE SANITY CHECK
       
       ORIGINAL GAME LOGIC IS UNTOUCHED.
       Ovo samo proverava rezultat na kraju.
    ================================================= */

    const maxAllowedScore =
        Math.floor(
            duration *
                0.035 +
                50
        );


    if (
        finalScore >
        maxAllowedScore
    ) {

        session.active =
            false;

        session.verified =
            false;

        session.endTime =
            endTime;

        session.score =
            finalScore;

        session.duration =
            duration;


        saveFile(
            SESSION_FILE,
            sessions
        );


        console.warn(
            `[SECURITY CHEAT ALERT] Wallet ${state.wallet} - Score: ${finalScore}, Max: ${maxAllowedScore}`
        );


        socket.emit(
            "game-over",
            {

                success:
                    false,

                error:
                    "Detektovana nevelidna brzina osvajanja poena!",

                score:
                    finalScore
            }
        );


        games.delete(
            socket.id
        );

        return;
    }


    /* =================================================
       SECURITY:
       SIGNATURE REQUIRED
    ================================================= */

    if (
        !signature ||
        signature ===
            "no_signature" ||
        signature ===
            "guest_mode"
    ) {

        session.active =
            false;

        session.verified =
            false;

        session.score =
            finalScore;

        session.endTime =
            endTime;

        session.duration =
            duration;


        saveFile(
            SESSION_FILE,
            sessions
        );


        socket.emit(
            "game-over",
            {

                success:
                    false,

                error:
                    "Gost režim - skor nije sačuvan na rang listi.",

                score:
                    finalScore
            }
        );


        games.delete(
            socket.id
        );

        return;
    }


    /* =================================================
       VERIFY SIGNATURE
========================================================= */

    let verified =
        false;


    try {

        const recoveredAddress =
            ethers.verifyMessage(
                `Login to Satoshi Plays: ${state.wallet}`,
                signature
            );


        if (
            recoveredAddress.toLowerCase() !==
            state.wallet.toLowerCase()
        ) {

            throw new Error(
                "Potpis ne odgovara adresi novčanika!"
            );
        }


        verified =
            true;


        console.log(
            `[AUTH VERIFIED] ${state.wallet}`
        );

    } catch (err) {

        verified =
            false;


        console.warn(
            `[SECURITY WARNING] Nevažeći potpis za ${state.wallet}: ${err.message}`
        );
    }


    /* =================================================
       SECURITY:
       INVALID SIGNATURE = NO SCORE SAVE
    ================================================= */

    if (
        !verified
    ) {

        session.active =
            false;

        session.verified =
            false;

        session.score =
            finalScore;

        session.endTime =
            endTime;

        session.timestamp =
            endTime;

        session.signature =
            signature;

        session.duration =
            duration;


        saveFile(
            SESSION_FILE,
            sessions
        );


        /*
         * VAŽNO:
         *
         * Ne upisujemo ništa u:
         *
         * scores
         *
         * niti u:
         *
         * user_scores
         */


        socket.emit(
            "game-over",
            {

                success:
                    false,

                error:
                    "Nevažeći potpis - skor nije sačuvan.",

                score:
                    finalScore
            }
        );


        games.delete(
            socket.id
        );

        return;
    }


    /* =================================================
       VERIFIED SESSION
    ================================================= */

    session.active =
        false;

    session.score =
        finalScore;

    session.endTime =
        endTime;

    session.timestamp =
        endTime;

    session.signature =
        signature;

    session.duration =
        duration;

    session.verified =
        true;


    saveFile(
        SESSION_FILE,
        sessions
    );


    /* =================================================
       SAVE VERIFIED SCORE
    ================================================= */

    try {

        const queryText = `
            INSERT INTO scores (
                game_id,
                wallet,
                start_time,
                end_time,
                score,
                timestamp,
                signature,
                duration,
                verified,
                type
            )
            VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8,
                $9,
                $10
            )
        `;


        /*
         * DAILY
         */

        await pool.query(
            queryText,
            [

                session.gameId,

                session.wallet,

                session.startTime,

                endTime,

                finalScore,

                endTime,

                signature,

                duration,

                true,

                "daily"
            ]
        );


        /*
         * WEEKLY
         */

        await pool.query(
            queryText,
            [

                session.gameId,

                session.wallet,

                session.startTime,

                endTime,

                finalScore,

                endTime,

                signature,

                duration,

                true,

                "weekly"
            ]
        );


        /* =================================================
           USER SCORES
        ================================================= */

        const userScoresQuery = `
            INSERT INTO user_scores (
                wallet_address,
                weekly_total,
                daily_best,
                updated_at
            )
            VALUES (
                $1,
                $2,
                $2,
                NOW()
            )
            ON CONFLICT (
                wallet_address
            )
            DO UPDATE SET

                weekly_total =
                    user_scores.weekly_total +
                    EXCLUDED.weekly_total,

                daily_best =
                    GREATEST(
                        user_scores.daily_best,
                        EXCLUDED.daily_best
                    ),

                updated_at =
                    NOW();
        `;


        await pool.query(
            userScoresQuery,
            [
                session.wallet,
                finalScore
            ]
        );


        console.log(
            `[SCORE SAVED & VERIFIED IN DB] ${state.wallet} | Score: ${finalScore}`
        );


    } catch (dbErr) {

        console.error(
            "Greška pri upisu skora u PostgreSQL:",
            dbErr
        );


        /*
         * Klijent NE dobija success=true
         * ako DB nije uspeo.
         */

        socket.emit(
            "game-over",
            {

                success:
                    false,

                error:
                    "Greška pri čuvanju rezultata.",

                score:
                    finalScore
            }
        );


        games.delete(
            socket.id
        );

        return;
    }


    /* =================================================
       SUCCESS
    ================================================= */

    socket.emit(
        "game-over",
        {

            success:
                true,

            score:
                finalScore,

            message:
                "Skor uspešno verifikovan i sačuvan u bazu!"
        }
    );


    games.delete(
        socket.id
    );
}


/* =========================================================
   LEADERBOARDS
========================================================= */

app.get(
    "/get-scores/:type",
    async (req, res) => {

        try {

            const type =
                req.params.type;


            const scoreColumn =
                type === "weekly"
                    ? "weekly_total"
                    : "daily_best";


            const query = `
                SELECT
                    wallet_address AS wallet,
                    ${scoreColumn} AS score
                FROM user_scores
                WHERE ${scoreColumn} > 0
                ORDER BY ${scoreColumn} DESC
                LIMIT 10
            `;


            const result =
                await pool.query(
                    query
                );


            const formattedScores =
                result.rows.map(
                    (row, index) => ({

                        rank:
                            index + 1,

                        wallet:
                            row.wallet,

                        score:
                            Number(
                                row.score
                            )
                    })
                );


            res.json(
                formattedScores
            );


        } catch (err) {

            console.error(
                "Greška pri čitanju rang liste:",
                err
            );


            res.status(
                500
            ).json([]);
        }
    }
);


/* =========================================================
   GAME STATISTICS
   SAMO VERIFIED REZULTATI
========================================================= */

app.get(
    "/api/game-stats",
    async (req, res) => {

        try {

            const wallet =
                typeof req.query.wallet ===
                    "string"
                    ? req.query.wallet.trim()
                    : null;


            const now =
                Date.now();


            const startOfToday =
                now -
                (
                    24 *
                    60 *
                    60 *
                    1000
                );


            const startOfWeek =
                now -
                (
                    7 *
                    24 *
                    60 *
                    60 *
                    1000
                );


            const globalTodayQuery = `
                SELECT COUNT(*)
                FROM scores
                WHERE type = 'daily'
                AND verified = true
                AND timestamp >= $1
            `;


            const globalWeekQuery = `
                SELECT COUNT(*)
                FROM scores
                WHERE type = 'weekly'
                AND verified = true
                AND timestamp >= $1
            `;


            const globalTodayRes =
                await pool.query(
                    globalTodayQuery,
                    [
                        startOfToday
                    ]
                );


            const globalWeekRes =
                await pool.query(
                    globalWeekQuery,
                    [
                        startOfWeek
                    ]
                );


            let myTodayCount =
                0;


            let myWeekCount =
                0;


            if (
                wallet &&
                wallet !== "undefined" &&
                wallet !== "null"
            ) {

                const myTodayQuery = `
                    SELECT COUNT(*)
                    FROM scores
                    WHERE type = 'daily'
                    AND verified = true
                    AND LOWER(wallet) = LOWER($1)
                    AND timestamp >= $2
                `;


                const myWeekQuery = `
                    SELECT COUNT(*)
                    FROM scores
                    WHERE type = 'weekly'
                    AND verified = true
                    AND LOWER(wallet) = LOWER($1)
                    AND timestamp >= $2
                `;


                const myTodayRes =
                    await pool.query(
                        myTodayQuery,
                        [
                            wallet,
                            startOfToday
                        ]
                    );


                const myWeekRes =
                    await pool.query(
                        myWeekQuery,
                        [
                            wallet,
                            startOfWeek
                        ]
                    );


                myTodayCount =
                    parseInt(
                        myTodayRes.rows[0].count,
                        10
                    );


                myWeekCount =
                    parseInt(
                        myWeekRes.rows[0].count,
                        10
                    );
            }


            res.json({

                myGamesToday:
                    myTodayCount,

                myGamesWeek:
                    myWeekCount,

                globalGamesToday:
                    parseInt(
                        globalTodayRes.rows[0].count,
                        10
                    ),

                globalGamesWeek:
                    parseInt(
                        globalWeekRes.rows[0].count,
                        10
                    )
            });


        } catch (err) {

            console.error(
                "Greška pri dohvatanju statistike igre:",
                err
            );


            res.status(
                500
            ).json({

                myGamesToday:
                    0,

                myGamesWeek:
                    0,

                globalGamesToday:
                    0,

                globalGamesWeek:
                    0
            });
        }
    }
);


/* =========================================================
   LIVE SERVER STATUS
========================================================= */

app.get(
    "/api/status",
    (req, res) => {

        res.json({

            onlinePlayers:
                onlinePlayers.size,

            activeGames:
                games.size,

            network:
                "BNB Smart Chain",

            chainId:
                56,

            competition:
                "Weekly Arena",

            competitionStatus:
                "LIVE",

            serverStatus:
                "ONLINE"
        });
    }
);


/* =========================================================
   ROOT
========================================================= */

app.get(
    "/",
    (req, res) => {

        res.json({

            status:
                "Satoshi Plays API & Game Server is Running!"
        });
    }
);


/* =========================================================
   CLEANUP RATE LIMIT KEYS
========================================================= */

setInterval(
    () => {

        const now =
            Date.now();


        for (
            const [
                key,
                timestamp
            ] of lastGameStarts
        ) {

            if (
                now -
                    timestamp >
                60 *
                    60 *
                    1000
            ) {

                lastGameStarts.delete(
                    key
                );
            }
        }

    },
    10 *
        60 *
        1000
);


/* =========================================================
   SERVER
========================================================= */

const PORT =
    process.env.PORT ||
    3000;


server.listen(
    PORT,
    () => {

        console.log(
            `Server is running on port ${PORT}`
        );


        console.log(
            `Environment: ${
                process.env.NODE_ENV ||
                "development"
            }`
        );
    }
);
