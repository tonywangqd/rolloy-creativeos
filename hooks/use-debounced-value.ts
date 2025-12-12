"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Hook to debounce a value update
 * @param value - The value to debounce
 * @param delay - Debounce delay in milliseconds (default: 300ms)
 * @returns Debounced value
 */
export function useDebouncedValue<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook to create a debounced callback function
 * @param callback - The function to debounce
 * @param delay - Debounce delay in milliseconds (default: 300ms)
 * @returns Debounced callback function
 */
export function useDebouncedCallback<T extends (...args: any[]) => void>(
  callback: T,
  delay: number = 300
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef(callback);

  // Keep the callback ref updated
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    ((...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    }) as T,
    [delay]
  );
}

/**
 * Hook for controlled inputs with debounced external state updates
 * Provides immediate local state updates for smooth typing while
 * debouncing the external state updates to prevent UI blocking
 *
 * @param externalValue - The external state value
 * @param onExternalChange - Callback to update external state
 * @param delay - Debounce delay in milliseconds (default: 300ms)
 * @returns [localValue, setLocalValue] - Local value and setter for immediate updates
 */
export function useDebouncedInput(
  externalValue: string,
  onExternalChange: (value: string) => void,
  delay: number = 300
): [string, (value: string) => void] {
  const [localValue, setLocalValue] = useState(externalValue);
  const isInternalUpdateRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync local value when external value changes (but not from our own updates)
  useEffect(() => {
    if (!isInternalUpdateRef.current) {
      setLocalValue(externalValue);
    }
    isInternalUpdateRef.current = false;
  }, [externalValue]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleChange = useCallback(
    (newValue: string) => {
      // Update local state immediately for smooth typing
      setLocalValue(newValue);
      isInternalUpdateRef.current = true;

      // Debounce the external state update
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        onExternalChange(newValue);
      }, delay);
    },
    [onExternalChange, delay]
  );

  return [localValue, handleChange];
}
