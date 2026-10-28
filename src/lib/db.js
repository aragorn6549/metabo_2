import { supabase } from './supabase';

// Helper to validate UUID
const isValidUUID = (uuid) => {
  const regex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/;
  return regex.test(uuid);
};

export async function upsertInBodyLog(userId, logData) {
  try {
    if (!logData.id || !isValidUUID(logData.id)) {
      const { data, error } = await supabase
        .from('inbody_logs')
        .insert({ ...logData, user_id: userId })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    }

    const { data, error } = await supabase
      .from('inbody_logs')
      .update(logData)
      .eq('id', logData.id)
      .eq('user_id', userId)
      .select()
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      const { data: insertedData, error: insertError } = await supabase
        .from('inbody_logs')
        .insert({ ...logData, user_id: userId })
        .select()
        .single();
      
      if (insertError) throw insertError;
      return insertedData;
    }

    return data;
  } catch (err) {
    console.error('Error upserting InBody log:', err);
    throw err;
  }
}

export function repairAssessment(goalRow, baseline) {
  if (!goalRow || !goalRow.assessment) return goalRow;
  
  const assessment = { ...goalRow.assessment };
  
  if (typeof assessment.currentValue !== 'number' || isNaN(assessment.currentValue)) {
    if (baseline && typeof baseline.weight === 'number') {
      assessment.currentValue = baseline.weight;
    } else {
      assessment.currentValue = 0;
    }
  }

  const numericFields = ['targetCalories', 'dailyCalorieAdjustment', 'targetProtein', 'targetFat', 'targetCarbs'];
  numericFields.forEach(field => {
    if (typeof assessment[field] !== 'number' || isNaN(assessment[field])) {
       assessment[field] = 0;
    }
  });

  return {
    ...goalRow,
    assessment
  };
}

export async function fetchActiveGoal(uid, baseline) {
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', uid)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  
  if (!data) return null;

  return repairAssessment(data, baseline);
}

export function normalizeGoalRow(row, baseline) {
  if (!row) return null;
  return repairAssessment(row, baseline);
}

export async function saveGoal(userId, goalData) {
  const payload = {
    user_id: userId,
    status: 'active',
    target_type: goalData.targetType,
    target_value: goalData.targetValue,
    target_date: goalData.targetDate,
    assessment: goalData.assessment,
    created_at: goalData.createdAt || new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('goals')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteGoal(goalId, userId) {
  const { error } = await supabase
    .from('goals')
    .delete()
    .eq('id', goalId)
    .eq('user_id', userId);

  if (error) throw error;
}
