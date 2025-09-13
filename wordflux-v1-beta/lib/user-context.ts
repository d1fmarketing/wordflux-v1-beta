interface UserContext {
  lastUsedColumn?: string;
  lastUsedAt?: number;
  taskCount: number;
}

class UserContextManager {
  private contexts: Map<string, UserContext> = new Map();
  private readonly MEMORY_DURATION_MS = 60 * 60 * 1000; // 1 hour
  
  constructor() {
    // Clean up stale contexts every 10 minutes
    setInterval(() => this.cleanup(), 10 * 60 * 1000);
  }
  
  private cleanup() {
    const now = Date.now();
    Array.from(this.contexts.entries()).forEach(([key, context]) => {
      if (context.lastUsedAt && now - context.lastUsedAt > this.MEMORY_DURATION_MS) {
        this.contexts.delete(key);
      }
    });
  }
  
  private getUserKey(identifier: string | Request): string {
    if (typeof identifier === 'string') {
      return identifier;
    }
    
    // Try to extract IP or session ID from request
    if (identifier instanceof Request) {
      const forwarded = identifier.headers.get('x-forwarded-for');
      const realIp = identifier.headers.get('x-real-ip');
      const ip = forwarded?.split(',')[0] || realIp || 'default';
      return `user:${ip}`;
    }
    
    return 'user:default';
  }
  
  getContext(identifier: string | Request): UserContext {
    const key = this.getUserKey(identifier);
    let context = this.contexts.get(key);
    
    if (!context) {
      context = { taskCount: 0 };
      this.contexts.set(key, context);
    }
    
    return context;
  }
  
  getDefaultColumn(identifier: string | Request): string | undefined {
    const context = this.getContext(identifier);
    const now = Date.now();
    
    // Check if memory is still valid
    if (context.lastUsedColumn && context.lastUsedAt) {
      if (now - context.lastUsedAt < this.MEMORY_DURATION_MS) {
        return context.lastUsedColumn;
      } else {
        // Memory expired, clear it
        context.lastUsedColumn = undefined;
        context.lastUsedAt = undefined;
      }
    }
    
    return undefined;
  }
  
  setLastUsedColumn(identifier: string | Request, column: string) {
    const context = this.getContext(identifier);
    const normalizedColumn = column.toLowerCase();
    
    // Only remember meaningful columns
    const validColumns = ['backlog', 'ready', 'work in progress', 'done'];
    if (validColumns.some(valid => normalizedColumn.includes(valid))) {
      context.lastUsedColumn = column;
      context.lastUsedAt = Date.now();
    }
  }
  
  incrementTaskCount(identifier: string | Request) {
    const context = this.getContext(identifier);
    context.taskCount++;
  }
  
  getStats(identifier: string | Request): { 
    tasksCreated: number; 
    defaultColumn?: string; 
    memoryExpiresIn?: number 
  } {
    const context = this.getContext(identifier);
    const now = Date.now();
    
    const stats: any = {
      tasksCreated: context.taskCount
    };
    
    if (context.lastUsedColumn && context.lastUsedAt) {
      const expiresIn = this.MEMORY_DURATION_MS - (now - context.lastUsedAt);
      if (expiresIn > 0) {
        stats.defaultColumn = context.lastUsedColumn;
        stats.memoryExpiresIn = Math.round(expiresIn / 1000 / 60); // in minutes
      }
    }
    
    return stats;
  }
}

// Export singleton instance
export const userContextManager = new UserContextManager();