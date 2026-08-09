
/* ==========================================================
   GAMELOW.JS - OPTIMIZOVANO SA CLIENT-SIDE PREDICTION & MOBILE TOUCH
========================================================== */

let highScore = localStorage.getItem("highScore") || 0;
let socket = null;
let currentGameId = null;

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
        this.playerSprite.setScale(0.8);
        this.playerSprite.y = 330;

        if (this.gameOverText) {
            this.gameOverText.destroy();
            this.gameOverText = null;
        }

        if (!this.startText) {
            this.startText = this.add.text(400, 130, "TAP OR SPACE TO START", {
                fontSize: "32px", fill: "#f3ba2f", fontStyle: "bold",
                stroke: "#000", strokeThickness: 4
            }).setOrigin(0.5);
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

        this.serverPlayerY = 330;
        this.serverObstacles = [];

        this.ground = this.add.rectangle(400, 390, 800, 60, 0x2f7f20);

        this.playerSprite = this.add.sprite(120, 330, "bitcoin").setScale(0.8);
        this.obstacleSprites = [];

        this.scoreText = this.add.text(20, 20, "Score: 0", {
            fontSize: "24px", fill: "#f3ba2f", fontStyle: "bold",
            stroke: "#000", strokeThickness: 3
        });
        
        this.bestText = this.add.text(20, 50, "Best: " + highScore, {
            fontSize: "20px", fill: "#ffffff", fontStyle: "bold",
            stroke: "#000", strokeThickness: 3
        });

        this.startText = this.add.text(400, 130, "TAP OR SPACE TO START", {
            fontSize: "32px", fill: "#f3ba2f", fontStyle: "bold",
            stroke: "#000", strokeThickness: 4
        }).setOrigin(0.5);

        this.background = new BackgroundManager(this);

        window.resetGameOverScreen = () => {
            if (this && typeof this.restartGame === "function") {
                this.restartGame();
            }
        };

        // KONEKCIJA SA SERVEROM - PRILAGOĐENA ZA CLOUDFLARE TUNEL
        if (!socket) {
            const backendUrl = window.location.hostname === "localhost" ? "http://localhost:3000" : undefined;
            socket = io(backendUrl);

            socket.on("game-started", (data) => {
                currentGameId = data.gameId;
                this.speed = data.speed;
                this.gameStarted = true;
                this.gameOver = false;
                if (this.startText) this.startText.destroy();
            });

            socket.on("state", (state) => {
                if (!this.gameStarted || this.gameOver) return;
                this.score = state.score;
                this.speed = state.speed;
                this.scoreText.setText("Score: " + state.score);

                this.serverPlayerY = state.player.y;
                this.serverObstacles = state.obstacles;
            });

            socket.on("game-over", (result) => {
                this.onGameOver(result);
            });

            socket.on("error", (err) => {
                console.error("Server error:", err);
            });
        }

        // UNIFIKOVANA LOGIKA ZA START I SKOK (RADI I NA SPACE I NA DODIR EKRANA)
        const handleJump = () => {
            if (this.gameOver) {
                this.scene.restart();
                return;
            }
            if (!this.gameStarted) {
                this.requestStart();
                return;
            }

            if (this.playerSprite && this.playerSprite.y >= 320) {
                this.playerSprite.y -= 15; 
            }

            if (socket) {
                socket.emit("jump");
            }
        };

        // Slušanje Space tastera
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

        // Slušanje dodira na ekranu mobilnog / klik mišem
        this.input.on('pointerdown', () => {
            handleJump();
        });
    }

    requestStart() {
        const wallet = localStorage.getItem("userWallet") || "0xTestWallet1234567890abcdef";
        const signature = localStorage.getItem("userSignature") || "no_signature";

        if (this.startText) this.startText.setText("Connecting...");
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
                this.playerSprite.y = hitObstacle.y;
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
            
            this.gameOverText = this.add.text(400, 140, "GAME OVER\n\nTAP OR SPACE", {
                fontSize: "34px", 
                fill: "#ff3333", 
                align: "center", 
                fontStyle: "bold",
                stroke: "#000",
                strokeThickness: 5
            }).setOrigin(0.5);
        });

        if (result.success) {
            window.dispatchEvent(new Event("scoreSubmitted"));
        }
    }

    update(time, delta) {
        if (!this.gameStarted || this.gameOver) return;

        // 1. Glatko pomeranje igrača (povećano sa 0.35 na 0.6 da brže hvata korak)
        this.playerSprite.y = Phaser.Math.Linear(this.playerSprite.y, this.serverPlayerY, 0.6);

        if (this.playerSprite.y < 330) {
            this.playerSprite.rotation += 0.12;
        } else {
            this.playerSprite.rotation = Phaser.Math.Linear(this.playerSprite.rotation, 0, 0.2);
        }

        // Ako mapa prepreka ne postoji, napravi je
        if (!this.obstacleSpritesMap) {
            this.obstacleSpritesMap = new Map();
        }

        let activeIds = new Set(this.serverObstacles.map(obs => obs.id));

        // 2. Ukloni sa ekrana samo onu prepreku koja je prošla (nema više brisanja svega!)
        this.obstacleSpritesMap.forEach((obj, id) => {
            if (!activeIds.has(id)) {
                if (obj.sprite) obj.sprite.destroy();
                if (obj.text) obj.text.destroy();
                this.obstacleSpritesMap.delete(id);
            }
        });

        // 3. Kreiraj novu prepreku samo kad se pojavi, a postojeće glatko pomeraj
        this.serverObstacles.forEach(obs => {
            let key = "rugpull";
            let label = "";
            if (obs.type === "fud") key = "fud";
            if (obs.type === "meteor") { key = "rekt"; label = "REKT"; }
            if (obs.type === "liquidation") { key = "liquidation"; label = "LIQUIDATED"; }
            if (obs.type === "rug") label = "rugpull";

            let obj = this.obstacleSpritesMap.get(obs.id);

            // Ako prepreka već ne postoji na ekranu, napravi je jednom
            if (!obj) {
                const spr = this.add.sprite(obs.x, obs.type === "rug" ? obs.y + 10 : obs.y, key)
                    .setScale(obs.type === "fud" ? 0.7 : 0.8);
                if (obs.type === "meteor") spr.setTint(0xff0000);

                let txt = null;
                if (label) {
                    txt = this.add.text(obs.x, obs.y + 15, label, {
                        fontSize: "12px", fill: "#fff", fontStyle: "bold",
                        stroke: "#000", strokeThickness: 3
                    }).setOrigin(0.5);
                }

                obj = { sprite: spr, text: txt };
                this.obstacleSpritesMap.set(obs.id, obj);
            }

            // Glatko klizanje prepreke ka novoj poziciji sa servera
            obj.sprite.x = Phaser.Math.Linear(obj.sprite.x, obs.x, 0.6);
            obj.sprite.y = Phaser.Math.Linear(obj.sprite.y, (obs.type === "rug" ? obs.y + 10 : obs.y), 0.6);

            if (obj.text) {
                obj.text.x = obj.sprite.x;
                obj.text.y = obj.sprite.y + 15;
            }
        });

        this.background.update(this.speed);
    }
}

class BackgroundManager {
    constructor(scene) {
        this.scene = scene;
        this.sky = scene.add.tileSprite(400, 200, 800, 400, "sky");
        this.sky.setDepth(-25);
    }
    update(speed) {
        this.sky.tilePositionX += speed * 0.08;
    }
}

function startGame() {
    const config = {
        type: Phaser.AUTO,
        scale: {
            mode: Phaser.Scale.FIT,
            parent: 'game-container',
            autoCenter: Phaser.Scale.CENTER_BOTH,
            width: 800,
            height: 400
        },
        roundPixels: true,
        physics: {
            default: "arcade",
            arcade: { gravity: { y: 0 }, debug: false }
        },
        scene: [GameScene]
    };
    new Phaser.Game(config);
}
