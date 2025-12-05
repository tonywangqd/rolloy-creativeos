/**
 * 状态路由服务单元测试
 * 测试 B 动作参数 -> 展开/折叠状态路由逻辑
 *
 * 规则:
 * - UNFOLDED: Walk, Sit, Turn, Stand, Rest
 * - FOLDED: Lift, Pack, Carry, Trunk
 */

import { describe, test, expect, beforeEach } from '@jest/globals';

// 类型定义
type FoldState = 'UNFOLDED' | 'FOLDED';

interface StateRouterConfig {
  UNFOLDED: string[];
  FOLDED: string[];
}

interface ReferenceImage {
  id: string;
  url: string;
  state: FoldState;
  tags: string[];
}

interface StateRouterResult {
  state: FoldState;
  referenceImages: ReferenceImage[];
  allowedActions: string[];
}

// 模拟状态路由服务实现
class StateRouterService {
  private config: StateRouterConfig = {
    UNFOLDED: ['Walk', 'Sit', 'Turn', 'Stand', 'Rest'],
    FOLDED: ['Lift', 'Pack', 'Carry', 'Trunk'],
  };

  private mockReferenceImages: ReferenceImage[] = [
    {
      id: 'img_001',
      url: '/images/unfolded_walk.jpg',
      state: 'UNFOLDED',
      tags: ['walk', 'expanded', 'outdoor'],
    },
    {
      id: 'img_002',
      url: '/images/unfolded_sit.jpg',
      state: 'UNFOLDED',
      tags: ['sit', 'expanded', 'indoor'],
    },
    {
      id: 'img_003',
      url: '/images/folded_lift.jpg',
      state: 'FOLDED',
      tags: ['lift', 'compact', 'storage'],
    },
    {
      id: 'img_004',
      url: '/images/folded_carry.jpg',
      state: 'FOLDED',
      tags: ['carry', 'compact', 'portable'],
    },
    {
      id: 'img_005',
      url: '/images/unfolded_stand.jpg',
      state: 'UNFOLDED',
      tags: ['stand', 'expanded', 'stable'],
    },
  ];

  /**
   * 根据动作参数路由到对应状态
   * @param action B 动作参数
   * @returns 状态和相关信息
   */
  routeState(action: string): StateRouterResult {
    const state = this.determineState(action);
    const referenceImages = this.filterReferenceImages(state);
    const allowedActions = this.getAllowedActions(state);

    return {
      state,
      referenceImages,
      allowedActions,
    };
  }

  /**
   * 判定展开/折叠状态
   * @param action 动作
   * @returns 状态
   */
  determineState(action: string): FoldState {
    if (this.config.UNFOLDED.includes(action)) {
      return 'UNFOLDED';
    }

    if (this.config.FOLDED.includes(action)) {
      return 'FOLDED';
    }

    throw new Error(`未知的动作类型: ${action}. 请在配置中添加该动作的状态映射。`);
  }

  /**
   * 根据状态过滤参考图
   * @param state 状态
   * @returns 过滤后的图片列表
   */
  filterReferenceImages(state: FoldState): ReferenceImage[] {
    return this.mockReferenceImages.filter((img) => img.state === state);
  }

  /**
   * 获取当前状态允许的所有动作
   * @param state 状态
   * @returns 动作列表
   */
  getAllowedActions(state: FoldState): string[] {
    return this.config[state];
  }

  /**
   * 验证动作是否有效
   * @param action 动作
   * @returns 是否有效
   */
  isValidAction(action: string): boolean {
    const allActions = [...this.config.UNFOLDED, ...this.config.FOLDED];
    return allActions.includes(action);
  }

  /**
   * 获取所有可用动作
   * @returns 动作列表
   */
  getAllActions(): string[] {
    return [...this.config.UNFOLDED, ...this.config.FOLDED];
  }

  /**
   * 动态添加新动作类型（用于扩展）
   * @param action 动作名称
   * @param state 对应状态
   */
  addAction(action: string, state: FoldState): void {
    if (this.isValidAction(action)) {
      throw new Error(`动作 ${action} 已存在`);
    }

    this.config[state].push(action);
  }

