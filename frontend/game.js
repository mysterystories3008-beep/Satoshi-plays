/* ==========================================================
   GAME.JS - SUNCE KOJE IDE IZA OBLAKA
========================================================== */

let highScore = localStorage.getItem("highScore") || 0;
let socket = null;
let currentGameId = null;

/* ==========================================================
   BACKGROUND MANAGER
========================================================== */

class BackgroundManager {
    constructor(scene) {
        this.scene = scene;

        this.sky = scene.add.tileSprite(400, 200, 800, 400, "sky");
        this.sky.setDepth(-25);

        // Sunce je na dubini -24
        this.sun = scene.add.graphics();
        this.sun.setDepth(-24);
        this.sun.fillStyle(0xffaa22, 1);
        this.sun.fillCircle(650, 95, 30);

        // Oblaci su na dubini -23 (ISPRED sunca, pa ga potpuno sakrivaju kad pređu preko njega)
        this.cloudsGraphics = scene.add.graphics().setDepth(-23);
        this.cloudX = -150; // Početna pozicija oblaka


        // ===============================
// PTICE I AVION U DALJINI
// ===============================

this.birdsGraphics = scene.add.graphics();
this.birdsGraphics.setDepth(-22);

this.birds = [
    {x:120, y:120, size:1},
    {x:280, y:90, size:0.7},
    {x:520, y:135, size:0.9},
    {x:720, y:105, size:0.6}
];


// avion
this.planeGraphics = scene.add.graphics();
this.planeGraphics.setDepth(-22);

this.plane = {
    x:900,
    y:75
};


        // Slojevi smešteni duboko u pozadini (iza sunca i oblaka)
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
            l1:0, l2:0, l3:0, l4:0, l5:0,
            l6:0, l7:0, l8:0, l9:0, l10:0
        };

        this.totalWidth = 2200;

        // SMANJENE I NIŽE ZGRADE: Prilagođene dimenzije (manja širina i manja visina)
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

