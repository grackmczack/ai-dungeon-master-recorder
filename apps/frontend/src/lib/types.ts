export interface User {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

export interface GroupMembership {
  id: string;
  userId?: string | null;
  groupId: string;
  role: 'GM' | 'PLAYER' | 'OBSERVER';
  discordName?: string;
  characterName?: string;
  partyRole?: string;
  avatarUrl?: string;
  characterSheetUrl?: string;
  joinedAt: string;
  leftAt?: string;
  isPaused: boolean;
  pausedAt?: string;
  pauseNote?: string;
  notes?: string;
  // user ist nur gesetzt, wenn dieses Mitglied ein eigenes Login hat (i.d.R. nur der GM)
  user?: { id: string; email: string; displayName: string } | null;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  discordGuildId?: string;
  role?: 'GM' | 'PLAYER' | 'OBSERVER';
  _count?: { campaigns: number; memberships: number };
  memberships?: GroupMembership[];
}

export interface Campaign {
  id: string;
  groupId: string;
  name: string;
  description?: string;
  setting?: string;
  isActive: boolean;
  campaignContext?: string;
  backgroundImageUrl?: string;
  createdAt: string;
  sessions?: Session[];
}

export interface Session {
  id: string;
  campaignId: string;
  title?: string;
  sessionNumber?: number;
  status: 'RECORDING' | 'PROCESSING' | 'TRANSCRIBING' | 'SUMMARIZING' | 'DONE' | 'FAILED';
  startedAt: string;
  stoppedAt?: string;
  transcript?: Transcript;
  summary?: Summary;
  speakerMaps?: SpeakerMap[];
  recordings?: Recording[];
}

export interface Recording {
  id: string;
  filename: string;
  durationSeconds?: number;
  format: string;
  createdAt: string;
}

export interface Transcript {
  id: string;
  // rawJson kann direkt { segments } sein oder { chunks: [{ segments, chunkIndex, durationSeconds }] }
  rawJson: {
    segments?: TranscriptSegment[];
    chunks?: Array<{ segments: TranscriptSegment[]; chunkIndex: number; durationSeconds: number }>;
    language?: string;
    provider?: string;
  };
  provider: string;
  language: string;
}

export interface TranscriptSegment {
  speaker: string;
  start: number;
  end: number;
  text: string;
}

export interface Summary {
  id: string;
  narrative: string;
  npcs: Array<{ name: string; description: string; firstMention: string }>;
  quests: Array<{ title: string; status: string; notes: string }>;
  loot: Array<{ item: string; foundBy: string }>;
  locations: Array<{ name: string; description: string }>;
  openThreads: string[];
  model: string;
  provider: string;
}

export interface SpeakerMap {
  id: string;
  discordUserId: string;
  discordName: string;
  characterName?: string;
  playerName?: string;
  diarizationLabel?: string;
}

export interface DiarizationLabelInfo {
  label: string;
  count: number;
  sample: string;
}

export interface GroupSettings {
  whisperProvider: string;
  whisperApiKey?: string;
  whisperEndpoint?: string;
  replicateApiKey?: string;
  llmProvider: string;
  llmApiKey?: string;
  llmModel?: string;
  llmEndpoint?: string;
  summaryLanguage: string;
  postSummaryChannelId?: string;
}

export interface ApiError {
  error: string | object;
  statusCode?: number;
}

// ─── Quest-Wiki Types ───────────────────────────────────────

export interface WikiNPC {
  name: string;
  description: string;
  firstSeenSessionId: string | null;
  lastSeenSessionId: string | null;
  firstSeenSessionNumber: number | null;
  lastSeenSessionNumber: number | null;
  sessionCount: number;
}

export interface WikiQuest {
  title: string;
  status: string;
  notes: string;
  firstSeenSessionId: string | null;
  lastSeenSessionId: string | null;
  allNotes: string[];
}

export interface WikiLocation {
  name: string;
  description: string;
  sessionCount: number;
}

export interface WikiThread {
  text: string;
  sessionId: string | null;
  sessionNumber: number | null;
}

export interface WikiLoot {
  item: string;
  foundBy: string;
  sessionId: string | null;
  sessionNumber: number | null;
}

export interface AggregatedWiki {
  campaignId: string;
  campaignName: string;
  sessionCount: number;
  npcs: WikiNPC[];
  quests: WikiQuest[];
  locations: WikiLocation[];
  threads: WikiThread[];
  loot: WikiLoot[];
}