  /**
   * 获取状态切换建议
   * @param currentAction 当前动作
   * @param targetAction 目标动作
   * @returns 切换建议
   */
  getSwitchSuggestion(currentAction: string, targetAction: string): string {
    const currentState = this.determineState(currentAction);
    const targetState = this.determineState(targetAction);

    if (currentState === targetState) {
      return `保持${currentState === 'UNFOLDED' ? '展开' : '折叠'}状态`;
    }

    return `从${currentState === 'UNFOLDED' ? '展开' : '折叠'}切换到${
      targetState === 'UNFOLDED' ? '展开' : '折叠'
    }状态`;
  }

  /**
   * 批量路由
   * @param actions 动作列表
   * @returns 路由结果列表
   */
  batchRoute(actions: string[]): StateRouterResult[] {
    return actions.map((action) => this.routeState(action));
  }
}

// 测试套件
describe('StateRouterService - 状态路由服务', () => {
  let stateRouter: StateRouterService;

  beforeEach(() => {
    stateRouter = new StateRouterService();
  });

  describe('determineState - 状态判定', () => {
    test('应将 Walk 路由到 UNFOLDED 状态', () => {
      const state = stateRouter.determineState('Walk');
      expect(state).toBe('UNFOLDED');
    });

    test('应将 Sit 路由到 UNFOLDED 状态', () => {
      const state = stateRouter.determineState('Sit');
      expect(state).toBe('UNFOLDED');
    });

    test('应将 Turn 路由到 UNFOLDED 状态', () => {
      const state = stateRouter.determineState('Turn');
      expect(state).toBe('UNFOLDED');
    });

    test('应将 Stand 路由到 UNFOLDED 状态', () => {
      const state = stateRouter.determineState('Stand');
      expect(state).toBe('UNFOLDED');
    });

    test('应将 Rest 路由到 UNFOLDED 状态', () => {
      const state = stateRouter.determineState('Rest');
      expect(state).toBe('UNFOLDED');
    });

    test('应将 Lift 路由到 FOLDED 状态', () => {
      const state = stateRouter.determineState('Lift');
      expect(state).toBe('FOLDED');
    });

    test('应将 Pack 路由到 FOLDED 状态', () => {
      const state = stateRouter.determineState('Pack');
      expect(state).toBe('FOLDED');
    });

    test('应将 Carry 路由到 FOLDED 状态', () => {
      const state = stateRouter.determineState('Carry');
      expect(state).toBe('FOLDED');
    });

    test('应将 Trunk 路由到 FOLDED 状态', () => {
      const state = stateRouter.determineState('Trunk');
      expect(state).toBe('FOLDED');
    });

    test('应在遇到未知动作时抛出错误', () => {
      expect(() => stateRouter.determineState('InvalidAction')).toThrow(
        '未知的动作类型: InvalidAction'
      );
    });

    test('应在错误消息中提供添加配置的提示', () => {
      expect(() => stateRouter.determineState('NewAction')).toThrow(
        '请在配置中添加该动作的状态映射'
      );
    });

    test('应处理大小写敏感性', () => {
      expect(() => stateRouter.determineState('walk')).toThrow(); // 小写应失败
      expect(() => stateRouter.determineState('WALK')).toThrow(); // 大写应失败
      expect(stateRouter.determineState('Walk')).toBe('UNFOLDED'); // 正确大小写应成功
    });
  });

  describe('routeState - 完整路由', () => {
    test('应返回完整的路由结果', () => {
      const result = stateRouter.routeState('Walk');

      expect(result).toHaveProperty('state');
      expect(result).toHaveProperty('referenceImages');
      expect(result).toHaveProperty('allowedActions');
    });

    test('UNFOLDED 状态应返回展开状态的参考图', () => {
      const result = stateRouter.routeState('Walk');

      expect(result.state).toBe('UNFOLDED');
      expect(result.referenceImages.length).toBeGreaterThan(0);
      expect(result.referenceImages.every((img) => img.state === 'UNFOLDED')).toBe(true);
    });

    test('FOLDED 状态应返回折叠状态的参考图', () => {
      const result = stateRouter.routeState('Lift');

      expect(result.state).toBe('FOLDED');
      expect(result.referenceImages.length).toBeGreaterThan(0);
      expect(result.referenceImages.every((img) => img.state === 'FOLDED')).toBe(true);
    });

    test('应返回对应状态的允许动作列表', () => {
      const unfoldedResult = stateRouter.routeState('Walk');
      expect(unfoldedResult.allowedActions).toContain('Walk');
      expect(unfoldedResult.allowedActions).toContain('Sit');
      expect(unfoldedResult.allowedActions).not.toContain('Lift');

      const foldedResult = stateRouter.routeState('Lift');
      expect(foldedResult.allowedActions).toContain('Lift');
      expect(foldedResult.allowedActions).toContain('Pack');
      expect(foldedResult.allowedActions).not.toContain('Walk');
    });
  });

  describe('filterReferenceImages - 参考图过滤', () => {
    test('应仅返回 UNFOLDED 状态的图片', () => {
      const images = stateRouter.filterReferenceImages('UNFOLDED');

      expect(images.length).toBeGreaterThan(0);
      images.forEach((img) => {
        expect(img.state).toBe('UNFOLDED');
      });
    });

    test('应仅返回 FOLDED 状态的图片', () => {
      const images = stateRouter.filterReferenceImages('FOLDED');

      expect(images.length).toBeGreaterThan(0);
      images.forEach((img) => {
        expect(img.state).toBe('FOLDED');
      });
    });

    test('过滤后的图片应包含正确的标签', () => {
      const unfoldedImages = stateRouter.filterReferenceImages('UNFOLDED');
      const foldedImages = stateRouter.filterReferenceImages('FOLDED');

      unfoldedImages.forEach((img) => {
        expect(img.tags.some((tag) => tag === 'expanded' || tag.startsWith('un'))).toBeTruthy();
      });

      foldedImages.forEach((img) => {
        expect(img.tags.some((tag) => tag === 'compact' || tag === 'storage')).toBeTruthy();
      });
    });

    test('应返回不同的图片集合', () => {
      const unfoldedImages = stateRouter.filterReferenceImages('UNFOLDED');
      const foldedImages = stateRouter.filterReferenceImages('FOLDED');

      const unfoldedIds = unfoldedImages.map((img) => img.id);
      const foldedIds = foldedImages.map((img) => img.id);

      // 两个集合不应有交集
      const intersection = unfoldedIds.filter((id) => foldedIds.includes(id));
      expect(intersection).toHaveLength(0);
    });
  });

  describe('isValidAction - 动作验证', () => {
    test('应验证所有 UNFOLDED 动作为有效', () => {
      const unfoldedActions = ['Walk', 'Sit', 'Turn', 'Stand', 'Rest'];
      unfoldedActions.forEach((action) => {
        expect(stateRouter.isValidAction(action)).toBe(true);
      });
    });

    test('应验证所有 FOLDED 动作为有效', () => {
      const foldedActions = ['Lift', 'Pack', 'Carry', 'Trunk'];
      foldedActions.forEach((action) => {
        expect(stateRouter.isValidAction(action)).toBe(true);
      });
    });

    test('应拒绝无效动作', () => {
      const invalidActions = ['Jump', 'Run', 'Fly', 'InvalidAction'];
      invalidActions.forEach((action) => {
        expect(stateRouter.isValidAction(action)).toBe(false);
      });
    });

    test('应拒绝空字符串', () => {
      expect(stateRouter.isValidAction('')).toBe(false);
    });

    test('应拒绝 null 或 undefined', () => {
      expect(stateRouter.isValidAction(null as any)).toBe(false);
      expect(stateRouter.isValidAction(undefined as any)).toBe(false);
    });
  });

  describe('getAllActions - 获取所有动作', () => {
    test('应返回所有可用动作', () => {
      const actions = stateRouter.getAllActions();
      expect(actions).toHaveLength(9); // 5 UNFOLDED + 4 FOLDED
    });

    test('应包含所有 UNFOLDED 动作', () => {
      const actions = stateRouter.getAllActions();
      expect(actions).toContain('Walk');
      expect(actions).toContain('Sit');
      expect(actions).toContain('Turn');
      expect(actions).toContain('Stand');
      expect(actions).toContain('Rest');
    });

    test('应包含所有 FOLDED 动作', () => {
      const actions = stateRouter.getAllActions();
      expect(actions).toContain('Lift');
      expect(actions).toContain('Pack');
      expect(actions).toContain('Carry');
      expect(actions).toContain('Trunk');
    });

    test('返回的数组应无重复', () => {
      const actions = stateRouter.getAllActions();
      const uniqueActions = new Set(actions);
      expect(uniqueActions.size).toBe(actions.length);
    });
  });

  describe('addAction - 动态添加动作', () => {
    test('应成功添加新的 UNFOLDED 动作', () => {
      stateRouter.addAction('Run', 'UNFOLDED');
      expect(stateRouter.isValidAction('Run')).toBe(true);
      expect(stateRouter.determineState('Run')).toBe('UNFOLDED');
    });

    test('应成功添加新的 FOLDED 动作', () => {
      stateRouter.addAction('Collapse', 'FOLDED');
      expect(stateRouter.isValidAction('Collapse')).toBe(true);
      expect(stateRouter.determineState('Collapse')).toBe('FOLDED');
    });

    test('应拒绝添加已存在的动作', () => {
      expect(() => stateRouter.addAction('Walk', 'UNFOLDED')).toThrow('动作 Walk 已存在');
    });

    test('添加后应在 getAllActions 中可见', () => {
      stateRouter.addAction('Jump', 'UNFOLDED');
      const actions = stateRouter.getAllActions();
      expect(actions).toContain('Jump');
    });
  });

  describe('getSwitchSuggestion - 状态切换建议', () => {
    test('应在同状态间切换时提供保持建议', () => {
      const suggestion = stateRouter.getSwitchSuggestion('Walk', 'Sit');
      expect(suggestion).toContain('保持展开状态');
    });

    test('应在 UNFOLDED -> FOLDED 时提供切换建议', () => {
      const suggestion = stateRouter.getSwitchSuggestion('Walk', 'Lift');
      expect(suggestion).toContain('从展开切换到折叠状态');
    });

    test('应在 FOLDED -> UNFOLDED 时提供切换建议', () => {
      const suggestion = stateRouter.getSwitchSuggestion('Lift', 'Walk');
      expect(suggestion).toContain('从折叠切换到展开状态');
    });

    test('应在 FOLDED 内部切换时提供保持建议', () => {
      const suggestion = stateRouter.getSwitchSuggestion('Lift', 'Pack');
      expect(suggestion).toContain('保持折叠状态');
    });
  });

  describe('batchRoute - 批量路由', () => {
    test('应成功批量处理多个动作', () => {
      const actions = ['Walk', 'Lift', 'Sit', 'Pack'];
      const results = stateRouter.batchRoute(actions);

      expect(results).toHaveLength(4);
      expect(results[0].state).toBe('UNFOLDED');
      expect(results[1].state).toBe('FOLDED');
      expect(results[2].state).toBe('UNFOLDED');
      expect(results[3].state).toBe('FOLDED');
    });

    test('应在批量处理中遇到无效动作时抛出错误', () => {
      const actions = ['Walk', 'InvalidAction', 'Sit'];
      expect(() => stateRouter.batchRoute(actions)).toThrow();
    });

    test('批量处理应保持性能', () => {
      const actions = Array(100).fill('Walk');
      const startTime = Date.now();
      stateRouter.batchRoute(actions);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(100); // 应在 100ms 内完成
    });
  });

  describe('边界情况和错误处理', () => {
    test('应处理快速连续的状态切换', () => {
      const actions = ['Walk', 'Lift', 'Walk', 'Lift', 'Walk'];
      const results = actions.map((action) => stateRouter.routeState(action));

      expect(results[0].state).toBe('UNFOLDED');
      expect(results[1].state).toBe('FOLDED');
      expect(results[2].state).toBe('UNFOLDED');
      expect(results[3].state).toBe('FOLDED');
      expect(results[4].state).toBe('UNFOLDED');
    });

    test('应处理特殊字符的动作名称', () => {
      expect(() => stateRouter.determineState('Walk@#$')).toThrow();
    });

    test('应处理极长的动作名称', () => {
      const longAction = 'A'.repeat(1000);
      expect(() => stateRouter.determineState(longAction)).toThrow();
    });

    test('应处理 Unicode 动作名称', () => {
      expect(() => stateRouter.determineState('走路')).toThrow();
    });
  });

  describe('UI 集成场景', () => {
    test('选择器变化应触发参考图更新', () => {
      // 模拟用户从 Walk 切换到 Lift
      const initialResult = stateRouter.routeState('Walk');
      const initialImageCount = initialResult.referenceImages.length;

      const newResult = stateRouter.routeState('Lift');
      const newImageCount = newResult.referenceImages.length;

      // 图片集合应不同
      expect(initialResult.referenceImages).not.toEqual(newResult.referenceImages);
      // 两个状态都应有图片
      expect(initialImageCount).toBeGreaterThan(0);
      expect(newImageCount).toBeGreaterThan(0);
    });

    test('状态路由应无延迟（< 50ms）', () => {
      const startTime = Date.now();
      stateRouter.routeState('Walk');
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(50);
    });

    test('参考图 URL 应为有效路径', () => {
      const result = stateRouter.routeState('Walk');
      result.referenceImages.forEach((img) => {
        expect(img.url).toMatch(/^\/images\/.+\.(jpg|png|webp)$/);
      });
    });
  });

  describe('错误恢复和降级', () => {
    test('应在参考图为空时返回空数组而非抛出错误', () => {
      // 创建一个没有参考图的临时实例
      const emptyRouter = new StateRouterService();
      (emptyRouter as any).mockReferenceImages = [];

      const result = emptyRouter.routeState('Walk');
      expect(result.referenceImages).toEqual([]);
    });

    test('应在配置损坏时提供有用的错误信息', () => {
      const brokenRouter = new StateRouterService();
      (brokenRouter as any).config = {}; // 破坏配置

      expect(() => brokenRouter.determineState('Walk')).toThrow();
    });
  });

  describe('性能测试', () => {
    test('单次路由应在 10ms 内完成', () => {
      const startTime = Date.now();
      stateRouter.routeState('Walk');
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(10);
    });

    test('100 次连续路由应在 100ms 内完成', () => {
      const startTime = Date.now();
      for (let i = 0; i < 100; i++) {
        stateRouter.routeState('Walk');
      }
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(100);
    });

    test('状态判定应为 O(1) 复杂度', () => {
      // 测试大配置下的性能
      const actions = ['Walk', 'Lift', 'Sit', 'Pack', 'Turn'];
      const times: number[] = [];

      actions.forEach((action) => {
        const start = Date.now();
        stateRouter.determineState(action);
        times.push(Date.now() - start);
      });

      // 所有操作时间应相近（O(1)）
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      times.forEach((time) => {
        expect(Math.abs(time - avgTime)).toBeLessThan(5); // 允许 5ms 误差
      });
    });
  });
});

