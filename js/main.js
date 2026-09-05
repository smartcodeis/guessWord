import { Game } from "./game.js";
import { WebRTCManager } from "./webrtc.js";
import { UI } from "./ui.js";


const state = {

    playerId: null,

    roomCode: null,

    transport: null,

    game: null
};



function generateRoomCode() {

    return String(
        Math.floor(
            100000 +
            Math.random() * 900000
        )
    );
}



function createGame() {

    state.game =
        new Game({

            playerId:
                state.playerId,

            send: message => {

                state.transport.send(
                    message
                );
            },

            onUpdate: gameState => {

                renderGameState(
                    gameState
                );
            },

            onFinish: result => {

                UI.showGameOver(
                    result.won,
                    result.guess,
                    result.opponentSecret
                );
            }
        });
}



function createTransport() {

    state.transport =
        new WebRTCManager({

            onConnected: () => {

                UI.setConnectionBadge(
                    "connected",
                    "Connected"
                );


                UI.setRoomStatus(
                    "Opponent connected!"
                );


                UI.showReadyPanel();
            },


            onMessage: message => {

                state.game?.receive(
                    message
                );
            },


            onDisconnected: () => {

                UI.setConnectionBadge(
                    "error",
                    "Disconnected"
                );


                UI.setRoomStatus(
                    "Opponent disconnected."
                );


                UI.toast(
                    "Opponent disconnected."
                );
            },


            onError: message => {

                UI.setConnectionBadge(
                    "error",
                    "Connection Error"
                );


                UI.toast(message);
            }
        });
}



function renderGameState(gameState) {

    UI.setReadyState(
        gameState.myReady
    );


    if (
        gameState.myReady &&
        gameState.opponentReady
    ) {

        UI.setRoomStatus(
            "Both players are ready!"
        );
    } else if (gameState.opponentReady) {
        
        UI.setRoomStatus(
            "Opponent is ready! Waiting for you."
        );
    } else {

        UI.setRoomStatus(
            "Waiting for opponent..."
        );
    }


    if (gameState.gameStarted) {

        UI.showScreen(
            "gameScreen"
        );


        UI.renderGame(
            gameState,
            state.playerId
        );


        if (gameState.lastResult) {

            UI.showResult(
                gameState.lastResult
            );

        } else {

            UI.hideResult();
        }
    } else {

        UI.showScreen(
            "roomScreen"
        );

        
        document.getElementById(
            "secretInput"
        ).disabled = gameState.myReady;


        document.getElementById(
            "readyBtn"
        ).disabled = gameState.myReady;
    }
}



/* CREATE ROOM */

document
    .getElementById("createRoomBtn")
    .addEventListener(
        "click",
        async () => {

            const code =
                generateRoomCode();


            state.playerId =
                "player1";


            state.roomCode =
                code;


            createTransport();

            createGame();


            UI.showScreen(
                "roomScreen"
            );


            UI.showHostCode(
                code
            );


            UI.setConnectionBadge(
                "waiting",
                "Waiting"
            );


            UI.setRoomStatus(
                "Waiting for opponent..."
            );


            try {

                await state.transport
                    .createRoom(code);

            } catch (error) {

                UI.toast(
                    "Could not create room."
                );
            }
        }
    );



/* JOIN ROOM */

document
    .getElementById("joinRoomBtn")
    .addEventListener(
        "click",
        async () => {

            const input =
                document.getElementById(
                    "roomCodeInput"
                );


            const code =
                input.value.trim();


            if (!/^\d{6}$/.test(code)) {

                UI.toast(
                    "Enter a valid 6-digit room code."
                );

                return;
            }


            state.playerId =
                "player2";


            state.roomCode =
                code;


            createTransport();

            createGame();


            UI.showScreen(
                "roomScreen"
            );


            UI.hideHostCode();


            UI.setConnectionBadge(
                "waiting",
                "Connecting"
            );


            UI.setRoomStatus(
                "Connecting to room..."
            );


            try {

                await state.transport
                    .joinRoom(code);

            } catch (error) {

                UI.toast(
                    "Could not join room."
                );
            }
        }
    );



/* READY */

document
    .getElementById("readyBtn")
    .addEventListener(
        "click",
        () => {

            const input =
                document.getElementById(
                    "secretInput"
                );


            const secret =
                input.value.trim();


            if (!/^\d{3}$/.test(secret)) {

                UI.toast(
                    "Secret number must be exactly 3 digits."
                );

                return;
            }


            try {

                state.game
                    .setSecretNumber(
                        secret
                    );


                input.disabled = true;


                document
                    .getElementById(
                        "readyBtn"
                    )
                    .disabled = true;


            } catch (error) {

                UI.toast(
                    error.message
                );
            }
        }
    );



/* GUESS */

document
    .getElementById("guessBtn")
    .addEventListener(
        "click",
        () => {

            const input =
                document.getElementById(
                    "guessInput"
                );


            const value =
                input.value.trim();


            if (!/^\d{3}$/.test(value)) {

                UI.toast(
                    "Guess must be exactly 3 digits."
                );

                return;
            }


            try {

                state.game
                    .makeGuess(value);


                input.value = "";


                UI.hideResult();

            } catch (error) {

                UI.toast(
                    error.message
                );
            }
        }
    );



/* ENTER TO GUESS */

document
    .getElementById("guessInput")
    .addEventListener(
        "keydown",
        event => {

            if (event.key === "Enter") {

                document
                    .getElementById(
                        "guessBtn"
                    )
                    .click();
            }
        }
    );



/* CLEAR HISTORY */

document
    .getElementById(
        "clearHistoryBtn"
    )
    .addEventListener(
        "click",
        () => {

            if (!state.game) {
                return;
            }


            state.game.history = [];

            state.game.lastResult = null;


            UI.hideResult();


            UI.renderHistory([]);
        }
    );



/* LEAVE ROOM */

document
    .getElementById(
        "leaveRoomBtn"
    )
    .addEventListener(
        "click",
        () => {

            resetGame();
        }
    );



/* PLAY AGAIN */

document
    .getElementById(
        "playAgainBtn"
    )
    .addEventListener(
        "click",
        () => {

            UI.hideGameOver();

            state.game.playAgain();
        }
    );



function resetGame() {

    try {

        state.transport?.disconnect();

    } catch {}


    state.playerId = null;

    state.roomCode = null;

    state.transport = null;

    state.game = null;


    document.getElementById(
        "secretInput"
    ).value = "";

    document.getElementById(
        "secretInput"
    ).disabled = false;


    document.getElementById(
        "readyBtn"
    ).disabled = false;


    document.getElementById(
        "guessInput"
    ).value = "";


    UI.hideGameOver();

    UI.hideResult();

    UI.setReadyState(false);

    UI.showScreen("homeScreen");
}



/* Cleanup */

window.addEventListener(
    "beforeunload",
    () => {

        try {

            state.transport?.disconnect();

        } catch {}
    }
);