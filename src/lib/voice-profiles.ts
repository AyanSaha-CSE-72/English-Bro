export type VoiceProfileId = "female" | "male" | "boy" | "girl";

export interface VoiceProfile {
  id: VoiceProfileId;
  label: string;
  emoji: string;
  description: string;
  pitch: number;
  rate: number;
  // Regex patterns tried in order (best match first) to find the closest
  // real system voice — natural/neural voices are listed before generic ones.
  namePatterns: RegExp[];
  preferredGenderHint: "female" | "male";
}

// Voices flagged by browsers/OSes as higher-quality "neural"/"natural" voices
// sound dramatically more human than the default robotic ones. We always try
// to grab one of these first, regardless of profile.
const NEURAL_VOICE_HINT = /(natural|neural|premium|enhanced|online \(natural\))/i;

export const VOICE_PROFILES: VoiceProfile[] = [
  {
    id: "female",
    label: "Female",
    emoji: "👩",
    description: "Warm, natural adult female voice.",
    pitch: 1.0,
    rate: 0.97,
    namePatterns: [
      /(aria|jenny|michelle|ava|emma).*natural/i,
      /female.*(natural|neural|premium|enhanced)/i,
      /\b(samantha|victoria|karen|moira|tessa|fiona|serena|zira)\b/i,
      /female/i,
      /google us english/i,
      /google uk english female/i,
    ],
    preferredGenderHint: "female",
  },
  {
    id: "male",
    label: "Male",
    emoji: "👨",
    description: "Calm, confident adult male voice.",
    pitch: 0.96,
    rate: 0.96,
    namePatterns: [
      /(guy|davis|tony|eric|christopher).*natural/i,
      /male.*(natural|neural|premium|enhanced)/i,
      /\b(daniel|david|alex|fred|george|james|oliver|ryan)\b/i,
      /male/i,
      /google uk english male/i,
    ],
    preferredGenderHint: "male",
  },
  {
    id: "girl",
    label: "Little Girl",
    emoji: "👧",
    description: "Bright, cheerful young voice.",
    pitch: 1.28,
    rate: 1.05,
    namePatterns: [
      /(aria|jenny|michelle|ava|emma).*natural/i,
      /female.*(natural|neural|premium|enhanced)/i,
      /\b(samantha|victoria|karen|moira|tessa|fiona|serena|zira)\b/i,
      /female/i,
      /google us english/i,
    ],
    preferredGenderHint: "female",
  },
  {
    id: "boy",
    label: "Little Boy",
    emoji: "👦",
    description: "Bright, cheerful young voice.",
    pitch: 1.22,
    rate: 1.06,
    namePatterns: [
      /(guy|davis|tony|eric|christopher).*natural/i,
      /male.*(natural|neural|premium|enhanced)/i,
      /\b(daniel|david|alex|fred|george|james|oliver|ryan)\b/i,
      /male/i,
    ],
    preferredGenderHint: "male",
  },
];

export function getVoiceProfile(id: VoiceProfileId): VoiceProfile {
  return VOICE_PROFILES.find((p) => p.id === id) ?? VOICE_PROFILES[0];
}

/**
 * Picks the closest matching, best-quality browser voice for a given
 * profile. Prefers OS/browser "natural"/"neural" voices (which sound far
 * more human than the classic robotic defaults), then falls back through
 * named voices, then generic gender-tagged voices.
 *
 * Actual "child" voices are rarely exposed by browsers — in that case we
 * reuse the matching adult voice and rely on pitch/rate to simulate a
 * younger-sounding voice.
 */
export function pickVoiceForProfile(
  voices: SpeechSynthesisVoice[],
  profile: VoiceProfile
): SpeechSynthesisVoice | null {
  const englishVoices = voices.filter((v) => /^en(-|_|$)/i.test(v.lang));
  const pool = englishVoices.length > 0 ? englishVoices : voices;

  // 1) Best case: a neural/natural voice that also matches this profile's
  // gender-leaning name patterns.
  const neuralMatch = pool.find(
    (v) => NEURAL_VOICE_HINT.test(v.name) && profile.namePatterns.some((p) => p.test(v.name))
  );
  if (neuralMatch) return neuralMatch;

  // 2) Any neural/natural voice matching the broad gender hint.
  const genderPattern = profile.preferredGenderHint === "female" ? /female/i : /male/i;
  const neuralGeneric = pool.find((v) => NEURAL_VOICE_HINT.test(v.name) && genderPattern.test(v.name));
  if (neuralGeneric) return neuralGeneric;

  // 3) Any neural/natural voice at all (still much better than robotic default).
  const anyNeural = pool.find((v) => NEURAL_VOICE_HINT.test(v.name));
  if (anyNeural) return anyNeural;

  // 4) Fall back to the profile's ordered name patterns.
  for (const pattern of profile.namePatterns) {
    const match = pool.find((v) => pattern.test(v.name));
    if (match) return match;
  }

  // 5) Last resort: avoid the opposite gender hint if possible.
  const oppositeHint = profile.preferredGenderHint === "female" ? /male/i : /female/i;
  const nonOpposite = pool.find((v) => !oppositeHint.test(v.name));
  return nonOpposite ?? pool[0] ?? null;
}
