export enum QuestionType {
  SingleChoice = 'single_choice', MultipleChoice = 'multiple_choice',
  IndefiniteChoice = 'indefinite_choice', StrictFillInBlank = 'strict_fill_in_blank',
  FreeFillInBlank = 'free_fill_in_blank', Subjective = 'subjective',
}
export enum ScoreMode { AllOrNothing = 'all_or_nothing', Proportional = 'proportional' }
export enum StudyMode { Practice = 'practice', Exam = 'exam' }
export enum TagTargetType { File = 'file', Question = 'question' }
export enum MasteryStatus { Reviewing = 'reviewing', Mastered = 'mastered' }
export enum SessionStatus {
  InProgress = 'in_progress', Paused = 'paused', Completed = 'completed', Abandoned = 'abandoned',
}
