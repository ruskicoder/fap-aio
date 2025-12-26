// UI Components for FPTU Scheduler

import { getSemesterOptions, getDefaultSemester } from './constants';

export function createPanelHTML(isExamActive: boolean, isWeeklyActive: boolean): string {
  return `
    <div class="fptu-panel-header">
      <h2>📅 FPTU Scheduler</h2>
      <div class="fptu-panel-controls">
        <button id="fptu-reset-btn" title="Xoá dữ liệu">🗑</button>
        <button id="fptu-minimize-btn" title="Thu nhỏ">−</button>
        <button id="fptu-close-btn" title="Đóng">×</button>
      </div>
    </div>
    <div class="fptu-panel-body">
      <div class="fptu-main-tabs">
        <button id="fptu-exam-tab" class="fptu-main-tab ${isExamActive ? 'active' : ''}">📝 Lịch thi</button>
        <button id="fptu-weekly-tab" class="fptu-main-tab ${isWeeklyActive ? 'active' : ''}">📚 Lịch học</button>
      </div>
      
      <!-- Exam Section -->
      <div id="fptu-exam-section" class="fptu-section ${isExamActive ? 'active' : ''}">
        <div class="fptu-section-header">
          <button id="fptu-sync-exam-btn" class="fptu-sync-btn">🔄 Đồng bộ lịch thi</button>
        </div>
        <div class="fptu-sub-tabs">
          <button id="fptu-upcoming-tab" class="fptu-sub-tab active">📅 Chưa thi <span class="fptu-tab-count" id="fptu-upcoming-count">0</span></button>
          <button id="fptu-completed-tab" class="fptu-sub-tab">✅ Đã thi <span class="fptu-tab-count" id="fptu-completed-count">0</span></button>
        </div>
        <div id="fptu-upcoming-exams" class="fptu-list active"></div>
        <div id="fptu-completed-exams" class="fptu-list"></div>
        <div class="fptu-actions">
          <button id="fptu-export-exam-btn" class="fptu-export-btn">📅 Tải xuống lịch thi (.ics)</button>
        </div>
      </div>
      
      <!-- Weekly Section -->
      <div id="fptu-weekly-section" class="fptu-section ${isWeeklyActive ? 'active' : ''}">
        <div class="fptu-semester-selector">
          <label for="fptu-semester-select">Học kỳ:</label>
          <select id="fptu-semester-select">
            ${getSemesterOptions().map(s => 
              `<option value="${s.label}" ${s.label === getDefaultSemester() ? 'selected' : ''}>${s.label}</option>`
            ).join('')}
          </select>
        </div>
        <div class="fptu-section-header fptu-weekly-header">
          <button id="fptu-sync-week-btn" class="fptu-sync-btn">🔄 Tuần này</button>
          <button id="fptu-sync-semester-btn" class="fptu-sync-btn fptu-semester-btn">📆 Cả học kỳ</button>
        </div>
        <div id="fptu-semester-progress" class="fptu-progress" style="display: none;">
          <div class="fptu-progress-info">
            <span id="fptu-semester-label">Spring25</span>
            <span id="fptu-progress-text">0/0 tuần</span>
          </div>
          <div class="fptu-progress-bar">
            <div id="fptu-progress-fill" class="fptu-progress-fill"></div>
          </div>
        </div>
        <div class="fptu-sub-tabs">
          <button id="fptu-offline-tab" class="fptu-sub-tab active">🏫 Offline <span class="fptu-tab-count" id="fptu-offline-count">0</span></button>
          <button id="fptu-online-tab" class="fptu-sub-tab">💻 Online <span class="fptu-tab-count" id="fptu-online-count">0</span></button>
        </div>
        <div id="fptu-offline-classes" class="fptu-list active"></div>
        <div id="fptu-online-classes" class="fptu-list"></div>
        <div class="fptu-actions fptu-export-actions">
          <button id="fptu-export-offline-btn" class="fptu-export-btn">🏫 Xuất Offline (.ics)</button>
          <button id="fptu-export-online-btn" class="fptu-export-btn fptu-export-online">💻 Xuất Online (.ics)</button>
        </div>
      </div>
    </div>
  `;
}

