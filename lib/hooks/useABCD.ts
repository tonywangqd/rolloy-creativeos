/**
 * Rolloy Creative OS - ABCD Data Management Hooks
 *
 * React hooks for managing ABCD dimension data using React Query
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ABCDOptions,
  ABCDDimension,
  SceneCategory,
  SceneDetail,
  Action,
  Emotion,
  Format,
  CreateABCDRequest,
  UpdateABCDRequest,
} from '@/lib/types/abcd';
import { APIResponse } from '@/lib/types';

// ============================================================================
// Query Keys
// ============================================================================

export const ABCD_QUERY_KEYS = {
  all: ['abcd'] as const,
  options: () => [...ABCD_QUERY_KEYS.all, 'options'] as const,
  dimension: (dimension: ABCDDimension) =>
    [...ABCD_QUERY_KEYS.all, 'dimension', dimension] as const,
};

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch all ABCD options
 */
async function fetchABCDOptions(): Promise<ABCDOptions> {
  const response = await fetch('/api/abcd');
  const result: APIResponse<ABCDOptions> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error?.message || 'Failed to fetch ABCD options');
  }

  return result.data;
}

/**
 * Fetch items in a specific dimension
 */
async function fetchDimensionItems<T>(dimension: ABCDDimension): Promise<T[]> {
  const response = await fetch(`/api/abcd/${dimension}`);
  const result: APIResponse<{ items: T[] }> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error?.message || `Failed to fetch ${dimension} items`);
  }

  return result.data.items;
}

/**
 * Create new item in dimension
 */
async function createDimensionItem<T>(
  dimension: ABCDDimension,
  payload: CreateABCDRequest
): Promise<T> {
  const response = await fetch(`/api/abcd/${dimension}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const result: APIResponse<{ item: T }> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error?.message || `Failed to create ${dimension} item`);
  }

  return result.data.item;
}

/**
 * Update item in dimension
 */
async function updateDimensionItem<T>(
  dimension: ABCDDimension,
  payload: UpdateABCDRequest
): Promise<T> {
  const response = await fetch(`/api/abcd/${dimension}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const result: APIResponse<{ item: T }> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error?.message || `Failed to update ${dimension} item`);
  }

  return result.data.item;
}

/**
 * Delete item from dimension
 */
async function deleteDimensionItem(
  dimension: ABCDDimension,
  id: string
): Promise<void> {
  const response = await fetch(`/api/abcd/${dimension}?id=${id}`, {
    method: 'DELETE',
  });

  const result: APIResponse = await response.json();

  if (!result.success) {
    throw new Error(result.error?.message || `Failed to delete ${dimension} item`);
  }
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to fetch all ABCD options
 */
export function useABCDOptions() {
  return useQuery({
    queryKey: ABCD_QUERY_KEYS.options(),
    queryFn: fetchABCDOptions,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook to fetch scene categories
 */
export function useSceneCategories() {
  return useQuery({
    queryKey: ABCD_QUERY_KEYS.dimension('scene-category'),
    queryFn: () => fetchDimensionItems<SceneCategory>('scene-category'),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to fetch scene details
 */
export function useSceneDetails() {
  return useQuery({
    queryKey: ABCD_QUERY_KEYS.dimension('scene-detail'),
    queryFn: () => fetchDimensionItems<SceneDetail>('scene-detail'),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to fetch actions
 */
export function useActions() {
  return useQuery({
    queryKey: ABCD_QUERY_KEYS.dimension('action'),
    queryFn: () => fetchDimensionItems<Action>('action'),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to fetch emotions
 */
export function useEmotions() {
  return useQuery({
    queryKey: ABCD_QUERY_KEYS.dimension('emotion'),
    queryFn: () => fetchDimensionItems<Emotion>('emotion'),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to fetch formats
 */
export function useFormats() {
  return useQuery({
    queryKey: ABCD_QUERY_KEYS.dimension('format'),
    queryFn: () => fetchDimensionItems<Format>('format'),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to create ABCD item
 */
export function useCreateABCDItem<T>(dimension: ABCDDimension) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateABCDRequest) =>
      createDimensionItem<T>(dimension, payload),
    onSuccess: () => {
      // Invalidate both specific dimension and all options
      queryClient.invalidateQueries({ queryKey: ABCD_QUERY_KEYS.dimension(dimension) });
      queryClient.invalidateQueries({ queryKey: ABCD_QUERY_KEYS.options() });
    },
  });
}

/**
 * Hook to update ABCD item
 */
export function useUpdateABCDItem<T>(dimension: ABCDDimension) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateABCDRequest) =>
      updateDimensionItem<T>(dimension, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ABCD_QUERY_KEYS.dimension(dimension) });
      queryClient.invalidateQueries({ queryKey: ABCD_QUERY_KEYS.options() });
    },
  });
}

/**
 * Hook to delete ABCD item
 */
export function useDeleteABCDItem(dimension: ABCDDimension) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteDimensionItem(dimension, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ABCD_QUERY_KEYS.dimension(dimension) });
      queryClient.invalidateQueries({ queryKey: ABCD_QUERY_KEYS.options() });
    },
  });
}

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * Get scene details filtered by category
 */
export function useSceneDetailsByCategory(categoryId?: string) {
  const { data: sceneDetails, ...rest } = useSceneDetails();

  const filteredDetails = categoryId
    ? sceneDetails?.filter((detail) => detail.category_id === categoryId)
    : sceneDetails;

  return {
    ...rest,
    data: filteredDetails,
  };
}

/**
 * Prefetch all ABCD data
 * Useful for improving perceived performance
 */
export function usePrefetchABCD() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.prefetchQuery({
      queryKey: ABCD_QUERY_KEYS.options(),
      queryFn: fetchABCDOptions,
    });
  };
}
