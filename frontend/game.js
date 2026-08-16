
/* ==========================================================
GAME.JS - 1200x555 - OPTIMIZED
========================================================== */


/* ==========================================================
LIVE STATUS BAR
========================================================== */

const BACKEND_URL =
    window.location.hostname === "localhost"
        ? "http://localhost:3000"
        : "https://api.satoshiplays.com";

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

        if (players)
            players.textContent =
                data.onlinePlayers;

        if (tooltipPlayers)
            tooltipPlayers.textContent =
                data.onlinePlayers;

        if (tooltipGames)
            tooltipGames.textContent =
                data.activeGames;

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

const GAME_SCALE = 1.5;
const GAME_WIDTH = 1200;
const GAME_HEIGHT = 555;

const S =
    value =>
        value * GAME_SCALE;


/* ==========================================================
BACKGROUND CONSTANTS
========================================================== */

const BG_SPEEDS = [
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

const BG_COLORS = [
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


/* ==========================================================
BACKGROUND MANAGER
========================================================== */

class BackgroundManager {

    constructor(scene) {

        this.scene = scene;

        this.totalWidth =
            S(2200);

        this.groundY =
            S(345);


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
        STATIC BUILDING TEXTURES
        ================================================== */

        this.layers = [];

        this.layerSprites = [];

        this.offsets =
            new Float32Array(10);


        const buildingSettings = [

            [10, 18, 10, 25],
            [12, 20, 14, 32],
            [14, 22, 18, 40],
            [16, 25, 22, 48],
            [18, 28, 26, 56],
            [20, 31, 30, 65],
            [22, 34, 35, 75],
            [25, 38, 40, 85],
            [28, 42, 45, 95],
            [31, 46, 50, 105]

        ];


        for (
            let i = 0;
            i < 10;
            i++
        ) {

            const buildings =
                this.generateBuildings(
                    ...buildingSettings[i]
                );

            const textureKey =
                "bg_layer_" + i;

            /*
             * Texture is generated only once.
             * On restart Phaser already has it.
             */

            if (
                !scene.textures.exists(
                    textureKey
                )
            ) {

                const graphics =
                    scene.add.graphics();

                this.drawStaticLayer(
                    graphics,
                    buildings,
                    BG_COLORS[i]
                );

                graphics.generateTexture(
                    textureKey,
                    this.totalWidth,
                    S(555)
                );

                graphics.destroy();
            }


            /*
             * Two sprites are enough to create
             * an endless scrolling layer.
             */

            const sprite1 =
                scene.add.image(
                    this.totalWidth / 2,
                    S(555) / 2,
                    textureKey
                );

            const sprite2 =
                scene.add.image(
                    this.totalWidth +
                    this.totalWidth / 2,
                    S(555) / 2,
                    textureKey
                );


            sprite1
                .setOrigin(0.5)
                .setDepth(-20 + i);

            sprite2
                .setOrigin(0.5)
                .setDepth(-20 + i);


            this.layers.push({
                sprite1,
                sprite2
            });
        }


        /* ==================================================
        CLOUD
        ================================================== */

        const cloudKey =
            "bg_cloud";

        if (
            !scene.textures.exists(
                cloudKey
            )
        ) {

            const g =
                scene.add.graphics();

            g.fillStyle(
                0xffffff,
                1
            );

            /*
             * Same cloud proportions
             * as original.
             */

            g.fillCircle(
                S(38),
                S(47),
                S(28)
            );

            g.fillCircle(
                S(63),
                S(35),
                S(35)
            );

            g.fillCircle(
                S(90),
                S(47),
                S(25)
            );

            g.fillRect(
                S(28),
                S(47),
                S(80),
                S(25)
            );

            g.generateTexture(
                cloudKey,
                S(118),
                S(85)
            );

            g.destroy();
        }


        this.cloud =
            scene.add.image(
                S(-160),
                S(48),
                cloudKey
            )
            .setOrigin(0, 0)
            .setDepth(-23);


        this.cloudX =
            S(-160);


        /* ==================================================
        BIRDS
        ================================================== */

        const birdKey =
            "bg_bird";

        if (
            !scene.textures.exists(
                birdKey
            )
        ) {

            const g =
                scene.add.graphics();

            g.lineStyle(
                S(2),
                0x111111,
                1
            );

            g.beginPath();

            g.moveTo(
                S(0),
                S(7)
            );

            g.lineTo(
                S(7),
                0
            );

            g.lineTo(
                S(12),
                S(7)
            );

            g.strokePath();


            g.beginPath();

            g.moveTo(
                S(12),
                S(7)
            );

            g.lineTo(
                S(17),
                0
            );

            g.lineTo(
                S(24),
                S(7)
            );

            g.strokePath();


            g.generateTexture(
                birdKey,
                S(25),
                S(10)
            );

            g.destroy();
        }


        const birdData = [
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


        this.birds = [];


        for (
            let i = 0;
            i < birdData.length;
            i++
        ) {

            const b =
                birdData[i];

            const bird =
                scene.add.image(
                    b.x,
                    b.y,
                    birdKey
                )
                .setOrigin(0, 0)
                .setScale(b.size)
                .setDepth(-22);

            this.birds.push(bird);
        }


        /* ==================================================
        PLANE
        ================================================== */

        const planeKey =
            "bg_plane";

        if (
            !scene.textures.exists(
                planeKey
            )
        ) {

            const g =
                scene.add.graphics();

            g.fillStyle(
                0x222222,
                0.8
            );

            g.fillRect(
                0,
                S(4),
                S(35),
                S(3)
            );

            g.fillTriangle(
                S(10),
                S(4),
                S(25),
                0,
                S(28),
                S(4)
            );

            g.fillTriangle(
                S(10),
                S(7),
                S(25),
                S(14),
                S(28),
                S(7)
            );

            g.fillRect(
                0,
                0,
                S(8),
                S(8)
            );

            g.generateTexture(
                planeKey,
                S(40),
                S(18)
            );

            g.destroy();
        }


        this.plane =
            scene.add.image(
                S(900),
                S(75),
                planeKey
            )
            .setOrigin(0, 0)
            .setDepth(-22);


        this.planeX =
            S(900);

        this.planeY =
            S(75);
    }


    /* ======================================================
    GENERATE BUILDINGS
    ====================================================== */

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


    /* ======================================================
    DRAW STATIC BUILDING TEXTURE
    ====================================================== */

    drawStaticLayer(
        graphics,
        buildings,
        color
    ) {

        const groundY =
            this.groundY;


        /* --------------------------
        BUILDINGS
        -------------------------- */

        graphics.fillStyle(
            color,
            0.95
        );


        for (
            let i = 0;
            i < buildings.length;
            i++
        ) {

            const b =
                buildings[i];

            graphics.fillRect(
                b.x,
                groundY - b.height,
                b.width,
                b.height
            );
        }


        /* --------------------------
        WINDOWS
        -------------------------- */

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
            let i = 0;
            i < buildings.length;
            i++
        ) {

            const b =
                buildings[i];


            if (
                b.height <= S(35) ||
                b.width <= S(15)
            ) {
                continue;
            }


            for (
                let wx =
                    b.x + S(3);

                wx <
                b.x +
                b.width -
                S(3);

                wx += gapX
            ) {

                for (
                    let wy =
                        groundY -
                        b.height +
                        S(5);

                    wy <
                    groundY -
                    S(6);

                    wy += gapY
                ) {

                    if (
                        (wx + wy) %
                        S(5) !==
                        0
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
        }
    }


    /* ======================================================
    UPDATE
    ====================================================== */

    update(speed) {

        /* ==================================================
        SKY
        ================================================== */

        this.sky.tilePositionX +=
            speed *
            0.08 *
            GAME_SCALE;


        /* ==================================================
        CLOUD
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


        this.cloud.x =
            this.cloudX;


        /* ==================================================
        BIRDS
        ================================================== */

        const birdSpeed =
            speed *
            0.025 *
            GAME_SCALE;


        for (
            let i = 0;
            i < this.birds.length;
            i++
        ) {

            const bird =
                this.birds[i];

            bird.x +=
                birdSpeed;

            if (
                bird.x >
                S(850)
            ) {

                bird.x =
                    S(-50);
            }
        }


        /* ==================================================
        PLANE
        ================================================== */

        this.planeX -=
            speed *
            0.015 *
            GAME_SCALE;


        if (
            this.planeX <
            S(-100)
        ) {

            this.planeX =
                S(950);

            this.planeY =
                Phaser.Math.Between(
                    S(60),
                    S(120)
                );
        }


        this.plane.x =
            this.planeX;

        this.plane.y =
            this.planeY;


        /* ==================================================
        BUILDING LAYERS
        ================================================== */

        for (
            let i = 0;
            i < 10;
            i++
        ) {

            let offset =
                this.offsets[i];


            offset +=
                speed *
                BG_SPEEDS[i] *
                GAME_SCALE;


            if (
                offset >=
                this.totalWidth
            ) {

                offset -=
                    this.totalWidth;
            }


            this.offsets[i] =
                offset;


            const layer =
                this.layers[i];


            /*
             * Instead of clearing and redrawing
             * thousands of rectangles, simply move
             * two pre-rendered images.
             */

            layer.sprite1.x =
                this.totalWidth / 2 -
                offset;

            layer.sprite2.x =
                this.totalWidth +
                this.totalWidth / 2 -
                offset;
        }
    }
}


/* ==========================================================
GAME SCENE
========================================================== */

class GameScene extends Phaser.Scene {

    constructor() {

        super("GameScene");

        this.globalKeyHandler = null;

        this.lastScore = -1;
    }


    /* ======================================================
    RESTART
    ====================================================== */

    restartGame() {

        this.gameOver = false;
        this.gameStarted = false;

        this.playerSprite.clearTint();

        this.playerSprite.rotation = 0;

        this.playerSprite.setScale(
            1.2
        );

        this.playerSprite.x =
            S(120);

        this.playerSprite.y =
            S(330);

        this.playerSprite.play(
            "player-run"
        );


        if (this.gameOverText) {

            this.gameOverText.destroy();

            this.gameOverText = null;
        }


        if (!this.startText) {

            this.startText =
                this.add.text(
                    600,
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

        this.gameStarted = false;
        this.gameOver = false;

        this.score = 0;
        this.speed = 5;

        this.gameOverText = null;

        this.serverPlayerY =
            S(330);

        this.serverObstacles = [];


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
        ANIMATIONS
        ================================================== */

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


        /* ==================================================
        PLAYER
        ================================================== */

        this.playerSprite =
            this.add.sprite(
                180,
                495,
                "player-run"
            )
            .setScale(1.2)
            .setDepth(10);

        this.playerSprite.setFrame(0);


        /* ==================================================
        OBSTACLES
        ================================================== */

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
            new BackgroundManager(this);


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


            /* ----------------------------------------------
            GAME STARTED
            ---------------------------------------------- */

            socket.on(
                "game-started",
                data => {

                    currentGameId =
                        data.gameId;

                    this.speed =
                        data.speed;

                    this.gameStarted =
                        true;

                    this.gameOver =
                        false;

                    this.playerSprite.setFrame(0);


                    if (
                        this.startText
                    ) {

                        this.startText.destroy();

                        this.startText =
                            null;
                    }
                }
            );


            /* ----------------------------------------------
            STATE
            ---------------------------------------------- */

            socket.on(
                "state",
                state => {

                    if (
                        !this.gameStarted ||
                        this.gameOver
                    ) {
                        return;
                    }


                    this.score =
                        state.score;

                    this.speed =
                        state.speed;


                    /*
                     * Do not call setText if score
                     * has not actually changed.
                     */

                    if (
                        this.lastScore !==
                        state.score
                    ) {

                        this.lastScore =
                            state.score;

                        this.scoreText.setText(
                            "Score: " +
                            state.score
                        );
                    }


                    this.serverPlayerY =
                        (
                            state.player.y -
                            15
                        ) *
                        GAME_SCALE;


                    /*
                     * Reuse obstacle objects.
                     * No map(), no spread operator,
                     * no new object for every tick.
                     */

                    const incoming =
                        state.obstacles;

                    const current =
                        this.serverObstacles;


                    current.length =
                        incoming.length;


                    for (
                        let i = 0;
                        i < incoming.length;
                        i++
                    ) {

                        const source =
                            incoming[i];

                        let target =
                            current[i];


                        if (!target) {

                            target = {};

                            current[i] =
                                target;
                        }


                        target.id =
                            source.id;

                        target.type =
                            source.type;

                        target.x =
                            source.x *
                            GAME_SCALE;

                        target.y =
                            source.y *
                            GAME_SCALE;
                    }
                }
            );


            /* ----------------------------------------------
            GAME OVER
            ---------------------------------------------- */

            socket.on(
                "game-over",
                result => {

                    this.onGameOver(
                        result
                    );
                }
            );


            socket.on(
                "error",
                err => {

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

                if (
                    this.gameOver
                ) {

                    this.scene.restart();

                    return;
                }


                if (
                    !this.gameStarted
                ) {

                    this.requestStart();

                    return;
                }


                if (
                    this.playerSprite &&
                    this.playerSprite.y >= 320
                ) {

                    this.playerSprite.y -=
                        45;

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


                if (socket) {

                    socket.emit(
                        "jump"
                    );
                }
            };


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
            event => {

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


        if (
            this.startText
        ) {

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

        if (
            this.gameOver
        ) {
            return;
        }


        this.gameOver =
            true;

        this.gameStarted =
            false;

        this.playerSprite.anims.stop();


        /* ==================================================
        FIND CLOSEST OBSTACLE
        ================================================== */

        if (
            this.serverObstacles.length
        ) {

            let hitObstacle =
                this.serverObstacles[0];

            let bestDistance =
                Math.abs(
                    hitObstacle.x -
                    this.playerSprite.x
                );


            for (
                let i = 1;
                i <
                this.serverObstacles.length;
                i++
            ) {

                const obstacle =
                    this.serverObstacles[i];

                const distance =
                    Math.abs(
                        obstacle.x -
                        this.playerSprite.x
                    );


                if (
                    distance <
                    bestDistance
                ) {

                    bestDistance =
                        distance;

                    hitObstacle =
                        obstacle;
                }
            }


            if (
                hitObstacle
            ) {

                this.playerSprite.x =
                    (
                        this.playerSprite.x +
                        hitObstacle.x
                    ) / 2;

                this.playerSprite.y =
                    hitObstacle.y -
                    S(15);
            }
        }


        /* ==================================================
        HIT EFFECT
        ================================================== */

        this.cameras.main.shake(
            250,
            0.015
        );


        this.playerSprite.setTint(
            0xff3333
        );


        this.tweens.add({

            targets:
                this.playerSprite,

            scaleX: 1.35,
            scaleY: 0.65,

            duration: 80,

            yoyo: true,

            ease: "Quad.easeOut",

            onComplete: () => {

                this.playerSprite.setScale(
                    1.2
                );

                this.playerSprite.clearTint();
            }
        });


        /* ==================================================
        SCORE
        ================================================== */

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

                if (
                    !this.gameOver
                ) {
                    return;
                }


                this.gameOverText =
                    this.add.text(
                        600,
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

        this.playerSprite.y =
            this.serverPlayerY;


        /* ==================================================
        PLAYER ANIMATION
        ================================================== */

        const jumping =
            this.playerSprite.y <
            S(330);


        if (
            jumping
        ) {

            if (
                this.playerSprite.anims
                    .currentAnim?.key !==
                "player-jump"
            ) {

                this.playerSprite.play(
                    "player-jump"
                );
            }

        } else {

            if (
                this.playerSprite.anims
                    .currentAnim?.key !==
                "player-run"
            ) {

                this.playerSprite.play(
                    "player-run"
                );
            }
        }


        this.playerSprite.rotation =
            0;


        /* ==================================================
        OBSTACLES
        ================================================== */

        const obstacles =
            this.serverObstacles;


        /*
         * Mark currently visible IDs.
         */

        const activeIds =
            new Set();


        for (
            let i = 0;
            i < obstacles.length;
            i++
        ) {

            const obs =
                obstacles[i];

            activeIds.add(
                obs.id
            );


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

            } else if (
                obs.type ===
                "meteor"
            ) {

                key =
                    "rekt";

                label =
                    "REKT";

            } else if (
                obs.type ===
                "liquidation"
            ) {

                key =
                    "liquidation";

                label =
                    "LIQUIDATED";

            } else if (
                obs.type ===
                "rug"
            ) {

                label =
                    "rugpull";
            }


            let obj =
                this.obstacleSpritesMap.get(
                    obs.id
                );


            /* ----------------------------------------------
            CREATE ONCE
            ---------------------------------------------- */

            if (!obj) {

                const sprite =
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

                    sprite.setTint(
                        0xff0000
                    );
                }


                let text =
                    null;


                if (
                    label
                ) {

                    text =
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
                    sprite,
                    text
                };


                this.obstacleSpritesMap.set(
                    obs.id,
                    obj
                );
            }


            obj.sprite.x =
                obs.x;

            obj.sprite.y =
                obs.y;


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


        /* ==================================================
        REMOVE OLD OBSTACLES
        ================================================== */

        this.obstacleSpritesMap.forEach(
            (obj, id) => {

                if (
                    !activeIds.has(id)
                ) {

                    obj.sprite.destroy();

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


        /* ==================================================
        BACKGROUND
        ================================================== */

        this.background.update(
            this.speed
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

            } catch (
                error
            ) {

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
