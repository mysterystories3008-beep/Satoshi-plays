/* ==========================================================
GAME.JS - 1200x555 - CPU OPTIMIZED
NO VISUAL ANIMATIONS
GAMEPLAY LOGIC UNCHANGED
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
        localStorage.getItem(
            "highScore"
        )
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
CPU OPTIMIZED

Background is generated ONCE.
No animation.
No per-frame clear().
No per-frame building redraw.
No birds animation.
No plane animation.
No cloud animation.
No parallax calculations.
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
        CLOUD
        STATIC
        ================================================== */

        this.cloud =
            scene.add.graphics();

        this.cloud.setDepth(-23);

        this.cloud.fillStyle(
            0xffffff,
            1
        );

        const cloudX =
            S(150);

        const cloudY =
            S(95);

        this.cloud.fillCircle(
            cloudX,
            cloudY,
            S(28)
        );

        this.cloud.fillCircle(
            cloudX + S(25),
            cloudY - S(12),
            S(35)
        );

        this.cloud.fillCircle(
            cloudX + S(52),
            cloudY,
            S(25)
        );

        this.cloud.fillRect(
            cloudX - S(10),
            cloudY,
            S(80),
            S(25)
        );


        /* ==================================================
        BIRDS
        STATIC
        ================================================== */

        this.birds =
            scene.add.graphics();

        this.birds.setDepth(-22);

        this.birds.lineStyle(
            S(2),
            0x111111,
            1
        );

        this.drawBird(
            S(120),
            S(120),
            1
        );

        this.drawBird(
            S(280),
            S(90),
            0.7
        );

        this.drawBird(
            S(520),
            S(135),
            0.9
        );

        this.drawBird(
            S(720),
            S(105),
            0.6
        );


        /* ==================================================
        PLANE
        STATIC
        ================================================== */

        this.plane =
            scene.add.graphics();

        this.plane.setDepth(-22);

        const px =
            S(900);

        const py =
            S(75);

        this.plane.fillStyle(
            0x222222,
            0.8
        );

        this.plane.fillRect(
            px,
            py,
            S(35),
            S(3)
        );

        this.plane.fillTriangle(
            px + S(10),
            py,
            px + S(25),
            py - S(8),
            px + S(28),
            py
        );

        this.plane.fillTriangle(
            px + S(10),
            py + S(3),
            px + S(25),
            py + S(10),
            px + S(28),
            py + S(3)
        );

        this.plane.fillRect(
            px,
            py - S(4),
            S(8),
            S(8)
        );


        /* ==================================================
        BUILDING LAYERS
        ================================================== */

        this.layers = [];


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


            const layer =
                scene.add.graphics();

            layer.setDepth(
                -20 + i
            );


            this.drawLayer(
                layer,
                buildings,
                BG_COLORS[i]
            );


            this.layers.push(
                layer
            );
        }
    }


    /* ======================================================
    DRAW BIRD
    ====================================================== */

    drawBird(
        x,
        y,
        scale
    ) {

        const wingX =
            S(7) * scale;

        const wingY =
            S(7) * scale;

        const width =
            S(12) * scale;

        this.birds.beginPath();

        this.birds.moveTo(
            x - width,
            y
        );

        this.birds.lineTo(
            x - wingX,
            y - wingY
        );

        this.birds.lineTo(
            x,
            y
        );

        this.birds.strokePath();


        this.birds.beginPath();

        this.birds.moveTo(
            x,
            y
        );

        this.birds.lineTo(
            x + wingX,
            y - wingY
        );

        this.birds.lineTo(
            x + width,
            y
        );

        this.birds.strokePath();
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

                width:
                    w,

                height:
                    h,

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
    DRAW STATIC LAYER
    ====================================================== */

    drawLayer(
        graphics,
        buildings,
        color
    ) {

        const groundY =
            this.groundY;


        /* ==================================================
        BUILDINGS
        ================================================== */

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
                groundY -
                b.height,
                b.width,
                b.height
            );
        }


        /* ==================================================
        WINDOWS
        ================================================== */

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

    Namerno prazno.

    Background je statičan da bi se izbacilo:
    - graphics.clear()
    - 10x redraw
    - parallax calculations
    - cloud movement
    - bird movement
    - plane movement
    ====================================================== */

    update() {
        return;
    }
}


/* ==========================================================
GAME SCENE
========================================================== */

class GameScene extends Phaser.Scene {

    constructor() {

        super(
            "GameScene"
        );

        this.globalKeyHandler =
            null;

        this.lastScore =
            -1;
    }


    /* ======================================================
    RESTART
    ====================================================== */

