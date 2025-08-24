// Personal Stylist Chatbot (no product search) - client-side, rule-based
(function(){
  const style = document.createElement('style');
  style.textContent = `
  .chatbot-fab { position: fixed; right: 18px; bottom: 18px; width: 56px; height: 56px; border-radius: 50%;
    background:#111; color:#fff; display:flex; align-items:center; justify-content:center; cursor:pointer; box-shadow:0 4px 14px rgba(0,0,0,0.2); z-index:9999; }
  .chatbot-panel { position: fixed; right: 18px; bottom: 84px; width: 360px; max-width: 94vw; max-height: 70vh; display:flex; flex-direction:column;
    background:#fff; border:1px solid #eee; border-radius:12px; overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,0.15); z-index:9999; }
  .chatbot-header { padding:10px 12px; background:#111; color:#fff; display:flex; align-items:center; gap:8px; justify-content:space-between; }
  .chatbot-body { padding:10px; overflow:auto; display:flex; flex-direction:column; gap:10px; }
  .chatbot-msg { padding:8px 10px; border-radius:8px; max-width: 85%; font-size:14px; white-space:pre-wrap; }
  .chatbot-user { background:#e8f0fe; align-self:flex-end; }
  .chatbot-bot { background:#f5f5f5; align-self:flex-start; }
  .chatbot-input { display:flex; gap:8px; padding:10px; border-top:1px solid #eee; }
  .chatbot-input input { flex:1; padding:10px; border:1px solid #ccc; border-radius:8px; }
  .chatbot-input button { background:#111; color:#fff; border:0; padding:10px 12px; border-radius:8px; }
  .cb-chips { display:flex; flex-wrap:wrap; gap:6px; }
  .cb-chip { font-size:12px; background:#f0f0f0; border:1px solid #ddd; padding:6px 8px; border-radius:999px; cursor:pointer; }
  .cb-small { font-size:12px; color:#bbb; }
  `;
  document.head.appendChild(style);

  const fab = document.createElement('div');
  fab.className = 'chatbot-fab';
  fab.title = 'Personal Stylist';
  fab.textContent = '💬';

  const panel = document.createElement('div');
  panel.className = 'chatbot-panel';
  panel.style.display = 'none';

  panel.innerHTML = `
    <div class="chatbot-header">
      <div>👗 Personal Stylist</div>
      <button id="cb-reset" style="background:#333;color:#fff;border:0;border-radius:6px;padding:6px 8px;font-size:12px;cursor:pointer;">Reset</button>
    </div>
    <div id="cb-body" class="chatbot-body"></div>
    <div class="chatbot-input">
      <input id="cb-input" type="text" placeholder="Say hi or tell me your skin tone/occasion" />
      <button id="cb-send">Send</button>
    </div>
  `;

  document.body.appendChild(fab);
  document.body.appendChild(panel);

  const body = panel.querySelector('#cb-body');
  const input = panel.querySelector('#cb-input');
  const sendBtn = panel.querySelector('#cb-send');
  const resetBtn = panel.querySelector('#cb-reset');

  // Profile store
  const PKEY = 'stylist_profile:v1';
  function loadProfile(){ try { return JSON.parse(localStorage.getItem(PKEY) || '{}'); } catch { return {}; } }
  function saveProfile(p){ localStorage.setItem(PKEY, JSON.stringify(p || {})); }
  function clearProfile(){ localStorage.removeItem(PKEY); }

  function addMsg(text, who='bot'){
    const div = document.createElement('div');
    div.className = `chatbot-msg chatbot-${who}`;
    div.textContent = text;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
    return div;
  }

  function addChips(chips){
    const wrap = document.createElement('div');
    wrap.className = 'cb-chips';
    for (const c of chips){
      const b = document.createElement('button');
      b.className = 'cb-chip';
      b.textContent = c.text;
      b.addEventListener('click', () => handleUser(c.value || c.text));
      wrap.appendChild(b);
    }
    body.appendChild(wrap);
    body.scrollTop = body.scrollHeight;
    return wrap;
  }

  // Parsing helpers
  function parseSkinTone(msg){
    const m = msg.toLowerCase();
    if (/\bolive\b/.test(m)) return 'olive';
    if (/(deep|dark)\b/.test(m)) return 'deep';
    if (/medium|tan\b/.test(m)) return 'medium';
    if (/light|fair\b/.test(m)) return 'light';
    return null;
  }
  function parseUndertone(msg){
    const m = msg.toLowerCase();
    if (/\bwarm\b/.test(m)) return 'warm';
    if (/\bcool\b/.test(m)) return 'cool';
    if (/neutral\b/.test(m)) return 'neutral';
    return null;
  }
  function parseOccasion(msg){
    const m = msg.toLowerCase();
    if (/wedding|sangeet|mehndi/.test(m)) return 'wedding';
    if (/interview|meeting|office|work/.test(m)) return 'interview';
    if (/date|dinner|party|night out|club/.test(m)) return 'date';
    if (/casual|daily|college|travel|weekend/.test(m)) return 'casual';
    if (/festive|festival|ethnic/.test(m)) return 'festive';
    return null;
  }

  function updateProfileFromMessage(msg){
    const p = loadProfile();
    const st = parseSkinTone(msg); if (st) p.skinTone = st;
    const ut = parseUndertone(msg); if (ut) p.undertone = ut;
    const oc = parseOccasion(msg); if (oc) p.lastOccasion = oc;
    // gender/style keywords (very light parsing)
    if (/\b(men|male|boy)\b/i.test(msg)) p.userType = 'men';
    if (/\b(women|female|girl)\b/i.test(msg)) p.userType = 'women';
    if (/streetwear|sporty|minimal|classic|boho|formal|athleisure|y2k|preppy/i.test(msg)) {
      const m = msg.match(/streetwear|sporty|minimal|classic|boho|formal|athleisure|y2k|preppy/i);
      if (m) p.style = m[0].toLowerCase();
    }
    saveProfile(p);
    return p;
  }

  // Advice engine
  function paletteAdvice(p){
    const st = p.skinTone; const ut = p.undertone;
    const lines = [];
    if (ut === 'warm') {
      lines.push('- Earthy tones: olive, mustard, rust, terracotta');
      lines.push('- Warm brights: coral, tomato red, marigold');
      lines.push('- Neutrals: cream, beige, camel, warm taupe');
      lines.push('- Metals: gold, bronze');
      lines.push('- Avoid: icy pastels that can wash you out');
    } else if (ut === 'cool') {
      lines.push('- Jewel tones: emerald, sapphire, amethyst');
      lines.push('- Cool brights: fuchsia, magenta, cobalt');
      lines.push('- Neutrals: black, charcoal, navy, cool gray');
      lines.push('- Metals: silver, platinum');
      lines.push('- Avoid: overly yellow/orange tones');
    } else if (ut === 'neutral') {
      lines.push('- Versatile: both warm and cool mid-tones');
      lines.push('- Great: teal, dusty rose, soft olive, burgundy');
      lines.push('- Neutrals: ivory, taupe, gray');
      lines.push('- Metals: gold or silver (both work)');
    }
    if (!ut && st === 'olive') {
      lines.push('- Rich tones: teal, plum, burgundy, deep red');
      lines.push('- Earthy greens and browns work well');
      lines.push('- Avoid: neon yellow/green');
    }
    if (!lines.length) {
      lines.push('- Safe picks: navy, charcoal, white/ivory, camel');
      lines.push('- Add a pop: burgundy, forest green, cobalt');
    }
    return `Color palette for you:\n${lines.map(x=>`• ${x}`).join('\n')}`;
  }

  function outfitForOccasion(p, occasion){
    const tone = p.undertone || 'neutral';
    const type = p.userType || 'all';
    const ideas = [];
    const pickNeutral = tone === 'cool' ? 'charcoal or navy' : tone === 'warm' ? 'beige or camel' : 'taupe or gray';
    const pop = tone === 'cool' ? 'jewel-toned (emerald/cobalt)' : tone === 'warm' ? 'earthy (rust/olive/marigold)' : 'balanced (teal/burgundy)';
    if (occasion === 'interview') {
      ideas.push(`- ${pickNeutral} blazer + crisp shirt/tee + tailored pants; subtle ${pop} accessory`);
      ideas.push('- Closed shoes, minimal jewelry; avoid loud prints');
    } else if (occasion === 'date') {
      ideas.push(`- Smart-casual: dark denim + ${pickNeutral} top; add a ${pop} layer (cardigan/blazer)`);
      ideas.push('- Clean sneakers/loafers or low heels; a single statement piece');
    } else if (occasion === 'wedding' || occasion === 'festive') {
      ideas.push(`- Ethnic set in ${pop}; balance with ${pickNeutral} footwear and accessories`);
      ideas.push('- Rich fabrics (silk, brocade) and metallic accents that match your undertone');
    } else if (occasion === 'casual') {
      ideas.push(`- Comfortable basics: tee/shirt + relaxed trousers/denim; layer with ${pickNeutral}`);
      ideas.push('- Keep patterns simple; choose breathable fabrics');
    } else {
      ideas.push(`- Start with ${pickNeutral} base; add a ${pop} pop via top or accessory`);
    }
    return `Outfit ideas (${occasion}):\n${ideas.map(x=>`• ${x}`).join('\n')}`;
  }

  function accessoriesAdvice(p){
    const ut = p.undertone;
    if (ut === 'warm') return 'Accessories: gold/bronze jewelry, tan leather, tortoiseshell frames.';
    if (ut === 'cool') return 'Accessories: silver/platinum jewelry, black leather, clear/black frames.';
    return 'Accessories: gold or silver both work; match metals to outfit tones.';
  }

  function hairColorAdvice(p){
    const ut = p.undertone;
    if (ut === 'warm') return 'Hair: caramel, honey, warm brown, copper, chocolate; avoid ashy tones.';
    if (ut === 'cool') return 'Hair: ash brown, cool black, burgundy, blue-black; avoid overly golden tones.';
    return 'Hair: neutral browns, soft black, muted balayage suit most skin tones.';
  }

  function generateReply(msg){
    const p = updateProfileFromMessage(msg);
    const m = msg.trim().toLowerCase();

    // Greetings
    if (/^(hi|hello|hey|hii+|yo)\b/.test(m)) {
      const intro = 'Hi! How can I help you today? I can suggest colors and outfits based on your skin tone, undertone, and occasion.';
      const prof = p.skinTone || p.undertone ? `\nProfile: skin tone=${p.skinTone||'-'}, undertone=${p.undertone||'-'}` : '';
      addMsg(intro + prof, 'bot');
      addChips([
        { text: 'My skin tone is medium warm' },
        { text: 'Colors that suit me' },
        { text: 'Outfit for interview' },
        { text: 'Outfit for date night' },
      ]);
      return;
    }

    // Quick intents
    if (/color(s)?\b.*(suit|work|good)/.test(m) || /palette|undertone|skin tone/.test(m)) {
      addMsg(paletteAdvice(p), 'bot');
      addMsg(accessoriesAdvice(p), 'bot');
      return;
    }

    const occ = parseOccasion(m);
    if (occ) {
      addMsg(outfitForOccasion(p, occ), 'bot');
      addMsg(accessoriesAdvice(p), 'bot');
      return;
    }

    if (/hair(\s|-)color|dye|highlights/.test(m)) {
      addMsg(hairColorAdvice(p), 'bot');
      return;
    }

    if (/reset|clear profile/.test(m)) {
      clearProfile();
      addMsg('Profile cleared. Tell me your skin tone/undertone again 😊', 'bot');
      return;
    }

    // If user provided new profile info
    if (/skin|tone|undertone|warm|cool|neutral|olive|fair|medium|deep/.test(m)) {
      addMsg('Got it! I updated your profile. Ask me: “Colors that suit me” or “Outfit for interview”.', 'bot');
      return;
    }

    // Default: general styling advice
    const generic = [
      'Tip: Pick a base neutral (navy/charcoal/ivory/camel) and add one color that flatters your undertone.',
      'Fit matters more than price—tailor key pieces like trousers and blazers.',
      'Limit statement items to one per outfit to keep it balanced.'
    ].join('\n• ');
    addMsg('Here are some quick tips:\n• ' + generic, 'bot');
  }

  async function callLLM(messages){
    try {
      const profile = loadProfile();
      const resp = await fetch('/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages, profile }) });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      return data.reply || 'Sorry, I could not generate a reply.';
    } catch (e) {
      return 'Sorry, I had trouble connecting. Please try again.';
    }
  }

  async function handleUser(msg){
    addMsg(msg, 'user');
    // Update profile from free text
    const p = updateProfileFromMessage(msg);
    // Use LLM backend for natural talk
    const historyNodes = Array.from(body.querySelectorAll('.chatbot-msg')).map(el => ({
      role: el.classList.contains('chatbot-user') ? 'user' : 'assistant',
      content: el.textContent
    }));
    const messages = historyNodes.concat([{ role: 'user', content: msg }]).slice(-12);
    const reply = await callLLM(messages);
    addMsg(reply, 'bot');
  }

  function greet(){
    addMsg("Hi! I'm your personal stylist. Say ‘hi’ to begin or tell me your skin tone/undertone.", 'bot');
    const p = loadProfile();
    if (p.skinTone || p.undertone) {
      addMsg(`I remember you: skin tone=${p.skinTone||'-'}, undertone=${p.undertone||'-'}`, 'bot');
    }
    addChips([
      { text: 'Hi' },
      { text: 'My skin tone is olive' },
      { text: 'Colors that suit me' },
      { text: 'Outfit for wedding' },
    ]);
  }

  fab.addEventListener('click', () => {
    const open = panel.style.display !== 'none';
    panel.style.display = open ? 'none' : 'flex';
    if (!open && body.childElementCount === 0) {
      greet();
    }
  });

  sendBtn.addEventListener('click', () => {
    const v = input.value.trim(); if (!v) return; input.value=''; handleUser(v);
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { sendBtn.click(); }});
  resetBtn.addEventListener('click', () => {
    clearProfile();
    // Clear chat history and show fresh greeting
    body.innerHTML = '';
    greet();
  });
})();