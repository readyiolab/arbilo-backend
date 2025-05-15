const WebSocket = require('ws');
const CacheService = require('./CacheService');
const jwt = require('jsonwebtoken');

function setupWebSocket(server) {
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws, req) => {
    console.log('WebSocket client connected');

    // Validate token
    const token = req.url.split('token=')[1];
    if (!token) {
      console.warn('No token provided in WebSocket connection');
      ws.close(4001, 'Authentication required');
      return;
    }

    try {
      jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
      console.log('WebSocket client authenticated successfully');
    } catch (error) {
      console.error('Invalid token:', error.message);
      ws.close(4002, 'Invalid token');
      return;
    }

    // Heartbeat to keep connection alive
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('close', (code, reason) => {
      console.log(`WebSocket client disconnected, code: ${code}, reason: ${reason}`);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  // Ping clients every 30 seconds, relaxed termination
  const pingInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) {
        console.warn('Unresponsive client detected, marking for termination');
        ws.isAlive = false; // Give one more chance before termination
        return;
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    console.log('WebSocket server closed');
    clearInterval(pingInterval);
  });

  CacheService.initializeWebSocket(wss);
}

module.exports = setupWebSocket;