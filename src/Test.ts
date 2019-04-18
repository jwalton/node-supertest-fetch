import assert from 'assert';
import * as fetch from 'node-fetch';
import * as nodeFetch from 'node-fetch';
import Server from './Server';

const MAX_SHORT_BODY_LENGTH = 80;

async function getShortBody(response: fetch.Response) {
    const body = await response.text();
    const firstLine = body.split('\n')[0];
    if (firstLine.length > MAX_SHORT_BODY_LENGTH) {
        return firstLine.slice(0, MAX_SHORT_BODY_LENGTH) + '...';
    } else {
        return firstLine;
    }
}

export default class Test implements PromiseLike<fetch.Response> {
    private _pServer: Promise<Server>;
    private _description: string;
    private _result: Promise<fetch.Response>;

    constructor(
        pServer: Promise<Server>,
        url: string | nodeFetch.Request,
        init?: nodeFetch.RequestInit
    ) {
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

    private _fetchPriv(url: string | nodeFetch.Request, init?: nodeFetch.RequestInit) {
        return this._pServer.then(server => {
            let result;

            if (typeof url === 'string') {
                const requestUrl = server.url + url;
                result = nodeFetch.default(requestUrl, init);
            } else {
                const request = new nodeFetch.Request(server.url + url.url, {
                    method: url.method,
                    headers: url.headers,
                    body: url.body,
                    redirect: url.redirect,
                    timeout: url.timeout,
                    compress: url.compress,
                    size: url.size,
                    agent: url.agent,
                    follow: url.follow,
                    counter: url.counter,
                } as nodeFetch.Request);
                result = nodeFetch.default(request, init);
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
        this._result = this._result.then(async response => {
            const expected =
                typeof statusText === 'string' ? `${statusCode} - ${statusText}` : `${statusCode}`;
            const actual =
                typeof statusText === 'string'
                    ? `${response.status} - ${response.statusText}`
                    : `${response.status}`;

            if (expected !== actual) {
                let body;
                try {
                    body = ` (body was: ${await getShortBody(response)})`;
                } catch (err) {
                    body = '';
                }

                throw new assert.AssertionError({
                    message: this._should(`have status code ${expected} but was ${actual}${body}`),
                    expected,
                    actual,
                    operator: '===',
                });
            }

            return response;
        });
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
        this._result = this._result.then(async response => {
            if (typeof expectedBody === 'string') {
                assert.strictEqual(
                    await response.text(),
                    expectedBody,
                    this._should(`have expected body`)
                );
            } else if (expectedBody instanceof RegExp) {
                const regex = expectedBody as RegExp;
                assert(
                    !!regex.exec(await response.text()),
                    this._should(`have a body with a value that matches ${regex}`)
                );
            } else if (expectedBody && typeof expectedBody === 'object') {
                const textBody = await response.text();
                let jsonBody;
                try {
                    jsonBody = JSON.parse(textBody);
                } catch (err) {
                    throw new assert.AssertionError({
                        message: this._should(
                            `have JSON body but body could not be parsed: ${err.message}`
                        ),
                        expected: expectedBody,
                        actual: textBody,
                        operator: 'deepStrictEqual',
                    });
                }
                assert.deepStrictEqual(
                    jsonBody,
                    expectedBody,
                    this._should(`have expected JSON body`)
                );
            } else {
                // Expect no body.
                assert(
                    !response.headers.has('content-length'),
                    this._should(`not have a body, but has a content-length header`)
                );
                assert(
                    !response.headers.has('transfer-encoding'),
                    this._should(`not have a body, but has a transfer-encoding header`)
                );
            }

            return response;
        });
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
        this._result = this._result.then(async response => {
            if (value === undefined || value === null) {
                if (response.headers.has(name)) {
                    assert.strictEqual(
                        response.headers.get(name),
                        undefined,
                        this._should(`not have header ${name}`)
                    );
                }
            } else {
                assert(response.headers.has(name), this._should(`have header ${name}`));

                if ((value as RegExp).exec) {
                    const regex = value as RegExp;
                    const headerValue = response.headers.get(name);
                    assert(
                        headerValue && !!regex.exec(headerValue),
                        this._should(
                            `have a header ${name} with a value that matches ${regex} but is ${headerValue}`
                        )
                    );
                } else if (typeof value === 'string' || typeof value === 'number') {
                    assert.strictEqual(
                        response.headers.get(name),
                        `${value}`,
                        this._should(`have correct header ${name}`)
                    );
                } else if (Array.isArray(value)) {
                    assert.strictEqual(
                        response.headers.getAll(name),
                        `${value}`,
                        this._should(`have correct header ${name}`)
                    );
                } else {
                    throw new Error(`expectHeader expects a string or array of strings`);
                }
            }

            return response;
        });
        return this;
    }

    end() {
        return this._result.then(
            response =>
                this._pServer.then(server => {
                    server.close();
                    return response;
                }),
            err =>
                this._pServer.then(server => {
                    server.close();
                    throw err;
                })
        );
    }

    /**
     * Tests are 'thennable', so you can treat them like a Promise and get back
     * the WHAT-WG fetch response.
     */
    then(onfulfilled?: (res: fetch.Response) => any, onrejected?: (err: Error) => any) {
        return this.end().then(onfulfilled, onrejected);
    }

    private _should(message: string) {
        return `Request "${this._description}" should ${message}`;
    }
}
