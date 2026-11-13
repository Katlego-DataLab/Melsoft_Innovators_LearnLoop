export type LearnerType =
  | "visual"
  | "auditory"
  | "reading_writing"
  | "kinaesthetic"
  | "logical_analytical"
  | "social"
  | "solitary";

export const LEARNER_TYPES: Array<{ id: LearnerType; label: string; blurb: string; tips: string[] }> = [
  { id: "visual", label: "Visual", blurb: "Diagrams, colour and pictures help ideas stick.", tips: ["Sketch the idea as a diagram or mind map.", "Colour-code key terms and steps.", "Look for charts or videos that show the concept."] },
  { id: "auditory", label: "Auditory", blurb: "Listening and talking things through works well.", tips: ["Explain the topic out loud as if teaching someone.", "Record a short summary and listen back.", "Discuss tricky parts with a friend or tutor."] },
  { id: "reading_writing", label: "Reading / writing", blurb: "Notes, lists and written explanations are your tools.", tips: ["Rewrite the explanation in your own words.", "Turn the steps into a numbered checklist.", "Write a short summary before the practice questions."] },
  { id: "kinaesthetic", label: "Kinaesthetic", blurb: "Learning by doing and trying things out.", tips: ["Type out and run the example yourself.", "Change one thing at a time and see what happens.", "Take short active breaks between practice questions."] },
  { id: "logical_analytical", label: "Logical / analytical", blurb: "Patterns, reasons and step-by-step logic.", tips: ["Break the problem into smaller steps.", "Ask 'why does this work?' for each step.", "Compare the example with a similar problem to spot the pattern."] },
  { id: "social", label: "Social", blurb: "Studying with others keeps you motivated.", tips: ["Work through the practice questions with a study partner.", "Take turns explaining each step.", "Join or start a short study group session."] },
  { id: "solitary", label: "Solitary", blurb: "Focused, independent study at your own pace.", tips: ["Set aside a quiet block of time.", "Set your own small goal for each session.", "Reflect in a short journal after practising."] },
];

export const LEARNER_QUESTIONNAIRE: Array<{ id: string; prompt: string; options: Array<{ label: string; type: LearnerType }> }> = [
  { id: "q1", prompt: "You’re learning something new. What helps most?", options: [
    { label: "A diagram or video", type: "visual" },
    { label: "Someone explaining it to me", type: "auditory" },
    { label: "Clear written notes", type: "reading_writing" },
    { label: "Trying it myself", type: "kinaesthetic" },
  ] },
  { id: "q2", prompt: "When you get stuck on a problem, you usually…", options: [
    { label: "Break it into logical steps", type: "logical_analytical" },
    { label: "Ask a friend to work on it with me", type: "social" },
    { label: "Go off alone and think it through", type: "solitary" },
    { label: "Draw it out", type: "visual" },
  ] },
  { id: "q3", prompt: "Before a test you prefer to…", options: [
    { label: "Quiz each other in a group", type: "social" },
    { label: "Re-read and rewrite my notes", type: "reading_writing" },
    { label: "Practise past questions hands-on", type: "kinaesthetic" },
    { label: "Study quietly by myself", type: "solitary" },
  ] },
  { id: "q4", prompt: "You remember things best when you…", options: [
    { label: "Hear them or say them aloud", type: "auditory" },
    { label: "See a pattern or rule behind them", type: "logical_analytical" },
    { label: "See a picture or chart", type: "visual" },
    { label: "Do them in real life", type: "kinaesthetic" },
  ] },
  { id: "q5", prompt: "A good study session feels like…", options: [
    { label: "A focused, quiet hour alone", type: "solitary" },
    { label: "A lively talk with classmates", type: "social" },
    { label: "A neat set of summaries", type: "reading_writing" },
    { label: "Solving puzzles step by step", type: "logical_analytical" },
  ] },
  { id: "q6", prompt: "When someone gives you instructions, you prefer…", options: [
    { label: "To hear them spoken", type: "auditory" },
    { label: "A map or flowchart", type: "visual" },
    { label: "Written steps I can follow", type: "reading_writing" },
    { label: "To just try and learn as I go", type: "kinaesthetic" },
  ] },
];

export function scoreQuestionnaire(answers: Record<string, LearnerType>): LearnerType {
  const counts = new Map<LearnerType, number>();
  Object.values(answers).forEach((type) => counts.set(type, (counts.get(type) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "visual";
}
