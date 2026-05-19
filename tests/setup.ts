import ws from 'ws';

if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = ws;
}
