// ==========================================================================
// Date Generation & Selection (Today to 14 Days Later)
// ==========================================================================
import { state } from './state.js';
import { onSelectionChange } from './schedule.js';

export function generateDateChips() {
    const container = document.getElementById("date-scroll-container");
    if (!container) return;
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
            
            state.selectedDate = dateStr;
            onSelectionChange();
        });
        
        container.appendChild(chip);
    }
}
