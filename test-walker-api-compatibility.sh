#!/bin/bash

# Walker API 兼容性测试脚本
# 用于验证 Sessions API 是否支持 Walker 产品状态

set -e

echo "=================================================="
echo "Walker API 兼容性测试"
echo "=================================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# API 基础 URL (默认本地开发环境)
BASE_URL="${API_BASE_URL:-http://localhost:3000}"

echo "测试环境: $BASE_URL"
echo ""

# 测试 1: Walker 状态 - IN_USE
echo "测试 1: 创建 Walker Session (IN_USE 状态)"
echo "----------------------------------------------------"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/sessions" \
  -H "Content-Type: application/json" \
  -d '{
    "creative_name": "Test Walker IN_USE",
    "abcd_selection": {
      "A1": "outdoor",
      "A2": "park",
      "B": "walking",
      "C": "independence",
      "D": "carousel"
    },
    "prompt": "A senior man walking confidently with a standard walker in a park",
    "product_state": "IN_USE",
    "reference_image_url": "https://example.com/walker-in-use.jpg",
    "total_images": 20
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 201 ]; then
  echo -e "${GREEN}✅ PASS${NC}: Walker IN_USE 状态被接受"
  echo "Response: $BODY"
  SESSION_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo "Session ID: $SESSION_ID"
else
  echo -e "${RED}❌ FAIL${NC}: Walker IN_USE 状态被拒绝 (HTTP $HTTP_CODE)"
  echo "Response: $BODY"

  # 检查错误消息
  if echo "$BODY" | grep -q "must be FOLDED or UNFOLDED"; then
    echo -e "${RED}🔴 CRITICAL${NC}: Sessions API 硬编码了 Rollator 状态验证"
    echo ""
    echo "修复建议:"
    echo "1. 修改 /app/api/sessions/route.ts:64-75"
    echo "2. 移除硬编码的状态验证或添加产品类型支持"
    echo "3. 参考 QA_EXECUTIVE_SUMMARY.md 中的修复方案"
  fi
fi

echo ""
echo ""

# 测试 2: Walker 状态 - STORED
echo "测试 2: 创建 Walker Session (STORED 状态)"
echo "----------------------------------------------------"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/sessions" \
  -H "Content-Type: application/json" \
  -d '{
    "creative_name": "Test Walker STORED",
    "abcd_selection": {
      "A1": "indoor",
      "A2": "home",
      "B": "standing_still",
      "C": "safety",
      "D": "single_image"
    },
    "prompt": "A standard walker stored neatly against the wall",
    "product_state": "STORED",
    "reference_image_url": "https://example.com/walker-stored.jpg",
    "total_images": 20
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 201 ]; then
  echo -e "${GREEN}✅ PASS${NC}: Walker STORED 状态被接受"
  echo "Response: $BODY"
else
  echo -e "${RED}❌ FAIL${NC}: Walker STORED 状态被拒绝 (HTTP $HTTP_CODE)"
  echo "Response: $BODY"
fi

echo ""
echo ""

# 测试 3: Rollator 状态 (应该仍然有效)
echo "测试 3: 创建 Rollator Session (FOLDED 状态 - 兼容性测试)"
echo "----------------------------------------------------"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/sessions" \
  -H "Content-Type: application/json" \
  -d '{
    "creative_name": "Test Rollator FOLDED",
    "abcd_selection": {
      "A1": "indoor",
      "A2": "home",
      "B": "standing_still",
      "C": "convenience",
      "D": "single_image"
    },
    "prompt": "A folded rollator stored in a closet",
    "product_state": "FOLDED",
    "reference_image_url": "https://example.com/rollator-folded.jpg",
    "total_images": 20
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 201 ]; then
  echo -e "${GREEN}✅ PASS${NC}: Rollator FOLDED 状态仍然有效"
  echo "Response: $BODY"
else
  echo -e "${RED}❌ FAIL${NC}: Rollator FOLDED 状态被拒绝 (HTTP $HTTP_CODE)"
  echo "Response: $BODY"
fi

echo ""
echo ""

# 测试 4: Walker Prompt 生成 API
echo "测试 4: Walker Prompt 生成 API"
echo "----------------------------------------------------"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/walker/generate-prompt" \
  -H "Content-Type: application/json" \
  -d '{
    "selection": {
      "A1": "outdoor",
      "A2": "park",
      "B": "walking",
      "C": "independence",
      "D": "carousel"
    }
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ]; then
  echo -e "${GREEN}✅ PASS${NC}: Walker Prompt 生成 API 正常工作"

  # 检查返回的 walkerState
  WALKER_STATE=$(echo "$BODY" | grep -o '"walkerState":"[^"]*"' | cut -d'"' -f4)
  echo "Walker State: $WALKER_STATE"

  if [ "$WALKER_STATE" = "IN_USE" ] || [ "$WALKER_STATE" = "STORED" ]; then
    echo -e "${GREEN}✅${NC} Walker 状态正确: $WALKER_STATE"
  else
    echo -e "${YELLOW}⚠️${NC} Walker 状态异常: $WALKER_STATE"
  fi
else
  echo -e "${RED}❌ FAIL${NC}: Walker Prompt 生成 API 失败 (HTTP $HTTP_CODE)"
  echo "Response: $BODY"
fi

echo ""
echo ""

# 总结
echo "=================================================="
echo "测试总结"
echo "=================================================="
echo ""

# 计算通过的测试数量
PASS_COUNT=0
FAIL_COUNT=0

# 简单的总结 (需要手动根据上面的测试结果判断)
echo "详细结果请查看上方输出"
echo ""
echo "关键问题:"
echo "- 如果测试 1 和测试 2 失败，说明 Sessions API 不支持 Walker 状态"
echo "- 这是 P0 阻塞问题，必须立即修复"
echo ""
echo "修复方案:"
echo "1. 打开 /app/api/sessions/route.ts"
echo "2. 定位到第 64-75 行的 product_state 验证逻辑"
echo "3. 参考 QA_EXECUTIVE_SUMMARY.md 中的修复代码"
echo ""
echo "=================================================="
