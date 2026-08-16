
/* ==========================================================
GAME.JS - STATIC / NO ANIMATIONS
1200x555
SERVER AUTHORITATIVE
========================================================== */


/* ==========================================================
BACKEND
========================================================== */

const BACKEND_URL =
    window.location.hostname === "localhost"
        ? "http://localhost:3000"
        : "https://api.satoshiplays.com";


/* ==========================================================
LIVE STATUS BAR
========================================================== */

async function updateLiveStatus() {

    try {

        const response =
            await fetch(
                `${BACKEND_URL}/api/status`
            );

        if (!response.ok) {
            throw new Error("Status request failed");
        }

        const data =
            await response.json();

        const players =
            document.getElementById(
                "livePlayersCount"
            );

        const tooltipPlayers =
            document.getElementById(
                "tooltipPlayers"
            );

        const tooltipGames =
            document.getElementById(
                "tooltipGames"
            );

        if (players) {
            players.textContent =
                data.onlinePlayers;
        }

        if (tooltipPlayers) {
            tooltipPlayers.textContent =
                data.onlinePlayers;
        }

        if (tooltipGames) {
            tooltipGames.textContent =
                data.activeGames;
        }

    } catch (error) {

        const players =
            document.getElementById(
                "livePlayersCount"
            );

        if (players) {
            players.textContent = "—";
        }
    }
}


updateLiveStatus();

setInterval(
    updateLiveStatus,
    5000
);


/* ==========================================================
GLOBAL
========================================================== */

let highScore =
    Number(
        localStorage.getItem("highScore")
    ) || 0;

let socket = null;
let currentGameId = null;

const GAME_WIDTH = 1200;
const GAME_HEIGHT = 555;


/* ==========================================================
GAME SCENE
========================================================== */

class GameScene extends Phaser.Scene {

    constructor() {

        super("GameScene");

        this.globalKeyHandler = null;

        this.gameStarted = false;
        this.gameOver = false;

        this.serverObstacles = [];

        this.obstacleSpritesMap =
            new Map();
    }


    /* ======================================================
    RESTART
    ====================================================== */

    restartGame() {

        this.gameOver = false;
        this.gameStarted = false;

        this.playerSprite.clearTint();

        this.playerSprite.x = 180;
        this.playerSprite.y = 495;

        if (this.gameOverText) {

            this.gameOverText.destroy();

            this.gameOverText = null;
        }


        if (!this.startText) {

            this.startText =
                this.add.text(
                    GAME_WIDTH / 2,
                    150,
                    "TAP OR SPACE TO START",
                    {
                        fontSize: "48px",
                        fill: "#f3ba2f",
                        fontStyle: "bold",
                        stroke: "#000",
                        strokeThickness: 6
                    }
                )
                .setOrigin(0.5)
                .setDepth(20);

        } else {

            this.startText.setText(
                "TAP OR SPACE TO START"
            );
        }
    }


    /* ======================================================
    PRELOAD
    ====================================================== */

    preload() {

        this.load.image(
            "player",
            "assets/run_sheet.png"
        );

        this.load.image(
            "fud",
            "assets/fud.png"
        );

        this.load.image(
            "rugpull",
            "assets/rugpull.png"
        );

        this.load.image(
            "sky",
            "assets/sky.png"
        );

        this.load.image(
            "rekt",
            "assets/rekt.png"
        );

        this.load.image(
            "liquidation",
            "assets/liquidation.png"
        );
    }


    /* ======================================================
    CREATE
    ====================================================== */

