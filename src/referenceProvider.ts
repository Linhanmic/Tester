import * as vscode from 'vscode';
import { TesterParser } from './parser';

/**
 * 引用提供程序 - 实现"查找所有引用"功能
 */
export class TesterReferenceProvider implements vscode.ReferenceProvider {
  /**
   * 查找符号的所有引用
   */
  public provideReferences(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.ReferenceContext,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Location[]> {
    const wordRange = document.getWordRangeAtPosition(position);
    if (!wordRange) {
      return null;
    }

    const word = document.getText(wordRange);
    const line = document.lineAt(position.line).text;

    // 解析整个文档
    const parser = new TesterParser();
    const parseResult = parser.parse(document.getText());

    if (parseResult.errors.length > 0 || !parseResult.program) {
      return null;
    }

    const enums = parseResult.program.enums;
    const bitFieldFunctions = parseResult.program.bitFieldFunctions;
    const locations: vscode.Location[] = [];

    // 场景1: 查找位域函数的所有调用
    if (line.includes('tbitfield') && bitFieldFunctions.has(word)) {
      // 用户点击在函数定义上
      // 遍历所有行查找函数调用
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
          locations.push(
            new vscode.Location(
              document.uri,
              new vscode.Range(i, startChar, i, startChar + word.length)
            )
          );
        }
      }

      // 如果需要包含定义本身
      if (context.includeDeclaration) {
        const funcDef = bitFieldFunctions.get(word);
        if (funcDef) {
          const defLine = document.lineAt(funcDef.line).text;
          const startChar = defLine.indexOf(word);
          locations.push(
            new vscode.Location(
              document.uri,
              new vscode.Range(funcDef.line, startChar, funcDef.line, startChar + word.length)
            )
          );
        }
      }
    }
    // 场景2: 查找枚举的所有引用
    else if (line.includes('tenum') && enums.has(word)) {
      // 用户点击在枚举定义上
      const enumDef = enums.get(word);

      // 添加枚举定义本身
      if (context.includeDeclaration && enumDef) {
        const defLine = document.lineAt(enumDef.line).text;
        const startChar = defLine.indexOf(word);
        locations.push(
          new vscode.Location(
            document.uri,
            new vscode.Range(enumDef.line, startChar, enumDef.line, startChar + word.length)
          )
        );
      }

      // 查找位域函数定义中引用此枚举的地方
      bitFieldFunctions.forEach((funcDef, funcName) => {
        const funcLine = document.lineAt(funcDef.line).text;
        funcDef.parameters.forEach((internalName, displayName) => {
          if (internalName.includes(word) || word.includes(internalName)) {
            // 在函数定义行中查找内部名称的位置
            const match = funcLine.match(new RegExp(`"(${internalName})"`));
            if (match && match.index !== undefined) {
              locations.push(
                new vscode.Location(
                  document.uri,
                  new vscode.Range(
                    funcDef.line,
                    match.index + 1,
                    funcDef.line,
                    match.index + 1 + internalName.length
                  )
                )
              );
            }
          }
        });
      });
    }
    // 场景3: 查找枚举值的所有使用
    else {
      // 检查是否为枚举值
      for (const [enumName, enumDef] of enums.entries()) {
        for (const [numericValue, displayValue] of enumDef.values.entries()) {
          if (displayValue === word) {
            // 这是一个枚举值，查找所有使用位置
            const lines = document.getText().split('\n');

            // 添加枚举定义行
            if (context.includeDeclaration) {
              const defLine = lines[enumDef.line];
              const startChar = defLine.indexOf(word);
              if (startChar >= 0) {
                locations.push(
                  new vscode.Location(
                    document.uri,
                    new vscode.Range(enumDef.line, startChar, enumDef.line, startChar + word.length)
                  )
                );
              }
            }

            // 查找所有使用位置
            for (let i = 0; i < lines.length; i++) {
              const currentLine = lines[i];

              // 跳过枚举定义行
              if (i === enumDef.line) {
                continue;
              }

              // 查找函数调用中的枚举值
              const valueMatch = new RegExp(`=\\s*(${word})(?:,|\\s|$)`);
              if (valueMatch.test(currentLine)) {
                const match = currentLine.match(valueMatch);
                if (match && match.index !== undefined) {
                  const startChar = match.index + match[0].indexOf(word);
                  locations.push(
                    new vscode.Location(
                      document.uri,
                      new vscode.Range(i, startChar, i, startChar + word.length)
                    )
                  );
                }
              }
            }

            break;
          }
        }
      }
    }

    return locations.length > 0 ? locations : null;
  }
}
