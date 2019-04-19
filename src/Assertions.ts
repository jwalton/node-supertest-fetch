import * as fetch from 'node-fetch';
import assert from 'assert';

const MAX_SHORT_BODY_LENGTH = 80;

async function getBody(response: fetch.Response, context: AssertionContext) {
    if (context.body === undefined) {
        context.body = await response.text();
    }
    return context.body;
}

async function getShortBody(response: fetch.Response, context: AssertionContext) {
    const body = await getBody(response, context);
    const firstLine = body.split('\n')[0];
    if (firstLine.length > MAX_SHORT_BODY_LENGTH) {
        return firstLine.slice(0, MAX_SHORT_BODY_LENGTH) + '...';
    } else {
        return firstLine;
    }
}

export interface AssertionContext {
    body?: string;
}

export interface Assertion {
    type: string;
    canAdd(expected: any): boolean;
    execute(
        actual: any,
        expected: any,
        response: fetch.Response,
        context: AssertionContext
    ): Promise<string | undefined> | string | undefined;
}

// throw new assert.AssertionError({
//     message: this._should(
//         `have JSON body but body could not be parsed: ${err.message}`
//     ),
//     expected: expectedBody,
//     actual: textBody,
//     operator: 'deepStrictEqual',
// });

export class StatusAssertion implements Assertion {
    type = 'status';

    private _code: number;
    private _text?: string;

    constructor(status: number, statusText?: string) {
        this._code = status;
        this._text = statusText;
    }

    canAdd(expected: any) {
        return !('status' in expected) || expected.status === this._code;
    }

    async execute(actual: any, expected: any, response: fetch.Response, context: AssertionContext) {
        expected.status =
            typeof this._text === 'string' ? `${this._code} - ${this._text}` : `${this._code}`;
        actual.status =
            typeof this._text === 'string'
                ? `${response.status} - ${response.statusText}`
                : `${response.status}`;

        if (expected.status !== actual.status) {
            let body;
            try {
                body = ` (body was: ${await getShortBody(response, context)})`;
            } catch (err) {
                body = '';
            }

            if (!('body' in actual)) {
                actual.body = await getBody(response, context);
                const contentType = response.headers.get('content-type') || '';
                if (contentType.toLowerCase().includes('json')) {
                    try {
                        actual.body = JSON.parse(actual.body);
                    } catch {
                        // Ignore
                    }
                }
            }

            return `have status code ${expected.status} but was ${actual.status}${body}`;
        }

        return undefined;
    }
}

export class BodyAssertion implements Assertion {
    type = 'body';

    private _expectedBody: any;

    constructor(expected: any) {
        this._expectedBody = expected;
    }

    canAdd(expected: any) {
        return !('body' in expected) || expected.body === this._expectedBody;
    }

    async execute(actual: any, expected: any, response: fetch.Response, context: AssertionContext) {
        let message: string | undefined;

        if (typeof this._expectedBody === 'string') {
            expected.body = this._expectedBody;
            actual.body = await getBody(response, context);

            if (expected.body !== actual.body) {
                message = `have expected body`;
            }
        } else if (this._expectedBody instanceof RegExp) {
            const regex = this._expectedBody as RegExp;
            actual.body = await getBody(response, context);
            expected.body = !!regex.exec(actual.body)
                ? actual.body
                : `a body with a value that matches ${regex}`;

            if (!!regex.exec(actual.body)) {
                expected.body = actual.body;
            } else {
                expected.body = `a body with a value that matches ${regex}`;
                message = `have a body with a value that matches ${regex}`;
            }
        } else if (this._expectedBody && typeof this._expectedBody === 'object') {
            expected.body = this._expectedBody;

            const textBody = await getBody(response, context);
            try {
                actual.body = JSON.parse(textBody);
                try {
                    assert.deepStrictEqual(expected.body, actual.body);
                } catch (err) {
                    message = `have expected JSON body`;
                }
            } catch (err) {
                actual.body = textBody;
                message = `have JSON body but body could not be parsed: ${err.toString()}`;
            }
        } else {
            // Expect no body.
            actual.headers = actual.headers || {};
            expected.headers = expected.headers || {};

            actual.headers['content-length'] = response.headers.get('content-length');
            expected.headers['content-length'] = null;

            actual.headers['transfer-encoding'] = response.headers.get('transfer-encoding');
            expected.headers['transfer-encoding'] = null;

            if (actual.headers['content-length'] || actual.headers['transfer-encoding']) {
                message = `have no body`;
            }
        }

        return message;
    }
}

export class HeaderAssertion implements Assertion {
    type = 'header';

    private _name: string;
    private _value: string | string[] | number | undefined | RegExp | null;

    constructor(name: string, value: string | string[] | number | undefined | RegExp | null) {
        this._name = name;
        this._value = value;
    }

    canAdd() {
        return true;
    }

    execute(actual: any, expected: any, response: fetch.Response) {
        actual.headers = actual.headers || {};
        expected.headers = expected.headers || {};

        let result: string | undefined;

        if (this._value === undefined || this._value === null) {
            expected.headers[this._name] = null;
            actual.headers[this._name] = response.headers.get(this._name);

            if (expected.headers[this._name] !== actual.headers[this._name]) {
                result = `have no header ${this._name} but has "${actual.headers[this._name]}"`;
            }
        } else if ((this._value as RegExp).exec) {
            const regex = this._value as RegExp;
            const headerValue = response.headers.get(this._name);
            actual.headers[this._name] = headerValue;

            if (headerValue && !!regex.exec(headerValue)) {
                expected.headers[this._name] = actual.headers[this._name];
            } else {
                expected.headers[this._name] = `a header that matches ${regex}`;
                result = `a header ${this._name} which matches ${regex}`;
            }
        } else if (typeof this._value === 'string' || typeof this._value === 'number') {
            expected.headers[this._name] = '' + this._value;
            actual.headers[this._name] = response.headers.get(this._name);

            if (expected.headers[this._name] !== actual.headers[this._name]) {
                result = `have correct header ${this._name}"`;
            }
        } else if (Array.isArray(this._value)) {
            expected.headers[this._name] = this._value.join(', ');
            actual.headers[this._name] = response.headers.get(this._name);

            if (expected.headers[this._name] !== actual.headers[this._name]) {
                result = `have correct header ${this._name}"`;
            }
        } else {
            throw new Error(`expectHeader expects a string or array of strings`);
        }

        return result;
    }
}
