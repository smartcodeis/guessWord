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


            // Hint is now LOCAL ONLY — no network message needed.
            // The opponent's hint was already received in player-ready.


            case "play-again":

                this.resetForRematch();

                break;


            case "game-over":

                this.handleGameOver(
                    message
                );

                break;


            case "guesser-lost":

                this.handleGuesserLost(
                    message
                );

                break;


            case "word-reveal":

                this.handleWordReveal(
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

            this.trackOpponentCorrectLetter(
                letter
            );

            if (this.isOpponentWordSolved()) {
                const opponentId = this.playerId === "player1" ? "player2" : "player1";

                // Opponent finished guessing our word
                this.opponentFinished = true;
                this.opponentWon = true;

                // It is now my turn permanently
                this.currentTurn = this.playerId;

                this.send({
                    type: "turn-change",
                    player: this.playerId
                });

                this.send({
                    type: "game-over",
                    winner: opponentId,
                    word: this.secret
                });

                // If I am already finished, my modal needs updating
                if (this.gameOver) {
                    this.onFinish({
                        won: this.iWon,
                        opponentWon: true,
                        myWord: this.secret,
                        opponentWord: this.opponentRevealedWord || null
                    });
                }

                this.update();
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


        if (this.wrongLetters.length >= 10) {

            this.gameOver = true;
            this.iWon = false;

            this.send({
                type: "guesser-lost",
                word: null
            });

            this.onFinish({
                won: false,
                opponentWon: this.opponentWon,
                myWord: this.secret,
                opponentWord: this.opponentRevealedWord || null
            });

            return;
        }


        this.changeTurn();
    }


    changeTurn() {

        if (this.opponentFinished) {
            this.currentTurn = this.playerId;
        } else {
            this.currentTurn = this.playerId === "player1" ? "player2" : "player1";
        }


        this.send({

            type: "turn-change",

            player:
                this.currentTurn
        });


        this.update();
    }


    handleGameOver(message) {

        this.gameOver = true;
        this.iWon = true;

        if (message.word) {
            this.opponentRevealedWord = message.word;
        }

        this.onFinish({
            won: true,
            opponentWon: this.opponentWon,
            myWord: this.secret,
            opponentWord: this.opponentRevealedWord
        });

        this.update();
    }


    handleGuesserLost(message) {

        this.opponentFinished = true;
        this.opponentWon = false;

        this.currentTurn = this.playerId;

        this.send({
            type: "turn-change",
            player: this.playerId
        });

        this.send({
            type: "word-reveal",
            word: this.secret
        });

        if (this.gameOver) {
            this.onFinish({
                won: this.iWon,
                opponentWon: false,
                myWord: this.secret,
                opponentWord: this.opponentRevealedWord || null
            });
        }

        this.update();
    }


    handleWordReveal(message) {

        this.opponentRevealedWord = message.word;

        if (this.gameOver) {
            this.onFinish({
                won: this.iWon,
                opponentWon: this.opponentWon,
                myWord: this.secret,
                opponentWord: this.opponentRevealedWord
            });
        }
    }


    requestHint() {

        if (!this.gameStarted) {
            return;
        }


        /*
         * Hint is LOCAL ONLY.
         * We show the opponent's hint that was
         * already received during the ready phase.
         * No network message is sent.
         */

        this.showHint = true;


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

        this.iWon = false;
        this.opponentFinished = false;
        this.opponentWon = false;
        this.opponentRevealedWord = null;

        this.update();
    }


    reset() {

        this.resetForRematch();
    }
}
