/* ==========================================================
   GAME.JS - LOKALNA FIZIKA, PREPREKE I SKOK (BEZ LAGA)
========================================================== */

let highScore = localStorage.getItem("highScore") || 0;
let socket = null;
let currentGameId = null;

class BackgroundManager {
    constructor(scene) {
        this.scene = scene;
        this.sky = scene.add.tileSprite(400, 200, 800, 400, "sky").setDepth(-25);
        this.sun = scene.add.graphics().setDepth(-24);
        this.sun.fillStyle(0xffaa22, 1);
        this.sun.fillCircle(650, 95, 30);

        this.cloudsGraphics = scene.add.graphics().setDepth(-23);
        this.cloudX = -150;

        this.birdsGraphics = scene.add.graphics().setDepth(-22);
        this.birds = [
            {x:120, y:120, size:1},
            {x:280, y:90, size:0.7},
            {x:520, y:135, size:0.9},
            {x:720, y:105, size:0.6}
        ];

        this.planeGraphics = scene.add.graphics().setDepth(-22);
        this.plane = { x:900, y:75 };

        this.layers = [];
        this.buildingsLayers = [];
        this.totalWidth = 2200;
        this.offsets = new Array(10).fill(0);

        for (let i = 0; i < 10; i++) {
            let g = scene.add.graphics().setDepth(-20 + i);
            this.layers.push(g);
            this.buildingsLayers.push(this.generateBuildings(10 + i * 2, 18 + i * 2, 10 + i * 4, 25 + i * 8));
        }
    }

    generateBuildings(minW, maxW, minH, maxH) {
        let arr = [];
        let x = 0;
        while(x < this.totalWidth) {
            let w = Phaser.Math.Between(minW, maxW);
            let h = Phaser.Math.Between(minH, maxH);
            arr.push({ x, width: w, height: h });
            x += w + Phaser.Math.Between(80, 150);
        }
        return arr;
    }

    update(speed) {
        this.sky.tilePositionX += speed * 0.08;
        this.cloudX += speed * 0.015;
        if (this.cloudX > 950) this.cloudX = -200;

        this.cloudsGraphics.clear();
        this.cloudsGraphics.fillStyle(0xffffff, 1.0);
        this.cloudsGraphics.fillCircle(this.cloudX, 95, 28);
        this.cloudsGraphics.fillCircle(this.cloudX + 25, 83, 35);
        this.cloudsGraphics.fillCircle(this.cloudX + 52, 95, 25);
        this.cloudsGraphics.fillRect(this.cloudX - 10, 95, 80, 25);

        this.birdsGraphics.clear();
        this.birdsGraphics.lineStyle(2, 0x111111, 1);
        for(let bird of this.birds){
            bird.x += speed * 0.025;
            if(bird.x > 850) bird.x = -50;
            let x = bird.x, y = bird.y, s = bird.size;
            this.birdsGraphics.beginPath();
            this.birdsGraphics.moveTo(x - 12*s, y);
            this.birdsGraphics.lineTo(x - 5*s, y - 7*s);
            this.birdsGraphics.lineTo(x, y);
            this.birdsGraphics.strokePath();
            this.birdsGraphics.beginPath();
            this.birdsGraphics.moveTo(x, y);
            this.birdsGraphics.lineTo(x + 5*s, y - 7*s);
            this.birdsGraphics.lineTo(x + 12*s, y);
            this.birdsGraphics.strokePath();
        }

        this.planeGraphics.clear();
        this.plane.x -= speed * 0.015;
        if(this.plane.x < -100) {
            this.plane.x = 950;
            this.plane.y = Phaser.Math.Between(60, 120);
        }
        this.planeGraphics.fillStyle(0x222222, 0.8);
        this.planeGraphics.fillRect(this.plane.x, this.plane.y, 35, 3);

        let speeds = [0.0025, 0.005, 0.01, 0.0175, 0.025, 0.035, 0.0475, 0.065, 0.085, 0.11];
        let colors = [
            0x0b0b14, 0x0f0f1c, 0x131324, 0x17172c, 0x1b1b36,
            0x1f1f40, 0x24244a, 0x292955, 0x2e2e60, 0x34346b
        ];

        for(let i = 0; i < 10; i++) {
            this.offsets[i] += speed * speeds[i];
            if(this.offsets[i] >= this.totalWidth) this.offsets[i] = 0;

            let graphics = this.layers[i];
            graphics.clear();
            graphics.fillStyle(colors[i], 0.95);
            let groundY = 345;

            for(let b of this.buildingsLayers[i]) {
                let x = b.x - this.offsets[i];
                while(x < -b.width) x += this.totalWidth;
                graphics.fillRect(x, groundY - b.height, b.width, b.height);
            }
        }
    }
}

