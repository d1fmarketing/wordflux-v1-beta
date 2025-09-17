const { TaskCafeClient } = require('./.next/server/chunks/827.js');

async function test() {
  const client = new TaskCafeClient({
    url: 'http://localhost:8090/jsonrpc.php',
    username: 'jsonrpc',
    password: 'wordflux-api-token-2025'
  });
  
  console.log('Testing getBoardState...');
  const boardState = await client.getBoardState(1, 1);
  
  console.log('Columns:', boardState.columns.map(c => ({
    name: c.name,
    cards: c.cards.length
  })));
  
  console.log('\nBacklog cards:', boardState.columns[0].cards);
  console.log('\nReady cards:', boardState.columns[1].cards);
}

test().catch(console.error);
