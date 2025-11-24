import * as vscode from 'vscode';

export interface DeviceStatus {
  connected: boolean;
  deviceType: string;
  deviceIndex: number;
  channels: ChannelStatus[];
}

export interface ChannelStatus {
  index: number;
  projectIndex: number;
  baudrate: number;
  dataBaudrate?: number;
  isFD: boolean;
  running: boolean;
}

export class DeviceStatusViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'tester.deviceStatus';

  private _view?: vscode.WebviewView;
  private _status: DeviceStatus = {
    connected: false,
    deviceType: '',
    deviceIndex: 0,
    channels: [],
  };

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
        case 'openDevice':
          vscode.commands.executeCommand('tester.openDevice');
          break;
        case 'closeDevice':
          vscode.commands.executeCommand('tester.closeDevice');
          break;
      }
    });
  }

  public updateStatus(status: DeviceStatus) {
    this._status = status;
    if (this._view) {
      this._view.webview.postMessage({ type: 'updateStatus', status });
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>设备状态</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      padding: 10px;
      margin: 0;
    }
    .status-item {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      border-bottom: 1px solid var(--vscode-widget-border);
    }
    .status-label {
      color: var(--vscode-descriptionForeground);
    }
    .status-value {
      font-weight: bold;
    }
    .connected {
      color: var(--vscode-testing-iconPassed);
    }
    .disconnected {
      color: var(--vscode-testing-iconFailed);
    }
    .channel-list {
      margin-top: 10px;
    }
    .channel-item {
      background: var(--vscode-editor-inactiveSelectionBackground);
      padding: 8px;
      margin: 4px 0;
      border-radius: 4px;
    }
    .channel-header {
      font-weight: bold;
      margin-bottom: 4px;
    }
    button {
      width: 100%;
      padding: 8px;
      margin-top: 10px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    button:hover {
      background: var(--vscode-button-hoverBackground);
    }
    button.secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    button.secondary:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
  </style>
</head>
<body>
  <div id="content">
    <div class="status-item">
      <span class="status-label">连接状态</span>
      <span id="connStatus" class="status-value disconnected">未连接</span>
    </div>
    <div class="status-item" id="deviceInfo" style="display: none;">
      <span class="status-label">设备</span>
      <span id="deviceType" class="status-value">-</span>
    </div>
    <div class="channel-list" id="channelList"></div>
    <button id="connectBtn" onclick="openDevice()">打开设备</button>
    <button id="disconnectBtn" class="secondary" onclick="closeDevice()" style="display: none;">关闭设备</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    function openDevice() {
      vscode.postMessage({ type: 'openDevice' });
    }

    function closeDevice() {
      vscode.postMessage({ type: 'closeDevice' });
    }

    window.addEventListener('message', event => {
      const message = event.data;
      if (message.type === 'updateStatus') {
        const status = message.status;
        const connStatus = document.getElementById('connStatus');
        const deviceInfo = document.getElementById('deviceInfo');
        const deviceType = document.getElementById('deviceType');
        const channelList = document.getElementById('channelList');
        const connectBtn = document.getElementById('connectBtn');
        const disconnectBtn = document.getElementById('disconnectBtn');

        if (status.connected) {
          connStatus.textContent = '已连接';
          connStatus.className = 'status-value connected';
          deviceInfo.style.display = 'flex';
          deviceType.textContent = status.deviceType + ' #' + status.deviceIndex;
          connectBtn.style.display = 'none';
          disconnectBtn.style.display = 'block';

          let channelsHtml = '';
          for (const ch of status.channels) {
            channelsHtml += '<div class="channel-item">';
            channelsHtml += '<div class="channel-header">通道 ' + ch.projectIndex + '</div>';
            channelsHtml += '<div class="status-item"><span class="status-label">波特率</span><span>' + ch.baudrate + ' kbps</span></div>';
            if (ch.isFD && ch.dataBaudrate) {
              channelsHtml += '<div class="status-item"><span class="status-label">数据域</span><span>' + ch.dataBaudrate + ' kbps</span></div>';
            }
            channelsHtml += '<div class="status-item"><span class="status-label">状态</span><span class="' + (ch.running ? 'connected' : 'disconnected') + '">' + (ch.running ? '运行中' : '已停止') + '</span></div>';
            channelsHtml += '</div>';
          }
          channelList.innerHTML = channelsHtml;
        } else {
          connStatus.textContent = '未连接';
          connStatus.className = 'status-value disconnected';
          deviceInfo.style.display = 'none';
          channelList.innerHTML = '';
          connectBtn.style.display = 'block';
          disconnectBtn.style.display = 'none';
        }
      }
    });
  </script>
</body>
</html>`;
  }
}
