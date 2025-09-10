// Core logic + contextual advice

const FIB_RETRACEMENTS = [0.382, 0.5, 0.618, 0.786, 1.0];
const FIB_EXTENSIONS   = [1.272, 1.618, 2.0, 2.618];
const FIB_TIME_COUNTS  = [13, 21, 34];

function fibLevels(priceA, priceB){
  const rng = priceB - priceA;
  const out = {};
  FIB_RETRACEMENTS.forEach(r => {
    const lvl = priceB - r * rng;
    out[r.toFixed(3)] = round2(lvl);
  });
  return out;
}

function extensionLevels(priceA, priceB){
  const rng = priceB - priceA;
  const out = {};
  FIB_EXTENSIONS.forEach(ext => {
    const lvl = priceB + ext * rng;
    out[ext.toFixed(3)] = round2(lvl);
  });
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
  const m = str.trim().match(/^([0-2]?\d):(\d{2})$/);
  if(!m) return null;
  let hh = parseInt(m[1],10);
  let mm = parseInt(m[2],10);
  if (hh<0||hh>23||mm<0||mm>59) return null;
  return {hh, mm};
}

function timeCountsFromPivot(pivotHHMM){
  const out = [];
  if (!pivotHHMM) {
    FIB_TIME_COUNTS.forEach(c => out.push({count:c, clock:null}));
    return out;
  }
  const t0 = parseHHMM(pivotHHMM);
  if (!t0) {
    FIB_TIME_COUNTS.forEach(c => out.push({count:c, clock:null}));
    return out;
  }
  FIB_TIME_COUNTS.forEach(c => {
    let hh = t0.hh;
    let mm = t0.mm + c;
    hh = (hh + Math.floor(mm/60)) % 24;
    mm = mm % 60;
    out.push({count:c, clock: `${pad2(hh)}:${pad2(mm)}`});
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

// Contextual advice from FVG/BPR/IFVG & Liquidity flags
function contextualAdvice(flags){
  const tips = [];
  if (flags.fvgGolden) {
    tips.push("FVG inside 0.5–0.618 → wait for tap for higher‑conviction continuation.");
  }
  if (flags.fvgDeep) {
    tips.push("Untouched FVG in 0.618–0.786 → expect deeper return before sustained trend.");
  }
  if (flags.bprGolden) {
    tips.push("BPR overlapping 0.5–0.618 → strong reaction zone (support/resistance).");
  }
  if (flags.ifvgDeep) {
    tips.push("IFVG near sweep at 0.618–0.786 → trap risk; reversal flip likely if no expansion.");
  }
  if (flags.bothSidesSwept) {
    tips.push("Both sides swept this hour → time distortion risk; skip until fresh liquidity forms.");
  }
  if (tips.length === 0) tips.push("No advanced context flags set.");
  return tips.join("\n");
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

form.addEventListener('submit', (e)=>{
  e.preventDefault();
  const priceA = parseFloat(document.getElementById('priceA').value);
  const priceB = parseFloat(document.getElementById('priceB').value);
  const bars = parseInt(document.getElementById('bars').value,10);
  const pivotTime = document.getElementById('pivotTime').value.trim();
  const retracePriceStr = document.getElementById('retracePrice').value.trim();
  const retraceBarsStr = document.getElementById('retraceBars').value.trim();
  const nowTime = document.getElementById('nowTime').value.trim();

  if (Number.isNaN(priceA) || Number.isNaN(priceB) || Number.isNaN(bars) || bars < 1){
    alert("Please provide valid A, B, and bars.");
    return;
  }

  const retracePrice = retracePriceStr ? parseFloat(retracePriceStr) : null;
  const retraceBars = retraceBarsStr ? parseInt(retraceBarsStr,10) : null;

  const retrLevels = fibLevels(priceA, priceB);
  const extLevels  = extensionLevels(priceA, priceB);
  const expBars    = expectedRetraceBars(bars);
  const tcounts    = timeCountsFromPivot(pivotTime || null);
  const macroHint  = macroWindowHint(nowTime || pivotTime || "");

  const impulse = {
    direction: (priceB>=priceA) ? "up" : "down",
    price_start: priceA, price_end: priceB,
    range_points: round2(Math.abs(priceB - priceA)),
    bars: bars,
    pivot_end_time: pivotTime || null
  };

  const assess = analyzeRetrace(priceA, priceB, retracePrice, bars, retraceBars);

  const flags = {
    fvgGolden: document.getElementById('flagFvgGolden').checked,
    fvgDeep: document.getElementById('flagFvgDeep').checked,
    bprGolden: document.getElementById('flagBprGolden').checked,
    ifvgDeep: document.getElementById('flagIfvgDeep').checked,
    bothSidesSwept: document.getElementById('flagBothSidesSwept').checked,
  };
  const ctxAdvice = contextualAdvice(flags);

  impulseOut.textContent = fmtJSON(impulse);
  macroOut.textContent = macroHint;
  expBarsOut.textContent = fmtJSON(expBars);
  retrOut.textContent = fmtJSON(retrLevels);
  extOut.textContent  = fmtJSON(extLevels);
  tcountsOut.textContent = fmtJSON(tcounts);
  assessmentOut.textContent = fmtJSON(assess);
  contextOut.textContent = ctxAdvice;

  outSec.classList.remove('hidden');
});

resetBtn.addEventListener('click', ()=>{
  document.getElementById('form').reset();
  outSec.classList.add('hidden');
});
