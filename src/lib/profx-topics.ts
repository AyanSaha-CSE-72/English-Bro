export interface ProfXTopic {
  id: string;
  title: string;
  description: string;
  starter: string;
  emoji: string;
}

export const PROFX_TOPICS: ProfXTopic[] = [
  {
    id: "casual",
    title: "Casual Chat",
    description: "Talk about your day, hobbies, or weekend plans.",
    starter: "Hey English BRo! I want to chat about my weekend.",
    emoji: "💬",
  },
  {
    id: "interview",
    title: "Job Interview",
    description: "Practice answering common interview questions.",
    starter: "Can we do a mock interview for a software engineer role?",
    emoji: "💼",
  },
  {
    id: "travel",
    title: "Travel & Culture",
    description: "Describe places you've been or want to visit.",
    starter: "I want to talk about my dream travel destination.",
    emoji: "✈️",
  },
  {
    id: "academic",
    title: "Academic English",
    description: "Discuss books, ideas, and learning topics.",
    starter: "Let's discuss a book I read recently.",
    emoji: "📚",
  },
  {
    id: "story",
    title: "Storytelling",
    description: "Practice telling a short personal story.",
    starter: "I want to tell you a funny story from my childhood.",
    emoji: "📖",
  },
  {
    id: "debate",
    title: "Light Debate",
    description: "Share opinions on fun, low-stakes topics.",
    starter: "Let's debate: cats or dogs?",
    emoji: "⚖️",
  },
];
