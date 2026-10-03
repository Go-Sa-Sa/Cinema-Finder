// ==========================================================================
// Simulation & Schedule Calculations (Pure Functions)
// ==========================================================================
import { state } from './state.js';

export function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0;
    }
    return Math.abs(hash);
}

// 擬似乱数生成器 (LCG)
export function createRandom(seed) {
    let currentSeed = seed;
    return function() {
        currentSeed = (1664525 * currentSeed + 1013904223) % 4294967296;
        return currentSeed / 4294967296;
    };
}

const TIME_PATTERN = /^(\d{1,2}):(\d{2})$/;

function parseTimeMinutes(timeStr) {
    const match = TIME_PATTERN.exec(timeStr || "");
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
}

// 上映時間（分）を返す。終了時刻が無い・不正な場合は null
export function getDurationMinutes(startStr, endStr) {
    const startMin = parseTimeMinutes(startStr);
    let endMin = parseTimeMinutes(endStr);
    if (startMin === null || endMin === null) return null;
    if (endMin < startMin) { // 深夜またぎ
        endMin += 24 * 60;
    }
    return endMin - startMin;
}

// 時刻に分を加算する。計算できない場合は空文字（終了時刻なし扱い）
export function addMinutes(timeStr, minutes) {
    const baseMin = parseTimeMinutes(timeStr);
    if (baseMin === null || !Number.isFinite(minutes)) return "";
    const total = ((baseMin + minutes) % (24 * 60) + 24 * 60) % (24 * 60);
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function generateSimulationSchedule(targetTitle, targetDateStr, cacheData) {
    const seed = hashCode(targetTitle + targetDateStr);
    const random = createRandom(seed);
    const randomChoice = (arr) => arr[Math.floor(random() * arr.length)];
    
    const simulatedTheaters = {};
    const theaters = (cacheData && cacheData.theaters) ? cacheData.theaters : {};
    
    const targetDate = new Date(targetDateStr);
    const isWeekend = targetDate.getDay() === 0 || targetDate.getDay() === 6;
    
    for (const [theaterName, theaterData] of Object.entries(theaters)) {
        let movieData = null;
        for (const m of theaterData.movies || []) {
            if (m.title === targetTitle) {
                movieData = m;
                break;
            }
        }
        
        if (!movieData) continue;
        
        const simulatedSchedules = [];
        
        for (const schedule of movieData.schedules || []) {
            const fmt = schedule.format || "2D";
            const datesDict = schedule.dates || {};
            
            const allRealTimes = [];
            for (const [dateKey, times] of Object.entries(datesDict)) {
                for (const t of times) {
                    const duration = getDurationMinutes(t.start, t.end || "");
                    allRealTimes.push({ start: t.start, duration });
                }
            }
            
            if (allRealTimes.length === 0) continue;
            
            const uniqueStarts = Array.from(new Set(allRealTimes.map(item => item.start))).sort();
            // 終了時刻が判明している回だけで平均上映時間を求める（無ければ終了時刻は表示しない）
            const knownDurations = allRealTimes.map(item => item.duration).filter(d => d !== null);
            const avgDuration = knownDurations.length > 0
                ? Math.round(knownDurations.reduce((sum, d) => sum + d, 0) / knownDurations.length)
                : null;
            
            const simulatedTimes = [];
            for (const startTime of uniqueStarts) {
                let shiftMinutes = 0;
                if (isWeekend) {
                    shiftMinutes = randomChoice([-15, 0, 15, 30]);
                } else {
                    shiftMinutes = randomChoice([-30, -15, 0, 15]);
                }
                
                const simStart = addMinutes(startTime, shiftMinutes);
                const simEnd = avgDuration !== null ? addMinutes(simStart, avgDuration) : "";
                
                simulatedTimes.push({
                    start: simStart,
                    end: simEnd,
                    is_simulation: true
                });
            }
            
            simulatedTimes.sort((a, b) => a.start.localeCompare(b.start));
            
            simulatedSchedules.push({
                format: fmt,
                times: simulatedTimes
            });
        }
        
        if (simulatedSchedules.length > 0) {
            simulatedTheaters[theaterName] = {
                name: theaterName,
                url: theaterData.url || "",
                schedules: simulatedSchedules
            };
        }
    }
    
    return simulatedTheaters;
}

export function getScheduleFromCache(title, dateStr) {
    if (!state.moviesData) return { error: "No data loaded" };
    
    let hasRealDate = false;
    let officialUrl = "";
    let eigacomUrl = "";
    const theaters = state.moviesData.theaters || {};
    
    // 実データの存在チェックと URL の抽出
    for (const [theaterName, theaterData] of Object.entries(theaters)) {
        for (const m of theaterData.movies || []) {
            if (m.title === title) {
                if (m.official_url) officialUrl = m.official_url;
                if (m.eigacom_url) eigacomUrl = m.eigacom_url;
                for (const schedule of m.schedules || []) {
                    if (schedule.dates && dateStr in schedule.dates) {
                        hasRealDate = true;
                        break;
                    }
                }
            }
            if (hasRealDate) break;
        }
        if (hasRealDate) break;
    }
    
    const results = {};
    
    if (hasRealDate) {
        for (const [theaterName, theaterData] of Object.entries(theaters)) {
            let movieData = null;
            for (const m of theaterData.movies || []) {
                if (m.title === title) {
                    movieData = m;
                    break;
                }
            }
            
            if (!movieData) continue;
            
            const theaterSchedules = [];
            for (const schedule of movieData.schedules || []) {
                const fmt = schedule.format || "2D";
                const datesDict = schedule.dates || {};
                
                if (dateStr in datesDict) {
                    const times = datesDict[dateStr].map(t => ({
                        ...t,
                        is_simulation: false
                    }));
                    
                    theaterSchedules.push({
                        format: fmt,
                        times: times
                    });
                }
            }
            
            if (theaterSchedules.length > 0) {
                results[theaterName] = {
                    name: theaterName,
                    url: theaterData.url || "",
                    schedules: theaterSchedules
                };
            }
        }
    } else {
        // シミュレーションデータ生成
        const simResults = generateSimulationSchedule(title, dateStr, state.moviesData);
        Object.assign(results, simResults);
        
        // シミュレーションの場合も、データ内にあれば URL を補完する
        for (const [theaterName, theaterData] of Object.entries(theaters)) {
            for (const m of theaterData.movies || []) {
                if (m.title === title) {
                    if (!officialUrl && m.official_url) officialUrl = m.official_url;
                    if (!eigacomUrl && m.eigacom_url) eigacomUrl = m.eigacom_url;
                }
            }
        }
    }
    
    return {
        title: title,
        date: dateStr,
        is_simulation: !hasRealDate,
        official_url: officialUrl,
        eigacom_url: eigacomUrl,
        results: results
    };
}
