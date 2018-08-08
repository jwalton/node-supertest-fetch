import http from 'http';
import { Express } from 'express';
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

/**
 * Fetch a resource from a server, returns a Test.
 *
 * @param server - The server to fetch from.  If the server is not already
 * listening, this function will start it listening and then will close the
 * server at the end of the test.
 * @param url - A Request or a string representing a relative URL.  Same as
 * WHATWG Fetch.  URL should be relative to the server (e.g. '/foo/bar').
 * @param options - Same as WHATWG Fetch.
 * @returns - a Test, which is like a Promise<Response>, but it also
 *   has 'exepect' methods on it.
 */
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

/**
 * Creates a `fetch` function for a server.
 *
 * @param server - The server to fetch from.  If the server is not already
 * listening, th server will be started before each call to `fetch()`, and
 * closed after each call.
 * @returns - a `fetch(url, options)` function, compatible with WHATWG
 *  fetch, but which returns `Test` objects.
 */
export function makeFetch(target: http.Server | Express) {

    // if we were given an express app
    const server = target && (target as Express).route
        ? http.createServer(target as Express)
        : (target as http.Server);

    if(!server || !server.listen || !server.address || !server.close) {
        throw new Error("Expected server");
    }

    return function fetch(
        url: string | nodeFetch.Request,
        init?: nodeFetch.RequestInit
    ) {
        const pServer = Server.create(server);
        return new Test(pServer, url, init);
    };
}

export {fetch};
