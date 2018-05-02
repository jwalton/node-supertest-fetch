import http from 'http';
import {fetch, makeFetch, Request} from '../src';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

chai.use(chaiAsPromised);
const {expect} = chai;

describe('supertest-fetch', function() {
    beforeEach(function() {
        this.server = http.createServer(
            (req, res) => {
                if(req.url === '/hello') {
                    res.setHeader('content-type', 'application/json');
                    res.end(JSON.stringify({greeting: "Hello!"}));
                } else if(req.url === '/text') {
                    res.end("Hello!");
                } else if(req.url === '/echo') {
                    res.setHeader('content-type', req.headers['content-type'] || 'text/plain');
                    req.pipe(res);
                } else {
                    res.statusCode = 404;
                    res.end();
                }
            }
        );

        this.closed = 0;
        const origClose = this.server.close.bind(this.server);
        this.server.close = () => {
            this.closed++;
            origClose();
        };
    });

    it('should verify a JSON request', async function() {
        await fetch(this.server, '/hello')
            .expectStatus(200)
            .expectHeader('content-type', 'application/json')
            .expectBody({greeting: "Hello!"});

        expect(this.closed, 'should close the server').to.equal(1);
    });

    it('should work with supertest API', async function() {
        await fetch(this.server, '/hello')
            .expect(200)
            .expect('content-type', 'application/json')
            .expect('content-type', /json/)
            .expect(200, {greeting: "Hello!"})
            .end();
        expect(this.closed, 'should close the server').to.equal(1);
    });

    it('should work with supertest API expect(body)', async function() {
        await fetch(this.server, '/hello')
            .expect({greeting: "Hello!"})
            .end();
        expect(this.closed, 'should close the server').to.equal(1);
    });

    it('should work with supertest API expect(body-regex)', async function() {
        await fetch(this.server, '/hello')
            .expect(/Hello/)
            .end();

        expect(this.closed, 'should close the server').to.equal(1);
    });

    it('should verify a text request', async function() {
        await fetch(this.server, '/text')
            .expectStatus(200)
            .expectHeader('content-type', null)
            .expectBody('Hello!');
        expect(this.closed, 'should close the server').to.equal(1);
    });

    it('should not care about header case', async function() {
        await fetch(this.server, '/hello')
            .expectStatus(200)
            .expectHeader('Content-Type', 'application/json')
            .expectBody({greeting: "Hello!"});
        expect(this.closed, 'should close the server').to.equal(1);
    });

    it('should fail if status code is incorrect', async function() {
        await expect(
            fetch(this.server, '/hello')
                .expectStatus(404)
                .expectHeader('content-type', 'application/json')
                .expectBody({greeting: "Hello!"})
        ).to.be.rejectedWith('Request "GET /hello" should have status code 404');
        expect(this.closed, 'should close the server').to.equal(1);
    });

    it('should fail if header is incorrect', async function() {
        await expect(
            fetch(this.server, '/hello')
                .expectStatus(200)
                .expectHeader('content-type', 'text/plain')
                .expectBody({greeting: "Hello!"})
        ).to.be.rejectedWith('Request "GET /hello" should have correct header content-type');
        expect(this.closed, 'should close the server').to.equal(1);
    });

    it('should fail if body is incorrect', async function() {
        await expect(
            fetch(this.server, '/hello')
                .expectStatus(200)
                .expectHeader('content-type', 'application/json')
                .expectBody({greeting: "Hello2!"})
        ).to.be.rejectedWith('Request "GET /hello" should have expected JSON body');
        expect(this.closed, 'should close the server').to.equal(1);
    });

    it('should post data', async function() {
        const fetch = makeFetch(this.server);
        const body = '<hello>world</hello>';
        const req = new Request('/echo', {
            method: 'post',
            body,
            headers: {'content-type': 'application/xml'}
        });
        await fetch(req)
            .expectStatus(200)
            .expectHeader('content-type', 'application/xml')
            .expectBody(body);
    });

    describe('makeFetch', function() {
        it('should generate a "fetch" function', async function() {
            const fetch = makeFetch(this.server);
            await fetch('/hello')
                .expect(200)
                .expect('content-type', 'application/json')
                .expect({greeting: "Hello!"});

            expect(this.closed, 'should close the server').to.equal(1);
        });

        it('should behave like WHATWG fetch', async function() {
            const fetch = makeFetch(this.server);
            const response = await fetch('/hello');
            expect(await response.json()).to.eql({greeting: "Hello!"});

            expect(this.closed, 'should close the server').to.equal(1);
        });

        it('should mix-and-match', async function() {
            const fetch = makeFetch(this.server);
            const response = await fetch('/hello')
                .expect(200)
                .expect('content-type', 'application/json');

            expect(await response.json()).to.eql({greeting: "Hello!"});

            expect(this.closed, 'should close the server').to.equal(1);
        });

        it('should recycle a server', async function() {
            const fetch = makeFetch(this.server);

            await fetch('/hello')
                .expectStatus(200)
                .expectHeader('content-type', 'application/json')
                .expectBody({greeting: "Hello!"});

            expect(this.closed, 'should close the server').to.equal(1);

            await fetch('/hello')
                .expectStatus(200)
                .expectHeader('content-type', 'application/json')
                .expectBody({greeting: "Hello!"});

            expect(this.closed, 'should close the server').to.equal(2);
        });

    });

    describe('server', function() {
        it('should recycle a server', async function() {
            await fetch(this.server, '/hello')
                .expectStatus(200)
                .expectHeader('content-type', 'application/json')
                .expectBody({greeting: "Hello!"});

            expect(this.closed, 'should close the server').to.equal(1);

            await fetch(this.server, '/hello')
                .expectStatus(200)
                .expectHeader('content-type', 'application/json')
                .expectBody({greeting: "Hello!"});

            expect(this.closed, 'should close the server').to.equal(2);
        });

        it('should close the server', async function() {
            await fetch(this.server, '/hello')
                .expectStatus(200)
                .expectHeader('content-type', 'application/json')
                .expectBody({greeting: "Hello!"});

            expect(this.closed, 'should close the server').to.equal(1);
        });

        it('should not close the server if we start it listening first', async function() {
            this.server.listen();
            await expect(
                fetch(this.server, '/hello').expectStatus(404)
            ).to.be.rejectedWith('Request "GET /hello" should have status code 404');
            expect(this.closed, 'should close the server').to.equal(0);
            this.server.close();
        });

    });
});