#!/usr/bin/env python3
"""
Custom Python Backend for Trading Simulator & Real-Time Instructor Monitoring
Serves static files and provides API endpoints for live participant trade tracking.
"""

import http.server
import socketserver
import json
import time
import os

PORT = 8080

# In-memory storage for live monitoring
PARTICIPANTS = {}  # userID -> dict
TRADE_LOGS = []    # list of trade dicts

class TradingServerHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        if self.path == '/api/admin/data':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()

            # Clean inactive participants (older than 30s)
            now = time.time()
            active_participants = [
                p for p in PARTICIPANTS.values() if (now - p.get('lastActive', 0)) < 60
            ]

            payload = {
                "activeCount": len(active_participants),
                "participants": active_participants,
                "trades": TRADE_LOGS[:50] # return latest 50 trades
            }
            self.wfile.write(json.dumps(payload).encode('utf-8'))
            return
        
        super().do_GET()

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)

        try:
            data = json.loads(post_data.decode('utf-8'))
        except Exception:
            data = {}

        if self.path == '/api/heartbeat':
            user_id = data.get('userID', 'unknown')
            PARTICIPANTS[user_id] = {
                "userName": data.get('userName', 'Anonymous'),
                "userID": user_id,
                "equity": data.get('equity', 100000),
                "cash": data.get('cash', 100000),
                "sharesHeld": data.get('sharesHeld', 0),
                "totalPnL": data.get('totalPnL', 0),
                "returnPct": data.get('returnPct', '0.00'),
                "lastActive": time.time(),
                "lastActiveStr": time.strftime('%H:%M:%S')
            }
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "ok"}).encode('utf-8'))
            return

        elif self.path == '/api/trade':
            trade_item = {
                "id": len(TRADE_LOGS) + 1,
                "userName": data.get('userName', 'Anonymous'),
                "userID": data.get('userID', 'unknown'),
                "time": data.get('time', time.strftime('%H:%M:%S')),
                "elapsed": data.get('elapsed', '0m 0s'),
                "type": data.get('type', 'BUY'),
                "shares": data.get('shares', 0),
                "price": data.get('price', 0),
                "totalCost": data.get('totalCost', 0)
            }
            TRADE_LOGS.insert(0, trade_item)
            if len(TRADE_LOGS) > 200:
                TRADE_LOGS.pop()

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "ok", "trade": trade_item}).encode('utf-8'))
            return

        self.send_response(404)
        self.end_headers()

class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True

def run_server():
    with ReusableTCPServer(("", PORT), TradingServerHandler) as httpd:
        print(f"Serving Trading Simulator & Admin Backend on http://localhost:{PORT}")
        httpd.serve_forever()

if __name__ == '__main__':
    run_server()
