// ==========================================
// BBTC WALLET SYSTEM V1
// ==========================================

console.log("WALLET JS LOADED");
const connectBtn = document.getElementById("connectBtn");
const walletStatus = document.getElementById("walletStatus");
const disconnectBtn = document.getElementById("disconnectBtn");

connectBtn.onclick = async () => {

    if(!window.ethereum){
        alert("Install MetaMask!");
        return;
    }

    try {

        // 1. Request wallet
        const accounts = await window.ethereum.request({
            method: "eth_requestAccounts"
        });

        const wallet = accounts[0];

        // 2. Create message
        const message = 
`Book of Bitcoin Login

Wallet:
${wallet}

Time:
${Date.now()}`;

        // 3. Request signature
        const signature = await window.ethereum.request({
            method: "personal_sign",
            params:[
                message,
                wallet
            ]
        });

        console.log("Wallet:", wallet);
        console.log("Signature:", signature);

        // Save wallet + signature
        window.userWallet = wallet;
        localStorage.setItem("userWallet", wallet);
        localStorage.setItem("userSignature", signature);   // ← OVO JE NOVO

        document.getElementById("clickToPlayBtn").style.display = "block";

        walletStatus.innerText =
        "Status: Connected (" +
        wallet.slice(0,6) +
        "..." +
        wallet.slice(-4) +
        ")";

        connectBtn.querySelector(".btn-main").innerText = "Wallet Connected";
        connectBtn.querySelector(".btn-sub").innerText = "Ready to Play";

        disconnectBtn.style.display = "block";
    }
    catch(error){
        console.log(error);
        walletStatus.innerText = "Status: Connection cancelled";
    }
};

disconnectBtn.onclick = () => {

    window.userWallet = null;
    localStorage.removeItem("userWallet");
    localStorage.removeItem("userSignature");   // ← OVO JE NOVO

    walletStatus.innerText = "Status: Playing as Guest";

    connectBtn.querySelector(".btn-main").innerText = "Connect Wallet";
    connectBtn.querySelector(".btn-sub").innerText = "Play & Earn Rewards";

    disconnectBtn.style.display = "none";
    document.getElementById("clickToPlayBtn").style.display = "none";

    console.log("Wallet disconnected from game");
};