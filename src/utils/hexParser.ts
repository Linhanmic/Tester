/**
 * 十六进制解析工具
 * 统一处理各种十六进制/十进制数值的解析
 */

/**
 * 解析十六进制或十进制值
 * 如果以0x开头则解析为十六进制,否则解析为十进制
 * @param str 要解析的字符串
 * @returns 解析后的数值,失败返回null
 */
export function parseHex(str: string): number | null {
  const trimmed = str.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.toLowerCase().startsWith("0x")) {
    const result = parseInt(trimmed, 16);
    return isNaN(result) ? null : result;
  }

  const result = parseInt(trimmed, 10);
  return isNaN(result) ? null : result;
}

/**
 * 解析十六进制值(默认为十六进制)
 * 支持省略0x前缀,默认视为十六进制
 * 用于报文ID、诊断ID等字段
 * @param str 要解析的字符串
 * @returns 解析后的数值,失败返回null
 */
export function parseHexDefault(str: string): number | null {
  const trimmed = str.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.toLowerCase().startsWith("0x")) {
    const result = parseInt(trimmed, 16);
    return isNaN(result) ? null : result;
  }

  // 省略0x前缀,默认视为十六进制
  const result = parseInt(trimmed, 16);
  return isNaN(result) ? null : result;
}

/**
 * 解析数据字节字符串
 * 支持格式: "XX-XX-XX" 或 "XX XX XX"
 * @param str 要解析的字符串
 * @returns 解析后的字节数组
 */
export function parseDataBytes(str: string): number[] {
  const parts = str.split(/[-\s]+/);
  return parts
    .map((p) => parseInt(p.trim(), 16))
    .filter((n) => !isNaN(n));
}

/**
 * 将数值格式化为十六进制字符串
 * @param value 数值
 * @param minLength 最小长度(不足时补零)
 * @param prefix 是否添加0x前缀
 * @returns 格式化后的十六进制字符串
 */
export function formatHex(value: number, minLength: number = 2, prefix: boolean = true): string {
  const hex = value.toString(16).toUpperCase().padStart(minLength, '0');
  return prefix ? `0x${hex}` : hex;
}

/**
 * 将字节数组格式化为十六进制字符串
 * @param bytes 字节数组
 * @param separator 分隔符
 * @returns 格式化后的字符串
 */
export function formatDataBytes(bytes: number[], separator: string = '-'): string {
  return bytes.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(separator);
}

/**
 * 验证是否为有效的十六进制字符串
 * @param str 要验证的字符串
 * @returns 是否有效
 */
export function isValidHex(str: string): boolean {
  const trimmed = str.trim();
  if (trimmed.toLowerCase().startsWith("0x")) {
    return /^0x[0-9a-fA-F]+$/.test(trimmed);
  }
  return /^[0-9a-fA-F]+$/.test(trimmed);
}
