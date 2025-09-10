// Enhanced static app with: auto bars, A+ score, copy & download, tolerance, HTF bias, presets, FVG helper

const FIB_RETRACEMENTS = [0.382, 0.5, 0.618, 0.786, 1.0];
const FIB_EXTENSIONS   = [1.272, 1.618, 2.0, 2.618];
const FIB_TIME_COUNTS  = [13, 21, 34];

function fibLevels(priceA, priceB){
  const rng = priceB - priceA;
  const out = {};
  FIB_RETRACEMENTS.forEach(r => { out[r.toFixed(3)] = round2(priceB - r * rng); });
  return out;
}
function extensionLevels(priceA, priceB){
  const rng = priceB - priceA;
  const out = {};
  FIB_EXTENSIONS.forEach(ext => { out[ext.toFixed(3)] = round2(priceB + ext * rng); });
  return out;
}
function expectedRetraceBars(nBars){
  const minB = Math.max(1, Math.round(nBars * 0.382));
  const midB = Math.max(1, Math.round(nBars * 0.50));
  const maxB = Math.max(1, Math.round(nBars * 0.618));
  return {min: minB, mid: midB, max: maxB};
}
function parseHHMM(str){
  if (!str) return null;
  const m = str.trim().match(/^([0-2]?\\d):(\\d{2})$/);
  if(!m) return null;
  let hh = parseInt(m[1],10), mm = parseInt(m[2],10);
  if (hh<0||hh>23||mm<0||mm>59) return null;
  return {hh, mm};
}
function minutesBetween(a, b){
  if(!a || !b) return null;
  let da = a.hh*60 + a.mm, db = b.hh*60 + b.mm;
  let d = db - da;
  if (d < 0) d += 24*60;
  return d;
}
function timeCountsFromPivot(pivotHHMM){
  const out = [];
  if (!pivotHHMM) { FIB_TIME_COUNTS.forEach(c => out.push({count:c, clock:null})); return out; }
  const t0 = parseHHMM(pivotHHMM);
  if (!t0) { FIB_TIME_COUNTS.forEach(c => out.push({count:c, clock:null})); return out; }
  FIB_TIME_COUNTS.forEach(c => {
    let hh = t0.hh, mm = t0.mm + c;
    hh = (hh + Math.floor(mm/60)) % 24; mm = mm % 60;
    out.push({count:c, clock:`${pad2(hh)}:${pad2(mm)}`});
  });
  return out;
}
function macroWindowHint(nowHHMMOrPivot){
  const t = parseHHMM(nowHHMMOrPivot);
  if(!t) return "No time or bad format. Macro window check skipped.";
  if (t.mm >= 45 || t.mm < 15) return "Inside macro window (:45–:15) — expansion probability ↑";
  return "Outside macro window (:15–:45) — consolidation probability ↑";
}
function analyzeRetrace(priceA, priceB, retracePrice, nImpBars, retraceBars){
  const rng = Math.abs(priceB - priceA) || 1e-9;
  const notes = {};
  if (retracePrice !== null && !Number.isNaN(retracePrice)) {
    const depth = Math.abs(priceB - retracePrice)/rng;
    if (depth < 0.382) notes.price_depth = "Shallow (<0.382) — imbalance risk / may chop";
    else if (depth < 0.5) notes.price_depth = "Moderate (0.382–0.5) — OK if time aligns";
    else if (depth < 0.618) notes.price_depth = "Golden zone (≈0.5) — strong if time aligns";
    else if (depth < 0.786) notes.price_depth = "Golden zone (≈0.618) — strong if time aligns";
    else if (depth < 1.0) notes.price_depth = ">0.786 — reversal risk unless reclaimed";
    else notes.price_depth = "At/through origin (≥1.0) — reversal confirmed/likely";
  }
  if (retraceBars !== null && !Number.isNaN(retraceBars)) {
    const ratio = retraceBars / Math.max(1,nImpBars);
    if (ratio < 0.3 && retracePrice !== null && !Number.isNaN(retracePrice)) {
      const depth = Math.abs(priceB - retracePrice)/rng;
      if (depth >= 0.618) notes.time_speed = "Deep retrace in <0.3× impulse time — aggressive reversal risk";
      else notes.time_speed = "Fast retrace — needs structure/trigger to validate continuation";
    } else if (ratio >= 0.382 && ratio <= 0.618) {
      notes.time_speed = "Retrace time ≈ 0.382–0.618× impulse — healthy";
    } else if (ratio > 1.0) {
      notes.time_speed = "Retrace time > impulse time without expansion — reversal/weakness risk";
    } else {
      notes.time_speed = "Time not proportionate — caution";
    }
  }
  notes.invalidation = "Close beyond 0.786 against setup biases reversal. | Close through origin (1.0) confirms reversal.";
  return notes;
}
function contextualAdvice(flags){
  const tips = [];
  if (flags.fvgGolden) tips.push("FVG inside 0.5–0.618 → wait for tap for higher‑conviction continuation.");
  if (flags.fvgDeep) tips.push("Untouched FVG in 0.618–0.786 → expect deeper return before sustained trend.");
  if (flags.bprGolden) tips.push("BPR overlapping 0.5–0.618 → strong reaction zone (support/resistance).");
  if (flags.ifvgDeep) tips.push("IFVG near sweep at 0.618–0.786 → trap risk; reversal flip likely if no expansion.");
  if (flags.bothSidesSwept) tips.push("Both sides swept this hour → time distortion risk; skip until fresh liquidity forms.");
  if (tips.length === 0) tips.push("No advanced context flags set.");
  return tips.join("\\n");
}
function scoreAPlus({priceA, priceB, bars, retracePrice, retraceBars, pivotTime, tolBars, flags}){
  let score = 0;
  const details = {};
  const rng = Math.abs(priceB - priceA) || 1e-9;
  let c1=false;
  if (retracePrice!=null && !Number.isNaN(retracePrice)){
    const depth = Math.abs(priceB - retracePrice)/rng;
    c1 = (depth >= 0.5 - 1e-6 && depth <= 0.618 + 1e-6);
  }
  if (c1) score++; details["1_price_0.5_0.618"]=c1;
  let c2=false;
  if (retraceBars!=null && !Number.isNaN(retraceBars)){
    const ratio = retraceBars / Math.max(1,bars);
    c2 = (ratio >= 0.382 && ratio <= 0.618);
  }
  if (c2) score++; details["2_time_proportion"]=c2;
  let c3=false;
  const t = parseHHMM(pivotTime);
  if (t && retraceBars!=null){
    c3 = (Math.abs(retraceBars-13) <= tolBars) || (Math.abs(retraceBars-21) <= tolBars) || (Math.abs(retraceBars-34) <= tolBars);
  }
  if (c3) score++; details["3_fib_count_hit"]=c3;
  const brokeStructure = Math.abs(priceB - priceA) >= 20;
  if (brokeStructure) score++; details["4_anchor_broke_structure"]=brokeStructure;
  const c5 = !flags.ifvgDeep;
  if (c5) score++; details["5_no_0.786_close_proxy"]=c5;
  const c6 = !flags.bothSidesSwept;
  if (c6) score++; details["6_liquidity_context_proxy"]=c6;
  details["7_trigger_manual"]="Engulfing / displacement / BOS within 3 bars of time line";
  const c8 = !flags.bothSidesSwept;
  if (c8) score++; details["8_not_time_distortion_proxy"]=c8;
  return {score, details};
}
function biasBadgeText(assessment){
  const p = assessment.price_depth || "";
  const t = assessment.time_speed || "";
  if (p.includes("At/through origin") || p.includes(">0.786 — reversal") || t.includes("reversal")) return {text:"Bias: Reversal Risk", cls:"risk"};
  if (p.includes("Golden zone") && t.includes("healthy")) return {text:"Bias: Continuation (A‑grade)", cls:"good"};
  if (p.includes("Moderate") && t.includes("healthy")) return {text:"Bias: Continuation (B‑grade)", cls:"good"};
  if (t.includes("Fast retrace") || t.includes("Time not proportionate")) return {text:"Bias: Caution", cls:"warn"};
  return {text:"Bias: Mixed", cls:"warn"};
}
function round2(x){ return Math.round((x + Number.EPSILON)*100)/100 }
function pad2(n){ return (n<10? '0':'') + n }
function fmtJSON(obj){ return JSON.stringify(obj, null, 2) }

