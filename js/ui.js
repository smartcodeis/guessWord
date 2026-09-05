export const UI = {

    showScreen(id) {

        document
            .querySelectorAll(".screen")
            .forEach(screen => {

                screen.classList.remove(
                    "active"
                );
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

            element.classList.remove(
                "ready"
            );
        }
    },


    renderGame(state, playerId) {

        const isMyTurn =
            state.currentTurn === playerId;


        const turnText =
            document.getElementById(
                "turnText"
            );


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
            !isMyTurn ||
            state.gameOver;


        guessBtn.disabled =
            !isMyTurn ||
            state.gameOver;


        document
            .getElementById("myPlayerCard")
            .classList.toggle(
                "active-player",
                isMyTurn
            );


        document
            .getElementById("opponentPlayerCard")
            .classList.toggle(
                "active-player",
                !isMyTurn
            );


        this.renderWord(
            state
        );


        this.renderWrongLetters(
            state.wrongLetters
        );


        this.renderHistory(
            state.history
        );


        this.renderHint(
            state
        );
    },


    renderWord(state) {

        const container =
            document.getElementById(
                "wordDisplay"
            );


        const length =
            state.opponentWordLength;


        if (!length) {

            container.innerHTML = "";

            return;
        }


        let html = "";


        for (
            let i = 0;
            i < length;
            i++
        ) {

            const revealed =
                state.revealedPositions
                    .includes(i);


            const letter =
                revealed
                    ? state.revealedLetters[i]
                    : "";


            html += `

                <div
                    class="letter-box ${revealed
                    ? ""
                    : "hidden-letter"
                }"
                >
                    ${letter || "_"}
                </div>

            `;
        }


        container.innerHTML = html;
    },


    renderHint(state) {

        const hintBtn =
            document.getElementById(
                "hintBtn"
            );

        const hintBox =
            document.getElementById(
                "hintBox"
            );


        if (state.showHint) {

            hintBox.textContent =
                state.opponentHint ||
                "No hint available.";

            hintBox.classList.remove(
                "hidden"
            );

            hintBtn.textContent =
                "💡 Hint Shown";

            hintBtn.disabled = true;

        } else {

            hintBox.classList.add(
                "hidden"
            );

            hintBtn.textContent =
                "💡 Show Hint";

            hintBtn.disabled = false;
        }
    },


    renderWrongLetters(letters) {

        const container =
            document.getElementById(
                "wrongLetters"
            );


        const count =
            document.getElementById(
                "wrongCount"
            );


        count.textContent =
            `${letters.length} / 10`;


        if (!letters.length) {

            container.innerHTML = `

                <span class="empty-wrong">
                    No wrong guesses yet.
                </span>

            `;

            return;
        }


        container.innerHTML =
            letters
                .map(letter => `

                    <span class="wrong-letter">
                        ${letter}
                    </span>

                `)
                .join("");
    },


    renderHistory(history) {

        const container =
            document.getElementById(
                "historyList"
            );


        if (!history.length) {

            container.innerHTML = `

                <p class="empty-history">
                    No guesses yet.
                </p>

            `;

            return;
        }


        container.innerHTML =
            history
                .map(item => `

                    <div
                        class="history-item ${item.exists
                        ? "correct"
                        : "wrong"
                    }"
                    >

                        <span class="guess">
                            ${item.letter}
                        </span>

                        <span class="correct">

                            ${item.exists
                        ? "Correct"
                        : "Wrong"
                    }

                        </span>

                    </div>

                `)
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


        box.classList.remove(
            "hidden"
        );


        if (result.exists) {

            title.textContent =
                "Correct! ✓";

            text.textContent =
                "The letter is in the word.";

        } else {

            title.textContent =
                "Wrong letter";

            text.textContent =
                "That letter is not in the word.";
        }
    },


    hideResult() {

        document
            .getElementById(
                "resultBox"
            )
            .classList.add(
                "hidden"
            );
    },


    showGameOver(result) {

        const { won, opponentWon, myWord, opponentWord } = result;


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


        if (won && !opponentWon) {

            title.textContent =
                "YOU WIN 🎉";

        } else if (!won && opponentWon) {

            title.textContent =
                "YOU LOSE";

        } else if (won && opponentWon) {

            title.textContent =
                "DRAW! (Both Guessed)";

        } else {

            title.textContent =
                "DRAW! (Both Failed)";
        }


        // Make it preserve newlines in HTML
        text.style.whiteSpace = "pre-line";

        let message = "";
        
        if (opponentWord) {
            message += `Opponent's word: ${opponentWord}\n`;
        } else {
            message += `Opponent's word: (Not revealed yet)\n`;
        }

        message += `Your word: ${myWord}`;


        text.textContent = message;


        modal.classList.remove(
            "hidden"
        );
    },


    hideGameOver() {

        document
            .getElementById(
                "gameOverModal"
            )
            .classList.add(
                "hidden"
            );
    },


    toast(message) {

        const toast =
            document.getElementById(
                "toast"
            );


        toast.textContent =
            message;


        toast.classList.add(
            "show"
        );


        setTimeout(() => {

            toast.classList.remove(
                "show"
            );

        }, 2500);
    }
};
