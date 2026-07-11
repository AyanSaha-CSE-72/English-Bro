import { pickVoiceForProfile, type VoiceProfile } from "./voice-profiles";

interface SpeakHumanOptions {
  text: string;
  profile: VoiceProfile;
  onDone?: () => void;
  onStart?: () => void;
}

// Splits text into natural speech chunks (sentences, and sub-clauses on long
// sentences) so we can insert human-like breathing pauses between them
// instead of reading everything in one flat, robotic block.
function splitIntoSpeechChunks(text: string): { text: string; pauseAfterMs: number }[] {
  const chunks: { text: string; pauseAfterMs: number }[] = [];

  // First split on sentence terminators, keeping the terminator attached.
  const sentences = text
    .replace(/\s+/g, " ")
    .trim()
    .match(/[^.!?]+[.!?]*(\s|$)/g);

  const sentenceList = sentences && sentences.length > 0 ? sentences : [text];

  for (const rawSentence of sentenceList) {
    const sentence = rawSentence.trim();
    if (!sentence) continue;

    // For long sentences, add gentle mid-sentence breathing pauses at commas
    // so it doesn't sound like the voice is reading in one endless breath.
    const isLong = sentence.length > 70;
    const parts = isLong ? sentence.split(/(?<=,)\s+/) : [sentence];

    parts.forEach((part, idx) => {
      const isLastPartOfSentence = idx === parts.length - 1;
      const endsWithQuestion = /\?\s*$/.test(part);
      const endsWithExclaim = /!\s*$/.test(part);

      let pause = 90; // short breath between clauses
      if (isLastPartOfSentence) {
        pause = endsWithQuestion ? 420 : endsWithExclaim ? 380 : 320;
      }

      chunks.push({ text: part.trim(), pauseAfterMs: pause });
    });
  }

  return chunks;
}

function randomJitter(base: number, spread: number): number {
  return base + (Math.random() * 2 - 1) * spread;
}

/**
 * Speaks text in a more human-sounding way: picks the best available
 * natural/neural system voice, applies subtle per-sentence pitch/rate
 * variation (real voices are never perfectly flat), and inserts short
 * breathing pauses between clauses and sentences.
 */
export function speakHuman({ text, profile, onDone, onStart }: SpeakHumanOptions): () => void {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    onDone?.();
    return () => {};
  }

  window.speechSynthesis.cancel();

  const voices = window.speechSynthesis.getVoices();
  const voice = pickVoiceForProfile(voices, profile);
  const chunks = splitIntoSpeechChunks(text);

  let cancelled = false;
  let index = 0;
  let started = false;

  function speakNext() {
    if (cancelled) return;
    if (index >= chunks.length) {
      onDone?.();
      return;
    }

    const chunk = chunks[index];
    index += 1;

    if (!started) {
      started = true;
      onStart?.();
    }

    const utterance = new SpeechSynthesisUtterance(chunk.text);
    utterance.lang = "en-US";
    // Small randomized jitter keeps consecutive sentences from sounding
    // perfectly identical/robotic, mimicking natural human variation.
    utterance.pitch = Math.max(0.5, Math.min(2, randomJitter(profile.pitch, 0.035)));
    utterance.rate = Math.max(0.6, Math.min(1.4, randomJitter(profile.rate, 0.03)));
    utterance.volume = 1;
    if (voice) utterance.voice = voice;

    utterance.onend = () => {
      if (cancelled) return;
      window.setTimeout(speakNext, chunk.pauseAfterMs);
    };
    utterance.onerror = () => {
      if (cancelled) return;
      window.setTimeout(speakNext, chunk.pauseAfterMs);
    };

    window.speechSynthesis.speak(utterance);
  }

  speakNext();

  return () => {
    cancelled = true;
    window.speechSynthesis.cancel();
  };
}