    create() {

        this.gameStarted = false;
        this.gameOver = false;

        this.score = 0;
        this.speed = 0;

        this.serverPlayerY = 330;

        this.serverObstacles = [];


        /* ==================================================
        STATIC SKY
        ================================================== */

        this.add.image(
            GAME_WIDTH / 2,
            GAME_HEIGHT / 2,
            "sky"
        )
        .setDisplaySize(
            GAME_WIDTH,
            GAME_HEIGHT
        )
        .setDepth(-30);


        /* ==================================================
        STATIC BACKGROUND
        ================================================== */

        this.add.rectangle(
            GAME_WIDTH / 2,
            500,
            GAME_WIDTH,
            110,
            0x0b0b14
        )
        .setDepth(-20);


        /* ==================================================
        STATIC BUILDINGS
        ================================================== */

        this.createStaticBuildings();


        /* ==================================================
        GROUND
        ================================================== */

        this.ground =
            this.add.rectangle(
                600,
                540,
                1200,
                60,
                0x34a853
            )
            .setDepth(5);


        /* ==================================================
        PLAYER
        ================================================== */

        this.playerSprite =
            this.add.sprite(
                180,
                495,
                "player"
            )
            .setScale(1.2)
            .setDepth(10);

        /*
         * Ako je run_sheet spritesheet,
         * ovde samo prikazujemo prvi frame.
         */
        this.playerSprite.setFrame(0);


        /* ==================================================
        SCORE
        ================================================== */

        this.scoreText =
            this.add.text(
                30,
                30,
                "Score: 0",
                {
                    fontSize: "36px",
                    fill: "#f3ba2f",
                    fontStyle: "bold",
                    stroke: "#000",
                    strokeThickness: 4
                }
            )
            .setDepth(20);


        this.bestText =
            this.add.text(
                30,
                75,
                "Best: " + highScore,
                {
                    fontSize: "30px",
                    fill: "#ffffff",
                    fontStyle: "bold",
                    stroke: "#000",
                    strokeThickness: 4
                }
            )
            .setDepth(20);


        /* ==================================================
        START TEXT
        ================================================== */

        this.startText =
            this.add.text(
                GAME_WIDTH / 2,
                100,
                "TAP OR SPACE TO START",
                {
                    fontSize: "48px",
                    fill: "#f3ba2f",
                    fontStyle: "bold",
                    stroke: "#000",
                    strokeThickness: 4
                }
            )
            .setOrigin(0.5)
            .setDepth(20);


        /* ==================================================
        RESET GAME OVER
        ================================================== */

        window.resetGameOverScreen =
            () => {

                this.restartGame();

            };


        /* ==================================================
        SOCKET
        ================================================== */

        if (!socket) {

            socket =
                io(
                    BACKEND_URL,
                    {
                        transports: [
                            "websocket",
                            "polling"
                        ],

                        secure:
                            window.location.protocol ===
                            "https:"
                    }
                );


            /* ==================================================
            GAME STARTED
            ================================================== */

            socket.on(
                "game-started",
                (data) => {

                    currentGameId =
                        data.gameId;

                    this.speed =
                        data.speed;

                    this.gameStarted =
                        true;

                    this.gameOver =
                        false;


                    if (this.startText) {

                        this.startText.destroy();

                        this.startText = null;
                    }
                }
            );


            /* ==================================================
            STATE
            ================================================== */

            socket.on(
                "state",
                (state) => {

                    if (
                        !this.gameStarted ||
                        this.gameOver
                    ) {
                        return;
                    }


                    /*
                     * SERVER SCORE
                     */

                    this.score =
                        state.score;


                    /*
                     * SERVER SPEED
                     */

                    this.speed =
                        state.speed;


                    /*
                     * SCORE TEXT
                     */

                    this.scoreText.setText(
                        "Score: " +
                        state.score
                    );


                    /*
                     * SERVER PLAYER POSITION
                     *
                     * Nema lokalne fizike.
                     * Nema interpolation.
                     * Nema prediction.
                     */

                    this.serverPlayerY =
                        state.player.y;


                    /*
                     * OBSTACLES
                     *
                     * Direktno čuvamo server state.
                     */

                    const incoming =
                        state.obstacles;

                    this.serverObstacles =
                        incoming;
                }
            );


            /* ==================================================
            GAME OVER
            ================================================== */

            socket.on(
                "game-over",
                (result) => {

                    this.onGameOver(
                        result
                    );
                }
            );


            /* ==================================================
            SOCKET ERROR
            ================================================== */

            socket.on(
                "error",
                (err) => {

                    console.error(
                        "Server error:",
                        err
                    );
                }
            );
        }


        /* ==================================================
        JUMP
        ================================================== */

        const handleJump =
            () => {

                if (this.gameOver) {

                    this.restartGame();

                    return;
                }


                if (!this.gameStarted) {

                    this.requestStart();

                    return;
                }


                /*
                 * NEMA LOKALNOG SKOKA.
                 *
                 * Samo server dobija jump.
                 */

                if (socket) {

                    socket.emit(
                        "jump"
                    );
                }
            };


        /* ==================================================
        KEYBOARD
        ================================================== */

        if (this.globalKeyHandler) {

            window.removeEventListener(
                "keydown",
                this.globalKeyHandler
            );
        }


        this.globalKeyHandler =
            (event) => {

                if (
                    event.code ===
                    "Space"
                ) {

                    event.preventDefault();

                    handleJump();
                }
            };


        window.addEventListener(
            "keydown",
            this.globalKeyHandler
        );


        /* ==================================================
        TOUCH
        ================================================== */

        this.input.on(
            "pointerdown",
            handleJump
        );
    }


