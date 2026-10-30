import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { upsertInBodyLog, fetchActiveGoal, saveGoal as dbSaveGoal, deleteGoal as dbDeleteGoal, normalizeGoalRow } from '../lib/db.js';

// Safely coerce any numeric-ish value to a finite number; fallback on NaN/null/undefined
const numOr = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };

// Ensure an assessment object has safe numeric fields for rendering (.toFixed etc.)
const sanitizeAssessment = (a, fallbacks = {}) => {
  if (!a) return a;
  const out = { ...a };
  const numericFields = ['currentValue','targetValue','dailyCalorieAdjustment','targetCalories','targetProtein','targetFat','targetCarbs','daysAvailable'];
  numericFields.forEach(f => { out[f] = numOr(out[f], numOr(fallbacks[f], 0)); });
  if (typeof out.isFeasible !== 'boolean') out.isFeasible = true;
  if (typeof out.verdict !== 'string' || !out.verdict) out.verdict = out.isFeasible ? 'Реалистично' : 'Слишком агрессивно';
  if (typeof out.limitDescription !== 'string') out.limitDescription = '';
  if (!out.targetUnit) out.targetUnit = out.targetType === 'weight' ? 'кг' : '%';
  return out;
};

const useMetaboStore = create(
  persist(
    (set, get) => ({
      profile: null,
      logs: [],
      activeGoal: null,
      loading: false,
      error: null,

      setProfile: (profile) => set({ profile }),
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),

      loadInitialData: async () => {
        set({ loading: true, error: null });
        try {
          // 1. Load Profile
          const profile = await get().fetchProfile();
          set({ profile });

          // 2. Load Logs
          const logs = await get().fetchLogs(profile.id);
          set({ logs });

          // 3. Calculate Baseline from latest log
          let baseline = null;
          if (logs.length > 0) {
            const sortedLogs = [...logs].sort((a, b) => new Date(b.date) - new Date(a.date));
            baseline = sortedLogs[0];
          }

          // 4. Load Goal AFTER baseline is known to allow repair
          const goal = await fetchActiveGoal(profile.id, baseline);
          set({ activeGoal: goal ? normalizeGoalRow(goal, baseline) : null });

        } catch (err) {
          console.error(err);
          set({ error: err.message });
        } finally {
          set({ loading: false });
        }
      },

      fetchProfile: async () => {
        // Implement actual Supabase fetch here
        return null; 
      },

      fetchLogs: async (userId) => {
        // Implement actual Supabase fetch here
        return [];
      },

      saveInbody: async (logEntry) => {
        set({ loading: true, error: null });
        try {
          const savedLog = await upsertInBodyLog(get().profile.id, logEntry);
          
          // Update local state
          const currentLogs = get().logs;
          const existingIndex = currentLogs.findIndex(l => l.id === savedLog.id);
          
          let updatedLogs;
          if (existingIndex >= 0) {
            updatedLogs = [...currentLogs];
            updatedLogs[existingIndex] = savedLog;
          } else {
            updatedLogs = [savedLog, ...currentLogs];
          }

          set({ logs: updatedLogs });

          // Recalculate baseline and potentially update goal view
          const sortedLogs = [...updatedLogs].sort((a, b) => new Date(b.date) - new Date(a.date));
          const newBaseline = sortedLogs[0] || null;
          
          if (get().activeGoal && newBaseline) {
             const repairedGoal = normalizeGoalRow(get().activeGoal, newBaseline);
             set({ activeGoal: repairedGoal });
          }

        } catch (err) {
          set({ error: err.message });
        } finally {
          set({ loading: false });
        }
      },

      setGoal: async (goalData) => {
        try {
          const { profile, logs } = get();
          if (!profile) throw new Error('No profile');
          
          // Ensure baseline exists for repair logic
          const sortedLogs = [...logs].sort((a, b) => new Date(b.date) - new Date(a.date));
          const baseline = sortedLogs[0] || null;

          // Sanitize before saving to DB
          const sanitized = { ...goalData };
          if (sanitized.assessment) {
            sanitized.assessment = sanitizeAssessment(sanitized.assessment, { currentValue: baseline?.weight });
          }

          const saved = await dbSaveGoal(profile.id, sanitized);
          set({ activeGoal: saved ? normalizeGoalRow(saved, baseline) : null });
        } catch (err) {
          console.error('Error setting goal:', err);
          set({ error: err.message });
        }
      },

      deleteGoal: async () => {
        try {
          const { profile, activeGoal } = get();
          if (!profile || !activeGoal?.id) return;
          await dbDeleteGoal(activeGoal.id, profile.id);
          set({ activeGoal: null });
        } catch (err) {
          console.error('Error deleting goal:', err);
          set({ error: err.message });
        }
      },
    }),
    {
      name: 'metabo-storage',
    }
  )
);

export { useMetaboStore };
export default useMetaboStore;
