import * as vscode from "vscode";
import { SavedDeviceConfig, DeviceChannelConfig } from "../deviceConfigManager";

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

/** 通道配置（带连接状态） */
export interface ChannelConfigWithStatus extends DeviceChannelConfig {
  configId: string;
  configName: string;
  deviceType: number;
  deviceIndex: number;
  channelAlias?: string;
  connected: boolean;
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
    channelAlias?: string;
  }>;
  description?: string;
}

export interface DisconnectChannelRequest {
  configId: string;
  channelIndex: number;
}

export interface DeleteChannelRequest {
  configId: string;
  channelIndex: number;
}

export class DeviceStatusViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "tester.deviceStatus";

  private _view?: vscode.WebviewView;
  private _status: DeviceStatus = {
    connected: false,
    deviceType: "",
    deviceIndex: 0,
    channels: [],
  };

  // 存储各通道的连接状态 key: configId-channelIndex
  private _channelConnectionStatus: Map<string, boolean> = new Map();

  private _onOpenFromConfig: vscode.EventEmitter<OpenFromConfigRequest> =
    new vscode.EventEmitter<OpenFromConfigRequest>();
  public readonly onOpenFromConfig: vscode.Event<OpenFromConfigRequest> =
    this._onOpenFromConfig.event;

  private _onSaveConfig: vscode.EventEmitter<SaveConfigRequest> =
    new vscode.EventEmitter<SaveConfigRequest>();
  public readonly onSaveConfig: vscode.Event<SaveConfigRequest> =
    this._onSaveConfig.event;

  private _onDeleteConfig: vscode.EventEmitter<string> =
    new vscode.EventEmitter<string>();
  public readonly onDeleteConfig: vscode.Event<string> =
    this._onDeleteConfig.event;

  private _onConnectAll: vscode.EventEmitter<void> =
    new vscode.EventEmitter<void>();
  public readonly onConnectAll: vscode.Event<void> = this._onConnectAll.event;

  private _onDisconnectChannel: vscode.EventEmitter<DisconnectChannelRequest> =
    new vscode.EventEmitter<DisconnectChannelRequest>();
  public readonly onDisconnectChannel: vscode.Event<DisconnectChannelRequest> =
    this._onDisconnectChannel.event;

  private _onDeleteChannel: vscode.EventEmitter<DeleteChannelRequest> =
    new vscode.EventEmitter<DeleteChannelRequest>();
  public readonly onDeleteChannel: vscode.Event<DeleteChannelRequest> =
    this._onDeleteChannel.event;

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
        case "openDevice":
          vscode.commands.executeCommand("tester.openDevice");
          break;
        case "closeDevice":
          vscode.commands.executeCommand("tester.closeDevice");
          break;
        case "openFromConfig":
          this._onOpenFromConfig.fire(data.request);
          break;
        case "saveConfig":
          this._onSaveConfig.fire(data.request);
          break;
        case "deleteConfig":
          this._onDeleteConfig.fire(data.configId);
          break;
        case "connectAll":
          this._onConnectAll.fire();
          break;
        case "disconnectChannel":
          this._onDisconnectChannel.fire({
            configId: data.configId,
            channelIndex: data.channelIndex,
          });
          break;
        case "connectChannel":
          // 连接特定通道
          vscode.commands.executeCommand(
            "tester.connectChannel",
            data.configId,
            data.channelIndex
          );
          break;
        case "deleteChannel":
          this._onDeleteChannel.fire({
            configId: data.configId,
            channelIndex: data.channelIndex,
          });
          break;
      }
    });
  }

  public updateStatus(status: DeviceStatus) {
    this._status = status;
    if (this._view) {
      this._view.webview.postMessage({ type: "updateStatus", status });
    }
  }

  public updateDeviceList(configs: SavedDeviceConfig[]) {
    if (this._view) {
      this._view.webview.postMessage({
        type: "updateDeviceList",
        configs,
        channelConnectionStatus: Object.fromEntries(
          this._channelConnectionStatus
        ),
      });
    }
  }

  public updateChannelConnectionStatus(
    configId: string,
    channelIndex: number,
    connected: boolean
  ) {
    const key = `${configId}-${channelIndex}`;
    this._channelConnectionStatus.set(key, connected);
    if (this._view) {
      this._view.webview.postMessage({
        type: "updateChannelConnectionStatus",
        configId,
        channelIndex,
        connected,
      });
    }
  }

  public showMessage(success: boolean, message: string) {
    if (this._view) {
      this._view.webview.postMessage({ type: "showMessage", success, message });
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
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 12px;
      overflow-x: auto;
    }

    /* 头部区域 */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--vscode-widget-border);
    }

    .header-left h1 {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .header-left .subtitle {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }

    .btn-add {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 6px 12px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      white-space: nowrap;
    }

    .btn-add:hover {
      background: var(--vscode-button-hoverBackground);
    }

    /* 表格容器 */
    .table-container {
      overflow-x: auto;
      margin-bottom: 12px;
      border: 1px solid var(--vscode-widget-border);
      border-radius: 6px;
    }

    /* 表格样式 */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
      min-width: 600px;
    }

    thead {
      background: var(--vscode-editor-inactiveSelectionBackground);
    }

    th {
      padding: 10px 8px;
      text-align: left;
      font-weight: 600;
      color: var(--vscode-foreground);
      white-space: nowrap;
      border-bottom: 1px solid var(--vscode-widget-border);
    }

    td {
      padding: 10px 8px;
      border-bottom: 1px solid var(--vscode-widget-border);
      vertical-align: middle;
    }

    tbody tr:hover {
      background: var(--vscode-list-hoverBackground);
    }

    tbody tr:last-child td {
      border-bottom: none;
    }

    /* 项目通道列 */
    .channel-cell {
      font-weight: 500;
    }

    /* 协议类型标签 */
    .protocol-badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 10px;
      font-weight: 500;
    }

    .protocol-badge.canfd {
      background: rgba(59, 130, 246, 0.15);
      color: #3b82f6;
      border: 1px solid rgba(59, 130, 246, 0.3);
    }

    .protocol-badge.can {
      background: rgba(107, 114, 128, 0.15);
      color: var(--vscode-descriptionForeground);
      border: 1px solid var(--vscode-widget-border);
    }

    /* 状态标签 */
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 10px;
      font-weight: 500;
    }

    .status-badge.connected {
      background: rgba(34, 197, 94, 0.15);
      color: #22c55e;
    }

    .status-badge.disconnected {
      background: rgba(239, 68, 68, 0.15);
      color: #ef4444;
    }

    .status-badge.pending {
      background: rgba(234, 179, 8, 0.15);
      color: #eab308;
    }

    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
    }

    /* 操作按钮 */
    .action-btn {
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      color: var(--vscode-foreground);
      opacity: 0.7;
    }

    .action-btn:hover {
      opacity: 1;
      background: var(--vscode-toolbar-hoverBackground);
    }

    .action-btn.connect {
      color: var(--vscode-testing-iconPassed);
    }

    .action-btn.disconnect {
      color: #eab308;
    }

    .action-btn.delete {
      color: var(--vscode-testing-iconFailed);
    }

    .actions-cell {
      display: flex;
      gap: 4px;
    }

    /* 底部统计栏 */
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 0;
      border-top: 1px solid var(--vscode-widget-border);
      font-size: 11px;
    }

    .stats {
      display: flex;
      gap: 16px;
    }

    .stat-item {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .stat-label {
      color: var(--vscode-descriptionForeground);
    }

    .stat-value {
      font-weight: 600;
    }

    .stat-value.connected {
      color: #22c55e;
    }

    .stat-value.disconnected {
      color: #ef4444;
    }

    .stat-value.pending {
      color: #eab308;
    }

    .btn-connect-all {
      padding: 6px 16px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 11px;
    }

    .btn-connect-all:hover {
      background: var(--vscode-button-hoverBackground);
    }

    .btn-connect-all:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* 空状态 */
    .empty-state {
      text-align: center;
      padding: 40px 20px;
      color: var(--vscode-descriptionForeground);
    }

    .empty-state-icon {
      font-size: 32px;
      margin-bottom: 12px;
      opacity: 0.5;
    }

    .empty-state-text {
      font-size: 12px;
      margin-bottom: 16px;
    }

    /* 添加设备表单弹窗 */
    .modal-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 100;
      justify-content: center;
      align-items: center;
    }

    .modal-overlay.show {
      display: flex;
    }

    .modal {
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-widget-border);
      border-radius: 8px;
      padding: 20px;
      width: 90%;
      max-width: 450px;
      max-height: 80vh;
      overflow-y: auto;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--vscode-widget-border);
    }

    .modal-title {
      font-size: 14px;
      font-weight: 600;
    }

    .modal-close {
      background: transparent;
      border: none;
      color: var(--vscode-foreground);
      cursor: pointer;
      font-size: 18px;
      padding: 4px;
    }

    .form-group {
      margin-bottom: 12px;
    }

    .form-label {
      display: block;
      margin-bottom: 4px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }

    .form-input, .form-select {
      width: 100%;
      padding: 6px 8px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      font-size: 12px;
    }

    .form-input:focus, .form-select:focus {
      outline: none;
      border-color: var(--vscode-focusBorder);
    }

    .form-row {
      display: flex;
      gap: 8px;
    }

    .form-row .form-group {
      flex: 1;
    }

    /* 可搜索下拉框 */
    .searchable-select {
      position: relative;
    }

    .searchable-select-input {
      width: 100%;
      padding: 6px 8px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      font-size: 12px;
      cursor: text;
    }

    .searchable-select-input:focus {
      outline: none;
      border-color: var(--vscode-focusBorder);
    }

    .searchable-select-dropdown {
      display: none;
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      max-height: 200px;
      overflow-y: auto;
      background: var(--vscode-dropdown-background);
      border: 1px solid var(--vscode-dropdown-border);
      border-radius: 4px;
      z-index: 10;
      margin-top: 2px;
    }

    .searchable-select-dropdown.show {
      display: block;
    }

    .searchable-select-option {
      padding: 6px 8px;
      cursor: pointer;
      font-size: 11px;
    }

    .searchable-select-option:hover {
      background: var(--vscode-list-hoverBackground);
    }

    .searchable-select-option.selected {
      background: var(--vscode-list-activeSelectionBackground);
      color: var(--vscode-list-activeSelectionForeground);
    }

    .searchable-select-empty {
      padding: 8px;
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
      text-align: center;
    }

    /* 通道配置列表 */
    .channel-config-section {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid var(--vscode-widget-border);
    }

    .channel-config-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .channel-config-title {
      font-size: 12px;
      font-weight: 500;
    }

    .btn-add-channel {
      font-size: 10px;
      padding: 2px 8px;
      background: transparent;
      border: 1px dashed var(--vscode-input-border);
      color: var(--vscode-foreground);
      border-radius: 4px;
      cursor: pointer;
    }

    .btn-add-channel:hover {
      border-color: var(--vscode-focusBorder);
      background: var(--vscode-list-hoverBackground);
    }

    .channel-config-item {
      background: var(--vscode-editor-inactiveSelectionBackground);
      padding: 10px;
      margin-bottom: 8px;
      border-radius: 4px;
      position: relative;
    }

    .channel-config-remove {
      position: absolute;
      top: 4px;
      right: 4px;
      background: transparent;
      border: none;
      color: var(--vscode-testing-iconFailed);
      cursor: pointer;
      font-size: 14px;
      padding: 2px;
      opacity: 0.6;
    }

    .channel-config-remove:hover {
      opacity: 1;
    }

    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid var(--vscode-widget-border);
    }

    .btn-cancel {
      padding: 6px 16px;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 11px;
    }

    .btn-cancel:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    .btn-save {
      padding: 6px 16px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 11px;
    }

    .btn-save:hover {
      background: var(--vscode-button-hoverBackground);
    }

    /* 消息提示 */
    .toast {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 11px;
      z-index: 200;
      display: none;
    }

    .toast.show {
      display: block;
    }

    .toast.success {
      background: rgba(34, 197, 94, 0.9);
      color: white;
    }

    .toast.error {
      background: rgba(239, 68, 68, 0.9);
      color: white;
    }

    /* 波特率显示 */
    .baudrate {
      font-family: var(--vscode-editor-font-family);
      font-size: 11px;
    }

    /* SVG 图标 */
    .icon {
      width: 14px;
      height: 14px;
      fill: currentColor;
    }
  </style>
