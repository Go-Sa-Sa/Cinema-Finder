// ==========================================================================
// Movies Gallery & Upcoming Detail Component
// ==========================================================================
import { state } from './state.js';
import { selectMovie } from './dropdown.js';
import { onSelectionChange } from './schedule.js';
import { escapeHtml, safeUrl } from './utils.js';

export function isUpcomingMovie(title) {
    return state.upcomingMovies.some(m => m.title === title);
}

export function renderMoviesGallery() {
    const grid = document.getElementById("movies-gallery-grid");
    if (!grid) return;
    grid.innerHTML = "";
    
    const isUpcoming = state.activeTab === "upcoming";
    const moviesToRender = isUpcoming ? state.upcomingMovies.map(m => m.title) : state.allMovies;
    
    if (moviesToRender.length === 0) {
        const msg = isUpcoming ? "上映予定の作品情報がありません" : "上映中の作品情報がありません";
        grid.innerHTML = `<div class="no-movies-gallery" style="color: var(--text-muted); padding: 2rem; text-align: center;">${msg}</div>`;
        return;
    }
    
    moviesToRender.forEach(title => {
        const details = state.movieDetails[title] || {};
        const safeTitle = escapeHtml(title);
        
        const card = document.createElement("div");
        card.className = "movie-gallery-card";
        
        // ポスター画像
        const posterUrl = escapeHtml(safeUrl(details.poster_url));
        let posterHtml = "";
        if (posterUrl) {
            posterHtml = `
                <div class="movie-gallery-poster">
                    <img src="${posterUrl}" alt="${safeTitle}" loading="lazy" onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'movie-gallery-poster-placeholder\\'><i class=\\'fa-solid fa-film\\'></i><span>NO IMAGE</span></div>';">
                </div>
            `;
        } else {
            posterHtml = `
                <div class="movie-gallery-poster">
                    <div class="movie-gallery-poster-placeholder">
                        <i class="fa-solid fa-film"></i>
                        <span>NO IMAGE</span>
                    </div>
                </div>
            `;
        }
        
        // メタ情報 (監督・キャスト)
        const director = escapeHtml(details.director || "情報なし");
        const cast = escapeHtml((details.cast && details.cast.length > 0) ? details.cast.join(", ") : "情報なし");
        const description = escapeHtml(details.description || "あらすじ情報はありません。");
        const copyright = escapeHtml(details.copyright || "");
        const releaseDateFormatted = escapeHtml(details.release_date_formatted || "");
        const officialUrl = escapeHtml(safeUrl(details.official_url));
        const eigacomUrl = escapeHtml(safeUrl(details.eigacom_url));
        
        // リンクボタン
        let linksHtml = "";
        if (officialUrl) {
            linksHtml += `
                <a href="${officialUrl}" target="_blank" rel="noopener noreferrer" class="movie-gallery-btn" onclick="event.stopPropagation();">
                    <i class="fa-solid fa-earth-americas"></i>公式サイト
                </a>
            `;
        }
        if (eigacomUrl) {
            linksHtml += `
                <a href="${eigacomUrl}" target="_blank" rel="noopener noreferrer" class="movie-gallery-btn" onclick="event.stopPropagation();">
                    <i class="fa-solid fa-calendar-days"></i>作品情報 (映画.com)
                </a>
            `;
        }
        
        card.innerHTML = `
            ${posterHtml}
            <div class="movie-gallery-info">
                ${releaseDateFormatted ? `<span class="movie-gallery-release">${releaseDateFormatted}</span>` : ''}
                <h3 class="movie-gallery-title">${safeTitle}</h3>
                ${linksHtml ? `<div class="movie-gallery-links">${linksHtml}</div>` : ''}
                <div class="movie-gallery-meta-row">
                    <span class="movie-gallery-meta-label">監督</span>
                    <span class="movie-gallery-meta-value">${director}</span>
                </div>
                <div class="movie-gallery-meta-row">
                    <span class="movie-gallery-meta-label">出演</span>
                    <span class="movie-gallery-meta-value">${cast}</span>
                </div>
                <p class="movie-gallery-desc">${description}</p>
                ${copyright ? `<p class="movie-gallery-copyright">${copyright}</p>` : ''}
            </div>
        `;
        
        // カードクリック時のインタラクション
        card.addEventListener("click", () => {
            selectMovie(title);
            
            // 上映予定作品でない場合のみ日付チップとの自動連動を行う
            if (!isUpcomingMovie(title)) {
                // 日付が未選択の場合は、自動的に「今日（一番最初の日付チップ）」を選択する
                if (!state.selectedDate) {
                    const firstDateChip = document.querySelector(".date-scroll-container .date-chip");
                    if (firstDateChip) {
                        firstDateChip.click();
                    }
                } else {
                    onSelectionChange();
                }
            } else {
                onSelectionChange();
            }
            
            // 画面上部の検索パネルまでスムーズにスクロール
            const searchPanel = document.querySelector(".search-panel");
            if (searchPanel) {
                searchPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
        
        grid.appendChild(card);
    });
}

export function renderUpcomingDetail(title) {
    document.getElementById("placeholder-state").style.display = "none";
    document.getElementById("loading-state").style.display = "none";
    document.getElementById("schedule-legend").style.display = "none";
    document.getElementById("simulation-alert").style.display = "none";
    
    const details = state.movieDetails[title] || {};
    const safeTitle = escapeHtml(title);
    const posterUrl = escapeHtml(safeUrl(details.poster_url));
    const director = escapeHtml(details.director || "情報なし");
    const cast = escapeHtml((details.cast && details.cast.length > 0) ? details.cast.join(", ") : "情報なし");
    const description = escapeHtml(details.description || "あらすじ情報はありません。");
    const releaseDateFormatted = escapeHtml(details.release_date_formatted || "近日公開");
    // href プロパティへ直接代入する分はエスケープ不要（スキームのみ検証）
    const rawOfficialUrl = safeUrl(details.official_url);
    const rawEigacomUrl = safeUrl(details.eigacom_url);
    const officialUrl = escapeHtml(rawOfficialUrl);
    const eigacomUrl = escapeHtml(rawEigacomUrl);
    
    // タイトルの更新
    document.getElementById("current-selection-title").innerText = `「${title}」作品情報`;
    
    // 公式サイト・映画.comリンク
    const officialLink = document.getElementById("movie-official-link");
    if (rawOfficialUrl) {
        officialLink.href = rawOfficialUrl;
        officialLink.style.display = "inline-flex";
    } else {
        officialLink.style.display = "none";
    }
    
    const eigacomLink = document.getElementById("movie-eigacom-link");
    if (rawEigacomUrl) {
        eigacomLink.href = rawEigacomUrl;
        eigacomLink.style.display = "inline-flex";
    } else {
        eigacomLink.style.display = "none";
    }
    
    // リンクボタンのHTML
    let linksHtml = "";
    if (officialUrl) {
        linksHtml += `
            <a href="${officialUrl}" target="_blank" rel="noopener noreferrer" class="upcoming-btn">
                <i class="fa-solid fa-earth-americas"></i>公式サイト
            </a>
        `;
    }
    if (eigacomUrl) {
        linksHtml += `
            <a href="${eigacomUrl}" target="_blank" rel="noopener noreferrer" class="upcoming-btn">
                <i class="fa-solid fa-calendar-days"></i>作品情報 (映画.com)
            </a>
        `;
    }
    
    const grid = document.getElementById("schedule-grid");
    grid.style.display = "block";
    grid.innerHTML = `
        <div class="upcoming-detail-card">
            <div class="upcoming-detail-poster">
                ${posterUrl ? `<img src="${posterUrl}" alt="${safeTitle}" onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'upcoming-detail-poster-placeholder\\'><i class=\\'fa-solid fa-film\\'></i><span>NO IMAGE</span></div>';">` : `
                    <div class="upcoming-detail-poster-placeholder">
                        <i class="fa-solid fa-film"></i>
                        <span>NO IMAGE</span>
                    </div>
                `}
            </div>
            <div class="upcoming-detail-info">
                <span class="upcoming-release-badge"><i class="fa-solid fa-calendar"></i> ${releaseDateFormatted}</span>
                <h3>${safeTitle}</h3>
                <div class="upcoming-meta">
                    <p><strong>監督:</strong> ${director}</p>
                    <p><strong>出演:</strong> ${cast}</p>
                </div>
                <p class="upcoming-description">${description}</p>
                <div class="upcoming-links">
                    ${linksHtml}
                </div>
                <div class="upcoming-notice">
                    <i class="fa-solid fa-circle-info"></i> この作品は上映予定の作品です。公開日以降に順次上映スケジュールが掲載されます。
                </div>
            </div>
        </div>
    `;
}
