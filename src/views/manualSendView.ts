import * as vscode from 'vscode';

export interface SendRequest {
  channel: number;
  id: number;
  data: number[];
  isFD: boolean;
}

export class ManualSendViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'tester.manualSend';

  private _view?: vscode.WebviewView;
  private _onSendMessage: vscode.EventEmitter<SendRequest> = new vscode.EventEmitter<SendRequest>();
  public readonly onSendMessage: vscode.Event<SendRequest> = this._onSendMessage.event;

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
        case 'send':
          this._onSendMessage.fire(data.request);
          break;
      }
    });
  }

  public showSendResult(success: boolean, message: string) {
    if (this._view) {
      this._view.webview.postMessage({
        type: 'sendResult',
        success,
        message
      });
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>手动发送</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      padding: 10px;
      margin: 0;
    }
    .form-group {
      margin-bottom: 12px;
    }
    label {
      display: block;
      margin-bottom: 4px;
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
    }
    input, select {
      width: 100%;
      padding: 6px 8px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      box-sizing: border-box;
      font-family: var(--vscode-editor-font-family);
    }
    input:focus, select:focus {
      outline: none;
      border-color: var(--vscode-focusBorder);
    }
    .row {
      display: flex;
      gap: 8px;
    }
    .row .form-group {
      flex: 1;
    }
    button {
      width: 100%;
      padding: 8px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: bold;
    }
    button:hover {
      background: var(--vscode-button-hoverBackground);
    }
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .result {
      margin-top: 8px;
      padding: 8px;
      border-radius: 4px;
      font-size: 12px;
      display: none;
    }
    .result.success {
      display: block;
      background: rgba(0, 128, 0, 0.1);
      color: var(--vscode-testing-iconPassed);
    }
    .result.error {
      display: block;
      background: rgba(255, 0, 0, 0.1);
      color: var(--vscode-testing-iconFailed);
    }
    .history {
      margin-top: 16px;
      border-top: 1px solid var(--vscode-widget-border);
      padding-top: 8px;
    }
    .history-title {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
    }
    .history-item {
      padding: 4px 8px;
      margin: 2px 0;
      background: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: 2px;
      cursor: pointer;
      font-family: var(--vscode-editor-font-family);
      font-size: 11px;
    }
    .history-item:hover {
      background: var(--vscode-list-hoverBackground);
    }
  </style>
</head>
<body>
  <div class="row">
    <div class="form-group">
      <label>通道</label>
      <select id="channel">
        <option value="0">CH0</option>
        <option value="1">CH1</option>
        <option value="2">CH2</option>
        <option value="3">CH3</option>
      </select>
    </div>
    <div class="form-group">
      <label>类型</label>
      <select id="frameType">
        <option value="can">CAN</option>
        <option value="canfd">CANFD</option>
      </select>
    </div>
  </div>

  <div class="form-group">
    <label>报文ID (十六进制)</label>
    <input type="text" id="messageId" placeholder="例: 123 或 0x123" value="123">
  </div>

  <div class="form-group">
    <label>数据 (十六进制, 用空格或-分隔)</label>
    <input type="text" id="data" placeholder="例: 00 11 22 33 44 55 66 77" value="00 00 00 00 00 00 00 00">
  </div>

  <button onclick="sendMessage()">发送</button>

  <div class="result" id="result"></div>

  <div class="history">
    <div class="history-title">发送历史</div>
    <div id="historyList"></div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let history = [];

    function parseHex(str) {
      str = str.trim();
      if (str.toLowerCase().startsWith('0x')) {
        return parseInt(str, 16);
      }
      return parseInt(str, 16);
    }

    function parseData(str) {
      const parts = str.trim().split(/[\\s-]+/);
      return parts.map(p => parseHex(p)).filter(n => !isNaN(n));
    }

    function sendMessage() {
      const channel = parseInt(document.getElementById('channel').value);
      const frameType = document.getElementById('frameType').value;
      const messageId = parseHex(document.getElementById('messageId').value);
      const data = parseData(document.getElementById('data').value);

      if (isNaN(messageId)) {
        showResult(false, '无效的报文ID');
        return;
      }

      if (data.length === 0) {
        showResult(false, '数据不能为空');
        return;
      }

      const request = {
        channel,
        id: messageId,
        data,
        isFD: frameType === 'canfd'
      };

      vscode.postMessage({ type: 'send', request });
      addToHistory(request);
    }

    function showResult(success, message) {
      const resultEl = document.getElementById('result');
      resultEl.textContent = message;
      resultEl.className = 'result ' + (success ? 'success' : 'error');
    }

    function addToHistory(request) {
      const idStr = '0x' + request.id.toString(16).toUpperCase();
      const dataStr = request.data.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
      const entry = {
        channel: request.channel,
        id: request.id,
        data: request.data,
        isFD: request.isFD,
        display: 'CH' + request.channel + ' ' + idStr + ' [' + dataStr + ']'
      };

      history = history.filter(h => h.display !== entry.display);
      history.unshift(entry);
      if (history.length > 10) {
        history.pop();
      }
      updateHistoryList();
    }

    function updateHistoryList() {
      const historyList = document.getElementById('historyList');
      historyList.innerHTML = history.map((h, i) =>
        '<div class="history-item" onclick="loadHistory(' + i + ')">' + h.display + '</div>'
      ).join('');
    }

    function loadHistory(index) {
      const entry = history[index];
      document.getElementById('channel').value = entry.channel;
      document.getElementById('frameType').value = entry.isFD ? 'canfd' : 'can';
      document.getElementById('messageId').value = entry.id.toString(16).toUpperCase();
      document.getElementById('data').value = entry.data.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
    }

    window.addEventListener('message', event => {
      const message = event.data;
      if (message.type === 'sendResult') {
        showResult(message.success, message.message);
      }
    });
  </script>
</body>
</html>`;
  }
}
