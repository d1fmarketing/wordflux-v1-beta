async function test() {
  const response = await fetch('http://localhost:8090/jsonrpc.php', {
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
  
  const data = await response.json();
  const board = data.result;
  
  console.log('Board is array?', Array.isArray(board));
  console.log('Board[0] exists?', !!board[0]);
  console.log('Board[0].columns exists?', !!board[0]?.columns);
  
  if (board && Array.isArray(board) && board[0]?.columns) {
    console.log('\nProcessing columns...');
    board[0].columns.forEach(c => {
      console.log(`Column: ${c.title || c.name}`);
      console.log('  - Has tasks array?', Array.isArray(c.tasks));
      console.log('  - Tasks count:', (c.tasks || []).length);
      if (c.tasks) {
        c.tasks.forEach(t => {
          console.log(`    Task #${t.id}: ${t.title}`);
        });
      }
    });
  }
}

test().catch(console.error);