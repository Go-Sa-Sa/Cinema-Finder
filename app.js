// ==========================================================================
// Chiba Cinema Finder - Main Entry Point (ES Module)
// ==========================================================================

import { state } from './src/state.js';
import { registerServiceWorker } from './src/sw-register.js';
import { generateDateChips } from './src/dates.js';
import { fetchMovies, refreshData } from './src/api.js';
import { renderMoviesGallery } from './src/gallery.js';
import { renderMovieOptions, clearMovieSelection, filterMovieOptions } from './src/dropdown.js';

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

function setupEventListeners() {
    const input = document.getElementById("movie-select-input");
    const list = document.getElementById("movie-options-list");
    const clearBtn = document.getElementById("clear-movie-btn");
    const refreshBtn = document.getElementById("refresh-cache-btn");
    
    // タブ切り替えのイベント設定
    const tabShowing = document.getElementById("tab-now-showing");
    const tabUpcoming = document.getElementById("tab-upcoming");
    if (tabShowing && tabUpcoming) {
        tabShowing.addEventListener("click", () => {
            if (state.activeTab === "showing") return;
            state.activeTab = "showing";
            tabShowing.classList.add("active");
            tabShowing.setAttribute("aria-selected", "true");
            tabUpcoming.classList.remove("active");
            tabUpcoming.setAttribute("aria-selected", "false");
            
            const subtitle = document.getElementById("gallery-subtitle");
            if (subtitle) subtitle.innerText = "作品をクリックすると、スケジュールが表示されます";
            
            renderMoviesGallery();
        });
        
        tabUpcoming.addEventListener("click", () => {
            if (state.activeTab === "upcoming") return;
            state.activeTab = "upcoming";
            tabUpcoming.classList.add("active");
            tabUpcoming.setAttribute("aria-selected", "true");
            tabShowing.classList.remove("active");
            tabShowing.setAttribute("aria-selected", "false");
            
            const subtitle = document.getElementById("gallery-subtitle");
            if (subtitle) subtitle.innerText = "近日公開予定の作品です（作品をクリックすると詳細が表示されます）";
            
            renderMoviesGallery();
        });
    }
    
    // 入力エリアフォーカスで候補リスト表示
    if (input && list) {
        input.addEventListener("focus", () => {
            renderMovieOptions(state.allMovies);
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
    }
    
    // 入力欄外のクリックで候補リストを閉じる
    document.addEventListener("click", (e) => {
        if (!e.target.closest(".custom-select-container") && list) {
            list.style.display = "none";
        }
    });
    
    // クリアボタン
    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            clearMovieSelection();
        });
    }
    
    // キャッシュ更新ボタン
    if (refreshBtn) {
        refreshBtn.addEventListener("click", () => {
            refreshData();
        });
    }
    
    // ヘッダーの更新ボタン
    const headerRefreshBtn = document.getElementById("header-refresh-btn");
    if (headerRefreshBtn) {
        headerRefreshBtn.addEventListener("click", () => {
            refreshData();
        });
    }
}
