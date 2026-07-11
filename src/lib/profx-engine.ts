import { PROFX_SYSTEM_PROMPT } from "./profx-system-prompt";

export type ChatRole = "user" | "assistant";
export interface ChatTurn {
  role: ChatRole;
  content: string;
}

export interface ProfXReply {
  reply: string;
  // Serialized JSON of { original: string; corrected: string; explanation: string } or null
  correction: string | null;
}

interface GrammarRule {
  test: RegExp;
  fix: (match: RegExpMatchArray, original: string) => string;
  reason: string;
}

const THIRD_PERSON_MAP: Record<string, string> = {
  go: "goes",
  like: "likes",
  want: "wants",
  need: "needs",
  have: "has",
  do: "does",
  work: "works",
  live: "lives",
  play: "plays",
  study: "studies",
  watch: "watches",
  eat: "eats",
  drink: "drinks",
  read: "reads",
  write: "writes",
  come: "comes",
  make: "makes",
  take: "takes",
  give: "gives",
  see: "sees",
  know: "knows",
  think: "thinks",
  feel: "feels",
  believe: "believes",
  love: "loves",
  hate: "hates",
  understand: "understands",
  speak: "speaks",
  teach: "teaches",
  help: "helps",
  walk: "walks",
  run: "runs",
  talk: "talks",
  listen: "listens",
  call: "calls",
  buy: "buys",
  sell: "sells",
  meet: "meets",
  stay: "stays",
  try: "tries",
  cry: "cries",
  fly: "flies",
  wash: "washes",
  finish: "finishes",
  miss: "misses",
  fix: "fixes",
  kiss: "kisses",
};

const FROM_THIRD_PERSON_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(THIRD_PERSON_MAP).map(([base, thirdPerson]) => [thirdPerson, base])
);

const BASE_TO_GERUND: Record<string, string> = {
  go: "going",
  eat: "eating",
  play: "playing",
  study: "studying",
  work: "working",
  read: "reading",
  write: "writing",
  watch: "watching",
  sleep: "sleeping",
  walk: "walking",
  run: "running",
  drive: "driving",
  cook: "cooking",
  talk: "talking",
  listen: "listening",
  come: "coming",
  do: "doing",
  make: "making",
  take: "taking",
  give: "giving",
  see: "seeing",
  buy: "buying",
  sell: "selling",
  meet: "meeting",
  call: "calling",
  help: "helping",
  learn: "learning",
  teach: "teaching",
  live: "living",
  stay: "staying",
  wait: "waiting",
  visit: "visiting",
  send: "sending",
  bring: "bringing",
  leave: "leaving",
  arrive: "arriving",
  join: "joining",
  use: "using",
  open: "opening",
  close: "closing",
  build: "building",
  grow: "growing",
};

const GERUND_TO_BASE: Record<string, string> = Object.fromEntries(
  Object.entries(BASE_TO_GERUND).map(([base, gerund]) => [gerund, base])
);

const APOSTROPHE_MAP: Record<string, string> = {
  dont: "don't",
  cant: "can't",
  wont: "won't",
  isnt: "isn't",
  arent: "aren't",
  wasnt: "wasn't",
  werent: "weren't",
  hasnt: "hasn't",
  havent: "haven't",
  didnt: "didn't",
  doesnt: "doesn't",
  shouldnt: "shouldn't",
  wouldnt: "wouldn't",
  couldnt: "couldn't",
  hadnt: "hadn't",
  mustnt: "mustn't",
  im: "I'm",
  ive: "I've",
  youre: "you're",
  youve: "you've",
  theyre: "they're",
  theyve: "they've",
  whats: "what's",
  thats: "that's",
  lets: "let's",
};

const UNCOUNTABLE_MAP: Record<string, string> = {
  advices: "advice",
  informations: "information",
  furnitures: "furniture",
  peoples: "people",
  staffs: "staff",
  equipments: "equipment",
  luggages: "luggage",
  baggages: "baggage",
  feedbacks: "feedback",
  homeworks: "homework",
  knowledges: "knowledge",
  softwares: "software",
  evidences: "evidence",
  musics: "music",
  childs: "children",
  foots: "feet",
  tooths: "teeth",
};

