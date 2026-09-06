import { Storage } from "./storage.js";

export class Game {

    constructor({
        playerId,
        roomCode,
        send,
        onUpdate,
        onFinish
    }) {

        this.playerId = playerId;

        // Game Code → لربط الـ Save بالـ Code
        this.roomCode = roomCode;

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

        // يُحمَّل من Storage في main.js
        this.scores = {
            player1: 0,
            player2: 0
        };

        // عدد الأخطاء المتبقية لكل لاعب (من 10)
        this.myWrongCount = 0;

        this.opponentWrongCount = 0;

        this.myAttemptsExhausted = false;

        this.opponentAttemptsExhausted = false;


        // Letters I guessed (for my turn — guessing opponent's word).
        this.guessedLetters = [];


        // Wrong letters in my guessing session.
        this.wrongLetters = [];


        // Positions revealed by the opponent (in the opponent's word).
        this.revealedPositions = [];

        // Letters revealed at each position.
        this.revealedLetters = {};


        // History of my guesses.
        this.history = [];


        this.lastResult = null;

        this.showHint = false;


        // Track opponent's correct guesses (defender side).
        this.opponentGuessedCorrectLetters = [];

        this.iWon = false;
        this.opponentFinished = false;
        this.opponentWon = false;
        this.opponentRevealedWord = null;
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


        if (this.myAttemptsExhausted) {

            throw new Error(
                "You have no more attempts."
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
         * the opponent wins → end round immediately.
         */

        if (exists) {

            this._trackOpponentCorrectLetter(
                letter
            );

            if (this._isOpponentWordSolved()) {

                const opponentId =
                    this.playerId === "player1"
                        ? "player2"
                        : "player1";

                // نزيد النقطة مباشرةً في Storage
                const newScores = Storage.incrementScore(
                    this.roomCode,
                    opponentId
                );

                if (newScores) {
                    this.scores = newScores;
                }

                this.opponentFinished = true;
                this.opponentWon = true;
                this.gameOver = true;
                this.iWon = false;

                this.send({
                    type: "game-over",
                    winner: opponentId,
                    word: this.secret
                });

                this.onFinish({
                    won: false,
                    opponentWon: true,
                    myWord: this.secret,
                    opponentWord: this.opponentRevealedWord || null,
                    scores: this.scores
                });

                this.update();
                return;
            }
        }
    }


    /*
     * Letters correctly guessed by the opponent.
     * Stored only on the defender's device.
     */

    _trackOpponentCorrectLetter(letter) {

        if (
            !this.opponentGuessedCorrectLetters
                .includes(letter)
        ) {

            this.opponentGuessedCorrectLetters.push(
                letter
            );
        }
    }


    _isOpponentWordSolved() {

        if (!this.secret) {
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
         * Correct letter → wait for game-over from opponent
         * or keep playing.
         */

        if (message.exists) {

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

        this.myWrongCount = this.wrongLetters.length;


        if (this.wrongLetters.length >= 10) {

            // انتهت محاولاتي
            this.myAttemptsExhausted = true;

            this.send({
                type: "guesser-lost",
                word: null
            });

            // إذا كان الخصم أيضاً انتهت محاولاته → تعادل
            if (this.opponentAttemptsExhausted) {

                this.gameOver = true;
                this.iWon = false;

                this.onFinish({
                    won: false,
                    opponentWon: false,
                    myWord: this.secret,
                    opponentWord: this.opponentRevealedWord || null,
                    scores: this.scores
                });

            } else {

                // الخصم لم ينته بعد → ننتظر ولا نغير الدور
                // (الدور سيُعطى للخصم من handleGuesserLost عنده)
                this._giveTurnToOpponent();
            }

            this.update();
            return;
        }

        this._changeTurnAfterWrongGuess();
    }


    /**
     * تغيير الدور بعد خطأ عادي (لم تنتهِ المحاولات بعد).
     */
    _changeTurnAfterWrongGuess() {

        const opponentId =
            this.playerId === "player1"
                ? "player2"
                : "player1";

        // إذا انتهت محاولات الخصم → يبقى الدور عندي
        if (this.opponentAttemptsExhausted || this.opponentFinished) {

            // الدور يبقى عندي
            this.send({
                type: "turn-change",
                player: this.playerId
            });

            this.update();
            return;
        }

        // الدور ينتقل للخصم
        this.currentTurn = opponentId;

        this.send({
            type: "turn-change",
            player: opponentId
        });

        this.update();
    }


    /**
     * إعطاء الدور للخصم (بعد انتهاء محاولاتي).
     */
    _giveTurnToOpponent() {

        const opponentId =
            this.playerId === "player1"
                ? "player2"
                : "player1";

        this.currentTurn = opponentId;

        this.send({
            type: "turn-change",
            player: opponentId
        });
    }


    handleGameOver(message) {

        this.gameOver = true;
        this.iWon = true;

        // نزيد النقطة في Storage
        const newScores = Storage.incrementScore(
            this.roomCode,
            this.playerId
        );

        if (newScores) {
            this.scores = newScores;
        }

        if (message.word) {
            this.opponentRevealedWord = message.word;
        }

        this.onFinish({
            won: true,
            opponentWon: this.opponentWon,
            myWord: this.secret,
            opponentWord: this.opponentRevealedWord,
            scores: this.scores
        });

        this.update();
    }


    handleGuesserLost(message) {

        this.opponentAttemptsExhausted = true;

        if (this.myAttemptsExhausted) {

            // كلاهما استنفد محاولاته → تعادل
            this.gameOver = true;
            this.opponentWon = false;
            this.iWon = false;

            this.onFinish({
                won: false,
                opponentWon: false,
                myWord: this.secret,
                opponentWord: this.opponentRevealedWord || null,
                scores: this.scores
            });

        } else {

            // أنا لم أنهِ محاولاتي → أحصل على الدور
            this.currentTurn = this.playerId;

            this.send({
                type: "turn-change",
                player: this.playerId
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
                opponentWord: this.opponentRevealedWord,
                scores: this.scores
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

                // الكلمة السرية — تُرسَل دائماً (تُخفيها الواجهة عن Player2)
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
                    this.showHint,

                scores:
                    this.scores,

                myAttemptsExhausted:
                    this.myAttemptsExhausted,

                opponentAttemptsExhausted:
                    this.opponentAttemptsExhausted,

                iWon:
                    this.iWon,

                opponentWon:
                    this.opponentWon
            });
        }


        // حفظ تلقائي لحالة اللعبة بعد كل تحديث
        this._autoSave();
    }


    /**
     * حفظ تلقائي لحالة اللعبة في Storage.
     * يحفظ كل شيء ما عدا `send`/`onUpdate`/`onFinish`.
     */
    _autoSave() {

        if (!this.roomCode) return;

        const snapshot = {
            secret: this.secret,
            hint: this.hint,
            opponentWordLength: this.opponentWordLength,
            opponentHint: this.opponentHint,
            myReady: this.myReady,
            opponentReady: this.opponentReady,
            gameStarted: this.gameStarted,
            gameOver: this.gameOver,
            currentTurn: this.currentTurn,
            guessedLetters: this.guessedLetters,
            wrongLetters: this.wrongLetters,
            revealedPositions: this.revealedPositions,
            revealedLetters: this.revealedLetters || {},
            history: this.history,
            showHint: this.showHint,
            myAttemptsExhausted: this.myAttemptsExhausted,
            opponentAttemptsExhausted: this.opponentAttemptsExhausted,
            opponentGuessedCorrectLetters: this.opponentGuessedCorrectLetters,
            iWon: this.iWon,
            opponentFinished: this.opponentFinished,
            opponentWon: this.opponentWon,
            opponentRevealedWord: this.opponentRevealedWord
        };

        Storage.saveGameState(this.roomCode, snapshot);
    }


    /**
     * يستعيد حالة اللعبة من snapshot محفوظ.
     */
    restoreState(snapshot) {

        if (!snapshot) return;


        this.secret = snapshot.secret ?? null;
        this.hint = snapshot.hint ?? "";
        this.opponentWordLength = snapshot.opponentWordLength ?? 0;
        this.opponentHint = snapshot.opponentHint ?? "";
        this.myReady = snapshot.myReady ?? false;
        this.opponentReady = snapshot.opponentReady ?? false;
        this.gameStarted = snapshot.gameStarted ?? false;
        this.gameOver = snapshot.gameOver ?? false;
        this.currentTurn = snapshot.currentTurn ?? "player1";
        this.guessedLetters = snapshot.guessedLetters ?? [];
        this.wrongLetters = snapshot.wrongLetters ?? [];
        this.revealedPositions = snapshot.revealedPositions ?? [];
        this.revealedLetters = snapshot.revealedLetters ?? {};
        this.history = snapshot.history ?? [];
        this.showHint = snapshot.showHint ?? false;
        this.myAttemptsExhausted = snapshot.myAttemptsExhausted ?? false;
        this.opponentAttemptsExhausted = snapshot.opponentAttemptsExhausted ?? false;
        this.opponentGuessedCorrectLetters = snapshot.opponentGuessedCorrectLetters ?? [];
        this.iWon = snapshot.iWon ?? false;
        this.opponentFinished = snapshot.opponentFinished ?? false;
        this.opponentWon = snapshot.opponentWon ?? false;
        this.opponentRevealedWord = snapshot.opponentRevealedWord ?? null;

        this.update();
    }


    playAgain() {

        this.send({
            type: "play-again"
        });

        this.resetForRematch();
    }


    resetForRematch() {

        // الـ Scores تُبقى كما هي (تُدار في Storage)
        // نمسح فقط حالة الجولة الحالية

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
        this.myAttemptsExhausted = false;
        this.opponentAttemptsExhausted = false;

        // امسح حالة اللعبة من Storage (لكن أبقِ الـ Scores)
        if (this.roomCode) {
            Storage.clearGameState(this.roomCode);
        }

        this.update();
    }


    reset() {

        this.resetForRematch();
    }
}