</head>
<body>
  <!-- 头部 -->
  <div class="header">
    <div class="header-left">
      <h1>设备管理</h1>
      <div class="subtitle">自动测试系统 - CAN总线设备配置</div>
    </div>
    <button class="btn-add" onclick="showAddModal()">
      <span>+</span> 添加项目通道
    </button>
  </div>

  <!-- 设备表格 -->
  <div class="table-container">
    <table id="deviceTable">
      <thead>
        <tr>
          <th>项目通道索引</th>
          <th>通道名称</th>
          <th>设备索引</th>
          <th>设备通道索引</th>
          <th>协议类型</th>
          <th>仲裁域</th>
          <th>数据域</th>
          <th>状态</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody id="deviceTableBody">
        <!-- 动态生成 -->
      </tbody>
    </table>
    <div class="empty-state" id="emptyState" style="display: none;">
      <div class="empty-state-icon">📡</div>
      <div class="empty-state-text">暂无已配置的项目通道</div>
      <button class="btn-add" onclick="showAddModal()">
        <span>+</span> 添加项目通道
      </button>
    </div>
  </div>

  <!-- 底部统计 -->
  <div class="footer">
    <div class="stats">
      <div class="stat-item">
        <span class="stat-label">总通道:</span>
        <span class="stat-value" id="statTotal">0</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">已连接:</span>
        <span class="stat-value connected" id="statConnected">0</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">未连接:</span>
        <span class="stat-value disconnected" id="statDisconnected">0</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">待连接:</span>
        <span class="stat-value pending" id="statPending">0</span>
      </div>
    </div>
    <button class="btn-connect-all" id="btnConnectAll" onclick="connectAll()">
      批量连接所有设备
    </button>
  </div>

  <!-- 添加项目通道弹窗 -->
  <div class="modal-overlay" id="addModal">
    <div class="modal">
      <div class="modal-header">
        <span class="modal-title">添加项目通道</span>
        <button class="modal-close" onclick="hideAddModal()">×</button>
      </div>
      
      <div class="form-group">
        <label class="form-label">设备类型</label>
        <div class="searchable-select" id="deviceTypeSelect">
          <input type="text" class="searchable-select-input" id="deviceTypeInput" 
                 placeholder="输入搜索设备类型..." 
                 onclick="toggleDeviceTypeDropdown(true)"
                 oninput="filterDeviceTypes(this.value)">
          <input type="hidden" id="configDeviceType" value="">
          <div class="searchable-select-dropdown" id="deviceTypeDropdown">
            <!-- 动态生成选项 -->
          </div>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">设备索引</label>
          <input type="number" class="form-input" id="configDeviceIndex" value="0" min="0">
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">描述（可选）</label>
        <input type="text" class="form-input" id="configDescription" placeholder="设备用途说明...">
      </div>

      <div class="channel-config-section">
        <div class="channel-config-header">
          <span class="channel-config-title">通道配置</span>
          <button class="btn-add-channel" onclick="addChannelConfig()">+ 添加通道</button>
        </div>
        <div id="channelConfigList">
          <!-- 默认一个通道配置 -->
        </div>
      </div>

      <div class="modal-actions">
        <button class="btn-cancel" onclick="hideAddModal()">取消</button>
        <button class="btn-save" onclick="saveConfig()">保存配置</button>
      </div>
    </div>
  </div>

  <!-- Toast 消息 -->
  <div class="toast" id="toast"></div>

  <script>
    const vscode = acquireVsCodeApi();
    let deviceConfigs = [];
    let channelConnectionStatus = {};

    // 设备类型列表
    const deviceTypes = [
      { value: 1, name: 'PCI5121' },
      { value: 2, name: 'PCI9810' },
      { value: 3, name: 'USBCAN-I' },
      { value: 4, name: 'USBCAN-II' },
      { value: 5, name: 'PCI9820' },
      { value: 6, name: 'CAN232' },
      { value: 7, name: 'PCI5110' },
      { value: 8, name: 'CANLITE' },
      { value: 9, name: 'ISA9620' },
      { value: 10, name: 'ISA5420' },
      { value: 11, name: 'PC104CAN' },
      { value: 12, name: 'CANETE/UDP' },
      { value: 13, name: 'DNP9810' },
      { value: 14, name: 'PCI9840' },
      { value: 15, name: 'PC104CAN2' },
      { value: 16, name: 'PCI9820I' },
      { value: 17, name: 'CANETTCP' },
      { value: 18, name: 'PCIE-9220' },
      { value: 19, name: 'PCI5010U' },
      { value: 20, name: 'USBCAN-E-U' },
      { value: 21, name: 'USBCAN-2E-U' },
      { value: 22, name: 'PCI5020U' },
      { value: 23, name: 'EG20T-CAN' },
      { value: 24, name: 'PCIE9221' },
      { value: 25, name: 'WIFICAN-TCP' },
      { value: 26, name: 'WIFICAN-UDP' },
      { value: 27, name: 'PCIe9120' },
      { value: 28, name: 'PCIe9110' },
      { value: 29, name: 'PCIe9140' },
      { value: 31, name: 'USBCAN-4E-U' },
      { value: 32, name: 'CANDTU-200UR' },
      { value: 33, name: 'CANDTU-MINI' },
      { value: 34, name: 'USBCAN-8E-U' },
      { value: 35, name: 'CANREPLAY' },
      { value: 36, name: 'CANDTU-NET' },
      { value: 37, name: 'CANDTU-100UR' },
      { value: 38, name: 'PCIE-CANFD-100U' },
      { value: 39, name: 'PCIE-CANFD-200U' },
      { value: 40, name: 'PCIE-CANFD-400U' },
      { value: 41, name: 'USBCANFD-200U' },
      { value: 42, name: 'USBCANFD-100U' },
      { value: 43, name: 'USBCANFD-MINI' },
      { value: 44, name: 'CANFDCOM-100IE' },
      { value: 45, name: 'CANSCOPE' },
      { value: 46, name: 'CLOUD' },
      { value: 47, name: 'CANDTU-NET-400' },
      { value: 48, name: 'CANFDNET-200U-TCP' },
      { value: 49, name: 'CANFDNET-200U-UDP' },
      { value: 50, name: 'CANFDWIFI-100U-TCP' },
      { value: 51, name: 'CANFDWIFI-100U-UDP' },
      { value: 52, name: 'CANFDNET-400U-TCP' },
      { value: 53, name: 'CANFDNET-400U-UDP' },
      { value: 54, name: 'CANFDBLUE-200U' },
      { value: 55, name: 'CANFDNET-100U-TCP' },
      { value: 56, name: 'CANFDNET-100U-UDP' },
      { value: 57, name: 'CANFDNET-800U-TCP' },
      { value: 58, name: 'CANFDNET-800U-UDP' },
      { value: 59, name: 'USBCANFD-800U' },
      { value: 60, name: 'PCIE-CANFD-100U-EX' },
      { value: 61, name: 'PCIE-CANFD-400U-EX' },
      { value: 62, name: 'PCIE-CANFD-200U-MINI' },
      { value: 63, name: 'PCIE-CANFD-200U-EX/M2' },
      { value: 64, name: 'CANFDDTU-400-TCP' },
      { value: 65, name: 'CANFDDTU-400-UDP' },
      { value: 66, name: 'CANFDWIFI-200U-TCP' },
      { value: 67, name: 'CANFDWIFI-200U-UDP' },
      { value: 68, name: 'CANFDDTU-800ER-TCP' },
      { value: 69, name: 'CANFDDTU-800ER-UDP' },
      { value: 70, name: 'CANFDDTU-800EWGR-TCP' },
      { value: 71, name: 'CANFDDTU-800EWGR-UDP' },
      { value: 72, name: 'CANFDDTU-600EWGR-TCP' },
      { value: 73, name: 'CANFDDTU-600EWGR-UDP' },
      { value: 74, name: 'CANFDDTU-CASCADE-TCP' },
      { value: 75, name: 'CANFDDTU-CASCADE-UDP' },
      { value: 76, name: 'USBCANFD-400U' },
      { value: 77, name: 'CANFDDTU-200U' },
      { value: 78, name: 'ZPSCANFD-TCP' },
      { value: 79, name: 'ZPSCANFD-USB' },
      { value: 80, name: 'CANFDBRIDGE-PLUS' },
      { value: 81, name: 'CANFDDTU-300U' },
      { value: 82, name: 'PCIE-CANFD-800U' },
      { value: 83, name: 'PCIE-CANFD-1200U' },
      { value: 84, name: 'MINI-PCIE-CANFD' },
      { value: 85, name: 'USBCANFD-800H' },
      { value: 86, name: 'BG002' },
      { value: 87, name: 'BG004' },
      { value: 98, name: 'OFFLINE-DEVICE' },
      { value: 99, name: 'VIRTUAL-DEVICE' }
    ];

    // 设备类型名称映射
    const deviceTypeNames = {};
    deviceTypes.forEach(dt => {
      deviceTypeNames[dt.value] = dt.name;
    });

    // 格式化波特率
    function formatBaudrate(kbps) {
      if (!kbps) return '-';
      if (kbps >= 1000) {
        return (kbps / 1000) + 'M';
      }
      return kbps + 'K';
    }

    // 初始化设备类型下拉框
    function initDeviceTypeDropdown() {
      renderDeviceTypeOptions(deviceTypes);
    }

    // 渲染设备类型选项
    function renderDeviceTypeOptions(options) {
      const dropdown = document.getElementById('deviceTypeDropdown');
      if (options.length === 0) {
        dropdown.innerHTML = '<div class="searchable-select-empty">无匹配结果</div>';
        return;
      }
      
      let html = '';
      for (const opt of options) {
        html += '<div class="searchable-select-option" data-value="' + opt.value + '" onclick="selectDeviceType(' + opt.value + ', \\'' + opt.name + '\\')">' + opt.name + '</div>';
      }
      dropdown.innerHTML = html;
    }

    // 切换设备类型下拉框
    function toggleDeviceTypeDropdown(show) {
      const dropdown = document.getElementById('deviceTypeDropdown');
      if (show) {
        dropdown.classList.add('show');
        filterDeviceTypes(document.getElementById('deviceTypeInput').value);
      } else {
        setTimeout(() => dropdown.classList.remove('show'), 150);
      }
    }

    // 过滤设备类型
    function filterDeviceTypes(query) {
      const q = query.toLowerCase().trim();
      if (!q) {
        renderDeviceTypeOptions(deviceTypes);
        return;
      }
      const filtered = deviceTypes.filter(dt => dt.name.toLowerCase().includes(q));
      renderDeviceTypeOptions(filtered);
    }

    // 选择设备类型
    function selectDeviceType(value, name) {
      document.getElementById('deviceTypeInput').value = name;
      document.getElementById('configDeviceType').value = value;
      document.getElementById('deviceTypeDropdown').classList.remove('show');
    }

    // 点击外部关闭下拉框
    document.addEventListener('click', function(e) {
      const select = document.getElementById('deviceTypeSelect');
      if (select && !select.contains(e.target)) {
        document.getElementById('deviceTypeDropdown').classList.remove('show');
      }
    });

    // 显示添加弹窗
    function showAddModal() {
      document.getElementById('addModal').classList.add('show');
      // 重置表单
      document.getElementById('deviceTypeInput').value = '';
      document.getElementById('configDeviceType').value = '';
      document.getElementById('configDeviceIndex').value = '0';
      document.getElementById('configDescription').value = '';
      // 添加默认通道
      const channelList = document.getElementById('channelConfigList');
      channelList.innerHTML = '';
      addChannelConfig();
      // 初始化设备类型下拉框
      initDeviceTypeDropdown();
    }

    // 隐藏添加弹窗
    function hideAddModal() {
      document.getElementById('addModal').classList.remove('show');
    }

    // 添加通道配置项
    function addChannelConfig() {
      const list = document.getElementById('channelConfigList');
      const channelCount = list.children.length;
      const item = document.createElement('div');
      item.className = 'channel-config-item';
      item.innerHTML = \`
        <button class="channel-config-remove" onclick="removeChannelConfig(this)" \${channelCount === 0 ? 'style="display:none"' : ''}>×</button>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">设备通道索引</label>
            <input type="number" class="form-input channel-device-index" value="0" min="0">
          </div>
          <div class="form-group">
            <label class="form-label">通道名称（可选）</label>
            <input type="text" class="form-input channel-alias" placeholder="如: 主测试">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">协议类型</label>
            <select class="form-select channel-protocol" onchange="toggleDataBaudrate(this)">
              <option value="canfd">CANFD</option>
              <option value="can">CAN</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">仲裁域 (kbps)</label>
            <input type="number" class="form-input channel-arb-baud" value="500">
          </div>
          <div class="form-group channel-data-group">
            <label class="form-label">数据域 (kbps)</label>
            <input type="number" class="form-input channel-data-baud" value="2000">
          </div>
        </div>
      \`;
      list.appendChild(item);
    }

    // 移除通道配置
    function removeChannelConfig(btn) {
      btn.parentElement.remove();
    }

    // 切换数据域波特率显示
    function toggleDataBaudrate(select) {
      const dataGroup = select.closest('.channel-config-item').querySelector('.channel-data-group');
      if (select.value === 'can') {
        dataGroup.style.opacity = '0.5';
        dataGroup.querySelector('input').disabled = true;
      } else {
        dataGroup.style.opacity = '1';
        dataGroup.querySelector('input').disabled = false;
      }
    }

    // 保存配置
    function saveConfig() {
      const deviceType = parseInt(document.getElementById('configDeviceType').value);
      if (!deviceType) {
        showToast('请选择设备类型', false);
        return;
      }

      const deviceIndex = parseInt(document.getElementById('configDeviceIndex').value);
      const description = document.getElementById('configDescription').value.trim();

      const channelItems = document.querySelectorAll('.channel-config-item');
      const channels = [];

      // 获取当前最大项目通道索引
      let maxProjectIndex = -1;
      for (const config of deviceConfigs) {
        for (const ch of config.channels) {
          if (ch.projectChannelIndex > maxProjectIndex) {
            maxProjectIndex = ch.projectChannelIndex;
          }
        }
      }

      for (const item of channelItems) {
        const channelAlias = item.querySelector('.channel-alias').value.trim();
        const channelIndex = parseInt(item.querySelector('.channel-device-index').value);
        const protocol = item.querySelector('.channel-protocol').value;
        const arbitrationBaudrate = parseInt(item.querySelector('.channel-arb-baud').value);
        const dataBaudrateInput = item.querySelector('.channel-data-baud');
        const dataBaudrate = protocol === 'canfd' ? parseInt(dataBaudrateInput.value) : undefined;

        // 自动分配项目通道索引
        maxProjectIndex++;

        channels.push({
          channelIndex,
          projectChannelIndex: maxProjectIndex,
          arbitrationBaudrate,
          dataBaudrate,
          channelAlias: channelAlias || undefined
        });
      }

      if (channels.length === 0) {
        showToast('请至少配置一个通道', false);
        return;
      }

      // 生成默认配置名称
      const deviceTypeName = deviceTypeNames[deviceType] || 'Unknown';
      const configName = deviceTypeName + '-' + deviceIndex;

      vscode.postMessage({
        type: 'saveConfig',
        request: {
          name: configName,
          deviceType,
          deviceIndex,
          channels,
          description: description || undefined
        }
      });

      hideAddModal();
    }

    // 连接通道
    function connectChannel(configId, channelIndex) {
      vscode.postMessage({
        type: 'openFromConfig',
        request: { configId }
      });
    }

    // 断开通道
    function disconnectChannel(configId, channelIndex) {
      vscode.postMessage({
        type: 'disconnectChannel',
        configId,
        channelIndex
      });
    }

    // 删除设备配置（整个配置）
    function deleteDevice(configId) {
      if (confirm('确定要删除此设备配置吗？')) {
        vscode.postMessage({
          type: 'deleteConfig',
          configId
        });
      }
    }

    // 删除单个通道
    function deleteChannel(configId, channelIndex) {
      if (confirm('确定要删除此通道吗？')) {
        vscode.postMessage({
          type: 'deleteChannel',
          configId,
          channelIndex
        });
      }
    }

    // 批量连接
    function connectAll() {
      vscode.postMessage({ type: 'connectAll' });
    }

    // 获取通道连接状态
    function getChannelConnected(configId, channelIndex) {
      const key = configId + '-' + channelIndex;
      return channelConnectionStatus[key] || false;
    }

    // 更新设备表格
    function updateDeviceTable() {
      const tbody = document.getElementById('deviceTableBody');
      const emptyState = document.getElementById('emptyState');
      const tableContainer = document.querySelector('.table-container table');

      // 展平所有通道配置，按项目通道索引排序
      const allChannels = [];
      for (const config of deviceConfigs) {
        const deviceTypeName = deviceTypeNames[config.deviceType] || 'Unknown-' + config.deviceType;
        for (const ch of config.channels) {
          allChannels.push({
            configId: config.id,
            configName: config.name,
            deviceType: config.deviceType,
            deviceTypeName: deviceTypeName,
            deviceIndex: config.deviceIndex,
            ...ch,
            connected: getChannelConnected(config.id, ch.channelIndex)
          });
        }
      }

      // 按项目通道索引排序
      allChannels.sort((a, b) => a.projectChannelIndex - b.projectChannelIndex);

      if (allChannels.length === 0) {
        tableContainer.style.display = 'none';
        emptyState.style.display = 'block';
        updateStats(0, 0, 0, 0);
        return;
      }

      tableContainer.style.display = 'table';
      emptyState.style.display = 'none';

      let html = '';
      let connectedCount = 0;
      let disconnectedCount = 0;

      for (const ch of allChannels) {
        const isFD = ch.dataBaudrate && ch.dataBaudrate > 0;
        const statusClass = ch.connected ? 'connected' : 'disconnected';
        const statusText = ch.connected ? '已连接' : '未连接';

        if (ch.connected) connectedCount++;
        else disconnectedCount++;

        html += \`
          <tr>
            <td class="channel-cell">\${ch.projectChannelIndex}</td>
            <td>\${ch.channelAlias || '-'}</td>
            <td>\${ch.deviceIndex}</td>
            <td>\${ch.channelIndex}</td>
            <td>
              <span class="protocol-badge \${isFD ? 'canfd' : 'can'}">
                \${isFD ? 'CANFD' : 'CAN'}
              </span>
            </td>
            <td class="baudrate">\${formatBaudrate(ch.arbitrationBaudrate)}</td>
            <td class="baudrate">\${formatBaudrate(ch.dataBaudrate)}</td>
            <td>
              <span class="status-badge \${statusClass}">
                <span class="status-dot"></span>
                \${statusText}
              </span>
            </td>
            <td>
              <div class="actions-cell">
                \${ch.connected ?
                  '<button class="action-btn disconnect" onclick="disconnectChannel(\\'' + ch.configId + '\\', ' + ch.channelIndex + ')" title="断开连接"><svg class="icon" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>' :
                  '<button class="action-btn connect" onclick="connectChannel(\\'' + ch.configId + '\\', ' + ch.channelIndex + ')" title="连接"><svg class="icon" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></button>'
                }
                <button class="action-btn delete" onclick="deleteChannel(\\'' + ch.configId + '\\', ' + ch.channelIndex + ')" title="删除">
                  <svg class="icon" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                </button>
              </div>
            </td>
          </tr>
        \`;
      }

      tbody.innerHTML = html;
      updateStats(allChannels.length, connectedCount, disconnectedCount, 0);
    }

    // 更新统计信息
    function updateStats(total, connected, disconnected, pending) {
      document.getElementById('statTotal').textContent = total;
      document.getElementById('statConnected').textContent = connected;
      document.getElementById('statDisconnected').textContent = disconnected;
      document.getElementById('statPending').textContent = pending;

      // 如果没有未连接设备，禁用批量连接按钮
      const btnConnectAll = document.getElementById('btnConnectAll');
      btnConnectAll.disabled = disconnected === 0;
    }

    // 显示Toast消息
    function showToast(message, success = true) {
      const toast = document.getElementById('toast');
      toast.textContent = message;
      toast.className = 'toast show ' + (success ? 'success' : 'error');
      setTimeout(() => {
        toast.classList.remove('show');
      }, 3000);
    }

    // 接收消息
    window.addEventListener('message', event => {
      const message = event.data;

      switch (message.type) {
        case 'updateDeviceList':
          deviceConfigs = message.configs || [];
          channelConnectionStatus = message.channelConnectionStatus || {};
          updateDeviceTable();
          break;

        case 'updateChannelConnectionStatus':
          const key = message.configId + '-' + message.channelIndex;
          channelConnectionStatus[key] = message.connected;
          updateDeviceTable();
          break;

        case 'updateStatus':
          // 旧的状态更新，可用于更新连接状态
          break;

        case 'showMessage':
          showToast(message.message, message.success);
          break;
      }
    });

    // 初始化
    updateDeviceTable();
  </script>
</body>
</html>`;
  }
}