class GameScene extends Phaser.Scene {
    constructor() {
        super("GameScene");
        this.globalKeyHandler = null;
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
        this.isJumping = false;
        this.score = 0;
        this.speed = 6;
        this.gameOverText = null;

        this.ground = this.add.rectangle(400, 360, 800, 40, 0x34a853).setDepth(5);
        this.playerSprite = this.add.sprite(120, 330, "bitcoin").setScale(0.8).setDepth(10);
        
        this.localObstacles = [];
        this.obstacleSpritesMap = new Map();
        this.obstacleCounter = 0;
        this.spawnTimer = 0;

        this.scoreText = this.add.text(20, 20, "Score: 0", {
            fontSize: "24px", fill: "#f3ba2f", fontStyle: "bold", stroke: "#000", strokeThickness: 3
        }).setDepth(20);
        
        this.bestText = this.add.text(20, 50, "Best: " + highScore, {
            fontSize: "20px", fill: "#ffffff", fontStyle: "bold", stroke: "#000", strokeThickness: 3
        }).setDepth(20);

        this.startText = this.add.text(400, 100, "TAP OR SPACE TO START", {
            fontSize: "32px", fill: "#f3ba2f", fontStyle: "bold", stroke: "#000", strokeThickness: 4
        }).setOrigin(0.5).setDepth(20);

        this.background = new BackgroundManager(this);

        if (!socket) {
           const backendUrl = window.location.hostname === "localhost" ? "http://localhost:3000" : "https://satoshi-plays.onrender.com";
           socket = io(backendUrl);

            socket.on("game-started", (data) => {
                currentGameId = data.gameId;
                this.gameStarted = true;
                this.gameOver = false;
                if (this.startText) this.startText.destroy();
            });

            socket.on("game-over", (result) => {
                this.onGameOver(result);
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

            if (!this.isJumping && this.playerSprite.y >= 315) {
                this.isJumping = true;
                this.tweens.add({
                    targets: this.playerSprite,
                    y: 210,
                    duration: 210,
                    yoyo: true,
                    ease: 'Quad.easeInOut',
                    onComplete: () => {
                        this.isJumping = false;
                        this.playerSprite.y = 330;
                    }
                });
                socket.emit("jump");
            }
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

        this.cameras.main.shake(400, 0.025);
        this.playerSprite.setTint(0xff0000);

        const finalScore = result.score || Math.floor(this.score);
        if (finalScore > highScore) {
            highScore = finalScore;
            localStorage.setItem("highScore", highScore);
            this.bestText.setText("Best: " + highScore);
        }

        this.time.delayedCall(300, () => {
            if (!this.gameOver) return;
            this.gameOverText = this.add.text(400, 110, "GAME OVER\n\nTAP OR SPACE", {
                fontSize: "34px", fill: "#ff3333", align: "center", fontStyle: "bold", stroke: "#000", strokeThickness: 5
            }).setOrigin(0.5).setDepth(30);
        });
    }

    update(time, delta) {
        if (!this.gameStarted || this.gameOver) return;

        this.score += 0.05;
        this.speed = Math.min(6 + (this.score * 0.005), 12);
        this.scoreText.setText("Score: " + Math.floor(this.score));

        this.spawnTimer++;
        if (this.spawnTimer > 90 && (this.localObstacles.length === 0 || this.localObstacles[this.localObstacles.length - 1].x < 500)) {
            this.spawnTimer = 0;
            let types = ["rug", "fud", "liquidation"];
            let chosenType = types[Phaser.Math.Between(0, types.length - 1)];
            let obsY = (chosenType === "fud") ? 240 : 335;

            this.localObstacles.push({
                id: this.obstacleCounter++,
                x: 850,
                y: obsY,
                w: 40,
                h: 40,
                type: chosenType
            });
        }

        for (let i = this.localObstacles.length - 1; i >= 0; i--) {
            let obs = this.localObstacles[i];
            obs.x -= this.speed;

            let playerBox = { x: this.playerSprite.x - 15, y: this.playerSprite.y - 15, w: 30, h: 30 };
            let obsBox = { x: obs.x - 20, y: obs.y - 20, w: obs.w, h: obs.h };

            if (playerBox.x < obsBox.x + obsBox.w && playerBox.x + playerBox.w > obsBox.x &&
                playerBox.y < obsBox.y + obsBox.h && playerBox.y + playerBox.h > obsBox.y) {
                
                socket.emit("player-died", { score: Math.floor(this.score) });
                this.onGameOver({ score: Math.floor(this.score) });
            }

            if (obs.x < -60) {
                this.localObstacles.splice(i, 1);
            }
        }

        let activeIds = new Set(this.localObstacles.map(obs => obs.id));
        this.obstacleSpritesMap.forEach((obj, id) => {
            if (!activeIds.has(id)) {
                if (obj.sprite) obj.sprite.destroy();
                if (obj.text) obj.text.destroy();
                this.obstacleSpritesMap.delete(id);
            }
        });

        this.localObstacles.forEach(obs => {
            let key = "rugpull";
            let label = "";
            if (obs.type === "fud") key = "fud";
            if (obs.type === "liquidation") { key = "liquidation"; label = "LIQ"; }
            if (obs.type === "rug") label = "rug";

            let obj = this.obstacleSpritesMap.get(obs.id);
            if (!obj) {
                const spr = this.add.sprite(obs.x, obs.y, key).setScale(0.8).setDepth(8);
                let txt = null;
                if (label) {
                    txt = this.add.text(obs.x, obs.y + 15, label, {
                        fontSize: "12px", fill: "#fff", fontStyle: "bold", stroke: "#000", strokeThickness: 3
                    }).setOrigin(0.5).setDepth(9);
                }
                obj = { sprite: spr, text: txt };
                this.obstacleSpritesMap.set(obs.id, obj);
            }

            obj.sprite.x = obs.x;
            obj.sprite.y = obs.y;
            if (obj.text) {
                obj.text.x = obs.x;
                obj.text.y = obs.y + 15;
            }
        });

        if (this.playerSprite.y < 330) {
            this.playerSprite.rotation += 0.12;
        } else {
            this.playerSprite.rotation = 0;
        }

        this.background.update(this.speed);
    }
}

function startGame() {
    const config = {
        type: Phaser.AUTO,
        parent: "game-container",
        width: 800,
        height: 370,
        scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH,
            width: 800,
            height: 370
        },
        roundPixels: true,
        physics: { default: "arcade", arcade: { gravity: { y: 0 }, debug: false } },
        scene: [GameScene]
    };
    new Phaser.Game(config);
}
