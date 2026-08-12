/* ==========================================================
GAME.JS - 1200x555 RESOLUTION
========================================================== */


// ==========================================
// LIVE STATUS BAR
// ==========================================

async function updateLiveStatus() {
    try {
        const backendUrl = window.location.origin;

        const response = await fetch(`${backendUrl}/api/status`);

        if (!response.ok) {
            throw new Error("Status request failed");
        }

        const data = await response.json();

        const players = document.getElementById("livePlayersCount");
        const tooltipPlayers = document.getElementById("tooltipPlayers");
        const tooltipGames = document.getElementById("tooltipGames");

        if (players) {
            players.textContent = data.onlinePlayers;
        }

        if (tooltipPlayers) {
            tooltipPlayers.textContent = data.onlinePlayers;
        }

        if (tooltipGames) {
            tooltipGames.textContent = data.activeGames;
        }

    } catch (error) {
        console.error("Live status error:", error);

        const players = document.getElementById("livePlayersCount");

        if (players) {
            players.textContent = "—";
        }
    }
}

// Prvo učitavanje
updateLiveStatus();

// Osvežavanje svakih 5 sekundi
setInterval(updateLiveStatus, 5000);



let highScore = localStorage.getItem("highScore") || 0;
let socket = null;
let currentGameId = null;
const GAME_SCALE = 1.5;
const GAME_WIDTH = 1200;
const GAME_HEIGHT = 555;

const S = (value) => value * GAME_SCALE;


/* ==========================================================:
BACKGROUND MANAGER
========================================================== */

class BackgroundManager {
    constructor(scene) {
        this.scene = scene;

        this.sky = scene.add.tileSprite(
            GAME_WIDTH / 2,
            300,
            GAME_WIDTH,
            600,
            "sky"
        );
        this.sky.setDepth(-25);

        // SUNCE
        this.sun = scene.add.graphics();
        this.sun.setDepth(-24);
        this.sun.fillStyle(0xffaa22, 1);
        this.sun.fillCircle(S(650), S(95), S(30));

        // OBLACI
        this.cloudsGraphics = scene.add.graphics().setDepth(-23);
        this.cloudX = S(-150);

        // ===============================
        // PTICE I AVION
        // ===============================

        this.birdsGraphics = scene.add.graphics();
        this.birdsGraphics.setDepth(-22);

        this.birds = [
            { x: S(120), y: S(120), size: 1 },
            { x: S(280), y: S(90), size: 0.7 },
            { x: S(520), y: S(135), size: 0.9 },
            { x: S(720), y: S(105), size: 0.6 }
        ];

        // AVION
        this.planeGraphics = scene.add.graphics();
        this.planeGraphics.setDepth(-22);

        this.plane = {
            x: S(900),
            y: S(75)
        };

        // ===============================
        // SLOJEVI
        // ===============================

        this.layer1 = scene.add.graphics().setDepth(-20);
        this.layer2 = scene.add.graphics().setDepth(-19);
        this.layer3 = scene.add.graphics().setDepth(-18);
        this.layer4 = scene.add.graphics().setDepth(-17);
        this.layer5 = scene.add.graphics().setDepth(-16);
        this.layer6 = scene.add.graphics().setDepth(-15);
        this.layer7 = scene.add.graphics().setDepth(-14);
        this.layer8 = scene.add.graphics().setDepth(-13);
        this.layer9 = scene.add.graphics().setDepth(-12);
        this.layer10 = scene.add.graphics().setDepth(-11);

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

        this.totalWidth = S(2200);

        this.buildingsL1 = this.generateBuildings(10, 18, 10, 25);
        this.buildingsL2 = this.generateBuildings(12, 20, 14, 32);
        this.buildingsL3 = this.generateBuildings(14, 22, 18, 40);
        this.buildingsL4 = this.generateBuildings(16, 25, 22, 48);
        this.buildingsL5 = this.generateBuildings(18, 28, 26, 56);
        this.buildingsL6 = this.generateBuildings(20, 31, 30, 65);
        this.buildingsL7 = this.generateBuildings(22, 34, 35, 75);
        this.buildingsL8 = this.generateBuildings(25, 38, 40, 85);
        this.buildingsL9 = this.generateBuildings(28, 42, 45, 95);
        this.buildingsL10 = this.generateBuildings(31, 46, 50, 105);
    }

