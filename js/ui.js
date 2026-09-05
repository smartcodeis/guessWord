export const UI = {

    showScreen(id) {

        document
            .querySelectorAll(".screen")
            .forEach(screen => {
                screen.classList.remove("active");
            });


        document
            .getElementById(id)
            .classList.add("active");
    },


    setConnectionBadge(type, text) {

        const badge =
            document.getElementById(
                "connectionBadge"
            );


        badge.className =
            `badge ${type}`;


        badge.textContent = text;
    },


    setRoomStatus(text) {

        document.getElementById(
            "roomStatus"
        ).textContent = text;
    },


    showHostCode(code) {

        document
            .getElementById("hostCodeBox")
            .classList.remove("hidden");


        document
            .getElementById("hostCode")
            .textContent = code;
    },


    hideHostCode() {

        document
            .getElementById("hostCodeBox")
            .classList.add("hidden");
    },


    showReadyPanel() {

        document
            .getElementById("readyPanel")
            .classList.remove("hidden");
    },


    setReadyState(ready) {

        const element =
            document.getElementById(
                "readyState"
            );


        if (ready) {

            element.textContent =
                "You are ready ✓";

            element.classList.add("ready");

        } else {

            element.textContent =
                "Not ready";

            element.classList.remove("ready");
        }
    },


    renderGame(state, playerId) {

        const turnText =
            document.getElementById(
                "turnText"
            );


        const isMyTurn =
            state.currentTurn === playerId;


        turnText.textContent =
            isMyTurn
                ? "Your Turn"
                : "Opponent's Turn";


        const guessInput =
            document.getElementById(
                "guessInput"
            );


        const guessBtn =
            document.getElementById(
                "guessBtn"
            );


        guessInput.disabled =
            !isMyTurn || state.gameOver;


        guessBtn.disabled =
            !isMyTurn || state.gameOver;


        document
            .getElementById("myPlayerCard")
            .classList.toggle(
                "active-player",
                isMyTurn
            );


        const mySecretDisplay =
            document.getElementById("mySecretDisplay");

        if (mySecretDisplay) {
            mySecretDisplay.textContent =
                `Secret: ${state.secret || "---"}`;
        }


        document
            .getElementById("opponentPlayerCard")
            .classList.toggle(
                "active-player",
                !isMyTurn
            );


        this.renderHistory(
            state.history
        );
    },


    renderHistory(history) {

        const container =
            document.getElementById(
                "historyList"
            );


        if (!history.length) {

            container.innerHTML =
                `<p class="empty-history">
                    No guesses yet.
                </p>`;

            return;
        }


        container.innerHTML =
            history
                .map(item => {

                    let text;


                    if (
                        item.correctNumbers === 3 &&
                        !item.exactOrder
                    ) {

                        text =
                            "3 correct — wrong order";

                    } else {

                        text =
                            `${item.correctNumbers} correct`;
                    }


                    return `
                        <div class="history-item">

                            <span class="guess">
                                ${item.guess}
                            </span>

                            <span class="correct">
                                ${text}
                            </span>

                        </div>
                    `;
                })
                .reverse()
                .join("");
    },


    showResult(result) {

        const box =
            document.getElementById(
                "resultBox"
            );


        const title =
            document.getElementById(
                "resultTitle"
            );


        const text =
            document.getElementById(
                "resultText"
            );


        box.classList.remove("hidden");


        if (
            result.correctNumbers === 3 &&
            result.exactOrder
        ) {

            title.textContent =
                "Correct!";

            text.textContent =
                "You guessed the exact number.";

        } else if (
            result.correctNumbers === 3
        ) {

            title.textContent =
                "3 numbers are correct";

            text.textContent =
                "But the order is wrong.";

        } else {

            title.textContent =
                `${result.correctNumbers} correct number${
                    result.correctNumbers !== 1
                        ? "s"
                        : ""
                }`;

            text.textContent =
                "Keep trying!";
        }
    },


    hideResult() {

        document
            .getElementById("resultBox")
            .classList.add("hidden");
    },


    showGameOver(won, guess, opponentSecret) {

        const modal =
            document.getElementById(
                "gameOverModal"
            );


        const title =
            document.getElementById(
                "gameOverTitle"
            );


        const text =
            document.getElementById(
                "gameOverText"
            );


        if (won) {

            title.textContent =
                "YOU WIN 🎉";

            text.textContent =
                `You guessed ${guess} correctly!`;

        } else {

            title.textContent =
                "YOU LOSE";

            const secretInfo = opponentSecret
                ? ` The opponent's number was ${opponentSecret}.`
                : "";

            text.textContent =
                `Your opponent guessed ${guess}.${secretInfo}`;
        }


        modal.classList.remove("hidden");
    },


    hideGameOver() {

        document
            .getElementById(
                "gameOverModal"
            )
            .classList.add("hidden");
    },


    toast(message) {

        const toast =
            document.getElementById(
                "toast"
            );


        toast.textContent = message;

        toast.classList.add("show");


        setTimeout(() => {

            toast.classList.remove("show");

        }, 2500);
    }
};