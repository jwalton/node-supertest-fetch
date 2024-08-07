import http from 'node:http';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { fetch } from '../src';

chai.use(chaiAsPromised);
const { expect } = chai;

describe('supertest-fetch errors', function () {
    beforeEach(function () {
        this.server = http.createServer((req, res) => {
            if (req.url === '/hello') {
                res.setHeader('content-type', 'application/json');
                res.end(JSON.stringify({ greeting: 'Hello!' }));
            } else if (req.url === '/hellotext') {
                res.end('Hello');
            } else if (req.url === '/err') {
                res.setHeader('content-type', req.headers['content-type'] || 'text/plain');
                res.statusCode = 400;
                res.end('Boom!\nLong message\n');
            } else {
                res.statusCode = 404;
                res.end();
            }
        });

        this.closed = 0;
        const origClose = this.server.close.bind(this.server);
        this.server.close = () => {
            this.closed++;
            origClose();
        };
    });

    it('should generate an error for a status code which includes the first line of the body', async function () {
        try {
            await fetch(this.server, '/err').expectStatus(200);
            expect('should have produced an error').to.not.exist;
        } catch (e: unknown) {
            const err = e as { message: string, expected: unknown, actual: unknown };
            expect(err.message).to.equal(
                'Request "GET /err" should have status code 200 but was 400 (body was: Boom!)'
            );
            expect(err.expected).to.eql({ status: '200' });
            expect(err.actual).to.eql({
                body: 'Boom!\nLong message\n',
                status: '400',
            });
        }
    });

    it('should generate an error for a status code, with an expectBody', async function () {
        try {
            await fetch(this.server, '/err').expectBody(/.*/).expectStatus(200);
            expect('should have produced an error').to.not.exist;
        } catch (e: unknown) {
            const err = e as { message: string };
            expect(err.message).to.equal(
                'Request "GET /err" should have status code 200 but was 400 (body was: Boom!)'
            );
        }
    });

    it('should generate a meaninful error when we are expecting JSON but get back text', async function () {
        try {
            await fetch(this.server, '/hellotext').expectBody({ message: 'hello' });
            expect('should have produced an error').to.not.exist;
        } catch (e: unknown) {
            const err = e as { message: string };
            const node18Message =
                'Request "GET /hellotext" should have JSON body but ' +
                'body could not be parsed: SyntaxError: Unexpected token H in JSON at position 0';
            const node20Message =
                'Request "GET /hellotext" should have JSON body but ' +
                `body could not be parsed: SyntaxError: Unexpected token 'H', "Hello" is not valid JSON`;

            expect(err.message === node18Message || err.message === node20Message).to.be.true;
        }
    });
});