const form = document.getElementById('form');
const resetBtn = document.getElementById('resetBtn');
const outSec = document.getElementById('output');
const impulseOut = document.getElementById('impulseOut');
const macroOut = document.getElementById('macroOut');
const expBarsOut = document.getElementById('expBarsOut');
const retrOut = document.getElementById('retrOut');
const extOut = document.getElementById('extOut');
const tcountsOut = document.getElementById('tcountsOut');
const assessmentOut = document.getElementById('assessmentOut');
const contextOut = document.getElementById('contextOut');
const scoreOut = document.getElementById('scoreOut');
const biasBadge = document.getElementById('biasBadge');
const qualityBadge = document.getElementById('qualityBadge');
const copyBtn = document.getElementById('copyBtn');
const downloadBtn = document.getElementById('downloadBtn');

// Auto-calc bars from times and disable input
const startTimeInput = document.getElementById('startTime');
const pivotTimeInput = document.getElementById('pivotTime');
const barsInput = document.getElementById('bars');
function updateBarsFromTimes(){
  const st = parseHHMM(startTimeInput.value.trim());
  const pt = parseHHMM(pivotTimeInput.value.trim());
  const auto = minutesBetween(st, pt);
  if (auto !== null && auto > 0){
    barsInput.value = String(auto);
    barsInput.disabled = true;
  } else {
    barsInput.disabled = false;
  }
}
['input','change'].forEach(evt=>{
  startTimeInput.addEventListener(evt, updateBarsFromTimes);
  pivotTimeInput.addEventListener(evt, updateBarsFromTimes);
});
updateBarsFromTimes();

