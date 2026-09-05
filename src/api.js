// ==========================================================================
// API & Data Fetching Module
// ==========================================================================
import { state } from './state.js';
import { renderMovieOptions } from './dropdown.js';
import { renderMoviesGallery } from './gallery.js';
import { onSelectionChange } from './schedule.js';

export async function fetchMovies(bypassCache = false) {
    try {
        const cacheBuster = bypassCache ? `?t=${Date.now()}` : "";
        const fetchOptions = bypassCache ? { cache: "reload" } : {};

        // movies_data.json と movie_details.json を並行して取得する
        const [moviesRes, detailsRes] = await Promise.all([
            fetch(`movies_data.json${cacheBuster}`, fetchOptions),
            fetch(`movie_details.json${cacheBuster}`, fetchOptions).catch(() => null)
        ]);
        
        if (!moviesRes.ok) throw new Error("Failed to fetch movies data");
        state.moviesData = await moviesRes.json();
        
        if (detailsRes && detailsRes.ok) {
            state.movieDetails = await detailsRes.json();
        } else {
            state.movieDetails = {};
        }
        
        // 全劇場の上映作品を集めて重複を排除する
        const movieTitles = new Set();
        if (state.moviesData && state.moviesData.theaters) {
            for (const [theaterName, theaterInfo] of Object.entries(state.moviesData.theaters)) {
                if (theaterInfo.movies) {
                    theaterInfo.movies.forEach(movie => {
                        movieTitles.add(movie.title);
                    });
                }
            }
        }
        state.allMovies = Array.from(movieTitles).sort();
        
        // 最終更新日時の更新
        const updateInfo = document.getElementById("update-info");
        if (updateInfo) {
            if (state.moviesData.last_updated) {
                updateInfo.innerHTML = `<i class="fa-solid fa-clock"></i> 更新: ${state.moviesData.last_updated}`;
            } else {
                updateInfo.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> データ未取得`;
            }
        }
        
        // 上映予定映画のリストをロード
        state.upcomingMovies = state.moviesData.upcoming || [];

        // ドロップダウンリストを構築
        renderMovieOptions(state.allMovies);
        
        // 上映中映画のギャラリーカード一覧をレンダリング
        renderMoviesGallery();
        
    } catch (error) {
        console.error("Error fetching movies:", error);
        const updateInfo = document.getElementById("update-info");
        if (updateInfo) {
            updateInfo.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> データ取得エラー`;
        }
        throw error;
    }
}

export async function refreshData() {
    const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    const updateInfo = document.getElementById("update-info");
    const originalUpdateInfoText = updateInfo ? updateInfo.innerHTML : "";

    // ローカル環境の場合、クローラーを実行して最新スケジュールを取得するか確認
    let shouldCrawl = false;
    if (isLocal) {
        shouldCrawl = confirm(
            "【スケジュール更新】\n映画.comから千葉7劇場の最新上映スケジュールを取得（スクレイピング）しますか？\n\n・「OK」: 映画.comから最新スケジュールを取得して更新します（1〜2分かかります）\n・「キャンセル」: 保存済みのローカルデータを再読み込みします"
        );
    }

    const refreshBtns = [
        document.getElementById("header-refresh-btn"),
        document.getElementById("refresh-cache-btn")
    ].filter(Boolean);

    // ボタンのアイコンを回転アニメーションさせ、連打を防止
    const originalIcons = [];
    refreshBtns.forEach(btn => {
        btn.disabled = true;
        const icon = btn.querySelector("i");
        if (icon) {
            originalIcons.push({ icon, className: icon.className });
            icon.className = "fa-solid fa-arrows-rotate fa-spin";
        }
    });

    try {
        if (shouldCrawl) {
            if (updateInfo) {
                updateInfo.innerHTML = `<i class="fa-solid fa-arrows-rotate fa-spin"></i> スケジュール取得中 (1〜2分)...`;
            }

            const response = await fetch("/api/crawl", {
                method: "POST",
                headers: { "Content-Type": "application/json" }
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || "サーバーでのクローラー実行に失敗しました (Status: " + response.status + ")");
            }

            const crawlResult = await response.json();
            if (crawlResult.status !== "success") {
                throw new Error(crawlResult.error || "クローラー処理に失敗しました");
            }
        }

        // キャッシュをバイパスして最新データを取得
        await fetchMovies(true);

        // 現在選択中の映画や日付があればスケジュール表示を再描画
        if (state.selectedMovie && state.selectedDate) {
            onSelectionChange();
        }

        const lastUpdated = state.moviesData?.last_updated || "不明";
        if (shouldCrawl) {
            alert(`最新の上映スケジュールを取得・反映しました！\n（データ更新日時: ${lastUpdated}）`);
        } else {
            alert(`上映データを再読み込みしました！\n（データ更新日時: ${lastUpdated}）`);
        }
    } catch (error) {
        console.error("Refresh data error:", error);
        if (updateInfo) {
            updateInfo.innerHTML = originalUpdateInfoText;
        }
        alert("データの更新に失敗しました。\n\n詳細: " + (error.message || error) + "\nサーバーの起動状態（run.bat）やログを確認してください。");
    } finally {
        // ボタン状態とアイコンを元に戻す
        refreshBtns.forEach(btn => {
            btn.disabled = false;
        });
        originalIcons.forEach(({ icon, className }) => {
            icon.className = className;
        });
    }
}

// 互換性のためのエイリアス
export const triggerManualCrawl = refreshData;

