// feeds.js 단위 테스트: RSS/Atom 파싱, SSRF 가드 (네트워크 불필요)
const { test } = require('node:test');
const assert = require('node:assert');
const { parseFeed, assertPublicUrl } = require('../feeds');

test('parses RSS 2.0 items (CDATA, entities, tags, unsafe links)', () => {
  const xml = `<?xml version="1.0"?><rss version="2.0"><channel><title>채널</title><link>https://blog.example.com</link>
    <item><title><![CDATA[<b>첫 글</b> & 'CDATA']]></title><link>https://blog.example.com/1</link><pubDate>Tue, 03 Nov 2026 10:00:00 GMT</pubDate></item>
    <item><title>Tom &amp; Jerry &lt;3 &#x1F600; &#65;</title><link><![CDATA[https://blog.example.com/2?a=1&b=2]]></link><pubDate>Wed, 04 Nov 2026 10:00:00 GMT</pubDate></item>
    <item><title>나쁜 링크</title><link>javascript:alert(1)</link></item>
    <item><title>   </title><link>https://blog.example.com/empty</link></item>
    ${[5, 6, 7, 8].map(i => `<item><title>글 ${i}</title><link>https://blog.example.com/${i}</link><pubDate>0${i - 4} Oct 2026 00:00:00 GMT</pubDate></item>`).join('')}
  </channel></rss>`;
  const posts = parseFeed(xml);
  assert.strictEqual(posts.length, 5);
  assert.deepStrictEqual(posts[0], { title: 'Tom & Jerry <3 😀 A', url: 'https://blog.example.com/2?a=1&b=2', date: '2026-11-04' });
  assert.deepStrictEqual(posts[1], { title: "첫 글 & 'CDATA'", url: 'https://blog.example.com/1', date: '2026-11-03' });
  assert.ok(posts.every(p => /^https:/.test(p.url)));
});

test('parses Atom entries (link href, updated/published)', () => {
  const xml = `<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Feed</title>
    <link rel="self" href="https://blog.example.com/atom.xml"/>
    <entry><title type="html">&lt;em&gt;Atom&lt;/em&gt; 글</title><link rel="self" href="https://blog.example.com/self"/><link rel="alternate" type="text/html" href="https://blog.example.com/a?x=1&amp;y=2"/><published>2026-10-01T00:00:00Z</published></entry>
    <entry><title>두 번째</title><link href="https://blog.example.com/b"/><updated>2026-10-05T12:00:00+09:00</updated></entry>
    <entry><title>링크 없음</title></entry>
  </feed>`;
  assert.deepStrictEqual(parseFeed(xml), [
    { title: '두 번째', url: 'https://blog.example.com/b', date: '2026-10-05' },
    { title: 'Atom 글', url: 'https://blog.example.com/a?x=1&y=2', date: '2026-10-01' },
  ]);
  assert.deepStrictEqual(parseFeed('not xml'), []);
});

test('SSRF guard rejects non-https and private/loopback targets', async () => {
  for (const u of ['http://127.0.0.1/feed', 'https://127.0.0.1/feed', 'https://10.1.2.3/', 'https://172.20.0.1/', 'https://192.168.0.1/',
    'https://169.254.169.254/latest', 'https://100.64.0.1/', 'https://0.0.0.0/', 'https://[::1]/', 'https://[fd00::1]/', 'https://[fe80::1]/',
    'https://[::ffff:127.0.0.1]/', 'https://localhost/feed', 'file:///etc/passwd']) {
    await assert.rejects(assertPublicUrl(u), u);
  }
  await assertPublicUrl('https://8.8.8.8/'); // 공인 IP 리터럴은 DNS 조회 없이 통과
});
