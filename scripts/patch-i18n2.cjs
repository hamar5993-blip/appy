const fs = require('fs');
const path = require('path');
const root = 'C:/Users/עאמר/Documents/GitHub/appy';
const p = path.join(root, 'src/lib/i18n.ts');
let s = fs.readFileSync(p, 'utf8');

const enAnchor = "    wordsLabel: 'words',\n";
if (!s.includes(enAnchor)) { console.log('EN ANCHOR NOT FOUND'); process.exit(1); }
s = s.replace(enAnchor, enAnchor +
  "    voice: 'Voice',\n" +
  "    autoVoice: 'Automatic',\n" +
  "    voiceHint: 'Pick the narrator — Arabic voices from your system appear here.',\n" +
  "    noVoices: 'No voices detected. Your browser/system may not have text-to-speech voices installed.',\n" +
  "    micDictate: 'Dictate',\n" +
  "    listening: 'Listening…',\n" +
  "    micUnsupported: 'Voice input is not supported in this browser.',\n");

const arAnchor = "    wordsLabel: 'كلمة',\n";
if (!s.includes(arAnchor)) { console.log('AR ANCHOR NOT FOUND'); process.exit(1); }
s = s.replace(arAnchor, arAnchor +
  "    voice: 'الصوت',\n" +
  "    autoVoice: 'تلقائي',\n" +
  "    voiceHint: 'اختر صوت الرواية — تظهر هنا الأصوات العربية من نظامك.',\n" +
  "    noVoices: 'لم يتم العثور على أصوات. قد لا يحتوي متصفحك أو نظامك على أصوات نطق مثبتة.',\n" +
  "    micDictate: 'إملاء صوتي',\n" +
  "    listening: 'جارٍ الاستماع…',\n" +
  "    micUnsupported: 'الإدخال الصوتي غير مدعوم في هذا المتصفح.',\n");

fs.writeFileSync(p, s);
console.log('i18n patched — voice:', (s.match(/micDictate/g) || []).length);
