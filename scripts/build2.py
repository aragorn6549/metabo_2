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

PRELUDE = "const { useState, useMemo, useEffect, useRef } = React;\n\n"

def comp_file(path, header_imports, a, b, name):
    body = PRELUDE + header_imports + '\n' + seg(a, b)
    w(path, body + "\n\nexport default " + name + ";\n")

# ---------- CSS 1:1 from prototype ----------
w('src/styles/global.css', seg(12, 440) + '\n')

MATH_IMPORT = "import { calculateBMR, calculateTEF, calculateTDEE, ACTIVITY_COEFFICIENTS, MET_COEFFICIENTS, calcMETCalories, calcBMI, computeHourlyRate, simulateDay, computePlan, deriveGoalTargets, computePlanSeries, getContextText, assessGoal, formatSigned, genId, formatTimer, plural, formatDayLabel } from '@/lib/shared';\n"

# ---------- NumberInput ----------
comp_file('src/components/NumberInput.jsx', '', 496, 528, 'NumberInput')

# ---------- Body3D (three npm import) ----------
b3d = seg(931, 1077)
b3d = b3d.replace('if (!el || !window.THREE) return;', 'if (!el) return;')
b3d = b3d.replace('const THREE = window.THREE;', '')
w('src/features/map/Body3D.jsx',
  "import { useState, useMemo, useEffect, useRef } from 'react';\nimport * as THREE from 'three';\n\n"
  + b3d + "\n\nexport default Body3D;\n")

# ---------- MiniSparkline / ProcessCard / MacroRow ----------
comp_file('src/features/map/MiniSparkline.jsx', '', 1080, 1104, 'MiniSparkline')
comp_file('src/features/map/ProcessCard.jsx', "import MiniSparkline from './MiniSparkline';\n", 1107, 1282, 'ProcessCard')
comp_file('src/features/map/MacroRow.jsx', '', 1285, 1346, 'MacroRow')

# ---------- MetabolismMap ----------
comp_file('src/features/map/MetabolismMap.jsx',
  MATH_IMPORT + "import ProcessCard from './ProcessCard';\nimport MacroRow from './MacroRow';\nimport Body3D from './Body3D';\n",
  1349, 1486, 'MetabolismMap')

# ---------- GoalTab ----------
comp_file('src/features/goal/GoalTab.jsx',
  MATH_IMPORT + "import NumberInput from '@/components/NumberInput';\n",
  1489, 1591, 'GoalTab')

# ---------- DishesTab / DishEditor ----------
comp_file('src/features/food/DishesTab.jsx', MATH_IMPORT, 1594, 1645, 'DishesTab')
comp_file('src/features/food/DishEditor.jsx', MATH_IMPORT, 1649, 1701, 'DishEditor')

# ---------- entryMeta helpers ----------
w('src/features/journal/entryMeta.js', seg(1703, 1720) +
  '\nexport { WORKOUT_NAMES, OTHER_NAMES, entryEmoji, entryLabel, entryMeta, formatTime };\n')

# ---------- ActivityHistory ----------
comp_file('src/features/journal/ActivityHistory.jsx',
  MATH_IMPORT + "import { entryEmoji, entryLabel, entryMeta, formatTime } from './entryMeta';\n",
  1723, 1811, 'ActivityHistory')

# ---------- ActivityLogger ----------
comp_file('src/features/activities/ActivityLogger.jsx',
  MATH_IMPORT + "import { WORKOUT_NAMES, OTHER_NAMES } from '@/features/journal/entryMeta';\nimport NumberInput from '@/components/NumberInput';\n",
  1816, 1996, 'ActivityLogger')

# ---------- InBody ----------
comp_file('src/features/inbody/InBodyEditor.jsx',
  MATH_IMPORT + "import NumberInput from '@/components/NumberInput';\n",
  2000, 2077, 'InBodyEditor')
comp_file('src/features/inbody/InBodyValue.jsx', '', 2081, 2100, 'InBodyValue')
comp_file('src/features/inbody/InBodyTab.jsx',
  MATH_IMPORT + "import InBodyValue from './InBodyValue';\n",
  2102, 2172, 'InBodyTab')

# ---------- Charts ----------
comp_file('src/features/journal/LineChart.jsx', MATH_IMPORT, 2177, 2246, 'LineChart')
comp_file('src/features/journal/ChartCard.jsx',
  "import LineChart from './LineChart';\n", 2250, 2264, 'ChartCard')
comp_file('src/features/journal/ChartsView.jsx',
  MATH_IMPORT + "import ChartCard from './ChartCard';\n", 2268, 2373, 'ChartsView')
comp_file('src/features/journal/Journal.jsx',
  MATH_IMPORT + "import ChartsView from './ChartsView';\nimport InBodyTab from '@/features/inbody/InBodyTab';\n",
  2377, 2441, 'Journal')

# ---------- Help ----------
comp_file('src/features/help/HelpContent.jsx', '', 2446, 2464, 'HelpContent')
comp_file('src/features/help/HelpTab.jsx',
  "import HelpContent from './HelpContent';\n", 2468, 2476, 'HelpTab')

# ---------- Profile / nav ----------
comp_file('src/features/profile/MobileProfile.jsx', MATH_IMPORT, 2480, 2524, 'MobileProfile')
icons = seg(2527, 2530)
w('src/components/icons.jsx',
  "const { useState, useMemo, useEffect, useRef } = React;\n\n" + icons +
  "\nexport { IconMap, IconGoal, IconJournal, IconMenu };\nexport default IconMap;\n")
comp_file('src/components/MobileNav.jsx',
  "import { IconMap, IconGoal, IconJournal, IconMenu } from './icons';\n",
  2532, 2543, 'MobileNav')

print('OK batch 2')
