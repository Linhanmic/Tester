import * as vscode from 'vscode';
import { SavedDeviceConfig } from '../deviceConfigManager';

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

export interface OpenFromConfigRequest {
  configId: string;
}

export interface SaveConfigRequest {
  name: string;
  deviceType: number;
  deviceIndex: number;
  channels: Array<{
    channelIndex: number;
    projectChannelIndex: number;
    arbitrationBaudrate: number;
    dataBaudrate?: number;
  }>;
  description?: string;
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

  private _onOpenFromConfig: vscode.EventEmitter<OpenFromConfigRequest> = new vscode.EventEmitter<OpenFromConfigRequest>();
  public readonly onOpenFromConfig: vscode.Event<OpenFromConfigRequest> = this._onOpenFromConfig.event;

  private _onSaveConfig: vscode.EventEmitter<SaveConfigRequest> = new vscode.EventEmitter<SaveConfigRequest>();
  public readonly onSaveConfig: vscode.Event<SaveConfigRequest> = this._onSaveConfig.event;

  private _onDeleteConfig: vscode.EventEmitter<string> = new vscode.EventEmitter<string>();
  public readonly onDeleteConfig: vscode.Event<string> = this._onDeleteConfig.event;

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
        case 'openFromConfig':
          this._onOpenFromConfig.fire(data.request);
          break;
        case 'saveConfig':
          this._onSaveConfig.fire(data.request);
          break;
        case 'deleteConfig':
          this._onDeleteConfig.fire(data.configId);
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

  public updateDeviceList(configs: SavedDeviceConfig[]) {
    if (this._view) {
      this._view.webview.postMessage({ type: 'updateDeviceList', configs });
    }
  }

