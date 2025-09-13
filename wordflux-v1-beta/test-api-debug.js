console.log('Starting API debug...\n');

// First, let's call the API endpoint and see what it returns
fetch('http://localhost:3000/api/board/state')
  .then(res => res.json())
  .then(data => {
    console.log('API Response:');
    console.log('- OK:', data.ok);
    console.log('- Error:', data.error);
    console.log('\nColumns from API:');
    data.state.columns.forEach(col => {
      console.log(`  ${col.name}: ${col.cards.length} cards`);
      col.cards.forEach(card => {
        console.log(`    #${card.id}: ${card.title}`);
      });
    });
  })
  .catch(err => console.error('API Error:', err));