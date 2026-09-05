import http.server
import socketserver
import urllib.parse
import json
import os
import datetime
import subprocess

# crawlerとgeneratorをインポート
import crawler
import generator

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class CinemaHTTPRequestHandler(http.server.BaseHTTPRequestHandler):
    
    def log_message(self, format, *args):
        # ログ出力を簡潔にする
        print(f"[{self.log_date_time_string()}] {format%args}")

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        query = urllib.parse.parse_qs(parsed_url.query)
        
        # API ルーティング
        if path == "/api/movies":
            self.handle_api_movies()
        elif path == "/api/schedule":
            self.handle_api_schedule(query)
        elif path == "/api/crawl":
            self.handle_api_crawl()
        else:
            # 静的ファイルの配信
            self.handle_static_file(path)

    def do_POST(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        
        if path == "/api/crawl":
            self.handle_api_crawl()
        else:
            self.send_error(404, "File Not Found")

    def handle_static_file(self, path):
        # デフォルトファイルは index.html
        if path == "/":
            path = "/index.html"
            
        # 安全なパス結合（ディレクトリトラバーサル対策）
        # 先頭のスラッシュを取り除く
        safe_path = path.lstrip("/")
        file_path = os.path.join(DIRECTORY, safe_path)
        
        # 確実にディレクトリ配下のファイルであることを検証
        real_dir = os.path.realpath(DIRECTORY)
        real_file = os.path.realpath(file_path)
        if not real_file.startswith(real_dir):
            self.send_error(403, "Access Denied")
            return
            
        if os.path.exists(file_path) and os.path.isfile(file_path):
            mime_type = "text/plain"
            if file_path.endswith(".html"):
                mime_type = "text/html"
            elif file_path.endswith(".css"):
                mime_type = "text/css"
            elif file_path.endswith(".js"):
                mime_type = "application/javascript"
            elif file_path.endswith(".json"):
                mime_type = "application/json"
            elif file_path.endswith(".png"):
                mime_type = "image/png"
            elif file_path.endswith(".jpg") or file_path.endswith(".jpeg"):
                mime_type = "image/jpeg"
                
            self.send_response(200)
            self.send_header("Content-Type", mime_type)
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.end_headers()
            
            with open(file_path, "rb") as f:
                self.wfile.write(f.read())
        else:
            self.send_error(404, "File Not Found")

    def get_movies_data(self):
        data_path = os.path.join(DIRECTORY, "movies_data.json")
        if not os.path.exists(data_path):
            print("movies_data.json not found. Running crawler automatically...")
            # クローラーをインラインで呼び出す
            try:
                crawler.run_crawler()
            except Exception as e:
                print(f"Error auto-running crawler: {e}")
                return None
                
        if os.path.exists(data_path):
            try:
                with open(data_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                print(f"Error loading movies_data.json: {e}")
        return None

    def handle_api_movies(self):
        data = self.get_movies_data()
        if not data:
            self.send_json_response({"error": "Failed to load movie data"}, 500)
            return
            
        # 全劇場の上映作品を集めて重複を排除する
        movie_titles = set()
        for theater_name, theater_info in data.get("theaters", {}).items():
            for movie in theater_info.get("movies", []):
                movie_titles.add(movie["title"])
                
        response_data = {
            "last_updated": data.get("last_updated", ""),
            "movies": sorted(list(movie_titles))
        }
        self.send_json_response(response_data)

    def handle_api_schedule(self, query):
        title_list = query.get("title")
        date_list = query.get("date")
        
        if not title_list or not date_list:
            self.send_json_response({"error": "Missing parameters. 'title' and 'date' are required."}, 400)
            return
            
        title = urllib.parse.unquote(title_list[0])
        date_str = date_list[0] # YYYY-MM-DD 形式
        
        data = self.get_movies_data()
        if not data:
            self.send_json_response({"error": "Failed to load movie data"}, 500)
            return
            
        results = {}
        theaters = data.get("theaters", {})
        
        # 実データの中に指定の日付が含まれるか確認
        has_real_date = False
        official_url = ""
        eigacom_url = ""
        for t_name, t_data in theaters.items():
            for m in t_data.get("movies", []):
                if m["title"] == title:
                    if "official_url" in m:
                        official_url = m["official_url"]
                    if "eigacom_url" in m:
                        eigacom_url = m["eigacom_url"]
                    for schedule in m.get("schedules", []):
                        if date_str in schedule.get("dates", {}):
                            has_real_date = True
                            break
            if has_real_date:
                break
                
        if has_real_date:
            # 実データからスケジュールを抽出して構築する
            for theater_name, theater_data in theaters.items():
                movie_data = None
                for m in theater_data.get("movies", []):
                    if m["title"] == title:
                        movie_data = m
                        break
                        
                if not movie_data:
                    continue
                    
                theater_schedules = []
                for schedule in movie_data.get("schedules", []):
                    fmt = schedule.get("format", "2D")
                    dates_dict = schedule.get("dates", {})
                    
                    if date_str in dates_dict:
                        # 既存のデータをそのまま使用
                        times = dates_dict[date_str]
                        # simulationフラグをFalseにする
                        for t in times:
                            t["is_simulation"] = False
                            
                        theater_schedules.append({
                            "format": fmt,
                            "times": times
                        })
                        
                if theater_schedules:
                    results[theater_name] = {
                        "name": theater_name,
                        "url": theater_data.get("url", ""),
                        "schedules": theater_schedules
                    }
        else:
            # 実データが無い場合はシミュレーションデータを作成して返却
            print(f"Generating simulation schedule for '{title}' on {date_str}...")
            sim_data = generator.generate_simulation_schedule(title, date_str, data)
            
            for theater_name, theater_info in sim_data.items():
                movie_data = theater_info["movies"][0]
                if not official_url and "official_url" in movie_data:
                    official_url = movie_data["official_url"]
                if not eigacom_url and "eigacom_url" in movie_data:
                    eigacom_url = movie_data["eigacom_url"]
                theater_schedules = []
                for schedule in movie_data["schedules"]:
                    fmt = schedule["format"]
                    times = schedule["dates"][date_str]
                    theater_schedules.append({
                        "format": fmt,
                        "times": times
                    })
                
                results[theater_name] = {
                    "name": theater_name,
                    "url": theater_info.get("url", ""),
                    "schedules": theater_schedules
                }
                
        self.send_json_response({
            "title": title,
            "date": date_str,
            "is_simulation": not has_real_date,
            "official_url": official_url,
            "eigacom_url": eigacom_url,
            "results": results
        })

    def handle_api_crawl(self):
        print("Manual crawl requested via API...")
        try:
            crawler.run_crawler()
            data_path = os.path.join(DIRECTORY, "movies_data.json")
            if os.path.exists(data_path):
                with open(data_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                self.send_json_response({
                    "status": "success",
                    "last_updated": data.get("last_updated", "")
                })
                return
        except Exception as e:
            print(f"Error running crawler via API: {e}")
            
        self.send_json_response({"error": "Failed to update movie schedule cache"}, 500)

    def send_json_response(self, data, status_code=200):
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.end_headers()
        response_str = json.dumps(data, ensure_ascii=False)
        self.wfile.write(response_str.encode("utf-8"))

def start_server():
    # サーバーを起動する前にクローラーの動作確認と初期データの生成
    data_path = os.path.join(DIRECTORY, "movies_data.json")
    if not os.path.exists(data_path):
        print("Initial movies_data.json not found. Crawling theaters first...")
        crawler.run_crawler()
        
    # httpdサーバーの起動
    handler = CinemaHTTPRequestHandler
    socketserver.ThreadingTCPServer.allow_reuse_address = False
    with socketserver.ThreadingTCPServer(("", PORT), handler) as httpd:
        print(f"==================================================")
        print(f" Cinema Schedule Tool Server is running!")
        print(f" Access URL: http://localhost:{PORT}")
        print(f" Directory: {DIRECTORY}")
        print(f" Press Ctrl+C to stop the server.")
        print(f"==================================================")
        
        # 自動でブラウザを開く
        try:
            import webbrowser
            webbrowser.open(f"http://localhost:{PORT}")
        except Exception as e:
            print(f"Failed to open browser automatically: {e}")
            
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopping server...")
            httpd.server_close()

if __name__ == "__main__":
    start_server()
