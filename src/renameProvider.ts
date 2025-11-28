import * as vscode from 'vscode';
import { TesterParser } from './parser';

/**
 * 重命名提供程序 - 实现"重命名符号"功能
 */
export class TesterRenameProvider implements vscode.RenameProvider {
  /**
   * 准备重命名 - 验证是否可以重命名
   */
  public prepareRename(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Range | { range: vscode.Range; placeholder: string }> {
    const wordRange = document.getWordRangeAtPosition(position);
    if (!wordRange) {
      throw new Error('无法重命名：未选中有效的符号');
    }

    const word = document.getText(wordRange);
    const line = document.lineAt(position.line).text;

    // 解析文档
    const parser = new TesterParser();
    const parseResult = parser.parse(document.getText());

    if (parseResult.errors.length > 0 || !parseResult.program) {
      throw new Error('无法重命名：文档存在语法错误');
    }

    const enums = parseResult.program.enums;
    const bitFieldFunctions = parseResult.program.bitFieldFunctions;

    // 检查是否为可重命名的符号
    const isBitFieldFunction = line.includes('tbitfield') && bitFieldFunctions.has(word);
    const isEnum = line.includes('tenum') && enums.has(word);
    const isEnumValue = Array.from(enums.values()).some(enumDef =>
      Array.from(enumDef.values.values()).includes(word)
    );

    if (!isBitFieldFunction && !isEnum && !isEnumValue) {
      throw new Error('只能重命名位域函数、枚举或枚举值');
    }

    return {
      range: wordRange,
      placeholder: word
    };
  }

  /**
   * 提供重命名的编辑操作
   */
  public provideRenameEdits(
    document: vscode.TextDocument,
    position: vscode.Position,
    newName: string,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.WorkspaceEdit> {
    const wordRange = document.getWordRangeAtPosition(position);
    if (!wordRange) {
      return null;
    }

    const word = document.getText(wordRange);
    const line = document.lineAt(position.line).text;

    // 解析文档
    const parser = new TesterParser();
    const parseResult = parser.parse(document.getText());

    if (parseResult.errors.length > 0 || !parseResult.program) {
      return null;
    }

    const enums = parseResult.program.enums;
    const bitFieldFunctions = parseResult.program.bitFieldFunctions;
    const workspaceEdit = new vscode.WorkspaceEdit();

    // 场景1: 重命名位域函数
    if (line.includes('tbitfield') && bitFieldFunctions.has(word)) {
      const funcDef = bitFieldFunctions.get(word);

      // 重命名函数定义
      if (funcDef) {
        const defLine = document.lineAt(funcDef.line).text;
        const startChar = defLine.indexOf(word);
        workspaceEdit.replace(
          document.uri,
          new vscode.Range(funcDef.line, startChar, funcDef.line, startChar + word.length),
          newName
        );
      }

      // 重命名所有函数调用
      const lines = document.getText().split('\n');
      for (let i = 0; i < lines.length; i++) {
        const currentLine = lines[i].trim();

        // 跳过定义行
        if (currentLine.startsWith('tbitfield')) {
          continue;
        }

        // 匹配函数调用
        const callMatch = currentLine.match(new RegExp(`^(${word})\\s+\\w+\\s*=\\s*.+$`));
        if (callMatch) {
          const startChar = lines[i].indexOf(word);
          workspaceEdit.replace(
            document.uri,
            new vscode.Range(i, startChar, i, startChar + word.length),
            newName
          );
        }
      }
    }
    // 场景2: 重命名枚举
    else if (line.includes('tenum') && enums.has(word)) {
      const enumDef = enums.get(word);

      // 重命名枚举定义
      if (enumDef) {
        const defLine = document.lineAt(enumDef.line).text;
        const startChar = defLine.indexOf(word);
        workspaceEdit.replace(
          document.uri,
          new vscode.Range(enumDef.line, startChar, enumDef.line, startChar + word.length),
          newName
        );
      }

      // 重命名位域函数定义中的引用
      bitFieldFunctions.forEach((funcDef, funcName) => {
        const funcLine = document.lineAt(funcDef.line).text;
        funcDef.parameters.forEach((internalName, displayName) => {
          if (internalName === word || internalName.includes(word)) {
            // 替换内部名称中的枚举名
            const newInternalName = internalName.replace(word, newName);
            const match = funcLine.match(new RegExp(`"(${internalName})"`));
            if (match && match.index !== undefined) {
              workspaceEdit.replace(
                document.uri,
                new vscode.Range(
                  funcDef.line,
                  match.index + 1,
                  funcDef.line,
                  match.index + 1 + internalName.length
                ),
                newInternalName
              );
            }
          }
        });
      });
    }
    // 场景3: 重命名枚举值
    else {
      // 检查是否为枚举值
      for (const [enumName, enumDef] of enums.entries()) {
        for (const [numericValue, displayValue] of enumDef.values.entries()) {
          if (displayValue === word) {
            const lines = document.getText().split('\n');

            // 重命名枚举定义中的值
            const defLine = lines[enumDef.line];
            const valuePattern = new RegExp(`(\\d+)\\s*=\\s*(${word})(?:,|\\s|$)`);
            const defMatch = defLine.match(valuePattern);
            if (defMatch && defMatch.index !== undefined) {
              const startChar = defMatch.index + defMatch[0].indexOf(word);
              workspaceEdit.replace(
                document.uri,
                new vscode.Range(enumDef.line, startChar, enumDef.line, startChar + word.length),
                newName
              );
            }

            // 重命名所有使用位置
            for (let i = 0; i < lines.length; i++) {
              if (i === enumDef.line) {
                continue; // 跳过定义行，已经处理
              }

              const currentLine = lines[i];
              const valueMatch = new RegExp(`=\\s*(${word})(?:,|\\s|$)`);
              if (valueMatch.test(currentLine)) {
                const match = currentLine.match(valueMatch);
                if (match && match.index !== undefined) {
                  const startChar = match.index + match[0].indexOf(word);
                  workspaceEdit.replace(
                    document.uri,
                    new vscode.Range(i, startChar, i, startChar + word.length),
                    newName
                  );
                }
              }
            }

            break;
          }
        }
      }
    }

    return workspaceEdit;
  }
}
