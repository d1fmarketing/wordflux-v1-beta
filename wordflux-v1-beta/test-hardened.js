#!/usr/bin/env node

// Test production hardened orchestrator
const API_URL = 'http://localhost:3000/api/chat';

async function testHardened() {
  console.log('🔒 Testing Production Hardened Orchestrator - Deploy #78\n');
  
  // Test 1: Deterministic route - should have no emojis
  console.log('1. Testing deterministic route (no emojis):');
  const res1 = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'create task "Deploy v2" in ready',
      preview: false
    })
  });
  
  const data1 = await res1.json();
  console.log('   Response:', data1.message);
  const hasEmoji = /[✅❌➡️✏️🔍📋💬⚡🏷️👤🚀]/.test(data1.message);
  console.log('   No emojis:', !hasEmoji ? '✅' : '❌');
  console.log('   Word count:', data1.message?.split(' ').length || 0);
  
  // Test 2: Check for banned patterns
  console.log('\n2. Testing for banned patterns:');
  const bannedPatterns = [
    /Let me\b/i,
    /I will\b/i,
    /I'll\b/i,
    /Thinking:/i,
    /Here's\b/i,
    /As an AI\b/i,
    /Great!/i
  ];
  
  let foundBanned = false;
  for (const pattern of bannedPatterns) {
    if (pattern.test(data1.message)) {
      console.log(`   Found banned: ${pattern}`);
      foundBanned = true;
    }
  }
  console.log('   No banned patterns:', !foundBanned ? '✅' : '❌');
  
  // Test 3: Multiple actions (should be concise)
  console.log('\n3. Testing multiple actions (concise format):');
  const res3 = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'move #123 to done',
      preview: false
    })
  });
  
  const data3 = await res3.json();
  console.log('   Response:', data3.message);
  const isPastTense = /Moved|Created|Updated|Tagged|Assigned/.test(data3.message);
  console.log('   Past tense:', isPastTense ? '✅' : '❌');
  
  // Test 4: Preview mode (compact list)
  console.log('\n4. Testing preview mode:');
  const res4 = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'preview: create task "Test" in backlog',
      preview: true
    })
  });
  
  const data4 = await res4.json();
  console.log('   Preview:', data4.message);
  console.log('   Compact:', data4.message?.length < 100 ? '✅' : '❌');
  
  console.log('\n🎯 Hardened Orchestrator Features:');
  console.log('  • System prompt: Zero fluff, outputs only');
  console.log('  • Temperature: 0.1 (ultra-deterministic)');
  console.log('  • Max tokens: 160 (forced conciseness)');
  console.log('  • Banned patterns: No AI narration');
  console.log('  • Confirmations: ≤30 words, past-tense');
  console.log('  • Format: PLAN | CONFIRMATION | ASK | PREVIEW');
  
  console.log('\n✅ Production HARD MODE active.');
}

testHardened().catch(console.error);