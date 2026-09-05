// ==========================================================================
// Schedule Display & Rendering Component
// ==========================================================================
import { state } from './state.js';
import { getScheduleFromCache } from './simulation.js';
import { isUpcomingMovie, renderUpcomingDetail } from './gallery.js';

export const targetTheaters = [
    "USシネマちはら台",
    "T・ジョイ蘇我",
    "TOHOシネマズ市原",
    "京成ローザ10",
    "USシネマ木更津",
    "イオンシネマ幕張新都心",
    "イオンシネマ津田沼South"
];

export function getBadgeClass(formatText) {
    const text = formatText.toLowerCase();
    if (text.includes("imax")) return "badge-imax";
    if (text.includes("4dx") || text.includes("mx4d")) return "badge-4dx";
    if (text.includes("screenx") || text.includes("screen x")) return "badge-screenx";
    if (text.includes("字幕")) return "badge-subtitle";
    if (text.includes("吹替")) return "badge-dubbed";
    return "badge-generic";
}

export function onSelectionChange() {
    if (state.selectedMovie && (state.selectedDate || isUpcomingMovie(state.selectedMovie))) {
        fetchSchedule();
    }
}

export async function fetchSchedule() {
    if (!state.selectedMovie) return;
    
    // 上映予定映画の場合は、日付に関わらず詳細予告をレンダリングする
    if (isUpcomingMovie(state.selectedMovie)) {
        renderUpcomingDetail(state.selectedMovie);
        return;
    }
    
    if (!state.selectedDate) return;
    
    // 画面状態の切り替え
    document.getElementById("placeholder-state").style.display = "none";
    document.getElementById("loading-state").style.display = "flex";
    document.getElementById("schedule-grid").style.display = "none";
    document.getElementById("simulation-alert").style.display = "none";
    document.getElementById("schedule-legend").style.display = "none";
    
    // タイトルの更新
    const dateObj = new Date(state.selectedDate);
    const formattedDate = `${dateObj.getMonth() + 1}月${dateObj.getDate()}日`;
    document.getElementById("current-selection-title").innerText = `「${state.selectedMovie}」の上映スケジュール (${formattedDate})`;
    
    try {
        // 少しスピナーを見せる演出（UXのため）
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const data = getScheduleFromCache(state.selectedMovie, state.selectedDate);
        renderSchedule(data);
        
    } catch (error) {
        console.error("Error displaying schedule:", error);
        document.getElementById("loading-state").style.display = "none";
        document.getElementById("placeholder-state").style.display = "flex";
        document.getElementById("current-selection-title").innerText = "スケジュール取得エラー";
    }
}

export function renderSchedule(data) {
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
    
    // シミュレーション（予測）警告の制御
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