interface PrepositionRule {
  word: string;
  wrongPreps: string[];
  correctPrep: string;
}

const PREPOSITION_RULES: PrepositionRule[] = [
  { word: "afraid", wrongPreps: ["from"], correctPrep: "of" },
  { word: "capable", wrongPreps: ["to"], correctPrep: "of" },
  { word: "responsible", wrongPreps: ["of"], correctPrep: "for" },
  { word: "listen", wrongPreps: ["at", "of"], correctPrep: "to" },
  { word: "arrive", wrongPreps: ["to"], correctPrep: "at" },
  { word: "congratulate", wrongPreps: ["for"], correctPrep: "on" },
  { word: "apologize", wrongPreps: ["about", "of"], correctPrep: "for" },
  { word: "consist", wrongPreps: ["in", "from"], correctPrep: "of" },
  { word: "deal", wrongPreps: ["about"], correctPrep: "with" },
  { word: "insist", wrongPreps: ["to", "for"], correctPrep: "on" },
  { word: "participate", wrongPreps: ["at", "to"], correctPrep: "in" },
  { word: "rely", wrongPreps: ["to", "at"], correctPrep: "on" },
  { word: "succeed", wrongPreps: ["to", "at"], correctPrep: "in" },
  { word: "suffer", wrongPreps: ["with", "for"], correctPrep: "from" },
  { word: "differ", wrongPreps: ["with", "to"], correctPrep: "from" },
  { word: "familiar", wrongPreps: ["to", "of"], correctPrep: "with" },
  { word: "proud", wrongPreps: ["for", "from"], correctPrep: "of" },
  { word: "satisfied", wrongPreps: ["of", "from"], correctPrep: "with" },
  { word: "similar", wrongPreps: ["as", "with"], correctPrep: "to" },
  { word: "aware", wrongPreps: ["about", "from"], correctPrep: "of" },
  { word: "composed", wrongPreps: ["from"], correctPrep: "of" },
  { word: "famous", wrongPreps: ["of", "from"], correctPrep: "for" },
  { word: "worried", wrongPreps: ["for", "of"], correctPrep: "about" },
  { word: "excited", wrongPreps: ["for", "of"], correctPrep: "about" },
  { word: "fond", wrongPreps: ["with"], correctPrep: "of" },
  { word: "bad", wrongPreps: ["in"], correctPrep: "at" },
  { word: "dependent", wrongPreps: ["of", "from"], correctPrep: "on" },
  { word: "addicted", wrongPreps: ["with", "in"], correctPrep: "to" },
  { word: "allergic", wrongPreps: ["with", "from"], correctPrep: "to" },
  { word: "ashamed", wrongPreps: ["for", "from"], correctPrep: "of" },
  { word: "committed", wrongPreps: ["for", "with"], correctPrep: "to" },
  { word: "concerned", wrongPreps: ["for", "of"], correctPrep: "about" },
  { word: "dedicated", wrongPreps: ["for", "with"], correctPrep: "to" },
  { word: "devoted", wrongPreps: ["for", "with"], correctPrep: "to" },
  { word: "equipped", wrongPreps: ["of", "to"], correctPrep: "with" },
  { word: "exposed", wrongPreps: ["with", "for"], correctPrep: "to" },
  { word: "focused", wrongPreps: ["to", "in"], correctPrep: "on" },
  { word: "guilty", wrongPreps: ["for", "from"], correctPrep: "of" },
  { word: "incapable", wrongPreps: ["to"], correctPrep: "of" },
  { word: "involved", wrongPreps: ["at"], correctPrep: "in" },
  { word: "jealous", wrongPreps: ["from", "for"], correctPrep: "of" },
  { word: "keen", wrongPreps: ["for"], correctPrep: "on" },
  { word: "limited", wrongPreps: ["with", "for"], correctPrep: "to" },
  { word: "married", wrongPreps: ["with"], correctPrep: "to" },
  { word: "obsessed", wrongPreps: ["of", "for"], correctPrep: "with" },
  { word: "opposed", wrongPreps: ["for", "with"], correctPrep: "to" },
  { word: "prepared", wrongPreps: ["of"], correctPrep: "for" },
  { word: "qualified", wrongPreps: ["of", "in"], correctPrep: "for" },
  { word: "related", wrongPreps: ["of", "for"], correctPrep: "to" },
  { word: "resistant", wrongPreps: ["of", "for"], correctPrep: "to" },
  { word: "sensitive", wrongPreps: ["for", "from"], correctPrep: "to" },
  { word: "suitable", wrongPreps: ["with", "of"], correctPrep: "for" },
  { word: "suspicious", wrongPreps: ["for", "with"], correctPrep: "of" },
  { word: "sympathetic", wrongPreps: ["for", "of"], correctPrep: "to" },
  { word: "tolerant", wrongPreps: ["for", "with"], correctPrep: "of" },
  { word: "typical", wrongPreps: ["for", "to"], correctPrep: "of" },
  { word: "good", wrongPreps: ["in"], correctPrep: "at" },
  { word: "depend", wrongPreps: ["of"], correctPrep: "on" },
  { word: "discuss", wrongPreps: ["about"], correctPrep: "" },
  { word: "explain", wrongPreps: ["about"], correctPrep: "" },
  { word: "reply", wrongPreps: ["of"], correctPrep: "to" },
];

