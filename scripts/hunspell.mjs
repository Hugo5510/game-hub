// Minimal Hunspell affix expander (single-char flags, PFX/SFX with cross product).
import fs from 'node:fs';

export function loadHunspell(affPath, dicPath) {
  const aff = fs.readFileSync(affPath, 'utf8').split(/\r?\n/);
  const rules = {};
  for (let i = 0; i < aff.length; i++) {
    const parts = aff[i].trim().split(/\s+/);
    if ((parts[0] === 'PFX' || parts[0] === 'SFX') && parts.length === 4 && /^[YN]$/.test(parts[2])) {
      const [type, flag, cross, countStr] = parts;
      const count = Number(countStr);
      const entries = [];
      for (let j = 1; j <= count; j++) {
        const p = aff[i + j].trim().split(/\s+/);
        const strip = p[2] === '0' ? '' : p[2];
        const add = (p[3] === '0' ? '' : p[3]).split('/')[0];
        const cond = p[4] ?? '.';
        const re = type === 'SFX' ? new RegExp(cond + '$') : new RegExp('^' + cond);
        entries.push({ strip, add, re });
      }
      rules[flag] = { type, cross: cross === 'Y', entries };
      i += count;
    }
  }
  const dic = fs.readFileSync(dicPath, 'utf8').split(/\r?\n/).slice(1).filter(Boolean);
  const entries = dic.map((line) => {
    const idx = line.indexOf('/');
    return idx < 0 ? { stem: line, flags: '' } : { stem: line.slice(0, idx), flags: line.slice(idx + 1) };
  });
  return { rules, entries };
}

function applySfx(word, rule) {
  const out = [];
  for (const e of rule.entries) {
    if (!e.re.test(word)) continue;
    if (e.strip && !word.endsWith(e.strip)) continue;
    out.push(word.slice(0, word.length - e.strip.length) + e.add);
  }
  return out;
}
function applyPfx(word, rule) {
  const out = [];
  for (const e of rule.entries) {
    if (!e.re.test(word)) continue;
    if (e.strip && !word.startsWith(e.strip)) continue;
    out.push(e.add + word.slice(e.strip.length));
  }
  return out;
}

export function expand({ rules }, { stem, flags }) {
  const forms = new Set([stem]);
  const sfxForms = [stem];
  const pfxFlags = [];
  for (const f of flags) {
    const r = rules[f];
    if (!r) continue;
    if (r.type === 'SFX') for (const w of applySfx(stem, r)) { forms.add(w); if (r.cross) sfxForms.push(w); }
    else pfxFlags.push(r);
  }
  for (const r of pfxFlags) {
    const bases = r.cross ? sfxForms : [stem];
    for (const b of bases) for (const w of applyPfx(b, r)) forms.add(w);
  }
  return [...forms];
}