    generateBuildings(minW, maxW, minH, maxH) {
        let arr = [];
        let x = 0;

        minW = S(minW);
        maxW = S(maxW);
        minH = S(minH);
        maxH = S(maxH);

        while (x < this.totalWidth) {
            let w = Phaser.Math.Between(minW, maxW);
            let h = Phaser.Math.Between(minH, maxH);

            arr.push({
                x,
                width: w,
                height: h,
                type: Phaser.Math.Between(0, 2)
            });

            x += w + Phaser.Math.Between(S(80), S(150));
        }

        return arr;
    }

    drawLayer(graphics, buildings, offset, color, alpha) {
        graphics.clear();
        graphics.fillStyle(color, alpha);

        let groundY = S(345);

        for (let b of buildings) {
            let x = b.x - offset;

            while (x < -b.width) {
                x += this.totalWidth;
            }

            graphics.fillRect(
                x,
                groundY - b.height,
                b.width,
                b.height
            );

            if (b.height > S(35) && b.width > S(15)) {
                graphics.fillStyle(0xffffff, 0.7);

                let windowSize = S(1.5);
                let gapX = S(4);
                let gapY = S(6);

                for (
                    let wx = x + S(3);
                    wx < x + b.width - S(3);
                    wx += gapX
                ) {
                    for (
                        let wy = groundY - b.height + S(5);
                        wy < groundY - S(6);
                        wy += gapY
                    ) {
                        if ((wx + wy) % S(5) !== 0) {
                            graphics.fillRect(
                                wx,
                                wy,
                                windowSize,
                                windowSize
                            );
                        }
                    }
                }

                graphics.fillStyle(color, alpha);
            }
        }
    }

