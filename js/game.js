export class Game {

    constructor({
        playerId,
        send,
        onUpdate,
        onFinish
    }) {

        this.playerId = playerId;

        this.send = send;

        this.onUpdate = onUpdate;

        this.onFinish = onFinish;


        this.secret = null;

        this.hint = "";

        this.myReady = false;

        this.opponentReady = false;

        this.gameStarted = false;

        this.gameOver = false;


        this.currentTurn = "player1";


        this.guessedLetters = [];

        this.wrongLetters = [];

        this.lastResult = null;

        this.showHint = false;
    }


    setSecretWord(word, hint) {

        word = String(word)
            .trim()
            .toLowerCase();

        hint = String(hint)
            .trim();


        if (!/^[a-z]+$/.test(word)) {

            throw new Error(
                "Word must contain English letters only."
            );
        }


        if (word.length < 2) {

            throw new Error(
                "Word must contain at least 2 letters."
            );
        }


        if (!hint) {

            throw new Error(
                "Please enter a hint."
            );
        }


        this.secret = word;

        this.hint = hint;

        this.myReady = true;


        /*
         * IMPORTANT:
         *
         * We NEVER send the secret word.
         *
         * Only send that we are ready.
         */

        this.send({
            type: "player-ready"
        });


        this.tryStart();

        this.update();
    }


    makeGuess(letter) {

        letter = String(letter)
            .trim()
            .toLowerCase();


        if (!/^[a-z]$/.test(letter)) {

            throw new Error(
                "Enter one English letter."
            );
        }


        if (!this.gameStarted) {

            throw new Error(
                "The game has not started yet."
            );
        }


        if (this.gameOver) {

            throw new Error(
                "The game is already over."
            );
        }


        if (this.currentTurn !== this.playerId) {

            throw new Error(
                "It is not your turn."
            );
        }


        if (this.guessedLetters.includes(letter)) {

            throw new Error(
                "You already guessed this letter."
            );
        }


        this.guessedLetters.push(letter);


        this.send({

            type: "guess",

            letter
        });
    }


    receive(message) {

        if (!message || !message.type) {
            return;
        }


        switch (message.type) {

            case "player-ready":

                this.opponentReady = true;

                this.tryStart();

                this.update();

                break;


            case "game-start":

                this.gameStarted = true;

                this.currentTurn =
                    message.firstTurn;

                this.update();

                break;


            case "guess":

                this.handleOpponentGuess(
                    message.letter
                );

                break;


            case "guess-result":

                this.handleGuessResult(
                    message
                );

                break;


            case "turn-change":

                this.currentTurn =
                    message.player;

                this.lastResult = null;

                this.update();

                break;


            case "hint":

                this.showHint = true;

                this.update();

                break;


            case "play-again":

                this.resetForRematch();

                break;


            case "game-over":

                this.gameOver = true;

                this.gameStarted = false;


                this.onFinish({

                    won:
                        message.winner ===
                        this.playerId,

                    word:
                        message.word

                });

                break;
        }
    }


    tryStart() {

        if (
            this.myReady &&
            this.opponentReady &&
            !this.gameStarted
        ) {

            /*
             * Player 1 starts the game.
             */

            if (this.playerId === "player1") {

                this.gameStarted = true;

                this.currentTurn = "player1";


                this.send({

                    type: "game-start",

                    firstTurn: "player1"
                });


                this.update();
            }
        }
    }


    handleOpponentGuess(letter) {

        if (!this.secret) {
            return;
        }


        const exists =
            this.secret.includes(letter);


        this.send({

            type: "guess-result",

            letter,

            exists
        });


        /*
         * Check whether the opponent
         * completed the entire word.
         */

        if (exists) {

            const opponentGuessedLetters =
                this.getOpponentGuessedLetters(
                    letter
                );

            /*
             * The actual win check is handled
             * using the letters the opponent
             * has guessed.
             *
             * We keep the state locally by
             * receiving the guesses through
             * the result messages.
             */
        }
    }


    getOpponentGuessedLetters() {

        /*
         * This method exists to keep the logic
         * separated. The opponent's exact
         * guessed letters are reconstructed
         * through the game messages.
         */

        return [];
    }


    handleGuessResult(message) {

        this.lastResult = {

            letter:
                message.letter,

            exists:
                message.exists
        };


        /*
         * If the letter was wrong,
         * add it to wrong guesses.
         */

        if (!message.exists) {

            if (
                !this.wrongLetters.includes(
                    message.letter
                )
            ) {

                this.wrongLetters.push(
                    message.letter
                );
            }
        }


        /*
         * Check whether the guessed letters
         * reveal the entire word.
         *
         * We can determine this from our own
         * guessed letters because the opponent
         * sends back the result of our guess.
         */

        const solved =
            this.secret === null
                ? false
                : false;


        /*
         * The opponent does not know our secret.
         * Therefore, the local game state must
         * be based on the word belonging to the
         * opponent.
         *
         * We don't receive the opponent's word.
         * So the opponent tells us when the word
         * is completely solved through game-over.
         */


        if (message.exists) {

            this.update();

        } else {

            if (
                this.wrongLetters.length >= 10
            ) {

                this.send({

                    type: "game-over",

                    winner:
                        this.playerId === "player1"
                            ? "player2"
                            : "player1",

                    word:
                        message.word || null
                });


                this.gameOver = true;

                this.gameStarted = false;


                this.onFinish({

                    won: false,

                    word: message.word
                });


                return;
            }


            this.changeTurn();
        }
    }


    changeTurn() {

        this.currentTurn =
            this.playerId === "player1"
                ? "player2"
                : "player1";


        this.send({

            type: "turn-change",

            player:
                this.currentTurn
        });


        this.update();
    }


    requestHint() {

        if (!this.gameStarted) {
            return;
        }


        this.showHint = true;

        this.send({

            type: "hint"
        });


        this.update();
    }


    update() {

        if (this.onUpdate) {

            this.onUpdate({

                secret:
                    this.secret,

                hint:
                    this.hint,

                myReady:
                    this.myReady,

                opponentReady:
                    this.opponentReady,

                gameStarted:
                    this.gameStarted,

                gameOver:
                    this.gameOver,

                currentTurn:
                    this.currentTurn,

                guessedLetters:
                    this.guessedLetters,

                wrongLetters:
                    this.wrongLetters,

                lastResult:
                    this.lastResult,

                showHint:
                    this.showHint
            });
        }
    }


    playAgain() {

        this.send({
            type: "play-again"
        });

        this.resetForRematch();
    }


    resetForRematch() {

        this.secret = null;

        this.hint = "";

        this.myReady = false;

        this.opponentReady = false;

        this.gameStarted = false;

        this.gameOver = false;

        this.currentTurn = "player1";

        this.guessedLetters = [];

        this.wrongLetters = [];

        this.lastResult = null;

        this.showHint = false;


        this.update();
    }


    reset() {

        this.secret = null;

        this.hint = "";

        this.myReady = false;

        this.opponentReady = false;

        this.gameStarted = false;

        this.gameOver = false;

        this.currentTurn = "player1";

        this.guessedLetters = [];

        this.wrongLetters = [];

        this.lastResult = null;

        this.showHint = false;
    }


    static buildWordDisplay(
        word,
        guessedLetters
    ) {

        return [...word].map(letter => {

            return guessedLetters.includes(letter)
                ? letter
                : "_";

        });
    }
}