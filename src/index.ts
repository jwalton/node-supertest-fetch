import { createServer, Server as HttpServer, RequestListener } from 'node:http';
import Server from './Server';
import Test from './Test';

export { Test };
export { request };

export interface IExpressLike extends RequestListener {
    route<T extends string>(prefix: T): any;
}

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
 *   has 'expect' methods on it.
 */
export default function request(
    server: HttpServer,
    url: string | Request,
    init?: RequestInit
): Test {
    if (!server || !server.listen || !server.address || !server.close) {
        throw new Error('Expected server');
    }
    if (!url) {
        throw new Error('Expected url to fetch');
    }

    const pServer = Server.create(server);
    return new Test(pServer, url, init);
}

export type FetchFunction = (url: string | Request, init?: RequestInit | undefined) => Test;

/**
 * Creates a `request` function for a server.
 *
 * @param server - The server to fetch from.  If the server is not already
 * listening, th server will be started before each call to `request()`, and
 * closed after each call.
 * @returns - a `request(url, options)` function, compatible with WHATWG
 *  fetch, but which returns `Test` objects.
 */
export function makeRequest(target: HttpServer | IExpressLike): FetchFunction {
    // if we were given an express app
    const server = target && 'route' in target ? createServer(target) : target;

    if (!server || !server.listen || !server.address || !server.close) {
        throw new Error('Expected server');
    }

    return function request(url: string | Request, init?: RequestInit) {
        const pServer = Server.create(server);
        return new Test(pServer, url, init);
    };
}
