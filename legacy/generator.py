import datetime
import json
import random
import os

def parse_time(time_str):
    try:
        h, m = map(int, time_str.split(':'))
        return datetime.time(h, m)
    except:
        return None

def add_minutes(time_str, minutes):
    """
    "10:00" 形式の文字列に分を加算して "12:15" のような形式で返す
    """
    try:
        h, m = map(int, time_str.split(':'))
        dt = datetime.datetime(2000, 1, 1, h, m) + datetime.timedelta(minutes=minutes)
        return dt.strftime("%H:%M")
    except:
        return time_str

def get_duration_minutes(start_str, end_str):
    """
    開始時間と終了時間から映画の長さ（分）を計算する
    """
    try:
        sh, sm = map(int, start_str.split(':'))
        eh, em = map(int, end_str.split(':'))
        start_dt = datetime.datetime(2000, 1, 1, sh, sm)
        end_dt = datetime.datetime(2000, 1, 1, eh, em)
        if end_dt < start_dt: # 深夜をまたぐ場合
            end_dt += datetime.timedelta(days=1)
        diff = end_dt - start_dt
        return int(diff.total_seconds() / 60)
    except:
        return 120 # デフォルト120分

def generate_simulation_schedule(target_title, target_date_str, cache_data):
    """
    指定された映画タイトルと日付に対して、シミュレーション上映スケジュールを生成する
    """
    # 乱数シードを指定された映画タイトルと日付で固定し、
    # 同じ条件でリクエストされたら常に同じシミュレーション結果を返すようにする（リアリティのため）
    random_seed = hash(target_title + target_date_str) % (2**32)
    random.seed(random_seed)
    
    simulated_theaters = {}
    theaters = cache_data.get("theaters", {})
    
    for theater_name, theater_data in theaters.items():
        # この劇場で対象の映画が上映されているか調べる
        movie_data = None
        for m in theater_data.get("movies", []):
            if m["title"] == target_title:
                movie_data = m
                break
        
        # 上映されていない場合はスケジュールなし
        if not movie_data:
            continue
            
        simulated_schedules = []
        
        # 上映形式ごとにシミュレーションを行う
        for schedule in movie_data.get("schedules", []):
            fmt = schedule.get("format", "2D")
            dates_dict = schedule.get("dates", {})
            
            # 直近の実上映スケジュールをすべて集める
            all_real_times = []
            for date_key, times in dates_dict.items():
                for t in times:
                    duration = get_duration_minutes(t["start"], t.get("end", ""))
                    all_real_times.append((t["start"], duration))
            
            if not all_real_times:
                continue
            
            # 重複を除いてユニークな「開始時間」と「映画の長さ」のペアを作る
            # 通常、一日の上映スケジュールは3〜5回程度
            # 直近数日間の全スケジュールから、1日あたりの平均的な上映枠数（例: 3枠）を再現する
            unique_starts = sorted(list(set([item[0] for item in all_real_times])))
            
            # 代表的な映画の長さを算出（最頻値または平均値、簡易的に最初のデータを使用）
            avg_duration = all_real_times[0][1] if all_real_times else 120
            
            # 平日と休日で少し時間をずらす演出を入れる（リアリティの向上）
            # 対象の日付が土日かどうか
            target_date = datetime.datetime.strptime(target_date_str, "%Y-%m-%d")
            is_weekend = target_date.weekday() >= 5
            
            simulated_times = []
            for start_time in unique_starts:
                # 土日は少し早め・遅めの上映枠が追加されたり、時間が15〜30分前後するような演出
                shift_minutes = 0
                if is_weekend:
                    shift_minutes = random.choice([-15, 0, 15, 30])
                else:
                    shift_minutes = random.choice([-30, -15, 0, 15])
                
                # 時間をシフト
                sim_start = add_minutes(start_time, shift_minutes)
                sim_end = add_minutes(sim_start, avg_duration)
                
                simulated_times.append({
                    "start": sim_start,
                    "end": sim_end,
                    "is_simulation": True
                })
            
            # 時間順にソート
            simulated_times = sorted(simulated_times, key=lambda x: x["start"])
            
            simulated_schedules.append({
                "format": fmt,
                "dates": {
                    target_date_str: simulated_times
                }
            })
            
        if simulated_schedules:
            official_url = movie_data.get("official_url", "") if movie_data else ""
            eigacom_url = movie_data.get("eigacom_url", "") if movie_data else ""
            simulated_theaters[theater_name] = {
                "name": theater_name,
                "url": theater_data.get("url", ""),
                "movies": [
                    {
                        "title": target_title,
                        "official_url": official_url,
                        "eigacom_url": eigacom_url,
                        "schedules": simulated_schedules
                    }
                ]
            }
            
    return simulated_theaters
