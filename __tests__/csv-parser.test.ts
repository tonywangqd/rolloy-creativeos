/**
 * CSV 解析器单元测试
 * 测试 Ad Name -> ABCD 参数提取 + 指标解析
 *
 * 输入格式: Ad Name, Spend, CPA, ROAS
 * 输出: { date, A1, A2, B, C, D, metrics: { spend, cpa, roas } }
 */

import { describe, test, expect, beforeEach } from '@jest/globals';

// 类型定义
interface ABCDParams {
  date: string;
  A1: string;
  A2: string;
  B: string;
  C: string;
  D: string;
}

interface AdMetrics {
  spend: number;
  cpa: number;
  roas: number;
  impressions?: number;
  clicks?: number;
  conversions?: number;
}

interface ParsedAd {
  adName: string;
  params: ABCDParams | null;
  metrics: AdMetrics;
  status: 'SUCCESS' | 'PARSE_ERROR' | 'VALIDATION_ERROR';
  errors: string[];
}

interface CSVRow {
  'Ad Name': string;
  Spend: string;
  CPA: string;
  ROAS: string;
  Impressions?: string;
  Clicks?: string;
  Conversions?: string;
}

// 模拟 CSV 解析服务实现
class CSVParserService {
  /**
   * 解析单行广告数据
   * @param row CSV 行数据
   * @returns 解析结果
   */
  parseAdRow(row: CSVRow): ParsedAd {
    const errors: string[] = [];
    let status: 'SUCCESS' | 'PARSE_ERROR' | 'VALIDATION_ERROR' = 'SUCCESS';

    // 解析 Ad Name -> ABCD 参数
    const params = this.parseAdName(row['Ad Name']);
    if (!params) {
      errors.push('无法解析 Ad Name 格式');
      status = 'PARSE_ERROR';
    }

    // 解析指标
    const metrics = this.parseMetrics(row);
    if (!this.validateMetrics(metrics)) {
      errors.push('指标数据无效');
      status = 'VALIDATION_ERROR';
    }

    return {
      adName: row['Ad Name'],
      params,
      metrics,
      status: errors.length > 0 ? status : 'SUCCESS',
      errors,
    };
  }

  /**
   * 从 Ad Name 中提取 ABCD 参数
   * @param adName 广告名称
   * @returns ABCD 参数或 null
   */
  parseAdName(adName: string): ABCDParams | null {
    if (!adName || typeof adName !== 'string') {
      return null;
    }

    // 清理输入
    const cleaned = adName.trim();
    const parts = cleaned.split('_');

    // 验证格式: YYYYMMDD_A1_A2_B_C_D
    if (parts.length !== 6) {
      return null;
    }

    const [dateStr, A1, A2, B, C, D] = parts;

    // 验证日期格式
    if (!/^\d{8}$/.test(dateStr)) {
      return null;
    }

    // 解析日期
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    const date = `${year}-${month}-${day}`;

    // 验证日期有效性
    if (!this.isValidDate(date)) {
      return null;
    }

    return { date, A1, A2, B, C, D };
  }

  /**
   * 解析广告指标
   * @param row CSV 行
   * @returns 指标对象
   */
  parseMetrics(row: CSVRow): AdMetrics {
    return {
      spend: this.parseNumber(row.Spend),
      cpa: this.parseNumber(row.CPA),
      roas: this.parseNumber(row.ROAS),
      impressions: row.Impressions ? this.parseNumber(row.Impressions) : undefined,
      clicks: row.Clicks ? this.parseNumber(row.Clicks) : undefined,
      conversions: row.Conversions ? this.parseNumber(row.Conversions) : undefined,
    };
  }

  /**
   * 批量解析 CSV 数据
   * @param rows CSV 行数组
   * @returns 解析结果数组
   */
  batchParse(rows: CSVRow[]): ParsedAd[] {
    return rows.map((row) => this.parseAdRow(row));
  }

