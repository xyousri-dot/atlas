// Public browser configuration only. Never put service-role or database passwords here.
export const TEST_PROJECT = 'manikkusokwysmdfhxtu';
export const TEST_URL = `https://${TEST_PROJECT}.supabase.co`;
export const TEST_KEY = 'sb_publishable_5bmEwf1-QUsyuH24u_0rGA_uLbN1_rs';

export function testEnvironment(html) {
  const replace = (from, to) => {
    if (!html.includes(from)) throw Error('Test isolation source changed: '+from.slice(0,60));
    html = html.replace(from,to);
  };
  replace('var LKEY2="atlas-local-2";',`var LKEY2="atlas-test-${TEST_PROJECT}-local";`);
  replace('var SBKEY="atlas-sb", SBSKEY="atlas-sb-sessie", SBQKEY="atlas-sb-rij";',
    `var SBKEY="atlas-test-${TEST_PROJECT}-config", SBSKEY="atlas-test-${TEST_PROJECT}-session", SBQKEY="atlas-test-${TEST_PROJECT}-queue";`);
  replace('var SBSTANDAARD={ url:"https://mimpyfbitoiotxuqoymj.supabase.co", key:"sb_publishable_ULPcv7mCZw_95ClYn2PVSA_UGBaHeTu" };',
    `var SBSTANDAARD={ url:${JSON.stringify(TEST_URL)}, key:${JSON.stringify(TEST_KEY)} };`);
  replace('if(!echtAnder){','if(true){ /* Isolated preview: never accept another project. */');
  replace('function sbBasis(){ return String(SB.url||"").replace(/\\/+$/,""); }',
    'function sbBasis(){ return SBSTANDAARD.url; }');
  replace('SB={ url:$("stCloudUrl").value.trim(), key:$("stCloudKey").value.trim() };',
    'SB={ url:SBSTANDAARD.url, key:SBSTANDAARD.key };');
  // The preview has its own push tables, function and signing keys. Keep every
  // browser call pinned to atlas-test; never reuse live devices or credentials.
  replace("var gateway='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbXB5ZmJpdG9pb3R4dXFveW1qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxNzA5OTksImV4cCI6MjEwNTc0Njk5OX0.bK17fj4W4BKESuvxdEAKCtCELprFIvUBbPl-LVhyl2o';",
    `var gateway=${JSON.stringify(TEST_KEY)};`);
  replace("if(!sbKlaar()||sbBasis()!=='https://mimpyfbitoiotxuqoymj.supabase.co')throw Error(phoneText().login);",
    `if(!sbKlaar()||sbBasis()!==${JSON.stringify(TEST_URL)})throw Error(phoneText().login);`);
  html=html.replaceAll('"atlas-ocrkey"',`"atlas-test-${TEST_PROJECT}-ocrkey"`);
  replace('</style>', '</style><div role="status" style="padding:8px;text-align:center;background:#fff0c2;color:#332800;font-weight:700">TEST · Données fictives uniquement · Alleen testgegevens · بيانات تجريبية فقط · <a href="./admin.html">Atlas beheer</a></div>');
  if(html.includes('mimpyfbitoiotxuqoymj')||html.includes('sb_publishable_ULPcv7mCZw'))throw Error('Live database reference leaked into test output');
  return html;
}
export function testAdmin(html){return html.replace('__ATLAS_TEST_ADMIN_CONFIG__',JSON.stringify({url:TEST_URL,key:TEST_KEY,sessionKey:`atlas-test-${TEST_PROJECT}-session`}));}
