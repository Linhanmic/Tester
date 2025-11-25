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

  private _onRefreshDevice: vscode.EventEmitter<string> = new vscode.EventEmitter<string>();
  public readonly onRefreshDevice: vscode.Event<string> = this._onRefreshDevice.event;

  private _onBatchConnect: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  public readonly onBatchConnect: vscode.Event<void> = this._onBatchConnect.event;

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
        case 'refreshDevice':
          this._onRefreshDevice.fire(data.configId);
          break;
        case 'batchConnect':
          this._onBatchConnect.fire();
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
  <title>设备管理</title>
  <style>
    * {
      box-sizing: border-box;
    }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      padding: 16px;
      margin: 0;
      background: var(--vscode-editor-background);
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
    }

    .header-titles h1 {
      font-size: 18px;
      font-weight: 600;
      margin: 0 0 4px 0;
      color: var(--vscode-foreground);
    }

    .header-titles p {
      font-size: 12px;
      margin: 0;
      color: var(--vscode-descriptionForeground);
    }

    .add-device-btn {
      padding: 8px 16px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .add-device-btn:hover {
      background: var(--vscode-button-hoverBackground);
    }

    .device-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
    }

    .device-table thead {
      background: var(--vscode-editor-inactiveSelectionBackground);
    }

    .device-table th {
      padding: 10px 12px;
      text-align: left;
      font-size: 12px;
      font-weight: 600;
      color: var(--vscode-foreground);
      border-bottom: 1px solid var(--vscode-panel-border);
      white-space: nowrap;
    }

    .device-table td {
      padding: 10px 12px;
      font-size: 12px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }

    .device-table tbody tr:hover {
      background: var(--vscode-list-hoverBackground);
    }

    .protocol-badge {
      display: inline-block;
      padding: 4px 10px;
      background: rgba(33, 150, 243, 0.15);
      color: #2196F3;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
    }

    .status-connected {
      color: #4CAF50;
      font-weight: 500;
    }

    .status-disconnected {
      color: #F44336;
      font-weight: 500;
    }

    .status-pending {
      color: #FF9800;
      font-weight: 500;
    }

    .action-btns {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .icon-btn {
      padding: 4px 8px;
      background: transparent;
      border: none;
      cursor: pointer;
      color: var(--vscode-foreground);
      font-size: 16px;
      border-radius: 4px;
    }

    .icon-btn:hover {
      background: var(--vscode-toolbar-hoverBackground);
    }

    .footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
    }

    .stats {
      display: flex;
      gap: 24px;
      font-size: 13px;
    }

    .stat-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .stat-label {
      color: var(--vscode-descriptionForeground);
    }

    .stat-value {
      font-weight: 600;
      color: var(--vscode-foreground);
    }

    .batch-connect-btn {
      padding: 8px 16px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
    }

    .batch-connect-btn:hover {
      background: var(--vscode-button-hoverBackground);
    }

    .modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 1000;
      align-items: center;
      justify-content: center;
    }

    .modal.show {
      display: flex;
    }

    .modal-content {
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      padding: 20px;
      max-width: 600px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .modal-header h2 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
    }

    .close-btn {
      background: transparent;
      border: none;
      font-size: 20px;
      cursor: pointer;
      color: var(--vscode-foreground);
      padding: 0;
      width: 24px;
      height: 24px;
    }

    .form-group {
      margin-bottom: 16px;
    }

    .form-group label {
      display: block;
      margin-bottom: 6px;
      font-size: 12px;
      font-weight: 500;
      color: var(--vscode-foreground);
    }

    .form-group input,
    .form-group select {
      width: 100%;
      padding: 8px 10px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      font-size: 13px;
    }

    .form-group input:focus,
    .form-group select:focus {
      outline: none;
      border-color: var(--vscode-focusBorder);
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .form-row-4 {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
    }

    .channel-config-section {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid var(--vscode-panel-border);
    }

    .channel-config-item {
      background: var(--vscode-editor-inactiveSelectionBackground);
      padding: 12px;
      margin-bottom: 12px;
      border-radius: 4px;
      border: 1px solid var(--vscode-input-border);
    }

    .channel-config-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .channel-config-title {
      font-size: 13px;
      font-weight: 500;
    }

    .remove-channel-btn {
      background: transparent;
      border: none;
      color: var(--vscode-errorForeground);
      cursor: pointer;
      font-size: 18px;
      padding: 0;
      width: 24px;
      height: 24px;
    }

    .add-channel-btn {
      width: 100%;
      padding: 8px;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      margin-top: 8px;
    }

    .add-channel-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    .modal-footer {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid var(--vscode-panel-border);
    }

    .btn-primary {
      padding: 8px 16px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
    }

    .btn-primary:hover {
      background: var(--vscode-button-hoverBackground);
    }

    .btn-secondary {
      padding: 8px 16px;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
    }

    .btn-secondary:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    .empty-state {
      text-align: center;
      padding: 40px 20px;
      color: var(--vscode-descriptionForeground);
    }

    .empty-state p {
      margin: 8px 0;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-titles">
      <h1>设备管理</h1>
      <p>自动测试系统 - CAN总线设备配置</p>
    </div>
    <button class="add-device-btn" onclick="showAddDeviceModal()">
      <span>+</span>
      <span>添加设备</span>
    </button>
  </div>

  <table class="device-table" id="deviceTable">
    <thead>
      <tr>
        <th>项目通道</th>
        <th>设备名称</th>
        <th>设备索引</th>
        <th>通道索引</th>
        <th>协议类型</th>
        <th>仲裁域</th>
        <th>数据域</th>
        <th>状态</th>
        <th>操作</th>
      </tr>
    </thead>
    <tbody id="deviceTableBody">
      <tr>
        <td colspan="9">
          <div class="empty-state">
            <p>暂无设备</p>
            <p>点击右上角"+ 添加设备"按钮添加新设备</p>
          </div>
        </td>
      </tr>
    </tbody>
  </table>

  <div class="footer">
    <div class="stats">
      <div class="stat-item">
        <span class="stat-label">总设备:</span>
        <span class="stat-value" id="totalDevices">0</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">已连接:</span>
        <span class="stat-value" id="connectedDevices">0</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">未连接:</span>
        <span class="stat-value" id="disconnectedDevices">0</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">待连接:</span>
        <span class="stat-value" id="pendingDevices">0</span>
      </div>
    </div>
    <button class="batch-connect-btn" onclick="batchConnectDevices()">批量连接所有设备</button>
  </div>

  <!-- 添加/编辑设备模态框 -->
  <div class="modal" id="deviceModal">
    <div class="modal-content">
      <div class="modal-header">
        <h2 id="modalTitle">添加设备</h2>
        <button class="close-btn" onclick="closeDeviceModal()">&times;</button>
      </div>

      <div class="form-group">
        <label>设备名称</label>
        <input type="text" id="deviceName" placeholder="例: ZLGCAN-200U" />
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>设备类型</label>
          <select id="deviceType">
            <option value="41">USBCANFD-200U</option>
            <option value="21">USBCAN-2E-U</option>
            <option value="4">USBCAN-II</option>
            <option value="3">USBCAN-I</option>
            <option value="59">USBCANFD-800U</option>
            <option value="76">USBCANFD-400U</option>
            <option value="42">USBCANFD-100U</option>
          </select>
        </div>
        <div class="form-group">
          <label>设备索引</label>
          <input type="number" id="deviceIndex" value="0" min="0" />
        </div>
      </div>

      <div class="channel-config-section">
        <h3 style="font-size: 14px; margin: 0 0 12px 0;">通道配置</h3>
        <div id="channelConfigList">
          <!-- 通道配置项将动态添加 -->
        </div>
        <button class="add-channel-btn" onclick="addChannelConfig()">+ 添加通道</button>
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" onclick="closeDeviceModal()">取消</button>
        <button class="btn-primary" onclick="saveDevice()">保存</button>
      </div>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    let devices = [];
    let editingDeviceId = null;
    let channelIdCounter = 0;

    // 设备类型名称映射
    const deviceTypeNames = {
      1: 'PCI5121', 2: 'PCI9810', 3: 'USBCAN-I', 4: 'USBCAN-II', 5: 'PCI9820',
      6: 'CAN232', 7: 'PCI5110', 8: 'CANLITE', 9: 'ISA9620', 10: 'ISA5420',
      11: 'PC104CAN', 12: 'CANETE/UDP', 13: 'DNP9810', 14: 'PCI9840', 15: 'PC104CAN2',
      16: 'PCI9820I', 17: 'CANETTCP', 18: 'PCIE-9220', 19: 'PCI5010U', 20: 'USBCAN-E-U',
      21: 'USBCAN-2E-U', 22: 'PCI5020U', 23: 'EG20T-CAN', 24: 'PCIE9221', 25: 'WIFICAN-TCP',
      26: 'WIFICAN-UDP', 27: 'PCIe9120', 28: 'PCIe9110', 29: 'PCIe9140', 31: 'USBCAN-4E-U',
      32: 'CANDTU-200UR', 33: 'CANDTU-MINI', 34: 'USBCAN-8E-U', 35: 'CANREPLAY', 36: 'CANDTU-NET',
      37: 'CANDTU-100UR', 38: 'PCIE-CANFD-100U', 39: 'PCIE-CANFD-200U', 40: 'PCIE-CANFD-400U',
      41: 'USBCANFD-200U', 42: 'USBCANFD-100U', 43: 'USBCANFD-MINI', 44: 'CANFDCOM-100IE',
      45: 'CANSCOPE', 46: 'CLOUD', 47: 'CANDTU-NET-400', 48: 'CANFDNET-200U-TCP',
      49: 'CANFDNET-200U-UDP', 50: 'CANFDWIFI-100U-TCP', 51: 'CANFDWIFI-100U-UDP',
      52: 'CANFDNET-400U-TCP', 53: 'CANFDNET-400U-UDP', 54: 'CANFDBLUE-200U',
      55: 'CANFDNET-100U-TCP', 56: 'CANFDNET-100U-UDP', 57: 'CANFDNET-800U-TCP',
      58: 'CANFDNET-800U-UDP', 59: 'USBCANFD-800U', 60: 'PCIE-CANFD-100U-EX',
      61: 'PCIE-CANFD-400U-EX', 62: 'PCIE-CANFD-200U-MINI', 63: 'PCIE-CANFD-200U-EX/M2',
      64: 'CANFDDTU-400-TCP', 65: 'CANFDDTU-400-UDP', 66: 'CANFDWIFI-200U-TCP',
      67: 'CANFDWIFI-200U-UDP', 68: 'CANFDDTU-800ER-TCP', 69: 'CANFDDTU-800ER-UDP',
      70: 'CANFDDTU-800EWGR-TCP', 71: 'CANFDDTU-800EWGR-UDP', 72: 'CANFDDTU-600EWGR-TCP',
      73: 'CANFDDTU-600EWGR-UDP', 74: 'CANFDDTU-CASCADE-TCP', 75: 'CANFDDTU-CASCADE-UDP',
      76: 'USBCANFD-400U', 77: 'CANFDDTU-200U', 78: 'ZPSCANFD-TCP', 79: 'ZPSCANFD-USB',
      80: 'CANFDBRIDGE-PLUS', 81: 'CANFDDTU-300U', 82: 'PCIE-CANFD-800U',
      83: 'PCIE-CANFD-1200U', 84: 'MINI-PCIE-CANFD', 85: 'USBCANFD-800H',
      86: 'BG002', 87: 'BG004', 98: 'OFFLINE-DEVICE', 99: 'VIRTUAL-DEVICE'
    };

    function showAddDeviceModal() {
      editingDeviceId = null;
      document.getElementById('modalTitle').textContent = '添加设备';
      document.getElementById('deviceName').value = '';
      document.getElementById('deviceType').value = '41';
      document.getElementById('deviceIndex').value = '0';

      const channelList = document.getElementById('channelConfigList');
      channelList.innerHTML = '';
      addChannelConfig();

      document.getElementById('deviceModal').classList.add('show');
    }

    function closeDeviceModal() {
      document.getElementById('deviceModal').classList.remove('show');
    }

    function addChannelConfig() {
      const channelList = document.getElementById('channelConfigList');
      const channelNum = channelList.children.length;
      const channelId = channelIdCounter++;

      const channelDiv = document.createElement('div');
      channelDiv.className = 'channel-config-item';
      channelDiv.dataset.channelId = channelId;
      channelDiv.innerHTML = \`
        <div class="channel-config-header">
          <span class="channel-config-title">通道 \${channelNum + 1}</span>
          \${channelNum > 0 ? '<button class="remove-channel-btn" onclick="removeChannelConfig(' + channelId + ')">&times;</button>' : ''}
        </div>
        <div class="form-row-4">
          <div class="form-group">
            <label>项目通道</label>
            <input type="text" class="channel-project-name" value="CH\${channelNum + 1}" placeholder="CH1/主测试" />
          </div>
          <div class="form-group">
            <label>通道索引</label>
            <input type="number" class="channel-index" value="\${channelNum}" min="0" />
          </div>
          <div class="form-group">
            <label>仲裁域 (K)</label>
            <input type="text" class="channel-arb-baud" value="500K" placeholder="500K" />
          </div>
          <div class="form-group">
            <label>数据域</label>
            <input type="text" class="channel-data-baud" placeholder="-" />
          </div>
        </div>
      \`;

      channelList.appendChild(channelDiv);
    }

    function removeChannelConfig(channelId) {
      const channelDiv = document.querySelector(\`[data-channel-id="\${channelId}"]\`);
      if (channelDiv) {
        channelDiv.remove();
      }
    }

    function saveDevice() {
      const name = document.getElementById('deviceName').value.trim();
      const deviceType = parseInt(document.getElementById('deviceType').value);
      const deviceIndex = parseInt(document.getElementById('deviceIndex').value);

      if (!name) {
        alert('请输入设备名称');
        return;
      }

      const channelConfigs = [];
      const channelItems = document.querySelectorAll('.channel-config-item');

      for (const item of channelItems) {
        const projectName = item.querySelector('.channel-project-name').value.trim();
        const channelIndex = parseInt(item.querySelector('.channel-index').value);
        const arbBaud = item.querySelector('.channel-arb-baud').value.trim();
        const dataBaud = item.querySelector('.channel-data-baud').value.trim();

        channelConfigs.push({
          projectName,
          channelIndex,
          arbBaud,
          dataBaud: dataBaud || '-',
          projectChannelIndex: channelIndex
        });
      }

      if (channelConfigs.length === 0) {
        alert('请至少添加一个通道配置');
        return;
      }

      const deviceTypeName = deviceTypeNames[deviceType] || 'Unknown';

      // 判断协议类型
      let protocol = 'CAN 2.0B';
      if (channelConfigs.some(ch => ch.dataBaud && ch.dataBaud !== '-')) {
        protocol = 'CAN FD';
      }

      const deviceConfig = {
        name,
        deviceType,
        deviceTypeName,
        deviceIndex,
        channels: channelConfigs.map((ch, idx) => ({
          channelIndex: ch.channelIndex,
          projectChannelIndex: ch.projectChannelIndex,
          arbitrationBaudrate: parseInt(ch.arbBaud) || 500,
          dataBaudrate: ch.dataBaud !== '-' ? parseInt(ch.dataBaud) : undefined
        })),
        channelConfigs,
        protocol,
        status: 'disconnected'
      };

      vscode.postMessage({
        type: 'saveConfig',
        request: deviceConfig
      });

      closeDeviceModal();
    }

    function refreshDevice(configId) {
      vscode.postMessage({
        type: 'refreshDevice',
        configId
      });
    }

    function editDevice(configId) {
      const device = devices.find(d => d.id === configId);
      if (!device) return;

      editingDeviceId = configId;
      document.getElementById('modalTitle').textContent = '编辑设备';
      document.getElementById('deviceName').value = device.name;
      document.getElementById('deviceType').value = device.deviceType;
      document.getElementById('deviceIndex').value = device.deviceIndex;

      const channelList = document.getElementById('channelConfigList');
      channelList.innerHTML = '';

      if (device.channelConfigs && device.channelConfigs.length > 0) {
        device.channelConfigs.forEach(() => {
          addChannelConfig();
        });

        const channelItems = document.querySelectorAll('.channel-config-item');
        device.channelConfigs.forEach((ch, idx) => {
          if (channelItems[idx]) {
            channelItems[idx].querySelector('.channel-project-name').value = ch.projectName || '';
            channelItems[idx].querySelector('.channel-index').value = ch.channelIndex;
            channelItems[idx].querySelector('.channel-arb-baud').value = ch.arbBaud;
            channelItems[idx].querySelector('.channel-data-baud').value = ch.dataBaud === '-' ? '' : ch.dataBaud;
          }
        });
      } else {
        addChannelConfig();
      }

      document.getElementById('deviceModal').classList.add('show');
    }

    function deleteDevice(configId) {
      if (confirm('确定要删除此设备配置吗？')) {
        vscode.postMessage({
          type: 'deleteConfig',
          configId
        });
      }
    }

    function batchConnectDevices() {
      vscode.postMessage({
        type: 'batchConnect'
      });
    }

    function renderDeviceTable() {
      const tbody = document.getElementById('deviceTableBody');

      if (devices.length === 0) {
        tbody.innerHTML = \`
          <tr>
            <td colspan="9">
              <div class="empty-state">
                <p>暂无设备</p>
                <p>点击右上角"+ 添加设备"按钮添加新设备</p>
              </div>
            </td>
          </tr>
        \`;
        updateStats();
        return;
      }

      let html = '';

      for (const device of devices) {
        const deviceTypeName = device.deviceTypeName || deviceTypeNames[device.deviceType] || 'Unknown';

        if (device.channelConfigs && device.channelConfigs.length > 0) {
          device.channelConfigs.forEach((channel, idx) => {
            const isFirstRow = idx === 0;
            const rowspan = device.channelConfigs.length;

            html += '<tr>';
            html += \`<td>\${channel.projectName || 'CH' + (idx + 1)}</td>\`;

            if (isFirstRow) {
              html += \`<td rowspan="\${rowspan}">\${deviceTypeName}</td>\`;
              html += \`<td rowspan="\${rowspan}">\${device.deviceIndex}</td>\`;
            }

            html += \`<td>\${channel.channelIndex}</td>\`;

            if (isFirstRow) {
              html += \`<td rowspan="\${rowspan}"><span class="protocol-badge">\${device.protocol || 'CAN 2.0B'}</span></td>\`;
            }

            html += \`<td>\${channel.arbBaud}</td>\`;
            html += \`<td>\${channel.dataBaud || '-'}</td>\`;

            if (isFirstRow) {
              const statusClass = device.status === 'connected' ? 'status-connected' :
                                  device.status === 'pending' ? 'status-pending' : 'status-disconnected';
              const statusText = device.status === 'connected' ? '已连接' :
                                 device.status === 'pending' ? '待连接' : '未连接';

              html += \`<td rowspan="\${rowspan}"><span class="\${statusClass}">\${statusText}</span></td>\`;
              html += \`<td rowspan="\${rowspan}">
                <div class="action-btns">
                  <button class="icon-btn" onclick="refreshDevice('\${device.id}')" title="刷新">🔄</button>
                  <button class="icon-btn" onclick="editDevice('\${device.id}')" title="编辑">✏️</button>
                  <button class="icon-btn" onclick="deleteDevice('\${device.id}')" title="删除">🗑️</button>
                </div>
              </td>\`;
            }

            html += '</tr>';
          });
        } else {
          html += '<tr>';
          html += \`<td>-</td>\`;
          html += \`<td>\${deviceTypeName}</td>\`;
          html += \`<td>\${device.deviceIndex}</td>\`;
          html += \`<td>-</td>\`;
          html += \`<td><span class="protocol-badge">\${device.protocol || 'CAN 2.0B'}</span></td>\`;
          html += \`<td>-</td>\`;
          html += \`<td>-</td>\`;

          const statusClass = device.status === 'connected' ? 'status-connected' :
                              device.status === 'pending' ? 'status-pending' : 'status-disconnected';
          const statusText = device.status === 'connected' ? '已连接' :
                             device.status === 'pending' ? '待连接' : '未连接';

          html += \`<td><span class="\${statusClass}">\${statusText}</span></td>\`;
          html += \`<td>
            <div class="action-btns">
              <button class="icon-btn" onclick="refreshDevice('\${device.id}')" title="刷新">🔄</button>
              <button class="icon-btn" onclick="editDevice('\${device.id}')" title="编辑">✏️</button>
              <button class="icon-btn" onclick="deleteDevice('\${device.id}')" title="删除">🗑️</button>
            </div>
          </td>\`;
          html += '</tr>';
        }
      }

      tbody.innerHTML = html;
      updateStats();
    }

    function updateStats() {
      const total = devices.length;
      const connected = devices.filter(d => d.status === 'connected').length;
      const pending = devices.filter(d => d.status === 'pending').length;
      const disconnected = devices.filter(d => d.status === 'disconnected').length;

      document.getElementById('totalDevices').textContent = total;
      document.getElementById('connectedDevices').textContent = connected;
      document.getElementById('pendingDevices').textContent = pending;
      document.getElementById('disconnectedDevices').textContent = disconnected;
    }

    function updateDeviceList(configs) {
      devices = configs.map(config => {
        const deviceTypeName = deviceTypeNames[config.deviceType] || 'Unknown';

        // 从通道配置中提取信息
        const channelConfigs = config.channels ? config.channels.map((ch, idx) => {
          const arbBaud = ch.arbitrationBaudrate ? ch.arbitrationBaudrate + 'K' : '500K';
          const dataBaud = ch.dataBaudrate ? ch.dataBaudrate + 'M' : '-';

          return {
            projectName: \`CH\${ch.projectChannelIndex || idx}\`,
            channelIndex: ch.channelIndex || idx,
            arbBaud,
            dataBaud,
            projectChannelIndex: ch.projectChannelIndex || idx
          };
        }) : [];

        // 判断协议类型
        let protocol = 'CAN 2.0B';
        if (config.channels && config.channels.some(ch => ch.dataBaudrate)) {
          protocol = 'CAN FD';
        }

        return {
          id: config.id,
          name: config.name || deviceTypeName,
          deviceType: config.deviceType,
          deviceTypeName,
          deviceIndex: config.deviceIndex,
          channelConfigs,
          protocol,
          status: 'disconnected'
        };
      });

      renderDeviceTable();
    }

    window.addEventListener('message', event => {
      const message = event.data;

      if (message.type === 'updateDeviceList') {
        updateDeviceList(message.configs);
      } else if (message.type === 'updateStatus') {
        // 更新设备连接状态
        const status = message.status;
        if (status.connected) {
          // 找到对应的设备并更新状态
          devices.forEach(device => {
            if (device.deviceType === status.deviceType && device.deviceIndex === status.deviceIndex) {
              device.status = 'connected';
            }
          });
          renderDeviceTable();
        }
      } else if (message.type === 'showMessage') {
        if (!message.success) {
          alert(message.message);
        }
      }
    });

    // 初始化
    renderDeviceTable();
  </script>
</body>
</html>`;
  }
}
