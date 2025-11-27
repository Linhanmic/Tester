/**
 * 脚本转换器单元测试
 * 测试位域函数语法到原始指令的转换功能
 *
 * 运行方式: npx ts-node test/converter.test.ts
 */

/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { ScriptConverter } from '../src/converter';

// 声明全局类型
declare const console: {
  log(...args: any[]): void;
};

declare const process: {
  exit(code: number): void;
};

// 测试结果记录
interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

const testResults: TestResult[] = [];

function test(name: string, fn: () => void): void {
  try {
    fn();
    testResults.push({ name, passed: true, message: '' });
    console.log(`✓ ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    testResults.push({ name, passed: false, message });
    console.log(`✗ ${name}`);
    console.log(`  错误: ${message}`);
  }
}

function assertEquals(actual: any, expected: any, message?: string): void {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(
      message || `断言失败:\n  期望: ${expectedStr}\n  实际: ${actualStr}`
    );
  }
}

function assertContains(text: string, substring: string, message?: string): void {
  if (!text.includes(substring)) {
    throw new Error(
      message || `断言失败: 文本中不包含 "${substring}"`
    );
  }
}

function assertNotContains(text: string, substring: string, message?: string): void {
  if (text.includes(substring)) {
    throw new Error(
      message || `断言失败: 文本中包含 "${substring}"`
    );
  }
}

// ========== 测试用例 ==========

console.log('\n开始测试脚本转换器...\n');

const converter = new ScriptConverter();

// 测试1: 转换简单的枚举定义
test('正确转换枚举定义为注释', () => {
  const source = `tenum 车速单位 0=km/h, 1=mph, 2=m/s`;
  const result = converter.convert(source);

  assertContains(result, '// tenum 车速单位');
  assertContains(result, '0=km/h, 1=mph, 2=m/s');
});

// 测试2: 转换位域函数定义
test('正确转换位域函数定义为注释', () => {
  const source = `
tenum 车速单位 0=km/h, 1=mph
tbitfield 车速 车速值="车速", 车速单位="单位": 144, 1.0-2.7="车速"/100, 3.0-3.1="单位"
`;
  const result = converter.convert(source);

  assertContains(result, '// tbitfield 车速');
  assertContains(result, 'CAN ID: 0x144');  // 144 解析为十六进制0x144
  assertContains(result, '车速值="车速", 车速单位="单位"');
});

// 测试3: 转换位域函数调用为tcans命令
test('正确转换位域函数调用为tcans命令', () => {
  const source = `
tenum 车速单位 0=km/h, 1=mph
tbitfield 车速 车速值="车速", 车速单位="单位": 144, 1.0-2.7="车速"/100, 3.0-3.1="单位"

ttitle=测试
  1 tstart=测试用例
    车速 车速值=100, 车速单位=km/h
  tend
ttitle-end
`;
  const result = converter.convert(source);

  // 应包含注释说明原始调用
  assertContains(result, '// 车速 车速值=100, 车速单位=km/h');

  // 应包含转换后的tcans命令
  assertContains(result, 'tcans 0x144');

  // 验证数据: 车速值=100, 缩放因子100 -> 10000 = 0x2710
  // Intel字节序: 低字节在前 -> 10 27
  assertContains(result, '10 27 00 00 00 00 00 00');
});

// 测试4: 转换枚举值
test('正确转换枚举值为数字', () => {
  const source = `
tenum 档位 0=P档, 1=R档, 2=N档, 3=D档
tbitfield 档位信息 当前档位="档位": 260, 1.0-1.2="档位"

ttitle=测试
  1 tstart=测试用例
    档位信息 当前档位=D档
  tend
ttitle-end
`;
  const result = converter.convert(source);

  // 应包含注释
  assertContains(result, '// 档位信息 当前档位=D档');

  // 应包含tcans命令
  assertContains(result, 'tcans 0x260');  // 260 解析为十六进制0x260

  // D档=3, 位域1.0-1.2表示字节1的bit0-2，值为3 = 0b011
  assertContains(result, '03 00 00 00 00 00 00 00');
});

// 测试5: 转换配置块
test('正确转换配置块', () => {
  const source = `
tset
  tcaninit 4, 0, 0, 500
tend
`;
  const result = converter.convert(source);

  assertContains(result, '设备配置');
  assertContains(result, 'tset');
  assertContains(result, 'tcaninit 4, 0, 0, 500');
  assertContains(result, 'tend');
});

// 测试6: 转换其他命令
test('正确转换tdelay和tconfirm命令', () => {
  const source = `
ttitle=测试
  1 tstart=测试用例
    tdelay 100
    tconfirm 请确认
  tend
ttitle-end
`;
  const result = converter.convert(source);

  assertContains(result, 'tdelay 100');
  assertContains(result, 'tconfirm 请确认');
});

// 测试7: 转换测试用例集结构
test('正确保留测试用例集结构', () => {
  const source = `
ttitle=车速测试
  1 tstart=测试1
    tdelay 100
  tend

  2 tstart=测试2
    tdelay 200
  tend
ttitle-end
`;
  const result = converter.convert(source);

  assertContains(result, 'ttitle=车速测试');
  assertContains(result, '1 tstart=测试1');
  assertContains(result, '2 tstart=测试2');
  assertContains(result, 'ttitle-end');
});

// 测试8: 验证生成的文件头
test('生成正确的文件头注释', () => {
  const source = `ttitle=测试\nttitle-end`;
  const result = converter.convert(source);

  assertContains(result, '自动生成的原始指令脚本');
  assertContains(result, '由位域函数语法转换而来');
  assertContains(result, '生成时间:');
});

// 测试9: 转换复杂的位域函数调用
test('正确转换多参数位域函数', () => {
  const source = `
tenum 档位 0=P档, 3=D档
tbitfield 档位转速 当前档位="档位", 发动机转速="转速": 260, 1.0-1.2="档位", 2.0-3.7="转速"/10

ttitle=测试
  1 tstart=测试用例
    档位转速 当前档位=D档, 发动机转速=2500
  tend
ttitle-end
`;
  const result = converter.convert(source);

  // 应包含注释
  assertContains(result, '// 档位转速 当前档位=D档, 发动机转速=2500');

  // 应包含tcans命令
  assertContains(result, 'tcans 0x260');

  // 验证数据:
  // 档位=3 (D档), 位域1.0-1.2 -> 字节1 bit0-2 = 0b011 = 0x03
  // 转速=2500, 缩放10 -> 25000 = 0x61A8
  // 位域2.0-3.7: 字节2-3, Intel字节序 -> A8 61
  assertContains(result, '03 A8 61 00 00 00 00 00');
});

// 测试10: 不转换已经是原始命令的脚本
test('保留原始tcans命令不变', () => {
  const source = `
ttitle=测试
  1 tstart=测试用例
    tcans 0x144, 10 27 00 00 00 00 00 00, 0, 1
  tend
ttitle-end
`;
  const result = converter.convert(source);

  assertContains(result, 'tcans 0x144, 10 27 00 00 00 00 00 00, 0, 1');
});

// 测试11: 转换完整的车辆控制示例（简化版）
test('正确转换完整的示例脚本', () => {
  const source = `
tenum 车速单位 0=km/h, 1=mph
tenum 档位 0=P档, 3=D档
tbitfield 车速 车速值="车速", 车速单位="单位": 144, 1.0-2.7="车速"/100, 3.0-3.1="单位"
tbitfield 档位信息 当前档位="档位": 260, 1.0-1.2="档位"

tset
  tcaninit 4, 0, 0, 500
tend

ttitle=综合测试
  1 tstart=起步
    档位信息 当前档位=D档
    车速 车速值=0, 车速单位=km/h
    tdelay 100
  tend
ttitle-end
`;
  const result = converter.convert(source);

  // 验证枚举定义被转为注释
  assertContains(result, '// tenum 车速单位');
  assertContains(result, '// tenum 档位');

  // 验证位域函数定义被转为注释
  assertContains(result, '// tbitfield 车速');
  assertContains(result, '// tbitfield 档位信息');

  // 验证配置块保留
  assertContains(result, 'tcaninit 4, 0, 0, 500');

  // 验证函数调用被转为tcans
  assertContains(result, '// 档位信息 当前档位=D档');
  assertContains(result, 'tcans 0x260');
  assertContains(result, '// 车速 车速值=0, 车速单位=km/h');
  assertContains(result, 'tcans 0x144');

  // 验证其他命令保留
  assertContains(result, 'tdelay 100');

  // 验证不包含原始的tenum和tbitfield关键字（只在注释中）
  const lines = result.split('\n');
  const nonCommentLines = lines.filter(line => !line.trim().startsWith('//'));
  const nonCommentText = nonCommentLines.join('\n');
  assertNotContains(nonCommentText, 'tenum ');
  assertNotContains(nonCommentText, 'tbitfield ');
});

// 测试12: 错误处理 - 未定义的枚举值
test('检测未定义的枚举值', () => {
  const source = `
tenum 档位 0=P档, 3=D档
tbitfield 档位信息 当前档位="档位": 260, 1.0-1.2="档位"

ttitle=测试
  1 tstart=测试用例
    档位信息 当前档位=X档
  tend
ttitle-end
`;

  try {
    converter.convert(source);
    throw new Error('应该抛出错误');
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    assertContains(message, '未找到枚举值');
  }
});

// ========== 输出测试结果 ==========

console.log('\n========================================');
console.log('测试结果汇总:');
console.log('========================================');

const passed = testResults.filter(r => r.passed).length;
const failed = testResults.filter(r => !r.passed).length;

console.log(`总计: ${testResults.length} 个测试`);
console.log(`通过: ${passed} 个`);
console.log(`失败: ${failed} 个`);

if (failed > 0) {
  console.log('\n失败的测试:');
  testResults.filter(r => !r.passed).forEach(r => {
    console.log(`  - ${r.name}`);
    console.log(`    ${r.message}`);
  });
}

console.log('========================================\n');

process.exit(failed > 0 ? 1 : 0);
