// ==========================================
// BBTC WALLET SYSTEM V2
// Compatible with SERVER.JS signature verification
// ==========================================

console.log("WALLET JS LOADED");

const connectBtn =
    document.getElementById("connectBtn");

const walletStatus =
    document.getElementById("walletStatus");

const disconnectBtn =
    document.getElementById("disconnectBtn");


connectBtn.onclick = async () => {

    if (!window.ethereum) {

        alert("Install MetaMask!");

        return;
    }

    try {

        // ==========================================
        // 1. REQUEST WALLET
        // ==========================================

        const accounts =
            await window.ethereum.request({
                method: "eth_requestAccounts"
            });

        const wallet =
            accounts[0];


        // ==========================================
        // 2. CREATE EXACT SERVER MESSAGE
        // ==========================================
        //
        // OVO MORA BITI IDENTIČNO SERVER.JS
        //
        // server.js proverava:
        //
        // Login to Satoshi Plays: ${state.wallet}
        //
        // ==========================================

        const message =
            `Login to Satoshi Plays: ${wallet}`;


        // ==========================================
        // 3. REQUEST SIGNATURE
        // ==========================================

        const signature =
            await window.ethereum.request({

                method: "personal_sign",

                params: [
                    message,
                    wallet
                ]
            });


        console.log(
            "Wallet:",
            wallet
        );

        console.log(
            "Signed message:",
            message
        );

        console.log(
            "Signature:",
            signature
        );


        // ==========================================
        // 4. SAVE WALLET + SIGNATURE
        // ==========================================

        window.userWallet =
            wallet;

        localStorage.setItem(
            "userWallet",
            wallet
        );

        localStorage.setItem(
            "userSignature",
            signature
        );


        // ==========================================
        // 5. UI
        // ==========================================

        const clickToPlayBtn =
            document.getElementById(
                "clickToPlayBtn"
            );

        if (clickToPlayBtn) {

            clickToPlayBtn.style.display =
                "block";
        }


        walletStatus.innerText =
            "Status: Connected (" +
            wallet.slice(0, 6) +
            "..." +
            wallet.slice(-4) +
            ")";


        const mainText =
            connectBtn.querySelector(
                ".btn-main"
            );

        const subText =
            connectBtn.querySelector(
                ".btn-sub"
            );


        if (mainText) {

            mainText.innerText =
                "Wallet Connected";
        }


        if (subText) {

            subText.innerText =
                "Ready to Play";
        }


        if (disconnectBtn) {

            disconnectBtn.style.display =
                "block";
        }


    } catch (error) {

        console.error(
            "Wallet connection/signature error:",
            error
        );


        walletStatus.innerText =
            "Status: Connection cancelled";
    }
};


// ==========================================
// DISCONNECT
// ==========================================

disconnectBtn.onclick = () => {

    window.userWallet =
        null;


    localStorage.removeItem(
        "userWallet"
    );


    localStorage.removeItem(
        "userSignature"
    );


    walletStatus.innerText =
        "Status: Playing as Guest";


    const mainText =
        connectBtn.querySelector(
            ".btn-main"
        );

    const subText =
        connectBtn.querySelector(
            ".btn-sub"
        );


    if (mainText) {

        mainText.innerText =
            "Connect Wallet";
    }


    if (subText) {

        subText.innerText =
            "Play & Earn Rewards";
    }


    disconnectBtn.style.display =
        "none";


    const clickToPlayBtn =
        document.getElementById(
            "clickToPlayBtn"
        );


    if (clickToPlayBtn) {

        clickToPlayBtn.style.display =
            "none";
    }


    console.log(
        "Wallet disconnected from game"
    );
};
