// Builds Słówko word lists:
//  - allowed guesses: every 5-letter form generated from the Polish Hunspell dictionary (dictionary-pl, sjp.pl / OpenOffice PL)
//  - answers: frequent (FrequencyWords, OpenSubtitles 2018) 5-letter lemmas that inflect like nouns, then filtered by a reviewed exclusion list
import fs from 'node:fs';
import path from 'node:path';
import { loadHunspell, expand } from './hunspell.mjs';

const root = path.resolve(import.meta.dirname, '..');
const dict = loadHunspell(path.join(root, 'node_modules/dictionary-pl/index.aff'), path.join(root, 'node_modules/dictionary-pl/index.dic'));
const ALPHA = /^[aąbcćdeęfghijklłmnńoóprsśtuwyzźż]{5}$/;

const allowed = new Set();
const lemmaInfo = new Map();
for (const entry of dict.entries) {
  if (entry.stem[0] !== entry.stem[0].toLowerCase()) continue; // proper names start uppercase
  const forms = expand(dict, entry);
  for (const f of forms) if (ALPHA.test(f)) allowed.add(f);
  if (ALPHA.test(entry.stem) && entry.flags) {
    const prev = lemmaInfo.get(entry.stem) ?? [];
    prev.push(forms);
    lemmaInfo.set(entry.stem, prev);
  }
}

function looksLikeNoun(stem, formsList) {
  if (/ć$|c$/.test(stem) && formsList.some((fs) => fs.some((f) => /łem$|łam$/.test(f)))) return false; // verbs
  for (const forms of formsList) {
    const adj = forms.some((f) => /(ego|emu|ymi|imi)$/.test(f) && f.length >= stem.length);
    const verb = forms.some((f) => /(łem|łam|łeś|łaś|liśmy)$/.test(f));
    if (adj || verb) continue;
    // nouns inflect into several case forms
    const caseForms = forms.filter((f) => f !== stem && f !== 'nie' + stem && !f.startsWith('nie'));
    if (caseForms.length >= 3) return true;
  }
  return false;
}

const freq = fs.readFileSync(path.join(root, 'data-raw/pl_50k.txt'), 'utf8').split('\n').map((l) => l.split(' ')[0]);
const exclude = new Set(fs.readFileSync(path.join(root, 'scripts/words-exclude.txt'), 'utf8').split(/\s+/).filter(Boolean));
const answers = [];
for (const w of freq) {
  if (!ALPHA.test(w) || !lemmaInfo.has(w) || exclude.has(w)) continue;
  if (!looksLikeNoun(w, lemmaInfo.get(w))) continue;
  answers.push(w);
  if (answers.length >= Number(process.env.ANSWERS ?? 1200)) break;
}
for (const a of answers) allowed.add(a);
const allowedSorted = [...allowed].sort();
fs.writeFileSync(path.join(root, 'public/data/words-allowed.txt'), allowedSorted.join('\n'));
fs.writeFileSync(path.join(root, 'src/games/slowko/answers.json'), JSON.stringify(answers));
console.log('allowed', allowedSorted.length, 'answers', answers.length);
