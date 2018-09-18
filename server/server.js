'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');


/**
 * HTTP Server Port on which to serve files.
 *
 * @type {Number}
 */
const SERVER_PORT = process.env.PORT || 3001;


/**
 * HTTP Request handler.
 *
 * @param {Object} request  Request Handler.
 * @param {Object} response Response Handler.
 * @access private
 */
const _requestHandler = (request, response) => {
    let filePath = '.' + request.url;
    if (filePath === './') {
        filePath = './index.html';
    }
    filePath = path.join(__dirname, '..', 'dist', filePath);

    const fileExtension = path.extname(filePath);
    let contentType = 'text/html';
    switch (fileExtension) {
        case '.js':
            contentType = 'text/javascript';
            break;
        case '.css':
            contentType = 'text/css';
            break;
        case '.json':
            contentType = 'application/json';
            break;
        case '.png':
            contentType = 'image/png';
            break;
        case '.jpg':
            contentType = 'image/jpg';
            break;
        case '.wav':
            contentType = 'audio/wav';
            break;
        default:
            // Nothing to do.
            break;
    }

    // Handle "manifest.json" file:
    if (filePath.indexOf('manifest.json') !== -1) {
        contentType = 'application/manifest+json';
    }

    fs.readFile(filePath, (error, content) => {
        if (error) {
            response.writeHead(404);
            response.end(`Sorry, check with the site admin for error: ${error.code}`);
            response.end();
        } else {
            response.writeHead(200, { 'Content-Type': contentType });
            response.end(content, 'utf-8');
        }
    });
};


const options = {
    key: fs.readFileSync(path.join(__dirname, '..', 'server', 'privkey.pem')),
    cert: fs.readFileSync(path.join(__dirname, '..', 'server', 'fullchain.pem'))
};

const _server = https.createServer(options, _requestHandler);
_server.listen(SERVER_PORT, '0.0.0.0', () => {
    console.log('Server running on port %d', SERVER_PORT);
});
