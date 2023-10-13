import assert from 'assert';
import Server from './Server';
import {
    Assertion,
    StatusAssertion,
    BodyAssertion,
    HeaderAssertion,
    AssertionContext,
} from './Assertions';

export default class Test implements PromiseLike<Response> {
    private _pServer: Promise<Server>;
    private _description: string;
    private _result: Promise<Response>;
    private _assertions: Assertion[] = [];

    constructor(pServer: Promise<Server>, url: string | Request, init?: RequestInit) {
        this._pServer = pServer;
        if (typeof url === 'string') {
            const method = ((init && init.method) || 'get').toUpperCase();
            this._description = `${method} ${url}`;
        } else {
            const method = (url.method || (init && init.method) || 'get').toUpperCase();
            this._description = `${method} ${url}`;
        }

        this._result = this._fetchPriv(url, init);
    }

    private _fetchPriv(url: string | Request, init?: RequestInit) {
        return this._pServer.then((server) => {
            let result: Promise<Response>;

            if (typeof url === 'string') {
                const requestUrl = server.url + url;
                result = fetch(requestUrl, init);
            } else {
                const request = new Request(server.url + url.url, {
                    method: url.method,
                    headers: url.headers,
                    body: url.body,
                    redirect: url.redirect,
                });
                result = fetch(request, init);
            }
            return result;
        });
    }

    /**
     * Verify status code and body.
     *
     * @param statusCode - The expected status code.
     * @param [body] - The expected body.
     */
    expect(statusCode: number, body?: any): this;

    /**
     * Verify a header exists.  This is an alias for `expectHeader()`.
     *
     * @param header - The header name.
     * @param value - The expected header value.
     */
    expect(header: string, value: string | string[] | number | RegExp): this;

    /**
     * Verify body exists.  This is an alias for `expectBody()`.
     *
     * @param body - The expected body.  If this is an object, then we expect
     *
     * @param value - The expected header value.
     */
    expect(body: any): this;

    expect(a: any, b?: any): this {
        if (typeof a === 'number') {
            this.expectStatus(a);
            if (arguments.length === 2) {
                this.expectBody(b);
            }
        } else if (typeof a === 'string' && arguments.length === 2) {
            this.expectHeader(a, b);
        } else {
            this.expectBody(a);
        }
        return this;
    }

    /**
     * Verify the status code (and optionally the status text) of a response.
     *
     * @param statusCode - Expected status code.
     * @param [statusText] - Expected status text.
     */
    expectStatus(statusCode: number, statusText?: string) {
        this._assertions.push(new StatusAssertion(statusCode, statusText));
        return this;
    }

    /**
     * Verify the body of a response.
     *
     * @param expectedBody - The body to verify.  This can be either a string, a regex,
     *   or a JSON object.  If an object, this will treat the response like JSON
     *   data.  Passing `null` or `undefined` to expectBody will verify that the
     *   response has no content-length or transfer-encoding header.
     */
    expectBody(expectedBody: any) {
        this._assertions.push(new BodyAssertion(expectedBody));
        return this;
    }

    /**
     * Verifies a header exists and has the specified value.
     *
     * @param name - The header to check for.
     * @param value - The value to verify.  If `null` or `undefined`, this will
     *   verify the header is not present.
     */
    expectHeader(name: string, value: string | string[] | number | undefined | RegExp | null) {
        this._assertions.push(new HeaderAssertion(name, value));
        return this;
    }

    end() {
        const expected: any = {};
        const actual: any = {};
        const context: AssertionContext = {};

        return this._result.then(
            async (response) => {
                const server = await this._pServer;
                server.close();

                let message: string | undefined;
                for (const assertion of this._assertions) {
                    const assertionMessage = await assertion.execute(
                        actual,
                        expected,
                        response,
                        context
                    );
                    message = message || assertionMessage;
                }
                assert.deepStrictEqual(
                    actual,
                    expected,
                    message ? this._should(message) : undefined
                );

                return response;
            },
            (err) =>
                this._pServer.then((server) => {
                    server.close();
                    throw err;
                })
        );
    }

    /**
     * Tests are 'thennable', so you can treat them like a Promise and get back
     * the WHAT-WG fetch response.
     */
    then(onfulfilled?: (res: Response) => any, onrejected?: (err: Error) => any) {
        return this.end().then(onfulfilled, onrejected);
    }

    private _should(message: string) {
        return `Request "${this._description}" should ${message}`;
    }

    /**
     * Returns the JSON contents of the response.
     */
    async json() {
        const response = await this.end();
        return await response.json();
    }
}
