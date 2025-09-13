#!/usr/bin/env node

// Test modern microcopy implementation
const API_URL = 'http://localhost:3000/api/chat';

async function testMicrocopy() {
  console.log('🎨 Testing Modern Microcopy - Deploy #77\n');
  
  // Test 1: Verify concise system prompt is working
  console.log('1. Testing concise AI responses:');
  const res1 = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'list tasks',
      preview: false
    })
  });
  
  const data1 = await res1.json();
  const responseLength = data1.message?.split(' ').length || 0;
  console.log(`   Response word count: ${responseLength}`);
  console.log(`   Under 50 words: ${responseLength < 50 ? '✅' : '❌'}`);
  
  // Test 2: Test arrow notation commands
  console.log('\n2. Testing arrow notation (display only):');
  console.log('   Quick commands updated to:');
  console.log('   • Create "Fix login bug" → Backlog');
  console.log('   • Move #12 → Review');
  console.log('   • Mark #15 Done');
  console.log('   • Start #8 (In Progress)');
  
  // Test 3: Verify Portuguese support
  console.log('\n3. Testing Portuguese support:');
  const res3 = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'criar tarefa "Teste em português" em backlog',
      preview: true
    })
  });
  
  const data3 = await res3.json();
  console.log(`   Command understood: ${data3.actions?.length > 0 ? '✅' : '❌'}`);
  console.log(`   Action: ${data3.actions?.[0]?.type || 'none'}`);
  
  console.log('\n✨ Microcopy Updates Applied:');
  console.log('  • Chat empty state: "Clarity in motion."');
  console.log('  • Placeholder: "Type to manage your board…"');
  console.log('  • Toast format: "✅ Applied N changes • Undo: token"');
  console.log('  • Loading state: "Processing…"');
  console.log('  • System prompt: Concise, deterministic (50 words max)');
  console.log('  • Commands: Title-case with arrow notation');
  console.log('\n🎯 Brand voice: Modern, confident, human');
}

testMicrocopy().catch(console.error);