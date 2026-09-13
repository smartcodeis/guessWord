import { Game } from "./game.js";
import { WebRTCManager } from "./webrtc.js";
import { UI } from "./ui.js";
import { Storage } from "./storage.js";

const state = {
    playerId: null,
    roomCode: null,
    transport: null,
    game: null,
    _wasConnected: false
};
function createGame() {
    const savedScores = Storage.getScores(state.roomCode);
    state.game = new Game({
        playerId: state.playerId,
        roomCode: state.roomCode,
        send: message => {
            state.transport.send(message);
        },
        onUpdate: gameState => {
            renderGameState(gameState);
        },
        onFinish: result => {
            UI.showGameOver(result, state.playerId);
        }
    });
    state.game.scores = { ...savedScores };
}
function createTransport() {
    state.transport = new WebRTCManager({
        onConnected: () => {
            const wasReconnecting = state._wasConnected;
            state._wasConnected = true;
            UI.setConnectionBadge("connected", "Connected");
            UI.setRoomStatus("Opponent connected!");
            // دايماً نفتح الـ readyPanel (سواء أول اتصال أو reconnect)
            UI.showReadyPanel();
            if (wasReconnecting) {
                UI.toast("Reconnected ✓");
            }
            _tryRestoreGameState();
        },
        onMessage: message => {
            state.game?.receive(message);
        },
        onDisconnected: () => {
            // هنا يُستدعى فقط لما ننهي الاتصال نهائياً أو يفشل بعد كل المحاولات
            UI.setConnectionBadge("error", "Disconnected");
            UI.setRoomStatus("Opponent disconnected.");
            UI.toast("Opponent disconnected.");
        },
        onError: message => {
            // أثناء الـ reconnect نوضح إن عندنا مشكلة مؤقتة
            UI.setConnectionBadge("waiting", "Reconnecting…");
            UI.setRoomStatus("Connection lost — reconnecting…");
        }
    });
}

function _tryRestoreGameState() {
    if (!state.game || !state.roomCode) return;
    const savedState = Storage.loadGameState(state.roomCode);
    if (savedState && savedState.gameStarted) {
        state.game.restoreState(savedState);
        UI.toast("Game state restored ✓");
    }
}
function renderGameState(gameState) {
    UI.setReadyState(gameState.myReady);
    if (gameState.myReady && gameState.opponentReady) {
        UI.setRoomStatus("Both players are ready!");
    } else if (gameState.opponentReady) {
        UI.setRoomStatus("Opponent is ready! Waiting for you.");
    } else {
        UI.setRoomStatus("Waiting for opponent...");
    }
    if (gameState.gameStarted) {
        UI.showScreen("gameScreen");
        UI.renderGame(
            gameState,
            state.playerId
        );
        if (gameState.lastResult) {
            UI.showResult(gameState.lastResult);
        } else {
            UI.hideResult();
        }
    } else {
        UI.showScreen("roomScreen");
        const secretInput =
            document.getElementById("secretInput");
        const hintInput =
            document.getElementById("hintInput");
        const readyBtn =
            document.getElementById("readyBtn");
        secretInput.disabled = gameState.myReady;
        hintInput.disabled = gameState.myReady;
        readyBtn.disabled = gameState.myReady;
    }
}
document
    .getElementById("createRoomBtn")
    .addEventListener("click", async () => {
        const code = Storage.generateUniqueRoomCode();
        state.playerId = "player1";
        state.roomCode = code;
        Storage.assignPlayerRole(code, "player1");
        createTransport();
        createGame();
        UI.showScreen("roomScreen");
        UI.showHostCode(code);
        UI.setConnectionBadge("waiting", "Waiting");
        UI.setRoomStatus("Waiting for opponent...");
        try {
            await state.transport.createRoom(code);
        } catch {
            UI.toast("Could not create room.");
        }
    });
document
    .getElementById("joinRoomBtn")
    .addEventListener("click", async () => {
        const input = document.getElementById("roomCodeInput");
        const code = input.value.trim();
        if (!/^\d{6}$/.test(code)) {
            UI.toast("Enter a valid 6-digit room code.");
            return;
        }
        let assignedRole = Storage.getPlayerRole(code);
        if (!assignedRole) {
            const result = Storage.assignPlayerRole(code, "player2");
            if (result === "full") {
                UI.toast(
                    "This game already has 2 players. " +
                    "Use a different code or rejoin from your original device."
                );
                return;
            }
            assignedRole = result;
        }
        state.playerId = assignedRole;
        state.roomCode = code;
        createTransport();
        createGame();
        UI.showScreen("roomScreen");
        UI.hideHostCode();
        UI.setConnectionBadge("waiting", "Connecting");
        UI.setRoomStatus("Connecting to room...");
        try {
            await state.transport.joinRoom(code);
        } catch {
            UI.toast("Could not join room.");
        }
    });
document
    .getElementById("readyBtn")
    .addEventListener("click", () => {
        const secretInput =
            document.getElementById("secretInput");
        const hintInput =
            document.getElementById("hintInput");
        const word = secretInput.value.trim();
        const hint = hintInput.value.trim();
        try {
            state.game.setSecretWord(word, hint);
        } catch (error) {
            UI.toast(error.message);
        }
    });
document
    .getElementById("guessBtn")
    .addEventListener("click", () => {
        const input =
            document.getElementById("guessInput");
        const letter = input.value.trim();
        try {
            state.game.makeGuess(letter);
            input.value = "";
            UI.hideResult();
        } catch (error) {
            UI.toast(error.message);
        }
    });
document
    .getElementById("guessInput")
    .addEventListener("keydown", event => {
        if (event.key === "Enter") {
            document
                .getElementById("guessBtn")
                .click();
        }
    });
document
    .getElementById("hintBtn")
    .addEventListener("click", () => {
        state.game?.requestHint();
    });
document
    .getElementById("clearHistoryBtn")
    .addEventListener("click", () => {
        if (!state.game) return;
        state.game.history = [];
        state.game.lastResult = null;
        UI.hideResult();
        UI.renderHistory([]);
    });
document
    .getElementById("leaveRoomBtn")
    .addEventListener("click", () => {
        resetGame();
    });
document
    .getElementById("playAgainBtn")
    .addEventListener("click", () => {
        UI.hideGameOver();
        state.game?.playAgain();
    });
function resetGame() {
    try {
        state.transport?.disconnect();
    } catch { }
    state.playerId = null;
    state.roomCode = null;
    state.transport = null;
    state.game = null;
    state._wasConnected = false;
    document.getElementById("secretInput").value = "";
    document.getElementById("hintInput").value = "";
    document.getElementById("secretInput").disabled = false;
    document.getElementById("hintInput").disabled = false;
    document.getElementById("readyBtn").disabled = false;
    document.getElementById("guessInput").value = "";
    UI.hideGameOver();
    UI.hideResult();
    UI.setReadyState(false);
    UI.showScreen("homeScreen");
}
window.addEventListener("beforeunload", () => {
    // لا ننهي الاتصال عند إخفاء الصفحة عشان الاتصال يفضل حي
    // الاتصال بينقطع فقط لما المستخدم يضغط Leave
});
