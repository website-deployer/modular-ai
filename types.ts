export enum View {
  LIBRARY = 'LIBRARY',
  RECORDER = 'RECORDER',
  EDITOR = 'EDITOR',
  ANALYSIS = 'ANALYSIS',
  BOOKMARKS = 'BOOKMARKS',
  HISTORY = 'HISTORY',
  SETTINGS = 'SETTINGS'
}

export interface AppSettings {
  darkMode: boolean;
  compactMode: boolean;
  defaultNoteFormat: 'Structured' | 'Summary' | 'Transcript';
  autoGenerateTitles: boolean;
  themeColor: string;
}

export interface Attachment {
  type: 'image' | 'text' | 'pdf';
  content: string; // Base64 or text content
  name: string;
}

export interface Note {
  id: string;
  title: string;
  date: string;
  duration?: string;
  content: string; // The refined note content (Markdown/HTML)
  transcript: string; // The raw or processed transcript/source text
  type: 'AUDIO' | 'PDF' | 'VIDEO' | 'TEXT';
  tags: string[];
  attachments?: Attachment[];
  isProcessing?: boolean;
  isBookmarked?: boolean;
  lastAccessed?: string; // ISO Date string
  sourceData?: {
      mimeType: string;
      data: string; // Base64 data for re-feeding to context if needed
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  relatedSlide?: number;
  relatedTimestamp?: string;
}

export interface LiveTranscriptChunk {
  text: string;
  isUser: boolean;
  timestamp: number;
}