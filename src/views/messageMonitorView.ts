import * as vscode from 'vscode';

export interface CanMessage {
  timestamp: number;
  channel: number;
  id: number;
  dlc: number;
  data: number[];
  direction: 'rx' | 'tx';
  isFD?: boolean;
}

export type MonitorMode = 'scroll' | 'collapse';

export class MessageMonitorViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'tester.messageMonitor';

  private _view?: vscode.WebviewView;
  private _messages: CanMessage[] = [];
  private _collapsedMessages: Map<string, CanMessage> = new Map();
  private _mode: MonitorMode = 'scroll';
  private _maxMessages = 1000;
  private _updateTimer: NodeJS.Timeout | null = null;
  private _pendingUpdate = false;

  // 统计信息
  private _totalCount = 0;
  private _txCount = 0;
  private _rxCount = 0;
  private _lastUpdateTime = Date.now();
  private _statsTimer: NodeJS.Timeout | null = null;

  constructor(private readonly _extensionUri: vscode.Uri) {
    // 启动统计更新定时器（每秒更新一次）
    this._statsTimer = setInterval(() => {
      this._updateStats();
    }, 1000);
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((data) => {
      switch (data.type) {
        case 'toggleMode':
          this.toggleMode();
          break;
        case 'clear':
          this.clearMessages();
          break;
      }
    });
  }

  public addMessage(message: CanMessage) {
    // 更新统计
    this._totalCount++;
    if (message.direction === 'tx') {
      this._txCount++;
    } else {
      this._rxCount++;
    }

    if (this._mode === 'scroll') {
      this._messages.push(message);
      if (this._messages.length > this._maxMessages) {
        this._messages.shift();
      }
    } else {
      const key = `${message.channel}-${message.id.toString(16)}`;
      this._collapsedMessages.set(key, message);
    }
    this._scheduleUpdate();
  }

  private _scheduleUpdate() {
    if (this._pendingUpdate) {
      return;
    }
    this._pendingUpdate = true;

    if (this._updateTimer) {
      clearTimeout(this._updateTimer);
    }

    // 批量更新，每20ms最多更新一次以提升实时性
    this._updateTimer = setTimeout(() => {
      this._pendingUpdate = false;
      this._updateView();
    }, 20);
  }

  public toggleMode() {
    this._mode = this._mode === 'scroll' ? 'collapse' : 'scroll';
    this._updateView();
  }

  public clearMessages() {
    this._messages = [];
    this._collapsedMessages.clear();
    // 重置统计
    this._totalCount = 0;
    this._txCount = 0;
    this._rxCount = 0;
    this._updateView();
    this._updateStats();
  }

  private _updateStats() {
    if (this._view) {
      this._view.webview.postMessage({
        type: 'updateStats',
        stats: {
          total: this._totalCount,
          tx: this._txCount,
          rx: this._rxCount
        }
      });
    }
  }

  public getMode(): MonitorMode {
    return this._mode;
  }

  private _updateView() {
    if (this._view) {
      const messages = this._mode === 'scroll'
        ? this._messages.slice(-100)
        : Array.from(this._collapsedMessages.values()).sort((a, b) => a.id - b.id);

      this._view.webview.postMessage({
        type: 'updateMessages',
        messages,
        mode: this._mode
      });
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>报文监视</title>
  <style>
    body {
      font-family: var(--vscode-editor-font-family);
      font-size: 12px;
      color: var(--vscode-foreground);
      padding: 0;
      margin: 0;
      overflow: hidden;
    }
    .toolbar {
      display: flex;
      gap: 4px;
      padding: 4px;
      background: var(--vscode-editor-background);
      border-bottom: 1px solid var(--vscode-widget-border);
      position: sticky;
      top: 0;
      flex-wrap: wrap;
    }
    .toolbar button {
      padding: 2px 8px;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      border-radius: 2px;
      cursor: pointer;
      font-size: 11px;
    }
    .toolbar button:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
    .toolbar button.active {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    .toolbar-right {
      margin-left: auto;
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .stats {
      color: var(--vscode-descriptionForeground);
      font-size: 10px;
      display: flex;
      gap: 8px;
    }
    .stat-item {
      display: flex;
      align-items: center;
      gap: 2px;
    }
    .stat-label {
      color: var(--vscode-descriptionForeground);
    }
    .stat-value {
      font-weight: bold;
      color: var(--vscode-foreground);
    }
    .stat-value.tx {
      color: var(--vscode-charts-blue);
    }
    .stat-value.rx {
      color: var(--vscode-testing-iconPassed);
    }
    .filter-input {
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 2px;
      padding: 2px 6px;
      font-size: 11px;
      width: 80px;
    }
    .message-list {
      height: calc(100vh - 40px);
      overflow-y: auto;
    }
    .message-item {
      display: grid;
      grid-template-columns: 20px 80px 30px 65px 25px 1fr;
      gap: 6px;
      padding: 2px 6px;
      border-bottom: 1px solid var(--vscode-widget-border);
      font-family: var(--vscode-editor-font-family);
      align-items: center;
    }
    .message-item:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .message-item.rx {
      border-left: 2px solid var(--vscode-testing-iconPassed);
    }
    .message-item.tx {
      border-left: 2px solid var(--vscode-charts-blue);
    }
    .msg-dir {
      font-weight: bold;
      font-size: 10px;
      text-align: center;
    }
    .msg-dir.rx {
      color: var(--vscode-testing-iconPassed);
    }
    .msg-dir.tx {
      color: var(--vscode-charts-blue);
    }
    .msg-time {
      color: var(--vscode-descriptionForeground);
      font-size: 10px;
    }
    .msg-channel {
      color: var(--vscode-symbolIcon-variableForeground);
      font-size: 10px;
      font-weight: 500;
    }
    .msg-id {
      color: var(--vscode-symbolIcon-functionForeground);
      font-weight: bold;
      font-size: 11px;
    }
    .msg-id .fd-badge {
      font-size: 8px;
      color: var(--vscode-charts-orange);
      margin-left: 2px;
    }
    .msg-dlc {
      color: var(--vscode-descriptionForeground);
      font-size: 10px;
    }
    .msg-data {
      color: var(--vscode-foreground);
      font-family: monospace;
      font-size: 10px;
    }
    .empty-state {
      text-align: center;
      padding: 40px;
      color: var(--vscode-descriptionForeground);
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button id="scrollBtn" class="active" onclick="setMode('scroll')">滚动</button>
    <button id="collapseBtn" onclick="setMode('collapse')">折叠</button>
    <button onclick="clearMessages()">清空</button>
    <input type="text" class="filter-input" id="filterInput" placeholder="筛选ID..." oninput="applyFilter()" />
    <div class="toolbar-right">
      <div class="stats">
        <div class="stat-item">
          <span class="stat-label">总:</span>
          <span class="stat-value" id="totalCount">0</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">↑:</span>
          <span class="stat-value tx" id="txCount">0</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">↓:</span>
          <span class="stat-value rx" id="rxCount">0</span>
        </div>
      </div>
    </div>
  </div>
  <div class="message-list" id="messageList">
    <div class="empty-state">等待报文...</div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let currentMode = 'scroll';
    let allMessages = [];
    let filterText = '';

    function setMode(mode) {
      vscode.postMessage({ type: 'toggleMode' });
    }

    function clearMessages() {
      vscode.postMessage({ type: 'clear' });
      allMessages = [];
      filterText = '';
      document.getElementById('filterInput').value = '';
    }

    function applyFilter() {
      filterText = document.getElementById('filterInput').value.trim().toLowerCase();
      renderMessages(allMessages);
    }

    function shouldShowMessage(msg) {
      if (!filterText) {
        return true;
      }
      const idStr = msg.id.toString(16).toLowerCase();
      return idStr.includes(filterText);
    }

    function formatTime(timestamp) {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('zh-CN', { hour12: false }) + '.' + String(date.getMilliseconds()).padStart(3, '0');
    }

    function formatId(id) {
      return '0x' + id.toString(16).toUpperCase().padStart(3, '0');
    }

    function formatData(data) {
      return data.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
    }

    function renderMessages(messages) {
      const messageList = document.getElementById('messageList');

      // 应用筛选
      const filteredMessages = messages.filter(msg => shouldShowMessage(msg));

      if (filteredMessages.length === 0) {
        messageList.innerHTML = '<div class="empty-state">' +
          (filterText ? '无匹配报文' : '等待报文...') + '</div>';
        return;
      }

      let html = '';
      for (const msg of filteredMessages) {
        html += '<div class="message-item ' + msg.direction + '">';
        html += '<span class="msg-dir ' + msg.direction + '">' + (msg.direction === 'rx' ? '↓' : '↑') + '</span>';
        html += '<span class="msg-time">' + formatTime(msg.timestamp) + '</span>';
        html += '<span class="msg-channel">CH' + msg.channel + '</span>';
        html += '<span class="msg-id">' + formatId(msg.id);
        if (msg.isFD) {
          html += '<span class="fd-badge">FD</span>';
        }
        html += '</span>';
        html += '<span class="msg-dlc">[' + msg.dlc + ']</span>';
        html += '<span class="msg-data">' + formatData(msg.data) + '</span>';
        html += '</div>';
      }
      messageList.innerHTML = html;

      if (currentMode === 'scroll') {
        messageList.scrollTop = messageList.scrollHeight;
      }
    }

    window.addEventListener('message', event => {
      const message = event.data;

      if (message.type === 'updateMessages') {
        currentMode = message.mode;
        allMessages = message.messages;

        const scrollBtn = document.getElementById('scrollBtn');
        const collapseBtn = document.getElementById('collapseBtn');

        if (message.mode === 'scroll') {
          scrollBtn.classList.add('active');
          collapseBtn.classList.remove('active');
        } else {
          scrollBtn.classList.remove('active');
          collapseBtn.classList.add('active');
        }

        renderMessages(allMessages);
      } else if (message.type === 'updateStats') {
        document.getElementById('totalCount').textContent = message.stats.total;
        document.getElementById('txCount').textContent = message.stats.tx;
        document.getElementById('rxCount').textContent = message.stats.rx;
      }
    });
  </script>
</body>
</html>`;
  }
}