const COMPARATIVES =
  "bigger|smaller|faster|slower|taller|shorter|older|younger|stronger|weaker|cheaper|richer|poorer|higher|lower|longer|harder|softer|hotter|colder|warmer|cooler|wiser|kinder|nicer|cleaner|safer|later|closer|larger|wider|narrower|deeper|better|easier";
const SUPERLATIVES =
  "biggest|smallest|fastest|slowest|tallest|shortest|oldest|youngest|strongest|weakest|cheapest|richest|poorest|highest|lowest|longest|hardest|softest|hottest|coldest|warmest|coolest|wisest|kindest|nicest|cleanest|safest|latest|closest|largest|widest|narrowest|deepest|best";

const AM_IS_ARE_ADJECTIVE_EXCEPTIONS = new Set(["live", "open", "close"]);
const AM_IS_ARE_BASE_VERBS = Object.keys(BASE_TO_GERUND)
  .filter((v) => !AM_IS_ARE_ADJECTIVE_EXCEPTIONS.has(v))
  .join("|");
const THIRD_PERSON_BASE_VERBS = Object.keys(THIRD_PERSON_MAP).join("|");
const THIRD_PERSON_FORMS = Object.keys(FROM_THIRD_PERSON_MAP).join("|");
const TO_GERUND_TRIGGERS =
  "want|need|like|have|try|plan|hope|decide|forget|manage|offer|promise|refuse|agree|afford|love|expect|wish|choose|fail|intend|deserve|pretend|seem|tend";

function buildContractionRules(): GrammarRule[] {
  return Object.entries(APOSTROPHE_MAP).map(([wrong, right]) => ({
    test: new RegExp(`\\b${wrong}\\b`, "i"),
    fix: () => right,
    reason: `the correct form is "${right}" (with an apostrophe).`,
  }));
}

function buildUncountableRules(): GrammarRule[] {
  return Object.entries(UNCOUNTABLE_MAP).map(([wrong, right]) => ({
    test: new RegExp(`\\b${wrong}\\b`, "i"),
    fix: () => right,
    reason: `"${right}" doesn't take a plural "-s" form here.`,
  }));
}

function buildPrepositionRules(): GrammarRule[] {
  const rules: GrammarRule[] = [];
  for (const { word, wrongPreps, correctPrep } of PREPOSITION_RULES) {
    if (!correctPrep) continue;
    for (const wrongPrep of wrongPreps) {
      rules.push({
        test: new RegExp(`\\b${word}\\s+${wrongPrep}\\b`, "i"),
        fix: () => `${word} ${correctPrep}`,
        reason: `the correct preposition after "${word}" is "${correctPrep}".`,
      });
    }
  }
  return rules;
}

