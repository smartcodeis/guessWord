/**
 * Storage Module
 *
 * كل بيانات اللعبة مرتبطة بـ Game Code.
 * الـ Score والـ Roles والـ GameState تُحفظ في localStorage.
 *
 * هيكل البيانات:
 *   word_game_device_id       → string  (فريد لكل جهاز/متصفح)
 *   word_game_used_codes      → string[] (جميع الكودات المولّدة)
 *   word_game_{code}          → GameData (بيانات اللعبة)
 *
 * GameData:
 *   scores  : { player1: number, player2: number }
 *   roles   : { [deviceId]: "player1" | "player2" }
 *   state   : object | null  (حالة اللعبة الكاملة)
 */

export const Storage = {


    /* ─── Device ID ──────────────────────────────────────────────── */

    /**
     * معرّف فريد للجهاز/المتصفح.
     * يُحفظ مرة واحدة ولا يتغير أبداً.
     */
    getDeviceId() {

        let id = localStorage.getItem("word_game_device_id");

        if (!id) {
            id = this._randomId();
            localStorage.setItem("word_game_device_id", id);
        }

        return id;
    },

    _randomId() {
        return (
            Date.now().toString(36) +
            Math.random().toString(36).slice(2, 8)
        );
    },


    /* ─── Used Codes ─────────────────────────────────────────────── */

    getUsedCodes() {
        const raw = localStorage.getItem("word_game_used_codes");
        return raw ? JSON.parse(raw) : [];
    },

    _addUsedCode(code) {
        const codes = this.getUsedCodes();
        if (!codes.includes(code)) {
            codes.push(code);
            localStorage.setItem(
                "word_game_used_codes",
                JSON.stringify(codes)
            );
        }
    },

    /**
     * يولّد كود رقمي مكوّن من 6 أرقام لم يُستخدم من قبل.
     * يُسجّله تلقائياً في قائمة الكودات المستخدمة.
     */
    generateUniqueRoomCode() {
        const codes = this.getUsedCodes();
        let code;
        do {
            code = String(Math.floor(100000 + Math.random() * 900000));
        } while (codes.includes(code));

        this._addUsedCode(code);
        return code;
    },


    /* ─── Game Data ──────────────────────────────────────────────── */

    _gameKey(code) {
        return `word_game_${code}`;
    },

    /**
     * يجلب بيانات اللعبة كاملة أو ينشئها لو لم تكن موجودة.
     * @param {string} code
     * @returns {{ scores: {player1:number, player2:number}, roles: {}, state: object|null }}
     */
    getGameData(code) {
        if (!code) return null;

        const raw = localStorage.getItem(this._gameKey(code));

        if (raw) {
            return JSON.parse(raw);
        }

        // لعبة جديدة
        return {
            scores: { player1: 0, player2: 0 },
            roles: {},
            state: null
        };
    },

    /**
     * يحفظ بيانات اللعبة كاملة.
     */
    _saveGameData(code, data) {
        if (!code) return;
        localStorage.setItem(this._gameKey(code), JSON.stringify(data));
    },


    /* ─── Player Roles ───────────────────────────────────────────── */

    /**
     * يعيد دور اللاعب (player1/player2) لجهاز معين في لعبة معينة.
     * @returns {"player1"|"player2"|null}
     */
    getPlayerRole(code) {
        if (!code) return null;
        const deviceId = this.getDeviceId();
        const data = this.getGameData(code);
        return data?.roles?.[deviceId] || null;
    },

    /**
     * يحفظ دور اللاعب لهذا الجهاز في اللعبة.
     * إذا كان الدور محجوزاً بالفعل من جهاز آخر → يرفض.
     * @returns {"player1"|"player2"|"taken"|"assigned"}
     */
    assignPlayerRole(code, requestedRole) {
        if (!code) return "error";

        const deviceId = this.getDeviceId();
        const data = this.getGameData(code);

        // هل هذا الجهاز عنده دور مسبق؟
        if (data.roles[deviceId]) {
            return data.roles[deviceId];
        }

        // هل الدور المطلوب محجوز من جهاز آخر؟
        const takenBy = Object.entries(data.roles).find(
            ([id, role]) => role === requestedRole && id !== deviceId
        );

        if (takenBy) {
            // الدور محجوز → نعطيه الدور الآخر
            const otherRole =
                requestedRole === "player1" ? "player2" : "player1";

            // تحقق أن الدور الآخر أيضاً غير محجوز
            const otherTaken = Object.entries(data.roles).find(
                ([id, role]) => role === otherRole && id !== deviceId
            );

            if (otherTaken) {
                // كلا الدورين محجوزان → لا يمكن الانضمام
                return "full";
            }

            data.roles[deviceId] = otherRole;
            this._saveGameData(code, data);
            return otherRole;
        }

        // الدور متاح → احجزه
        data.roles[deviceId] = requestedRole;
        this._saveGameData(code, data);
        return requestedRole;
    },


    /* ─── Score ──────────────────────────────────────────────────── */

    getScores(code) {
        if (!code) return { player1: 0, player2: 0 };
        const data = this.getGameData(code);
        return data?.scores || { player1: 0, player2: 0 };
    },

    /**
     * يزيد نقطة للاعب الفائز في الجولة.
     */
    incrementScore(code, playerId) {
        if (!code || !playerId) return;
        const data = this.getGameData(code);
        if (data.scores[playerId] !== undefined) {
            data.scores[playerId]++;
        }
        this._saveGameData(code, data);
        return data.scores;
    },

    /**
     * يُعيد الضبط الكامل للعبة (Score + State + Roles).
     * يُستخدم فقط عند الخروج التام من اللعبة.
     */
    clearGame(code) {
        if (!code) return;
        localStorage.removeItem(this._gameKey(code));
    },


    /* ─── Game State ─────────────────────────────────────────────── */

    /**
     * يحفظ حالة اللعبة كاملة مرتبطة بالـ Game Code.
     * لا يمسّ الـ Scores أو الـ Roles.
     */
    saveGameState(code, gameStateSnapshot) {
        if (!code || !gameStateSnapshot) return;

        const data = this.getGameData(code);
        data.state = gameStateSnapshot;
        this._saveGameData(code, data);
    },

    /**
     * يجلب حالة اللعبة المحفوظة.
     * @returns {object|null}
     */
    loadGameState(code) {
        if (!code) return null;
        const data = this.getGameData(code);
        return data?.state || null;
    },

    /**
     * يمسح حالة اللعبة فقط (مع إبقاء الـ Scores والـ Roles).
     * يُستخدم عند Play Again.
     */
    clearGameState(code) {
        if (!code) return;
        const data = this.getGameData(code);
        data.state = null;
        this._saveGameData(code, data);
    }
};