export function addPanelStyles(): void {
  if (document.getElementById("fptu-scheduler-styles")) return;
  
  const style = document.createElement("style");
  style.id = "fptu-scheduler-styles";
  style.textContent = `
    #fptu-scheduler-panel {
      position: fixed;
      top: 50%;
      right: 20px;
      transform: translateY(-50%);
      width: 380px;
      height: 580px;
      background: #000000;
      border-radius: 20px;
      box-shadow: 0 8px 32px rgba(243, 107, 22, 0.15), 0 0 0 1px #333333;
      z-index: 999999;
      font-family: 'Inter', 'Roboto', 'Segoe UI', sans-serif;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    #fptu-scheduler-panel.minimized {
      height: auto;
    }
    #fptu-scheduler-panel.minimized .fptu-panel-body {
      display: none;
    }
    .fptu-panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 16px;
      background: linear-gradient(135deg, #F36B16 0%, #ff8533 100%);
      color: #000000;
      cursor: move;
    }
    .fptu-panel-header h2 {
      margin: 0;
      font-size: 15px;
      font-weight: 600;
      color: #000000;
      text-shadow: none;
    }
    .fptu-panel-controls button {
      background: rgba(0,0,0,0.25);
      border: none;
      color: #000000;
      width: 26px;
      height: 26px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 13px;
      margin-left: 6px;
      transition: all 0.2s;
    }
    .fptu-panel-controls button:hover {
      background: rgba(0,0,0,0.4);
      transform: scale(1.05);
    }
    .fptu-panel-body {
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      background: #000000;
    }
    .fptu-main-tabs {
      display: flex;
      background: #0f0905;
      border-bottom: 1px solid #333333;
    }
    .fptu-main-tab {
      flex: 1;
      padding: 12px;
      border: none;
      background: none;
      font-size: 13px;
      font-weight: 500;
      color: #BDBDBD;
      cursor: pointer;
      transition: all 0.2s;
    }
    .fptu-main-tab.active {
      color: #F36B16;
      border-bottom: 2px solid #F36B16;
      background: rgba(243, 107, 22, 0.1);
    }
    .fptu-section {
      display: none;
      flex-direction: column;
      flex: 1;
      overflow: hidden;
    }
    .fptu-section.active {
      display: flex;
    }
    #fptu-semester-select {
      color: #E0E0E0;
    }
    .fptu-semester-selector {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      background: #0f0905;
      border-bottom: 1px solid #333333;
    }
    .fptu-semester-selector label {
      font-size: 12px;
      font-weight: 500;
      color: #E0E0E0;
    }
    .fptu-semester-selector select {
      flex: 1;
      padding: 8px 12px;
      border: 1px solid #333333;
      border-radius: 10px;
      font-size: 12px;
      background: #1A1A1A;
      color: #E0E0E0;
      cursor: pointer;
      transition: all 0.2s;
    }
    .fptu-semester-selector select:focus {
      outline: none;
      border-color: #F36B16;
      box-shadow: 0 0 0 3px rgba(243, 107, 22, 0.2);
    }
    .fptu-section-header {
      display: flex;
      gap: 8px;
      padding: 10px 12px;
      background: #0f0905;
      border-bottom: 1px solid #333333;
      justify-content: center;
    }
    .fptu-sync-btn {
      padding: 8px 16px;
      background: linear-gradient(135deg, #F36B16 0%, #e65a00 100%);
      color: #000000;
      border: none;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      box-shadow: 0 2px 8px rgba(243, 107, 22, 0.3);
    }
    .fptu-sync-btn:hover { background: linear-gradient(135deg, #ff7a1f 0%, #F36B16 100%); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(243, 107, 22, 0.4); }
    .fptu-sync-btn:disabled { background: #333333; cursor: not-allowed; box-shadow: none; transform: none; color: #666666; }
    .fptu-semester-btn { background: transparent; border: 2px solid #F36B16; color: #F36B16; box-shadow: none; }
    .fptu-semester-btn:hover { background: rgba(243, 107, 22, 0.1); border-color: #ff7a1f; color: #ff7a1f; box-shadow: 0 2px 8px rgba(243, 107, 22, 0.2); }
    .fptu-progress {
      padding: 10px 12px;
      background: #0f0905;
      border-bottom: 1px solid #333333;
    }
    .fptu-progress-info {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      margin-bottom: 6px;
    }
    #fptu-semester-label { font-weight: 600; color: #4CAF50; }
    #fptu-progress-text { color: #BDBDBD; }
    .fptu-progress-bar {
      height: 6px;
      background: #1A1A1A;
      border-radius: 3px;
      overflow: hidden;
    }
    .fptu-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #F36B16, #4CAF50);
      width: 0%;
      transition: width 0.3s;
      border-radius: 3px;
    }
    .fptu-sub-tabs {
      display: flex;
      background: #0f0905;
      border-bottom: 1px solid #333333;
    }
    .fptu-sub-tab {
      flex: 1;
      padding: 10px;
      border: none;
      background: none;
      font-size: 12px;
      color: #BDBDBD;
      cursor: pointer;
      transition: all 0.2s;
    }
    .fptu-sub-tab.active {
      color: #F36B16;
      font-weight: 600;
      background: rgba(243, 107, 22, 0.1);
    }
    .fptu-sub-tab:hover:not(.active) {
      background: rgba(243, 107, 22, 0.05);
    }
    .fptu-tab-count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      margin-left: 4px;
      background: rgba(243, 107, 22, 0.2);
      color: #F36B16;
      border-radius: 9px;
      font-size: 10px;
      font-weight: 600;
    }
    .fptu-sub-tab.active .fptu-tab-count {
      background: #F36B16;
      color: #000000;
    }
    .fptu-list {
      display: none;
      overflow-y: auto;
      padding: 10px;
      background: #000000;
      height: 240px;
      min-height: 240px;
      max-height: 240px;
    }
    .fptu-list.active { display: block; }
    .fptu-card {
      background: #1A1A1A;
      border-radius: 12px;
      padding: 12px;
      margin-bottom: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      border: 1px solid #333333;
      transition: all 0.2s;
    }
    .fptu-card:hover {
      box-shadow: 0 4px 16px rgba(243, 107, 22, 0.2);
      border-color: #F36B16;
      transform: translateY(-1px);
    }
    .fptu-card-title {
      font-weight: 600;
      font-size: 14px;
      color: #E0E0E0;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 4px;
    }
    .fptu-tag {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 10px;
      font-weight: 500;
    }
    .fptu-tag.fe { background: rgba(243, 107, 22, 0.2); color: #F36B16; }
    .fptu-tag.pe { background: rgba(76, 175, 80, 0.2); color: #4CAF50; }
    .fptu-tag.secondfe { background: #301403; color: #ff9f4a; }
    .fptu-tag.secondpe { background: rgba(244, 67, 54, 0.2); color: #F44336; }
    .fptu-tag.countdown { background: rgba(243, 107, 22, 0.2); color: #F36B16; }
    .fptu-tag.today { background: rgba(244, 67, 54, 0.2); color: #F44336; }
    .fptu-tag.tomorrow { background: #301403; color: #ff9f4a; }
    .fptu-tag.urgent { background: #301403; color: #ff9f4a; }
    .fptu-tag.attended { background: rgba(76, 175, 80, 0.2); color: #4CAF50; }
    .fptu-tag.absent { background: rgba(244, 67, 54, 0.2); color: #F44336; }
    .fptu-tag.not-yet { background: #1A1A1A; color: #BDBDBD; }
    .fptu-tag.online { background: rgba(243, 107, 22, 0.2); color: #F36B16; }
    .fptu-card-detail {
      font-size: 12px;
      color: #BDBDBD;
    }
    .fptu-card-detail .line {
      margin: 2px 0;
    }
    .fptu-card-detail .label {
      font-weight: 500;
      color: #E0E0E0;
    }
    .fptu-meet-btn {
      display: inline-block;
      margin-top: 6px;
      padding: 5px 10px;
      background: transparent;
      border: 2px solid #F36B16;
      color: #F36B16;
      text-decoration: none;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 600;
      transition: all 0.2s;
      box-shadow: none;
    }
    .fptu-meet-btn:hover {
      background: rgba(243, 107, 22, 0.1);
      border-color: #ff7a1f;
      color: #ff7a1f;
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(243, 107, 22, 0.2);
    }
    .fptu-actions {
      padding: 12px;
      background: #0f0905;
      border-top: 1px solid #333333;
    }
    .fptu-export-actions {
      display: flex;
      gap: 8px;
    }
    .fptu-export-btn {
      flex: 1;
      padding: 10px 8px;
      background: linear-gradient(135deg, #F36B16 0%, #e65a00 100%);
      color: #000000;
      border: none;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      box-shadow: 0 2px 8px rgba(243, 107, 22, 0.3);
    }
    .fptu-export-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(243, 107, 22, 0.4);
    }
    .fptu-export-online {
      background: transparent;
      border: 2px solid #F36B16;
      color: #F36B16;
      box-shadow: none;
    }
    .fptu-export-online:hover {
      background: rgba(243, 107, 22, 0.1);
      border-color: #ff7a1f;
      color: #ff7a1f;
      box-shadow: 0 2px 8px rgba(243, 107, 22, 0.2);
    }
    .fptu-empty {
      text-align: center;
      padding: 40px 20px;
      color: #666666;
      font-size: 13px;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    /* Toggle Button */
    #fptu-toggle-btn {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 54px;
      height: 54px;
      background: linear-gradient(135deg, #F36B16 0%, #ff8533 100%);
      border: none;
      border-radius: 50%;
      color: #000000;
      font-size: 24px;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(243, 107, 22, 0.4);
      z-index: 999998;
      display: none;
      transition: all 0.2s;
    }
    #fptu-toggle-btn:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 25px rgba(243, 107, 22, 0.5);
    }
  `;
  document.head.appendChild(style);
}

export function showToggleButton(): void {
  let btn = document.getElementById("fptu-toggle-btn");
  if (!btn) {
    btn = document.createElement("button");
    btn.id = "fptu-toggle-btn";
    btn.textContent = "📅";
    btn.addEventListener("click", () => {
      const panel = document.getElementById("fptu-scheduler-panel");
      if (panel) {
        panel.style.display = "flex";
        btn!.style.display = "none";
      }
    });
    document.body.appendChild(btn);
  }
  btn.style.display = "block";
}
