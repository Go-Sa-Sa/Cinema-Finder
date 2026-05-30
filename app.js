// ==========================================================================
// Global State & Initialization
// ==========================================================================
let moviesData = null; // movies_data.json の全データ
let allMovies = [];
let selectedMovie = "";
let selectedDate = ""; // YYYY-MM-DD 形式

document.addEventListener("DOMContentLoaded", () => {
    initApp();
});

async function initApp() {
    // 1. 日付チップの生成
    generateDateChips();
    
    // 2. 映画データの初期取得
    await fetchMovies();
    
    // 3. イベントリスナーの設定
    setupEventListeners();
    
    // 4. PWA Service Workerの登録
    registerServiceWorker();
}

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./service-worker.js')
                .then(reg => {
                    console.log('Service Worker registered successfully.', reg);
                    
                    // 新しいサービスワーカー（アップデート）のインストール完了を検知してリロード
                    reg.onupdatefound = () => {
                        const installingWorker = reg.installing;
                        if (installingWorker) {
                            installingWorker.onstatechange = () => {
                                if (installingWorker.state === 'installed') {
                                    if (navigator.serviceWorker.controller) {
                                        console.log('New version detected. Reloading...');
                                        window.location.reload();
                                    }
                                }
                            };
                        }
                    };
                })
                .catch(err => console.log('Service Worker registration failed.', err));
        });
    }
}

// ==========================================================================
// Date Generation (Today to 14 Days Later)
// ==========================================================================
function generateDateChips() {
    const container = document.getElementById("date-scroll-container");
    container.innerHTML = "";
    
    const today = new Date();
    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    const weekdayClasses = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    
    for (let i = 0; i < 15; i++) { // 今日から14日後まで（全15日間）
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + i);
        
        const year = targetDate.getFullYear();
        const month = targetDate.getMonth() + 1;
        const date = targetDate.getDate();
        const weekdayIndex = targetDate.getDay();
        
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
        
        // チップ要素を作成
        const chip = document.createElement("div");
        chip.className = "date-chip";
        chip.setAttribute("role", "radio");
        chip.setAttribute("aria-checked", "false");
        chip.dataset.date = dateStr;
        
        // 曜日クラスの設定（土日用）
        const weekdayClass = weekdayClasses[weekdayIndex];
        
        chip.innerHTML = `
            <span class="chip-month">${month}月</span>
            <span class="chip-day">${date}</span>
            <span class="chip-weekday ${weekdayClass}">${weekdays[weekdayIndex]}</span>
        `;
        
        chip.addEventListener("click", () => {
            // アクティブ表示の切り替え
            document.querySelectorAll(".date-chip").forEach(c => {
                c.classList.remove("active");
                c.setAttribute("aria-checked", "false");
            });
            chip.classList.add("active");
            chip.setAttribute("aria-checked", "true");
            
            selectedDate = dateStr;
            onSelectionChange();
        });
        
        container.appendChild(chip);
    }
}

// ==========================================================================
// Data Processing & Simulation (Pure Client Side)
// ==========================================================================
async function fetchMovies() {
    try {
        const response = await fetch("movies_data.json");
        if (!response.ok) throw new Error("Failed to fetch movies data");
        
        moviesData = await response.json();
        
        // 全劇場の上映作品を集めて重複を排除する
        const movieTitles = new Set();
        if (moviesData && moviesData.theaters) {
            for (const [theaterName, theaterInfo] of Object.entries(moviesData.theaters)) {
                if (theaterInfo.movies) {
                    theaterInfo.movies.forEach(movie => {
                        movieTitles.add(movie.title);
                    });
                }
            }
        }
        allMovies = Array.from(movieTitles).sort();
        
        // 最終更新日時の更新
        const updateInfo = document.getElementById("update-info");
        if (moviesData.last_updated) {
            updateInfo.innerHTML = `<i class="fa-solid fa-clock"></i> 更新: ${moviesData.last_updated}`;
        } else {
            updateInfo.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> データ未取得`;
        }
        
        // ドロップダウンリストを構築
        renderMovieOptions(allMovies);
        
    } catch (error) {
        console.error("Error fetching movies:", error);
        const updateInfo = document.getElementById("update-info");
        updateInfo.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> データ取得エラー`;
    }
}

// ハッシュ値の計算 (String -> Number)
function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0;
    }
    return Math.abs(hash);
}