    restartGame() {

        this.gameOver =
            false;

        this.gameStarted =
            false;


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


        /* NO PLAYER ANIMATION */

        this.playerSprite.setFrame(
            0
        );


        if (this.gameOverText) {

            this.gameOverText.destroy();

            this.gameOverText =
                null;
        }


        if (!this.startText) {

            this.startText =
                this.add.text(
                    600,
                    150,
                    "TAP OR SPACE TO START",
                    {
                        fontSize:
                            "48px",

                        fill:
                            "#f3ba2f",

                        fontStyle:
                            "bold",

                        stroke:
                            "#000",

                        strokeThickness:
                            6
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

        /*
         * Run/jump spritesheets are still loaded
         * because the original asset structure remains.
         * No animation is played.
         */

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
        NO ANIMATION
        ================================================== */

        this.playerSprite =
            this.add.sprite(
                180,
                495,
                "player-run"
            )
            .setScale(1.2)
            .setDepth(10);


        this.playerSprite.setFrame(
            0
        );


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
                    fontSize:
                        "36px",

                    fill:
                        "#f3ba2f",

                    fontStyle:
                        "bold",

                    stroke:
                        "#000",

                    strokeThickness:
                        4
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
                    fontSize:
                        "30px",

                    fill:
                        "#ffffff",

                    fontStyle:
                        "bold",

                    stroke:
                        "#000",

                    strokeThickness:
                        4
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
                    fontSize:
                        "48px",

                    fill:
                        "#f3ba2f",

                    fontStyle:
                        "bold",

                    stroke:
                        "#000",

                    strokeThickness:
                        4
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


            /* ==============================================
            GAME STARTED
            ============================================== */

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


                    /*
                     * Static player frame.
                     */

                    this.playerSprite.setFrame(
                        0
                    );


                    if (
                        this.startText
                    ) {

                        this.startText.destroy();

                        this.startText =
                            null;
                    }
                }
            );


            /* ==============================================
            STATE
            ============================================== */

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
                     * Only update DOM-like Phaser text
                     * when score actually changed.
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


                    /* ======================================
                    PLAYER
                    ====================================== */

                    this.serverPlayerY =
                        (
                            state.player.y -
                            15
                        ) *
                        GAME_SCALE;


                    /* ======================================
                    OBSTACLES

                    Reuse existing array.
                    No map().
                    No spread.
                    No new object per tick.
                    ====================================== */

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


            /* ==============================================
            GAME OVER
            ============================================== */

            socket.on(
                "game-over",
                result => {

                    this.onGameOver(
                        result
                    );
                }
            );


            /* ==============================================
            SOCKET ERROR
            ============================================== */

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


                /*
                 * Same local jump prediction
                 * as original code.
                 */

                if (
                    this.playerSprite &&
                    this.playerSprite.y >= 320
                ) {

                    this.playerSprite.y -=
                        45;

                    this.isLocallyJumping =
                        true;


                    /*
                     * No delayedCall required.
                     * Server state controls the player
                     * position anyway.
                     */

                    this.isLocallyJumping =
                        false;
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


        /*
         * NO animation.
         * NO tween.
         * NO camera shake.
         */

        this.playerSprite.setFrame(
            0
        );


        /* ==================================================
        FIND CLOSEST OBSTACLE
        ================================================== */

        const obstacles =
            this.serverObstacles;


        if (
            obstacles.length > 0
        ) {

            let hitObstacle =
                obstacles[0];


            let bestDistance =
                Math.abs(
                    hitObstacle.x -
                    this.playerSprite.x
                );


            for (
                let i = 1;
                i < obstacles.length;
                i++
            ) {

                const obstacle =
                    obstacles[i];


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

        /*
         * No delayedCall.
         * Show immediately.
         */

        this.gameOverText =
            this.add.text(
                600,
                165,
                "GAME OVER\n\nTAP OR SPACE",
                {
                    fontSize:
                        "51px",

                    fill:
                        "#ff3333",

                    align:
                        "center",

                    fontStyle:
                        "bold",

                    stroke:
                        "#000",

                    strokeThickness:
                        7
                }
            )
            .setOrigin(0.5)
            .setDepth(30);


        /* ==================================================
        SCORE SUBMITTED
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


        /*
         * NO animation switching.
         * Static frame only.
         */

        this.playerSprite.setFrame(
            0
        );

        this.playerSprite.rotation =
            0;


        /* ==================================================
        OBSTACLES
        ================================================== */

        const obstacles =
            this.serverObstacles;


        /* ==================================================
        REMOVE OLD OBSTACLES
        ================================================== */

        /*
         * We don't create a Set.
         * We compare the existing map against
         * the current server array.
         */

        this.obstacleSpritesMap.forEach(
            (obj, id) => {

                let exists =
                    false;


                for (
                    let i = 0;
                    i < obstacles.length;
                    i++
                ) {

                    if (
                        obstacles[i].id ===
                        id
                    ) {

                        exists =
                            true;

                        break;
                    }
                }


                if (!exists) {

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


        /* ==================================================
        UPDATE OBSTACLES
        ================================================== */

        for (
            let i = 0;
            i < obstacles.length;
            i++
        ) {

            const obs =
                obstacles[i];


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


            /* ==================================================
            CREATE OBSTACLE ONLY ONCE
            ================================================== */

            if (!obj) {

                const sprite =
                    this.add.sprite(
                        obs.x,
                        obs.y,
                        key
                    );


                sprite.setScale(
                    obs.type ===
                    "fud"
                        ? 1.05
                        : 1.2
                );


                sprite.setDepth(
                    8
                );


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


                if (label) {

                    text =
                        this.add.text(
                            obs.x,
                            obs.y +
                            S(15),
                            label,
                            {
                                fontSize:
                                    "18px",

                                fill:
                                    "#fff",

                                fontStyle:
                                    "bold",

                                stroke:
                                    "#000",

                                strokeThickness:
                                    3
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


            /* ==================================================
            UPDATE POSITION
            ================================================== */

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


        /*
         * Background update intentionally omitted.
         *
         * Background is static.
         */
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

            /*
             * Lower GPU/CPU load.
             */

            antialias:
                false,

            pixelArt:
                false,

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
         * Arcade physics is not used by the game.
         * Server controls the gameplay physics.
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
