#!/usr/bin/env node

/**
 * Lightweight static server for test-framework.html with smart port fallback.
 * Keeps everything in-process so the CLI stays running for manual playtesting.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const projectRoot = path.resolve(__dirname, '..');
const DEFAULT_PORT = parseInt(process.env.PORT || '', 10) || 8080;
const MAX_PORT = DEFAULT_PORT + 20;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf'
};

function logRequest(method, pathname, status) {
    const timestamp = new Date().toISOString();
    console.log(`[TestFramework] ${timestamp} ${status} ${method} ${pathname}`);
}

function errorPage(req, res, status, message) {
    res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(message);
    try {
        const pathname = new URL(req.url, 'http://localhost').pathname;
        logRequest(req.method, pathname, status);
    } catch (err) {
        console.warn(`[TestFramework] Failed to log error request: ${err.message}`);
    }
}

function resolveFilePath(requestUrl) {
    const parsedUrl = new URL(requestUrl, 'http://localhost');
    const decodedPath = decodeURIComponent(parsedUrl.pathname);
    const relativePath = decodedPath === '/' ? '/test-framework.html' : decodedPath;
    const targetPath = path.normalize(path.join(projectRoot, relativePath));

    if (!targetPath.startsWith(projectRoot)) {
        return null; // Prevent directory traversal
    }

    return targetPath;
}

function serveStatic(req, res) {
    const { pathname } = new URL(req.url, 'http://localhost');
    const filePath = resolveFilePath(req.url);

    if (!filePath) {
        return errorPage(req, res, 403, 'Access denied');
    }

    fs.stat(filePath, (statErr, stats) => {
        if (statErr) {
            if (statErr.code === 'ENOENT') {
                return errorPage(req, res, 404, `Not found: ${req.url}`);
            }
            return errorPage(req, res, 500, `Server error: ${statErr.message}`);
        }

        let resolvedPath = filePath;
        if (stats.isDirectory()) {
            resolvedPath = path.join(filePath, 'index.html');
        }

        const ext = path.extname(resolvedPath).toLowerCase();
        const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

        fs.readFile(resolvedPath, (readErr, data) => {
            if (readErr) {
                return errorPage(req, res, 500, `Server error: ${readErr.message}`);
            }

            res.writeHead(200, { 'Content-Type': mimeType });
            res.end(data);
            logRequest(req.method, pathname, 200);
        });
    });
}

function startServer(port) {
    if (port > MAX_PORT) {
        console.error(`[TestFramework] Could not find free port between ${DEFAULT_PORT} and ${MAX_PORT}.`);
        process.exit(1);
    }

    const server = http.createServer(serveStatic);

    server.listen(port, '127.0.0.1', () => {
        console.log('');
        console.log('✨ Mythical Void Test Framework ready!');
        console.log(`   URL: http://localhost:${port}/test-framework.html`);
        console.log('   Keep this terminal open to keep the server alive.');
        console.log('');
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.warn(`[TestFramework] Port ${port} in use; trying ${port + 1}...`);
            startServer(port + 1);
        } else if (err.code === 'EACCES') {
            console.error(`[TestFramework] Permission denied for port ${port}. Try a different port or run with elevated privileges.`);
            process.exit(1);
        } else {
            console.error(`[TestFramework] Server error: ${err.message}`);
            process.exit(1);
        }
    });
}

startServer(DEFAULT_PORT);
