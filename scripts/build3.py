import os, re

os.chdir('/workspace')
raw = open('Презентация.html', encoding='utf-8').read()
lines = raw.split('\n')
def seg(a, b):
    return '\n'.join(lines[a-1:b])
def w(path, content):
    d = os.path.dirname(path)
    if d: os.makedirs(d, exist_ok=True)
    open(path, 'w', encoding='utf-8').write(content)

# 1. Replace React prelude with named imports in all jsx files
NEEDED = {
 'src/components/NumberInput.jsx': ['useState','useEffect'],
 'src/features/map/Body3D.jsx': ['useRef','useEffect'],
 'src/features/map/MiniSparkline.jsx': [],
 'src/features/map/ProcessCard.jsx': ['useState','useEffect'],
 'src/features/map/MacroRow.jsx': [],
 'src/features/map/MetabolismMap.jsx': [],
 'src/features/goal/GoalTab.jsx': ['useState','useMemo'],
 'src/features/food/DishesTab.jsx': [],
 'src/features/food/DishEditor.jsx': ['useState'],
 'src/features/journal/ActivityHistory.jsx': ['useState'],
 'src/features/activities/ActivityLogger.jsx': ['useState','useMemo','useEffect','useRef'],
 'src/features/inbody/InBodyEditor.jsx': ['useState','useMemo'],
 'src/features/inbody/InBodyValue.jsx': [],
 'src/features/inbody/InBodyTab.jsx': [],
 'src/features/journal/LineChart.jsx': [],
 'src/features/journal/ChartCard.jsx': [],
 'src/features/journal/ChartsView.jsx': ['useState','useMemo'],
 'src/features/journal/Journal.jsx': ['useState'],
 'src/features/help/HelpContent.jsx': ['useState'],
 'src/features/help/HelpTab.jsx': [],
 'src/features/profile/MobileProfile.jsx': [],
 'src/components/icons.jsx': [],
 'src/components/MobileNav.jsx': [],
}
PRELUDE = "const { useState, useMemo, useEffect, useRef } = React;\n\n"
for path, names in NEEDED.items():
    src = open(path, encoding='utf-8').read()
    assert PRELUDE in src, path
    imp = ("import { " + ', '.join(names) + " } from 'react';\n\n") if names else "\n"
    src = src.replace(PRELUDE, imp.lstrip('\n') if not names else imp, 1)
    w(path, src)

# icons.jsx has different prelude line
p='src/components/icons.jsx'
src=open(p,encoding='utf-8').read().replace("const { useState, useMemo, useEffect, useRef } = React;\n\n","import React from 'react';\n\n")
w(p,src)

# 2. Trim MATH_IMPORT to actually-used symbols per file
USED = {
 'src/features/map/MetabolismMap.jsx': ['formatSigned','getContextText'],
 'src/features/goal/GoalTab.jsx': ['assessGoal'],
 'src/features/food/DishesTab.jsx': [],
 'src/features/food/DishEditor.jsx': [],
 'src/features/journal/ActivityHistory.jsx': ['formatDayLabel','plural'],
 'src/features/activities/ActivityLogger.jsx': ['MET_COEFFICIENTS','calcMETCalories'],
 'src/features/inbody/InBodyEditor.jsx': ['calculateBMR','genId'],
 'src/features/inbody/InBodyTab.jsx': ['formatDayLabel','plural'],
 'src/features/journal/LineChart.jsx': [],
 'src/features/journal/ChartsView.jsx': ['computePlanSeries','formatSigned'],
 'src/features/journal/Journal.jsx': [],
 'src/features/profile/MobileProfile.jsx': [],
}
FULL_RE = re.compile(r"^import \{ calculateBMR.*from '@/lib/shared';\n", re.M)
for path, used in USED.items():
    src = open(path, encoding='utf-8').read()
    m = FULL_RE.search(src)
    assert m, path
    repl = ("import { " + ', '.join(used) + " } from '@/lib/shared';\n") if used else ""
    src = FULL_RE.sub(repl, src, count=1)
    w(path, src)

print('OK batch 3a (imports fixed)')
