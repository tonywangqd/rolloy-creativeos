#!/bin/bash

# Walker API 兼容性测试脚本
# 用于验证 Sessions API 是否支持 Walker 产品
# 
# 更新: 2026-01-01 - Walker 现使用 FOLDED/UNFOLDED 状态 (与 Rollator 统一)

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

# 测试 1: Walker 状态 - UNFOLDED (展开使用中)
echo "测试 1: 创建 Walker Session (UNFOLDED 状态)"
echo "----------------------------------------------------"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/sessions" \
  -H "Content-Type: application/json" \
  -d '{
    "creative_name": "Test Walker UNFOLDED",
    "product_type": "walker",
    "abcd_selection": {
      "A1": "outdoor",
      "A2": "park",
      "B": "walking",
      "C": "independence",
      "D": "carousel"
    },
    "prompt": "A senior man walking confidently with a standard walker in a park",
    "product_state": "UNFOLDED",
    "reference_image_url": "https://example.com/walker-unfolded.jpg",
    "total_images": 20
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 201 ]; then
  echo -e "${GREEN}✅ PASS${NC}: Walker UNFOLDED 状态被接受"
  echo "Response: $BODY"
  SESSION_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo "Session ID: $SESSION_ID"
else
  echo -e "${RED}❌ FAIL${NC}: Walker UNFOLDED 状态被拒绝 (HTTP $HTTP_CODE)"
  echo "Response: $BODY"
fi

echo ""
echo ""

# 测试 2: Walker 状态 - FOLDED (收折存放)
echo "测试 2: 创建 Walker Session (FOLDED 状态)"
echo "----------------------------------------------------"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/sessions" \
  -H "Content-Type: application/json" \
  -d '{
    "creative_name": "Test Walker FOLDED",
    "product_type": "walker",
    "abcd_selection": {
      "A1": "indoor",
      "A2": "home",
      "B": "standing_still",
      "C": "safety",
      "D": "single_image"
    },
    "prompt": "A standard walker folded neatly against the wall",
    "product_state": "FOLDED",
    "reference_image_url": "https://example.com/walker-folded.jpg",
    "total_images": 20
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 201 ]; then
  echo -e "${GREEN}✅ PASS${NC}: Walker FOLDED 状态被接受"
  echo "Response: $BODY"
else
  echo -e "${RED}❌ FAIL${NC}: Walker FOLDED 状态被拒绝 (HTTP $HTTP_CODE)"
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
    "product_type": "rollator",
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

  if [ "$WALKER_STATE" = "FOLDED" ] || [ "$WALKER_STATE" = "UNFOLDED" ]; then
    echo -e "${GREEN}✅${NC} Walker 状态正确: $WALKER_STATE"
  else
    echo -e "${YELLOW}⚠️${NC} Walker 状态异常: $WALKER_STATE (应为 FOLDED 或 UNFOLDED)"
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

echo "Walker 现使用统一的产品状态:"
echo "- UNFOLDED: 展开使用中 (用户站在助行器框架内)"
echo "- FOLDED: 收折存放 (折叠后便于存储/运输)"
echo ""
echo "这与 Rollator 使用相同的状态命名，保持代码一致性。"
echo ""
echo "=================================================="
