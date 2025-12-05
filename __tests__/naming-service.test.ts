/**
 * 命名服务单元测试
 * 测试 ABCD 参数 -> 文件名生成逻辑
 *
 * 格式: YYYYMMDD_[A1]_[A2]_[B]_[C]_[D-Code]
 * 示例: 20251205_Product_Unboxing_Walk_Indoor_D001
 */

import { describe, test, expect, beforeEach } from '@jest/globals';

// 类型定义
interface ABCDParams {
  date?: string;
  A1: string;
  A2: string;
  B: string;
  C: string;
  D: string;
}

// 模拟命名服务实现
class NamingService {
  /**
   * 生成标准命名
   * @param params ABCD 参数
   * @returns 格式化的文件名
   */
  generateName(params: ABCDParams): string {
    const date = params.date || this.getCurrentDate();
    const { A1, A2, B, C, D } = params;

    // 参数验证
    if (!A1 || !A2 || !B || !C || !D) {
      throw new Error('所有 ABCD 参数必须提供');
    }

    // 清理参数（移除空格和特殊字符）
    const cleanedParams = {
      A1: this.sanitize(A1),
      A2: this.sanitize(A2),
      B: this.sanitize(B),
      C: this.sanitize(C),
      D: this.sanitize(D),
    };

    // 生成命名
    return `${this.formatDate(date)}_${cleanedParams.A1}_${cleanedParams.A2}_${cleanedParams.B}_${cleanedParams.C}_${cleanedParams.D}`;
  }

  /**
   * 批量生成命名
   * @param paramsList 参数列表
   * @returns 命名列表
   */
  batchGenerate(paramsList: ABCDParams[]): string[] {
    const names = paramsList.map((params) => this.generateName(params));

    // 检查重复
    const uniqueNames = new Set(names);
    if (uniqueNames.size !== names.length) {
      throw new Error('生成的命名存在重复');
    }

    return names;
  }

  /**
   * 解析命名为 ABCD 参数
   * @param name 文件名
   * @returns 解析后的参数
   */
  parseName(name: string): ABCDParams | null {
    const parts = name.split('_');

    if (parts.length !== 6) {
      return null;
    }

    const [dateStr, A1, A2, B, C, D] = parts;

    // 验证日期格式
    if (!/^\d{8}$/.test(dateStr)) {
      return null;
    }

    return {
      date: this.parseDate(dateStr),
      A1,
      A2,
      B,
      C,
      D,
    };
  }

  /**
   * 验证命名格式
   * @param name 文件名
   * @returns 是否有效
   */
  validateName(name: string): boolean {
    const parsed = this.parseName(name);
    return parsed !== null;
  }

  // 私有辅助方法
  private getCurrentDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  private formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }

  private parseDate(dateStr: string): string {
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return `${year}-${month}-${day}`;
  }

  private sanitize(value: string): string {
    return value
      .trim()
      .replace(/\s+/g, '_') // 空格替换为下划线
      .replace(/[^\w-]/g, '_'); // 特殊字符替换为下划线
  }
}

