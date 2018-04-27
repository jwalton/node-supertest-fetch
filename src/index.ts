import http from 'http';
import * as nodeFetch from 'node-fetch';
import Server from './Server';
import Test from './Test';

export { Test };
export {
    Body,
    Request,
    RequestInit,
    RequestContext,
    RequestMode,
    RequestRedirect,
    RequestCredentials,
    RequestCache,
    Headers,
    Response,
    ResponseType,
    ResponseInit,
    HeaderInit,
    BodyInit,
    RequestInfo
} from 'node-fetch';

export default function fetch(
    server: http.Server,
    url: string | nodeFetch.Request,
    init?: nodeFetch.RequestInit
): Test {
    if(!server || !server.listen || !server.address || !server.close) {
        throw new Error("Expected server");
    }
    if(!url) {
        throw new Error("Expected url to fetch");
    }

    const pServer = Server.create(server);
    return new Test(pServer, url, init);
}

export function makeFetch(server: http.Server) {
    if(!server || !server.listen || !server.address || !server.close) {
        throw new Error("Expected server");
    }
    const pServer = Server.create(server);

    return function fetch(
        url: string | nodeFetch.Request,
        init?: nodeFetch.RequestInit
    ) {
        return new Test(pServer, url, init);
    };
}

export {fetch};