// utils/errorHandler.ts
export const withErrorHandling = <T extends (...args: any[]) => Promise<any>>(
  asyncFn: T,
  fallbackValue: any = null,
  errorMessage?: string
) => {
  return async (...args: Parameters<T>) => {
    try {
      return await asyncFn(...args);
    } catch (error) {
      console.error(errorMessage || 'Operation failed:', error);
      return fallbackValue;
    }
  };
};