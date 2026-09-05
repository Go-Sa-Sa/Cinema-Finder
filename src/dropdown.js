// ==========================================================================
// Movie Dropdown & Search Filter Component
// ==========================================================================
import { state } from './state.js';
import { onSelectionChange } from './schedule.js';

export function renderMovieOptions(movies) {
    const list = document.getElementById("movie-options-list");
    if (!list) return;
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

export function selectMovie(movie) {
    const input = document.getElementById("movie-select-input");
    if (input) input.value = movie;
    state.selectedMovie = movie;
    
    const clearBtn = document.getElementById("clear-movie-btn");
    if (clearBtn) clearBtn.style.display = "block";
    
    const list = document.getElementById("movie-options-list");
    if (list) list.style.display = "none";
    
    onSelectionChange();
}

export function clearMovieSelection() {
    const input = document.getElementById("movie-select-input");
    if (input) input.value = "";
    state.selectedMovie = "";
    
    const clearBtn = document.getElementById("clear-movie-btn");
    if (clearBtn) clearBtn.style.display = "none";
    
    const list = document.getElementById("movie-options-list");
    if (list) list.style.display = "none";
    
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

export function filterMovieOptions(keyword) {
    const cleanKeyword = keyword.trim().toLowerCase();
    if (!cleanKeyword) {
        renderMovieOptions(state.allMovies);
        return;
    }
    
    const filtered = state.allMovies.filter(movie => 
        movie.toLowerCase().includes(cleanKeyword)
    );
    
    renderMovieOptions(filtered);
}
