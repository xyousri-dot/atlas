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
  // Push is deliberately unavailable until its separate test service is provisioned.
  // Never reuse the live pilot gateway token, subscriptions or sending credentials.
  const start=html.indexOf('async function phoneAPI('), end=html.indexOf('function phoneStartState()',start);
  if(start<0||end<0)throw Error('Push boundary not found');
  html=html.slice(0,start)+"async function phoneAPI(){throw Error(phoneText().pending);}\n"+html.slice(end);
  html=html.replaceAll('"atlas-ocrkey"',`"atlas-test-${TEST_PROJECT}-ocrkey"`);
  replace('</style>', '</style><div role="status" style="padding:8px;text-align:center;background:#fff0c2;color:#332800;font-weight:700">TEST · Données fictives uniquement · Alleen testgegevens · بيانات تجريبية فقط</div>');
  if(html.includes('mimpyfbitoiotxuqoymj')||html.includes('sb_publishable_ULPcv7mCZw'))throw Error('Live database reference leaked into test output');
  return html;
}