    /* ======================================================
    STATIC BUILDINGS
    ====================================================== */

    createStaticBuildings() {

        const buildings = [

            {
                x: 0,
                y: 410,
                w: 90,
                h: 90
            },

            {
                x: 110,
                y: 380,
                w: 70,
                h: 120
            },

            {
                x: 200,
                y: 425,
                w: 100,
                h: 75
            },

            {
                x: 325,
                y: 360,
                w: 80,
                h: 140
            },

            {
                x: 430,
                y: 400,
                w: 110,
                h: 100
            },

            {
                x: 565,
                y: 345,
                w: 75,
                h: 155
            },

            {
                x: 665,
                y: 390,
                w: 120,
                h: 110
            },

            {
                x: 810,
                y: 350,
                w: 90,
                h: 150
            },

            {
                x: 925,
                y: 405,
                w: 100,
                h: 95
            },

            {
                x: 1050,
                y: 370,
                w: 110,
                h: 130
            },

            {
                x: 1180,
                y: 340,
                w: 100,
                h: 160
            }
        ];


        for (
            let i = 0;
            i < buildings.length;
            i++
        ) {

            const b =
                buildings[i];


            this.add.rectangle(
                b.x + b.w / 2,
                b.y + b.h / 2,
                b.w,
                b.h,
                0x17172c
            )
            .setDepth(-10);


            /*
             * Nekoliko statičnih prozora.
             */

            for (
                let wx = b.x + 12;
                wx < b.x + b.w - 8;
                wx += 20
            ) {

                for (
                    let wy = b.y + 12;
                    wy < b.y + b.h - 10;
                    wy += 25
                ) {

                    this.add.rectangle(
                        wx,
                        wy,
                        4,
                        4,
                        0xffffff,
                        0.6
                    )
                    .setDepth(-9);
                }
            }
        }
    }


    /* ======================================================
    REQUEST START
    ====================================================== */

    requestStart() {

        const wallet =
            localStorage.getItem(
                "userWallet"
            ) ||
            "0xTestWallet1234567890abcdef";


        const signature =
            localStorage.getItem(
                "userSignature"
            ) ||
            "no_signature";


        if (this.startText) {

            this.startText.setText(
                "Connecting..."
            );
        }


        socket.emit(
            "start-game",
            {
                wallet,
                signature
            }
        );
    }


    /* ======================================================
    GAME OVER
    ====================================================== */

    onGameOver(result) {

        if (this.gameOver) {
            return;
        }


        this.gameOver = true;
        this.gameStarted = false;


        /*
         * NEMA:
         * shake
         * tween
         * tint
         * flash
         * animation
         */


        const finalScore =
            result.score ||
            this.score;


        if (
            finalScore >
            highScore
        ) {

            highScore =
                finalScore;


            localStorage.setItem(
                "highScore",
                highScore
            );


            this.bestText.setText(
                "Best: " +
                highScore
            );
        }


        /* ==================================================
        GAME OVER TEXT
        ================================================== */

        this.time.delayedCall(
            300,
            () => {

                if (!this.gameOver) {
                    return;
                }


                this.gameOverText =
                    this.add.text(
                        GAME_WIDTH / 2,
                        165,
                        "GAME OVER\n\nTAP OR SPACE",
                        {
                            fontSize: "51px",
                            fill: "#ff3333",
                            align: "center",
                            fontStyle: "bold",
                            stroke: "#000",
                            strokeThickness: 7
                        }
                    )
                    .setOrigin(0.5)
                    .setDepth(30);
            }
        );


        if (result.success) {

            window.dispatchEvent(
                new Event(
                    "scoreSubmitted"
                )
            );
        }
    }


    /* ======================================================
    UPDATE
    ====================================================== */