// Bias & theme helpers
const biasSelect = document.getElementById('htfBias');
function applyBodyTheme(direction){
  document.body.classList.toggle('bearish', direction === 'bear');
}
function currentBias(priceA, priceB){
  const sel = biasSelect.value;
  if (sel === 'bull') return 'bull';
  if (sel === 'bear') return 'bear';
  return (priceB >= priceA) ? 'bull' : 'bear';
}
function applyBadgesThemeFromBias(bias){
  applyBodyTheme(bias === 'bear' ? 'bear' : 'bull');
}

// Session presets set nowTime hint
const sessionPreset = document.getElementById('sessionPreset');
const nowTimeInput = document.getElementById('nowTime');
sessionPreset.addEventListener('change', ()=>{
  const v = sessionPreset.value;
  const map = {
    "pre":"08:15",
    "open":"09:55",
    "mid":"10:55",
    "lunch":"12:15",
    "pm":"13:55",
    "close":"15:15"
  };
  nowTimeInput.value = map[v] || "";
});

// FVG helper
const fvgTop = document.getElementById('fvgTop');
const fvgBottom = document.getElementById('fvgBottom');
const fvgDir = document.getElementById('fvgDir');
const fvgOut = document.getElementById('fvgOut');
const checkFvgBtn = document.getElementById('checkFvgBtn');
function overlap(rangeA, rangeB){
  const lo = Math.max(rangeA[0], rangeB[0]);
  const hi = Math.min(rangeA[1], rangeB[1]);
  return (hi > lo) ? {len: hi - lo, lo, hi} : {len:0, lo:null, hi:null};
}
checkFvgBtn.addEventListener('click', ()=>{
  const priceA = parseFloat(document.getElementById('priceA').value);
  const priceB = parseFloat(document.getElementById('priceB').value);
  if (Number.isNaN(priceA) || Number.isNaN(priceB)){
    alert("Enter impulse A and B first.");
    return;
  }
  const retrLevels = fibLevels(priceA, priceB);
  const gbLo = Math.min(retrLevels["0.500"], retrLevels["0.618"]);
  const gbHi = Math.max(retrLevels["0.500"], retrLevels["0.618"]);
  const dbLo = Math.min(retrLevels["0.618"], retrLevels["0.786"]);
  const dbHi = Math.max(retrLevels["0.618"], retrLevels["0.786"]);

  const top = parseFloat(fvgTop.value);
  const bot = parseFloat(fvgBottom.value);
  if (Number.isNaN(top) || Number.isNaN(bot)){
    alert("Please provide both Gap Top and Gap Bottom.");
    return;
  }
  const fLo = Math.min(top, bot);
  const fHi = Math.max(top, bot);

  const oGolden = overlap([gbLo, gbHi], [fLo, fHi]);
  const oDeep   = overlap([dbLo, dbHi], [fLo, fHi]);

  let lines = [];
  lines.push(`Golden box [${gbLo.toFixed(2)}, ${gbHi.toFixed(2)}] overlap: ${oGolden.len.toFixed(2)} (${oGolden.lo!==null?`${oGolden.lo.toFixed(2)}→${oGolden.hi.toFixed(2)}`:"none"})`);
  lines.push(`Deep box [${dbLo.toFixed(2)}, ${dbHi.toFixed(2)}] overlap: ${oDeep.len.toFixed(2)} (${oDeep.lo!==null?`${oDeep.lo.toFixed(2)}→${oDeep.hi.toFixed(2)}`:"none"})`);

  if (oGolden.len>0){
    lines.push("→ FVG overlaps 0.5–0.618: high‑conviction continuation if tapped during Fib time.");
  }
  if (oDeep.len>0){
    lines.push("→ FVG overlaps 0.618–0.786: expect deeper return before sustained trend (or reversal risk if fast/early).");
  }
  if (oGolden.len===0 && oDeep.len===0){
    lines.push("→ No overlap with prime retrace zones; treat with caution.");
  }
  fvgOut.textContent = lines.join("\\n");
});