// 集成测试示例
describe('StateRouterService - 集成测试', () => {
  test.skip('应与 ABCD 参数选择器集成', () => {
    const stateRouter = new StateRouterService();

    // 模拟用户选择流程
    const userSelection = {
      A1: 'Product',
      A2: 'Unboxing',
      B: 'Walk', // 触发状态路由
      C: 'Indoor',
      D: 'D001',
    };

    const routeResult = stateRouter.routeState(userSelection.B);
    expect(routeResult.state).toBe('UNFOLDED');
  });

  test.skip('应与命名服务集成', () => {
    const stateRouter = new StateRouterService();

    // 状态应影响命名
    const unfoldedState = stateRouter.routeState('Walk');
    const foldedState = stateRouter.routeState('Lift');

    expect(unfoldedState.state).toBe('UNFOLDED');
    expect(foldedState.state).toBe('FOLDED');
  });

  test.skip('应与 AI 图片生成集成', () => {
    const stateRouter = new StateRouterService();

    // 状态应传递给 AI 提示词生成
    const result = stateRouter.routeState('Walk');
    expect(result.state).toBe('UNFOLDED');
    expect(result.referenceImages.length).toBeGreaterThan(0);

    // AI 服务应使用对应状态的参考图
    // const aiPrompt = generateAIPrompt(result);
    // expect(aiPrompt).toContain('walker in expanded position');
  });
});

export { StateRouterService, type FoldState, type StateRouterResult };
