async function test() {
  console.log('Testing board state API...');
  
  const response = await fetch('http://localhost:3000/api/board/state');
  const data = await response.json();
  
  console.log('Response OK:', data.ok);
  console.log('\nColumns:');
  data.state.columns.forEach(col => {
    console.log(`- ${col.name}: ${col.cards.length} cards`);
    if (col.cards.length > 0) {
      col.cards.forEach(card => {
        console.log(`  #${card.id}: ${card.title}`);
      });
    }
  });
  
  console.log('\n\nTesting Kanboard directly...');
  
  const kanboardResponse = await fetch('http://localhost:8090/jsonrpc.php', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Basic ' + Buffer.from('jsonrpc:wordflux-api-token-2025').toString('base64')
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'getBoard',
      params: { project_id: 1 },
      id: 1
    })
  });
  
  const kanboardData = await kanboardResponse.json();
  console.log('\nKanboard columns:');
  kanboardData.result[0].columns.forEach(col => {
    console.log(`- ${col.title}: ${col.tasks.length} tasks`);
    col.tasks.forEach(task => {
      console.log(`  #${task.id}: ${task.title}`);
    });
  });
}

test().catch(console.error);