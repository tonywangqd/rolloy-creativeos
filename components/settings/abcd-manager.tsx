"use client";

import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  Loader2,
  ChevronDown,
  ChevronRight,
  MapPin,
  Activity,
  Heart,
  Palette,
} from "lucide-react";
import {
  useSceneCategories,
  useSceneDetails,
  useActions,
  useEmotions,
  useFormats,
  useCreateABCDItem,
  useUpdateABCDItem,
  useDeleteABCDItem,
} from "@/lib/hooks/useABCD";
import {
  ABCDDimension,
  SceneCategory,
  SceneDetail,
  Action,
  Emotion,
  Format,
} from "@/lib/types/abcd";

// ============================================================================
// Types
// ============================================================================

type ABCDItem = SceneCategory | SceneDetail | Action | Emotion | Format;

interface EditingItem {
  id: string | null;
  dimension: ABCDDimension;
  code: string;
  name_zh: string;
  ai_visual_prompt: string;
  sort_order: number;
  category_id?: string;
}

// ============================================================================
// Dimension Config
// ============================================================================

const DIMENSION_CONFIG: Record<
  ABCDDimension,
  {
    title: string;
    icon: React.ReactNode;
    description: string;
  }
> = {
  "scene-category": {
    title: "A1 - 场景分类",
    icon: <MapPin className="h-4 w-4" />,
    description: "场景大类（居家、社区、交通、旅行）",
  },
  "scene-detail": {
    title: "A2 - 场景详情",
    icon: <MapPin className="h-4 w-4" />,
    description: "具体场景（卧室、公园、机场等）",
  },
  action: {
    title: "B - 动作",
    icon: <Activity className="h-4 w-4" />,
    description: "用户动作（行走、坐姿、收纳等）",
  },
  emotion: {
    title: "C - 情绪驱动",
    icon: <Heart className="h-4 w-4" />,
    description: "情感驱动因素（独立、安全、社交等）",
  },
  format: {
    title: "D - 格式",
    icon: <Palette className="h-4 w-4" />,
    description: "图片格式和风格",
  },
};

// ============================================================================
// Item Row Component
// ============================================================================

interface ItemRowProps {
  item: ABCDItem;
  dimension: ABCDDimension;
  onEdit: (item: ABCDItem) => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
  categories?: SceneCategory[];
}