  /**
   * 获取解析成功率
   * @param results 解析结果数组
   * @returns 成功率（0-1）
   */
  getSuccessRate(results: ParsedAd[]): number {
    if (results.length === 0) return 0;
    const successCount = results.filter((r) => r.status === 'SUCCESS').length;
    return successCount / results.length;
  }

  /**
   * 聚合解析结果
   * @param results 解析结果数组
   * @returns 聚合统计
   */
  aggregateResults(results: ParsedAd[]): {
    total: number;
    success: number;
    parseErrors: number;
    validationErrors: number;
    successRate: number;
  } {
    return {
      total: results.length,
      success: results.filter((r) => r.status === 'SUCCESS').length,
      parseErrors: results.filter((r) => r.status === 'PARSE_ERROR').length,
      validationErrors: results.filter((r) => r.status === 'VALIDATION_ERROR').length,
      successRate: this.getSuccessRate(results),
    };
  }

  /**
   * 去重处理
   * @param results 解析结果数组
   * @returns 去重后的数组
   */
  deduplicateResults(results: ParsedAd[]): ParsedAd[] {
    const seen = new Set<string>();
    return results.filter((result) => {
      if (seen.has(result.adName)) {
        return false;
      }
      seen.add(result.adName);
      return true;
    });
  }

  /**
   * 按 ABCD 参数分组
   * @param results 解析结果数组
   * @returns 分组结果
   */
  groupByParams(results: ParsedAd[]): Map<string, ParsedAd[]> {
    const groups = new Map<string, ParsedAd[]>();

    results.forEach((result) => {
      if (result.params) {
        const key = `${result.params.A1}_${result.params.B}`;
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key)!.push(result);
      }
    });

    return groups;
  }

  // 私有辅助方法
  private parseNumber(value: string): number {
    if (!value) return 0;

    // 移除货币符号和逗号
    const cleaned = value.replace(/[$,]/g, '').trim();
    const parsed = parseFloat(cleaned);

    return isNaN(parsed) ? 0 : parsed;
  }

  private isValidDate(dateStr: string): boolean {
    const date = new Date(dateStr);
    return date instanceof Date && !isNaN(date.getTime());
  }

  private validateMetrics(metrics: AdMetrics): boolean {
    // 验证指标范围
    if (metrics.spend < 0 || metrics.cpa < 0 || metrics.roas < 0) {
      return false;
    }

    // 验证 ROAS 逻辑（不能过高）
    if (metrics.roas > 100) {
      return false;
    }

    return true;
  }
}