  public showMessage(success: boolean, message: string) {
    if (this._view) {
      this._view.webview.postMessage({ type: 'showMessage', success, message });
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
    .section {
      margin-bottom: 16px;
      border-bottom: 1px solid var(--vscode-widget-border);
      padding-bottom: 16px;
    }
    .section-title {
      font-weight: bold;
      margin-bottom: 8px;
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }
    .status-item {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      border-bottom: 1px solid var(--vscode-widget-border);
    }
    .status-label {
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
    }
    .status-value {
      font-weight: bold;
      font-size: 11px;
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
      font-size: 11px;
    }
    button {
      width: 100%;
      padding: 8px;
      margin-top: 8px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
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
    button.small {
      padding: 4px 8px;
      font-size: 11px;
      width: auto;
      display: inline-block;
    }
    .device-list-item {
      background: var(--vscode-editor-inactiveSelectionBackground);
      padding: 8px;
      margin: 4px 0;
      border-radius: 4px;
      cursor: pointer;
    }
    .device-list-item:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .device-list-item-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
    }
    .device-list-item-name {
      font-weight: bold;
      font-size: 12px;
    }
    .device-list-item-info {
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
    }
    .device-list-item-actions {
      display: flex;
      gap: 4px;
    }
    .form-group {
      margin-bottom: 10px;
    }
    label {
      display: block;
      margin-bottom: 4px;
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
    }
    input, select, textarea {
      width: 100%;
      padding: 6px 8px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      box-sizing: border-box;
      font-family: var(--vscode-editor-font-family);
      font-size: 12px;
    }
    input:focus, select:focus, textarea:focus {
      outline: none;
      border-color: var(--vscode-focusBorder);
    }
    textarea {
      resize: vertical;
      min-height: 50px;
    }
    .row {
      display: flex;
      gap: 8px;
    }
    .row .form-group {
      flex: 1;
    }
    .message {
      padding: 8px;
      border-radius: 4px;
      margin-top: 8px;
      font-size: 11px;
      display: none;
    }
    .message.success {
      display: block;
      background: rgba(0, 128, 0, 0.1);
      color: var(--vscode-testing-iconPassed);
    }
    .message.error {
      display: block;
      background: rgba(255, 0, 0, 0.1);
      color: var(--vscode-testing-iconFailed);
    }
    .toggle-btn {
      background: transparent;
      border: 1px solid var(--vscode-button-border);
      color: var(--vscode-foreground);
      padding: 4px 8px;
      margin-top: 4px;
    }
    .toggle-btn:hover {
      background: var(--vscode-list-hoverBackground);
    }
    #configForm {
      display: none;
    }
    .channel-config-item {
      background: var(--vscode-editor-background);
      padding: 8px;
      margin: 4px 0;
      border-radius: 4px;
      border: 1px solid var(--vscode-input-border);
    }
  </style>
</head>
<body>
  <!-- 当前设备状态 -->
  <div class="section">
    <div class="section-title">当前设备</div>
    <div class="status-item">
      <span class="status-label">连接状态</span>
      <span id="connStatus" class="status-value disconnected">未连接</span>
    </div>
    <div class="status-item" id="deviceInfo" style="display: none;">
      <span class="status-label">设备</span>
      <span id="deviceType" class="status-value">-</span>
    </div>
    <div class="channel-list" id="channelList"></div>
    <button id="connectBtn" onclick="openDevice()">从文件打开设备</button>
    <button id="disconnectBtn" class="secondary" onclick="closeDevice()" style="display: none;">关闭设备</button>
  </div>

  <!-- 设备列表 -->
  <div class="section">
    <div class="section-title">已保存的设备</div>
    <div id="deviceListContainer"></div>
    <button class="toggle-btn" onclick="toggleConfigForm()">+ 添加新设备</button>
  </div>

  <!-- 设备配置表单 -->
  <div class="section" id="configForm">
    <div class="section-title">设备配置</div>
    <div class="form-group">
      <label>设备名称</label>
      <input type="text" id="configName" placeholder="例: 开发板CAN1" />
    </div>
    <div class="row">
      <div class="form-group">
        <label>设备类型</label>
        <select id="configDeviceType">
          <option value="4">USBCANFD-200U</option>
          <option value="21">USBCAN-II</option>
          <option value="3">USBCAN-I</option>
        </select>
      </div>
      <div class="form-group">
        <label>设备索引</label>
        <input type="number" id="configDeviceIndex" value="0" min="0" />
      </div>
    </div>
    <div class="form-group">
      <label>描述（可选）</label>
      <textarea id="configDescription" placeholder="设备用途说明..."></textarea>
    </div>
    <div class="form-group">
      <label>通道配置</label>
      <div id="channelConfigList">
        <div class="channel-config-item">
          <div class="row">
            <div class="form-group">
              <label>设备通道</label>
              <select class="channel-device-index">
                <option value="0">CH0</option>
                <option value="1">CH1</option>
              </select>
            </div>
            <div class="form-group">
              <label>项目通道</label>
              <input type="number" class="channel-project-index" value="0" min="0" />
            </div>
          </div>
          <div class="row">
            <div class="form-group">
              <label>仲裁域波特率 (kbps)</label>
              <input type="number" class="channel-arb-baud" value="500" />
            </div>
            <div class="form-group">
              <label>数据域波特率（可选）</label>
              <input type="number" class="channel-data-baud" placeholder="留空表示非FD" />
            </div>
          </div>
        </div>
      </div>
      <button class="toggle-btn" onclick="addChannelConfig()">+ 添加通道</button>
    </div>
    <button onclick="saveConfig()">保存设备配置</button>
    <button class="secondary" onclick="toggleConfigForm()">取消</button>
    <div class="message" id="configMessage"></div>
  </div>

  <div class="message" id="globalMessage"></div>

  <script>
    const vscode = acquireVsCodeApi();
    let deviceConfigs = [];

    function openDevice() {
      vscode.postMessage({ type: 'openDevice' });
    }

    function closeDevice() {
      vscode.postMessage({ type: 'closeDevice' });
    }

    function toggleConfigForm() {
      const form = document.getElementById('configForm');
      form.style.display = form.style.display === 'none' ? 'block' : 'none';
    }

    function addChannelConfig() {
      const list = document.getElementById('channelConfigList');
      const channelCount = list.children.length;
      const item = document.createElement('div');
      item.className = 'channel-config-item';
      item.innerHTML = \`
        <div class="row">
          <div class="form-group">
            <label>设备通道</label>
            <select class="channel-device-index">
              <option value="0">CH0</option>
              <option value="1">CH1</option>
            </select>
          </div>
          <div class="form-group">
            <label>项目通道</label>
            <input type="number" class="channel-project-index" value="\${channelCount}" min="0" />
          </div>
        </div>
        <div class="row">
          <div class="form-group">
            <label>仲裁域波特率 (kbps)</label>
            <input type="number" class="channel-arb-baud" value="500" />
          </div>
          <div class="form-group">
            <label>数据域波特率（可选）</label>
            <input type="number" class="channel-data-baud" placeholder="留空表示非FD" />
          </div>
        </div>
      \`;
      list.appendChild(item);
    }

    function saveConfig() {
      const name = document.getElementById('configName').value.trim();
      if (!name) {
        showConfigMessage(false, '请输入设备名称');
        return;
      }

      const deviceType = parseInt(document.getElementById('configDeviceType').value);
      const deviceIndex = parseInt(document.getElementById('configDeviceIndex').value);
      const description = document.getElementById('configDescription').value.trim();

      const channelItems = document.querySelectorAll('.channel-config-item');
      const channels = [];

      for (const item of channelItems) {
        const channelIndex = parseInt(item.querySelector('.channel-device-index').value);
        const projectChannelIndex = parseInt(item.querySelector('.channel-project-index').value);
        const arbitrationBaudrate = parseInt(item.querySelector('.channel-arb-baud').value);
        const dataBaudrateInput = item.querySelector('.channel-data-baud').value;
        const dataBaudrate = dataBaudrateInput ? parseInt(dataBaudrateInput) : undefined;

        channels.push({
          channelIndex,
          projectChannelIndex,
          arbitrationBaudrate,
          dataBaudrate
        });
      }

      if (channels.length === 0) {
        showConfigMessage(false, '请至少配置一个通道');
        return;
      }

      vscode.postMessage({
        type: 'saveConfig',
        request: {
          name,
          deviceType,
          deviceIndex,
          channels,
          description: description || undefined
        }
      });
    }

    function openFromConfig(configId) {
      vscode.postMessage({
        type: 'openFromConfig',
        request: { configId }
      });
    }

    function deleteConfig(configId) {
      if (confirm('确定要删除此设备配置吗？')) {
        vscode.postMessage({
          type: 'deleteConfig',
          configId
        });
      }
    }

    function showConfigMessage(success, message) {
      const msgEl = document.getElementById('configMessage');
      msgEl.textContent = message;
      msgEl.className = 'message ' + (success ? 'success' : 'error');
      setTimeout(() => {
        msgEl.className = 'message';
      }, 3000);
    }

    function showGlobalMessage(success, message) {
      const msgEl = document.getElementById('globalMessage');
      msgEl.textContent = message;
      msgEl.className = 'message ' + (success ? 'success' : 'error');
      setTimeout(() => {
        msgEl.className = 'message';
      }, 3000);
    }

    function updateDeviceList(configs) {
      deviceConfigs = configs;
      const container = document.getElementById('deviceListContainer');

      if (configs.length === 0) {
        container.innerHTML = '<div style="color: var(--vscode-descriptionForeground); font-size: 11px; padding: 8px;">暂无已保存的设备</div>';
        return;
      }

      let html = '';
      for (const config of configs) {
        const deviceTypeNames = { 3: 'USBCAN-I', 4: 'USBCANFD-200U', 21: 'USBCAN-II' };
        const deviceTypeName = deviceTypeNames[config.deviceType] || 'Unknown';

        html += '<div class="device-list-item">';
        html += '<div class="device-list-item-header">';
        html += '<div class="device-list-item-name">' + config.name + '</div>';
        html += '<div class="device-list-item-actions">';
        html += '<button class="small secondary" onclick="deleteConfig(\\'' + config.id + '\\')">删除</button>';
        html += '</div>';
        html += '</div>';
        html += '<div class="device-list-item-info">';
        html += deviceTypeName + ' #' + config.deviceIndex + ' | ' + config.channels.length + '通道';
        if (config.description) {
          html += '<br>' + config.description;
        }
        html += '</div>';
        html += '<button class="small" style="margin-top: 4px;" onclick="openFromConfig(\\'' + config.id + '\\')">打开此设备</button>';
        html += '</div>';
      }
      container.innerHTML = html;
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
      } else if (message.type === 'updateDeviceList') {
        updateDeviceList(message.configs);
      } else if (message.type === 'showMessage') {
        showGlobalMessage(message.success, message.message);
      }
    });
  </script>
</body>
</html>`;
  }
}
