"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const zod_1 = require("zod");
const taskcafe_client_js_1 = require("./lib/providers/taskcafe-client.js");
const PROJECT_ID = '0fb053f0-9b4c-4edd-8ca1-607882bc2360';
const COLUMNS = {
    BACKLOG: 'a17edba2-6d2c-4376-a87c-3572953ddd5e',
    IN_PROGRESS: '970f2061-bc65-4a3c-94cb-4db563612dc9',
    REVIEW: 'cac31a9a-7b1a-4296-b44e-e02354b5ffd0',
    DONE: '7a281af1-792e-4d6a-a999-2f6bf318b25c'
};
const taskcafe = new taskcafe_client_js_1.TaskCafeClient({
    url: process.env.TASKCAFE_URL || 'http://localhost:3333',
    username: process.env.TASKCAFE_USERNAME || 'admin',
    password: process.env.TASKCAFE_PASSWORD || 'admin123'
});
const server = new mcp_js_1.McpServer({
    name: 'wordflux-board',
    version: '1.0.0'
});
const searchShape = {
    search: zod_1.z.string().describe('Optional: card title or part of it').optional()
};
function normalizeColumnKey(column) {
    return column.toUpperCase().replace(/\s+/g, '_');
}
async function findCard(search, columnName) {
    const tasks = await taskcafe.getTasks(PROJECT_ID);
    if (columnName) {
        const columnId = COLUMNS[normalizeColumnKey(columnName)];
        const filtered = tasks.filter(task => task.column_id === columnId);
        if (!search) {
            return filtered.length === 1 ? filtered[0] : null;
        }
        const searchLower = search.toLowerCase();
        return filtered.find(task => task.title.toLowerCase().includes(searchLower)) || null;
    }
    if (!search)
        return null;
    const searchLower = search.toLowerCase();
    return tasks.find(task => task.title.toLowerCase().includes(searchLower)) || null;
}
async function handleApprove(search) {
    const task = await findCard(search || '', 'Review');
    if (!task) {
        const reviewTasks = (await taskcafe.getTasks(PROJECT_ID)).filter(t => t.column_id === COLUMNS.REVIEW);
        if (reviewTasks.length === 0) {
            return {
                content: [{ type: 'text', text: '❌ No cards found in Review column' }],
                isError: true
            };
        }
        if (reviewTasks.length > 1 && !search) {
            const listing = reviewTasks.slice(0, 5).map(t => `• ${t.title}`).join('\n');
            return {
                content: [{ type: 'text', text: `❌ Found ${reviewTasks.length} cards in Review. Please specify which one:\n${listing}` }],
                isError: true
            };
        }
        return {
            content: [{ type: 'text', text: `❌ Card "${search || ''}" not found in Review` }],
            isError: true
        };
    }
    await taskcafe.moveTask(task.id, COLUMNS.DONE);
    // Comment temporarily disabled due to GraphQL field issue
    // await taskcafe.addComment(task.id, '✅ Approved and moved to Done')
    return {
        content: [{ type: 'text', text: `✅ Approved "${task.title}" and moved to Done` }]
    };
}
async function handleReject(search) {
    const task = await findCard(search || '', 'Review');
    if (!task) {
        return {
            content: [{ type: 'text', text: '❌ Card not found in Review' }],
            isError: true
        };
    }
    await taskcafe.moveTask(task.id, COLUMNS.BACKLOG);
    // Comment temporarily disabled due to GraphQL field issue
    // await taskcafe.addComment(task.id, '❌ Rejected - needs more work')
    return {
        content: [{ type: 'text', text: `❌ Rejected "${task.title}" and moved to Backlog` }]
    };
}
async function handleNeedsWork(search) {
    const task = await findCard(search || '', 'Review');
    if (!task) {
        return {
            content: [{ type: 'text', text: '❌ Card not found in Review' }],
            isError: true
        };
    }
    await taskcafe.moveTask(task.id, COLUMNS.IN_PROGRESS);
    // Comment temporarily disabled due to GraphQL field issue
    // await taskcafe.addComment(task.id, '🔧 Needs more work')
    return {
        content: [{ type: 'text', text: `🔧 "${task.title}" needs more work - moved to In Progress` }]
    };
}
async function handleMoveCard(search, toColumn) {
    const task = await findCard(search);
    if (!task) {
        return {
            content: [{ type: 'text', text: `❌ Card "${search}" not found` }],
            isError: true
        };
    }
    const targetKey = normalizeColumnKey(toColumn);
    const targetColumn = COLUMNS[targetKey];
    await taskcafe.moveTask(task.id, targetColumn);
    return {
        content: [{ type: 'text', text: `✅ Moved "${task.title}" to ${toColumn}` }]
    };
}
async function handleCreateCard(args) {
    const columnName = args.column || 'Backlog';
    const columnId = COLUMNS[normalizeColumnKey(columnName)];
    await taskcafe.createTask(PROJECT_ID, args.title, columnId, args.description);
    return {
        content: [{ type: 'text', text: `✅ Created "${args.title}" in ${columnName}` }]
    };
}
async function handleListCards(column) {
    const tasks = await taskcafe.getTasks(PROJECT_ID);
    let filtered = tasks;
    if (column) {
        const columnId = COLUMNS[normalizeColumnKey(column)];
        filtered = tasks.filter(task => task.column_id === columnId);
    }
    const summary = filtered.map(task => `• ${task.title}`).join('\n');
    return {
        content: [{ type: 'text', text: summary || 'No cards found' }]
    };
}
server.registerTool('approve_card', {
    description: 'Approve a card in Review and move to Done. Finds card by title or uses single card in Review',
    inputSchema: searchShape
}, async ({ search }) => handleApprove(search));
server.registerTool('reject_card', {
    description: 'Reject a card in Review and move to Backlog',
    inputSchema: searchShape
}, async ({ search }) => handleReject(search));
server.registerTool('needs_work', {
    description: 'Move card from Review to In Progress for more work',
    inputSchema: searchShape
}, async ({ search }) => handleNeedsWork(search));
server.registerTool('move_card', {
    description: 'Move any card to any column',
    inputSchema: {
        search: zod_1.z.string().describe('Card title or part of it'),
        to_column: zod_1.z.enum(['Backlog', 'In Progress', 'Review', 'Done']).describe('Target column')
    }
}, async ({ search, to_column }) => handleMoveCard(search, to_column));
server.registerTool('create_card', {
    description: 'Create a new card',
    inputSchema: {
        title: zod_1.z.string().describe('Card title'),
        description: zod_1.z.string().describe('Card description').optional(),
        column: zod_1.z.enum(['Backlog', 'In Progress', 'Review', 'Done']).describe('Target column').optional()
    }
}, async (args) => handleCreateCard(args));
server.registerTool('list_cards', {
    description: 'List all cards or cards in specific column',
    inputSchema: {
        column: zod_1.z.enum(['Backlog', 'In Progress', 'Review', 'Done']).describe('Optional: filter by column').optional()
    }
}, async ({ column }) => handleListCards(column));
async function main() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.error('MCP Server running on stdio');
}
main().catch(error => {
    console.error('[mcp-server] fatal', error);
});