// 测试套件
describe('NamingService - 命名生成服务', () => {
  let namingService: NamingService;

  beforeEach(() => {
    namingService = new NamingService();
  });

  describe('generateName - 标准命名生成', () => {
    test('应生成标准格式的命名', () => {
      const params: ABCDParams = {
        date: '2025-12-05',
        A1: 'Product',
        A2: 'Unboxing',
        B: 'Walk',
        C: 'Indoor',
        D: 'D001',
      };

      const result = namingService.generateName(params);

      expect(result).toBe('20251205_Product_Unboxing_Walk_Indoor_D001');
    });

    test('应在未提供日期时使用当前日期', () => {
      const params: ABCDParams = {
        A1: 'Product',
        A2: 'Unboxing',
        B: 'Walk',
        C: 'Indoor',
        D: 'D001',
      };

      const result = namingService.generateName(params);

      // 验证日期部分是 8 位数字
      const datePart = result.split('_')[0];
      expect(datePart).toMatch(/^\d{8}$/);
    });

    test('应自动移除参数中的空格', () => {
      const params: ABCDParams = {
        date: '2025-12-05',
        A1: 'Product Type',
        A2: 'Unboxing Video',
        B: 'Walk Fast',
        C: 'Indoor Scene',
        D: 'D 001',
      };

      const result = namingService.generateName(params);

      expect(result).toBe('20251205_Product_Type_Unboxing_Video_Walk_Fast_Indoor_Scene_D_001');
    });

    test('应将特殊字符替换为下划线', () => {
      const params: ABCDParams = {
        date: '2025-12-05',
        A1: 'Product@Type',
        A2: 'Unboxing#Video',
        B: 'Walk&Fast',
        C: 'Indoor/Scene',
        D: 'D001!',
      };

      const result = namingService.generateName(params);

      expect(result).not.toContain('@');
      expect(result).not.toContain('#');
      expect(result).not.toContain('&');
      expect(result).not.toContain('/');
      expect(result).not.toContain('!');
    });

    test('应在缺少必需参数时抛出错误', () => {
      const incompleteParams = {
        date: '2025-12-05',
        A1: 'Product',
        A2: 'Unboxing',
        B: 'Walk',
        C: 'Indoor',
        D: '', // 缺少 D 参数
      };

      expect(() => namingService.generateName(incompleteParams as ABCDParams)).toThrow(
        '所有 ABCD 参数必须提供'
      );
    });

    test('应处理不同的日期格式', () => {
      const testDates = [
        { input: '2025-01-01', expected: '20250101' },
        { input: '2025-12-31', expected: '20251231' },
        { input: '2024-02-29', expected: '20240229' }, // 闰年
      ];

      testDates.forEach(({ input, expected }) => {
        const params: ABCDParams = {
          date: input,
          A1: 'Product',
          A2: 'Unboxing',
          B: 'Walk',
          C: 'Indoor',
          D: 'D001',
        };

        const result = namingService.generateName(params);
        expect(result).toContain(expected);
      });
    });
  });

  describe('batchGenerate - 批量生成', () => {
    test('应成功生成多个唯一命名', () => {
      const paramsList: ABCDParams[] = [
        {
          date: '2025-12-05',
          A1: 'Product',
          A2: 'Unboxing',
          B: 'Walk',
          C: 'Indoor',
          D: 'D001',
        },
        {
          date: '2025-12-05',
          A1: 'Scene',
          A2: 'Lifestyle',
          B: 'Sit',
          C: 'Outdoor',
          D: 'D002',
        },
        {
          date: '2025-12-06',
          A1: 'Audience',
          A2: 'Senior',
          B: 'Stand',
          C: 'Studio',
          D: 'D003',
        },
      ];

      const results = namingService.batchGenerate(paramsList);

      expect(results).toHaveLength(3);
      expect(results[0]).toBe('20251205_Product_Unboxing_Walk_Indoor_D001');
      expect(results[1]).toBe('20251205_Scene_Lifestyle_Sit_Outdoor_D002');
      expect(results[2]).toBe('20251206_Audience_Senior_Stand_Studio_D003');
    });

    test('应在批量生成 20 个命名时保持性能', () => {
      const paramsList: ABCDParams[] = Array.from({ length: 20 }, (_, i) => ({
        date: '2025-12-05',
        A1: 'Product',
        A2: 'Unboxing',
        B: 'Walk',
        C: 'Indoor',
        D: `D${String(i + 1).padStart(3, '0')}`,
      }));

      const startTime = Date.now();
      const results = namingService.batchGenerate(paramsList);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(20);
      expect(duration).toBeLessThan(500); // 应在 500ms 内完成
    });

    test('应检测并拒绝重复的命名', () => {
      const paramsList: ABCDParams[] = [
        {
          date: '2025-12-05',
          A1: 'Product',
          A2: 'Unboxing',
          B: 'Walk',
          C: 'Indoor',
          D: 'D001',
        },
        {
          date: '2025-12-05',
          A1: 'Product',
          A2: 'Unboxing',
          B: 'Walk',
          C: 'Indoor',
          D: 'D001', // 重复
        },
      ];

      expect(() => namingService.batchGenerate(paramsList)).toThrow('生成的命名存在重复');
    });

    test('应处理空数组', () => {
      const results = namingService.batchGenerate([]);
      expect(results).toEqual([]);
    });
  });

  describe('parseName - 命名解析', () => {
    test('应正确解析标准格式的命名', () => {
      const name = '20251205_Product_Unboxing_Walk_Indoor_D001';
      const parsed = namingService.parseName(name);

      expect(parsed).toEqual({
        date: '2025-12-05',
        A1: 'Product',
        A2: 'Unboxing',
        B: 'Walk',
        C: 'Indoor',
        D: 'D001',
      });
    });

    test('应拒绝无效的日期格式', () => {
      const invalidNames = [
        'invalid_Product_Unboxing_Walk_Indoor_D001',
        '2025-12-05_Product_Unboxing_Walk_Indoor_D001', // 包含连字符
        '20251305_Product_Unboxing_Walk_Indoor_D001', // 无效月份
      ];

      invalidNames.forEach((name) => {
        expect(namingService.parseName(name)).toBeNull();
      });
    });

    test('应拒绝不完整的命名', () => {
      const incompleteName = '20251205_Product_Unboxing_Walk_Indoor'; // 缺少 D
      expect(namingService.parseName(incompleteName)).toBeNull();
    });

    test('应拒绝包含额外部分的命名', () => {
      const tooManyParts = '20251205_Product_Unboxing_Walk_Indoor_D001_Extra';
      expect(namingService.parseName(tooManyParts)).toBeNull();
    });

    test('应正确往返转换（生成 -> 解析 -> 生成）', () => {
      const originalParams: ABCDParams = {
        date: '2025-12-05',
        A1: 'Product',
        A2: 'Unboxing',
        B: 'Walk',
        C: 'Indoor',
        D: 'D001',
      };

      const name = namingService.generateName(originalParams);
      const parsed = namingService.parseName(name);
      const regenerated = parsed ? namingService.generateName(parsed) : null;

      expect(regenerated).toBe(name);
    });
  });

  describe('validateName - 命名验证', () => {
    test('应验证有效命名', () => {
      const validNames = [
        '20251205_Product_Unboxing_Walk_Indoor_D001',
        '20240229_Scene_Lifestyle_Sit_Outdoor_D999',
        '20251231_Audience_Senior_Stand_Studio_D100',
      ];

      validNames.forEach((name) => {
        expect(namingService.validateName(name)).toBe(true);
      });
    });

    test('应拒绝无效命名', () => {
      const invalidNames = [
        'InvalidFormat',
        '20251205_Product_Unboxing_Walk_Indoor', // 缺少部分
        'Product_Unboxing_Walk_Indoor_D001', // 缺少日期
        '2025-12-05_Product_Unboxing_Walk_Indoor_D001', // 日期格式错误
      ];

      invalidNames.forEach((name) => {
        expect(namingService.validateName(name)).toBe(false);
      });
    });
  });

  describe('边界情况和错误处理', () => {
    test('应处理极长的参数值', () => {
      const longParams: ABCDParams = {
        date: '2025-12-05',
        A1: 'A'.repeat(100),
        A2: 'B'.repeat(100),
        B: 'C'.repeat(100),
        C: 'D'.repeat(100),
        D: 'E'.repeat(100),
      };

      const result = namingService.generateName(longParams);
      expect(result).toContain('AAAA');
      expect(result.length).toBeGreaterThan(500);
    });

    test('应处理 Unicode 字符', () => {
      const unicodeParams: ABCDParams = {
        date: '2025-12-05',
        A1: 'Product中文',
        A2: 'Unboxing日本語',
        B: 'Walk한글',
        C: 'Indoor العربية',
        D: 'D001',
      };

      const result = namingService.generateName(unicodeParams);
      expect(result).toBeTruthy();
      // Unicode 字符会被替换为下划线
      expect(result).toMatch(/^20251205_Product__Unboxing/);
    });

    test('应处理空字符串参数', () => {
      const emptyParams = {
        date: '2025-12-05',
        A1: '',
        A2: 'Unboxing',
        B: 'Walk',
        C: 'Indoor',
        D: 'D001',
      };

      expect(() => namingService.generateName(emptyParams as ABCDParams)).toThrow();
    });

    test('应处理仅包含空格的参数', () => {
      const whitespaceParams = {
        date: '2025-12-05',
        A1: '   ',
        A2: 'Unboxing',
        B: 'Walk',
        C: 'Indoor',
        D: 'D001',
      };

      expect(() => namingService.generateName(whitespaceParams as ABCDParams)).toThrow();
    });
  });

  describe('性能测试', () => {
    test('单次生成应在 10ms 内完成', () => {
      const params: ABCDParams = {
        date: '2025-12-05',
        A1: 'Product',
        A2: 'Unboxing',
        B: 'Walk',
        C: 'Indoor',
        D: 'D001',
      };

      const startTime = Date.now();
      namingService.generateName(params);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(10);
    });

    test('批量生成 100 个命名应在 1s 内完成', () => {
      const paramsList: ABCDParams[] = Array.from({ length: 100 }, (_, i) => ({
        date: '2025-12-05',
        A1: 'Product',
        A2: 'Unboxing',
        B: 'Walk',
        C: 'Indoor',
        D: `D${String(i + 1).padStart(3, '0')}`,
      }));

      const startTime = Date.now();
      namingService.batchGenerate(paramsList);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000);
    });
  });
});

// 集成测试示例（需要实际 API）
describe('NamingService - 集成测试', () => {
  test.skip('应与数据库命名冲突检查集成', async () => {
    // 模拟数据库查询
    const namingService = new NamingService();
    const params: ABCDParams = {
      date: '2025-12-05',
      A1: 'Product',
      A2: 'Unboxing',
      B: 'Walk',
      C: 'Indoor',
      D: 'D001',
    };

    const name = namingService.generateName(params);

    // 假设有一个数据库检查函数
    // const exists = await checkNameExists(name);
    // expect(exists).toBe(false);
  });

  test.skip('应与文件系统命名冲突检查集成', async () => {
    // 模拟文件系统检查
    const namingService = new NamingService();
    const params: ABCDParams = {
      date: '2025-12-05',
      A1: 'Product',
      A2: 'Unboxing',
      B: 'Walk',
      C: 'Indoor',
      D: 'D001',
    };

    const name = namingService.generateName(params);

    // 假设有一个文件系统检查函数
    // const exists = await checkFileExists(`/uploads/${name}.jpg`);
    // expect(exists).toBe(false);
  });
});

export { NamingService };
