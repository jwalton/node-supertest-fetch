import * as http from 'http';
import { AddressInfo } from 'net';

export default class Server {
    private readonly _server: http.Server;
    private readonly _startedServer: boolean = false;
    readonly url: string;

    private constructor(
        server: http.Server,
        address: { port: number; family: string; address: string },
        started: boolean
    ) {
        this._server = server;
        this._startedServer = started;
        this.url = `http://localhost:${address.port}`;
    }

    static create(server: http.Server): Promise<Server> {
        return new Promise((resolve, reject) => {
            const address = server.address();
            if (typeof address === 'string') {
                throw new Error(`Can't use a server listening on a UNIX domain socket: ${address}`);
            }

            if (address !== null) {
                return resolve(new Server(server, address, false));
            }

            const errHandler = (err: any) => {
                if (err.code === 'EADDRINUSE') {
                    reject(new Error('Address in use'));
                }
            };

            // TODO: node-events-listener
            server.once('error', errHandler);

            server.once('listening', () => {
                server.removeListener('error', errHandler);
                const address = server.address() as AddressInfo;
                resolve(new Server(server, address, true));
            });

            server.listen();
        });
    }

    close() {
        if (this._startedServer) {
            this._server.close();
        }
    }
}
