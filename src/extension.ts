/**
 * VS Code扩展入口
 * 负责注册所有Provider和命令
 */

import * as vscode from "vscode";
import { TesterValidator } from "./validator";
import { TesterFoldingRangeProvider } from "./foldingProvider";
import { TesterDocumentSymbolProvider } from "./symbolProvider";
import { TesterHoverProvider } from "./hoverProvider";
import { TesterCodeLensProvider } from "./codeLensProvider";
import { TesterFormattingProvider } from "./formatting";
import { TesterExecutor } from "./executor";
import { DeviceStatusViewProvider, MessageMonitorViewProvider, ManualSendViewProvider } from "./views";
import { StatusBarManager } from "./statusBar";
import { DeviceConfigManager } from "./deviceConfigManager";
import { showError, showInfo, showWarning } from "./utils/notification";
import { TIMEOUTS } from "./utils/constants";

export function activate(context: vscode.ExtensionContext) {
  console.log("Tester 已激活!");

  // ========== 核心组件初始化 ==========

  // 创建诊断集合
  const diagnosticCollection = vscode.languages.createDiagnosticCollection("tester");
  context.subscriptions.push(diagnosticCollection);

  // 创建验证器
  const validator = new TesterValidator(diagnosticCollection);

  // 创建执行器 (提前创建,避免变量提升问题)
  const executor = new TesterExecutor();

  // 创建代码透视提供程序
  const codeLensProvider = new TesterCodeLensProvider();

  // 创建设备配置管理器
  const deviceConfigManager = new DeviceConfigManager(context);

  // 创建状态栏管理器
  const statusBar = new StatusBarManager();
  context.subscriptions.push({ dispose: () => statusBar.dispose() });

  // ========== 语言功能Provider注册 ==========

  // 注册折叠范围提供程序
  context.subscriptions.push(
    vscode.languages.registerFoldingRangeProvider(
      "tester",
      new TesterFoldingRangeProvider()
    )
  );

  // 注册文档符号提供程序（大纲视图）
  context.subscriptions.push(
    vscode.languages.registerDocumentSymbolProvider(
      "tester",
      new TesterDocumentSymbolProvider()
    )
  );

  // 注册悬停提示提供程序
  context.subscriptions.push(
    vscode.languages.registerHoverProvider("tester", new TesterHoverProvider())
  );

  // 注册代码透视提供程序
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      "tester",
      codeLensProvider
    )
  );

  // 注册格式化提供程序
  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider(
      "tester",
      new TesterFormattingProvider()
    )
  );

  // ========== 视图Provider注册 ==========

  // 创建视图提供程序
  const deviceStatusProvider = new DeviceStatusViewProvider(context.extensionUri);
  const messageMonitorProvider = new MessageMonitorViewProvider(context.extensionUri);
  const manualSendProvider = new ManualSendViewProvider(context.extensionUri);

  // 注册设备状态视图
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      DeviceStatusViewProvider.viewType,
      deviceStatusProvider,
      {
        webviewOptions: {
          retainContextWhenHidden: true
        }
      }
    )
  );

  // 注册报文监视视图
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      MessageMonitorViewProvider.viewType,
      messageMonitorProvider
    )
  );

  // 注册手动发送视图
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ManualSendViewProvider.viewType,
      manualSendProvider
    )
  );

  // ========== 辅助函数 ==========

  /**
   * 更新设备配置列表
   */
  const updateDeviceList = () => {
    const configs = deviceConfigManager.getAll();
    deviceStatusProvider.updateDeviceList(configs);
  };

  /**
   * 更新设备状态视图
   */
  const updateDeviceStatus = () => {
    const deviceInfo = executor.getDeviceInfo();
    deviceStatusProvider.updateStatus({
      connected: deviceInfo.connected,
      deviceType: deviceInfo.deviceType,
      deviceIndex: deviceInfo.deviceIndex,
      channels: deviceInfo.channels.map(ch => ({
        index: ch.deviceIndex,
        projectIndex: ch.projectIndex,
        baudrate: ch.baudrate,
        dataBaudrate: ch.dataBaudrate,
        isFD: ch.isFD,
        running: ch.running,
      })),
    });
  };

  // ========== 事件监听 ==========

  // 监听执行状态变更，更新CodeLens和状态栏
  executor.onStateChange((state) => {
    codeLensProvider.updateExecutionState(state);
    statusBar.setRunning(state === 'running');
  });

  // 监听设备状态视图的事件
  deviceStatusProvider.onOpenFromConfig(async (request) => {
    const config = deviceConfigManager.get(request.configId);
    if (!config) {
      showError('设备配置不存在');
      return;
    }

    const result = await executor.openDeviceFromConfig(
      config.deviceType,
      config.deviceIndex,
      config.channels
    );

    if (result.success) {
      await deviceConfigManager.updateLastUsed(config.id);
      showInfo(result.message);
      updateDeviceStatus();
      updateDeviceList();
    } else {
      showError(result.message);
    }
  });

  deviceStatusProvider.onSaveConfig(async (request) => {
    const config = {
      id: deviceConfigManager.generateId(),
      name: request.name,
      deviceType: request.deviceType,
      deviceIndex: request.deviceIndex,
      channels: request.channels,
      description: request.description,
      createdAt: Date.now()
    };

    await deviceConfigManager.save(config);
    deviceStatusProvider.showMessage(true, '设备配置已保存');
    updateDeviceList();
  });

  deviceStatusProvider.onDeleteConfig(async (configId) => {
    await deviceConfigManager.delete(configId);
    deviceStatusProvider.showMessage(true, '设备配置已删除');
    updateDeviceList();
  });

  // 监听手动发送请求
  manualSendProvider.onSendMessage(async (request) => {
    const result = await executor.manualSendMessage(
      request.channel,
      request.id,
      request.data,
      request.isFD
    );
    manualSendProvider.showSendResult(result.success, result.message);
  });

  // 监听executor的报文发送事件，推送到监视视图
  executor.onMessageSent((message) => {
    messageMonitorProvider.addMessage({
      timestamp: message.timestamp,
      channel: message.channel,
      id: message.id,
      dlc: message.dlc,
      data: message.data,
      direction: 'tx',
      isFD: message.isFD,
    });
  });

  // 监听executor的报文接收事件，推送到监视视图
  executor.onMessageReceived((message) => {
    messageMonitorProvider.addMessage({
      timestamp: message.timestamp,
      channel: message.channel,
      id: message.id,
      dlc: message.dlc,
      data: message.data,
      direction: 'rx',
      isFD: message.isFD,
    });
  });

  // 初始化时加载设备列表 (使用常量替代硬编码)
  setTimeout(() => {
    updateDeviceList();
  }, TIMEOUTS.DEVICE_INIT_DELAY_MS);

  // ========== 命令注册 ==========

  // 显示测试输出
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "tester.showTestOutput",
      () => {
        executor.getOutputChannel().show();
      }
    )
  );

  // 运行全部测试
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "tester.runAllTests",
      async (documentUri: vscode.Uri) => {
        statusBar.reset();
        const result = await executor.runAllTests(documentUri);
        statusBar.updateResult({
          passed: result.totalPassed,
          failed: result.totalFailed,
          total: result.totalPassed + result.totalFailed,
          running: false
        });
        updateDeviceStatus();
      }
    )
  );

  // 运行测试用例集
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "tester.runTestSuiteByLine",
      async (documentUri: vscode.Uri, lineNumber: number, suiteName: string) => {
        statusBar.reset();
        const result = await executor.runTestSuiteByLine(documentUri, lineNumber, suiteName);
        statusBar.updateResult({
          passed: result.passed,
          failed: result.failed,
          total: result.passed + result.failed,
          running: false
        });
        updateDeviceStatus();
      }
    )
  );

  // 运行单个测试用例
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "tester.runTestCaseByLine",
      async (documentUri: vscode.Uri, lineNumber: number, caseName: string) => {
        statusBar.reset();
        const result = await executor.runTestCaseByLine(documentUri, lineNumber, caseName);
        statusBar.updateResult({
          passed: result.success ? 1 : 0,
          failed: result.success ? 0 : 1,
          total: 1,
          running: false
        });
        updateDeviceStatus();
      }
    )
  );

  // 暂停执行
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "tester.pauseExecution",
      () => {
        executor.pauseAllTasks();
      }
    )
  );

  // 继续执行
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "tester.resumeExecution",
      () => {
        executor.resumeAllTasks();
      }
    )
  );

  // 停止执行(同时关闭设备)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "tester.stopExecution",
      () => {
        executor.stopAllTasks(true);
        deviceStatusProvider.updateStatus({
          connected: false,
          deviceType: '',
          deviceIndex: 0,
          channels: [],
        });
      }
    )
  );

  // 打开设备
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "tester.openDevice",
      async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'tester') {
          showWarning('请先打开一个 Tester 文件');
          return;
        }

        const result = await executor.openDeviceForManualSend(editor.document.uri);
        if (result.success) {
          showInfo(result.message);
          updateDeviceStatus();
        } else {
          showError(result.message);
        }
      }
    )
  );

  // 关闭设备
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "tester.closeDevice",
      () => {
        executor.closeDeviceManually();
        updateDeviceStatus();
        showInfo('设备已关闭');
      }
    )
  );

  // 切换监视模式
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "tester.toggleMonitorMode",
      () => {
        messageMonitorProvider.toggleMode();
      }
    )
  );

  // 清空报文
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "tester.clearMessages",
      () => {
        messageMonitorProvider.clearMessages();
      }
    )
  );

  // 发送报文(提示使用侧边栏)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "tester.sendMessage",
      () => {
        showInfo('请使用侧边栏的手动发送视图');
      }
    )
  );

  // ========== 文档事件监听 ==========

  // 已打开的文档验证
  vscode.workspace.textDocuments.forEach((doc) => {
    if (doc.languageId === "tester") {
      validator.validateDocument(doc);
    }
  });

  // 文档更改时验证
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.languageId === "tester") {
        validator.validateDocument(event.document);
      }
    })
  );

  // 文档打开时验证
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((doc) => {
      if (doc.languageId === "tester") {
        validator.validateDocument(doc);
      }
    })
  );

  // 文档关闭时清除诊断
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((doc) => {
      if (doc.languageId === "tester") {
        diagnosticCollection.delete(doc.uri);
      }
    })
  );

  showInfo("Tester Language Support 已加载！");
}

/**
 * 扩展停用时调用
 */
export function deactivate() {
  // 清理资源
}
