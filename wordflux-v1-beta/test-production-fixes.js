#!/usr/bin/env node

// Test the 3 production fixes
const API_URL = 'http://localhost:3000/api/chat';

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function test1_idempotency() {
  console.log('\n🧪 Test 1: Idempotency with same key');
  
  const idempKey = `test-idemp-${Date.now()}`;
  const payload = {
    message: "create task 'Test Idempotency' in backlog",
    preview: false
  };
  
  // First request
  const res1 = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempKey
    },
    body: JSON.stringify(payload)
  });
  
  const data1 = await res1.json();
  const idemp1 = res1.headers.get('X-Idempotency');
  console.log('  Request 1:', {
    status: res1.status,
    idempotency: idemp1,
    ok: data1.ok,
    message: data1.message?.substring(0, 50)
  });
  
  // Second request with same key
  await delay(100);
  const res2 = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempKey
    },
    body: JSON.stringify(payload)
  });
  
  const data2 = await res2.json();
  const idemp2 = res2.headers.get('X-Idempotency');
  console.log('  Request 2:', {
    status: res2.status,
    idempotency: idemp2,
    ok: data2.ok,
    message: data2.message?.substring(0, 50)
  });
  
  // Check if response was cached
  const passed = idemp1 === 'MISS' && idemp2 === 'HIT' && 
                 JSON.stringify(data1) === JSON.stringify(data2);
  
  console.log(passed ? '  ✅ PASSED: Idempotency working (HIT on 2nd request)' : 
                       '  ❌ FAILED: Idempotency not working');
  
  return passed;
}

async function test2_title_preservation() {
  console.log('\n🧪 Test 2: Title case preservation');
  
  const testCases = [
    { 
      message: "create task 'Fix Critical Security Bug' in backlog",
      expected: 'Fix Critical Security Bug'
    },
    {
      message: 'create task "Add OAuth2 Support" in ready',
      expected: 'Add OAuth2 Support'
    }
  ];
  
  let allPassed = true;
  
  for (const test of testCases) {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: test.message, preview: false })
    });
    
    const data = await res.json();
    
    // Check in results for the created task title
    const createdTitle = data.results?.[0]?.data?.title || 
                        data.actions?.[0]?.title ||
                        '';
    
    const passed = createdTitle === test.expected;
    
    console.log(`  Input: "${test.message}"`);
    console.log(`  Expected: "${test.expected}"`);
    console.log(`  Got: "${createdTitle}"`);
    console.log(passed ? '  ✅ Case preserved' : '  ❌ Case not preserved');
    
    allPassed = allPassed && passed;
    await delay(500); // Space out requests
  }
  
  return allPassed;
}

async function test3_rate_limiting() {
  console.log('\n🧪 Test 3: Rate limiting (30 req/min)');
  
  // Send rapid requests
  const results = [];
  for (let i = 0; i < 35; i++) {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        message: `list tasks`, 
        preview: true 
      })
    });
    
    results.push({
      num: i + 1,
      status: res.status,
      limit: res.headers.get('X-RateLimit-Limit'),
      remaining: res.headers.get('X-RateLimit-Remaining'),
      reset: res.headers.get('X-RateLimit-Reset')
    });
    
    if (res.status === 429) {
      console.log(`  Rate limited at request #${i + 1}`);
      break;
    }
    
    // Small delay to avoid overwhelming
    if (i % 10 === 0) {
      console.log(`  Sent ${i + 1} requests...`);
    }
    await delay(50);
  }
  
  const limited = results.some(r => r.status === 429);
  const limitAt = results.findIndex(r => r.status === 429) + 1;
  
  console.log(`  Total requests sent: ${results.length}`);
  console.log(`  Rate limited: ${limited ? `Yes (at request #${limitAt})` : 'No'}`);
  
  // Check a few samples
  const samples = [0, Math.floor(results.length/2), results.length-1];
  samples.forEach(i => {
    if (results[i]) {
      console.log(`  Request #${results[i].num}: Status ${results[i].status}`);
    }
  });
  
  const passed = limited && limitAt > 25 && limitAt <= 35;
  console.log(passed ? '  ✅ PASSED: Rate limiting working (~30 req/min)' : 
                       '  ❌ FAILED: Rate limiting not working correctly');
  
  return passed;
}

async function runAllTests() {
  console.log('🚀 Testing Production Fixes\n');
  console.log('API URL:', API_URL);
  console.log('Time:', new Date().toISOString());
  
  const results = {
    idempotency: await test1_idempotency(),
    titlePreservation: await test2_title_preservation(),
    rateLimiting: await test3_rate_limiting()
  };
  
  console.log('\n📊 Summary:');
  console.log('  Idempotency:', results.idempotency ? '✅' : '❌');
  console.log('  Title Preservation:', results.titlePreservation ? '✅' : '❌');
  console.log('  Rate Limiting:', results.rateLimiting ? '✅' : '❌');
  
  const allPassed = Object.values(results).every(r => r);
  console.log('\n' + (allPassed ? '🎉 ALL TESTS PASSED!' : '⚠️ Some tests failed'));
  
  process.exit(allPassed ? 0 : 1);
}

runAllTests().catch(console.error);