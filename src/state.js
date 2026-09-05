// ==========================================================================
// Application State Management
// ==========================================================================

export const state = {
    moviesData: null,       // movies_data.json の全データ
    movieDetails: {},       // movie_details.json の詳細データ
    allMovies: [],          // 上映中の全作品名リスト（ソート済）
    selectedMovie: "",      // 現在選択されている映画タイトル
    selectedDate: "",       // 現在選択されている日付 (YYYY-MM-DD)
    activeTab: "showing",   // "showing" (上映中) | "upcoming" (公開予定)
    upcomingMovies: []      // 公開予定作品リスト
};