// 擬似乱数生成器 (LCG)
function createRandom(seed) {
    let currentSeed = seed;
    return function() {
        currentSeed = (1664525 * currentSeed + 1013904223) % 4294967296;
        return currentSeed / 4294967296;
    };
}

function getDurationMinutes(startStr, endStr) {
    try {
        const [sh, sm] = startStr.split(':').map(Number);
        const [eh, em] = endStr.split(':').map(Number);
        let startMin = sh * 60 + sm;
        let endMin = eh * 60 + em;
        if (endMin < startMin) { // 深夜またぎ
            endMin += 24 * 60;
        }
        return endMin - startMin;
    } catch (e) {
        return 120; // デフォルト120分
    }
}

function addMinutes(timeStr, minutes) {
    try {
        const [h, m] = timeStr.split(':').map(Number);
        const date = new Date(2000, 0, 1, h, m + minutes);
        return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    } catch (e) {
        return timeStr;
    }
}

function generateSimulationSchedule(targetTitle, targetDateStr, cacheData) {
    const seed = hashCode(targetTitle + targetDateStr);
    const random = createRandom(seed);
    const randomChoice = (arr) => arr[Math.floor(random() * arr.length)];
    
    const simulatedTheaters = {};
    const theaters = cacheData.theaters || {};
    
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
            const avgDuration = allRealTimes[0].duration;
            
            const simulatedTimes = [];
            for (const startTime of uniqueStarts) {
                let shiftMinutes = 0;
                if (isWeekend) {
                    shiftMinutes = randomChoice([-15, 0, 15, 30]);
                } else {
                    shiftMinutes = randomChoice([-30, -15, 0, 15]);
                }
                
                const simStart = addMinutes(startTime, shiftMinutes);
                const simEnd = addMinutes(simStart, avgDuration);
                
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

function getScheduleFromCache(title, dateStr) {
    if (!moviesData) return { error: "No data loaded" };
    
    let hasRealDate = false;
    let officialUrl = "";
    let eigacomUrl = "";
    const theaters = moviesData.theaters || {};
    
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
        const simResults = generateSimulationSchedule(title, dateStr, moviesData);
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

async function fetchSchedule() {
    if (!selectedMovie || !selectedDate) return;
    
    // 画面状態の切り替え
    document.getElementById("placeholder-state").style.display = "none";
    document.getElementById("loading-state").style.display = "flex";
    document.getElementById("schedule-grid").style.display = "none";
    document.getElementById("simulation-alert").style.display = "none";
    document.getElementById("schedule-legend").style.display = "none";
    
    // タイトルの更新
    const dateObj = new Date(selectedDate);
    const formattedDate = `${dateObj.getMonth() + 1}月${dateObj.getDate()}日`;
    document.getElementById("current-selection-title").innerText = `「${selectedMovie}」の上映スケジュール (${formattedDate})`;
    
    try {
        // 少しスピナーを見せる演出（UXのため）
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const data = getScheduleFromCache(selectedMovie, selectedDate);
        renderSchedule(data);
        
    } catch (error) {
        console.error("Error displaying schedule:", error);
        document.getElementById("loading-state").style.display = "none";
        document.getElementById("placeholder-state").style.display = "flex";
        document.getElementById("current-selection-title").innerText = "スケジュール取得エラー";
    }
}

// ==========================================================================
// Rendering Logic
// ==========================================================================
function renderMovieOptions(movies) {
    const list = document.getElementById("movie-options-list");
    list.innerHTML = "";
    
    if (movies.length === 0) {
        list.innerHTML = `<div class="no-options">上映中の映画がありません</div>`;
        return;
    }
    
    movies.forEach(movie => {
        const option = document.createElement("div");
        option.className = "custom-option";
        option.innerText = movie;
        option.addEventListener("click", () => {
            selectMovie(movie);
        });
        list.appendChild(option);
    });
}

function selectMovie(movie) {
    const input = document.getElementById("movie-select-input");
    input.value = movie;
    selectedMovie = movie;
    
    document.getElementById("clear-movie-btn").style.display = "block";
    document.getElementById("movie-options-list").style.display = "none";
    
    onSelectionChange();
}

function clearMovieSelection() {
    const input = document.getElementById("movie-select-input");
    input.value = "";
    selectedMovie = "";
    document.getElementById("clear-movie-btn").style.display = "none";
    document.getElementById("movie-options-list").style.display = "none";
    
    // 画面を初期状態に戻す
    document.getElementById("placeholder-state").style.display = "flex";
    document.getElementById("loading-state").style.display = "none";
    document.getElementById("schedule-grid").style.display = "none";
    document.getElementById("simulation-alert").style.display = "none";
    document.getElementById("schedule-legend").style.display = "none";
    document.getElementById("movie-official-link").style.display = "none";
    document.getElementById("movie-eigacom-link").style.display = "none";
    document.getElementById("current-selection-title").innerText = "映画と日付を選択してください";
}

function onSelectionChange() {
    if (selectedMovie && selectedDate) {
        fetchSchedule();
    }
}

function getBadgeClass(formatText) {
    const text = formatText.toLowerCase();
    if (text.includes("imax")) return "badge-imax";
    if (text.includes("4dx") || text.includes("mx4d")) return "badge-4dx";
    if (text.includes("screenx") || text.includes("screen x")) return "badge-screenx";
    if (text.includes("字幕")) return "badge-subtitle";
    if (text.includes("吹替")) return "badge-dubbed";
    return "badge-generic";
}

// 6劇場の定義
const targetTheaters = [
    "USシネマちはら台",
    "T・ジョイ蘇我",
    "TOHOシネマズ市原",
    "京成ローザ10",
    "USシネマ木更津",
    "イオンシネマ幕張新都心"
];

function renderSchedule(data) {
    document.getElementById("loading-state").style.display = "none";
    document.getElementById("schedule-legend").style.display = "flex";
    
    // 公式サイトリンクの制御
    const officialLink = document.getElementById("movie-official-link");
    if (data.official_url) {
        officialLink.href = data.official_url;
        officialLink.style.display = "inline-flex";
    } else {
        officialLink.style.display = "none";
    }
    
    // 映画.comリンクの制御
    const eigacomLink = document.getElementById("movie-eigacom-link");
    if (data.eigacom_url) {
        eigacomLink.href = data.eigacom_url;
        eigacomLink.style.display = "inline-flex";
    } else {
        eigacomLink.style.display = "none";
    }
    
    // 1. シミュレーション（予測）警告の制御
    const simAlert = document.getElementById("simulation-alert");
    if (data.is_simulation) {
        simAlert.style.display = "block";
    } else {
        simAlert.style.display = "none";
    }
    
    const grid = document.getElementById("schedule-grid");
    grid.innerHTML = "";
    grid.style.display = "grid";
    
    const results = data.results || {};
    
    targetTheaters.forEach(theaterName => {
        const theaterData = results[theaterName];
        
        // 劇場カードの作成
        const card = document.createElement("article");
        card.className = "theater-card glass-card";
        if (data.is_simulation) {
            card.classList.add("sim-card");
        }
        
        // ヘッダー部分
        const header = document.createElement("div");
        header.className = "theater-card-header";
        
        const url = theaterData ? theaterData.url : "#";
        const hasUrl = url && url !== "#";
        
        header.innerHTML = `
            <a href="${url}" target="_blank" rel="noopener noreferrer" class="theater-name-link">
                ${theaterName} ${hasUrl ? '<i class="fa-solid fa-arrow-up-right-from-square"></i>' : ''}
            </a>
        `;
        card.appendChild(header);
        
        // ボディ部分（上映スケジュール）
        const body = document.createElement("div");
        body.className = "theater-card-body";
        
        if (theaterData && theaterData.schedules && theaterData.schedules.length > 0) {
            theaterData.schedules.forEach(sched => {
                const block = document.createElement("div");
                block.className = "format-block";
                
                // 上映形式をパースしてバッジを配置
                const formats = sched.format.split("/");
                let badgesHtml = "";
                formats.forEach(f => {
                    const cleanF = f.trim();
                    if (cleanF) {
                        badgesHtml += `<span class="badge ${getBadgeClass(cleanF)}">${cleanF}</span>`;
                    }
                });
                
                // フォーマットヘッダー
                const formatHeader = document.createElement("div");
                formatHeader.className = "format-header";
                formatHeader.innerHTML = badgesHtml;
                block.appendChild(formatHeader);
                
                // 上映時間チップ
                const timeList = document.createElement("div");
                timeList.className = "time-list";
                
                sched.times.forEach(t => {
                    const timeChip = document.createElement("div");
                    timeChip.className = "time-chip";
                    
                    timeChip.innerHTML = `
                        <span class="start-t">${t.start}</span>
                        <span class="end-t">${t.end ? '～' + t.end : ''}</span>
                    `;
                    timeList.appendChild(timeChip);
                });
                block.appendChild(timeList);
                
                body.appendChild(block);
            });
        } else {
            // 上映情報がない場合
            body.innerHTML = `
                <div class="no-schedule-msg">
                    <i class="fa-solid fa-calendar-xmark"></i>
                    <span>指定日の上映予定はありません</span>
                </div>
            `;
        }
        
        card.appendChild(body);
        grid.appendChild(card);
    });
}

// ==========================================================================
// Event Listeners & UI Helpers
// ==========================================================================
function setupEventListeners() {
    const input = document.getElementById("movie-select-input");
    const list = document.getElementById("movie-options-list");
    const clearBtn = document.getElementById("clear-movie-btn");
    const refreshBtn = document.getElementById("refresh-cache-btn");
    
    // 入力エリアフォーカスで候補リスト表示
    input.addEventListener("focus", () => {
        renderMovieOptions(allMovies);
        list.style.display = "block";
        setTimeout(() => {
            input.select();
        }, 50);
    });
    
    // 入力値変更で候補リストをフィルタリング
    input.addEventListener("input", () => {
        filterMovieOptions(input.value);
        list.style.display = "block";
    });
    
    // 入力欄外のクリックで候補リストを閉じる
    document.addEventListener("click", (e) => {
        if (!e.target.closest(".custom-select-container")) {
            list.style.display = "none";
        }
    });
    
    // クリアボタン
    clearBtn.addEventListener("click", () => {
        clearMovieSelection();
    });
    
    // キャッシュ更新ボタン (GitHub Actionsの自動更新を案内する形にする)
    refreshBtn.addEventListener("click", () => {
        triggerManualCrawl();
    });
    
    // ヘッダーの更新ボタン
    const headerRefreshBtn = document.getElementById("header-refresh-btn");
    if (headerRefreshBtn) {
        headerRefreshBtn.addEventListener("click", () => {
            triggerManualCrawl();
        });
    }
}

function filterMovieOptions(keyword) {
    const cleanKeyword = keyword.trim().toLowerCase();
    if (!cleanKeyword) {
        renderMovieOptions(allMovies);
        return;
    }
    
    const filtered = allMovies.filter(movie => 
        movie.toLowerCase().includes(cleanKeyword)
    );
    
    renderMovieOptions(filtered);
}

async function triggerManualCrawl() {
    const modal = document.getElementById("crawl-modal");
    if (modal) {
        modal.style.display = "flex";
    }
    
    try {
        const response = await fetch("/api/crawl", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            }
        });
        
        if (!response.ok) {
            throw new Error("Crawl request failed");
        }
        
        const result = await response.json();
        if (result.status === "success") {
            // キャッシュ再取得
            await fetchMovies();
            // 現在の選択に基づいてスケジュール再描画
            if (selectedMovie && selectedDate) {
                onSelectionChange();
            }
            alert("上映スケジュールの同期が完了しました！");
        } else {
            throw new Error(result.error || "Unknown error");
        }
    } catch (error) {
        console.error("Manual crawl error:", error);
        alert("上映スケジュールの同期に失敗しました。サーバーの接続状況やログを確認してください。");
    } finally {
        if (modal) {
            modal.style.display = "none";
        }
    }
}
