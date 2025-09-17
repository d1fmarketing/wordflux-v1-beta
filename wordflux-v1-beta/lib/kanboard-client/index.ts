// taskcafe client selector - uses mock for testing, real for production

// Check if we should use mock
const USE_MOCK = process.env.TASKCAFE_MOCK === '1' || process.env.TASKCAFE_MOCK === 'true';

// Export the appropriate client
export const TaskCafeClient = USE_MOCK
  ? require('./mock').InMemoryTaskCafeClient
  : require('./real').TaskCafeClient;

// Re-export types from real implementation
export type { Task, Column } from './real';
