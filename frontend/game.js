/* ==========================================================
GAME.JS - 1200x555 RESOLUTION (OPTIMIZED)
========================================================== */


// ==========================================
// LIVE STATUS BAR
// ==========================================

async function updateLiveStatus() {
    try {
        const backendUrl = window.location.hostname === "localhost"
            ? "http://localhost:3000"
            : "https://api.satoshiplays.com";

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

updateLiveStatus();
setInterval(updateLiveStatus, 5000);

let highScore = localStorage.getItem("highScore") || 0;
let socket = null;
let currentGameId = null;
const GAME_SCALE = 1.5;
const GAME_WIDTH = 1200;
const GAME_HEIGHT = 555;

const S = (value) => value * GAME_SCALE;


/* ==========================================================:
BACKGROUND MANAGER (OPTIMIZED)
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

        // SUNCE - Kreiramo jednom, nema potrebe da se ponovo iscrtava
        this.sun = scene.add.graphics();
        this.sun.setDepth(-24);
        this.sun.fillStyle(0xffaa22, 1);
        this.sun.fillCircle(S(650), S(95), S(30));

        // OBLACI - Kreiramo jednom kao RenderTexture ili statičnu grafiku pa pomeramo X
        this.cloudX = S(-150);
        this.cloudsGraphics = scene.add.graphics().setDepth(-23);
        this.drawStaticClouds();

        // PTICE
        this.birdsGraphics = scene.add.graphics().setDepth(-22);
        this.birds = [
            { x: S(120), y: S(120), size: 1 },
            { x: S(280), y: S(90), size: 0.7 },
            { x: S(520), y: S(135), size: 0.9 },
            { x: S(720), y: S(105), size: 0.6 }
        ];

        // AVION
        this.planeGraphics = scene.add.graphics().setDepth(-22);
        this.plane = {
            x: S(900),
            y: S(75)
        };

        // ===============================
        // SLOJEVI ZGRADA (Optimizovano preko RenderTexture)
        // ===============================
        this.totalWidth = S(2200);
        this.offsets = { l1:0, l2:0, l3:0, l4:0, l5:0, l6:0, l7:0, l8:0, l9:0, l10:0 };

        const colors = [
            0x0b0b14, 0x0f0f1c, 0x131324, 0x17172c, 0x1b1b36,
            0x1f1f40, 0x24244a, 0x292955, 0x2e2e60, 0x34346b
        ];

        this.layerImages = [];
        for (let i = 1; i <= 10; i++) {
            let bList = this.generateBuildings(10 + i*1.8, 18 + i*2, 10 + i*4, 25 + i*8);
            let rTex = this.createBuildingTexture(bList, colors[i-1]);
            
            // Kreiramo TileSprite za svaki sloj zgrada umesto ručnog clear/draw u frejmu!
            let tileSprite = scene.add.tileSprite(GAME_WIDTH / 2, S(345) - S(50), this.totalWidth, S(150), 'layer_' + i);
            // Ako nemamo teksturu u loaderu, generisaćemo je dinamički preko scene.textures
            tileSprite.setDepth(-20 + (i * 0.5));
            this.layerImages.push({ tile: tileSprite, bList });
        }
    }

    createBuildingTexture(buildings, color) {
        // Generišemo teksturu jednom u memoriji da bi radilo fluidno
        const canvas = document.createElement('canvas');
        canvas.width = this.totalWidth;
        canvas.height = S(200);
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
        let groundY = S(180);

        for (let b of buildings) {
            ctx.fillRect(b.x, groundY - b.height, b.width, b.height);

            if (b.height > S(35) && b.width > S(15)) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
                let windowSize = S(1.5);
                let gapX = S(4);
                let gapY = S(6);

                for (let wx = b.x + S(3); wx < b.x + b.width - S(3); wx += gapX) {
                    for (let wy = groundY - b.height + S(5); wy < groundY - S(6); wy += gapY) {
                        if ((wx + wy) % S(5) !== 0) {
                            ctx.fillRect(wx, wy, windowSize, windowSize);
                        }
                    }
                }
                ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
            }
        }
        
        let textureKey = 'b_tex_' + Math.random();
        this.scene.textures.addCanvas(textureKey, canvas);
        return textureKey;
    }

    generateBuildings(minW, maxW, minH, maxH) {
        let arr = [];
        let x = 0;
        minW = S(minW); maxW = S(maxW); minH = S(minH); maxH = S(maxH);

        while (x < this.totalWidth) {
            let w = Phaser.Math.Between(minW, maxW);
            let h = Phaser.Math.Between(minH, maxH);
            arr.push({ x, width: w, height: h });
            x += w + Phaser.Math.Between(S(80), S(150));
        }
        return arr;
    }

    drawStaticClouds() {
        this.cloudsGraphics.clear();
        this.cloudsGraphics.fillStyle(0xffffff, 1.0);
        let cx = 0;
        let cy = S(95);
        this.cloudsGraphics.fillCircle(cx, cy, S(28));
        this.cloudsGraphics.fillCircle(cx + S(25), cy - S(12), S(35));
        this.cloudsGraphics.fillCircle(cx + S(52), cy, S(25));
        this.cloudsGraphics.fillRect(cx - S(10), cy, S(80), S(25));
    }

    update(speed) {
        // SKY
        this.sky.tilePositionX += speed * 0.08 * GAME_SCALE;

        // OBLACI (Pomeramo poziciju grafike umesto brisanja)
        this.cloudX += speed * 0.015 * GAME_SCALE;
        if (this.cloudX > GAME_WIDTH + S(200)) {
            this.cloudX = S(-200);
        }
        this.cloudsGraphics.x = this.cloudX;

        // PTICE
        this.birdsGraphics.clear();
        this.birdsGraphics.lineStyle(S(2), 0x111111, 1);

        for (let bird of this.birds) {
            bird.x += speed * 0.025 * GAME_SCALE;
            if (bird.x > S(850)) bird.x = S(-50);

            let x = bird.x, y = bird.y, s = bird.size;
            this.birdsGraphics.beginPath();
            this.birdsGraphics.moveTo(x - S(12) * s, y);
            this.birdsGraphics.lineTo(x - S(5) * s, y - S(7) * s);
            this.birdsGraphics.lineTo(x, y);
            this.birdsGraphics.strokePath();

            this.birdsGraphics.beginPath();
            this.birdsGraphics.moveTo(x, y);
            this.birdsGraphics.lineTo(x + S(5) * s, y - S(7) * s);
            this.birdsGraphics.lineTo(x + S(12) * s, y);
            this.birdsGraphics.strokePath();
        }

        // AVION
        this.planeGraphics.clear();
        this.plane.x -= speed * 0.015 * GAME_SCALE;
        if (this.plane.x < S(-100)) {
            this.plane.x = S(950);
            this.plane.y = Phaser.Math.Between(S(60), S(120));
        }

        let px = this.plane.x, py = this.plane.y;
        this.planeGraphics.fillStyle(0x222222, 0.8);
        this.planeGraphics.fillRect(px, py, S(35), S(3));
        this.planeGraphics.fillTriangle(px + S(10), py, px + S(25), py - S(8), px + S(28), py);
        this.planeGraphics.fillTriangle(px + S(10), py + S(3), px + S(25), py + S(10), px + S(28), py + S(3));
        this.planeGraphics.fillRect(px, py - S(4), S(8), S(8));

        // ZGRADE - Optimizovano pomeranje preko tilePositionX (nema clear() u frejmu!)
        let speeds = [0.0025, 0.005, 0.01, 0.0175, 0.025, 0.035, 0.0475, 0.065, 0.085, 0.11];
        for (let i = 0; i < 10; i++) {
            this.offsets["l" + (i + 1)] += speed * speeds[i] * GAME_SCALE;
            // Umesto teških grafika, koristimo ugrađeni tilePosition koji radi na GPU nivou
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
                fontSize: "48px", fill: "#f3ba2f", fontStyle: "bold", stroke: "#000", strokeThickness: 6
            }).setOrigin(0.5).setDepth(20);
        } else {
            this.startText.setText("TAP OR SPACE TO START");
        }
    }

    preload() {
        this.load.image("bitcoin", "assets/bitcoin.png");
        this.load.image("fud", "assets/fud.png");
        this.load.image("rugpull", "assets/rugpull.png");
        this.load.image("sky", "assets/sky.png");
        this.load.image("rekt", "assets/rekt.png");
        this.load.image("liquidation", "assets/liquidation.png");
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
        this.playerSprite = this.add.sprite(180, 495, "bitcoin").setScale(1.2).setDepth(10);
        this.obstacleSpritesMap = new Map();

        this.scoreText = this.add.text(30, 30, "Score: 0", {
            fontSize: "36px", fill: "#f3ba2f", fontStyle: "bold", stroke: "#000", strokeThickness: 4
        }).setDepth(20);

        this.bestText = this.add.text(30, 75, "Best: " + highScore, {
            fontSize: "30px", fill: "#ffffff", fontStyle: "bold", stroke: "#000", strokeThickness: 4
        }).setDepth(20);

        this.startText = this.add.text(
            GAME_WIDTH / 2, S(100), "TAP OR SPACE TO START",
            { fontSize: "48px", fill: "#f3ba2f", fontStyle: "bold", stroke: "#000", strokeThickness: 4 }
        ).setOrigin(0.5).setDepth(20);

        this.background = new BackgroundManager(this);

        window.resetGameOverScreen = () => {
            if (this && typeof this.restartGame === "function") {
                this.restartGame();
            }
        };

        if (!socket) {
            const backendUrl = window.location.hostname === "localhost"
                ? "http://localhost:3000"
                : "https://api.satoshiplays.com";

            socket = io(backendUrl, {
                transports: ["websocket", "polling"],
                secure: false
            });

            socket.on("game-started", (data) => {
                currentGameId = data.gameId;
                this.speed = data.speed;
                this.gameStarted = true;
                this.gameOver = false;
                if (this.startText) {
                    this.startText.destroy();
                }
            });

            socket.on("state", (state) => {
                if (!this.gameStarted || this.gameOver) return;

                this.score = state.score;
                this.speed = state.speed;
                this.scoreText.setText("Score: " + state.score);

                let playerGroundOffset = 15;
                this.serverPlayerY = (state.player.y - playerGroundOffset) * GAME_SCALE;
                this.serverObstacles = state.obstacles.map(obs => ({
                    ...obs,
                    x: obs.x * GAME_SCALE,
                    y: obs.y * GAME_SCALE
                }));
            });

            socket.on("game-over", (result) => {
                this.onGameOver(result);
            });

            socket.on("error", (err) => {
                console.error("Server error:", err);
            });
        }

        const handleJump = () => {
            if (this.gameOver) {
                this.scene.restart();
                return;
            }
            if (!this.gameStarted) {
                this.requestStart();
                return;
            }
            if (this.playerSprite.y >= 465) {
                this.playerSprite.y -= 22.5;
            }
            socket.emit("jump");
        };

        if (this.globalKeyHandler) {
            window.removeEventListener("keydown", this.globalKeyHandler);
        }

        this.globalKeyHandler = (event) => {
            if (event.code === "Space") {
                event.preventDefault();
                handleJump();
            }
        };

        window.addEventListener("keydown", this.globalKeyHandler);
        this.input.on("pointerdown", () => { handleJump(); });
    }

    requestStart() {
        const wallet = localStorage.getItem("userWallet") || "0xTestWallet1234567890abcdef";
        const signature = localStorage.getItem("userSignature") || "no_signature";

        if (this.startText) {
            this.startText.setText("Connecting...");
        }

        socket.emit("start-game", { wallet, signature });
    }

    onGameOver(result) {
        if (this.gameOver) return;
        this.gameOver = true;
        this.gameStarted = false;

        if (this.serverObstacles && this.serverObstacles.length > 0) {
            let hitObstacle = this.serverObstacles.reduce((prev, curr) => {
                return (Math.abs(curr.x - this.playerSprite.x) < Math.abs(prev.x - this.playerSprite.x)) ? curr : prev;
            });

            if (hitObstacle) {
                this.playerSprite.x = (this.playerSprite.x + hitObstacle.x) / 2;
                this.playerSprite.y = hitObstacle.y - S(15);
            }
        }

        this.cameras.main.shake(400, 0.025);

        this.tweens.add({
            targets: this.playerSprite,
            angle: 360,
            scaleX: 1.2,
            scaleY: 0.6,
            duration: 150,
            yoyo: true,
            onComplete: () => {
                this.playerSprite.setTint(0xff0000);
            }
        });

        const finalScore = result.score || this.score;
        if (finalScore > highScore) {
            highScore = finalScore;
            localStorage.setItem("highScore", highScore);
            this.bestText.setText("Best: " + highScore);
        }

        this.time.delayedCall(300, () => {
            if (!this.gameOver) return;
            this.gameOverText = this.add.text(600, 165, "GAME OVER\n\nTAP OR SPACE", {
                fontSize: "51px", fill: "#ff3333", align: "center", fontStyle: "bold", stroke: "#000", strokeThickness: 7
            }).setOrigin(0.5).setDepth(30);
        });

        if (result.success) {
            window.dispatchEvent(new Event("scoreSubmitted"));
        }
    }

    update(time, delta) {
        if (!this.gameStarted || this.gameOver) return;

        this.playerSprite.y = this.serverPlayerY;

        if (this.playerSprite.y < S(330)) {
            this.playerSprite.rotation += 0.12;
        } else {
            this.playerSprite.rotation = Phaser.Math.Linear(this.playerSprite.rotation, 0, 0.2);
        }

        let activeIds = new Set(this.serverObstacles.map(obs => obs.id));

        this.obstacleSpritesMap.forEach((obj, id) => {
            if (!activeIds.has(id)) {
                if (obj.sprite) obj.sprite.destroy();
                if (obj.text) obj.text.destroy();
                this.obstacleSpritesMap.delete(id);
            }
        });

        this.serverObstacles.forEach(obs => {
            let key = "rugpull";
            let label = "";

            if (obs.type === "fud") key = "fud";
            if (obs.type === "meteor") { key = "rekt"; label = "REKT"; }
            if (obs.type === "liquidation") { key = "liquidation"; label = "LIQUIDATED"; }
            if (obs.type === "rug") { label = "rugpull"; }

            let obj = this.obstacleSpritesMap.get(obs.id);

            if (!obj) {
                const spr = this.add.sprite(obs.x, obs.y, key)
                    .setScale(obs.type === "fud" ? 1.05 : 1.2)
                    .setDepth(8);

                if (obs.type === "meteor") {
                    spr.setTint(0xff0000);
                }

                let txt = null;
                if (label) {
                    txt = this.add.text(obs.x, obs.y + S(15), label, {
                        fontSize: "18px", fill: "#fff", fontStyle: "bold", stroke: "#000", strokeThickness: 3
                    }).setOrigin(0.5).setDepth(9);
                }

                obj = { sprite: spr, text: txt };
                this.obstacleSpritesMap.set(obs.id, obj);
            }

            obj.sprite.x = obs.x;
            obj.sprite.y = obs.y;

            if (obj.text) {
                obj.text.x = obj.sprite.x;
                obj.text.y = obj.sprite.y + S(15);
            }
        });

        this.background.update(this.speed);
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
            resolution: Math.min(window.devicePixelRatio || 1, 2)
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
                gravity: { y: 0 },
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

const fullscreenBtn = document.getElementById("fullscreenBtn");

if (fullscreenBtn) {
    fullscreenBtn.addEventListener("click", async () => {
        const gameContainer = document.getElementById("game-container");
        try {
            if (!document.fullscreenElement) {
                await gameContainer.requestFullscreen();
            } else {
                await document.exitFullscreen();
            }
        } catch (error) {
            console.error("Fullscreen error:", error);
        }
    });

    document.addEventListener("fullscreenchange", () => {
        if (document.fullscreenElement) {
            fullscreenBtn.textContent = "✕ EXIT";
        } else {
            fullscreenBtn.textContent = "⛶ FULLSCREEN";
        }
    });
}