    update(speed) {

        // SKY
        this.sky.tilePositionX += speed * 0.08 * GAME_SCALE;

        // ===============================
        // OBLACI
        // ===============================

        this.cloudX += speed * 0.015 * GAME_SCALE;

        if (this.cloudX > S(950)) {
            this.cloudX = S(-200);
        }

        this.cloudsGraphics.clear();
        this.cloudsGraphics.fillStyle(0xffffff, 1.0);

        let cx = this.cloudX;
        let cy = S(95);

        this.cloudsGraphics.fillCircle(cx, cy, S(28));
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

        // ===============================
        // PTICE
        // ===============================

        this.birdsGraphics.clear();
        this.birdsGraphics.lineStyle(
            S(2),
            0x111111,
            1
        );

        for (let bird of this.birds) {

            bird.x += speed * 0.025 * GAME_SCALE;

            if (bird.x > S(850)) {
                bird.x = S(-50);
            }

            let x = bird.x;
            let y = bird.y;
            let s = bird.size;

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

        // ===============================
        // AVION
        // ===============================

        this.planeGraphics.clear();

        this.plane.x -= speed * 0.015 * GAME_SCALE;

        if (this.plane.x < S(-100)) {
            this.plane.x = S(950);
            this.plane.y = Phaser.Math.Between(
                S(60),
                S(120)
            );
        }

        let px = this.plane.x;
        let py = this.plane.y;

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

        // ===============================
        // BUILDING LAYERS
        // ===============================

        let speeds = [
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

        let colors = [
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

        let layers = [
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

        let buildings = [
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

        for (let i = 0; i < 10; i++) {

            this.offsets["l" + (i + 1)] +=
                speed * speeds[i] * GAME_SCALE;

            if (
                this.offsets["l" + (i + 1)] >=
                this.totalWidth
            ) {
                this.offsets["l" + (i + 1)] = 0;
            }

            this.drawLayer(
                layers[i],
                buildings[i],
                this.offsets["l" + (i + 1)],
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
        this.globalKeyHandler = null;
    }

    restartGame() {

        this.gameOver = false;
        this.gameStarted = false;

        this.playerSprite.clearTint();
        this.playerSprite.rotation = 0;
        this.playerSprite.setScale(1.2);
        this.playerSprite.x = S(120);
        this.playerSprite.y = S(330);

        if (this.gameOverText) {
            this.gameOverText.destroy();
            this.gameOverText = null;
        }

        if (!this.startText) {

           this.startText = this.add.text(600, 150, "TAP OR SPACE TO START", {
    fontSize: "48px",
    fill: "#f3ba2f",
    fontStyle: "bold",
    stroke: "#000",
    strokeThickness: 6
}).setOrigin(0.5).setDepth(20);

        } else {

            this.startText.setText(
                "TAP OR SPACE TO START"
            );
        }
    }

    preload() {

        this.load.image(
            "bitcoin",
            "assets/bitcoin.png"
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

    create() {

        this.gameStarted = false;
        this.gameOver = false;

        this.score = 0;
        this.speed = 5;

        this.gameOverText = null;

        this.serverPlayerY = S(330);
        this.serverObstacles = [];

      this.ground = this.add.rectangle(600, 540, 1200, 60, 0x34a853).setDepth(5);

this.playerSprite = this.add.sprite(180, 495, "bitcoin")
    .setScale(1.2)
    .setDepth(10);

        this.obstacleSpritesMap = new Map();

        this.scoreText = this.add.text(30, 30, "Score: 0", {
    fontSize: "36px",
    fill: "#f3ba2f",
    fontStyle: "bold",
    stroke: "#000",
    strokeThickness: 4
}).setDepth(20);

this.bestText = this.add.text(30, 75, "Best: " + highScore, {
    fontSize: "30px",
    fill: "#ffffff",
    fontStyle: "bold",
    stroke: "#000",
    strokeThickness: 4
}).setDepth(20);

        // START TEXT
        this.startText = this.add.text(
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

        this.background = new BackgroundManager(this);

        window.resetGameOverScreen = () => {

            if (
                this &&
                typeof this.restartGame === "function"
            ) {
                this.restartGame();
            }
        };

       // ===============================
// SOCKET
// ===============================

if (!socket) {
            const backendUrl = window.location.origin;

            socket = io(backendUrl, {
                transports: ["websocket", "polling"],
                secure: true
            });

    socket.on(
        "game-started",
        (data) => {

            currentGameId = data.gameId;

            this.speed = data.speed;

            this.gameStarted = true;
            this.gameOver = false;

            if (this.startText) {
                this.startText.destroy();
            }
        }
    );

            socket.on(
                "state",
                (state) => {

                    if (
                        !this.gameStarted ||
                        this.gameOver
                    ) {
                        return;
                    }

                    this.score = state.score;
                    this.speed = state.speed;

                    this.scoreText.setText(
                        "Score: " + state.score
                    );

                    let playerGroundOffset = 15;

this.serverPlayerY =
    (state.player.y - playerGroundOffset) * GAME_SCALE;

this.serverObstacles = state.obstacles.map(obs => ({
    ...obs,
    x: obs.x * GAME_SCALE,
    y: obs.y * GAME_SCALE
}));
                }
            );

            socket.on(
                "game-over",
                (result) => {
                    this.onGameOver(result);
                }
            );

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

        // ===============================
        // JUMP
        // ===============================

        const handleJump = () => {
            if (this.gameOver) {
                this.scene.restart();
                return;
            }
            if (!this.gameStarted) {
                this.requestStart();
                return;
            }
            // Odmah pomerite igrača na ekranu
            if (this.playerSprite.y >= 465) {
                this.playerSprite.y -= 22.5;
                this.serverPlayerY = this.playerSprite.y; 
            }
            socket.emit("jump");
        };

        if (this.globalKeyHandler) {

            window.removeEventListener(
                "keydown",
                this.globalKeyHandler
            );
        }

        this.globalKeyHandler = (event) => {

            if (event.code === "Space") {

                event.preventDefault();

                handleJump();
            }
        };

        window.addEventListener(
            "keydown",
            this.globalKeyHandler
        );

        this.input.on(
            "pointerdown",
            () => {
                handleJump();
            }
        );
    }

    requestStart() {

        const wallet =
            localStorage.getItem("userWallet") ||
            "0xTestWallet1234567890abcdef";

        const signature =
            localStorage.getItem("userSignature") ||
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

    onGameOver(result) {

        if (this.gameOver) {
            return;
        }

        this.gameOver = true;
        this.gameStarted = false;

        if (
            this.serverObstacles &&
            this.serverObstacles.length > 0
        ) {

            let hitObstacle =
                this.serverObstacles.reduce(
                    (prev, curr) => {

                        return (
                            Math.abs(
                                curr.x -
                                this.playerSprite.x
                            ) <
                            Math.abs(
                                prev.x -
                                this.playerSprite.x
                            )
                        )
                            ? curr
                            : prev;
                    }
                );

            if (hitObstacle) {

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

        this.cameras.main.shake(
            400,
            0.025
        );

        this.tweens.add({

            targets: this.playerSprite,

            angle: 360,

            scaleX: 1.2,
            scaleY: 0.6,

            duration: 150,

            yoyo: true,

            onComplete: () => {

                this.playerSprite.setTint(
                    0xff0000
                );
            }
        });

        const finalScore =
            result.score || this.score;

        if (finalScore > highScore) {

            highScore = finalScore;

            localStorage.setItem(
                "highScore",
                highScore
            );

            this.bestText.setText(
                "Best: " + highScore
            );
        }

        this.time.delayedCall(
            300,
            () => {

                if (!this.gameOver) {
                    return;
                }

                this.gameOverText = this.add.text(600, 165, "GAME OVER\n\nTAP OR SPACE", {
    fontSize: "51px",
    fill: "#ff3333",
    align: "center",
    fontStyle: "bold",
    stroke: "#000",
    strokeThickness: 7
}).setOrigin(0.5).setDepth(30);
            }
        );

        if (result.success) {

            window.dispatchEvent(
                new Event("scoreSubmitted")
            );
        }
    }

   update(time, delta) {

        if (
            !this.gameStarted ||
            this.gameOver
        ) {
            return;
        }

        // DIREKTNO POSTAVLJANJE POZICIJE BEZ LAGA
        this.playerSprite.y = this.serverPlayerY;

        if (this.playerSprite.y < S(330)) {

            this.playerSprite.rotation += 0.12;

        } else {

            this.playerSprite.rotation = 0;
        }

        // ===============================
        // OBSTACLES
        // ===============================

        let activeIds = new Set(
            this.serverObstacles.map(
                obs => obs.id
            )
        );

        this.obstacleSpritesMap.forEach(
            (obj, id) => {

                if (!activeIds.has(id)) {

                    if (obj.sprite) {
                        obj.sprite.destroy();
                    }

                    if (obj.text) {
                        obj.text.destroy();
                    }

                    this.obstacleSpritesMap.delete(id);
                }
            }
        );

        this.serverObstacles.forEach(
            obs => {

                let key = "rugpull";
                let label = "";

                if (obs.type === "fud") {
                    key = "fud";
                }

                if (obs.type === "meteor") {
                    key = "rekt";
                    label = "REKT";
                }

                if (
                    obs.type === "liquidation"
                ) {
                    key = "liquidation";
                    label = "LIQUIDATED";
                }

                if (obs.type === "rug") {
                    label = "rugpull";
                }

                let obj =
                    this.obstacleSpritesMap.get(
                        obs.id
                    );

                if (!obj) {

                    const spr =
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

                    if (
                        obs.type === "meteor"
                    ) {
                        spr.setTint(
                            0xff0000
                        );
                    }

                    let txt = null;

                    if (label) {

                        txt =
                            this.add.text(
                                obs.x,
                                obs.y + S(15),
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
                        sprite: spr,
                        text: txt
                    };

                    this.obstacleSpritesMap.set(
                        obs.id,
                        obj
                    );
                }

                // DIREKTNO AŽURIRANJE BEZ INTERPOLACIJE
                obj.sprite.x = obs.x;
                obj.sprite.y = obs.y;

                if (obj.text) {

                    obj.text.x =
                        obj.sprite.x;

                    obj.text.y =
                        obj.sprite.y +
                        S(15);
                }
            }
        );

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

        type: Phaser.AUTO,

        render: {
            antialias: true,
            pixelArt: false,
            resolution: Math.min(
                window.devicePixelRatio || 1,
                2
            )
        },

        scale: {
            mode: Phaser.Scale.FIT,
            parent: "phaser-game",
            autoCenter: Phaser.Scale.CENTER_BOTH,

            width: 1200,
            height: 555
        },

        roundPixels: true,

        physics: {
            default: "arcade",
            arcade: {
                gravity: {
                    y: 0
                },
                debug: false
            }
        },

        scene: [GameScene]
    };

    new Phaser.Game(config);
}


// ==========================
// FULLSCREEN BUTTON
// ==========================

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

                if (!document.fullscreenElement) {

                    await gameContainer.requestFullscreen();

                } else {

                    await document.exitFullscreen();

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

            if (document.fullscreenElement) {

                fullscreenBtn.textContent =
                    "✕ EXIT";

            } else {

                fullscreenBtn.textContent =
                    "⛶ FULLSCREEN";
            }
        }
    );
}
