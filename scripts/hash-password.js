// 사용법: node scripts/hash-password.js <password>   (또는 stdin으로 전달: echo -n pw | node scripts/hash-password.js)
// 출력된 줄을 .env의 AUTH_PASS_HASH= 값으로 사용
const crypto = require('crypto');

// scrypt$saltHex$hashHex (server.js 비밀번호 변경에서도 사용)
function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}
module.exports = { hashPassword };

if (require.main === module) {
  const pw = process.argv[2] ?? require('fs').readFileSync(0, 'utf8').replace(/\r?\n$/, '');
  if (!pw) { console.error('비밀번호를 입력하세요.'); process.exit(1); }
  console.log(hashPassword(pw));
}
