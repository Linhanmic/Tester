import * as vscode from 'vscode';

export interface CanMessage {
  timestamp: number;
  channel: number;
  id: number;
  dlc: number;
  data: number[];
  direction: 'rx' | 'tx';
}

export type MonitorMode = 'scroll' | 'collapse';

export class MessageMonitorViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'tester.messageMonitor';

  private _view?: vscode.WebviewView;
  private _messages: CanMessage[] = [];
  private _collapsedMessages: Map<string, CanMessage> = new Map();
  private _mode: MonitorMode = 'scroll';
  private _maxMessages = 1000;

  constructor(private readonly _extensionUri: vscode.Uri) {}

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
    if (this._mode === 'scroll') {
      this._messages.push(message);
      if (this._messages.length > this._maxMessages) {
        this._messages.shift();
      }
    } else {
      const key = `${message.channel}-${message.id.toString(16)}`;
      this._collapsedMessages.set(key, message);
    }
    this._updateView();
  }

  public toggleMode() {
    this._mode = this._mode === 'scroll' ? 'collapse' : 'scroll';
    this._updateView();
  }

  public clearMessages() {
    this._messages = [];
    this._collapsedMessages.clear();
    this._updateView();
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
    .mode-indicator {
      margin-left: auto;
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
      line-height: 22px;
    }
    .message-list {
      height: calc(100vh - 40px);
      overflow-y: auto;
    }
    .message-item {
      display: grid;
      grid-template-columns: 80px 30px 60px 25px 1fr;
      gap: 8px;
      padding: 2px 8px;
      border-bottom: 1px solid var(--vscode-widget-border);
      font-family: var(--vscode-editor-font-family);
    }
    .message-item:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .message-item.rx {
      background: rgba(0, 128, 0, 0.05);
    }
    .message-item.tx {
      background: rgba(0, 0, 255, 0.05);
    }
    .msg-time {
      color: var(--vscode-descriptionForeground);
    }
    .msg-channel {
      color: var(--vscode-symbolIcon-variableForeground);
    }
    .msg-id {
      color: var(--vscode-symbolIcon-functionForeground);
      font-weight: bold;
    }
    .msg-dlc {
      color: var(--vscode-descriptionForeground);
    }
    .msg-data {
      color: var(--vscode-foreground);
      font-family: monospace;
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
    <span class="mode-indicator" id="modeIndicator">滚动模式</span>
  </div>
  <div class="message-list" id="messageList">
    <div class="empty-state">等待报文...</div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let currentMode = 'scroll';

    function setMode(mode) {
      vscode.postMessage({ type: 'toggleMode' });
    }

    function clearMessages() {
      vscode.postMessage({ type: 'clear' });
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

    window.addEventListener('message', event => {
      const message = event.data;
      if (message.type === 'updateMessages') {
        currentMode = message.mode;
        const scrollBtn = document.getElementById('scrollBtn');
        const collapseBtn = document.getElementById('collapseBtn');
        const modeIndicator = document.getElementById('modeIndicator');
        const messageList = document.getElementById('messageList');

        if (message.mode === 'scroll') {
          scrollBtn.classList.add('active');
          collapseBtn.classList.remove('active');
          modeIndicator.textContent = '滚动模式';
        } else {
          scrollBtn.classList.remove('active');
          collapseBtn.classList.add('active');
          modeIndicator.textContent = '折叠模式 (' + message.messages.length + ')';
        }

        if (message.messages.length === 0) {
          messageList.innerHTML = '<div class="empty-state">等待报文...</div>';
          return;
        }

        let html = '';
        for (const msg of message.messages) {
          html += '<div class="message-item ' + msg.direction + '">';
          html += '<span class="msg-time">' + formatTime(msg.timestamp) + '</span>';
          html += '<span class="msg-channel">CH' + msg.channel + '</span>';
          html += '<span class="msg-id">' + formatId(msg.id) + '</span>';
          html += '<span class="msg-dlc">[' + msg.dlc + ']</span>';
          html += '<span class="msg-data">' + formatData(msg.data) + '</span>';
          html += '</div>';
        }
        messageList.innerHTML = html;

        if (message.mode === 'scroll') {
          messageList.scrollTop = messageList.scrollHeight;
        }
      }
    });
  </script>
</body>
</html>`;
  }
}
