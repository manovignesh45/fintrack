const http = require('http');

async function run() {
  const login = await fetch('http://localhost:9695/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'home', password: 'changeme-home-2026' })
  });
  const { token, user } = await login.json();
  
  const ledgersRes = await fetch('http://localhost:9695/api/ledgers', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  const ledgers = await ledgersRes.json();
  const ledgerId = ledgers[0].id;

  const res = await fetch('http://localhost:9695/api/transactions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token,
      'X-Ledger-Id': ledgerId.toString()
    },
    body: JSON.stringify({
      title: "test",
      amount: 1000,
      nature: "EXPENSE",
      source_account_id: 1,
      principal_amount: 0,
      interest_amount: 0,
      transaction_date: "2026-07-10"
    })
  });
  
  console.log(res.status, await res.text());
}
run();
