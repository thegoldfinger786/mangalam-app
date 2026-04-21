import * as Sentry from '@sentry/react-native';

/**
 * A lightweight logger utility to prevent accidental logging in production,
 * and standardizing console logs.
 */

export const logger = {
  /**
   * Logs a message to the console. Will only log in development.
   */
  log: (...args: any[]) => {
    if (__DEV__) {
      console.log(...args);
    }
  },

  /**
   * Logs a warning to the console. Will only log in development.
   */
  warn: (...args: any[]) => {
    if (__DEV__) {
      console.warn(...args);
    }
  },

  /**
   * Logs an error to the console. Always logs.
   * Useful for ensuring critical failures are reported.
   */
  error: (
    message: string,
    errorContext?: { 
      error?: unknown; 
      context?: Record<string, unknown>;
      level?: 'info' | 'warning' | 'error' | 'fatal';
      tags?: Record<string, string>;
    }
  ) => {
    console.error(message, errorContext || {});

    if (!__DEV__) {
      Sentry.withScope((scope) => {
        if (errorContext?.level) {
          scope.setLevel(errorContext.level);
        } else {
          scope.setLevel('error');
        }

        if (errorContext?.tags) {
          scope.setTags(errorContext.tags);
        }

        if (errorContext?.context) {
          scope.setContext('app_context', errorContext.context);
        }
        
        if (errorContext?.error instanceof Error) {
          Sentry.captureException(errorContext.error);
        } else {
          if (errorContext?.error) {
            scope.setExtra('non_error_object', errorContext.error);
          }
          Sentry.captureMessage(message);
        }
      });
    }
  },

  /**
   * Logs debug information. Same as log, only in development.
   */
  debug: (...args: any[]) => {
    if (__DEV__) {
      console.debug(...args);
    }
  },
};
