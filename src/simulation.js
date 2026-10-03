// ==========================================================================
// Schedule Lookup & Reference Schedules for Unpublished Dates (Pure Functions)
// ==========================================================================
import { state } from './state.js';

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

// "YYYY-MM-DD" をローカル日付として解釈する（new Date("YYYY-MM-DD") は UTC 扱いになるため）
export function parseDateKey(dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d);
}

// "2026-10-08" → "10月8日(木)"
export function formatDateLabel(dateStr) {
    const dt = parseDateKey(dateStr);
    return `${dt.getMonth() + 1}月${dt.getDate()}日(${WEEKDAYS[dt.getDay()]})`;
}

function collectDates(movies) {
    const dates = new Set();
    for (const m of movies) {
        for (const s of m.schedules || []) {
            Object.keys(s.dates || {}).forEach(d => dates.add(d));
        }
    }
    return Array.from(dates).sort();
}

// 劇場が発表済みのスケジュールの最終日（データが無ければ空文字）
export function getLastPublishedDate(theaterData) {
    const dates = collectDates((theaterData && theaterData.movies) || []);
    return dates.length > 0 ? dates[dates.length - 1] : "";
}

// 全劇場の中で最も先まで発表されている日
export function getLatestPublishedDate(moviesData) {
    const theaters = (moviesData && moviesData.theaters) || {};
    return Object.values(theaters)
        .map(getLastPublishedDate)
        .reduce((latest, d) => (d > latest ? d : latest), "");
}

function schedulesOn(movieData, dateStr) {
    if (!movieData) return [];
    return (movieData.schedules || [])
        .filter(s => s.dates && Array.isArray(s.dates[dateStr]) && s.dates[dateStr].length > 0)
        .map(s => ({ format: s.format || "2D", times: s.dates[dateStr].map(t => ({ ...t })) }));
}

// 劇場がまだ発表していない日の表示内容を決める。
// 時刻を作り出すことはせず、同じ曜日の直近の実績（無ければ最終日）をそのまま「参考」として返す。
function buildReference(movieData, dateStr, theaterLastDate, releaseDate) {
    if (!movieData) return { status: "unpublished" };
    const movieDates = collectDates([movieData]);
    if (movieDates.length === 0) return { status: "unpublished" };

    // 先行上映だけが掲載されている公開前の作品は、その時刻が本公開後の参考にならない
    if (releaseDate && releaseDate > theaterLastDate) {
        return { status: "opening", release_date: releaseDate };
    }

    // 劇場の発表済み最終日に上映が無い作品は終了に向かっている可能性が高いので、参考時刻は出さない
    const movieLastDate = movieDates[movieDates.length - 1];
    if (movieLastDate < theaterLastDate) {
        return { status: "ended", last_date: movieLastDate };
    }

    const weekday = parseDateKey(dateStr).getDay();
    const sameWeekday = movieDates.filter(d => parseDateKey(d).getDay() === weekday);
    const referenceDate = sameWeekday.length > 0 ? sameWeekday[sameWeekday.length - 1] : movieLastDate;
    return {
        status: "reference",
        reference_date: referenceDate,
        schedules: schedulesOn(movieData, referenceDate)
    };
}

// 各劇場の結果 status:
//   "published"   … 発表済みの日（schedules が空なら上映なし）
//   "reference"   … 未発表の日。reference_date の実績時刻を参考表示
//   "ended"       … 未発表の日。last_date 以降の掲載が無く上映終了の可能性
//   "opening"     … 未発表の日。release_date に公開予定（先行上映のみ掲載中）
//   "unpublished" … 未発表の日。この劇場では現在上映していない
export function getScheduleFromCache(title, dateStr) {
    if (!state.moviesData) return { error: "No data loaded" };

    let officialUrl = "";
    let eigacomUrl = "";
    const theaters = state.moviesData.theaters || {};
    const releaseDate = (state.movieDetails[title] || {}).release_date || "";
    const results = {};

    for (const [theaterName, theaterData] of Object.entries(theaters)) {
        const movieData = (theaterData.movies || []).find(m => m.title === title) || null;
        if (movieData) {
            if (!officialUrl && movieData.official_url) officialUrl = movieData.official_url;
            if (!eigacomUrl && movieData.eigacom_url) eigacomUrl = movieData.eigacom_url;
        }

        const result = { name: theaterName, url: theaterData.url || "", schedules: [] };
        const theaterLastDate = getLastPublishedDate(theaterData);
        if (theaterLastDate && dateStr <= theaterLastDate) {
            result.status = "published";
            result.schedules = schedulesOn(movieData, dateStr);
        } else {
            Object.assign(result, buildReference(movieData, dateStr, theaterLastDate, releaseDate));
        }
        results[theaterName] = result;
    }

    return {
        title: title,
        date: dateStr,
        is_simulation: Object.values(results).some(r => r.status !== "published"),
        latest_published_date: getLatestPublishedDate(state.moviesData),
        official_url: officialUrl,
        eigacom_url: eigacomUrl,
        results: results
    };
}
