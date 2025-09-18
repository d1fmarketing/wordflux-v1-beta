export type Priority = 'urgent' | 'high' | 'medium' | 'low';

export type FilterDateRange = {
  before?: string;
  after?: string;
  on?: string;
  overdue?: boolean;
  withinHrs?: number;
};

export type FilterSpec = {
  text?: string;
  ids?: string[];
  columns?: Array<'Backlog' | 'In Progress' | 'Review' | 'Done'>;
  assignees?: string[];
  labelsAny?: string[];
  labelsAll?: string[];
  clients?: string[];
  projects?: string[];
  teams?: string[];
  types?: string[];
  createdBy?: string[];
  followers?: string[];
  due?: FilterDateRange;
  desiredStart?: FilterDateRange;
  priority?: Priority;
  points?: { gte?: number; lte?: number };
  reopened?: boolean;
  shared?: boolean;
  recurring?: boolean;
  awaitingApproval?: boolean;
  myOpenParts?: boolean;
  effortExceeded?: boolean;
  slaOver?: boolean;
  idleOver?: { hours: number };
  includeSubtasks?: boolean;
};

export type FacetCardFlags = {
  openParts: number;
  totalParts: number;
  overdue: boolean;
  effortExceeded: boolean;
  slaOver: boolean;
  idleOver: boolean;
  awaitingApproval: boolean;
  recurring: boolean;
  shared: boolean;
  allPartsDelivered: boolean;
};

export type DerivedCardMetadata = {
  points: number | null;
  priority: Priority | null;
  desiredStart: string | null;
  desiredDelivery: string | null;
  slaHours: number | null;
  idleHours: number | null;
  repeatCadence: 'daily' | 'weekly' | 'monthly' | null;
  createdBy: string | null;
  followers: string[];
  sanitizedDescription: string;
  myOpenParts: boolean;
} & FacetCardFlags;
