import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import https, { Server } from 'https';
import { makeRequest } from '../src';
import pem from 'pem';

chai.use(chaiAsPromised);
const { expect } = chai;

describe('https', function () {
    let keys: pem.CertificateCreationResult;
    let server: Server;
    let closed = 0;

    beforeEach(async function () {
        // Create a new self-signed certificate.
        keys = await new Promise<pem.CertificateCreationResult>((resolve, reject) => {
            pem.createCertificate({ days: 30, selfSigned: true }, (err, keys) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(keys);
                }
            });
        });

        // Create a new HTTPS server.
        const credentials: https.ServerOptions = {
            key: keys.serviceKey,
            cert: keys.certificate,
            rejectUnauthorized: false,
        };
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

        server = https.createServer(credentials, (req, res) => {
            if (req.url === '/hello') {
                res.setHeader('content-type', 'application/json');
                res.end(JSON.stringify({ greeting: 'Hello!' }));
            } else {
                res.statusCode = 404;
                res.end();
            }
        });

        // Keep track of how often the server was closed.
        closed = 0;
        const origClose = server.close.bind(server);
        server.close = function () {
            closed++;
            origClose();
            return this;
        };
    });

    it('should verify a JSON request over HTTPS', async function () {
        const request = makeRequest(server);
        await request('/hello')
            .expectStatus(200)
            .expectHeader('content-type', 'application/json')
            .expectBody({ greeting: 'Hello!' });

        expect(closed, 'should close the server').to.equal(1);
    });
});
