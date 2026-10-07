// Rebuilds content/*.json from the curated lists below + the MIT `word-list` package.
// Usage: pnpm --filter @iedc/shared content:build
// Edit the anagram packs / answer list here, then re-run.
import fs from "node:fs";
import path from "node:path";
import dictPath from "word-list";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const contentDir = path.join(here, "..", "content");

const ANSWERS = `about above actor acute adapt admit adopt adult after again agent agree ahead alarm album alert alien align alive allow alone along alpha alter amaze amber among angel anger angle angry apart apple apply arena argue arise armor array arrow aside asset audio audit avoid award aware awful bacon badge baker basic basin batch beach beard beast began begin being below bench berry birth black blade blame blank blast blaze blend bless blind blink block bloom blown board boast bonus boost booth bound brain brake brand brave bread break breed brick bride brief bring brisk broad broke brown brush buddy build built bunch burst cabin cable camel candy canoe cargo carry catch cause chain chair chalk champ charm chart chase cheap check cheek cheer chess chest chief child chill chips choir chord civic claim class clean clear clerk click cliff climb clock close cloud clown coach coast cocoa coral could count court cover crack craft crane crash crazy cream crisp cross crowd crown crumb crush curve cycle daily dairy dance debug decal delta dense depth diary digit diner dodge doing donut doubt dough draft drain drama dream dress drill drink drive eager eagle early earth eight elbow elder elect email empty enjoy enter entry equal error essay event every exact exist extra fable faint fairy faith false fancy feast fence ferry fever fiber field fifth fifty fight final flame flash fleet flock flood floor flour fluid flute focus force forge forum found frame fresh front frost fruit fully funny gamer genre ghost giant given glass globe glove grace grade grain grand grant grape graph grass great green greet grill grind group guard guess guest guide habit happy harsh heart heavy hello hobby honey horse hotel house human humor hurry ideal image index inner input issue ivory jelly jewel joint joker judge juice jumbo karma kayak knife knock label large laser later laugh layer learn lemon level light limit linen logic lucky lunar lunch magic major mango maple march match mayor medal media melon mercy merit metal meter might minor mixer model money month moral motor mount mouse mouth movie music naive nerve never night ninja noble noise north notch novel nurse ocean offer often olive onion opera orbit order organ other outer owner oxide paint panel panic paper party pasta patch pause peace peach pearl pedal penny phase phone photo piano pilot pixel pizza place plain plane plant plate plaza point polar power press price pride prime print prize proof proud prove pulse punch pupil puppy quack queen quest quick quiet quilt quite quota quote radar radio rainy raise rally ranch range rapid ratio reach react ready realm rebel relax relay reply rider ridge rifle right rival river roast robot rocky rough round route royal rugby ruler rumor salad sauce scale scarf scene scoop score scout seven shade shake shape share shark sharp sheep shelf shell shift shine shiny shirt shock shoot short shout sight silly since skate skill skirt slice slide smart smile smoke snack snake solar solid solve sound south space spare spark speak speed spell spend spice spicy spike spoon sport spray squad stack staff stage stair stamp stand stare start state steam steel stick still stone store storm story stove style sugar sunny super sweet swift swing table taste teach teeth tempo thank theme thick thing think third throw thumb tiger timer title toast token topic total touch tough tower toxic track trade trail train treat trend trial trick truck truly trunk trust truth tulip tutor twist ultra uncle under unity upper urban usual valid value vapor video vital vivid vocal voice wagon waste watch water whale wheel white whole wider witty world worry worth would write wrong yacht young youth zebra `;

const PACKS = [
  { id: "tech", title: "Tech Talk", words: "code bug wifi chip byte data link loop mouse cache pixel cloud robot debug linux macro modem login virus array query stack token cyber cursor python router kernel binary server laptop socket syntax coding script widget gadget sensor update upload github docker deploy driver backup charger hacker browser network compile monitor storage android program startup circuit battery desktop firewall keyboard terminal database software hardware wireless function variable" },
  { id: "campus", title: "Campus Life", words: "exam bunk viva labs mess quiz chai nap note fest gate club canteen library hostel lecture record project college campus student notes marker chalk bench duster proxy result ticket seminar uniform friends lunch coffee snacks warden gossip crush selfie notice marks topper backlog pending deadline semester festival workshop assembly holiday homework internal tutorial syllabus hallway bonfire freshers" },
  { id: "food", title: "Snack Attack", words: "dosa idli vada chai rice dal roti puri tea bun mango curry tikka kulfi halwa puttu appam lassi pulao momos chips toast samosa sambar pickle paneer masala pepper ginger banana butter cheese noodle burger omelet biryani porotta chutney payasam coconut jalebi biscuit popcorn sandwich pancake meatball dumpling" },
  { id: "science", title: "Lab Rats", words: "atom gene cell acid ions mass wave heat star moon orbit comet prime laser force sonar ozone proton photon magnet fusion galaxy planet rocket nebula vector matrix enzyme plasma energy carbon oxygen neuron theorem entropy voltage quantum neutron gravity crystal element formula isotope reactor eclipse spectrum molecule electron asteroid momentum" },
];

const dict = fs.readFileSync(dictPath, "utf8").split("\n").map((w) => w.trim().toLowerCase());

// Word Hunt: valid guesses = every 5-letter word, answers = curated common words.
const valid = new Set(dict.filter((w) => /^[a-z]{5}$/.test(w)));
const answers = [...new Set(ANSWERS.split(/\s+/).filter((w) => /^[a-z]{5}$/.test(w)))];
for (const w of answers) valid.add(w);
fs.writeFileSync(path.join(contentDir, "wordhunt-answers.json"), JSON.stringify(answers));
fs.writeFileSync(path.join(contentDir, "words5.json"), JSON.stringify([...valid].sort().join(" ")));

// Anagram packs: precompute dictionary anagrams so "silent" also accepts "listen".
const byKey = new Map();
for (const w of dict) {
  if (!/^[a-z]{3,8}$/.test(w)) continue;
  const k = [...w].sort().join("");
  if (!byKey.has(k)) byKey.set(k, []);
  byKey.get(k).push(w);
}
const packs = PACKS.map((p) => {
  const words = [...new Set(p.words.split(/\s+/).filter(Boolean))].filter((w) => w.length >= 3 && w.length <= 8);
  const alts = {};
  for (const w of words) {
    const others = (byKey.get([...w].sort().join("")) || []).filter((x) => x !== w);
    if (others.length) alts[w] = others;
  }
  return { id: p.id, title: p.title, words, alts };
});
fs.writeFileSync(path.join(contentDir, "anagram-packs.json"), JSON.stringify(packs, null, 1));
console.log(`answers=${answers.length} valid=${valid.size} packs=${packs.map((p) => `${p.id}:${p.words.length}`).join(",")}`);
