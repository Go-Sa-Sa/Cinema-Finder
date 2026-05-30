import requests
from bs4 import BeautifulSoup, Tag
import re
import json
import datetime
import time
import os
import urllib.parse

THEATERS = [
    {
        "name": "USシネマちはら台",
        "url": "https://eiga.com/theater/12/120401/3175/",
        "official_url": "https://uscinemas.jp/category/chiharadai/"
    },
    {
        "name": "T・ジョイ蘇我",
        "url": "https://eiga.com/theater/12/120104/3155/",
        "official_url": "https://tjoy.jp/t-joy_soga"
    },
    {
        "name": "TOHOシネマズ市原",
        "url": "https://eiga.com/theater/12/120402/3256/",
        "official_url": "https://hlo.tohotheater.jp/net/schedule/071/TNPI2000J01.do"
    },
    {
        "name": "京成ローザ10",
        "url": "https://eiga.com/theater/12/120101/3160/",
        "official_url": "http://www.rosa10.net/"
    },
    {
        "name": "USシネマ木更津",
        "url": "https://eiga.com/theater/12/120108/3260/",
        "official_url": "https://uscinemas.jp/category/kisarazu/"
    },
    {
        "name": "イオンシネマ幕張新都心",
        "url": "https://eiga.com/theater/12/120102/3257/",
        "official_url": "https://www.aeoncinema.com/cinema/makuhari/"
    }
]


HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

def parse_date_str(date_str, base_date):
    """
    "5/25（月）" のような日付文字列を "YYYY-MM-DD" 形式に変換する
    """
    match = re.search(r'(\d+)/(\d+)', date_str)
    if not match:
        return None
    month = int(match.group(1))
    day = int(match.group(2))
    
    year = base_date.year
    # 年またぎの処理
    if month < base_date.month and base_date.month == 12:
        year += 1
    elif month > base_date.month and base_date.month == 1 and month == 12:
        year -= 1
        
    try:
        dt = datetime.date(year, month, day)
        return dt.strftime('%Y-%m-%d')
    except ValueError:
        return None

