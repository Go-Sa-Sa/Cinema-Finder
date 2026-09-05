import http.server
import socketserver
import json
import os
import sys

# crawlerをインポート
import crawler

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class CinemaHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def log_message(self, format, *args):
        # コンソールログを簡潔に出力
        print(f"[{self.log_date_time_string()}] {format % args}")

    def do_POST(self):
        if self.path == "/api/crawl":
            self.handle_crawl()
        else:
            self.send_error(404, "Endpoint not found")

    def handle_crawl(self):
        print("\n" + "=" * 50)
        print("ブラウザからの更新要求を受信: クローラーを実行します...")
        print("=" * 50)
        try:
            # クローラーを実行
            crawler.run_crawler()

            data_path = os.path.join(DIRECTORY, "movies_data.json")
            last_updated = ""
            if os.path.exists(data_path):
                with open(data_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    last_updated = data.get("last_updated", "")

            print("=" * 50)
            print("クローラーの実行が完了しました！")
            print("=" * 50 + "\n")

            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.end_headers()
            response_json = json.dumps({
                "status": "success",
                "last_updated": last_updated
            }, ensure_ascii=False)
            self.wfile.write(response_json.encode("utf-8"))

        except Exception as e:
            print(f"[ERROR] クローラー実行中にエラーが発生しました: {e}")
            self.send_response(500)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            response_json = json.dumps({
                "status": "error",
                "error": str(e)
            }, ensure_ascii=False)
            self.wfile.write(response_json.encode("utf-8"))

import webbrowser
import threading

def start_server():
    socketserver.TCPServer.allow_reuse_address = True
    
    # 8000から順に空いているポートを自動探索
    httpd = None
    actual_port = PORT
    for p in range(PORT, PORT + 20):
        try:
            httpd = socketserver.TCPServer(("", p), CinemaHTTPRequestHandler)
            actual_port = p
            break
        except OSError:
            continue
            
    if httpd is None:
        print(f"[ERROR] ポート {PORT}〜{PORT+19} のいずれも使用できませんでした。")
        sys.exit(1)

    url = f"http://localhost:{actual_port}"
    print(f"\n========================================================")
    print(f"Chiba Cinema Finder local server is running!")
    print(f"URL: {url}")
    print(f"(Press Ctrl+C to stop the server)")
    print(f"========================================================\n")

    # サーバー起動後に自動でブラウザを開く
    threading.Timer(0.8, lambda: webbrowser.open(url)).start()

    with httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server...")

if __name__ == "__main__":
    start_server()

