// ==========================================================================
// Schedule Display & Rendering Component
// ==========================================================================
import { state } from './state.js';
import { getScheduleFromCache, formatDateLabel } from './simulation.js';
import { isUpcomingMovie, renderUpcomingDetail } from './gallery.js';
import { escapeHtml, safeUrl } from './utils.js';

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
    document.getElementById("current-selection-title").innerText =
        `「${data.title}」の上映スケジュール (${formatDateLabel(data.date)})${data.is_simulation ? " ※未発表日" : ""}`;

    // 公式サイトリンクの制御
    const officialLink = document.getElementById("movie-official-link");
    const officialUrl = safeUrl(data.official_url);
    if (officialUrl) {
        officialLink.href = officialUrl;
        officialLink.style.display = "inline-flex";
    } else {
        officialLink.style.display = "none";
    }
    
    // 映画.comリンクの制御
    const eigacomLink = document.getElementById("movie-eigacom-link");
    const eigacomUrl = safeUrl(data.eigacom_url);
    if (eigacomUrl) {
        eigacomLink.href = eigacomUrl;
        eigacomLink.style.display = "inline-flex";
    } else {
        eigacomLink.style.display = "none";
    }
    
    // 未発表日の注意表示
    const simAlert = document.getElementById("simulation-alert");
    if (data.is_simulation) {
        const publishedUntil = data.latest_published_date
            ? `（発表済みは${formatDateLabel(data.latest_published_date)}まで）`
            : "";
        document.getElementById("simulation-alert-text").innerText =
            `この日の上映スケジュールはまだ発表されていません${publishedUntil}。` +
            "下の時刻は直近の実績（同じ曜日を優先）を「参考」として載せたもので、実際とは異なる場合があります。";
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
        const status = theaterData ? theaterData.status : "missing";
        if (status === "reference") {
            card.classList.add("sim-card");
        }
        
        // ヘッダー部分
        const header = document.createElement("div");
        header.className = "theater-card-header";
        
        const theaterUrl = theaterData ? safeUrl(theaterData.url) : "";
        const hasUrl = Boolean(theaterUrl);
        
        header.innerHTML = `
            <a href="${hasUrl ? escapeHtml(theaterUrl) : "#"}" target="_blank" rel="noopener noreferrer" class="theater-name-link">
                ${escapeHtml(theaterName)} ${hasUrl ? '<i class="fa-solid fa-arrow-up-right-from-square"></i>' : ''}
            </a>
        `;
        card.appendChild(header);
        
        // ボディ部分（上映スケジュール）
        const body = document.createElement("div");
        body.className = "theater-card-body";
        
        if (theaterData && theaterData.schedules && theaterData.schedules.length > 0) {
            if (status === "reference") {
                const note = document.createElement("p");
                note.className = "reference-note";
                note.innerHTML = `<i class="fa-solid fa-circle-info"></i> 未発表のため、${escapeHtml(formatDateLabel(theaterData.reference_date))}の時刻を参考表示`;
                body.appendChild(note);
            }
            theaterData.schedules.forEach(sched => {
                const block = document.createElement("div");
                block.className = "format-block";
                
                // 上映形式をパースしてバッジを配置
                const formats = sched.format.split("/");
                let badgesHtml = "";
                formats.forEach(f => {
                    const cleanF = f.trim();
                    if (cleanF) {
                        badgesHtml += `<span class="badge ${getBadgeClass(cleanF)}">${escapeHtml(cleanF)}</span>`;
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
                    
                    // 終了時刻が劇場未掲載で上映時間から推定したものは「頃」を付けて区別する
                    const endHtml = t.end
                        ? (t.end_estimated
                            ? `<span class="end-t estimated" title="上映時間から推定した終了時刻">～${escapeHtml(t.end)}頃</span>`
                            : `<span class="end-t">～${escapeHtml(t.end)}</span>`)
                        : `<span class="end-t"></span>`;
                    timeChip.innerHTML = `
                        <span class="start-t">${escapeHtml(t.start)}</span>
                        ${endHtml}
                    `;
                    timeList.appendChild(timeChip);
                });
                block.appendChild(timeList);
                
                body.appendChild(block);
            });
        } else {
            // 上映情報がない場合（理由を区別して表示する）
            let icon = "fa-calendar-xmark";
            let message = "指定日の上映予定はありません";
            if (status === "missing") {
                icon = "fa-triangle-exclamation";
                message = "この劇場のスケジュールを取得できませんでした";
            } else if (status === "unpublished") {
                message = "現在この劇場では上映していません（この日のスケジュールは未発表）";
            } else if (status === "reference") {
                icon = "fa-hourglass-half";
                message = "この日のスケジュールはまだ発表されていません";
            } else if (status === "opening") {
                icon = "fa-hourglass-half";
                message = `${formatDateLabel(theaterData.release_date)}公開予定。この日のスケジュールはまだ発表されていません`;
            } else if (status === "ended") {
                icon = "fa-hourglass-end";
                message = `${formatDateLabel(theaterData.last_date)}までの掲載です（その後は上映終了の可能性があります）`;
            }
            body.innerHTML = `
                <div class="no-schedule-msg">
                    <i class="fa-solid ${icon}"></i>
                    <span>${escapeHtml(message)}</span>
                </div>
            `;
        }
        
        card.appendChild(body);
        grid.appendChild(card);
    });
}
