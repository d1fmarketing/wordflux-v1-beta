export type Lang = 'pt' | 'en'

export const t = (lang: Lang) => ({
  header: {
    title: lang === 'pt' ? 'Quadro Kanban' : 'Kanban Board'
  },
  chat: {
    title: lang === 'pt' ? 'WordFlux AI' : 'WordFlux AI',
    subtitle: lang === 'pt' ? 'Digite o que quer e eu organizo seu quadro.' : 'Type what you want and I\'ll organize your board.',
    placeholder: lang === 'pt' ? 'Digite e eu organizo…' : 'Type and I\'ll organize…',
    tips: lang === 'pt' ? 'Dicas' : 'Tips',
    tipList: {
      plan: lang === 'pt' ? 'Planejar amanhã do Ready' : 'Plan tomorrow from Ready',
      tasks: lang === 'pt' ? 'Mostrar minhas tarefas' : 'Show my tasks',
      summary: lang === 'pt' ? 'Resumo do quadro' : 'Board summary'
    },
    recentActions: lang === 'pt' ? 'Ações recentes' : 'Recent actions',
    changes: lang === 'pt' ? 'mudança' : 'change',
    changesPlural: lang === 'pt' ? 'mudanças' : 'changes',
    applied: lang === 'pt' ? 'aplicada' : 'applied',
    appliedPlural: lang === 'pt' ? 'aplicadas' : 'applied',
    undo: lang === 'pt' ? 'Desfazer' : 'Undo',
    processing: lang === 'pt' ? 'Processando…' : 'Processing…'
  },
  filters: {
    title: lang === 'pt' ? 'Filtros' : 'Filters',
    filterBy: lang === 'pt' ? 'Filtrar por' : 'Filter by',
    urgent: lang === 'pt' ? 'Urgente' : 'Urgent',
    mine: lang === 'pt' ? 'Minhas' : 'Mine',
    today: lang === 'pt' ? 'Para hoje' : 'Due Today',
    clear: lang === 'pt' ? 'Limpar filtros' : 'Clear filters',
    searchPlaceholder: lang === 'pt' ? 'Buscar título ou tag…' : 'Search title or tag…'
  },
  columns: {
    noTasks: lang === 'pt' ? 'Sem tarefas' : 'No tasks',
    inProgress: lang === 'pt' ? 'Em andamento' : 'In Progress',
    workInProgress: lang === 'pt' ? 'Em andamento' : 'Work in progress'
  },
  actions: {
    autoAnalyze: lang === 'pt' ? 'Auto‑analisar' : 'Auto‑analyze',
    toggleChat: lang === 'pt' ? 'Alternar chat' : 'Toggle chat'
  },
  card: {
    stale: lang === 'pt' ? 'd parado' : 'd stale',
    highPriority: lang === 'pt' ? 'Alta prioridade' : 'High priority'
  },
  quickCommands: {
    title: lang === 'pt' ? 'Comandos Rápidos' : 'Quick Commands',
    showLess: lang === 'pt' ? 'Mostrar menos' : 'Show less',
    showAll: lang === 'pt' ? 'Mostrar todos' : 'Show all',
    create: lang === 'pt' ? 'Criar' : 'Create',
    move: lang === 'pt' ? 'Mover' : 'Move',
    mark: lang === 'pt' ? 'Marcar' : 'Mark',
    start: lang === 'pt' ? 'Iniciar' : 'Start',
    update: lang === 'pt' ? 'Atualizar' : 'Update',
    tag: lang === 'pt' ? 'Etiquetar' : 'Tag',
    assign: lang === 'pt' ? 'Atribuir' : 'Assign',
    comment: lang === 'pt' ? 'Comentar' : 'Comment',
    list: lang === 'pt' ? 'Listar tarefas' : 'List tasks',
    search: lang === 'pt' ? 'Buscar' : 'Search',
    summary: lang === 'pt' ? 'Resumo do quadro' : 'Board summary',
    preview: lang === 'pt' ? 'Visualizar' : 'Preview',
    done: lang === 'pt' ? 'Concluído' : 'Done'
  }
})

// Default language
export const i18n = t('pt')
