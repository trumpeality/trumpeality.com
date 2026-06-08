const https = require('https');
const fs = require('fs');

const SHEET_ID = '1JYmSI7r2TlIgH9lj8-S_m6wQ_icLpMOK-CBqew8bmwE';
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;

function fetchSheet() {
  return new Promise((resolve, reject) => {
    https.get(SHEET_URL, (res) => {
      console.log('Response status:', res.statusCode);
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('Raw response length:', data.length);
        console.log('First 200 chars:', data.substring(0, 200));
        try {
          const json = JSON.parse(data.substring(data.indexOf('{'), data.lastIndexOf('}') + 1));
          resolve(json);
        } catch (e) {
          reject(new Error('Parse error: ' + e.message));
        }
      });
    }).on('error', reject);
  });
}

function formatDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

(async () => {
  try {
    const sheetData = await fetchSheet();
    console.log('Sheet data keys:', Object.keys(sheetData));
    
    if (!sheetData.table) {
      console.log('No table in response');
      return;
    }
    
    const rows = sheetData.table.rows;
    const headers = sheetData.table.cols.map(c => c.label);
    
    console.log('Headers:', headers);
    console.log('Total rows:', rows ? rows.length : 0);
    
    if (rows && rows.length > 0) {
      console.log('First row sample:', JSON.stringify(rows[0]).substring(0, 300));
    }
    
    const dateIdx = headers.indexOf('DATA');
    const tweetIdx = headers.indexOf('TWEET');
    const sourceIdx = headers.indexOf('STORY SOURCE');
    const analysisIdx = headers.indexOf('ANALYSIS');
    
    console.log('Column indices:', { dateIdx, tweetIdx, sourceIdx, analysisIdx });
    
    const entries = rows
      .map(r => ({
        date: r.c[dateIdx]?.v,
        tweet: r.c[tweetIdx]?.v,
        source: r.c[sourceIdx]?.v,
        analysis: r.c[analysisIdx]?.v
      }))
      .filter(e => e.tweet && e.tweet.length > 20)
      .reverse();
    
    console.log('Filtered entries count:', entries.length);
    
    const archiveHtml = entries.map(e => `
      <article class="archive-entry">
        <div class="archive-date">${formatDate(e.date)}</div>
        <div class="archive-tweet">${escapeHtml(e.tweet)}</div>
        ${e.source ? `<a href="${escapeHtml(e.source)}" target="_blank" rel="noopener" class="archive-source">Read the source article &rarr;</a>` : ''}
      </article>
    `).join('\n');
    
    const template = fs.readFileSync('index.html', 'utf-8');
    const updated = template.replace(
      /<!--ARCHIVE_START-->[\s\S]*?<!--ARCHIVE_END-->/,
      `<!--ARCHIVE_START-->\n${archiveHtml}\n<!--ARCHIVE_END-->`
    );
    
    fs.writeFileSync('index.html', updated);
    console.log(`Updated site with ${entries.length} entries`);
  } catch (err) {
    console.error('Build failed:', err);
    process.exit(1);
  }
})();
