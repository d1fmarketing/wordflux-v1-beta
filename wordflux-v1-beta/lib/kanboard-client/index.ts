// Kanboard client selector - uses mock for testing, real for production

// Check if we should use mock
const USE_MOCK = process.env.KANBOARD_MOCK === '1' || process.env.KANBOARD_MOCK === 'true';

// Export the appropriate client
export const KanboardClient = USE_MOCK
  ? require('./mock').InMemoryKanboardClient
  : require('./real').KanboardClient;

// Re-export types from real implementation
export type { Task, Column } from './real';