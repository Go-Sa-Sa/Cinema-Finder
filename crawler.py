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

def format_time_str(time_str):
    """
    "8:30" などの時間文字列を "08:30" 形式に標準化する
    """
    if not time_str:
        return ""
    try:
        parts = time_str.split(':')
        if len(parts) == 2:
            return f"{int(parts[0]):02d}:{int(parts[1]):02d}"
    except:
        pass
    return time_str

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
                                match_range = re.search(r'(\d{1,2}:\d{2})\s*[～\-~]\s*(\d{1,2}:\d{2})', elem_text)
                                if match_range:
                                    times.append({
                                        "start": format_time_str(match_range.group(1)),
                                        "end": format_time_str(match_range.group(2))
                                    })
                                else:
                                    # "20:00" 単一時間のパターン
                                    match_single = re.search(r'(\d{1,2}:\d{2})', elem_text)
                                    if match_single:
                                        start_time = format_time_str(match_single.group(1))
                                        end_time = ""
                                        
                                        # elemの中にsmall（終了時間）があるか
                                        small = elem.find('small')
                                        if small:
                                            end_match = re.search(r'(\d{1,2}:\d{2})', small.text)
                                            if end_match:
                                                end_time = format_time_str(end_match.group(1))
                                        else:
                                            # 直後の兄弟要素を探索（次の時間要素まで）
                                            sibling = elem.next_sibling
                                            while sibling:
                                                if isinstance(sibling, Tag):
                                                    # 次の上映時間要素に達したら終了
                                                    if sibling.name in ['a', 'span'] and re.search(r'\d{1,2}:\d{2}', sibling.text):
                                                        break
                                                    if sibling.name == 'small':
                                                        end_match = re.search(r'(\d{1,2}:\d{2})', sibling.text)
                                                        if end_match:
                                                            end_time = format_time_str(end_match.group(1))
                                                        break
                                                if not isinstance(sibling, Tag) and '～' in str(sibling):
                                                    end_match = re.search(r'(\d{1,2}:\d{2})', str(sibling))
                                                    if end_match:
                                                        end_time = format_time_str(end_match.group(1))
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
def load_movie_details():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    # 移行用：古い movie_urls.json が存在し、新しい movie_details.json が無い場合はインポートする
    details_path = os.path.join(script_dir, "movie_details.json")
    urls_path = os.path.join(script_dir, "movie_urls.json")
    
    if os.path.exists(details_path):
        try:
            with open(details_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading movie_details.json: {e}")
            
    if os.path.exists(urls_path):
        try:
            with open(urls_path, "r", encoding="utf-8") as f:
                old_data = json.load(f)
            # 古いデータを新しい形式に変換して初期化する
            details = {}
            for title, url in old_data.items():
                details[title] = {
                    "official_url": url,
                    "eigacom_url": "",
                    "poster_url": "",
                    "release_date": "",
                    "release_date_formatted": "",
                    "director": "",
                    "cast": [],
                    "description": "",
                    "copyright": ""
                }
            return details
        except Exception as e:
            print(f"Error migrating movie_urls.json: {e}")
            
    return {}

def save_movie_details(data):
    script_dir = os.path.dirname(os.path.abspath(__file__))
    details_path = os.path.join(script_dir, "movie_details.json")
    try:
        with open(details_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Error saving movie_details.json: {e}")

def format_release_date(raw_date_str):
    """
    "劇場公開日：2026年5月22日" や "2026年5月22日" などの文字列から ISO形式の日付と
    表示用のフォーマットされた日付（例: "05月22日(金) 公開"）を生成する
    """
    match = re.search(r'(\d{4})年(\d{1,2})月(\d{1,2})日', raw_date_str)
    if not match:
        return "", ""
        
    year = int(match.group(1))
    month = int(match.group(2))
    day = int(match.group(3))
    
    date_iso = f"{year:04d}-{month:02d}-{day:02d}"
    
    try:
        dt = datetime.date(year, month, day)
        weekdays = ["月", "火", "水", "木", "金", "土", "日"]
        weekday_str = weekdays[dt.weekday()]
        date_formatted = f"{month:02d}月{day:02d}日({weekday_str}) 公開"
        return date_iso, date_formatted
    except Exception as e:
        print(f"Error formatting date {year}-{month}-{day}: {e}")
        return date_iso, f"{month:02d}月{day:02d}日 公開"

def fetch_movie_details(rel_url):
    if not rel_url:
        return None
    
    abs_url = "https://eiga.com" + rel_url if rel_url.startswith('/') else rel_url
    print(f"Fetching movie details from {abs_url}...")
    
    details = {
        "official_url": "",
        "eigacom_url": abs_url,
        "poster_url": "",
        "release_date": "",
        "release_date_formatted": "",
        "director": "",
        "cast": [],
        "description": "",
        "copyright": ""
    }
    
    try:
        response = requests.get(abs_url, headers=HEADERS, timeout=10)
        if response.status_code != 200:
            print(f"Failed to fetch details from {abs_url}. Status: {response.status_code}")
            return None
            
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # 1. 公式サイトURL
        official_a = soup.find('a', class_=re.compile(r'official'))
        if not official_a:
            official_a = soup.find('a', string=re.compile(r'公式サイト|オフィシャルサイト|オフィシャル'))
            
        if official_a and 'href' in official_a.attrs:
            href = official_a['href']
            parsed = urllib.parse.urlparse(href)
            query = urllib.parse.parse_qs(parsed.query)
            if 'u' in query:
                details["official_url"] = urllib.parse.unquote(query['u'][0])
            else:
                if href.startswith('/'):
                    details["official_url"] = "https://eiga.com" + href
                else:
                    details["official_url"] = href
                    
        # 2. ポスター画像URL
        img_div = soup.find('div', class_='hero-img') or soup.find('div', class_='main-img')
        img_url = ""
        if img_div:
            img_tag = img_div.find('img')
            if img_tag:
                img_url = img_tag.get('src') or img_tag.get('data-src') or img_tag.get('data-original')
        if not img_url:
            img_tag = soup.find('img', itemprop='image')
            if img_tag:
                img_url = img_tag.get('src') or img_tag.get('data-src')
        details["poster_url"] = img_url or ""
        
        # 3. 監督
        staff_dl = soup.find('dl', class_='movie-staff')
        if staff_dl:
            dt = staff_dl.find('dt', string=re.compile(r'監督'))
            if dt:
                dd = dt.find_next_sibling('dd')
                if dd:
                    details["director"] = dd.text.strip()
                    
        # 4. キャスト (主要3名)
        cast_ul = soup.find('ul', class_='movie-cast')
        if cast_ul:
            cast_spans = cast_ul.select('li a.person p span')
            details["cast"] = [span.text.strip() for span in cast_spans[:3]]
        else:
            actors = soup.find_all(itemprop='actor')
            details["cast"] = [a.find(itemprop='name').text.strip() if a.find(itemprop='name') else a.text.strip() for a in actors[:3]]
            
        # 5. あらすじ（説明文）
        details_div = soup.find('div', class_='movie-details')
        if details_div:
            p_tag = details_div.select_one('section.txt-block p')
            if p_tag:
                details["description"] = p_tag.text.strip()
        if not details["description"]:
            outline_div = soup.find('div', class_='outline') or soup.find('p', class_='outline') or soup.find(itemprop='description')
            if outline_div:
                details["description"] = outline_div.text.strip()
                
        if details["description"]:
            details["description"] = re.sub(r'\s+', ' ', details["description"])
            
        # 6. コピーライト
        copyright_text = ""
        for t in soup.find_all(string=lambda x: x and ('©' in x or '(C)' in x or 'C)' in x)):
            if 'eiga.com' not in t and '映画.com' not in t:
                clean_t = t.strip().rstrip('/')
                copyright_text = clean_t.strip()
                break
        details["copyright"] = copyright_text
        
        # 7. 公開日
        release_date_raw = ""
        if details_div:
            data_p = details_div.select_one('section.txt-block p.data')
            if data_p:
                match = re.search(r'劇場公開日：[^\n]+', data_p.text)
                if match:
                    release_date_raw = match.group(0)
        if not release_date_raw:
            opdate = soup.find('span', itemprop='datePublished') or soup.find(class_=re.compile(r'opdate|release'))
            if opdate:
                release_date_raw = opdate.text.strip()
                
        if release_date_raw:
            date_iso, date_formatted = format_release_date(release_date_raw)
            details["release_date"] = date_iso
            details["release_date_formatted"] = date_formatted
            
        return details
    except Exception as e:
        print(f"Error fetching movie details for {rel_url}: {e}")
        
    return None

def crawl_upcoming_movies(today):
    print("Crawling upcoming movies...")
    upcoming_url = "https://eiga.com/coming/"
    upcoming_movies = []
    
    try:
        response = requests.get(upcoming_url, headers=HEADERS, timeout=10)
        if response.status_code != 200:
            print(f"Failed to fetch upcoming movies. Status code: {response.status_code}")
            return []
            
        soup = BeautifulSoup(response.text, 'html.parser')
        
        for h2 in soup.find_all('h2', class_='title-square'):
            year_span = h2.find('span', class_='year')
            calendar_span = h2.find('span', class_='calendar')
            if not year_span or not calendar_span:
                continue
            year_text = year_span.text.strip()
            calendar_text = calendar_span.text.strip()
            
            year_match = re.search(r'\d+', year_text)
            date_match = re.search(r'(\d+)月(\d+)日', calendar_text)
            if not year_match or not date_match:
                continue
                
            year = int(year_match.group(0))
            month = int(date_match.group(1))
            day = int(date_match.group(2))
            
            h2_text = h2.text.strip()
            weekday_match = re.search(r'（(.)）', h2_text)
            weekday = weekday_match.group(1) if weekday_match else ""
            
            date_iso = f"{year:04d}-{month:02d}-{day:02d}"
            date_formatted = f"{month:02d}月{day:02d}日({weekday}) 公開"
            
            sibling = h2.next_sibling
            while sibling:
                if isinstance(sibling, Tag):
                    if sibling.name == 'h2' and 'title-square' in sibling.get('class', []):
                        break
                    if sibling.name == 'div' and ('list-block' in sibling.get('class', []) or 'list-block2' in sibling.get('class', [])):
                        title_h3 = sibling.find('h3', class_='title')
                        if title_h3:
                            title_a = title_h3.find('a')
                            movie_title = title_h3.text.strip()
                            rel_url = title_a['href'] if title_a else ""
                            
                            img_tag = sibling.find('div', class_='img-box').find('img') if sibling.find('div', class_='img-box') else None
                            poster_url = img_tag['src'] if img_tag else ""
                            if poster_url and 'noimg' in poster_url:
                                poster_url = ""
                                
                            desc_p = sibling.find('p', class_='txt')
                            description = desc_p.text.strip() if desc_p else ""
                            
                            director = ""
                            cast = []
                            cast_staff_ul = sibling.find('ul', class_='cast-staff')
                            if cast_staff_ul:
                                for li in cast_staff_ul.find_all('li'):
                                    li_text = li.text.strip()
                                    if "監督" in li_text:
                                        director = li_text.replace("監督", "").strip()
                                    else:
                                        cast_names = [span.text.strip() for span in li.find_all('span')]
                                        if cast_names:
                                            cast = cast_names
                                        else:
                                            cast = [c.strip() for c in li_text.split(',') if c.strip()]
                                            
                            upcoming_movies.append({
                                "title": movie_title,
                                "release_date": date_iso,
                                "release_date_formatted": date_formatted,
                                "poster_url": poster_url,
                                "description": description,
                                "director": director,
                                "cast": cast,
                                "eigacom_url": "https://eiga.com" + rel_url if rel_url.startswith('/') else rel_url
                            })
                sibling = sibling.next_sibling
                
        return upcoming_movies
    except Exception as e:
        print(f"Error crawling upcoming movies: {e}")
        return []

def run_crawler():
    today = datetime.date.today()
    results = {}
    
    # 映画詳細キャッシュを読み込む
    movie_details_cache = load_movie_details()
    has_cache_updated = False
    
    # 上映予定映画のスクレイピング
    upcoming_list = crawl_upcoming_movies(today)
    
    # 上映予定映画の詳細情報を movie_details_cache にマージする
    for m in upcoming_list:
        title = m["title"]
        if title not in movie_details_cache:
            movie_details_cache[title] = {
                "official_url": "",
                "eigacom_url": m["eigacom_url"],
                "poster_url": m["poster_url"],
                "release_date": m["release_date"],
                "release_date_formatted": m["release_date_formatted"],
                "director": m["director"],
                "cast": m["cast"],
                "description": m["description"],
                "copyright": ""
            }
            has_cache_updated = True
    
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

    # 各映画の詳細情報を解決（キャッシュにない、または詳細情報が不完全なもののみクロール）
    for title, rel_url in unique_movies.items():
        is_incomplete = False
        if title in movie_details_cache:
            cached = movie_details_cache[title]
            if isinstance(cached, str):
                is_incomplete = True
            elif isinstance(cached, dict):
                # 必須キーが空の場合は再クロールして補完する
                if not cached.get("poster_url") or not cached.get("description"):
                    is_incomplete = True
        else:
            is_incomplete = True
            
        if is_incomplete:
            movie_details = fetch_movie_details(rel_url)
            if movie_details:
                # 既存の公式サイトURLを保持
                if title in movie_details_cache and isinstance(movie_details_cache[title], str):
                    if movie_details_cache[title]:
                        movie_details["official_url"] = movie_details_cache[title]
                        
                movie_details_cache[title] = movie_details
                has_cache_updated = True
                time.sleep(1.0) # 映画詳細ページアクセスの負荷軽減
            
    if has_cache_updated:
        save_movie_details(movie_details_cache)
        
    # 最終的な映画データに official_url と eigacom_url を設定し、一時的な rel_url を削除
    for theater_name, theater_data in results.items():
        for movie in theater_data.get("movies", []):
            title = movie["title"]
            rel_url = movie.get("rel_url", "")
            if rel_url:
                movie["eigacom_url"] = "https://eiga.com" + rel_url if rel_url.startswith('/') else rel_url
            else:
                movie["eigacom_url"] = ""
                
            cached_detail = movie_details_cache.get(title)
            if isinstance(cached_detail, dict):
                movie["official_url"] = cached_detail.get("official_url", "")
            elif isinstance(cached_detail, str):
                movie["official_url"] = cached_detail
            else:
                movie["official_url"] = ""
                
            if "rel_url" in movie:
                del movie["rel_url"]
        
    # 日本時間 (JST: UTC+9) の現在時刻を取得
    jst_tz = datetime.timezone(datetime.timedelta(hours=9))
    current_time_jst = datetime.datetime.now(jst_tz)
    
    upcoming_data = [{"title": m["title"], "release_date": m["release_date"]} for m in upcoming_list]
    
    output_data = {
        "last_updated": current_time_jst.strftime("%Y-%m-%d %H:%M:%S"),
        "theaters": results,
        "upcoming": upcoming_data
    }
    
    # 実行ファイルと同階層に movies_data.json を保存
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(script_dir, "movies_data.json")
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)
        
    print(f"Successfully scraped all theaters and saved to {output_path}")

if __name__ == "__main__":
    run_crawler()

