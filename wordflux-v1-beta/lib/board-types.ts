export type APITag = string | { id: number; name?: string; color_id?: string; task_id?: number };

export interface APITask {
  id: number;
  title: string;
  description?: string;
  assignees?: string[];
  assignee?: string;
  date_due?: string;
  tags?: APITag[];
  score?: number;
  priority?: number;
  color_id?: string;
  nb_comments?: number;
}

export interface Task {
  id: number;
  title: string;
  description?: string;
  assignees?: string[];
  assignee?: string;
  date_due?: string;
  tags?: string[];  // After normalization, tags are always strings
  score?: number;
  priority?: number;
  color_id?: string;
  nb_comments?: number;
}

export interface APIColumn {
  id: number;
  title: string;
  tasks: APITask[];
}

export interface Column {
  id: number;
  title: string;
  tasks: Task[];
}

export interface APIBoardState {
  columns: APIColumn[];
  syncCount: number;
  lastSync?: string;
}

export interface BoardState {
  columns: Column[];
  syncCount: number;
  lastSync?: string;
}