// 测试套件
describe('CSVParserService - CSV 解析服务', () => {
  let parser: CSVParserService;

  beforeEach(() => {
    parser = new CSVParserService();
  });

  describe('parseAdName - Ad Name 解析', () => {
    test('应正确解析标准格式的 Ad Name', () => {
      const adName = '20251205_Product_Unboxing_Walk_Indoor_D001';
      const params = parser.parseAdName(adName);

      expect(params).toEqual({
        date: '2025-12-05',
        A1: 'Product',
        A2: 'Unboxing',
        B: 'Walk',
        C: 'Indoor',
        D: 'D001',
      });
    });

    test('应拒绝格式不标准的命名', () => {
      const invalidNames = [
        'InvalidFormat',
        '20251205_Product_Unboxing_Walk', // 缺少部分
        'Product_Unboxing_Walk_Indoor_D001', // 缺少日期
        '2025-12-05_Product_Unboxing_Walk_Indoor_D001', // 日期格式错误
      ];

      invalidNames.forEach((name) => {
        expect(parser.parseAdName(name)).toBeNull();
      });
    });

    test('应拒绝无效的日期', () => {
      const invalidDates = [
        '20251305_Product_Unboxing_Walk_Indoor_D001', // 月份无效
        '20250231_Product_Unboxing_Walk_Indoor_D001', // 日期无效
        '20250000_Product_Unboxing_Walk_Indoor_D001', // 日期为 0
      ];

      invalidDates.forEach((name) => {
        expect(parser.parseAdName(name)).toBeNull();
      });
    });

    test('应处理前后空格', () => {
      const adName = '  20251205_Product_Unboxing_Walk_Indoor_D001  ';
      const params = parser.parseAdName(adName);

      expect(params).not.toBeNull();
      expect(params?.A1).toBe('Product');
    });

    test('应拒绝空字符串', () => {
      expect(parser.parseAdName('')).toBeNull();
      expect(parser.parseAdName('   ')).toBeNull();
    });

    test('应拒绝 null 或 undefined', () => {
      expect(parser.parseAdName(null as any)).toBeNull();
      expect(parser.parseAdName(undefined as any)).toBeNull();
    });

    test('应处理闰年日期', () => {
      const leapYearName = '20240229_Product_Unboxing_Walk_Indoor_D001';
      const params = parser.parseAdName(leapYearName);

      expect(params).not.toBeNull();
      expect(params?.date).toBe('2024-02-29');
    });
  });

  describe('parseMetrics - 指标解析', () => {
    test('应正确解析标准指标', () => {
      const row: CSVRow = {
        'Ad Name': '20251205_Product_Unboxing_Walk_Indoor_D001',
        Spend: '1500.00',
        CPA: '25.50',
        ROAS: '3.20',
      };

      const metrics = parser.parseMetrics(row);

      expect(metrics.spend).toBe(1500);
      expect(metrics.cpa).toBe(25.5);
      expect(metrics.roas).toBe(3.2);
    });

    test('应处理货币符号', () => {
      const row: CSVRow = {
        'Ad Name': '20251205_Product_Unboxing_Walk_Indoor_D001',
        Spend: '$1,500.00',
        CPA: '$25.50',
        ROAS: '3.20',
      };

      const metrics = parser.parseMetrics(row);

      expect(metrics.spend).toBe(1500);
      expect(metrics.cpa).toBe(25.5);
    });

    test('应处理千位分隔符', () => {
      const row: CSVRow = {
        'Ad Name': '20251205_Product_Unboxing_Walk_Indoor_D001',
        Spend: '10,500.00',
        CPA: '1,025.50',
        ROAS: '3.20',
      };

      const metrics = parser.parseMetrics(row);

      expect(metrics.spend).toBe(10500);
      expect(metrics.cpa).toBe(1025.5);
    });

    test('应处理缺失值', () => {
      const row: CSVRow = {
        'Ad Name': '20251205_Product_Unboxing_Walk_Indoor_D001',
        Spend: '',
        CPA: '',
        ROAS: '3.20',
      };

      const metrics = parser.parseMetrics(row);

      expect(metrics.spend).toBe(0);
      expect(metrics.cpa).toBe(0);
      expect(metrics.roas).toBe(3.2);
    });

    test('应处理非数字值', () => {
      const row: CSVRow = {
        'Ad Name': '20251205_Product_Unboxing_Walk_Indoor_D001',
        Spend: 'N/A',
        CPA: 'Invalid',
        ROAS: 'Error',
      };

      const metrics = parser.parseMetrics(row);

      expect(metrics.spend).toBe(0);
      expect(metrics.cpa).toBe(0);
      expect(metrics.roas).toBe(0);
    });

    test('应解析可选指标', () => {
      const row: CSVRow = {
        'Ad Name': '20251205_Product_Unboxing_Walk_Indoor_D001',
        Spend: '1500.00',
        CPA: '25.50',
        ROAS: '3.20',
        Impressions: '10000',
        Clicks: '500',
        Conversions: '50',
      };

      const metrics = parser.parseMetrics(row);

      expect(metrics.impressions).toBe(10000);
      expect(metrics.clicks).toBe(500);
      expect(metrics.conversions).toBe(50);
    });
  });

  describe('parseAdRow - 完整行解析', () => {
    test('应成功解析有效行', () => {
      const row: CSVRow = {
        'Ad Name': '20251205_Product_Unboxing_Walk_Indoor_D001',
        Spend: '1500.00',
        CPA: '25.50',
        ROAS: '3.20',
      };

      const result = parser.parseAdRow(row);

      expect(result.status).toBe('SUCCESS');
      expect(result.errors).toHaveLength(0);
      expect(result.params).not.toBeNull();
      expect(result.metrics.spend).toBe(1500);
    });

    test('应标记 Ad Name 解析错误', () => {
      const row: CSVRow = {
        'Ad Name': 'InvalidFormat',
        Spend: '1500.00',
        CPA: '25.50',
        ROAS: '3.20',
      };

      const result = parser.parseAdRow(row);

      expect(result.status).toBe('PARSE_ERROR');
      expect(result.errors).toContain('无法解析 Ad Name 格式');
      expect(result.params).toBeNull();
    });

    test('应标记指标验证错误', () => {
      const row: CSVRow = {
        'Ad Name': '20251205_Product_Unboxing_Walk_Indoor_D001',
        Spend: '-1000.00', // 负值
        CPA: '25.50',
        ROAS: '3.20',
      };

      const result = parser.parseAdRow(row);

      expect(result.status).toBe('VALIDATION_ERROR');
      expect(result.errors).toContain('指标数据无效');
    });

    test('应标记异常高的 ROAS', () => {
      const row: CSVRow = {
        'Ad Name': '20251205_Product_Unboxing_Walk_Indoor_D001',
        Spend: '1500.00',
        CPA: '25.50',
        ROAS: '150.00', // 异常高
      };

      const result = parser.parseAdRow(row);

      expect(result.status).toBe('VALIDATION_ERROR');
    });
  });

  describe('batchParse - 批量解析', () => {
    test('应成功批量解析多行数据', () => {
      const rows: CSVRow[] = [
        {
          'Ad Name': '20251205_Product_Unboxing_Walk_Indoor_D001',
          Spend: '1500.00',
          CPA: '25.50',
          ROAS: '3.20',
        },
        {
          'Ad Name': '20251205_Scene_Lifestyle_Sit_Outdoor_D002',
          Spend: '2000.00',
          CPA: '30.00',
          ROAS: '2.80',
        },
        {
          'Ad Name': '20251206_Audience_Senior_Stand_Studio_D003',
          Spend: '1800.00',
          CPA: '28.00',
          ROAS: '3.00',
        },
      ];

      const results = parser.batchParse(rows);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.status === 'SUCCESS')).toBe(true);
    });

    test('应处理混合有效和无效数据', () => {
      const rows: CSVRow[] = [
        {
          'Ad Name': '20251205_Product_Unboxing_Walk_Indoor_D001',
          Spend: '1500.00',
          CPA: '25.50',
          ROAS: '3.20',
        },
        {
          'Ad Name': 'InvalidFormat',
          Spend: '2000.00',
          CPA: '30.00',
          ROAS: '2.80',
        },
      ];

      const results = parser.batchParse(rows);

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe('SUCCESS');
      expect(results[1].status).toBe('PARSE_ERROR');
    });

    test('应在 3 秒内处理 1000 行数据', () => {
      const rows: CSVRow[] = Array.from({ length: 1000 }, (_, i) => ({
        'Ad Name': `20251205_Product_Unboxing_Walk_Indoor_D${String(i + 1).padStart(3, '0')}`,
        Spend: '1500.00',
        CPA: '25.50',
        ROAS: '3.20',
      }));

      const startTime = Date.now();
      const results = parser.batchParse(rows);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(1000);
      expect(duration).toBeLessThan(3000);
    });

    test('应处理空数组', () => {
      const results = parser.batchParse([]);
      expect(results).toEqual([]);
    });
  });

  describe('getSuccessRate - 成功率计算', () => {
    test('应计算 100% 成功率', () => {
      const results: ParsedAd[] = [
        {
          adName: 'test1',
          params: {
            date: '2025-12-05',
            A1: 'Product',
            A2: 'Unboxing',
            B: 'Walk',
            C: 'Indoor',
            D: 'D001',
          },
          metrics: { spend: 1500, cpa: 25.5, roas: 3.2 },
          status: 'SUCCESS',
          errors: [],
        },
        {
          adName: 'test2',
          params: {
            date: '2025-12-05',
            A1: 'Scene',
            A2: 'Lifestyle',
            B: 'Sit',
            C: 'Outdoor',
            D: 'D002',
          },
          metrics: { spend: 2000, cpa: 30, roas: 2.8 },
          status: 'SUCCESS',
          errors: [],
        },
      ];

      const rate = parser.getSuccessRate(results);
      expect(rate).toBe(1.0);
    });

    test('应计算 50% 成功率', () => {
      const results: ParsedAd[] = [
        {
          adName: 'test1',
          params: {
            date: '2025-12-05',
            A1: 'Product',
            A2: 'Unboxing',
            B: 'Walk',
            C: 'Indoor',
            D: 'D001',
          },
          metrics: { spend: 1500, cpa: 25.5, roas: 3.2 },
          status: 'SUCCESS',
          errors: [],
        },
        {
          adName: 'test2',
          params: null,
          metrics: { spend: 2000, cpa: 30, roas: 2.8 },
          status: 'PARSE_ERROR',
          errors: ['无法解析 Ad Name 格式'],
        },
      ];

      const rate = parser.getSuccessRate(results);
      expect(rate).toBe(0.5);
    });

    test('应处理空结果', () => {
      const rate = parser.getSuccessRate([]);
      expect(rate).toBe(0);
    });
  });

  describe('aggregateResults - 结果聚合', () => {
    test('应生成完整的聚合统计', () => {
      const results: ParsedAd[] = [
        {
          adName: 'test1',
          params: {
            date: '2025-12-05',
            A1: 'Product',
            A2: 'Unboxing',
            B: 'Walk',
            C: 'Indoor',
            D: 'D001',
          },
          metrics: { spend: 1500, cpa: 25.5, roas: 3.2 },
          status: 'SUCCESS',
          errors: [],
        },
        {
          adName: 'test2',
          params: null,
          metrics: { spend: 2000, cpa: 30, roas: 2.8 },
          status: 'PARSE_ERROR',
          errors: ['无法解析 Ad Name 格式'],
        },
        {
          adName: 'test3',
          params: {
            date: '2025-12-05',
            A1: 'Product',
            A2: 'Unboxing',
            B: 'Walk',
            C: 'Indoor',
            D: 'D001',
          },
          metrics: { spend: -1000, cpa: 25.5, roas: 3.2 },
          status: 'VALIDATION_ERROR',
          errors: ['指标数据无效'],
        },
      ];

      const stats = parser.aggregateResults(results);

      expect(stats.total).toBe(3);
      expect(stats.success).toBe(1);
      expect(stats.parseErrors).toBe(1);
      expect(stats.validationErrors).toBe(1);
      expect(stats.successRate).toBeCloseTo(0.333, 2);
    });
  });

  describe('deduplicateResults - 去重', () => {
    test('应移除重复的 Ad Name', () => {
      const results: ParsedAd[] = [
        {
          adName: '20251205_Product_Unboxing_Walk_Indoor_D001',
          params: {
            date: '2025-12-05',
            A1: 'Product',
            A2: 'Unboxing',
            B: 'Walk',
            C: 'Indoor',
            D: 'D001',
          },
          metrics: { spend: 1500, cpa: 25.5, roas: 3.2 },
          status: 'SUCCESS',
          errors: [],
        },
        {
          adName: '20251205_Product_Unboxing_Walk_Indoor_D001', // 重复
          params: {
            date: '2025-12-05',
            A1: 'Product',
            A2: 'Unboxing',
            B: 'Walk',
            C: 'Indoor',
            D: 'D001',
          },
          metrics: { spend: 2000, cpa: 30, roas: 2.8 },
          status: 'SUCCESS',
          errors: [],
        },
        {
          adName: '20251205_Scene_Lifestyle_Sit_Outdoor_D002',
          params: {
            date: '2025-12-05',
            A1: 'Scene',
            A2: 'Lifestyle',
            B: 'Sit',
            C: 'Outdoor',
            D: 'D002',
          },
          metrics: { spend: 1800, cpa: 28, roas: 3.0 },
          status: 'SUCCESS',
          errors: [],
        },
      ];

      const deduplicated = parser.deduplicateResults(results);

      expect(deduplicated).toHaveLength(2);
      expect(deduplicated[0].adName).toBe('20251205_Product_Unboxing_Walk_Indoor_D001');
      expect(deduplicated[1].adName).toBe('20251205_Scene_Lifestyle_Sit_Outdoor_D002');
    });

    test('应保留第一个出现的记录', () => {
      const results: ParsedAd[] = [
        {
          adName: 'test',
          params: null,
          metrics: { spend: 1500, cpa: 25.5, roas: 3.2 },
          status: 'SUCCESS',
          errors: [],
        },
        {
          adName: 'test',
          params: null,
          metrics: { spend: 2000, cpa: 30, roas: 2.8 },
          status: 'SUCCESS',
          errors: [],
        },
      ];

      const deduplicated = parser.deduplicateResults(results);

      expect(deduplicated).toHaveLength(1);
      expect(deduplicated[0].metrics.spend).toBe(1500); // 第一个记录
    });
  });

  describe('groupByParams - 参数分组', () => {
    test('应按 A1 和 B 参数分组', () => {
      const results: ParsedAd[] = [
        {
          adName: 'test1',
          params: {
            date: '2025-12-05',
            A1: 'Product',
            A2: 'Unboxing',
            B: 'Walk',
            C: 'Indoor',
            D: 'D001',
          },
          metrics: { spend: 1500, cpa: 25.5, roas: 3.2 },
          status: 'SUCCESS',
          errors: [],
        },
        {
          adName: 'test2',
          params: {
            date: '2025-12-05',
            A1: 'Product',
            A2: 'Unboxing',
            B: 'Walk',
            C: 'Outdoor',
            D: 'D002',
          },
          metrics: { spend: 2000, cpa: 30, roas: 2.8 },
          status: 'SUCCESS',
          errors: [],
        },
        {
          adName: 'test3',
          params: {
            date: '2025-12-05',
            A1: 'Scene',
            A2: 'Lifestyle',
            B: 'Sit',
            C: 'Indoor',
            D: 'D003',
          },
          metrics: { spend: 1800, cpa: 28, roas: 3.0 },
          status: 'SUCCESS',
          errors: [],
        },
      ];

      const groups = parser.groupByParams(results);

      expect(groups.size).toBe(2);
      expect(groups.get('Product_Walk')).toHaveLength(2);
      expect(groups.get('Scene_Sit')).toHaveLength(1);
    });

    test('应忽略解析失败的记录', () => {
      const results: ParsedAd[] = [
        {
          adName: 'test1',
          params: {
            date: '2025-12-05',
            A1: 'Product',
            A2: 'Unboxing',
            B: 'Walk',
            C: 'Indoor',
            D: 'D001',
          },
          metrics: { spend: 1500, cpa: 25.5, roas: 3.2 },
          status: 'SUCCESS',
          errors: [],
        },
        {
          adName: 'test2',
          params: null,
          metrics: { spend: 2000, cpa: 30, roas: 2.8 },
          status: 'PARSE_ERROR',
          errors: ['无法解析 Ad Name 格式'],
        },
      ];

      const groups = parser.groupByParams(results);

      expect(groups.size).toBe(1);
      expect(groups.get('Product_Walk')).toHaveLength(1);
    });
  });

  describe('边界情况和错误处理', () => {
    test('应处理极长的 Ad Name', () => {
      const longAdName = 'A'.repeat(1000);
      const params = parser.parseAdName(longAdName);
      expect(params).toBeNull();
    });

    test('应处理 Unicode 字符', () => {
      const unicodeAdName = '20251205_产品_开箱_Walk_Indoor_D001';
      const params = parser.parseAdName(unicodeAdName);
      expect(params).not.toBeNull(); // Unicode 应被接受
    });

    test('应处理极大的数值', () => {
      const row: CSVRow = {
        'Ad Name': '20251205_Product_Unboxing_Walk_Indoor_D001',
        Spend: '999999999999.99',
        CPA: '999999.99',
        ROAS: '99.99',
      };

      const metrics = parser.parseMetrics(row);
      expect(metrics.spend).toBeGreaterThan(0);
    });

    test('应处理小数精度', () => {
      const row: CSVRow = {
        'Ad Name': '20251205_Product_Unboxing_Walk_Indoor_D001',
        Spend: '1500.123456',
        CPA: '25.9999',
        ROAS: '3.14159',
      };

      const metrics = parser.parseMetrics(row);
      expect(metrics.spend).toBeCloseTo(1500.123456, 2);
      expect(metrics.cpa).toBeCloseTo(25.9999, 2);
      expect(metrics.roas).toBeCloseTo(3.14159, 2);
    });
  });

  describe('性能测试', () => {
    test('单行解析应在 10ms 内完成', () => {
      const row: CSVRow = {
        'Ad Name': '20251205_Product_Unboxing_Walk_Indoor_D001',
        Spend: '1500.00',
        CPA: '25.50',
        ROAS: '3.20',
      };

      const startTime = Date.now();
      parser.parseAdRow(row);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(10);
    });

    test('批量解析 1000 行应保持高成功率', () => {
      const rows: CSVRow[] = Array.from({ length: 1000 }, (_, i) => ({
        'Ad Name': `20251205_Product_Unboxing_Walk_Indoor_D${String(i + 1).padStart(3, '0')}`,
        Spend: '1500.00',
        CPA: '25.50',
        ROAS: '3.20',
      }));

      const results = parser.batchParse(rows);
      const successRate = parser.getSuccessRate(results);

      expect(successRate).toBeGreaterThan(0.95); // > 95% 成功率
    });
  });
});

// 集成测试示例
describe('CSVParserService - 集成测试', () => {
  test.skip('应与文件上传集成', async () => {
    const parser = new CSVParserService();

    // 模拟文件上传和解析流程
    // const file = await uploadCSVFile('test.csv');
    // const rows = await parseCSVFile(file);
    // const results = parser.batchParse(rows);

    // expect(results.length).toBeGreaterThan(0);
  });

  test.skip('应与数据库导入集成', async () => {
    const parser = new CSVParserService();

    // 模拟数据库导入
    // const rows = await fetchCSVData();
    // const results = parser.batchParse(rows);
    // const successfulResults = results.filter(r => r.status === 'SUCCESS');
    // await saveToDatabase(successfulResults);
  });

  test.skip('应与分析仪表盘集成', async () => {
    const parser = new CSVParserService();

    // 模拟分析流程
    // const rows = await fetchCSVData();
    // const results = parser.batchParse(rows);
    // const groups = parser.groupByParams(results);
    // const analytics = calculateAnalytics(groups);
    // expect(analytics).toHaveProperty('totalSpend');
  });
});

export { CSVParserService, type ParsedAd, type ABCDParams, type AdMetrics };