function ItemRow({ item, dimension, onEdit, onDelete, isDeleting, categories }: ItemRowProps) {
  const categoryName = useMemo(() => {
    if (dimension === "scene-detail" && "category_id" in item && categories) {
      const category = categories.find((c) => c.id === item.category_id);
      return category?.name_zh || "";
    }
    return null;
  }, [dimension, item, categories]);

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className="font-mono text-xs">
            {item.code}
          </Badge>
          <span className="font-medium text-sm truncate">{item.name_zh}</span>
          {categoryName && (
            <Badge variant="secondary" className="text-xs">
              {categoryName}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">
          {item.ai_visual_prompt}
        </p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onEdit(item)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={() => onDelete(item.id)}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Edit Form Component
// ============================================================================

interface EditFormProps {
  editing: EditingItem;
  dimension: ABCDDimension;
  categories?: SceneCategory[];
  onSave: () => void;
  onCancel: () => void;
  onChange: (field: keyof EditingItem, value: string | number) => void;
  isSaving: boolean;
}

function EditForm({
  editing,
  dimension,
  categories,
  onSave,
  onCancel,
  onChange,
  isSaving,
}: EditFormProps) {
  return (
    <div className="p-4 rounded-lg border-2 border-primary/50 bg-primary/5 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">
          {editing.id ? "编辑项目" : "新增项目"}
        </h4>
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Code</label>
          <Input
            value={editing.code}
            onChange={(e) => onChange("code", e.target.value)}
            placeholder="例如: 01-Home"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">排序</label>
          <Input
            type="number"
            value={editing.sort_order}
            onChange={(e) => onChange("sort_order", parseInt(e.target.value) || 0)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">中文名称</label>
        <Input
          value={editing.name_zh}
          onChange={(e) => onChange("name_zh", e.target.value)}
          placeholder="例如: 居家及养老院"
        />
      </div>

      {dimension === "scene-detail" && categories && (
        <div className="space-y-2">
          <label className="text-sm font-medium">所属分类</label>
          <select
            className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
            value={editing.category_id || ""}
            onChange={(e) => onChange("category_id", e.target.value)}
          >
            <option value="">选择分类...</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.code} - {cat.name_zh}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium">AI Visual Prompt</label>
        <Textarea
          value={editing.ai_visual_prompt}
          onChange={(e) => onChange("ai_visual_prompt", e.target.value)}
          placeholder="描述这个选项的视觉特征..."
          rows={4}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button onClick={onSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          保存
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Dimension Section Component
// ============================================================================

interface DimensionSectionProps {
  dimension: ABCDDimension;
  items: ABCDItem[];
  isLoading: boolean;
  categories?: SceneCategory[];
}

function DimensionSection({
  dimension,
  items,
  isLoading,
  categories,
}: DimensionSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [editing, setEditing] = useState<EditingItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const config = DIMENSION_CONFIG[dimension];

  const createMutation = useCreateABCDItem<ABCDItem>(dimension);
  const updateMutation = useUpdateABCDItem<ABCDItem>(dimension);
  const deleteMutation = useDeleteABCDItem(dimension);

  const handleAdd = useCallback(() => {
    setEditing({
      id: null,
      dimension,
      code: "",
      name_zh: "",
      ai_visual_prompt: "",
      sort_order: items.length + 1,
      category_id: dimension === "scene-detail" && categories?.[0] ? categories[0].id : undefined,
    });
  }, [dimension, items.length, categories]);

  const handleEdit = useCallback((item: ABCDItem) => {
    setEditing({
      id: item.id,
      dimension,
      code: item.code,
      name_zh: item.name_zh,
      ai_visual_prompt: item.ai_visual_prompt,
      sort_order: item.sort_order,
      category_id: "category_id" in item ? item.category_id : undefined,
    });
  }, [dimension]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("确定要删除这个项目吗？")) return;
    setDeletingId(id);
    try {
      await deleteMutation.mutateAsync(id);
    } catch (error) {
      console.error("Delete failed:", error);
      alert("删除失败: " + (error instanceof Error ? error.message : "未知错误"));
    } finally {
      setDeletingId(null);
    }
  }, [deleteMutation]);

  const handleSave = useCallback(async () => {
    if (!editing) return;

    try {
      if (editing.id) {
        await updateMutation.mutateAsync({
          id: editing.id,
          code: editing.code,
          name_zh: editing.name_zh,
          ai_visual_prompt: editing.ai_visual_prompt,
          sort_order: editing.sort_order,
          ...(editing.category_id ? { category_id: editing.category_id } : {}),
        } as any);
      } else {
        await createMutation.mutateAsync({
          code: editing.code,
          name_zh: editing.name_zh,
          ai_visual_prompt: editing.ai_visual_prompt,
          sort_order: editing.sort_order,
          ...(editing.category_id ? { category_id: editing.category_id } : {}),
        } as any);
      }
      setEditing(null);
    } catch (error) {
      console.error("Save failed:", error);
      alert("保存失败: " + (error instanceof Error ? error.message : "未知错误"));
    }
  }, [editing, createMutation, updateMutation]);

  const handleChange = useCallback(
    (field: keyof EditingItem, value: string | number) => {
      if (!editing) return;
      setEditing({ ...editing, [field]: value });
    },
    [editing]
  );

  return (
    <Card>
      <CardHeader
        className="cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {config.icon}
            {config.title}
            <Badge variant="secondary" className="ml-2">
              {items.length}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleAdd();
                setIsExpanded(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              新增
            </Button>
            {isExpanded ? (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </CardTitle>
        <CardDescription>{config.description}</CardDescription>
      </CardHeader>

      {isExpanded && (
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-3">
              {editing && (
                <EditForm
                  editing={editing}
                  dimension={dimension}
                  categories={categories}
                  onSave={handleSave}
                  onCancel={() => setEditing(null)}
                  onChange={handleChange}
                  isSaving={createMutation.isPending || updateMutation.isPending}
                />
              )}

              <ScrollArea className="h-[300px]">
                <div className="space-y-2 pr-4">
                  {items.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      暂无数据，点击"新增"添加
                    </p>
                  ) : (
                    items.map((item) => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        dimension={dimension}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        isDeleting={deletingId === item.id}
                        categories={categories}
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ============================================================================
// Main ABCD Manager Component
// ============================================================================

export function ABCDManager() {
  const {
    data: sceneCategories,
    isLoading: loadingCategories,
  } = useSceneCategories();
  const {
    data: sceneDetails,
    isLoading: loadingDetails,
  } = useSceneDetails();
  const { data: actions, isLoading: loadingActions } = useActions();
  const { data: emotions, isLoading: loadingEmotions } = useEmotions();
  const { data: formats, isLoading: loadingFormats } = useFormats();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">ABCD 数据管理</h2>
          <p className="text-sm text-muted-foreground">
            管理场景、动作、情绪和格式的选项数据
          </p>
        </div>
      </div>

      <DimensionSection
        dimension="scene-category"
        items={sceneCategories || []}
        isLoading={loadingCategories}
      />

      <DimensionSection
        dimension="scene-detail"
        items={sceneDetails || []}
        isLoading={loadingDetails}
        categories={sceneCategories}
      />

      <DimensionSection
        dimension="action"
        items={actions || []}
        isLoading={loadingActions}
      />

      <DimensionSection
        dimension="emotion"
        items={emotions || []}
        isLoading={loadingEmotions}
      />

      <DimensionSection
        dimension="format"
        items={formats || []}
        isLoading={loadingFormats}
      />
    </div>
  );
}
