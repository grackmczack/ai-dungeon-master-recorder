import type { TranscriptResult, TranscriptSegment, TranscriptWord } from "./types.js";

export interface SpeakerActivity {
  userId: string;
  /** Milliseconds relative to the start of the recording chunk. */
  start: number;
  /** Milliseconds relative to the start of the recording chunk. */
  end: number;
  discordName?: string;
  discordDisplayName?: string;
}

export interface SpeakerAttributionResult {
  segments: TranscriptSegment[];
  usedUserIds: string[];
  strategy: "discord-word-timestamps" | "discord-segment-overlap" | "provider";
}

const MAX_NEAREST_ACTIVITY_DISTANCE_MS = 650;
const MAX_GROUP_DURATION_SECONDS = 25;
const MAX_WORD_GAP_SECONDS = 2;

interface AttributedWord extends TranscriptWord {
  speaker: string;
}

function finite(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function intervalDistance(start: number, end: number, activity: SpeakerActivity): number {
  if (end < activity.start) return activity.start - end;
  if (start > activity.end) return start - activity.end;
  return 0;
}

/**
 * Finds the Discord user whose actual audio activity overlaps the timestamp most.
 * A small nearest-neighbour tolerance compensates for Whisper timestamp drift at
 * word boundaries without smearing speaker changes over longer pauses.
 */
export function speakerAtTime(
  startSeconds: number,
  endSeconds: number,
  activities: SpeakerActivity[]
): string | null {
  if (!finite(startSeconds) || !finite(endSeconds) || activities.length === 0) return null;

  const start = startSeconds * 1000;
  const end = Math.max(endSeconds * 1000, start + 40);
  let bestUser: string | null = null;
  let bestOverlap = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const activity of activities) {
    if (!activity.userId || activity.end < activity.start) continue;
    const overlap = Math.max(0, Math.min(end, activity.end) - Math.max(start, activity.start));
    const distance = intervalDistance(start, end, activity);

    if (
      overlap > bestOverlap ||
      (overlap === bestOverlap && overlap > 0 && distance < bestDistance) ||
      (overlap === bestOverlap && distance === bestDistance && activity.userId < (bestUser ?? "~"))
    ) {
      bestUser = activity.userId;
      bestOverlap = overlap;
      bestDistance = distance;
    }
  }

  if (bestOverlap > 0) return bestUser;

  bestUser = null;
  bestDistance = Number.POSITIVE_INFINITY;
  for (const activity of activities) {
    const distance = intervalDistance(start, end, activity);
    if (
      distance < bestDistance ||
      (distance === bestDistance && activity.userId < (bestUser ?? "~"))
    ) {
      bestUser = activity.userId;
      bestDistance = distance;
    }
  }

  return bestDistance <= MAX_NEAREST_ACTIVITY_DISTANCE_MS ? bestUser : null;
}

function normalizeToken(token: string): string {
  return token.trim();
}

function joinTokens(tokens: string[]): string {
  return tokens
    .map(normalizeToken)
    .filter(Boolean)
    .join(" ")
    .replace(/\s+([,.;:!?%…])/g, "$1")
    .replace(/([([{„“])\s+/g, "$1")
    .replace(/\s+([)\]}”])/g, "$1")
    .trim();
}

function groupWords(words: AttributedWord[]): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  let current: AttributedWord[] = [];

  const flush = () => {
    if (current.length === 0) return;
    const text = joinTokens(current.map((word) => word.word));
    if (text) {
      segments.push({
        speaker: current[0]!.speaker,
        start: current[0]!.start,
        end: current[current.length - 1]!.end,
        text
      });
    }
    current = [];
  };

  for (const word of words) {
    const previous = current[current.length - 1];
    const speakerChanged = previous && previous.speaker !== word.speaker;
    const longGap = previous && word.start - previous.end > MAX_WORD_GAP_SECONDS;
    const groupTooLong = current[0] && word.end - current[0].start > MAX_GROUP_DURATION_SECONDS;
    if (speakerChanged || longGap || groupTooLong) flush();
    current.push(word);
  }
  flush();
  return segments;
}

function attributeWords(
  words: TranscriptWord[],
  activities: SpeakerActivity[],
  providerFallback: string
): TranscriptSegment[] {
  const attributed = words
    .filter((word) => normalizeToken(word.word) && finite(word.start) && finite(word.end))
    .sort((a, b) => a.start - b.start || a.end - b.end)
    .map((word) => ({
      ...word,
      speaker: speakerAtTime(word.start, word.end, activities) ?? providerFallback
    }));
  return groupWords(attributed);
}

function attributeSegments(
  segments: TranscriptSegment[],
  activities: SpeakerActivity[]
): TranscriptSegment[] {
  return segments.map((segment) => ({
    ...segment,
    speaker: speakerAtTime(segment.start, segment.end, activities) ?? segment.speaker
  }));
}

/**
 * Attributes transcription text to Discord users. Word timestamps are preferred
 * because a single Whisper segment can contain multiple alternating speakers.
 */
export function attributeTranscriptSpeakers(
  transcript: TranscriptResult,
  activities: SpeakerActivity[]
): SpeakerAttributionResult {
  if (activities.length === 0) {
    return { segments: transcript.segments, usedUserIds: [], strategy: "provider" };
  }

  const providerFallback = transcript.segments[0]?.speaker ?? "SPEAKER_00";
  const hasUsableWords = transcript.words?.some(
    (word) => normalizeToken(word.word) && finite(word.start) && finite(word.end)
  );
  const segments = hasUsableWords
    ? attributeWords(transcript.words ?? [], activities, providerFallback)
    : attributeSegments(transcript.segments, activities);
  const activityUserIds = new Set(activities.map((activity) => activity.userId));
  const usedUserIds = [
    ...new Set(
      segments.map((segment) => segment.speaker).filter((speaker) => activityUserIds.has(speaker))
    )
  ];

  return {
    segments,
    usedUserIds,
    strategy: hasUsableWords ? "discord-word-timestamps" : "discord-segment-overlap"
  };
}
