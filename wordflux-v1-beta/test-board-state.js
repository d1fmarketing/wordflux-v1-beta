const { KanboardClient } = require('./dist/lib/kanboard-client.js')

async function test() {
  const client = new KanboardClient({
    url: 'http://localhost:8090/jsonrpc.php',
    username: 'jsonrpc',
    password: 'wordflux-api-token-2025'
  })

  console.log('Getting board state...')
  const boardState = await client.getBoardState(1)
  
  console.log('Board state:', JSON.stringify(boardState, null, 2))
  console.log('\nSummary:')
  boardState.columns.forEach(col => {
    console.log(`  ${col.name}: ${col.cards.length} tasks`)
  })
}

test().catch(console.error)