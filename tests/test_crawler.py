import unittest
import datetime
from crawler import parse_date_str, format_time_str, validate_movies_data

class TestCrawlerUtils(unittest.TestCase):
    
    def test_parse_date_str_normal(self):
        base_date = datetime.date(2026, 5, 25)
        self.assertEqual(parse_date_str("5/25（月）", base_date), "2026-05-25")
        self.assertEqual(parse_date_str("6/1 (月)", base_date), "2026-06-01")
        
    def test_parse_date_str_year_rollover(self):
        # 12月に翌年1月のスケジュールを取得する場合
        base_date_dec = datetime.date(2026, 12, 28)
        self.assertEqual(parse_date_str("1/3（土）", base_date_dec), "2027-01-03")
        
        # 1月に前年12月のスケジュールを取得する場合
        base_date_jan = datetime.date(2027, 1, 3)
        self.assertEqual(parse_date_str("12/31（木）", base_date_jan), "2026-12-31")
        
    def test_parse_date_str_invalid(self):
        base_date = datetime.date(2026, 5, 25)
        self.assertIsNone(parse_date_str("不正な日付", base_date))
        
    def test_format_time_str(self):
        self.assertEqual(format_time_str("8:30"), "08:30")
        self.assertEqual(format_time_str("08:30"), "08:30")
        self.assertEqual(format_time_str("21:45"), "21:45")
        self.assertEqual(format_time_str(""), "")

    def test_validate_movies_data_valid(self):
        mock_data = {
            "theaters": {
                f"Theater {i}": {
                    "movies": [{"title": f"Movie {j}"} for j in range(3)]
                } for i in range(5)
            }
        }
        is_valid, reason = validate_movies_data(mock_data)
        self.assertTrue(is_valid)
        self.assertEqual(reason, "OK")

    def test_validate_movies_data_too_few_theaters(self):
        mock_data = {
            "theaters": {
                "Theater 1": {"movies": [{"title": "M1"}]}
            }
        }
        is_valid, reason = validate_movies_data(mock_data)
        self.assertFalse(is_valid)
        self.assertIn("劇場数が少なすぎます", reason)

    def test_validate_movies_data_zero_movies(self):
        mock_data = {
            "theaters": {
                f"Theater {i}": {"movies": []} for i in range(6)
            }
        }
        is_valid, reason = validate_movies_data(mock_data)
        self.assertFalse(is_valid)
        self.assertIn("異常に少なすぎます", reason)

    def test_fetch_og_image_empty(self):
        from crawler import fetch_og_image
        self.assertEqual(fetch_og_image(""), "")
        self.assertEqual(fetch_og_image("invalid_url"), "")
        self.assertEqual(fetch_og_image(None), "")

    def test_search_movie_on_eigacom_empty(self):
        from crawler import search_movie_on_eigacom
        self.assertIsNone(search_movie_on_eigacom(""))

    def test_format_release_date(self):
        from crawler import format_release_date
        iso, formatted = format_release_date("劇場公開日：2026年5月22日")
        self.assertEqual(iso, "2026-05-22")
        self.assertEqual(formatted, "05月22日(金) 公開")

    def test_is_poster_url_valid(self):
        from crawler import is_poster_url_valid
        self.assertFalse(is_poster_url_valid(""))
        self.assertFalse(is_poster_url_valid(None))
        self.assertFalse(is_poster_url_valid("not_a_url"))
        self.assertFalse(is_poster_url_valid("https://example.com/noimg/160.png"))
        self.assertFalse(is_poster_url_valid("https://example.com/no_hero_image.png"))

    def test_parse_runtime_minutes(self):
        from crawler import parse_runtime_minutes
        self.assertEqual(parse_runtime_minutes("2026年製作／145分／G／アメリカ"), 145)
        self.assertEqual(parse_runtime_minutes("2025年製作／98分／PG12／日本"), 98)
        self.assertIsNone(parse_runtime_minutes("2026年製作／アメリカ"))
        self.assertIsNone(parse_runtime_minutes(""))
        self.assertIsNone(parse_runtime_minutes(None))


class TestFillEstimatedEndTimes(unittest.TestCase):

    def test_uses_known_duration_of_same_format_first(self):
        from crawler import fill_estimated_end_times
        theaters = {"A": {"movies": [{"title": "M", "schedules": [
            {"format": "2D", "dates": {"2026-10-03": [
                {"start": "10:00", "end": "12:10"},
                {"start": "15:00", "end": ""}
            ]}}
        ]}]}}
        details = {"M": {"runtime_minutes": 100}}
        self.assertEqual(fill_estimated_end_times(theaters, details), 1)
        filled = theaters["A"]["movies"][0]["schedules"][0]["dates"]["2026-10-03"][1]
        self.assertEqual(filled, {"start": "15:00", "end": "17:10", "end_estimated": True})

    def test_uses_runtime_plus_theater_offset(self):
        from crawler import fill_estimated_end_times
        theaters = {"A": {"movies": [
            # 実測: 120分の作品が 130分 → 劇場Aの予告編時間は10分
            {"title": "Known", "schedules": [{"format": "2D", "dates": {
                "2026-10-03": [{"start": "09:00", "end": "11:10"}]}}]},
            {"title": "M", "schedules": [{"format": "2D", "dates": {
                "2026-10-03": [{"start": "23:00", "end": ""}]}}]}
        ]}}
        details = {"Known": {"runtime_minutes": 120}, "M": {"runtime_minutes": 100}}
        fill_estimated_end_times(theaters, details)
        filled = theaters["A"]["movies"][1]["schedules"][0]["dates"]["2026-10-03"][0]
        self.assertEqual(filled["end"], "00:50")  # 深夜またぎ
        self.assertTrue(filled["end_estimated"])

    def test_falls_back_to_global_offset_for_theater_without_end_times(self):
        from crawler import fill_estimated_end_times
        theaters = {
            "A": {"movies": [{"title": "Known", "schedules": [{"format": "2D", "dates": {
                "2026-10-03": [{"start": "09:00", "end": "11:06"}]}}]}]},
            "B": {"movies": [{"title": "M", "schedules": [{"format": "2D", "dates": {
                "2026-10-03": [{"start": "10:00", "end": ""}]}}]}]}
        }
        details = {"Known": {"runtime_minutes": 120}, "M": {"runtime_minutes": 90}}
        fill_estimated_end_times(theaters, details)
        filled = theaters["B"]["movies"][0]["schedules"][0]["dates"]["2026-10-03"][0]
        self.assertEqual(filled["end"], "11:36")  # 90分 + 劇場Aの実測6分

    def test_leaves_end_empty_when_runtime_unknown(self):
        from crawler import fill_estimated_end_times
        theaters = {"A": {"movies": [{"title": "Event", "schedules": [{"format": "2D", "dates": {
            "2026-10-03": [{"start": "18:00", "end": ""}]}}]}]}}
        self.assertEqual(fill_estimated_end_times(theaters, {}), 0)
        entry = theaters["A"]["movies"][0]["schedules"][0]["dates"]["2026-10-03"][0]
        self.assertEqual(entry, {"start": "18:00", "end": ""})


if __name__ == "__main__":
    unittest.main()