form.addEventListener('submit', (e)=>{
  e.preventDefault();
  const priceA = parseFloat(document.getElementById('priceA').value);
  const priceB = parseFloat(document.getElementById('priceB').value);
  let bars = parseInt(document.getElementById('bars').value,10);
  const startTimeStr = document.getElementById('startTime').value.trim();
  const startTime = parseHHMM(startTimeStr);
  const pivotTimeStr = document.getElementById('pivotTime').value.trim();
  const pivotTime = parseHHMM(pivotTimeStr);
  const retracePriceStr = document.getElementById('retracePrice').value.trim();
  const retraceBarsStr = document.getElementById('retraceBars').value.trim();
  const nowTime = document.getElementById('nowTime').value.trim();
  const tolBars = parseInt(document.getElementById('tolBars').value,10) || 0;

  if (Number.isNaN(priceA) || Number.isNaN(priceB)){
    alert("Please provide valid A and B.");
    return;
  }

  const autoBars = minutesBetween(startTime, pivotTime);
  if (autoBars !== null && autoBars > 0) bars = autoBars;

  const retracePrice = retracePriceStr ? parseFloat(retracePriceStr) : null;
  const retraceBars = retraceBarsStr ? parseInt(retraceBarsStr,10) : null;

  const retrLevels = fibLevels(priceA, priceB);
  const extLevels  = extensionLevels(priceA, priceB);
  const expBars    = expectedRetraceBars(bars);
  const tcounts    = timeCountsFromPivot(pivotTimeStr || null);
  const macroHint  = macroWindowHint(nowTime || pivotTimeStr || "");

  const impulse = {
    direction: (priceB>=priceA) ? "up" : "down",
    price_start: priceA, price_end: priceB,
    range_points: round2(Math.abs(priceB - priceA)),
    bars: bars,
    start_time: startTimeStr || null,
    pivot_end_time: pivotTimeStr || null
  };

  const flags = {
    fvgGolden: document.getElementById('flagFvgGolden').checked,
    fvgDeep: document.getElementById('flagFvgDeep').checked,
    bprGolden: document.getElementById('flagBprGolden').checked,
    ifvgDeep: document.getElementById('flagIfvgDeep').checked,
    bothSidesSwept: document.getElementById('flagBothSidesSwept').checked,
  };

  const assess = analyzeRetrace(priceA, priceB, retracePrice, bars, retraceBars);
  const ctxAdvice = contextualAdvice(flags);
  const scoreObj = scoreAPlus({priceA, priceB, bars, retracePrice, retraceBars, pivotTime:pivotTimeStr, tolBars, flags});

  const bias = currentBias(priceA, priceB);
  applyBadgesThemeFromBias(bias);

  impulseOut.textContent = fmtJSON(impulse);
  macroOut.textContent = macroHint;
  expBarsOut.textContent = fmtJSON(expBars);
  retrOut.textContent = fmtJSON(retrLevels);
  extOut.textContent  = fmtJSON(extLevels);
  tcountsOut.textContent = fmtJSON(tcounts);
  assessmentOut.textContent = fmtJSON(assess);
  contextOut.textContent = ctxAdvice;
  scoreOut.textContent = fmtJSON(scoreObj);

  const biasObj = biasBadgeText(assess);
  biasBadge.textContent = biasObj.text + ` • HTF: ${bias.toUpperCase()}`;
  biasBadge.className = "badge " + biasObj.cls;
  qualityBadge.textContent = `Quality: ${scoreObj.score}/7 (criterion #7 is manual trigger)`;
  qualityBadge.className = "badge " + (scoreObj.score>=6 ? "good" : scoreObj.score>=4 ? "warn" : "risk");

  window._lastResult = {
    impulse, retrLevels, extLevels, expBars, tcounts, macroHint, assess, ctxAdvice, score:scoreObj, bias
  };

  outSec.classList.remove('hidden');
});

resetBtn.addEventListener('click', ()=>{
  document.getElementById('form').reset();
  outSec.classList.add('hidden');
});

const copyBtn = document.getElementById('copyBtn');
const downloadBtn = document.getElementById('downloadBtn');
copyBtn.addEventListener('click', ()=>{
  if (!window._lastResult) return;
  const txt = fmtJSON(window._lastResult);
  navigator.clipboard.writeText(txt).then(()=> alert("Results copied to clipboard."));
});
downloadBtn.addEventListener('click', ()=>{
  if (!window._lastResult) return;
  const blob = new Blob([fmtJSON(window._lastResult)], {type:"application/json"});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = "nq_fib_time_result.json";
  a.click();
});
