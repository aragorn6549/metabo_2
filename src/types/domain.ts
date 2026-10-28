// DECISION: единый доменный тип для записей — как в прототипе (записи различаются по type)
export type EntryType = 'food' | 'workout' | 'sleep' | 'other';

export interface Entry {
  id?: string;
  type: EntryType;
  subtype?: string;
  name?: string;
  timestamp: number;      // unix ms
  calories?: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  duration_min?: number;
  hours?: number;
  quality?: number;
}

export interface Dish { id?: string; name: string; calories: number; protein: number; fat: number; carbs: number; }

export interface InBodyLog {
  id?: string; date: string; // ISO
  weight: number; fatPercent: number; musclePercent: number; bmr: number; bmi: number;
}

export interface Baseline {
  name?: string; age: number; gender: 'male' | 'female'; height: number;
  activityLevel: string; weight: number; fatPercent: number; musclePercent: number; bmr: number;
}

export interface GoalAssessment { [k: string]: any; }
export interface Goal {
  id?: string; targetType: string; targetValue: number; targetDate: string;
  assessment: GoalAssessment; createdAt?: number;
}

export interface HistoryPoint {
  date: string; weight?: number; fatPercent?: number; musclePercent?: number;
  caloriesConsumed?: number; balance?: number; lipolysis?: number; lipogenesis?: number; muscleNet?: number;
}

export interface UserAccount { email: string; name?: string; }