const RULES: GrammarRule[] = [
  // --- Exact Match requested in user image ---
  {
    test: /\bfor my education purposes?\b/i,
    fix: () => "It's for my education.",
    reason: "We usually say 'for my education' or 'for educational purposes' to sound more natural.",
  },
  {
    test: /\bfor my educational purpose\b/i,
    fix: () => "It's for my education.",
    reason: "We usually say 'for my education' or 'for educational purposes' to sound more natural.",
  },

  // --- Subject/verb agreement (be & have) ---
  {
    test: /\b(he|she|it) (have|are)\b/i,
    fix: (m) => `${m[1]} ${/are/i.test(m[2]) ? "is" : "has"}`,
    reason: "he/she/it takes \"has\" and \"is\", not \"have\"/\"are\".",
  },
  {
    test: /\b(they|we|you) (has|is)\b/i,
    fix: (m) => `${m[1]} ${/is/i.test(m[2]) ? "are" : "have"}`,
    reason: "they/we/you take \"have\" and \"are\", not \"has\"/\"is\".",
  },
  {
    test: /\bi (?:has|is)\b/i,
    fix: (m) => m[0].replace(/has|is/i, (w) => (/is/i.test(w) ? "am" : "have")),
    reason: "\"I\" always pairs with \"am\" or \"have\", not \"is\"/\"has\".",
  },
  {
    test: /\b(he|she|it) don'?t\b/i,
    fix: (m) => `${m[1]} doesn't`,
    reason: "with he/she/it, we use \"doesn't\" instead of \"don't\".",
  },
  {
    test: /\bi doesn'?t\b/i,
    fix: () => "I don't",
    reason: "\"I\" pairs with \"don't\", not \"doesn't\".",
  },

  // --- Present-simple third-person agreement ---
  {
    test: new RegExp(`\\b(he|she|it)\\s+(${THIRD_PERSON_BASE_VERBS})\\b`, "i"),
    fix: (m) => `${m[1]} ${THIRD_PERSON_MAP[m[2].toLowerCase()] ?? `${m[2]}s`}`,
    reason: "with he/she/it in the present tense, verbs need an -s ending.",
  },
  {
    test: new RegExp(`\\b(they|we|you|i)\\s+(${THIRD_PERSON_FORMS})\\b`, "i"),
    fix: (m) => `${m[1]} ${FROM_THIRD_PERSON_MAP[m[2].toLowerCase()] ?? m[2]}`,
    reason: "with I/we/you/they, verbs stay in their base form (no -s ending).",
  },

  // --- Present continuous formed incorrectly (am/is/are + base verb) ---
  {
    test: new RegExp(`\\b(am|is|are)\\s+(${AM_IS_ARE_BASE_VERBS})\\b`, "i"),
    fix: (m) => `${m[1]} ${BASE_TO_GERUND[m[2].toLowerCase()] ?? `${m[2]}ing`}`,
    reason: "after \"am/is/are\", we use the -ing form of the verb.",
  },

  // --- Modal verbs never take "to" before the base verb ---
  {
    test: /\b(can|could|should|would|will|must|might|may)\s+to\s+/i,
    fix: (m) => `${m[1]} `,
    reason: "modal verbs (can, should, must, etc.) are followed directly by the base verb, without \"to\".",
  },

  // --- "want to going" style errors: base form after "to" ---
  {
    test: new RegExp(`\\b(${TO_GERUND_TRIGGERS})\\s+to\\s+(\\w+ing)\\b`, "i"),
    fix: (m) => {
      const base = GERUND_TO_BASE[m[2].toLowerCase()];
      return base ? `${m[1]} to ${base}` : m[0];
    },
    reason: "after \"to\", we use the base form of the verb, not the -ing form.",
  },

  // --- Comparatives / superlatives doubled up ---
  {
    test: new RegExp(`\\bmore (${COMPARATIVES})\\b`, "i"),
    fix: (m) => m[1],
    reason: "this word is already comparative, so \"more\" isn't needed.",
  },
  {
    test: new RegExp(`\\bmost (${SUPERLATIVES})\\b`, "i"),
    fix: (m) => m[1],
    reason: "this word is already superlative, so \"most\" isn't needed.",
  },

  // --- "a" / "an" mismatches ---
  {
    test: /\ba\s+(?!uni|use\b|user|usual|union|unit|european|once\b)([aeiouAEIOU]\w*)\b/i,
    fix: (m) => `an ${m[1]}`,
    reason: "\"a\" changes to \"an\" before a word that starts with a vowel sound.",
  },
  {
    test: /\ban\s+(?!hour\b|honest|honor|heir)([^aeiouAEIOU\s]\w*)\b/i,
    fix: (m) => `a ${m[1]}`,
    reason: "\"an\" is only used before a word that starts with a vowel sound.",
  },

  // --- Double negatives ---
  {
    test: /\b(don'?t|doesn'?t|didn'?t|can'?t|won'?t)\s+(have|get|want|need|know|see|do)\s+no\b/i,
    fix: (m) => `${m[1]} ${m[2]} any`,
    reason: "English avoids double negatives — use \"any\" instead of \"no\" here.",
  },
  {
    test: /\b(don'?t|doesn'?t|didn'?t|can'?t|won'?t)\s+(do|say|know|see|want)\s+nothing\b/i,
    fix: (m) => `${m[1]} ${m[2]} anything`,
    reason: "English avoids double negatives — use \"anything\" instead of \"nothing\" here.",
  },

  // --- Common set phrases / word confusions ---
  {
    test: /\bmore better\b/i,
    fix: () => "better",
    reason: "\"better\" is already comparative, so \"more\" isn't needed.",
  },
  {
    test: /\bi have (\d+) years?\b(?! old)/i,
    fix: (m) => `I am ${m[1]} years old`,
    reason: "for age in English we say \"I am ... years old\", not \"I have\".",
  },
  {
    test: /\bsince (\d+) (?:years?|months?|days?)\b/i,
    fix: (m) => m[0].replace(/^since/i, "for"),
    reason: "\"for\" is used with a duration, while \"since\" marks a starting point in time.",
  },
  {
    test: /\bi am agree\b/i,
    fix: () => "I agree",
    reason: "\"agree\" is a verb in English, so it doesn't need \"am\" before it.",
  },
  {
    test: /\bi am understand\b/i,
    fix: () => "I understand",
    reason: "\"understand\" is already a full verb, so \"am\" isn't needed.",
  },
  {
    test: /\bi am interesting in\b/i,
    fix: () => "I am interested in",
    reason: "\"interested\" describes how you feel; \"interesting\" describes the thing itself.",
  },
  {
    test: /\bi am boring\b/i,
    fix: () => "I am bored",
    reason: "\"bored\" describes your feeling; \"boring\" describes something that causes that feeling.",
  },
  {
    test: /\bcan able to\b/i,
    fix: () => "am able to",
    reason: "\"can\" and \"able to\" both express ability, so we use only one of them.",
  },
  {
    test: /\byesterday i go\b/i,
    fix: () => "yesterday I went",
    reason: "with \"yesterday\" we need the past tense \"went\", not \"go\".",
  },
  {
    test: /\blast night i go\b/i,
    fix: () => "last night I went",
    reason: "with \"last night\" we need the past tense \"went\", not \"go\".",
  },
  {
    test: /\bi didn'?t went\b/i,
    fix: () => "I didn't go",
    reason: "after \"didn't\" we use the base form \"go\", not the past form \"went\".",
  },
  {
    test: /\bhow you (doing|feeling|going)\b/i,
    fix: (m) => `how are you ${m[1]}`,
    reason: "this question needs the auxiliary verb \"are\".",
  },
  {
    test: /\bwhat you (doing|thinking|saying)\b/i,
    fix: (m) => `what are you ${m[1]}`,
    reason: "this question needs the auxiliary verb \"are\".",
  },

  ...buildContractionRules(),
  ...buildUncountableRules(),
  ...buildPrepositionRules(),
  {
    test: /\bdiscuss about\b/i,
    fix: () => "discuss",
    reason: "\"discuss\" already means \"talk about\", so \"about\" is unnecessary.",
  },
  {
    test: /\bexplain about\b/i,
    fix: () => "explain",
    reason: "\"explain\" doesn't need \"about\" before its object.",
  },
];

function applyMechanicalPolish(text: string): string {
  let result = text;
  const firstAlphaMatch = result.match(/[a-zA-Z]/);
  if (firstAlphaMatch && firstAlphaMatch.index !== undefined) {
    const idx = firstAlphaMatch.index;
    result = result.slice(0, idx) + result[idx].toUpperCase() + result.slice(idx + 1);
  }
  result = result.replace(/\bi\b/g, "I");
  result = result.replace(/([.!?]\s+)([a-z])/g, (_m, p1: string, p2: string) => p1 + p2.toUpperCase());
  return result;
}

function findCorrection(userText: string): { original: string; corrected: string; explanation: string } | null {
  const trimmed = userText.trim();
  for (const rule of RULES) {
    const match = trimmed.match(rule.test);
    if (match) {
      const fixedFragment = rule.fix(match, trimmed);
      const correctedSentence = trimmed.replace(rule.test, fixedFragment);
      const polished = applyMechanicalPolish(correctedSentence);
      return {
        original: match[0],
        corrected: polished,
        explanation: rule.reason,
      };
    }
  }
  return null;
}

const BENGALI_RANGE = /[\u0980-\u09FF]/;

function isBengali(text: string): boolean {
  return BENGALI_RANGE.test(text);
}

const STUCK_HINTS = [
  "help",
  "confused",
  "don't understand",
  "dont understand",
  "bujhi na",
  "বুঝি না",
  "বুঝina",
  "কি বলবো",
  "ki bolbo",
  "translate",
  "মানে কি",
  "mane ki",
];

function looksStuck(text: string): boolean {
  const lower = text.toLowerCase();
  return STUCK_HINTS.some((hint) => lower.includes(hint.toLowerCase()));
}

function energyLevel(text: string): "excited" | "formal" | "neutral" {
  const exclaimCount = (text.match(/!/g) || []).length;
  const excitedWords = /\b(awesome|amazing|great|love|excited|yay|wow|fantastic|super)\b/i;
  if (exclaimCount >= 1 || excitedWords.test(text)) return "excited";
  const formalWords = /\b(regarding|therefore|furthermore|kindly|would like to|greetings|sincerely)\b/i;
  if (formalWords.test(text)) return "formal";
  return "neutral";
}

// ---------------------------------------------------------------------------
// Specialized, topic-aware conversation state for realistic fallback replies!
// ---------------------------------------------------------------------------
export type ProfXTopicId = "casual" | "interview" | "travel" | "academic" | "story" | "debate";

const TOPIC_FOLLOW_UPS: Record<ProfXTopicId, string[]> = {
  interview: [
    "That is highly professional. Could you share a quick overview of your background and why you want this role?",
    "Excellent! What do you consider to be your greatest professional strength in this area?",
    "Very well said. How do you handle stressful situations or tight deadlines under pressure?",
    "Fascinating. Where do you see your career going in the next three to five years?",
    "That makes perfect sense. Can you describe a challenging project you successfully managed or helped with?",
    "Good! Do you have any questions for me as your potential employer?",
  ],
  travel: [
    "That sounds amazing! What is the absolute favorite country or city that you have ever visited?",
    "Oh, I love that. Do you prefer relaxing beach vacations, or exploring busy historic cities?",
    "Indeed! What is the most memorable local food you have tried during your travels?",
    "Fascinating. If you could pack your bags and fly anywhere tomorrow morning, where would you go?",
    "Lovely! Do you prefer traveling alone, or do you enjoy going with family and friends?",
    "Beautiful scenery is always a plus. What is the most beautiful natural landmark you have ever captured?",
  ],
  academic: [
    "An intellectual pursuit! What subject or research topic are you currently most passionate about?",
    "Thought-provoking. Do you prefer studying scientific subjects, or do you enjoy literature and the arts?",
    "Indeed. How do you think artificial intelligence will shape the future of modern education?",
    "A great perspective. Are you currently working on any research paper, presentation, or thesis?",
    "Do you believe that self-study is more effective than traditional classroom learning?",
    "Fascinating. What is the most challenging academic book or article you have read recently?",
  ],
  story: [
    "I love stories! Go ahead — what is a funny or memorable event that happened to you recently?",
    "Oh wow! What happened next in your story? I'm eager to hear!",
    "Haha, that's amazing! How did you and the other people involved react to that?",
    "Incredible. Looking back at it now, what is the main lesson you took away from that event?",
    "That is so heartwarming. Do you have any other favorite childhood memories you'd like to share?",
    "Wow, what a twist! What do you think makes a story truly captivating to listen to?",
  ],
  debate: [
    "Let's debate! To kick off, do you think working from home is better than working in an office?",
    "I see your point, but some might argue the opposite. What is your strongest argument for that stance?",
    "Interesting! But don't you think social media does more harm to society than good?",
    "That is a fair argument! What about this: do you think books are always better than their movie adaptations?",
    "Well said! Let's try another: do you think technology is making us more connected or more isolated?",
    "A sharp point! How would you respond to someone who disagrees with your perspective on this?",
  ],
  casual: [
    "How has your day been going so far?",
    "What is your favorite way to spend a quiet evening after work or study?",
    "Have you watched any good movies or listened to any great music lately?",
    "What's something that made you smile or laugh today?",
    "Do you have any exciting plans or goals for the upcoming weekend?",
    "How do you usually unwind and relax when you've had a busy week?",
  ],
};

function inferTopic(userText: string, history: ChatTurn[]): ProfXTopicId {
  const lowerText = userText.toLowerCase();

  // 1) Explicit detection via starters/keywords
  if (/\b(interview|mock|employer|job|role|resume|hire)\b/i.test(lowerText)) return "interview";
  if (/\b(travel|trip|visit|country|city|scenery|beach|vacation)\b/i.test(lowerText)) return "travel";
  if (/\b(academic|study|studying|university|subject|literature|thesis|research|course)\b/i.test(lowerText)) return "academic";
  if (/\b(story|childhood|memorable|happened|funny story|joke)\b/i.test(lowerText)) return "story";
  if (/\b(debate|agree|disagree|argument|opinion|social media|technology)\b/i.test(lowerText)) return "debate";
  if (/\b(weekend|weekend plans|casual|hobbies|music|movies|today)\b/i.test(lowerText)) return "casual";

  // 2) Look through history
  for (const turn of history) {
    const content = turn.content.toLowerCase();
    if (/\binterview\b/i.test(content)) return "interview";
    if (/\btravel\b/i.test(content)) return "travel";
    if (/\bacadem/i.test(content)) return "academic";
    if (/\bstory\b/i.test(content)) return "story";
    if (/\bdebate\b/i.test(content)) return "debate";
  }

  return "casual";
}

function pickFollowUp(history: ChatTurn[], topic: ProfXTopicId): string {
  const used = new Set(history.filter((h) => h.role === "assistant").map((h) => h.content));
  const pool = TOPIC_FOLLOW_UPS[topic] || TOPIC_FOLLOW_UPS.casual;
  const candidates = pool.filter((q) => !used.has(q));
  const selectedList = candidates.length > 0 ? candidates : pool;
  return selectedList[Math.floor(Math.random() * selectedList.length)];
}

const GREETINGS = /^(hi|hello|hey|yo|good morning|good evening|good afternoon|start|শুরু|হ্যালো|হাই)[\s!.,]*$/i;

function greetingReply(): ProfXReply {
  return {
    reply:
      "Hey there! I'm English BRo, your English speaking partner. 😊 We'll just chat naturally, and I'll gently polish your grammar and phrasing as we go. So, tell me — how has your day been so far?",
    correction: null,
  };
}

function aboutMeReply(): ProfXReply {
  return {
    reply:
      "I'm English BRo — think of me as your friendly English speaking coach, here to help you sound more natural and confident. I'll chat with you, correct small mistakes gently, and keep the conversation flowing. What would you like to talk about today?",
    correction: null,
  };
}

function stuckReply(userText: string): ProfXReply {
  const opener = isBengali(userText)
    ? "কোনো সমস্যা নেই! আস্তে আস্তে বলুন, আমি সাহায্য করছি।"
    : "No worries at all — take your time!";
  return {
    reply: `${opener} Try to say it in simple words, even if it's not perfect — that's exactly how we improve. Can you try describing it again in one or two short sentences?`,
    correction: null,
  };
}

function acknowledgement(tone: "excited" | "formal" | "neutral", topic: ProfXTopicId): string {
  if (topic === "interview") {
    return "Understood. That is a crucial perspective.";
  }
  if (topic === "academic") {
    return "Very thought-provoking study point.";
  }
  if (tone === "excited") {
    const options = ["That's a fantastic goal!", "Wow, I love that energy!", "That's really exciting to hear!"];
    return options[Math.floor(Math.random() * options.length)];
  }
  if (tone === "formal") {
    const options = ["Thank you for sharing that.", "I appreciate you explaining that.", "That's a thoughtful point."];
    return options[Math.floor(Math.random() * options.length)];
  }
  const options = ["Got it, thanks for sharing!", "Nice, I see what you mean.", "That makes sense.", "Interesting!"];
  return options[Math.floor(Math.random() * options.length)];
}

function buildFallbackReply(userText: string, history: ChatTurn[], explicitTopic?: ProfXTopicId): ProfXReply {
  const trimmed = userText.trim();

  if (GREETINGS.test(trimmed)) return greetingReply();
  if (/\b(who are you|what('|’)?s your name|your name)\b/i.test(trimmed)) return aboutMeReply();
  if (looksStuck(trimmed)) return stuckReply(trimmed);

  const topic = explicitTopic || inferTopic(trimmed, history);
  const tone = energyLevel(trimmed);
  const correctionData = findCorrection(trimmed);
  const ack = acknowledgement(tone, topic);
  const followUp = pickFollowUp(history, topic);

  // If we match "for my education purpose", simulate the exact image dialog
  const isEduPurpose = /for my education purpose/i.test(trimmed);
  let reply = "";
  if (isEduPurpose) {
    reply = "That's a fantastic goal! Learning English can open up so many doors for your academic and professional life. What specific subjects are you studying at the moment?";
  } else {
    // Exact match overrides for the specific starter templates to keep dialogue natural:
    if (trimmed === "Hey ProfX! I want to chat about my weekend." || trimmed === "Hey English BRo! I want to chat about my weekend.") {
      reply = "I'd love to hear about your weekend! Did you do anything fun, or did you just take some time to relax?";
    } else if (trimmed === "Can we do a mock interview for a software engineer role?") {
      reply = "Absolutely! Let's start the mock interview. First, tell me a little bit about yourself and your primary programming skills.";
    } else if (trimmed === "I want to talk about my dream travel destination.") {
      reply = "Travel is so inspiring! If you could pack your bags and fly anywhere tomorrow morning, where would you go?";
    } else if (trimmed === "Let's discuss a book I read recently.") {
      reply = "That sounds fascinating! What is the title of the book, and what is its main story or theme?";
    } else if (trimmed === "I want to tell you a funny story from my childhood.") {
      reply = "Childhood stories are always the best! Go ahead and share it — what happened?";
    } else if (trimmed === "Let's debate: cats or dogs?") {
      reply = "A classic debate! I will play devil's advocate. To start, are you on team cats or team dogs, and why?";
    } else {
      reply = `${ack} ${followUp}`.trim();
    }
  }

  const correctionJsonStr = correctionData ? JSON.stringify(correctionData) : null;

  return { reply, correction: correctionJsonStr };
}

async function tryOpenAIReply(userText: string, history: ChatTurn[], topic?: ProfXTopicId): Promise<ProfXReply | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.8,
        response_format: { type: "json_object" },
        max_tokens: 300,
        messages: [
          { role: "system", content: `${PROFX_SYSTEM_PROMPT}\nActive Topic Context: ${topic || "casual"}` },
          ...history.slice(-12).map((h) => ({ role: h.role, content: h.content })),
          { role: "user", content: userText },
        ],
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const contentStr: string | undefined = data?.choices?.[0]?.message?.content;
    if (!contentStr) return null;

    const parsed = JSON.parse(contentStr);
    const reply = parsed.reply || "Could you say that again?";
    let correction: string | null = null;
    if (parsed.correction && typeof parsed.correction === "object") {
      correction = JSON.stringify({
        original: parsed.correction.original || "",
        corrected: parsed.correction.corrected || "",
        explanation: parsed.correction.explanation || "",
      });
    }

    return { reply, correction };
  } catch {
    return null;
  }
}

export async function generateProfXReply(userText: string, history: ChatTurn[], topic?: ProfXTopicId): Promise<ProfXReply> {
  const aiReply = await tryOpenAIReply(userText, history, topic);
  if (aiReply) return aiReply;
  return buildFallbackReply(userText, history, topic);
}
