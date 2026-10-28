-- supabase/fix_migrate_goals.sql
-- Исправленная миграция для таблицы goals, устойчивая к отсутствующей колонке status

DO $$ 
BEGIN
    -- 1. Если таблица goals существует, но имеет старую структуру (нет target_type/target_value/target_date), пересоздаём её
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'goals' AND column_name = 'target_type') THEN
        RAISE NOTICE 'Таблица goals уже имеет новую структуру. Миграция не требуется.';
    ELSE
        -- Проверяем, есть ли старые данные, которые нужно сохранить
        IF EXISTS (SELECT 1 FROM goals) THEN
            RAISE WARNING 'Обнаружены данные в goals со старой структурой. Они будут потеряны. Создаём резервную копию...';
            CREATE TABLE IF NOT EXISTS goals_backup_old AS SELECT * FROM goals;
        END IF;

        -- Удаляем старую таблицу и создаём новую
        DROP TABLE IF EXISTS goals CASCADE;
        
        CREATE TABLE goals (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            
            -- Новая схема целей
            target_type TEXT CHECK (target_type IN ('weight', 'fatPercent', 'musclePercent')),
            target_value NUMERIC(5,2),
            target_date DATE,
            assessment JSONB,
            
            -- Статус цели (активна/завершена) — теперь всегда присутствует
            status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled'))
        );

        -- Индексы для производительности
        CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
        CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);
        CREATE INDEX IF NOT EXISTS idx_goals_created_at ON goals(created_at DESC);

        RAISE NOTICE 'Таблица goals пересоздана с новой структурой.';
    END IF;
END $$;

-- 2. Убедимся, что RLS политики настроены правильно
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own goals" ON goals;
CREATE POLICY "Users can view own goals" ON goals FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own goals" ON goals;
CREATE POLICY "Users can insert own goals" ON goals FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own goals" ON goals;
CREATE POLICY "Users can update own goals" ON goals FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own goals" ON goals;
CREATE POLICY "Users can delete own goals" ON goals FOR DELETE USING (auth.uid() = user_id);

RAISE NOTICE 'Миграция goals завершена.';
