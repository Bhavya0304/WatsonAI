export type Link = { label: string; url: string };

export type Project = {
  id: string;
  title: string;
  emoji: string;
  tagline: string;
  description: string;
  highlights: string[];
  tech: string[];
  skills: string[];
  status: string;
  links: Link[];
};

export type Experience = {
  id: string;
  title: string;
  company: string;
  location: string;
  start: string;
  end: string;
  company_blurb: string;
  summary: string;
  highlights: string[];
  tech: string[];
};

export type Contact = {
  name: string;
  headline: string;
  location: string;
  current: string;
  email: string;
  links: Link[];
};

export type Content = {
  projects: Project[];
  experience: Experience[];
  contact: Contact;
  skills: { title: string; items: string[] }[];
  profile: { about: string; education: string; philosophy: string; interests: string };
};

export type CardRef = { type: "project" | "experience" | "skills" | "contact" | "profile"; id: string };

export type RiddleState = {
  id: string;
  question: string;
  hint: string;
  status: "active" | "wrong" | "solved" | "revealed";
  difficulty: "easy" | "medium" | "hard";
  level_name: string;
  streak: number;
  best_streak: number;
  attempts: number;
  max_attempts: number;
  score: number;
  asked: number;
  answer?: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  cards: CardRef[];
  suggestions: string[];
  riddle?: RiddleState | null;
  error?: boolean;
};

export type ChatResponse = {
  reply: string;
  cards: CardRef[];
  suggestions: string[];
  riddle: RiddleState | null;
  provider: string | null;
};

export type SessionStart = {
  session_id: string;
  resumed: boolean;
  messages: { role: "user" | "assistant"; content: string; cards: CardRef[]; suggestions: string[] }[];
};
