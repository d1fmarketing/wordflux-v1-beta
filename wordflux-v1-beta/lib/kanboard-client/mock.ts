// In-memory mock taskcafe client for testing
// Eliminates SQLite locks and provides instant responses

interface MockTask {
  id: number;
  title: string;
  description?: string;
  column_id: number;
  position: number;
  project_id: number;
  color_id?: string;
  owner_id?: number;
  creator_id?: number;
  date_creation?: number;
  date_modification?: number;
  date_completed?: number;
  date_due?: number;
  is_active?: number;
  tags?: string[];
  score?: number;
  priority?: number;
  nb_comments?: number;
  comments?: string[];
}

interface MockColumn {
  id: number;
  title: string;
  position: number;
  project_id: number;
}

export class InMemoryTaskCafeClient {
  private taskIdCounter = 1000;
  private commentIdCounter = 1;
  private tasks: Map<number, MockTask> = new Map();
  private columns: MockColumn[] = [
    { id: 1, title: 'Backlog', position: 1, project_id: 1 },
    { id: 2, title: 'Ready', position: 2, project_id: 1 },
    { id: 3, title: 'Work in progress', position: 3, project_id: 1 },
    { id: 4, title: 'Review', position: 4, project_id: 1 },
    { id: 5, title: 'Done', position: 5, project_id: 1 }
  ];

  constructor(config: any) {
    // Config not needed for mock
  }

  async request<T = any>(method: string, params: any = {}): Promise<T> {
    // Mock the request method for compatibility
    throw new Error(`Mock does not support direct request method: ${method}`);
  }

  async getColumns(projectId: number): Promise<MockColumn[]> {
    return this.columns.filter(c => c.project_id === projectId);
  }

  async getTasks(projectId: number): Promise<MockTask[]> {
    return Array.from(this.tasks.values()).filter(t => t.project_id === projectId);
  }

  async getTask(taskId: number): Promise<MockTask | null> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    return task;
  }

  async createTask(
    projectId: number,
    title: string,
    columnId?: number,
    description?: string,
    options?: any
  ): Promise<number> {
    const id = ++this.taskIdCounter;
    const task: MockTask = {
      id,
      title,
      description,
      column_id: columnId || this.columns[0].id, // Default to Backlog
      position: this.getNextPosition(columnId || this.columns[0].id),
      project_id: projectId,
      is_active: 1,
      date_creation: Date.now() / 1000,
      date_modification: Date.now() / 1000,
      priority: options?.priority || 0,
      comments: []
    };
    this.tasks.set(id, task);
    return id;
  }

  async updateTask(taskId: number, updates: any): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    
    Object.assign(task, updates);
    task.date_modification = Date.now() / 1000;
    return true;
  }

  async moveTaskPosition(
    projectId: number,
    taskId: number,
    columnId: number,
    position: number,
    swimlaneId?: number
  ): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    
    task.column_id = columnId;
    task.position = position;
    task.date_modification = Date.now() / 1000;
    return true;
  }

  async addComment(taskId: number, content: string, userId?: number): Promise<number> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    
    if (!task.comments) task.comments = [];
    task.comments.push(content);
    if (!task.nb_comments) task.nb_comments = 0;
    task.nb_comments++;
    
    return ++this.commentIdCounter;
  }

  async searchTasks(projectId: number, query: string): Promise<MockTask[]> {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.tasks.values()).filter(t => 
      t.project_id === projectId &&
      (t.title.toLowerCase().includes(lowerQuery) ||
       (t.description && t.description.toLowerCase().includes(lowerQuery)))
    );
  }

  async listProjectTasks(projectId: number): Promise<MockTask[]> {
    return this.getTasks(projectId);
  }

  async getTaskComments(taskId: number): Promise<any[]> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    
    return (task.comments || []).map((content, i) => ({
      id: i + 1,
      task_id: taskId,
      content,
      user_id: 0,
      date_creation: Date.now() / 1000
    }));
  }

  private getNextPosition(columnId: number): number {
    const tasksInColumn = Array.from(this.tasks.values())
      .filter(t => t.column_id === columnId);
    return tasksInColumn.length + 1;
  }

  // Add seed data for testing
  seedTestData() {
    // Add some test tasks
    this.createTask(1, 'Test Task 1', 1, 'Description 1');
    this.createTask(1, 'Test Task 2', 2, 'Description 2');
    this.createTask(1, 'Test Task 3', 3, 'Description 3');
  }
}
