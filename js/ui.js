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
            document.getElementById("connectionBadge");

        badge.className = `badge ${type}`;

        badge.textContent = text;
    },


    setRoomStatus(text) {

        document.getElementById("roomStatus")
            .textContent = text;
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
            document.getElementById("readyState");

        if (ready) {

            element.textContent = "You are ready ✓";

            element.classList.add("ready");

        } else {

            element.textContent = "Not ready";

            element.classList.remove("ready");
        }
    },


    /**
     * عرض اللعبة الكاملة.
     * @param {object} state — حالة اللعبة
     * @param {string} playerId — "player1" | "player2"
     */
    renderGame(state, playerId) {

        const isMyTurn = state.currentTurn === playerId;

        const isPlayer1 = playerId === "player1";


        /* ── Turn Text ── */

        const turnText =
            document.getElementById("turnText");

        if (state.gameOver) {

            turnText.textContent = "Game Over";

        } else if (state.myAttemptsExhausted) {

            turnText.textContent = "Your attempts are exhausted — waiting for opponent";

        } else {

            turnText.textContent =
                isMyTurn ? "Your Turn" : "Opponent's Turn";
        }


        /* ── Input Controls ── */

        const guessInput =
            document.getElementById("guessInput");

        const guessBtn =
            document.getElementById("guessBtn");

        const canGuess =
            isMyTurn &&
            !state.gameOver &&
            !state.myAttemptsExhausted;

        guessInput.disabled = !canGuess;

        guessBtn.disabled = !canGuess;


        /* ── Player Cards (active highlight) ── */

        document
            .getElementById("myPlayerCard")
            .classList.toggle("active-player", isMyTurn && !state.gameOver);

        document
            .getElementById("opponentPlayerCard")
            .classList.toggle("active-player", !isMyTurn && !state.gameOver);


        /* ── Score Labels ── */

        const myScore =
            isPlayer1
                ? state.scores.player1
                : state.scores.player2;

        const opponentScore =
            isPlayer1
                ? state.scores.player2
                : state.scores.player1;

        document.getElementById("myPlayerLabel").textContent =
            isPlayer1 ? "Player 1" : "Player 2";

        document.getElementById("opponentPlayerLabel").textContent =
            isPlayer1 ? "Player 2" : "Player 1";

        document.getElementById("myScoreLabel").textContent =
            `Score: ${myScore}`;

        document.getElementById("opponentScoreLabel").textContent =
            `Score: ${opponentScore}`;


        /* ── My Secret Word (always visible to Player 1) ── */

        this.renderMySecretWord(state, playerId);


        /* ── Opponent's Word Display ── */

        this.renderWord(state);


        /* ── Wrong Letters ── */

        this.renderWrongLetters(state.wrongLetters);


        /* ── History ── */

        this.renderHistory(state.history);


        /* ── Hint ── */

        this.renderHint(state);


        /* ── Attempts Exhausted Banner ── */

        this.renderAttemptsBanner(state, playerId);
    },


    /**
     * يُظهر الكلمة السرية الخاصة بي دائماً (ما دمت قد أدخلتها).
     * للـ Player1 فقط — Player2 لا يرى هذا القسم.
     */
    renderMySecretWord(state, playerId) {

        const section =
            document.getElementById("myWordSection");

        const display =
            document.getElementById("mySecretWordDisplay");


        if (state.secret) {

            // أُظهر كلمتي السرية دائماً ما دامت موجودة
            section.classList.remove("hidden");

            display.textContent =
                state.secret.toUpperCase();

        } else {

            section.classList.add("hidden");

            display.textContent = "";
        }
    },


    /**
     * يُظهر banner إذا انتهت محاولات أحد اللاعبين.
     */
    renderAttemptsBanner(state, playerId) {

        // نحاول إيجاد أو إنشاء banner ديناميكي
        let banner = document.getElementById("attemptsBanner");

        if (!banner) {
            banner = document.createElement("div");
            banner.id = "attemptsBanner";
            banner.className = "attempts-banner hidden";

            // نضيفه قبل wrong-section
            const wrongSection =
                document.querySelector(".wrong-section");

            if (wrongSection) {
                wrongSection.parentNode.insertBefore(
                    banner,
                    wrongSection
                );
            }
        }

        if (state.myAttemptsExhausted && !state.gameOver) {

            banner.textContent =
                "⚠️ You've used all 10 attempts. Waiting for opponent to finish...";

            banner.className = "attempts-banner exhausted";

        } else if (state.opponentAttemptsExhausted && !state.gameOver) {

            banner.textContent =
                "ℹ️ Opponent has used all attempts. It's your turn to finish!";

            banner.className = "attempts-banner opponent-exhausted";

        } else {

            banner.className = "attempts-banner hidden";

            banner.textContent = "";
        }
    },


    renderWord(state) {

        const container =
            document.getElementById("wordDisplay");

        const length = state.opponentWordLength;


        if (!length) {
            container.innerHTML = "";
            return;
        }


        let html = "";


        for (let i = 0; i < length; i++) {

            const revealed =
                state.revealedPositions.includes(i);

            const letter =
                revealed
                    ? state.revealedLetters[i]
                    : "";

            html += `
                <div class="letter-box ${revealed ? "" : "hidden-letter"}">
                    ${letter || "_"}
                </div>
            `;
        }


        container.innerHTML = html;
    },


    renderHint(state) {

        const hintBtn =
            document.getElementById("hintBtn");

        const hintBox =
            document.getElementById("hintBox");


        if (state.showHint) {

            hintBox.textContent =
                state.opponentHint || "No hint available.";

            hintBox.classList.remove("hidden");

            hintBtn.textContent = "💡 Hint Shown";

            hintBtn.disabled = true;

        } else {

            hintBox.classList.add("hidden");

            hintBtn.textContent = "💡 Show Hint";

            hintBtn.disabled = false;
        }
    },


    renderWrongLetters(letters) {

        const container =
            document.getElementById("wrongLetters");

        const count =
            document.getElementById("wrongCount");

        count.textContent = `${letters.length} / 10`;


        if (!letters.length) {

            container.innerHTML = `
                <span class="empty-wrong">No wrong guesses yet.</span>
            `;

            return;
        }


        container.innerHTML =
            letters
                .map(letter => `
                    <span class="wrong-letter">${letter}</span>
                `)
                .join("");
    },


    renderHistory(history) {

        const container =
            document.getElementById("historyList");


        if (!history.length) {

            container.innerHTML = `
                <p class="empty-history">No guesses yet.</p>
            `;

            return;
        }


        container.innerHTML =
            history
                .map(item => `
                    <div class="history-item ${item.exists ? "correct" : "wrong"}">
                        <span class="guess">${item.letter}</span>
                        <span class="correct">${item.exists ? "Correct" : "Wrong"}</span>
                    </div>
                `)
                .reverse()
                .join("");
    },


    showResult(result) {

        const box = document.getElementById("resultBox");

        const title = document.getElementById("resultTitle");

        const text = document.getElementById("resultText");

        box.classList.remove("hidden");


        if (result.exists) {

            title.textContent = "Correct! ✓";

            text.textContent = "The letter is in the word.";

        } else {

            title.textContent = "Wrong letter";

            text.textContent = "That letter is not in the word.";
        }
    },


    hideResult() {

        document
            .getElementById("resultBox")
            .classList.add("hidden");
    },


    /**
     * يُظهر نافذة نهاية اللعبة مع الـ Score المحدَّث.
     * @param {object} result
     * @param {string} playerId — "player1" | "player2"
     */
    showGameOver(result, playerId) {

        const { won, opponentWon, myWord, opponentWord, scores } = result;

        const isPlayer1 = playerId === "player1";


        const modal = document.getElementById("gameOverModal");

        const title = document.getElementById("gameOverTitle");

        const text = document.getElementById("gameOverText");


        /* ── Title ── */

        if (won && !opponentWon) {

            title.textContent = "YOU WIN 🎉";

            title.className = "win-title";

        } else if (!won && opponentWon) {

            title.textContent = "YOU LOSE 😔";

            title.className = "lose-title";

        } else if (won && opponentWon) {

            title.textContent = "DRAW! 🤝";

            title.className = "";

        } else {

            title.textContent = "DRAW! 😅";

            title.className = "";
        }


        /* ── Score Summary ── */

        const p1Score = scores?.player1 ?? 0;
        const p2Score = scores?.player2 ?? 0;

        const myScore = isPlayer1 ? p1Score : p2Score;
        const theirScore = isPlayer1 ? p2Score : p1Score;

        const myLabel = isPlayer1 ? "Player 1" : "Player 2";
        const theirLabel = isPlayer1 ? "Player 2" : "Player 1";


        text.style.whiteSpace = "pre-line";

        let message = "";

        message += `📊 Score\n`;
        message += `${myLabel} (You): ${myScore}\n`;
        message += `${theirLabel}: ${theirScore}\n\n`;

        if (opponentWord) {
            message += `Opponent's word: ${opponentWord}\n`;
        } else {
            message += `Opponent's word: (not revealed)\n`;
        }

        message += `Your word: ${myWord}`;

        text.textContent = message;


        modal.classList.remove("hidden");
    },


    hideGameOver() {

        document
            .getElementById("gameOverModal")
            .classList.add("hidden");
    },


    toast(message) {

        const toast = document.getElementById("toast");

        toast.textContent = message;

        toast.classList.add("show");

        setTimeout(() => {
            toast.classList.remove("show");
        }, 2500);
    }
};
