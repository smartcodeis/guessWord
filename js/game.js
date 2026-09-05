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


        // My secret word.
        // NEVER sent during normal gameplay.
        this.secret = null;

        this.hint = "";


        // Opponent information that is safe to share.
        this.opponentWordLength = 0;

        this.opponentHint = "";


        this.myReady = false;

        this.opponentReady = false;


        this.gameStarted = false;

        this.gameOver = false;


        this.currentTurn = "player1";


        // Letters I guessed.
        this.guessedLetters = [];


        // Letters that were wrong.
        this.wrongLetters = [];


        // Positions revealed by the opponent.
        this.revealedPositions = [];

        // Letters revealed by the opponent (index -> letter).
        this.revealedLetters = {};


        // History of my guesses.
        this.history = [];


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
         * We only send:
         *
         * - ready state
         * - word length
         * - hint
         *
         * The actual word is NEVER sent.
         */

        this.send({

            type: "player-ready",

            wordLength: word.length,

            hint
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

                this.opponentWordLength =
                    message.wordLength;

                this.opponentHint =
                    message.hint || "";


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

                this.handleGameOver(
                    message
                );

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


        const positions = [];


        /*
         * Find EVERY occurrence of the letter.
         *
         * Example:
         *
         * secret = "perfect"
         * letter = "e"
         *
         * positions = [1, 3]
         */

        for (
            let i = 0;
            i < this.secret.length;
            i++
        ) {

            if (this.secret[i] === letter) {

                positions.push(i);
            }
        }


        const exists =
            positions.length > 0;


        /*
         * Tell the opponent only:
         *
         * - whether the letter exists
         * - where it exists
         *
         * NEVER send the secret word here.
         */

        this.send({

            type: "guess-result",

            letter,

            exists,

            positions
        });


        /*
         * If all positions are revealed,
         * the opponent wins.
         */

        if (exists) {

            const allPositions =
                this.getAllGuessedPositionsForWord(
                    letter
                );


            /*
             * We only need to check whether
             * this latest guess reveals the
             * last missing letter.
             *
             * Since the opponent's previous
             * guessed letters are not sent to us,
             * we determine completion using the
             * message sequence indirectly:
             *
             * Every unique correct letter can be
             * tracked locally by the defender.
             */

            this.trackOpponentCorrectLetter(
                letter
            );


            if (
                this.isOpponentWordSolved()
            ) {

                this.send({

                    type: "game-over",

                    winner:
                        this.playerId === "player1"
                            ? "player2"
                            : "player1",

                    word:
                        this.secret
                });


                this.gameOver = true;

                this.gameStarted = false;

                this.onFinish({

                    won: false,

                    word: this.secret
                });


                return;
            }
        }
    }


    /*
     * Letters correctly guessed by the opponent.
     *
     * This is stored only on the defender's device.
     */

    trackOpponentCorrectLetter(letter) {

        if (!this.opponentGuessedCorrectLetters) {

            this.opponentGuessedCorrectLetters = [];
        }


        if (
            !this.opponentGuessedCorrectLetters
                .includes(letter)
        ) {

            this.opponentGuessedCorrectLetters.push(
                letter
            );
        }
    }


    isOpponentWordSolved() {

        if (!this.secret) {
            return false;
        }


        if (!this.opponentGuessedCorrectLetters) {
            return false;
        }


        /*
         * Every UNIQUE letter in the word
         * must have been guessed.
         */

        const uniqueLetters =
            new Set(this.secret);


        return [
            ...uniqueLetters
        ].every(letter =>
            this.opponentGuessedCorrectLetters
                .includes(letter)
        );
    }


    getAllGuessedPositionsForWord() {

        return [];
    }


    handleGuessResult(message) {

        this.lastResult = {

            letter:
                message.letter,

            exists:
                message.exists,

            positions:
                message.positions || []
        };


        /*
         * Save revealed positions AND letters.
         */

        if (message.exists) {

            if (!this.revealedLetters) {
                this.revealedLetters = {};
            }

            for (
                const position of message.positions
            ) {

                if (
                    !this.revealedPositions
                        .includes(position)
                ) {

                    this.revealedPositions.push(
                        position
                    );
                }

                // Store the actual letter at this position
                this.revealedLetters[position] =
                    message.letter;
            }
        }


        /*
         * Save history.
         */

        this.history.push({

            letter:
                message.letter,

            exists:
                message.exists
        });


        /*
         * Correct letter.
         */

        if (message.exists) {

            /*
             * The opponent sends game-over
             * when this was the final letter.
             *
             * So here we simply wait for
             * game-over.
             */

            this.update();

            return;
        }


        /*
         * Wrong letter.
         */

        if (
            !this.wrongLetters.includes(
                message.letter
            )
        ) {

            this.wrongLetters.push(
                message.letter
            );
        }


        /*
         * Ten wrong guesses = lose.
         */

        if (
            this.wrongLetters.length >= 10
        ) {

            /*
             * The guesser (me) lost.
             *
             * Tell the opponent (who holds the secret)
             * that they won. The opponent will respond
             * with game-over containing their secret word.
             */

            this.send({

                type: "game-over",

                winner:
                    this.playerId === "player1"
                        ? "player2"
                        : "player1",

                word: null
            });


            this.gameOver = true;

            this.gameStarted = false;


            this.onFinish({

                won: false,

                word: null   // we don't know it yet
            });


            return;
        }


        this.changeTurn();
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


    handleGameOver(message) {

        const won =
            message.winner === this.playerId;


        /*
         * If the defender receives a game-over
         * saying the guesser lost (their own
         * secret word was not found),
         * the defender must reveal the secret word.
         */

        if (!this.gameOver && !won && this.secret) {

            // Guesser lost: we are the defender.
            // Send back game-over with the real word.

            this.gameOver = true;

            this.gameStarted = false;

            this.send({

                type: "game-over",

                winner: message.winner,

                word: this.secret
            });


            this.onFinish({

                won: true,

                word: this.secret
            });


            this.update();

            return;
        }


        /*
         * If we already ended locally (guesser side),
         * now we receive the word from the defender.
         */

        if (this.gameOver) {

            // Update the game-over display with the word
            if (message.word) {
                this.onFinish({
                    won: false,
                    word: message.word
                });
            }

            return;
        }


        this.gameOver = true;

        this.gameStarted = false;


        this.onFinish({

            won,

            word:
                message.word || null
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


    getCurrentWordDisplay() {

        const result = [];


        for (
            let i = 0;
            i < this.opponentWordLength;
            i++
        ) {

            if (
                this.revealedPositions
                    .includes(i)
            ) {

                /*
                 * We need the actual character.
                 *
                 * It arrives safely inside the
                 * guess-result message through
                 * the position only, not the word.
                 *
                 * Therefore we store revealed letters.
                 */

                result.push(
                    this.revealedLetters?.[i] || "_"
                );

            } else {

                result.push("_");
            }
        }


        return result;
    }


    update() {

        if (this.onUpdate) {

            this.onUpdate({

                secret:
                    this.secret,

                hint:
                    this.hint,

                opponentWordLength:
                    this.opponentWordLength,

                opponentHint:
                    this.opponentHint,

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

                revealedPositions:
                    this.revealedPositions,

                revealedLetters:
                    this.revealedLetters || {},

                history:
                    this.history,

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

        this.opponentWordLength = 0;

        this.opponentHint = "";

        this.myReady = false;

        this.opponentReady = false;

        this.gameStarted = false;

        this.gameOver = false;

        this.currentTurn = "player1";

        this.guessedLetters = [];

        this.wrongLetters = [];

        this.revealedPositions = [];

        this.revealedLetters = {};

        this.history = [];

        this.lastResult = null;

        this.showHint = false;

        this.opponentGuessedCorrectLetters = [];

        this.update();
    }


    reset() {

        this.resetForRematch();
    }
}
