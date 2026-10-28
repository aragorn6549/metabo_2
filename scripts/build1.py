import os

os.chdir('/workspace')
raw = open('Презентация.html', encoding='utf-8').read()
lines = raw.split('\n')

def seg(a, b):  # inclusive 1-based
    return '\n'.join(lines[a-1:b])

def w(path, content):
    d = os.path.dirname(path)
    if d:
        os.makedirs(d, exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

def conv(code, exports):
    if exports:
        code += '\n\nexport { ' + ', '.join(exports) + ' };\n'
    return code

# ============ config files ============
w('package.json', '''{
  "name": "metabo",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.45.0",
    "@tanstack/react-query": "^5.51.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "three": "^0.160.0",
    "zustand": "^4.5.4"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@types/three": "^0.160.0",
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.5.3",
    "vite": "^5.4.0"
  }
}
''')

w('vercel.json', '''{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
''')

w('.gitignore', '''node_modules
dist
.env
.env.local
.vercel
*.local
.DS_Store
''')

w('.env.example', '''VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...PASTE_ANON_KEY_HERE
''')

w('tsconfig.json', '''{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": false,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src"]
}
''')

w('vite.config.ts', '''import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
});
''')

w('index.html', '''<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>Metabo — Карта метаболизма</title>
</head>
<body>
<div id="root"></div>
<script type="module" src="/src/main.tsx"></script>
</body>
</html>
''')

w('src/vite-env.d.ts', '''/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}
interface ImportMeta { readonly env: ImportMetaEnv; }
''')

w('src/lib/supabase.ts', '''import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
);
''')

w('src/types/domain.ts', '''// DECISION: единый доменный тип для записей — как в прототипе (записи различаются по type)
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
''')

# ============ math (copied 1:1 from prototype) ============
w('src/math/bmr.ts', conv(seg(451, 455), ['calculateBMR']))
w('src/math/tdee.ts', conv(seg(456, 462), ['calculateTEF', 'ACTIVITY_COEFFICIENTS', 'calculateTDEE']))
w('src/math/met.ts', conv(
    "const MET_COEFFICIENTS = { volleyball:4.0, padel:6.0, tennis:7.0, football:7.0, basketball:6.5 };\n"
    "function calcMETCalories(met, w, min) { return Math.round(met * w * (min/60)); }",
    ['MET_COEFFICIENTS', 'calcMETCalories']))
w('src/math/bmi.ts', conv(seg(466, 469), ['calcBMI']))
w('src/math/simulation.ts', '// DECISION: формулы скопированы из прототипа без изменений (ТЗ \u00a76)\n'
    + conv(seg(530, 643), ['computeHourlyRate', 'simulateDay']))
w('src/math/goalAssessment.ts', '// DECISION: формулы скопированы из прототипа без изменений (ТЗ \u00a76.4\u20136.5)\n'
    + conv(seg(645, 737) + '\n' + seg(739, 795),
           ['computePlan', 'deriveGoalTargets', 'computePlanSeries', 'getContextText', 'assessGoal']))
w('src/lib/utils.ts', conv(seg(464, 465) + '\n' + seg(471, 494),
    ['formatSigned', 'genId', 'formatTimer', 'plural', 'formatDayLabel']))

print('OK batch 1')
