/**
 * 统一通知服务
 * 提供一致的用户通知接口
 */

import * as vscode from 'vscode';

/**
 * 显示信息消息
 */
export function showInfo(message: string, ...actions: string[]): Thenable<string | undefined> {
  return vscode.window.showInformationMessage(message, ...actions);
}

/**
 * 显示警告消息
 */
export function showWarning(message: string, ...actions: string[]): Thenable<string | undefined> {
  return vscode.window.showWarningMessage(message, ...actions);
}

/**
 * 显示错误消息
 */
export function showError(message: string, ...actions: string[]): Thenable<string | undefined> {
  return vscode.window.showErrorMessage(message, ...actions);
}

/**
 * 显示成功消息(带图标的信息消息)
 */
export function showSuccess(message: string, ...actions: string[]): Thenable<string | undefined> {
  return vscode.window.showInformationMessage(`✓ ${message}`, ...actions);
}

/**
 * 显示进度通知
 */
export async function withProgress<T>(
  title: string,
  task: (progress: vscode.Progress<{ message?: string; increment?: number }>) => Promise<T>
): Promise<T> {
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title,
      cancellable: false,
    },
    task
  );
}

/**
 * 显示可取消的进度通知
 */
export async function withCancellableProgress<T>(
  title: string,
  task: (
    progress: vscode.Progress<{ message?: string; increment?: number }>,
    token: vscode.CancellationToken
  ) => Promise<T>
): Promise<T> {
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title,
      cancellable: true,
    },
    task
  );
}

/**
 * 显示输入框
 */
export function showInputBox(options: vscode.InputBoxOptions): Thenable<string | undefined> {
  return vscode.window.showInputBox(options);
}

/**
 * 显示快速选择框
 */
export function showQuickPick<T extends vscode.QuickPickItem>(
  items: T[] | Thenable<T[]>,
  options?: vscode.QuickPickOptions
): Thenable<T | undefined> {
  return vscode.window.showQuickPick(items, options);
}

/**
 * 显示确认对话框
 */
export async function showConfirm(
  message: string,
  confirmText: string = '确认',
  cancelText: string = '取消'
): Promise<boolean> {
  const result = await vscode.window.showWarningMessage(
    message,
    { modal: true },
    confirmText,
    cancelText
  );
  return result === confirmText;
}

/**
 * 显示是/否对话框
 */
export async function showYesNo(message: string): Promise<boolean> {
  const result = await vscode.window.showInformationMessage(
    message,
    '是',
    '否'
  );
  return result === '是';
}
