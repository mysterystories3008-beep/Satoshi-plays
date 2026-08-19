/* ==========================================================
   GAME.JS - 1200x555 RESOLUTION
   Satoshi Plays / $SPLAY
========================================================== */


/* ==========================================================
   LIVE STATUS BAR
========================================================== */

async function updateLiveStatus() {

    try {

        const backendUrl =
            window.location.hostname === "localhost"
                ? "http://localhost:3000"
                : "https://api.satoshiplays.com";

        const response =
            await fetch(`${backendUrl}/api/status`, {
                method: "GET",
                cache: "no-store"
            });

        if (!response.ok) {
            throw new Error("Status request failed");
        }

        const data =
            await response.json();

        const players =
            document.getElementById("livePlayersCount");

        const tooltipPlayers =
            document.getElementById("tooltipPlayers");

        const tooltipGames =
            document.getElementById("tooltipGames");

        if (players) {
            players.textContent =
                Number(data.onlinePlayers || 0);
        }

        if (tooltipPlayers) {
            tooltipPlayers.textContent =
                Number(data.onlinePlayers || 0);
        }

        if (tooltipGames) {
            tooltipGames.textContent =
                Number(data.activeGames || 0);
        }

    } catch (error) {

        console.error(
            "Live status error:",
            error
        );

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
   GLOBAL GAME VARIABLES
========================================================== */

let highScore =
    Number(
        localStorage.getItem("highScore") || 0
    );

let socket = null;

let currentGameId = null;


// Jedina aktivna Phaser instanca
window.phaserGame = null;


const GAME_SCALE = 1.5;

const GAME_WIDTH = 1200;

const GAME_HEIGHT = 555;


// Server coordinates -> Phaser coordinates
const S = (value) =>
    Number(value || 0) * GAME_SCALE;


/* ==========================================================
   BACKGROUND MANAGER
========================================================== */

class BackgroundManager {

    constructor(scene) {

        this.scene = scene;


        /* ==================================================
           SKY
        ================================================== */

        this.sky =
            scene.add.tileSprite(
                GAME_WIDTH / 2,
                300,
                GAME_WIDTH,
                600,
                "sky"
            );

        this.sky.setDepth(-25);


        /* ==================================================
           SUN
        ================================================== */

        this.sun =
            scene.add.graphics();

        this.sun.setDepth(-24);

        this.sun.fillStyle(
            0xffaa22,
            1
        );

        this.sun.fillCircle(
            S(650),
            S(95),
            S(30)
        );


        /* ==================================================
           CLOUDS
        ================================================== */

        this.cloudsGraphics =
            scene.add.graphics();

        this.cloudsGraphics.setDepth(-23);

        this.cloudX =
            S(-150);


        /* ==================================================
           BIRDS
        ================================================== */

        this.birdsGraphics =
            scene.add.graphics();

        this.birdsGraphics.setDepth(-22);

        this.birds = [

            {
                x: S(120),
                y: S(120),
                size: 1
            },

            {
                x: S(280),
                y: S(90),
                size: 0.7
            },

            {
                x: S(520),
                y: S(135),
                size: 0.9
            },

            {
                x: S(720),
                y: S(105),
                size: 0.6
            }
        ];


        /* ==================================================
           PLANE
        ================================================== */

        this.planeGraphics =
            scene.add.graphics();

        this.planeGraphics.setDepth(-22);

        this.plane = {

            x: S(900),

            y: S(75)
        };


        /* ==================================================
           BUILDING LAYERS
        ================================================== */

        this.layer1 =
            scene.add.graphics().setDepth(-20);

        this.layer2 =
            scene.add.graphics().setDepth(-19);

        this.layer3 =
            scene.add.graphics().setDepth(-18);

        this.layer4 =
            scene.add.graphics().setDepth(-17);

        this.layer5 =
            scene.add.graphics().setDepth(-16);

        this.layer6 =
            scene.add.graphics().setDepth(-15);

        this.layer7 =
            scene.add.graphics().setDepth(-14);

        this.layer8 =
            scene.add.graphics().setDepth(-13);

        this.layer9 =
            scene.add.graphics().setDepth(-12);

        this.layer10 =
            scene.add.graphics().setDepth(-11);


        this.offsets = {

            l1: 0,
            l2: 0,
            l3: 0,
            l4: 0,
            l5: 0,
            l6: 0,
            l7: 0,
            l8: 0,
            l9: 0,
            l10: 0
        };


        this.totalWidth =
            S(2200);


        /* ==================================================
           BUILDINGS
        ================================================== */

        this.buildingsL1 =
            this.generateBuildings(
                10,
                18,
                10,
                25
            );

        this.buildingsL2 =
            this.generateBuildings(
                12,
                20,
                14,
                32
            );

        this.buildingsL3 =
            this.generateBuildings(
                14,
                22,
                18,
                40
            );

        this.buildingsL4 =
            this.generateBuildings(
                16,
                25,
                22,
                48
            );

        this.buildingsL5 =
            this.generateBuildings(
                18,
                28,
                26,
                56
            );

        this.buildingsL6 =
            this.generateBuildings(
                20,
                31,
                30,
                65
            );

        this.buildingsL7 =
            this.generateBuildings(
                22,
                34,
                35,
                75
            );

        this.buildingsL8 =
            this.generateBuildings(
                25,
                38,
                40,
                85
            );

        this.buildingsL9 =
            this.generateBuildings(
                28,
                42,
                45,
                95
            );

        this.buildingsL10 =
            this.generateBuildings(
                31,
                46,
                50,
                105
            );
    }


    generateBuildings(
        minW,
        maxW,
        minH,
        maxH
    ) {

        const arr = [];

        let x = 0;

        minW = S(minW);

        maxW = S(maxW);

        minH = S(minH);

        maxH = S(maxH);


        while (
            x <
            this.totalWidth
        ) {

            const w =
                Phaser.Math.Between(
                    minW,
                    maxW
                );

            const h =
                Phaser.Math.Between(
                    minH,
                    maxH
                );


            arr.push({

                x,

                width: w,

                height: h,

                type:
                    Phaser.Math.Between(
                        0,
                        2
                    )
            });


            x +=
                w +
                Phaser.Math.Between(
                    S(80),
                    S(150)
                );
        }


        return arr;
    }


    drawLayer(
        graphics,
        buildings,
        offset,
        color,
        alpha
    ) {

        graphics.clear();

        graphics.fillStyle(
            color,
            alpha
        );


        const groundY =
            S(345);


        for (
            const b of buildings
        ) {

            let x =
                b.x -
                offset;


            while (
                x <
                -b.width
            ) {

                x +=
                    this.totalWidth;
            }


            graphics.fillRect(
                x,
                groundY - b.height,
                b.width,
                b.height
            );


            if (
                b.height > S(35) &&
                b.width > S(15)
            ) {

                graphics.fillStyle(
                    0xffffff,
                    0.7
                );


                const windowSize =
                    S(1.5);

                const gapX =
                    S(4);

                const gapY =
                    S(6);


                for (
                    let wx = x + S(3);
                    wx <
                    x + b.width - S(3);
                    wx += gapX
                ) {

                    for (
                        let wy =
                            groundY -
                            b.height +
                            S(5);

                        wy <
                        groundY - S(6);

                        wy += gapY
                    ) {

                        if (
                            (wx + wy) %
                            S(5) !== 0
                        ) {

                            graphics.fillRect(
                                wx,
                                wy,
                                windowSize,
                                windowSize
                            );
                        }
                    }
                }


                graphics.fillStyle(
                    color,
                    alpha
                );
            }
        }
    }


    update(speed) {

        speed =
            Number(speed) || 0;


        /* ==================================================
           SKY
        ================================================== */

        this.sky.tilePositionX +=
            speed *
            0.08 *
            GAME_SCALE;


        /* ==================================================
           CLOUDS
        ================================================== */

        this.cloudX +=
            speed *
            0.015 *
            GAME_SCALE;


        if (
            this.cloudX >
            S(950)
        ) {

            this.cloudX =
                S(-200);
        }


        this.cloudsGraphics.clear();

        this.cloudsGraphics.fillStyle(
            0xffffff,
            1
        );


        const cx =
            this.cloudX;

        const cy =
            S(95);


        this.cloudsGraphics.fillCircle(
            cx,
            cy,
            S(28)
        );

        this.cloudsGraphics.fillCircle(
            cx + S(25),
            cy - S(12),
            S(35)
        );

        this.cloudsGraphics.fillCircle(
            cx + S(52),
            cy,
            S(25)
        );

        this.cloudsGraphics.fillRect(
            cx - S(10),
            cy,
            S(80),
            S(25)
        );


        /* ==================================================
           BIRDS
        ================================================== */

        this.birdsGraphics.clear();

        this.birdsGraphics.lineStyle(
            S(2),
            0x111111,
            1
        );


        for (
            const bird of this.birds
        ) {

            bird.x +=
                speed *
                0.025 *
                GAME_SCALE;


            if (
                bird.x >
                S(850)
            ) {

                bird.x =
                    S(-50);
            }


            const x =
                bird.x;

            const y =
                bird.y;

            const s =
                bird.size;


            this.birdsGraphics.beginPath();

            this.birdsGraphics.moveTo(
                x - S(12) * s,
                y
            );

            this.birdsGraphics.lineTo(
                x - S(5) * s,
                y - S(7) * s
            );

            this.birdsGraphics.lineTo(
                x,
                y
            );

            this.birdsGraphics.strokePath();


            this.birdsGraphics.beginPath();

            this.birdsGraphics.moveTo(
                x,
                y
            );

            this.birdsGraphics.lineTo(
                x + S(5) * s,
                y - S(7) * s
            );

            this.birdsGraphics.lineTo(
                x + S(12) * s,
                y
            );

            this.birdsGraphics.strokePath();
        }


        /* ==================================================
           PLANE
        ================================================== */

        this.planeGraphics.clear();

        this.plane.x -=
            speed *
            0.015 *
            GAME_SCALE;


        if (
            this.plane.x <
            S(-100)
        ) {

            this.plane.x =
                S(950);

            this.plane.y =
                Phaser.Math.Between(
                    S(60),
                    S(120)
                );
        }


        const px =
            this.plane.x;

        const py =
            this.plane.y;


        this.planeGraphics.fillStyle(
            0x222222,
            0.8
        );


        this.planeGraphics.fillRect(
            px,
            py,
            S(35),
            S(3)
        );


        this.planeGraphics.fillTriangle(
            px + S(10),
            py,
            px + S(25),
            py - S(8),
            px + S(28),
            py
        );


        this.planeGraphics.fillTriangle(
            px + S(10),
            py + S(3),
            px + S(25),
            py + S(10),
            px + S(28),
            py + S(3)
        );


        this.planeGraphics.fillRect(
            px,
            py - S(4),
            S(8),
            S(8)
        );


        /* ==================================================
           BUILDING LAYERS
        ================================================== */

        const speeds = [

            0.0025,
            0.005,
            0.01,
            0.0175,
            0.025,
            0.035,
            0.0475,
            0.065,
            0.085,
            0.11
        ];


        const colors = [

            0x0b0b14,
            0x0f0f1c,
            0x131324,
            0x17172c,
            0x1b1b36,
            0x1f1f40,
            0x24244a,
            0x292955,
            0x2e2e60,
            0x34346b
        ];


        const layers = [

            this.layer1,
            this.layer2,
            this.layer3,
            this.layer4,
            this.layer5,
            this.layer6,
            this.layer7,
            this.layer8,
            this.layer9,
            this.layer10
        ];


        const buildings = [

            this.buildingsL1,
            this.buildingsL2,
            this.buildingsL3,
            this.buildingsL4,
            this.buildingsL5,
            this.buildingsL6,
            this.buildingsL7,
            this.buildingsL8,
            this.buildingsL9,
            this.buildingsL10
        ];


        for (
            let i = 0;
            i < 10;
            i++
        ) {

            const key =
                "l" + (i + 1);


            this.offsets[key] +=
                speed *
                speeds[i] *
                GAME_SCALE;


            if (
                this.offsets[key] >=
                this.totalWidth
            ) {

                this.offsets[key] = 0;
            }


            this.drawLayer(
                layers[i],
                buildings[i],
                this.offsets[key],
                colors[i],
                0.95
            );
        }
    }
}


/* ==========================================================
   GAME SCENE
========================================================== */

class GameScene extends Phaser.Scene {

    constructor() {

        super("GameScene");


        this.globalKeyHandler =
            null;


        this.socketHandlersRegistered =
            false;


        this.isStartingGame =
            false;


        this.gameStarted =
            false;


        this.gameOver =
            false;
    }


    /* ======================================================
       SOCKET CLEANUP
    ====================================================== */

    cleanupSocketListeners() {

        if (
            !socket ||
            !this.socketHandlersRegistered
        ) {

            return;
        }


        socket.off(
            "game-started",
            this.handleGameStarted
        );

        socket.off(
            "state",
            this.handleState
        );

        socket.off(
            "game-over",
            this.handleGameOver
        );

        socket.off(
            "error",
            this.handleSocketError
        );


        this.socketHandlersRegistered =
            false;
    }


    /* ======================================================
       RESTART GAME
    ====================================================== */

    restartGame() {

        this.gameOver =
            false;

        this.gameStarted =
            false;

        this.isStartingGame =
            false;


        this.score =
            0;

        this.serverPlayerY =
            S(330);

        this.serverObstacles =
            [];


        if (
            this.playerSprite
        ) {

            this.playerSprite.clearTint();

            this.playerSprite.rotation =
                0;

            this.playerSprite.setScale(
                1.2
            );

            this.playerSprite.x =
                S(120);

            this.playerSprite.y =
                S(330);

            this.playerSprite.setFrame(
                0
            );

            this.playerSprite.play(
                "player-run"
            );
        }


        if (
            this.scoreText
        ) {

            this.scoreText.setText(
                "Score: 0"
            );
        }


        if (
            this.gameOverText
        ) {

            this.gameOverText.destroy();

            this.gameOverText =
                null;
        }


        if (
            this.startText
        ) {

            this.startText.setText(
                "TAP OR SPACE TO START"
            );

            this.startText.setVisible(
                true
            );

        } else {

            this.startText =
                this.add.text(
                    GAME_WIDTH / 2,
                    S(100),
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
        }
    }


    /* ======================================================
       PRELOAD
    ====================================================== */

    preload() {

        this.load.spritesheet(
            "player-run",
            "assets/run_sheet.png",
            {
                frameWidth: 75,
                frameHeight: 75
            }
        );


        this.load.spritesheet(
            "player-jump",
            "assets/jump_sheet.png",
            {
                frameWidth: 75,
                frameHeight: 75
            }
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

        this.gameStarted =
            false;

        this.gameOver =
            false;

        this.isStartingGame =
            false;


        this.score =
            0;

        this.speed =
            5;


        this.gameOverText =
            null;


        this.serverPlayerY =
            S(330);


        this.serverObstacles =
            [];


        this.isLocallyJumping =
            false;


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
           PLAYER ANIMATIONS
        ================================================== */

        if (
            !this.anims.exists(
                "player-run"
            )
        ) {

            this.anims.create({

                key: "player-run",

                frames:
                    this.anims.generateFrameNumbers(
                        "player-run",
                        {
                            start: 0,
                            end: 2
                        }
                    ),

                frameRate: 10,

                repeat: -1
            });
        }


        if (
            !this.anims.exists(
                "player-jump"
            )
        ) {

            this.anims.create({

                key: "player-jump",

                frames:
                    this.anims.generateFrameNumbers(
                        "player-jump",
                        {
                            start: 0,
                            end: 3
                        }
                    ),

                frameRate: 12,

                repeat: 0
            });
        }


        /* ==================================================
           PLAYER
        ================================================== */

        this.playerSprite =
            this.add.sprite(
                S(120),
                S(330),
                "player-run"
            )
            .setScale(1.2)
            .setDepth(10);


        this.playerSprite.setFrame(
            0
        );


        this.obstacleSpritesMap =
            new Map();


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
                "Best: " +
                highScore,
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
                S(100),
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
           BACKGROUND
        ================================================== */

        this.background =
            new BackgroundManager(
                this
            );


        /* ==================================================
           RESET GAME OVER SCREEN
        ================================================== */

        window.resetGameOverScreen =
            () => {

                if (
                    this &&
                    typeof this.restartGame ===
                    "function"
                ) {

                    this.restartGame();
                }
            };


        /* ==================================================
           SOCKET CONNECTION
        ================================================== */

        this.setupSocket();


        /* ==================================================
           INPUT
        ================================================== */

        const handleJump =
            () => {

                if (
                    this.gameOver
                ) {

                    this.restartGame();

                    return;
                }


                if (
                    !this.gameStarted
                ) {

                    this.requestStart();

                    return;
                }


                /* ==========================================
                   LOCAL VISUAL PREDICTION
                ========================================== */

                if (
                    this.playerSprite &&
                    this.playerSprite.y >=
                    S(320)
                ) {

                    this.playerSprite.y -=
                        S(45);

                    this.isLocallyJumping =
                        true;


                    this.time.delayedCall(
                        250,
                        () => {

                            this.isLocallyJumping =
                                false;
                        }
                    );
                }


                /* ==========================================
                   SERVER JUMP
                ========================================== */

                if (
                    socket &&
                    socket.connected
                ) {

                    socket.emit(
                        "jump"
                    );
                }
            };


        this.handleJump =
            handleJump;


        /* ==================================================
           KEYBOARD
        ================================================== */

        if (
            this.globalKeyHandler
        ) {

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
           POINTER / TOUCH
        ================================================== */

        this.input.on(
            "pointerdown",
            handleJump
        );


        /* ==================================================
           SCENE SHUTDOWN
        ================================================== */

        this.events.once(
            Phaser.Scenes.Events.SHUTDOWN,
            () => {

                if (
                    this.globalKeyHandler
                ) {

                    window.removeEventListener(
                        "keydown",
                        this.globalKeyHandler
                    );

                    this.globalKeyHandler =
                        null;
                }


                this.cleanupSocketListeners();


                this.input.off(
                    "pointerdown",
                    handleJump
                );
            }
        );
    }


    /* ======================================================
       SOCKET SETUP
    ====================================================== */

    setupSocket() {

        if (
            !socket
        ) {

            const backendUrl =
                window.location.hostname ===
                "localhost"
                    ? "http://localhost:3000"
                    : "https://api.satoshiplays.com";


            console.log(
                "Connecting Socket.IO:",
                backendUrl
            );


            socket =
                io(
                    backendUrl,
                    {
                        transports: [
                            "websocket",
                            "polling"
                        ],

                        reconnection: true,

                        reconnectionAttempts: 10,

                        reconnectionDelay: 1000,

                        timeout: 10000
                    }
                );


            socket.on(
                "connect",
                () => {

                    console.log(
                        "Socket.IO connected:",
                        socket.id
                    );
                }
            );


            socket.on(
                "disconnect",
                (reason) => {

                    console.warn(
                        "Socket.IO disconnected:",
                        reason
                    );
                }
            );


            socket.on(
                "connect_error",
                (error) => {

                    console.error(
                        "Socket.IO connection error:",
                        error
                    );
                }
            );
        }


        /* ==================================================
           GAME STARTED
        ================================================== */

        this.handleGameStarted =
            (data) => {

                if (
                    !data
                ) {

                    this.isStartingGame =
                        false;

                    return;
                }


                currentGameId =
                    data.gameId ||
                    null;


                this.speed =
                    Number(
                        data.speed || 5
                    );


                this.gameStarted =
                    true;


                this.gameOver =
                    false;


                this.isStartingGame =
                    false;


                if (
                    this.startText
                ) {

                    this.startText.setVisible(
                        false
                    );
                }


                if (
                    this.playerSprite
                ) {

                    this.playerSprite.setFrame(
                        0
                    );

                    this.playerSprite.play(
                        "player-run"
                    );
                }


                console.log(
                    "Game started:",
                    currentGameId
                );
            };


        /* ==================================================
           SERVER STATE
        ================================================== */

        this.handleState =
            (state) => {

                if (
                    !state ||
                    !this.gameStarted ||
                    this.gameOver
                ) {

                    return;
                }


                if (
                    typeof state.score !==
                    "undefined"
                ) {

                    this.score =
                        Number(
                            state.score
                        ) || 0;


                    if (
                        this.scoreText
                    ) {

                        this.scoreText.setText(
                            "Score: " +
                            this.score
                        );
                    }
                }


                if (
                    typeof state.speed !==
                    "undefined"
                ) {

                    this.speed =
                        Number(
                            state.speed
                        ) || 0;
                }


                /* ==========================================
                   PLAYER
                ========================================== */

                if (
                    state.player &&
                    typeof state.player.y ===
                    "number"
                ) {

                    const playerGroundOffset =
                        15;


                    this.serverPlayerY =
                        (
                            state.player.y -
                            playerGroundOffset
                        ) *
                        GAME_SCALE;
                }


                /* ==========================================
                   OBSTACLES
                ========================================== */

                if (
                    Array.isArray(
                        state.obstacles
                    )
                ) {

                    this.serverObstacles =
                        state.obstacles.map(
                            (obs) => ({

                                ...obs,

                                x:
                                    Number(
                                        obs.x || 0
                                    ) *
                                    GAME_SCALE,

                                y:
                                    Number(
                                        obs.y || 0
                                    ) *
                                    GAME_SCALE
                            })
                        );
                }
            };


        /* ==================================================
           GAME OVER
        ================================================== */

        this.handleGameOver =
            (result) => {

                this.onGameOver(
                    result || {}
                );
            };


        /* ==================================================
           SOCKET ERROR
        ================================================== */

        this.handleSocketError =
            (err) => {

                console.error(
                    "Server error:",
                    err
                );


                this.isStartingGame =
                    false;


                if (
                    this.startText
                ) {

                    const errorMessage =
                        err &&
                        err.message
                            ? err.message
                            : "ERROR - TRY AGAIN";


                    this.startText.setText(
                        errorMessage
                    );

                    this.startText.setVisible(
                        true
                    );
                }
            };


        /* ==================================================
           REGISTER LISTENERS
        ================================================== */

        socket.on(
            "game-started",
            this.handleGameStarted
        );


        socket.on(
            "state",
            this.handleState
        );


        socket.on(
            "game-over",
            this.handleGameOver
        );


        socket.on(
            "error",
            this.handleSocketError
        );


        this.socketHandlersRegistered =
            true;
    }


    /* ======================================================
       REQUEST START
    ====================================================== */

    requestStart() {

        if (
            this.isStartingGame
        ) {

            return;
        }


        if (
            !socket
        ) {

            console.error(
                "Socket is not initialized."
            );

            return;
        }


        if (
            !socket.connected
        ) {

            if (
                this.startText
            ) {

                this.startText.setText(
                    "Connecting..."
                );
            }


            try {

                socket.connect();

            } catch (error) {

                console.error(
                    "Socket reconnect error:",
                    error
                );
            }


            return;
        }


        this.isStartingGame =
            true;


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


        if (
            this.startText
        ) {

            this.startText.setText(
                "Starting..."
            );

            this.startText.setVisible(
                true
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

        if (
            this.gameOver
        ) {

            return;
        }


        result =
            result || {};


        this.gameOver =
            true;


        this.gameStarted =
            false;


        this.isStartingGame =
            false;


        if (
            this.playerSprite
        ) {

            this.playerSprite.anims.stop();
        }


        /* ==================================================
           FIND CLOSEST OBSTACLE
        ================================================== */

        if (
            this.serverObstacles &&
            this.serverObstacles.length > 0 &&
            this.playerSprite
        ) {

            const hitObstacle =
                this.serverObstacles.reduce(
                    (prev, curr) => {

                        return (
                            Math.abs(
                                curr.x -
                                this.playerSprite.x
                            )
                            <
                            Math.abs(
                                prev.x -
                                this.playerSprite.x
                            )
                        )
                            ? curr
                            : prev;
                    }
                );


            if (
                hitObstacle
            ) {

                this.playerSprite.x =
                    (
                        this.playerSprite.x +
                        hitObstacle.x
                    ) /
                    2;


                this.playerSprite.y =
                    hitObstacle.y -
                    S(15);
            }
        }


        /* ==================================================
           HIT EFFECT
        ================================================== */

        if (
            this.cameras &&
            this.cameras.main
        ) {

            this.cameras.main.shake(
                250,
                0.015
            );
        }


        if (
            this.playerSprite
        ) {

            this.playerSprite.setTint(
                0xff3333
            );


            this.tweens.add({

                targets:
                    this.playerSprite,

                scaleX:
                    1.35,

                scaleY:
                    0.65,

                duration:
                    80,

                yoyo:
                    true,

                ease:
                    "Quad.easeOut",

                onComplete:
                    () => {

                        if (
                            this.playerSprite
                        ) {

                            this.playerSprite.setScale(
                                1.2
                            );

                            this.playerSprite.clearTint();
                        }
                    }
            });
        }


        /* ==================================================
           FINAL SCORE
        ================================================== */

        const finalScore =
            Number(
                result.score ||
                this.score ||
                0
            );


        if (
            finalScore >
            highScore
        ) {

            highScore =
                finalScore;


            localStorage.setItem(
                "highScore",
                String(highScore)
            );


            if (
                this.bestText
            ) {

                this.bestText.setText(
                    "Best: " +
                    highScore
                );
            }
        }


        /* ==================================================
           GAME OVER MESSAGE
        ================================================== */

        this.time.delayedCall(
            300,
            () => {

                if (
                    !this.gameOver
                ) {

                    return;
                }


                let message =
                    "GAME OVER\n\nTAP OR SPACE";


                if (
                    result.error &&
                    String(
                        result.error
                    ).includes("Gost")
                ) {

                    message =
                        "GUEST MODE\n" +
                        "(Score Not Saved)\n\n" +
                        "TAP OR SPACE";

                } else if (
                    result.error
                ) {

                    message =
                        String(
                            result.error
                        ).toUpperCase() +
                        "\n\nTAP OR SPACE";
                }


                this.gameOverText =
                    this.add.text(
                        GAME_WIDTH / 2,
                        165,
                        message,
                        {
                            fontSize: "40px",
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


        /* ==================================================
           SCORE SUBMITTED EVENT
        ================================================== */

        if (
            result.success
        ) {

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

    update(time, delta) {

        if (
            !this.gameStarted ||
            this.gameOver
        ) {

            return;
        }


        /* ==================================================
           PLAYER
        ================================================== */

        if (
            this.playerSprite &&
            typeof this.serverPlayerY ===
            "number"
        ) {

            this.playerSprite.y =
                this.serverPlayerY;
        }


        /* ==================================================
           RUN / JUMP ANIMATION
        ================================================== */

        if (
            this.playerSprite
        ) {

            if (
                this.playerSprite.y <
                S(330)
            ) {

                if (
                    !this.playerSprite.anims
                        .currentAnim ||
                    this.playerSprite.anims
                        .currentAnim.key !==
                    "player-jump"
                ) {

                    this.playerSprite.play(
                        "player-jump"
                    );
                }

            } else {

                if (
                    !this.playerSprite.anims
                        .currentAnim ||
                    this.playerSprite.anims
                        .currentAnim.key !==
                    "player-run"
                ) {

                    this.playerSprite.play(
                        "player-run"
                    );
                }
            }


            this.playerSprite.rotation =
                0;
        }


        /* ==================================================
           OBSTACLES
        ================================================== */

        const activeIds =
            new Set(
                this.serverObstacles.map(
                    obs => obs.id
                )
            );


        this.obstacleSpritesMap.forEach(
            (obj, id) => {

                if (
                    !activeIds.has(id)
                ) {

                    if (
                        obj.sprite
                    ) {

                        obj.sprite.destroy();
                    }


                    if (
                        obj.text
                    ) {

                        obj.text.destroy();
                    }


                    this.obstacleSpritesMap.delete(
                        id
                    );
                }
            }
        );


        this.serverObstacles.forEach(
            (obs) => {

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


                if (
                    obs.type ===
                    "meteor"
                ) {

                    key =
                        "rekt";

                    label =
                        "REKT";
                }


                if (
                    obs.type ===
                    "liquidation"
                ) {

                    key =
                        "liquidation";

                    label =
                        "LIQUIDATED";
                }


                if (
                    obs.type ===
                    "rug"
                ) {

                    key =
                        "rugpull";

                    label =
                        "rugpull";
                }


                let obj =
                    this.obstacleSpritesMap.get(
                        obs.id
                    );


                /* ==========================================
                   CREATE OBSTACLE
                ========================================== */

                if (
                    !obj
                ) {

                    const spr =
                        this.add.sprite(
                            obs.x,
                            obs.y,
                            key
                        )
                        .setScale(
                            obs.type ===
                            "fud"
                                ? 1.05
                                : 1.2
                        )
                        .setDepth(8);


                    if (
                        obs.type ===
                        "meteor"
                    ) {

                        spr.setTint(
                            0xff0000
                        );
                    }


                    let txt =
                        null;


                    if (
                        label
                    ) {

                        txt =
                            this.add.text(
                                obs.x,
                                obs.y +
                                S(15),
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

                        sprite:
                            spr,

                        text:
                            txt,

                        type:
                            obs.type
                    };


                    this.obstacleSpritesMap.set(
                        obs.id,
                        obj
                    );
                }


                /* ==========================================
                   UPDATE POSITION
                ========================================== */

                if (
                    obj.sprite
                ) {

                    obj.sprite.x =
                        obs.x;

                    obj.sprite.y =
                        obs.y;
                }


                if (
                    obj.text
                ) {

                    obj.text.x =
                        obs.x;

                    obj.text.y =
                        obs.y +
                        S(15);
                }
            }
        );


        /* ==================================================
           BACKGROUND
        ================================================== */

        if (
            this.background
        ) {

            this.background.update(
                this.speed
            );
        }
    }
}


/* ==========================================================
   PHASER START
========================================================== */

function startGame() {

    console.log(
        "Starting Phaser game..."
    );


    /* ======================================================
       DESTROY PREVIOUS PHASER INSTANCE
    ====================================================== */

    if (
        window.phaserGame
    ) {

        console.log(
            "Destroying previous Phaser instance..."
        );


        try {

            window.phaserGame.destroy(
                true
            );

        } catch (error) {

            console.warn(
                "Error destroying previous Phaser instance:",
                error
            );
        }


        window.phaserGame =
            null;
    }


    /* ======================================================
       CLOSE PREVIOUS SOCKET
    ====================================================== */

    if (
        socket
    ) {

        try {

            socket.removeAllListeners();

            socket.disconnect();

        } catch (error) {

            console.warn(
                "Error cleaning previous socket:",
                error
            );
        }


        socket =
            null;


        currentGameId =
            null;
    }


    /* ======================================================
       CLEAR OLD CANVAS
    ====================================================== */

    const phaserContainer =
        document.getElementById(
            "phaser-game"
        );


    if (
        phaserContainer
    ) {

        phaserContainer.innerHTML =
            "";
    }


    /* ======================================================
       PHASER CONFIG
    ====================================================== */

    const config = {

        type:
            Phaser.AUTO,


        render: {

            antialias:
                true,

            pixelArt:
                false,

            resolution:
                Math.min(
                    window.devicePixelRatio ||
                    1,
                    2
                )
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


        physics: {

            default:
                "arcade",

            arcade: {

                gravity: {

                    y: 0
                },

                debug:
                    false
            }
        },


        scene: [
            GameScene
        ]
    };


    /* ======================================================
       CREATE PHASER
    ====================================================== */

    try {

        window.phaserGame =
            new Phaser.Game(
                config
            );


        console.log(
            "Phaser instance created."
        );

    } catch (error) {

        console.error(
            "Failed to create Phaser:",
            error
        );
    }
}


/* ==========================================================
   FULLSCREEN BUTTON
========================================================== */

const fullscreenBtn =
    document.getElementById(
        "fullscreenBtn"
    );


if (
    fullscreenBtn
) {

    fullscreenBtn.addEventListener(
        "click",
        async () => {

            const gameContainer =
                document.getElementById(
                    "game-container"
                );


            if (
                !gameContainer
            ) {

                console.warn(
                    "Game container not found."
                );

                return;
            }


            try {

                if (
                    !document.fullscreenElement
                ) {

                    if (
                        gameContainer.requestFullscreen
                    ) {

                        await gameContainer.requestFullscreen();
                    }

                } else {

                    if (
                        document.exitFullscreen
                    ) {

                        await document.exitFullscreen();
                    }
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

            if (
                document.fullscreenElement
            ) {

                fullscreenBtn.textContent =
                    "✕ EXIT";

            } else {

                fullscreenBtn.textContent =
                    "⛶ FULLSCREEN";
            }
        }
    );
}


/* ==========================================================
   GAMES SIDEBAR
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
        () => {

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
        () => {

            sidebarMenu.style.width =
                "0";
        }
    );
}


/* ==========================================================
   MOBILE STATUS TOOLTIP
========================================================== */

function initMobileStatusTooltips() {

    const statusModules =
        document.querySelectorAll(
            ".status-module"
        );


    if (
        !statusModules.length
    ) {

        console.warn(
            "No .status-module elements found"
        );

        return;
    }


    statusModules.forEach(
        (module) => {

            module.addEventListener(
                "click",
                (e) => {

                    if (
                        !window.matchMedia(
                            "(hover: none)"
                        ).matches
                    ) {

                        return;
                    }


                    e.stopPropagation();


                    const wasActive =
                        module.classList.contains(
                            "active"
                        );


                    statusModules.forEach(
                        (other) => {

                            other.classList.remove(
                                "active"
                            );
                        }
                    );


                    if (
                        !wasActive
                    ) {

                        module.classList.add(
                            "active"
                        );
                    }
                }
            );
        }
    );


    document.addEventListener(
        "click",
        (e) => {

            if (
                !e.target.closest(
                    ".status-module"
                )
            ) {

                statusModules.forEach(
                    (module) => {

                        module.classList.remove(
                            "active"
                        );
                    }
                );
            }
        }
    );


    console.log(
        "Mobile status tooltips initialized"
    );
}


/* ==========================================================
   DYNAMIC GAME.JS LOADING
========================================================== */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initMobileStatusTooltips
    );

} else {

    initMobileStatusTooltips();
}