def crawl_theater(theater, today):
    print(f"Crawling schedule for: {theater['name']}...")
    try:
        response = requests.get(theater['url'], headers=HEADERS, timeout=10)
        if response.status_code != 200:
            print(f"Failed to fetch {theater['name']}. Status code: {response.status_code}")
            return None
        
        soup = BeautifulSoup(response.text, 'html.parser')
        sections = soup.find_all('section')
        
        movies = []
        
        for s in sections:
            h2 = s.find('h2', class_='title-xlarge')
            if not h2:
                continue
            
            movie_title = h2.text.strip()
            movie_a = h2.find('a')
            movie_rel_url = movie_a['href'] if movie_a and 'href' in movie_a.attrs else None
            
            # 各上映ブロック (字幕・吹替、IMAXなど) を解析
            blocks = s.find_all(class_='theater-showtime-block')
            if not blocks:
                # 別のクラス名の可能性も考慮
                blocks = s.find_all('div', class_=re.compile(r'showtime|schedule'))
                
            schedules = []
            
            for block in blocks:
                # 上映形式（例: 「2D/字幕」「3D/吹替/4DX」など）
                format_div = block.find(class_=re.compile(r'format|type|head|title'))
                fmt_text = format_div.text.strip() if format_div else "2D"
                fmt_text = re.sub(r'\s+', ' ', fmt_text) # 余計な空白を詰める
                
                # スケジュールテーブル
                table = block.find('table', class_='weekly-schedule')
                dates_dict = {}
                
                if table:
                    for tr in table.find_all('tr'):
                        for td in tr.find_all(['td', 'th']):
                            date_p = td.find('p', class_='date')
                            if not date_p:
                                continue
                            
                            date_str = date_p.text.strip()
                            date_key = parse_date_str(date_str, today)
                            if not date_key:
                                continue
                            
                            # 上映時間を取得
                            times = []
                            candidates = td.find_all(['a', 'span'])
                            for elem in candidates:
                                elem_text = elem.text.strip()
                                if not elem_text:
                                    continue
                                
                                # "20:00～22:25" などの開始・終了両方を含むパターン
                                match_range = re.search(r'(\d{2}:\d{2})\s*[～\-~]\s*(\d{2}:\d{2})', elem_text)
                                if match_range:
                                    times.append({
                                        "start": match_range.group(1),
                                        "end": match_range.group(2)
                                    })
                                else:
                                    # "20:00" 単一時間のパターン
                                    match_single = re.search(r'(\d{2}:\d{2})', elem_text)
                                    if match_single:
                                        start_time = match_single.group(1)
                                        end_time = ""
                                        
                                        # elemの中にsmall（終了時間）があるか
                                        small = elem.find('small')
                                        if small:
                                            end_match = re.search(r'(\d{2}:\d{2})', small.text)
                                            if end_match:
                                                end_time = end_match.group(1)
                                        else:
                                            # 直後の兄弟要素を探索（次の時間要素まで）
                                            sibling = elem.next_sibling
                                            while sibling:
                                                if isinstance(sibling, Tag):
                                                    # 次の上映時間要素に達したら終了
                                                    if sibling.name in ['a', 'span'] and re.search(r'\d{2}:\d{2}', sibling.text):
                                                        break
                                                    if sibling.name == 'small':
                                                        end_match = re.search(r'(\d{2}:\d{2})', sibling.text)
                                                        if end_match:
                                                            end_time = end_match.group(1)
                                                        break
                                                if not isinstance(sibling, Tag) and '～' in str(sibling):
                                                    end_match = re.search(r'(\d{2}:\d{2})', str(sibling))
                                                    if end_match:
                                                        end_time = end_match.group(1)
                                                    break
                                                sibling = sibling.next_sibling
                                                
                                        times.append({
                                            "start": start_time,
                                            "end": end_time
                                        })
                            
                            if times:
                                dates_dict[date_key] = times
                
                if dates_dict:
                    schedules.append({
                        "format": fmt_text,
                        "dates": dates_dict
                    })
            
            if schedules:
                movies.append({
                    "title": movie_title,
                    "rel_url": movie_rel_url,
                    "schedules": schedules
                })
                
        return {
            "name": theater['name'],
            "url": theater.get('official_url', theater['url']),
            "movies": movies
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Error crawling {theater['name']}: {e}")
        return None
def load_movie_urls():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(script_dir, "movie_urls.json")
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading movie_urls.json: {e}")
    return {}

def save_movie_urls(data):
    script_dir = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(script_dir, "movie_urls.json")
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Error saving movie_urls.json: {e}")

def fetch_official_url(rel_url):
    if not rel_url:
        return ""
    
    abs_url = "https://eiga.com" + rel_url if rel_url.startswith('/') else rel_url
    print(f"Fetching movie details from {abs_url} to get official website URL...")
    
    try:
        response = requests.get(abs_url, headers=HEADERS, timeout=10)
        if response.status_code != 200:
            return ""
            
        soup = BeautifulSoup(response.text, 'html.parser')
        official_a = soup.find('a', class_=re.compile(r'official'))
        if not official_a:
            official_a = soup.find('a', string=re.compile(r'公式サイト|オフィシャルサイト|オフィシャル'))
            
        if official_a and 'href' in official_a.attrs:
            href = official_a['href']
            # eiga.comのリダイレクトをパース
            parsed = urllib.parse.urlparse(href)
            query = urllib.parse.parse_qs(parsed.query)
            if 'u' in query:
                return urllib.parse.unquote(query['u'][0])
            else:
                if href.startswith('/'):
                    return "https://eiga.com" + href
                return href
    except Exception as e:
        print(f"Error fetching official URL for {rel_url}: {e}")
        
    return ""

def run_crawler():
    today = datetime.date.today()
    results = {}
    
    # 映画URLキャッシュを読み込む
    movie_urls_cache = load_movie_urls()
    has_cache_updated = False
    
    for theater in THEATERS:
        data = crawl_theater(theater, today)
        if data:
            results[theater['name']] = data
        time.sleep(1.0) # 劇場ごとのリクエスト間隔を空けてサーバー負荷を下げる
        
    # 重複しない映画タイトルと詳細URLのペアを抽出
    unique_movies = {}
    for theater_name, theater_data in results.items():
        for movie in theater_data.get("movies", []):
            title = movie["title"]
            rel_url = movie.get("rel_url")
            if title and rel_url and title not in unique_movies:
                unique_movies[title] = rel_url

    # 各映画の公式サイトURLを解決（キャッシュにないもののみクロール）
    for title, rel_url in unique_movies.items():
        if title not in movie_urls_cache:
            official_url = fetch_official_url(rel_url)
            movie_urls_cache[title] = official_url
            has_cache_updated = True
            time.sleep(1.0) # 映画詳細ページアクセスの負荷軽減
            
    if has_cache_updated:
        save_movie_urls(movie_urls_cache)
        
    # 最終的な映画データに official_url と eigacom_url を設定し、一時的な rel_url を削除
    for theater_name, theater_data in results.items():
        for movie in theater_data.get("movies", []):
            title = movie["title"]
            rel_url = movie.get("rel_url", "")
            if rel_url:
                movie["eigacom_url"] = "https://eiga.com" + rel_url if rel_url.startswith('/') else rel_url
            else:
                movie["eigacom_url"] = ""
            movie["official_url"] = movie_urls_cache.get(title, "")
            if "rel_url" in movie:
                del movie["rel_url"]
        
    # 日本時間 (JST: UTC+9) の現在時刻を取得
    jst_tz = datetime.timezone(datetime.timedelta(hours=9))
    current_time_jst = datetime.datetime.now(jst_tz)
    
    output_data = {
        "last_updated": current_time_jst.strftime("%Y-%m-%d %H:%M:%S"),
        "theaters": results
    }
    
    # 実行ファイルと同階層に movies_data.json を保存
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(script_dir, "movies_data.json")
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)
        
    print(f"Successfully scraped all theaters and saved to {output_path}")

if __name__ == "__main__":
    run_crawler()
