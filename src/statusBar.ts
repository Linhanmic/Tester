import * as vscode from 'vscode';

export interface TestResult {
  passed: number;
  failed: number;
  total: number;
  running: boolean;
}

export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;
  private result: TestResult = { passed: 0, failed: 0, total: 0, running: false };

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.statusBarItem.command = 'tester.showTestOutput';
    this.updateDisplay();
    this.statusBarItem.show();
  }

  public updateResult(result: TestResult) {
    this.result = result;
    this.updateDisplay();
  }

  public setRunning(running: boolean) {
    this.result.running = running;
    this.updateDisplay();
  }

  public reset() {
    this.result = { passed: 0, failed: 0, total: 0, running: false };
    this.updateDisplay();
  }

  private updateDisplay() {
    if (this.result.running) {
      this.statusBarItem.text = '$(sync~spin) Tester: 运行中...';
      this.statusBarItem.backgroundColor = undefined;
      this.statusBarItem.tooltip = '测试正在运行';
    } else if (this.result.total === 0) {
      this.statusBarItem.text = '$(beaker) Tester';
      this.statusBarItem.backgroundColor = undefined;
      this.statusBarItem.tooltip = '点击查看测试输出';
    } else if (this.result.failed === 0) {
      this.statusBarItem.text = `$(check) Tester: ${this.result.passed}/${this.result.total} 通过`;
      this.statusBarItem.backgroundColor = undefined;
      this.statusBarItem.tooltip = `全部测试通过!\n通过: ${this.result.passed}`;
    } else {
      this.statusBarItem.text = `$(x) Tester: ${this.result.passed}/${this.result.total} 通过, ${this.result.failed} 失败`;
      this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
      this.statusBarItem.tooltip = `测试未全部通过\n通过: ${this.result.passed}\n失败: ${this.result.failed}`;
    }
  }

  public dispose() {
    this.statusBarItem.dispose();
  }
}
