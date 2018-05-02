# supertest-fetch

[![NPM version](https://badge.fury.io/js/supertest-fetch.svg)](https://npmjs.org/package/supertest-fetch>)
[![Build Status](https://travis-ci.org/jwalton/node-supertest-fetch.svg)](https://travis-ci.org/jwalton/node-supertest-fetch)
[![Coverage Status](https://coveralls.io/repos/jwalton/node-supertest-fetch/badge.svg)](https://coveralls.io/r/jwalton/node-supertest-fetch)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![Greenkeeper badge](https://badges.greenkeeper.io/jwalton/node-supertest-fetch.svg)](https://greenkeeper.io/)

A typescript friendly alternative to Supertest, backed by node-fetch

## What is it?

This is a library heavily influenced by Visionmedia's excellent
[supertest](https://github.com/visionmedia/supertest) library.  The advantages
of this library are:

* Uses [node-fetch](https://github.com/bitinn/node-fetch) to give you a
  [WHATWG Fetch](https://github.github.io/fetch)-like interface.
* Should be instantly familiar to anyone who has used supertest.
* First class support for promises.
* Supertest has some weird quirks when used with Typescript becuase of
  [@types/superagent](https://github.com/DefinitelyTyped/DefinitelyTyped/issues/12044).

## Example

```js
import http from 'http';
import {makeFetch} from 'supertest-fetch';

const server = http.createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({greeting: "Hello!"}));
);

// This is a function with an API identical to the WHATWG `fetch()` function,
// except the returned Promise has a bunch of supertest like functions on it.
//
// If the server is not listening, then `fetch()` will call `listen()` on the
// server before each fetch, and close it after each fetch.
const fetch = makeFetch(server);

describe('my server tests', function() {
    it('should return a response', async function() {
        await fetch('/hello')
            .expect(200)
            .expect('content-type', 'application/json')
            .expect({greeting: "Hello!"});
    });

    it('will work just like fetch if you need to do more advanced things', async function() {
        const response = await fetch('/hello')
            .expect(200)
            .expect('content-type', 'application/json');

        expect(await response.json()).to.eql({greeting: "Hello!"});
    });

    it('should post data', async function() {
        await fetch('/hello', {
            method: 'post',
            body: '<message>Hello</message>',
            headers: {'content-type': 'application/xml'}
        });
    });
});
```

## API

### .expectStatus(statusCode[, statusText])

Verify response status code and text.

### .expectHeader(headerName, value)

Verify headerName matches the given value or regex.  If `value` is null,
verifies that the header is not present.

### .expectBody(body)

Verify body is the given string, JSON object, or matches the given regular expression.

### .expect(statusCode[, fn])

Supertest friendly alias for `.expectStatus(statusCode)`.

### .expect(statusCode, body)

Supertest friendly alias for `.expectStatus(statusCode).expectBody(body)`.

### .expect(body)

Supertest friendly alias for `.expectBody(body)`.

### .expect(field, value)

Supertest friendly alias for `.expectHeader(field, value)`.