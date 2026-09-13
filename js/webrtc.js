export class WebRTCManager {

    constructor({
        onConnected,
        onMessage,
        onDisconnected,
        onError
    }) {
        this.peer = null;
        this.connection = null;
        this.onConnected = onConnected;
        this.onMessage = onMessage;
        this.onDisconnected = onDisconnected;
        this.onError = onError;

        // Reconnection state
        this._roomCode = null;
        this._isHost = false;
        this._destroyed = false;
        this._reconnecting = false;
        this._reconnectAttempts = 0;
        this._maxReconnectAttempts = 20;
        this._reconnectDelay = 2000;       // ms بين كل محاولة
        this._reconnectTimer = null;

        // Heartbeat
        this._heartbeatInterval = null;
        this._heartbeatTimeout = null;
        this._heartbeatMs = 5000;          // كل 5 ثواني
        this._heartbeatTimeoutMs = 12000;  // لو مفيش رد في 12 ث نعتبره منفصل

        // Queue messages when reconnecting
        this._pendingMessages = [];

        // Visibility / focus listeners (مهم للموبايل)
        this._onVisibilityChange = this._handleVisibilityChange.bind(this);
        this._onFocus = this._handleFocus.bind(this);
        document.addEventListener("visibilitychange", this._onVisibilityChange);
        window.addEventListener("focus", this._onFocus);
    }


    /* ─────────────────────────────────────────────
       PUBLIC API
    ───────────────────────────────────────────── */

    createRoom(roomCode) {
        this._roomCode = roomCode;
        this._isHost = true;
        this._destroyed = false;
        return this._openPeer(`ng-${roomCode}-host`);
    }

    joinRoom(roomCode) {
        this._roomCode = roomCode;
        this._isHost = false;
        this._destroyed = false;
        return this._openPeer(null); // guest gets random PeerJS id
    }

    send(message) {
        if (this.connection && this.connection.open) {
            try {
                this.connection.send(message);
                return;
            } catch (e) {
                // سقط — هنحاول reconnect
            }
        }
        // احتفظ بالرسالة ريحها لما نتصل تاني
        this._pendingMessages.push(message);
        this._scheduleReconnect();
    }

    disconnect() {
        this._destroyed = true;
        this._clearReconnectTimer();
        this._stopHeartbeat();
        this._removeEventListeners();
        try { this.connection?.close(); } catch { }
        try { this.peer?.destroy(); } catch { }
        this.connection = null;
        this.peer = null;
    }


    /* ─────────────────────────────────────────────
       PEER SETUP
    ───────────────────────────────────────────── */

    _openPeer(peerId) {
        return new Promise((resolve, reject) => {
            // نضمن تنظيف أي peer قديم
            try { this.peer?.destroy(); } catch { }
            this.peer = peerId ? new Peer(peerId) : new Peer();

            this.peer.on("open", () => {
                if (this._isHost) {
                    this._listenForConnections();
                } else {
                    this._connectToHost();
                }
                resolve();
            });

            this.peer.on("error", error => {
                const msg = this.getErrorMessage(error);

                // unavailable-id = الكود مش موجود أو اتمسح
                if (error.type === "unavailable-id" && this._isHost) {
                    // الـ host id اتأخد من peer تاني، استنى وحاول
                    this._scheduleReconnect();
                    return;
                }

                // peer-unavailable: الـ guest مش لاقي الـ host
                if (error.type === "peer-unavailable" && !this._isHost) {
                    this._scheduleReconnect();
                    return;
                }

                this.onError?.(msg);
                reject(error);
            });

            this.peer.on("disconnected", () => {
                // PeerJS signaling server انفصل — حاول reconnect
                if (!this._destroyed) {
                    try { this.peer.reconnect(); } catch { }
                }
            });
        });
    }

    _listenForConnections() {
        if (!this.peer) return;

        this.peer.on("connection", conn => {
            // لو في connection قديمة مفتوحة، اغلقها
            if (this.connection && this.connection.open) {
                // اقبل الجديدة فقط لو هي نفس الـ peer (reconnect)
                if (this.connection.peer !== conn.peer) {
                    conn.close();
                    return;
                }
                try { this.connection.close(); } catch { }
            }
            this._setupConnection(conn);
        });
    }

    _connectToHost() {
        if (!this.peer || this._destroyed) return;
        const hostId = `ng-${this._roomCode}-host`;
        const conn = this.peer.connect(hostId, {
            reliable: true,
            serialization: "json"
        });
        this._setupConnection(conn);
    }


    /* ─────────────────────────────────────────────
       CONNECTION SETUP
    ───────────────────────────────────────────── */

    _setupConnection(conn) {
        this.connection = conn;
        this._reconnecting = false;
        this._reconnectAttempts = 0;

        conn.on("open", () => {
            this._clearReconnectTimer();
            this._startHeartbeat();
            this._flushPendingMessages();
            this.onConnected?.();
        });

        conn.on("data", data => {
            // Heartbeat handling — transparent to the game
            if (data && data.type === "__ping__") {
                this._sendRaw({ type: "__pong__" });
                return;
            }
            if (data && data.type === "__pong__") {
                this._resetHeartbeatTimeout();
                return;
            }
            this.onMessage?.(data);
        });

        conn.on("close", () => {
            this._stopHeartbeat();
            if (!this._destroyed) {
                this._scheduleReconnect();
            } else {
                this.onDisconnected?.();
            }
        });

        conn.on("error", err => {
            if (!this._destroyed) {
                this._scheduleReconnect();
            }
        });
    }


    /* ─────────────────────────────────────────────
       HEARTBEAT  (يحافظ على الاتصال حي)
    ───────────────────────────────────────────── */

    _startHeartbeat() {
        this._stopHeartbeat();
        this._heartbeatInterval = setInterval(() => {
            if (this.connection?.open) {
                this._sendRaw({ type: "__ping__" });
                // لو مفيش رد في _heartbeatTimeoutMs → reconnect
                this._heartbeatTimeout = setTimeout(() => {
                    if (!this._destroyed) {
                        this._scheduleReconnect();
                    }
                }, this._heartbeatTimeoutMs);
            }
        }, this._heartbeatMs);
    }

    _stopHeartbeat() {
        if (this._heartbeatInterval) {
            clearInterval(this._heartbeatInterval);
            this._heartbeatInterval = null;
        }
        this._resetHeartbeatTimeout();
    }

    _resetHeartbeatTimeout() {
        if (this._heartbeatTimeout) {
            clearTimeout(this._heartbeatTimeout);
            this._heartbeatTimeout = null;
        }
    }

    _sendRaw(message) {
        try {
            if (this.connection?.open) {
                this.connection.send(message);
            }
        } catch { }
    }


    /* ─────────────────────────────────────────────
       RECONNECT
    ───────────────────────────────────────────── */

    _scheduleReconnect() {
        if (this._destroyed || this._reconnecting) return;
        if (this._reconnectAttempts >= this._maxReconnectAttempts) {
            this.onDisconnected?.();
            this.onError?.("Connection lost. Please rejoin the room.");
            return;
        }

        this._reconnecting = true;
        this._stopHeartbeat();

        const delay = Math.min(
            this._reconnectDelay * Math.pow(1.3, this._reconnectAttempts),
            15000
        );
        this._reconnectAttempts++;

        this._reconnectTimer = setTimeout(() => {
            this._reconnecting = false;
            if (!this._destroyed) {
                this._doReconnect();
            }
        }, delay);
    }

    _doReconnect() {
        if (this._destroyed) return;

        // أغلق الـ peer القديم بهدوء
        try { this.connection?.close(); } catch { }

        if (this._isHost) {
            // الـ host يعيد فتح نفس الـ peer id
            this._openPeer(`ng-${this._roomCode}-host`).catch(() => {
                this._scheduleReconnect();
            });
        } else {
            // الـ guest يعيد connect للـ host
            if (this.peer && !this.peer.destroyed) {
                this._connectToHost();
            } else {
                this._openPeer(null).then(() => {
                    this._connectToHost();
                }).catch(() => {
                    this._scheduleReconnect();
                });
            }
        }
    }

    _clearReconnectTimer() {
        if (this._reconnectTimer) {
            clearTimeout(this._reconnectTimer);
            this._reconnectTimer = null;
        }
    }

    _flushPendingMessages() {
        while (this._pendingMessages.length > 0) {
            const msg = this._pendingMessages.shift();
            try {
                this.connection?.send(msg);
            } catch { }
        }
    }


    /* ─────────────────────────────────────────────
       VISIBILITY / FOCUS (موبايل)
    ───────────────────────────────────────────── */

    _handleVisibilityChange() {
        if (document.visibilityState === "visible") {
            this._checkAndHeal();
        }
    }

    _handleFocus() {
        this._checkAndHeal();
    }

    _checkAndHeal() {
        if (this._destroyed) return;
        // لو الاتصال مش مفتوح → reconnect فوراً
        if (!this.connection || !this.connection.open) {
            this._reconnectAttempts = 0; // أعد المحاولات من الأول
            this._scheduleReconnect();
        }
    }

    _removeEventListeners() {
        document.removeEventListener("visibilitychange", this._onVisibilityChange);
        window.removeEventListener("focus", this._onFocus);
    }


    /* ─────────────────────────────────────────────
       HELPERS
    ───────────────────────────────────────────── */

    getErrorMessage(error) {
        if (!error) return "Connection failed.";
        switch (error.type) {
            case "peer-unavailable":
                return "Room not found or host is offline.";
            case "unavailable-id":
                return "This room code is already in use.";
            case "network":
                return "Network connection failed.";
            case "server-error":
                return "Signaling server error.";
            case "socket-error":
                return "Connection server error.";
            default:
                return error.message || "Connection failed.";
        }
    }
}
