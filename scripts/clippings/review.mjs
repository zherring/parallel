// One-page review of Clippings quotes not yet on a base branch: every new quote with its source link and warning chips
// (secondhand, length, punctuation, lowercase start, translated, http), keyboard marking (j/k, a OK, x flag, n note) saved
// in the browser, and "Export flagged" to paste back into a session.
//
//   npm run clippings:review                 # quotes not on origin/main, opens the page
//   npm run clippings:review -- --base main  # compare against another ref
//   npm run clippings:review -- --no-open --out /tmp/review.html
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { endsLikeASentence, isHttps, looksNonEnglish } from "./lib.ts";
import { tmpdir } from "node:os";
import { join } from "node:path";

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const repo = process.cwd();
const ref = opt("--base", "origin/main");
const out = opt("--out", join(tmpdir(), "clippings-review.html"));
const now = JSON.parse(readFileSync(`${repo}/src/lib/clippings.json`, "utf8"));
const base = JSON.parse(execFileSync("git", ["show", `${ref}:src/lib/clippings.json`], { cwd: repo, maxBuffer: 1 << 28 }).toString());

const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
// Warning chips, using the merge's own rules from lib.ts so the two never drift apart.
const issues = (c) => {
  const q = c.quote.trim(), words = q.split(/\s+/).length, out = [];
  if (c.secondhand) out.push("secondhand");
  if (words > 90) out.push(`long (${words}w)`);
  if (words < 6) out.push(`short (${words}w)`);
  if (/^[a-z]/.test(q)) out.push("starts lowercase");
  if (/,$/.test(q)) out.push("ends with comma");
  else if (!endsLikeASentence(q)) out.push("no end punctuation");
  if (c.original) out.push(`translated (${c.original_lang})`);
  else if (looksNonEnglish(q)) out.push("may not be English");
  if (!isHttps(c.url)) out.push("not https");
  return out;
};

const pairs = Object.entries(now)
  .filter(([k]) => !(k in base))
  .map(([key, e]) => {
    const people = e.tmdb_ids.map((id, i) => ({ id, name: e.pair[i] })).sort((a, b) => a.id - b.id);
    const page = `http://localhost:3000/p/${people.map((p) => `${p.id}-${slug(p.name)}`).join("+")}?view=clippings`;
    const dirs = e.pair.map((n) => e.clippings.filter((c) => c.speaker === n).length);
    return {
      key, pair: e.pair, page, dirs,
      quotes: e.clippings.map((c) => ({ ...c, issues: issues(c), uid: `${key}/${c.id}` })),
    };
  })
  .sort((a, b) => a.pair.join().localeCompare(b.pair.join()));

