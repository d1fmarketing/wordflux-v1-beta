export interface AutoTag {
  emoji: string;
  label: string;
  keywords: string[];
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}

const AUTO_TAGS: AutoTag[] = [
  {
    emoji: '🐛',
    label: 'bug',
    keywords: ['bug', 'fix', 'issue', 'broken', 'error', 'crash', 'problem'],
    priority: 'high'
  },
  {
    emoji: '✨',
    label: 'feature',
    keywords: ['feature', 'add', 'new', 'implement', 'create', 'enhancement'],
    priority: 'medium'
  },
  {
    emoji: '🔥',
    label: 'urgent',
    keywords: ['urgent', 'asap', 'critical', 'emergency', 'immediately', 'now'],
    priority: 'urgent'
  },
  {
    emoji: '🚀',
    label: 'deploy',
    keywords: ['deploy', 'release', 'ship', 'launch', 'production', 'rollout'],
    priority: 'high'
  },
  {
    emoji: '🔧',
    label: 'refactor',
    keywords: ['refactor', 'cleanup', 'optimize', 'improve', 'restructure'],
    priority: 'low'
  },
  {
    emoji: '📝',
    label: 'docs',
    keywords: ['docs', 'documentation', 'readme', 'document', 'guide'],
    priority: 'low'
  },
  {
    emoji: '✅',
    label: 'test',
    keywords: ['test', 'testing', 'spec', 'unit', 'integration', 'e2e'],
    priority: 'medium'
  },
  {
    emoji: '🔒',
    label: 'security',
    keywords: ['security', 'vulnerability', 'auth', 'permission', 'exploit', 'xss', 'csrf'],
    priority: 'urgent'
  },
  {
    emoji: '⚡',
    label: 'performance',
    keywords: ['performance', 'slow', 'optimize', 'speed', 'fast', 'latency'],
    priority: 'medium'
  },
  {
    emoji: '💡',
    label: 'idea',
    keywords: ['idea', 'suggestion', 'proposal', 'consider', 'maybe', 'could'],
    priority: 'low'
  }
];

export function detectAutoTags(text: string): AutoTag[] {
  const normalizedText = text.toLowerCase();
  const detectedTags: AutoTag[] = [];
  const seenLabels = new Set<string>();
  
  for (const tag of AUTO_TAGS) {
    // Check if any keyword matches
    const hasKeyword = tag.keywords.some(keyword => {
      // Use word boundaries for more accurate matching
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      return regex.test(normalizedText);
    });
    
    if (hasKeyword && !seenLabels.has(tag.label)) {
      detectedTags.push(tag);
      seenLabels.add(tag.label);
    }
  }
  
  return detectedTags;
}

export function getHighestPriority(tags: AutoTag[]): string | undefined {
  const priorities = ['urgent', 'high', 'medium', 'low'];
  
  for (const priority of priorities) {
    if (tags.some(tag => tag.priority === priority)) {
      return priority;
    }
  }
  
  return undefined;
}

export function formatTagsForComment(tags: AutoTag[]): string {
  if (tags.length === 0) return '';
  
  const tagStrings = tags.map(tag => `${tag.emoji} ${tag.label}`);
  const priority = getHighestPriority(tags);
  
  let comment = `Auto-tagged: ${tagStrings.join(', ')}`;
  
  if (priority) {
    comment += ` | Priority: ${priority}`;
  }
  
  return comment;
}

export function formatTagsForDisplay(tags: AutoTag[]): string {
  if (tags.length === 0) return '';
  return tags.map(tag => tag.emoji).join(' ');
}