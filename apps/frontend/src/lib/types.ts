export interface User {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  discordGuildId?: string;
  role?: 'GM' | 'PLAYER' | 'OBSERVER';
  _count?: { campaigns: number; memberships: number };
}

export interface Campaign {
  id: string;
  groupId: string;
  name: string;
  description?: string;
  setting?: string;
  isActive: boolean;
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