        while(x < this.totalWidth) {
            let w = Phaser.Math.Between(minW, maxW);
            let h = Phaser.Math.Between(minH, maxH);
            arr.push({ x, width: w, height: h, type: Phaser.Math.Between(0, 2) });
            x += w + Phaser.Math.Between(80, 150);
        }
        return arr;
    }

    drawLayer(graphics, buildings, offset, color, alpha) {
        graphics.clear();
        graphics.fillStyle(color, alpha);
        let groundY = 345;

        for(let b of buildings) {
            let x = b.x - offset;
            while(x < -b.width) x += this.totalWidth;
            
            // Crtamo nižu zgradu
            graphics.fillRect(x, groundY - b.height, b.width, b.height);

            // Belo svetlo prozora prilagođeno manjim dimenzijama
            if (b.height > 35 && b.width > 15) {
                graphics.fillStyle(0xffffff, 0.7);
                let windowSize = 1.5;
                let gapX = 4;
                let gapY = 6;

                for(let wx = x + 3; wx < x + b.width - 3; wx += gapX) {
                    for(let wy = (groundY - b.height) + 5; wy < groundY - 6; wy += gapY) {
                        if ((wx + wy) % 5 !== 0) {
                            graphics.fillRect(wx, wy, windowSize, windowSize);
                        }
                    }
                }
                graphics.fillStyle(color, alpha);
            }
        }
    }

    update(speed) {
        this.sky.tilePositionX += speed * 0.08;

        // Pomeranje oblaka preko ekrana
        this.cloudX += speed * 0.015;
        if (this.cloudX > 950) {
            this.cloudX = -200; // Vraća se na početak kad prođe ekran
        }

        // Crtanje potpuno neprozirnog belog oblaka koji prelazi preko Sunca
        this.cloudsGraphics.clear();
        this.cloudsGraphics.fillStyle(0xffffff, 1.0); // Alfa je 1.0 (neprozirno) da sakrije sunce
        
        let cx = this.cloudX;
        let cy = 95;
        this.cloudsGraphics.fillCircle(cx, cy, 28);
        this.cloudsGraphics.fillCircle(cx + 25, cy - 12, 35);
        this.cloudsGraphics.fillCircle(cx + 52, cy, 25);
        this.cloudsGraphics.fillRect(cx - 10, cy, 80, 25);


// ===============================
// CRTANJE PTICA
// ===============================

this.birdsGraphics.clear();

this.birdsGraphics.lineStyle(2, 0x111111, 1);

for(let bird of this.birds){

    bird.x += speed * 0.025;

    if(bird.x > 850){
        bird.x = -50;
    }

    let x = bird.x;
    let y = bird.y;
    let s = bird.size;


    // levo krilo
    this.birdsGraphics.beginPath();
    this.birdsGraphics.moveTo(x - 12*s, y);
    this.birdsGraphics.lineTo(x - 5*s, y - 7*s);
    this.birdsGraphics.lineTo(x, y);
    this.birdsGraphics.strokePath();


    // desno krilo
    this.birdsGraphics.beginPath();
    this.birdsGraphics.moveTo(x, y);
    this.birdsGraphics.lineTo(x + 5*s, y - 7*s);
    this.birdsGraphics.lineTo(x + 12*s, y);
    this.birdsGraphics.strokePath();

}



// ===============================
// AVION U DALJINI
// ===============================

this.planeGraphics.clear();

this.plane.x -= speed * 0.015;

if(this.plane.x < -100){
    this.plane.x = 950;
    this.plane.y = Phaser.Math.Between(60,120);
}


let px = this.plane.x;
let py = this.plane.y;


// telo aviona
this.planeGraphics.fillStyle(0x222222,0.8);
this.planeGraphics.fillRect(px,py,35,3);


// krila
this.planeGraphics.fillTriangle(
    px+10, py,
    px+25, py-8,
    px+28, py
);

this.planeGraphics.fillTriangle(
    px+10, py+3,
    px+25, py+10,
    px+28, py+3
);


// rep
this.planeGraphics.fillRect(px,py-4,8,8);



        let speeds = [0.0025, 0.005, 0.01, 0.0175, 0.025, 0.035, 0.0475, 0.065, 0.085, 0.11];
        let colors = [
            0x0b0b14, 0x0f0f1c, 0x131324, 0x17172c, 0x1b1b36,
            0x1f1f40, 0x24244a, 0x292955, 0x2e2e60, 0x34346b
        ];

        let layers = [
            this.layer1, this.layer2, this.layer3, this.layer4, this.layer5,
            this.layer6, this.layer7, this.layer8, this.layer9, this.layer10
        ];
        let buildings = [
            this.buildingsL1, this.buildingsL2, this.buildingsL3, this.buildingsL4, this.buildingsL5,
            this.buildingsL6, this.buildingsL7, this.buildingsL8, this.buildingsL9, this.buildingsL10
        ];

        for(let i = 0; i < 10; i++) {
            this.offsets["l" + (i + 1)] += speed * speeds[i];
            if(this.offsets["l" + (i + 1)] >= this.totalWidth) {
                this.offsets["l" + (i + 1)] = 0;
            }
            this.drawLayer(layers[i], buildings[i], this.offsets["l" + (i + 1)], colors[i], 0.95);
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
        this.playerSprite.setScale(0.8);
        this.playerSprite.y = 330;

        if (this.gameOverText) {
            this.gameOverText.destroy();
            this.gameOverText = null;
        }

        if (!this.startText) {
            this.startText = this.add.text(400, 100, "TAP OR SPACE TO START", {
                fontSize: "32px", fill: "#f3ba2f", fontStyle: "bold",
                stroke: "#000", strokeThickness: 4
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

        this.serverPlayerY = 330;
        this.serverObstacles = [];

        this.ground = this.add.rectangle(400, 360, 800, 40, 0x34a853).setDepth(5);
        this.playerSprite = this.add.sprite(120, 330, "bitcoin").setScale(0.8).setDepth(10);
        
        this.obstacleSpritesMap = new Map();

        this.scoreText = this.add.text(20, 20, "Score: 0", {
            fontSize: "24px", fill: "#f3ba2f", fontStyle: "bold",
            stroke: "#000", strokeThickness: 3
        }).setDepth(20);
        
        this.bestText = this.add.text(20, 50, "Best: " + highScore, {
            fontSize: "20px", fill: "#ffffff", fontStyle: "bold",
            stroke: "#000", strokeThickness: 3
        }).setDepth(20);

        this.startText = this.add.text(400, 100, "TAP OR SPACE TO START", {
            fontSize: "32px", fill: "#f3ba2f", fontStyle: "bold",
            stroke: "#000", strokeThickness: 4
        }).setOrigin(0.5).setDepth(20);

        this.background = new BackgroundManager(this);

        window.resetGameOverScreen = () => {
            if (this && typeof this.restartGame === "function") {
                this.restartGame();
            }
        };

        if (!socket) {
           const backendUrl = window.location.hostname === "localhost" ? "http://localhost:3000" : "https://satoshi-plays.onrender.com";
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

                let playerGroundOffset = 15; 
                this.serverPlayerY = state.player.y - playerGroundOffset;
                this.serverObstacles = state.obstacles;
            });

            socket.on("game-over", (result) => {
                this.onGameOver(result);
            });

            socket.on("error", (err) => {
                console.error("Server error:", err);
            });
        }

        // UNIFIKOVANA FUNKCIJA ZA SKOK (koriste je i Space i Touch/Click)
        const handleJump = () => {
            if (this.gameOver) {
                this.scene.restart();
                return;
            }
            if (!this.gameStarted) {
                this.requestStart();
                return;
            }

            if (this.playerSprite.y >= 310) {
                this.playerSprite.y -= 15; 
            }

            socket.emit("jump");
        };

        // Slušanje tastature (Space)
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

        // Slušanje dodira ekrana (Mobile Touch) / Klika mišem
        this.input.on('pointerdown', (pointer) => {
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
                this.playerSprite.y = hitObstacle.y - 15;
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
            
            this.gameOverText = this.add.text(400, 110, "GAME OVER\n\nTAP OR SPACE", {
                fontSize: "34px", 
                fill: "#ff3333", 
                align: "center", 
                fontStyle: "bold",
                stroke: "#000",
                strokeThickness: 5
            }).setOrigin(0.5).setDepth(30);
        });

        if (result.success) {
            window.dispatchEvent(new Event("scoreSubmitted"));
        }
    }

    update(time, delta) {
        if (!this.gameStarted || this.gameOver) return;

        this.playerSprite.y = Phaser.Math.Linear(this.playerSprite.y, this.serverPlayerY, 0.35);

        if (this.playerSprite.y < 330) {
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
            if (obs.type === "rug") label = "rugpull";

            let obj = this.obstacleSpritesMap.get(obs.id);

            if (!obj) {
                const spr = this.add.sprite(obs.x, obs.y, key)
                    .setScale(obs.type === "fud" ? 0.7 : 0.8)
                    .setDepth(8);
                if (obs.type === "meteor") spr.setTint(0xff0000);

                let txt = null;
                if (label) {
                    txt = this.add.text(obs.x, obs.y + 15, label, {
                        fontSize: "12px", fill: "#fff", fontStyle: "bold",
                        stroke: "#000", strokeThickness: 3
                    }).setOrigin(0.5).setDepth(9);
                }

                obj = { sprite: spr, text: txt };
                this.obstacleSpritesMap.set(obs.id, obj);
            }

            obj.sprite.x = Phaser.Math.Linear(obj.sprite.x, obs.x, 0.35);
            obj.sprite.y = Phaser.Math.Linear(obj.sprite.y, obs.y, 0.35);

            if (obj.text) {
                obj.text.x = obj.sprite.x;
                obj.text.y = obj.sprite.y + 15;
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
        physics: {
            default: "arcade",
            arcade: { gravity: { y: 0 }, debug: false }
        },
        scene: [GameScene]
    };
    new Phaser.Game(config);
}
