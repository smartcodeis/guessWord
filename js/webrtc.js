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
    }


    createRoom(roomCode) {

        return new Promise((resolve, reject) => {

            const peerId =
                `ng-${roomCode}-host`;


            this.peer = new Peer(peerId);


            this.peer.on("open", () => {

                resolve();

                this.setupIncomingConnection();
            });


            this.peer.on("connection", connection => {

                /*
                 * Only allow one opponent.
                 */

                if (
                    this.connection &&
                    this.connection.open
                ) {

                    connection.close();

                    return;
                }


                this.setupConnection(connection);
            });


            this.peer.on("error", error => {

                const message =
                    this.getErrorMessage(error);

                this.onError?.(message);

                reject(error);
            });
        });
    }


    joinRoom(roomCode) {

        return new Promise((resolve, reject) => {

            this.peer = new Peer();


            this.peer.on("open", () => {

                const hostId =
                    `ng-${roomCode}-host`;


                const connection =
                    this.peer.connect(
                        hostId,
                        {
                            reliable: true,
                            serialization: "json"
                        }
                    );


                this.setupConnection(connection);

                resolve();
            });


            this.peer.on("error", error => {

                const message =
                    this.getErrorMessage(error);

                this.onError?.(message);

                reject(error);
            });
        });
    }


    setupIncomingConnection() {

        /*
         * Host waits for the guest
         * through peer.on("connection")
         */
    }


    setupConnection(connection) {

        this.connection = connection;


        connection.on("open", () => {

            this.onConnected?.();
        });


        connection.on("data", data => {

            this.onMessage?.(data);
        });


        connection.on("close", () => {

            this.onDisconnected?.();
        });


        connection.on("error", error => {

            this.onError?.(
                this.getErrorMessage(error)
            );
        });
    }


    send(message) {

        if (
            !this.connection ||
            !this.connection.open
        ) {

            throw new Error(
                "No active connection."
            );
        }


        this.connection.send(message);
    }


    disconnect() {

        try {

            this.connection?.close();

        } catch {}


        try {

            this.peer?.destroy();

        } catch {}


        this.connection = null;

        this.peer = null;
    }


    getErrorMessage(error) {

        if (!error) {
            return "Connection failed.";
        }


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
                return error.message ||
                    "Connection failed.";
        }
    }
}