const total = pairs.reduce((n, p) => n + p.quotes.length, 0);
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Clippings Review</title>
<style>
:root{--bg:#fbfaf7;--fg:#1d1b18;--mute:#6f6a62;--line:#e4e0d8;--card:#fff;--ok:#2f7a4a;--bad:#b3392f;--warn:#9a6a00;--focus:#2b5fd9}
@media (prefers-color-scheme:dark){:root{--bg:#161513;--fg:#ece8e1;--mute:#a19b91;--line:#2f2c28;--card:#1e1c19;--ok:#6cc08b;--bad:#ef7d72;--warn:#e0b54a;--focus:#7aa2ff}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 -apple-system,system-ui,sans-serif}
header{position:sticky;top:0;z-index:2;background:var(--bg);border-bottom:1px solid var(--line);padding:10px 16px;display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center}
header b{font-size:16px}.stat{color:var(--mute);font-size:13px}button,select{font:inherit;font-size:13px;padding:4px 10px;border:1px solid var(--line);background:var(--card);color:var(--fg);border-radius:6px;cursor:pointer}
main{max-width:860px;margin:0 auto;padding:8px 16px 120px}h2{font-size:17px;margin:28px 0 4px}h2 a{color:inherit}.sub{color:var(--mute);font-size:13px;margin-bottom:8px}
.q{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--line);border-radius:8px;padding:12px 14px;margin:8px 0;scroll-margin:90px}
.q.cur{outline:2px solid var(--focus)}.q.ok{border-left-color:var(--ok)}.q.bad{border-left-color:var(--bad)}.q.ok:not(.cur){opacity:.6}
.who{font-size:13px;color:var(--mute)}.who b{color:var(--fg)}.text{font-size:16px;margin:6px 0;white-space:pre-wrap}.orig{font-style:italic;color:var(--mute);font-size:14px}
.meta{font-size:13px;color:var(--mute)}.meta a{color:var(--focus);word-break:break-all}.ctx{font-size:13px;margin-top:4px}
.chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}.chip{font-size:11px;padding:1px 7px;border-radius:99px;border:1px solid var(--warn);color:var(--warn)}
.acts{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}.acts input{flex:1;min-width:160px;font:inherit;font-size:13px;padding:4px 8px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--fg)}
.help{font-size:12px;color:var(--mute);width:100%}kbd{border:1px solid var(--line);border-radius:4px;padding:0 4px;font-size:11px}
#out{position:fixed;inset:auto 16px 16px 16px;max-width:860px;margin:auto;display:none;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px;z-index:3}
#out textarea{width:100%;height:220px;font:12px ui-monospace,monospace;background:var(--bg);color:var(--fg);border:1px solid var(--line)}
</style></head><body>
<header><b>Clippings review</b><span class="stat" id="stat"></span>
<select id="filter"><option value="all">All</option><option value="todo">Unreviewed</option><option value="issues">Has warnings</option><option value="bad">Flagged</option></select>
<button id="export">Export flagged</button>
<span class="help"><kbd>j</kbd>/<kbd>k</kbd> next/prev · <kbd>a</kbd> OK · <kbd>x</kbd> flag · <kbd>u</kbd> clear · <kbd>o</kbd> open source · <kbd>p</kbd> open pair page · <kbd>n</kbd> note</span></header>
<main id="main"></main>
<div id="out"><textarea id="outText" readonly></textarea><button id="close">Close</button></div>
<script>
const PAIRS=${JSON.stringify(pairs).replace(/</g, "\\u003c")};const TOTAL=${total};
const KEY="clippings-review-v1";let S={};try{S=JSON.parse(localStorage.getItem(KEY)||"{}")}catch{}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(S))}catch{}};
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[c]);
const main=document.getElementById("main"),filter=document.getElementById("filter");let cur=0,cards=[];
function render(){const f=filter.value;main.innerHTML="";
for(const p of PAIRS){const qs=p.quotes.filter(q=>{const st=S[q.uid]?.s;return f==="all"||(f==="todo"&&!st)||(f==="issues"&&q.issues.length)||(f==="bad"&&st==="bad")});if(!qs.length)continue;
const sec=document.createElement("section");sec.innerHTML='<h2><a href="'+p.page+'" target="_blank">'+esc(p.pair.join(" & "))+'</a></h2><div class="sub">'+p.dirs[0]+" by "+esc(p.pair[0])+" · "+p.dirs[1]+" by "+esc(p.pair[1])+" · "+p.key+"</div>";
for(const q of qs){const st=S[q.uid]||{};const d=document.createElement("div");d.className="q "+(st.s||"");d.dataset.uid=q.uid;d.dataset.url=q.url;d.dataset.page=p.page+"&quote="+q.id;
d.innerHTML='<div class="who"><b>'+esc(q.speaker)+"</b> on "+esc(q.about)+'</div><div class="text">“'+esc(q.quote)+'”</div>'+(q.original?'<div class="orig">'+esc(q.original)+"</div>":"")+
'<div class="meta">'+esc([q.publication,q.via&&"via "+q.via,q.said_year&&"said "+q.said_year,q.date].filter(Boolean).join(" · "))+' — <a href="'+esc(q.url)+'" target="_blank">'+esc(q.url)+"</a></div>"+
(q.context?'<div class="ctx">'+esc(q.context)+"</div>":"")+(q.issues.length?'<div class="chips">'+q.issues.map(i=>'<span class="chip">'+esc(i)+"</span>").join("")+"</div>":"")+
'<div class="acts"><button data-a="ok">OK</button><button data-a="bad">Flag</button><input placeholder="note" value="'+esc(st.n||"")+'"></div>';
d.querySelectorAll("button").forEach(b=>b.onclick=()=>{mark(q.uid,b.dataset.a);});d.querySelector("input").onchange=e=>{(S[q.uid]??={}).n=e.target.value;save();};
d.onclick=e=>{if(e.target.closest("a,button,input"))return;cur=cards.indexOf(d);focus(false)};sec.appendChild(d)}main.appendChild(sec)}
cards=[...document.querySelectorAll(".q")];cur=Math.min(cur,cards.length-1);focus(false);stat()}
function stat(){const v=Object.values(S);document.getElementById("stat").textContent=PAIRS.length+" pairs · "+TOTAL+" quotes · "+v.filter(x=>x.s==="ok").length+" OK · "+v.filter(x=>x.s==="bad").length+" flagged"}
function focus(scroll=true){cards.forEach(c=>c.classList.remove("cur"));const c=cards[cur];if(!c)return;c.classList.add("cur");if(scroll)c.scrollIntoView({block:"center",behavior:"smooth"})}
function mark(uid,s){const e=S[uid]??={};e.s=s;if(!s)delete e.s;save();const c=cards.find(c=>c.dataset.uid===uid);if(c){c.classList.remove("ok","bad");if(s)c.classList.add(s)}stat()}
document.addEventListener("keydown",e=>{if(e.target.matches("input,textarea,select")){if(e.key==="Escape")e.target.blur();return}const c=cards[cur];
if(e.key==="j"){cur=Math.min(cur+1,cards.length-1);focus()}else if(e.key==="k"){cur=Math.max(cur-1,0);focus()}
else if(c&&e.key==="a"){mark(c.dataset.uid,"ok");cur=Math.min(cur+1,cards.length-1);focus()}else if(c&&e.key==="x"){mark(c.dataset.uid,"bad")}
else if(c&&e.key==="u"){mark(c.dataset.uid,null)}else if(c&&e.key==="o"){window.open(c.dataset.url,"_blank")}else if(c&&e.key==="p"){window.open(c.dataset.page,"_blank")}
else if(c&&e.key==="n"){e.preventDefault();c.querySelector("input").focus()}});
filter.onchange=()=>{cur=0;render()};
document.getElementById("export").onclick=()=>{const lines=[];for(const p of PAIRS)for(const q of p.quotes){const st=S[q.uid];if(st?.s==="bad"||st?.n)lines.push((st.s==="bad"?"FLAG ":"NOTE ")+q.uid+(st.n?" — "+st.n:"")+"\\n    “"+q.quote.slice(0,120)+(q.quote.length>120?"…":"")+"”")}
document.getElementById("outText").value=lines.join("\\n")||"Nothing flagged or noted yet.";document.getElementById("out").style.display="block"};
document.getElementById("close").onclick=()=>document.getElementById("out").style.display="none";
render();
</script></body></html>`;
writeFileSync(out, html);
if (pairs.length === 0) console.log(`No quotes in src/lib/clippings.json that are not on ${ref}.`);
else console.log(`${pairs.length} pairs, ${total} quotes, ${pairs.reduce((n, p) => n + p.quotes.filter((q) => q.issues.length).length, 0)} with warnings -> ${out}`);
if (pairs.length > 0 && !argv.includes("--no-open")) {
  try {
    execFileSync(process.platform === "darwin" ? "open" : "xdg-open", [out]);
  } catch {
    console.log("Could not open a browser; open the file above by hand.");
  }
}