    update() {

        if (
            !this.gameStarted ||
            this.gameOver
        ) {
            return;
        }


        /* ==================================================
        PLAYER
        ================================================== */

        /*
         * Samo server position.
         */

        this.playerSprite.y =
            this.serverPlayerY;


        /* ==================================================
        OBSTACLES
        ================================================== */

        const incoming =
            this.serverObstacles;


        /*
         * 1. Ažuriraj postojeće prepreke.
         */

        for (
            let i = 0;
            i < incoming.length;
            i++
        ) {

            const obs =
                incoming[i];


            let obj =
                this.obstacleSpritesMap.get(
                    obs.id
                );


            /*
             * Ako sprite ne postoji,
             * napravi ga jednom.
             */

            if (!obj) {

                let key =
                    "rugpull";

                let label =
                    "";


                if (
                    obs.type ===
                    "fud"
                ) {

                    key =
                        "fud";
                }

                else if (
                    obs.type ===
                    "meteor"
                ) {

                    key =
                        "rekt";

                    label =
                        "REKT";
                }

                else if (
                    obs.type ===
                    "liquidation"
                ) {

                    key =
                        "liquidation";

                    label =
                        "LIQUIDATED";
                }

                else if (
                    obs.type ===
                    "rug"
                ) {

                    key =
                        "rugpull";

                    label =
                        "rugpull";
                }


                const sprite =
                    this.add.sprite(
                        obs.x,
                        obs.y,
                        key
                    )
                    .setScale(
                        obs.type === "fud"
                            ? 1.05
                            : 1.2
                    )
                    .setDepth(8);


                let text =
                    null;


                if (label) {

                    text =
                        this.add.text(
                            obs.x,
                            obs.y + 15,
                            label,
                            {
                                fontSize: "18px",
                                fill: "#fff",
                                fontStyle: "bold",
                                stroke: "#000",
                                strokeThickness: 3
                            }
                        )
                        .setOrigin(0.5)
                        .setDepth(9);
                }


                obj = {
                    sprite,
                    text
                };


                this.obstacleSpritesMap.set(
                    obs.id,
                    obj
                );
            }


            /*
             * DIREKTNA SERVER POZICIJA.
             */

            obj.sprite.x =
                obs.x;

            obj.sprite.y =
                obs.y;


            if (obj.text) {

                obj.text.x =
                    obs.x;

                obj.text.y =
                    obs.y + 15;
            }
        }


        /*
         * 2. Obriši prepreke koje server
         * više ne šalje.
         */

        this.obstacleSpritesMap.forEach(
            (obj, id) => {

                let exists =
                    false;


                for (
                    let i = 0;
                    i < incoming.length;
                    i++
                ) {

                    if (
                        incoming[i].id ===
                        id
                    ) {

                        exists = true;

                        break;
                    }
                }


                if (!exists) {

                    obj.sprite.destroy();


                    if (obj.text) {
                        obj.text.destroy();
                    }


                    this.obstacleSpritesMap.delete(
                        id
                    );
                }
            }
        );
    }
}


/* ==========================================================
PHASER START
========================================================== */

function startGame() {

    const config = {

        type:
            Phaser.AUTO,


        render: {

            antialias:
                false,

            pixelArt:
                true,

            resolution:
                1
        },


        scale: {

            mode:
                Phaser.Scale.FIT,

            parent:
                "phaser-game",

            autoCenter:
                Phaser.Scale.CENTER_BOTH,

            width:
                GAME_WIDTH,

            height:
                GAME_HEIGHT
        },


        roundPixels:
            true,


        /*
         * NEMA PHYSICS.
         */

        scene: [
            GameScene
        ]
    };


    new Phaser.Game(
        config
    );
}


/* ==========================================================
FULLSCREEN
========================================================== */

const fullscreenBtn =
    document.getElementById(
        "fullscreenBtn"
    );


if (fullscreenBtn) {

    fullscreenBtn.addEventListener(
        "click",
        async () => {

            const gameContainer =
                document.getElementById(
                    "game-container"
                );


            try {

                if (
                    !document.fullscreenElement
                ) {

                    await gameContainer
                        .requestFullscreen();

                } else {

                    await document
                        .exitFullscreen();
                }

            } catch (error) {

                console.error(
                    "Fullscreen error:",
                    error
                );
            }
        }
    );


    document.addEventListener(
        "fullscreenchange",
        () => {

            fullscreenBtn.textContent =
                document.fullscreenElement
                    ? "✕ EXIT"
                    : "⛶ FULLSCREEN";
        }
    );
}


/* ==========================================================
SIDEBAR
========================================================== */

const gamesNavBtn =
    document.getElementById(
        "gamesNavBtn"
    );

const sidebarMenu =
    document.getElementById(
        "sidebarMenu"
    );

const closeMenuBtn =
    document.getElementById(
        "closeMenuBtn"
    );


if (
    gamesNavBtn &&
    sidebarMenu
) {

    gamesNavBtn.addEventListener(
        "click",
        function () {

            if (
                sidebarMenu.style.width ===
                "280px"
            ) {

                sidebarMenu.style.width =
                    "0";

            } else {

                sidebarMenu.style.width =
                    "280px";
            }
        }
    );
}


if (
    closeMenuBtn &&
    sidebarMenu
) {

    closeMenuBtn.addEventListener(
        "click",
        function () {

            sidebarMenu.style.width =
                "0";
        }
    );
}
