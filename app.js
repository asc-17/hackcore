import { riskEngine, RiskTier, SignalAlignment, ConfidenceFlag } from './risk_engine.js';
import { explanationService } from './explanation_engine.js';

/**
 * State Store: In-memory reactive database
 */
export const store = {
  activeRole: 'personnel', // 'personnel' | 'commander' | 'officer'
  activeScreen: 'today',    // Screen key
  viewportMode: 'mobile',   // 'mobile' | 'fullscreen'
  selectedPersonnelId: 'RA-849201', // Currently viewed personnel (Sarah Jenkins)
  
  // Roster of simulated personnel
  personnelList: [
    {
      id: 'RA-849201',
      name: 'Cpl. Sarah Jenkins',
      shortName: 'SJ',
      rank: 'Cpl.',
      unit: 'Unit Bravo · Signals',
      platoon: '3rd Platoon, Bravo Co',
      consecutive_duty_days: 6,
      daily_duty_hours: 12,
      shift_type: 'Night Watch',
      days_since_leave: 18,
      lastCheckIn: 'Today 08:30',
      history: [
        { duty_hours: 8, sleep_quality: 4.5, mood: 4 },
        { duty_hours: 9, sleep_quality: 4.0, mood: 4 },
        { duty_hours: 10, sleep_quality: 3.5, mood: 3 },
        { duty_hours: 12, sleep_quality: 3.0, mood: 3 },
        { duty_hours: 12, sleep_quality: 2.5, mood: 2 },
        { duty_hours: 12, sleep_quality: 2.0, mood: 2 }
      ],
      todayCheckIn: {
        mood: 2,
        sleep_quality: 2,
        workload: 4.5,
        note: 'Double night shift rotation. Sleep fragmented.',
        completed: true
      },
      passiveHealth: {
        resting_hr: 78,
        hrv_rmssd: 31,
        sleep_hours: 4.2
      },
      riskResult: null,
      explanation: null
    },
    {
      id: 'RA-710492',
      name: 'Sgt. Marcus Rivera',
      shortName: 'MR',
      rank: 'Sgt.',
      unit: 'Unit Bravo · Infantry',
      platoon: '1st Platoon, Bravo Co',
      consecutive_duty_days: 2,
      daily_duty_hours: 8,
      shift_type: 'Base Ops',
      days_since_leave: 6,
      lastCheckIn: 'Yest. 16:45',
      history: [
        { duty_hours: 8, sleep_quality: 4.2, mood: 4 },
        { duty_hours: 8, sleep_quality: 4.5, mood: 5 },
        { duty_hours: 8, sleep_quality: 4.0, mood: 4 }
      ],
      todayCheckIn: { mood: 4, sleep_quality: 4.5, workload: 2, completed: true },
      passiveHealth: { resting_hr: 54, hrv_rmssd: 58, sleep_hours: 7.4 },
      riskResult: null,
      explanation: null
    },
    {
      id: 'RA-931048',
      name: 'Pvt. Alex Morgan',
      shortName: 'AM',
      rank: 'Pvt.',
      unit: 'Unit Bravo · Logistics',
      platoon: '2nd Platoon, Bravo Co',
      consecutive_duty_days: 4,
      daily_duty_hours: 10,
      shift_type: 'Patrol / Field',
      days_since_leave: 12,
      lastCheckIn: '3 days ago',
      history: [
        { duty_hours: 8, sleep_quality: 3.5, mood: 3 },
        { duty_hours: 9, sleep_quality: 3.2, mood: 3 }
      ],
      todayCheckIn: { mood: 3, sleep_quality: 3, workload: 3, completed: false },
      passiveHealth: { resting_hr: 62, hrv_rmssd: 44, sleep_hours: 6.2 },
      riskResult: null,
      explanation: null
    },
    {
      id: 'RA-654812',
      name: 'LCpl. David Chen',
      shortName: 'DC',
      rank: 'LCpl.',
      unit: 'Unit Bravo · Support',
      platoon: 'Support Platoon',
      consecutive_duty_days: 3,
      daily_duty_hours: 8,
      shift_type: 'QRF Ready',
      days_since_leave: 8,
      lastCheckIn: 'Oct 19',
      history: [
        { duty_hours: 8, sleep_quality: 4.5, mood: 4 },
        { duty_hours: 8, sleep_quality: 4.2, mood: 4 }
      ],
      todayCheckIn: { mood: 4, sleep_quality: 4, workload: 2, completed: true },
      passiveHealth: { resting_hr: 51, hrv_rmssd: 62, sleep_hours: 7.8 },
      riskResult: null,
      explanation: null
    },
    {
      id: 'RA-501239',
      name: 'Cpl. James Taylor',
      shortName: 'JT',
      rank: 'Cpl.',
      unit: 'Unit Bravo · Recon',
      platoon: '2nd Platoon, Bravo Co',
      consecutive_duty_days: 12,
      daily_duty_hours: 14,
      shift_type: 'Night Watch',
      days_since_leave: 28,
      lastCheckIn: 'Today 06:15',
      history: [
        { duty_hours: 12, sleep_quality: 2.0, mood: 5 },
        { duty_hours: 14, sleep_quality: 2.2, mood: 5 }
      ],
      // Conflicting: high objective burden, but reports mood 5/5
      todayCheckIn: { mood: 5, sleep_quality: 4.5, workload: 1.5, completed: true },
      passiveHealth: { resting_hr: 76, hrv_rmssd: 32, sleep_hours: 4.5 },
      riskResult: null,
      explanation: null
    }
  ],

  // Unit aggregate statistics
  unitData: {
    name: 'Unit Bravo',
    totalPersonnel: 184,
    checkInRate: 96,
    distribution: {
      stable: 132,
      moderate: 36,
      elevated: 14,
      priority: 2
    },
    factors: [
      { name: 'Sleep Deficit', sub: 'Sub-unit B', change: '+12%', tier: 'priority', icon: 'bedtime' },
      { name: 'Workload Strain', sub: 'Ops Team', change: '+8%', tier: 'moderate', icon: 'work' },
      { name: 'Leave Backlog', sub: 'On schedule', change: '-5%', tier: 'stable', icon: 'event_available' }
    ]
  },

  // Active crisis alerts (Parallel Zero-AI Path)
  crisisAlerts: [],

  // Clinical observation log for Wellness Officer
  clinicalNotes: [
    {
      id: 'cn-1',
      author: 'Dr. M. Vance · CMO',
      medId: '#9940',
      timeStr: 'Oct 21 · 14:15',
      text: 'Recommended adjusted shift rotation and scheduled 1-on-1 welfare check-in for Friday. Discussed continuous nocturnal duty impacts and prescribed sleep schedule adjustments.'
    }
  ],

  // Box Breathing Timer state
  breathingInterval: null
};

/**
 * Initialize Risk Evaluations for all personnel
 */
export function recalculateAllScores() {
  store.personnelList.forEach(p => {
    const risk = riskEngine.evaluate(
      p,
      p.history,
      {
        consecutive_duty_days: p.consecutive_duty_days,
        duty_hours: p.daily_duty_hours,
        shift_type: p.shift_type,
        days_since_leave: p.days_since_leave
      },
      p.todayCheckIn || {},
      p.passiveHealth
    );
    p.riskResult = risk;
    p.explanation = explanationService.synthesizeStructuredExplanation(risk, p);
  });

  // Re-aggregate unit totals
  let s = 0, m = 0, e = 0, pr = 0;
  store.personnelList.forEach(p => {
    if (p.riskResult.tier === RiskTier.STABLE) s++;
    else if (p.riskResult.tier === RiskTier.MODERATE) m++;
    else if (p.riskResult.tier === RiskTier.ELEVATED) e++;
    else if (p.riskResult.tier === RiskTier.PRIORITY) pr++;
  });

  // Scale to unit base 184
  const factor = 184 / store.personnelList.length;
  store.unitData.distribution = {
    stable: Math.round(s * factor),
    moderate: Math.round(m * factor),
    elevated: Math.round(e * factor),
    priority: Math.round(pr * factor)
  };
}

/**
 * Switch Active Role
 */
export function setRole(role) {
  store.activeRole = role;
  if (role === 'personnel') {
    store.activeScreen = 'today';
  } else if (role === 'commander') {
    store.activeScreen = 'unit-overview';
  } else if (role === 'officer') {
    store.activeScreen = 'wo-overview';
  }
  render();
}

/**
 * Switch Active Screen
 */
export function setScreen(screenName) {
  store.activeScreen = screenName;
  render();
}

/**
 * Toggle Viewport Mode
 */
export function toggleViewportMode() {
  store.viewportMode = store.viewportMode === 'mobile' ? 'fullscreen' : 'mobile';
  const vp = document.getElementById('app-viewport');
  if (vp) {
    if (store.viewportMode === 'fullscreen') {
      vp.classList.add('fullscreen-mode');
    } else {
      vp.classList.remove('fullscreen-mode');
    }
  }
  renderDevToolbar();
}

/**
 * Trigger Crisis Escalation (Parallel, Zero-AI Pathway)
 */
export function triggerEmergencyEscalation(reason = 'Acute Self-Reported Distress') {
  const currentPerson = getCurrentPersonnel();
  const alertEntry = {
    id: 'crisis-' + Date.now(),
    personnel_id: currentPerson.id,
    personnel_name: currentPerson.name,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    reason,
    status: 'ACTIVE'
  };

  store.crisisAlerts.unshift(alertEntry);

  // Open Crisis Modal Immediately for user
  openCrisisModal();

  // If in officer role or when officer loads, they will see the top crimson banner
  render();
}

export function getCurrentPersonnel() {
  return store.personnelList.find(p => p.id === store.selectedPersonnelId) || store.personnelList[0];
}

/**
 * Open Emergency Modal
 */
export function openCrisisModal() {
  let modal = document.getElementById('emergency-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'emergency-modal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal-sheet p-6 flex flex-col gap-5 text-left bg-white">
      <div class="flex items-center justify-between border-b pb-4 border-slate-100">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold">
            <span class="material-symbols-outlined text-[24px]">crisis_alert</span>
          </div>
          <div>
            <h3 class="font-bold text-lg text-slate-900 leading-snug">Immediate Support Available</h3>
            <p class="text-xs text-slate-500">Confidential · Zero Disciplinary Trace</p>
          </div>
        </div>
        <button onclick="document.getElementById('emergency-modal').remove()" class="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center">
          <span class="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>

      <div class="p-3 bg-red-50 rounded-xl border border-red-100 text-red-800 text-xs leading-relaxed">
        <strong>Direct Crisis Protocol Active:</strong> This parallel path bypasses all scoring algorithms and immediately provides human care resources.
      </div>

      <div class="flex flex-col gap-3">
        <a href="tel:988" class="p-4 rounded-xl bg-slate-50 hover:bg-teal-50 border border-slate-200 hover:border-teal-300 transition-all flex items-center justify-between text-slate-900 group">
          <div class="flex items-center gap-3">
            <span class="material-symbols-outlined text-[24px] text-teal-700">call</span>
            <div>
              <div class="font-bold text-sm">Military & Veterans Crisis Line</div>
              <div class="text-xs text-slate-500">Dial 988, then Press 1 (24/7 Toll-Free)</div>
            </div>
          </div>
          <span class="material-symbols-outlined text-teal-700 group-hover:translate-x-1 transition-transform">chevron_right</span>
        </a>

        <button onclick="alert('Connecting to Unit Chaplain Duty Line...');" class="p-4 rounded-xl bg-slate-50 hover:bg-teal-50 border border-slate-200 hover:border-teal-300 transition-all flex items-center justify-between text-slate-900 group">
          <div class="flex items-center gap-3">
            <span class="material-symbols-outlined text-[24px] text-teal-700">church</span>
            <div>
              <div class="font-bold text-sm">Unit Chaplain Confidential Line</div>
              <div class="text-xs text-slate-500">100% Privileged Communication</div>
            </div>
          </div>
          <span class="material-symbols-outlined text-teal-700 group-hover:translate-x-1 transition-transform">chevron_right</span>
        </button>

        <button onclick="alert('Priority alert notified to Duty Wellness Officer (Dr. M. Vance). Support dispatched.'); document.getElementById('emergency-modal').remove();" class="p-4 rounded-xl bg-teal-800 text-white hover:bg-teal-900 transition-colors flex items-center justify-center gap-2 font-semibold text-sm shadow-md">
          <span class="material-symbols-outlined text-[20px]">medical_services</span>
          <span>Notify Duty Wellness Officer Directly</span>
        </button>
      </div>

      <p class="text-[11px] text-slate-400 text-center leading-tight">
        Commanders are never notified of confidential hotline connections or peer chats.
      </p>
    </div>
  `;
}

/**
 * Render Dev / Simulator Toolbar
 */
export function renderDevToolbar() {
  let tb = document.getElementById('dev-toolbar');
  if (!tb) {
    tb = document.createElement('div');
    tb.id = 'dev-toolbar';
    tb.className = 'dev-toolbar';
    document.body.prepend(tb);
  }

  tb.innerHTML = `
    <div class="flex items-center gap-2">
      <span class="text-[11px] font-bold tracking-wider text-teal-300 uppercase">Role:</span>
      <button class="role-badge-btn ${store.activeRole === 'personnel' ? 'active' : ''}" onclick="window.app.setRole('personnel')">
        <span class="material-symbols-outlined text-[15px]">person</span> Personnel
      </button>
      <button class="role-badge-btn ${store.activeRole === 'commander' ? 'active' : ''}" onclick="window.app.setRole('commander')">
        <span class="material-symbols-outlined text-[15px]">shield</span> Commander
      </button>
      <button class="role-badge-btn ${store.activeRole === 'officer' ? 'active' : ''}" onclick="window.app.setRole('officer')">
        <span class="material-symbols-outlined text-[15px]">stethoscope</span> Wellness Officer
      </button>
    </div>

    <div class="w-[1px] h-4 bg-white/20"></div>

    <div class="flex items-center gap-2">
      <select onchange="window.app.loadScenario(this.value)" class="bg-black/40 text-xs text-white border border-white/20 rounded-full px-2.5 py-1 focus:outline-none cursor-pointer">
        <option value="">⚡ Test Scenarios (Tasks.md)</option>
        <option value="stable">Scenario A: Stable Baseline</option>
        <option value="burnout">Scenario B: Gradual Burnout (Elevated)</option>
        <option value="acute">Scenario C: Acute High Risk (Priority)</option>
        <option value="coldstart">Scenario D: Cold Start (Low Data)</option>
        <option value="conflicting">Scenario E: Masked Distress (Conflicting)</option>
      </select>
    </div>

    <div class="w-[1px] h-4 bg-white/20"></div>

    <button onclick="window.app.toggleViewportMode()" class="text-white/80 hover:text-white flex items-center gap-1 text-xs" title="Toggle Frame Width">
      <span class="material-symbols-outlined text-[16px]">${store.viewportMode === 'mobile' ? 'desktop_windows' : 'smartphone'}</span>
      <span>${store.viewportMode === 'mobile' ? 'Full View' : 'Mobile View'}</span>
    </button>
  `;
}

/**
 * Load Hand-Crafted Test Scenarios from tasks.md (Phase 2.3)
 */
export function loadScenario(scenarioKey) {
  if (!scenarioKey) return;
  const person = getCurrentPersonnel();

  if (scenarioKey === 'stable') {
    person.consecutive_duty_days = 2;
    person.daily_duty_hours = 8;
    person.shift_type = 'Base Ops';
    person.todayCheckIn = { mood: 4, sleep_quality: 4.5, workload: 2, completed: true };
  } else if (scenarioKey === 'burnout') {
    person.consecutive_duty_days = 10;
    person.daily_duty_hours = 12;
    person.shift_type = 'Night Watch';
    person.todayCheckIn = { mood: 2, sleep_quality: 2.0, workload: 4.5, completed: true };
  } else if (scenarioKey === 'acute') {
    person.consecutive_duty_days = 14;
    person.daily_duty_hours = 16;
    person.shift_type = 'Night Watch';
    person.todayCheckIn = { mood: 1, sleep_quality: 1.0, workload: 5.0, completed: true };
  } else if (scenarioKey === 'coldstart') {
    person.history = []; // Clear history to trigger cold start
    person.consecutive_duty_days = 1;
    person.todayCheckIn = { mood: 3, sleep_quality: 3.5, workload: 3, completed: true };
  } else if (scenarioKey === 'conflicting') {
    // Heavy duty but reports mood 5/5
    person.consecutive_duty_days = 14;
    person.daily_duty_hours = 14;
    person.shift_type = 'Night Watch';
    person.todayCheckIn = { mood: 5, sleep_quality: 5, workload: 1, completed: true };
  }

  recalculateAllScores();
  render();
}

/**
 * Master Render Loop
 */
export function render() {
  renderDevToolbar();
  const container = document.getElementById('screen-content');
  if (!container) return;

  const currentPerson = getCurrentPersonnel();
  const risk = currentPerson.riskResult || riskEngine.evaluate(currentPerson);
  const explanation = currentPerson.explanation || explanationService.synthesizeStructuredExplanation(risk, currentPerson);

  // Update shell header & bottom navigation
  renderHeader();
  renderBottomNav();

  // Render role-specific screens
  if (store.activeRole === 'personnel') {
    if (store.activeScreen === 'today') {
      container.innerHTML = getPersonnelTodayHTML(currentPerson, risk);
      bindPersonnelTodayEvents();
    } else if (store.activeScreen === 'my-wellness') {
      container.innerHTML = getPersonnelWellnessHTML(currentPerson, risk, explanation);
      bindPersonnelWellnessEvents();
    } else {
      container.innerHTML = getProfileHTML(currentPerson);
    }
  } else if (store.activeRole === 'commander') {
    if (store.activeScreen === 'unit-overview') {
      container.innerHTML = getCommanderUnitHTML();
      bindCommanderUnitEvents();
    } else if (store.activeScreen === 'commander-entry') {
      container.innerHTML = getCommanderDataEntryHTML();
      bindCommanderEntryEvents();
    } else {
      container.innerHTML = getProfileHTML(currentPerson);
    }
  } else if (store.activeRole === 'officer') {
    if (store.activeScreen === 'wo-overview') {
      container.innerHTML = getOfficerOverviewHTML();
      bindOfficerOverviewEvents();
    } else if (store.activeScreen === 'wo-roster') {
      container.innerHTML = getOfficerRosterHTML();
      bindOfficerRosterEvents();
    } else if (store.activeScreen === 'wo-detail') {
      container.innerHTML = getOfficerDetailHTML(currentPerson, risk, explanation);
      bindOfficerDetailEvents();
    } else {
      container.innerHTML = getProfileHTML(currentPerson);
    }
  }
}

/**
 * Header Render with Title and Role Indicator
 */
function renderHeader() {
  const header = document.getElementById('app-header');
  if (!header) return;

  let title = 'Today';
  if (store.activeRole === 'personnel') {
    title = store.activeScreen === 'today' ? 'Today' : (store.activeScreen === 'my-wellness' ? 'My Wellness' : 'Profile');
  } else if (store.activeRole === 'commander') {
    title = store.activeScreen === 'unit-overview' ? 'Unit Overview' : 'Duty Entry';
  } else if (store.activeRole === 'officer') {
    title = store.activeScreen === 'wo-overview' ? 'Welfare Overview' : (store.activeScreen === 'wo-roster' ? 'Unit Roster' : 'Analytical Detail');
  }

  header.innerHTML = `
    <div class="h-6 px-4 flex items-center justify-between text-stone-500 select-none text-[12px] font-semibold">
      <span>09:41</span>
      <div class="flex items-center gap-2">
        <span class="material-symbols-outlined text-[15px]">signal_cellular_alt</span>
        <span class="material-symbols-outlined text-[15px]">wifi</span>
        <span class="material-symbols-outlined text-[16px]">battery_full</span>
      </div>
    </div>
    <div class="h-16 px-4 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <img alt="Welfare Monitor App Logo" class="h-8 w-auto object-contain" src="https://lh3.googleusercontent.com/aida/AEtjO1VtAWH3Vz13w6SwXRAo-Z8KUho7xmpMkOdINTH1Nyt-tM7PZeJOBSEKalAOKK2lYV9oPl6D4ldtD-ghCyBe9E8LrYtGEdV1e0S9YaHon-p8urGXoKUBcwvuHlkDwCWr1gv_1m7EI1o8drpmxGiHtiylLCrssUZd1Z3XdQJrSXeSx0JdIYzrUFekkpjR85kdRNeOPZUNZ_5cWsC8fvRUecp2Xi3NTXdG_jZzkjQMz8rBM4hfAPF1dDzcybjq"/>
        <div class="flex flex-col">
          <span class="text-[11px] text-stone-500 font-medium leading-none">Welfare Monitor</span>
          <h1 class="text-[17px] font-semibold text-stone-900 tracking-tight leading-tight">${title}</h1>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button onclick="window.app.triggerEmergencyEscalation()" class="px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 text-xs font-semibold flex items-center gap-1 hover:bg-rose-200 transition-colors" title="Trigger Instant Confidential Crisis Protocol">
          <span class="material-symbols-outlined text-[15px]">sos</span>
          <span>Crisis</span>
        </button>
        <button class="w-8 h-8 rounded-full bg-teal-800 flex items-center justify-center text-white" onclick="window.app.setRole(store.activeRole === 'personnel' ? 'commander' : (store.activeRole === 'commander' ? 'officer' : 'personnel'))">
          <span class="material-symbols-outlined text-[18px]">person</span>
        </button>
      </div>
    </div>
  `;
}

/**
 * Bottom Nav Render with Role-gated tabs
 */
function renderBottomNav() {
  const nav = document.getElementById('app-bottom-nav');
  if (!nav) return;

  let items = [];
  if (store.activeRole === 'personnel') {
    items = [
      { id: 'today', label: 'Today', icon: 'event_available' },
      { id: 'my-wellness', label: 'My Wellness', icon: 'vital_signs' },
      { id: 'profile', label: 'Profile', icon: 'account_circle' }
    ];
  } else if (store.activeRole === 'commander') {
    items = [
      { id: 'unit-overview', label: 'Unit', icon: 'shield' },
      { id: 'commander-entry', label: 'Duty Entry', icon: 'edit_calendar' },
      { id: 'profile', label: 'Profile', icon: 'account_circle' }
    ];
  } else if (store.activeRole === 'officer') {
    items = [
      { id: 'wo-overview', label: 'Triage', icon: 'warning' },
      { id: 'wo-roster', label: 'Roster', icon: 'format_list_bulleted' },
      { id: 'wo-detail', label: 'Clinical Detail', icon: 'query_stats' }
    ];
  }

  nav.innerHTML = `
    <div class="mb-2 pointer-events-auto bg-white/90 backdrop-blur-xl rounded-full shadow-[0_4px_20px_rgba(28,35,33,0.08)] px-2 py-1 flex items-center justify-around">
      ${items.map(it => `
        <button onclick="window.app.setScreen('${it.id}')" class="flex-1 min-w-[56px] min-h-[50px] flex flex-col items-center justify-center gap-1 transition-colors ${store.activeScreen === it.id ? 'text-[#2E8B8B] font-semibold' : 'text-stone-500'}">
          <span class="material-symbols-outlined text-[22px]">${it.icon}</span>
          <span class="text-[11px]">${it.label}</span>
        </button>
      `).join('')}
    </div>
  `;
}

// -------------------------------------------------------------
// SCREEN 1: Personnel Today (Daily Check-in Flow)
// -------------------------------------------------------------
function getPersonnelTodayHTML(person, risk) {
  const checkIn = person.todayCheckIn || { mood: 3, sleep_quality: 4, workload: 2, completed: false };

  return `
    <div class="flex flex-col w-full gap-5 fade-in">
      <!-- Friendly Top Bar / Personnel Greeting -->
      <div class="flex items-center justify-between pt-1">
        <div class="flex flex-col">
          <span class="text-xs text-stone-500 tracking-normal">Thursday, Operational Roster</span>
          <h2 class="text-xl text-stone-900 tracking-tight font-semibold">Good evening, ${person.name.split(' ')[1] || person.name}</h2>
        </div>
        <!-- Presence / Mood Indicator -->
        <div class="flex items-center gap-2 bg-white/80 backdrop-blur-md px-3 py-1 rounded-full shadow-sm">
          <div class="relative flex items-center justify-center">
            <span class="w-2.5 h-2.5 rounded-full ${risk.tier === 'STABLE' ? 'bg-[#3FAE68]' : (risk.tier === 'MODERATE' ? 'bg-[#E8A63D]' : 'bg-[#EF7A34]')}"></span>
            <span class="absolute w-2.5 h-2.5 rounded-full ${risk.tier === 'STABLE' ? 'bg-[#3FAE68]' : 'bg-[#EF7A34]'} animate-ping opacity-75"></span>
          </div>
          <span class="text-xs text-stone-800 font-medium">${risk.tier === 'STABLE' ? 'Rest & Recover' : 'Caution Level'}</span>
        </div>
      </div>

      <!-- Primary Interactive Check-in Container -->
      <div class="bg-white rounded-[20px] p-5 shadow-[0_2px_8px_rgba(20,30,28,0.06)] flex flex-col gap-4 transition-all duration-300 ${checkIn.completed ? 'opacity-90' : ''}" id="checkin-interactive-card">
        <div class="flex items-start justify-between">
          <div>
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-[#2E8B8B] text-[20px]">spa</span>
              <h3 class="text-[17px] font-semibold text-stone-900">Daily Pulse</h3>
            </div>
            <p class="text-xs text-stone-500 mt-0.5">Takes 15 seconds · Pause and listen</p>
          </div>
          <span class="text-[11px] text-[#2E8B8B] bg-[#E4F3F3] px-2 py-0.5 rounded-full font-semibold tracking-wider uppercase">Evening</span>
        </div>

        <!-- Question 1: Mood -->
        <div class="flex flex-col gap-2" data-question="mood">
          <div class="flex justify-between items-center text-sm">
            <span class="text-stone-900 font-medium">How was your day?</span>
            <span class="text-xs text-stone-500 font-medium" id="mood-label">${['Tough', 'Heavy', 'Neutral', 'Good', 'Great'][Math.round(checkIn.mood) - 1] || 'Neutral'}</span>
          </div>
          <div class="flex items-center justify-between gap-2 px-1">
            ${[1, 2, 3, 4, 5].map(v => `
              <button onclick="window.app.selectCheckInVal('mood', ${v})" class="w-11 h-11 rounded-full flex items-center justify-center transition-all ${checkIn.mood === v ? 'bg-[#2E8B8B] text-white shadow-md scale-105' : 'bg-slate-50 text-stone-600 shadow-sm hover:scale-105'}">
                <span class="text-xs font-bold">${checkIn.mood === v ? '✓' : v}</span>
              </button>
            `).join('')}
          </div>
          <div class="flex justify-between items-center px-2 text-[11px] text-stone-400">
            <span>Tough</span>
            <span>Great</span>
          </div>
        </div>

        <!-- Question 2: Sleep -->
        <div class="flex flex-col gap-2" data-question="sleep">
          <div class="flex justify-between items-center text-sm">
            <span class="text-stone-900 font-medium">How was your sleep?</span>
            <span class="text-xs text-stone-500 font-medium" id="sleep-label">${['Restless', 'Poor', 'Fair', 'Restful', 'Deep'][Math.round(checkIn.sleep_quality) - 1] || 'Restful'}</span>
          </div>
          <div class="flex items-center justify-between gap-2 px-1">
            ${[1, 2, 3, 4, 5].map(v => `
              <button onclick="window.app.selectCheckInVal('sleep_quality', ${v})" class="w-11 h-11 rounded-full flex items-center justify-center transition-all ${checkIn.sleep_quality === v ? 'bg-[#2E8B8B] text-white shadow-md scale-105' : 'bg-slate-50 text-stone-600 shadow-sm hover:scale-105'}">
                <span class="text-xs font-bold">${checkIn.sleep_quality === v ? '✓' : v}</span>
              </button>
            `).join('')}
          </div>
          <div class="flex justify-between items-center px-2 text-[11px] text-stone-400">
            <span>Restless</span>
            <span>Deep</span>
          </div>
        </div>

        <!-- Question 3: Workload -->
        <div class="flex flex-col gap-2" data-question="workload">
          <div class="flex justify-between items-center text-sm">
            <span class="text-stone-900 font-medium">How heavy did work feel?</span>
            <span class="text-xs text-stone-500 font-medium" id="workload-label">${['Light', 'Manageable', 'Moderate', 'Heavy', 'Exhausting'][Math.round(checkIn.workload) - 1] || 'Manageable'}</span>
          </div>
          <div class="flex items-center justify-between gap-2 px-1">
            ${[1, 2, 3, 4, 5].map(v => `
              <button onclick="window.app.selectCheckInVal('workload', ${v})" class="w-11 h-11 rounded-full flex items-center justify-center transition-all ${checkIn.workload === v ? 'bg-[#2E8B8B] text-white shadow-md scale-105' : 'bg-slate-50 text-stone-600 shadow-sm hover:scale-105'}">
                <span class="text-xs font-bold">${checkIn.workload === v ? '✓' : v}</span>
              </button>
            `).join('')}
          </div>
          <div class="flex justify-between items-center px-2 text-[11px] text-stone-400">
            <span>Light</span>
            <span>Exhausting</span>
          </div>
        </div>

        <!-- Personal Note Collapsible -->
        <div class="flex flex-col gap-2 pt-1">
          <button onclick="document.getElementById('note-container').classList.toggle('hidden')" class="flex items-center gap-2 text-[#2E8B8B] text-xs font-semibold self-start" type="button">
            <span class="material-symbols-outlined text-[18px]">edit_note</span>
            <span>+ Add a personal note (private to you)</span>
          </button>
          <div class="${checkIn.note ? '' : 'hidden'} flex flex-col gap-1 mt-1" id="note-container">
            <textarea id="personal-note-input" class="w-full bg-slate-50 rounded-xl p-3 text-xs text-stone-800 placeholder:text-stone-400 focus:outline-none focus:bg-white resize-none border border-slate-100" placeholder="Jot down brief thoughts, stressors, or wins..." rows="2">${checkIn.note || ''}</textarea>
          </div>
        </div>

        <!-- Action Button -->
        <button onclick="window.app.submitCheckIn()" class="w-full h-12 rounded-[14px] bg-[#2E8B8B] text-white font-semibold flex items-center justify-center gap-2 shadow-sm active:scale-[0.99] hover:bg-[#1F6666] transition-all mt-1">
          <span>${checkIn.completed ? 'Update Today\'s Pulse' : 'Done'}</span>
          <span class="material-symbols-outlined text-[20px]">arrow_forward</span>
        </button>
      </div>

      <!-- Completed State Card -->
      <div class="bg-white rounded-[20px] overflow-hidden shadow-[0_2px_8px_rgba(20,30,28,0.06)] flex flex-col">
        <div class="relative w-full h-28 overflow-hidden bg-[#E4F3F3]">
          <img alt="Check-in Completion Sunrise" class="w-full h-full object-cover object-center" src="https://lh3.googleusercontent.com/aida/AEtjO1WhiI-fKSGgSSqm9mg57sBqfHaeiz-l4LnDkQ_fWdWFv6NHZErP4TbSfy-ON3KONujFZFHXxoXf7-uLMeLfzKJh_qNX_WxRTQZGaQ_r6u-BEfe3uotM5A3fa2Dedy_qIppnZRL4oFVGqQrOW1HYf_g4oQmgkpfzJBWgPIbNBhwJJP3xCxYiogAs6zwRQiavI2wJQsAe3p4hHpew-_AtChzVjswn39HctsfIk3RRJQN1BCsH2W_uk9rPUBbI"/>
          <div class="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent"></div>
        </div>
        <div class="p-5 pt-2 flex flex-col gap-3">
          <div class="flex items-center gap-2">
            <span class="w-6 h-6 rounded-full bg-[#E7F6ED] text-[#3FAE68] flex items-center justify-center">
              <span class="material-symbols-outlined text-[16px]">done_all</span>
            </span>
            <h3 class="text-[17px] font-semibold text-stone-900">You checked in today</h3>
          </div>
          <p class="text-xs text-stone-500 leading-relaxed">
            Your reflections help calibrate your baseline picture and protect your unit from within.
          </p>
          <div class="flex items-center justify-between pt-2">
            <div class="flex items-center gap-2">
              <div class="flex -space-x-1.5 overflow-hidden">
                <span class="h-6 w-6 rounded-full bg-[#E4F3F3] text-[#2E8B8B] flex items-center justify-center text-[10px] font-bold">M</span>
                <span class="h-6 w-6 rounded-full bg-[#E4F3F3] text-[#2E8B8B] flex items-center justify-center text-[10px] font-bold">T</span>
                <span class="h-6 w-6 rounded-full bg-[#E4F3F3] text-[#2E8B8B] flex items-center justify-center text-[10px] font-bold">W</span>
                <span class="h-6 w-6 rounded-full bg-[#2E8B8B] text-white flex items-center justify-center text-[10px] font-bold shadow-sm">T</span>
              </div>
              <span class="text-xs text-stone-500 font-medium">4-day streak</span>
            </div>
            <button onclick="window.app.setScreen('my-wellness')" class="text-xs text-[#2E8B8B] font-semibold flex items-center gap-1">
              <span>View My Profile</span>
              <span class="material-symbols-outlined text-[14px]">arrow_forward</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Health Connect Sync Pill -->
      <div class="bg-[#E4F3F3] rounded-[14px] px-4 py-3 flex items-center justify-between shadow-sm">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-full bg-white flex items-center justify-center text-[#2E8B8B] shrink-0">
            <span class="material-symbols-outlined text-[20px]">favorite</span>
          </div>
          <div class="flex flex-col">
            <span class="text-[11px] font-bold text-[#2E8B8B] uppercase tracking-wider">Health Connect Synced</span>
            <span class="text-xs text-[#2E8B8B] font-medium truncate">${person.passiveHealth.sleep_hours}h sleep · ${person.passiveHealth.resting_hr} bpm resting HR</span>
          </div>
        </div>
        <span class="material-symbols-outlined text-[#2E8B8B] text-[20px]">chevron_forward</span>
      </div>

      <!-- Privacy Reassurance Footnote -->
      <div class="flex items-center justify-center gap-2 px-4 pb-4 text-center text-stone-500">
        <span class="material-symbols-outlined text-[16px]">lock</span>
        <p class="text-xs">Your daily check-in responses are strictly private and never shared with commanders.</p>
      </div>
    </div>
  `;
}

function bindPersonnelTodayEvents() {}

// -------------------------------------------------------------
// SCREEN 2: Personnel My Wellness (Arc Gauge, Breathing, Crisis Card)
// -------------------------------------------------------------
function getPersonnelWellnessHTML(person, risk, explanation) {
  // Arc calculation: circumference = 2 * pi * 78 = 490.09
  // 270 degrees = 367.57. Dashoffset ranges from 367.57 (0) to 36.7 (full)
  const score = risk.score;
  const progressRatio = Math.min(1.0, score / 100);
  const strokeDashoffset = 367.57 - (367.57 - 36.7) * (1.0 - progressRatio * 0.7);

  let tierColor = '#3FAE68';
  let tierBg = '#E7F6ED';
  if (risk.tier === 'MODERATE') { tierColor = '#E8A63D'; tierBg = '#FCF2DF'; }
  else if (risk.tier === 'ELEVATED') { tierColor = '#EF7A34'; tierBg = '#FDEBDF'; }
  else if (risk.tier === 'PRIORITY') { tierColor = '#D64545'; tierBg = '#FAE4E4'; }

  return `
    <div class="flex flex-col w-full gap-5 fade-in">
      <!-- Screen Header -->
      <div class="flex flex-col gap-1">
        <span class="text-[11px] uppercase tracking-widest text-[#006767] font-semibold">Self-Care & Insights</span>
        <h1 class="text-2xl font-bold text-stone-900 tracking-tight">My Wellness</h1>
        <p class="text-xs text-stone-500">Your current 14-day welfare profile</p>
      </div>

      <!-- Central Visual Hero: Circular Arc Gauge Card -->
      <div class="w-full bg-white rounded-[20px] shadow-sm p-5 flex flex-col items-center relative overflow-hidden">
        <div class="absolute -top-10 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full pointer-events-none blur-xl" style="background: radial-gradient(circle, ${tierBg} 0%, transparent 70%);"></div>
        
        <!-- Arc Gauge SVG -->
        <div class="relative w-56 h-56 flex items-center justify-center my-2">
          <svg class="w-full h-full transform -rotate-[135deg]" viewBox="0 0 200 200">
            <circle cx="100" cy="100" fill="transparent" r="78" stroke="#E7EBEA" stroke-dasharray="367.57 490.09" stroke-dashoffset="0" stroke-linecap="round" stroke-width="14"></circle>
            <circle id="wellness-gauge-arc" cx="100" cy="100" fill="transparent" r="78" stroke="${tierColor}" stroke-dasharray="367.57 490.09" stroke-dashoffset="${strokeDashoffset}" stroke-linecap="round" stroke-width="14"></circle>
          </svg>
          <div class="absolute inset-0 flex flex-col items-center justify-center pt-2 select-none">
            <div class="w-2.5 h-2.5 rounded-full mb-1 shadow-[0_0_8px_rgba(63,174,104,0.6)]" style="background-color: ${tierColor}"></div>
            <span class="text-3xl font-bold text-stone-900 tracking-tight">${risk.tier}</span>
            <span class="text-[11px] text-stone-500 mt-1 tracking-wide font-medium">14-DAY STATUS</span>
          </div>
        </div>

        <p class="text-sm text-stone-600 text-center px-4 leading-relaxed">
          ${explanation.summary}
        </p>

        <!-- Trendline Sparkline Wave -->
        <div class="w-full mt-4 pt-3 flex flex-col gap-2 bg-slate-50/80 rounded-xl p-3">
          <div class="flex items-center justify-between text-xs">
            <div class="flex items-center gap-1 text-stone-600 font-medium">
              <span class="material-symbols-outlined text-[16px]" style="color: ${tierColor}">trending_flat</span>
              <span>Trending: ${risk.tier === 'STABLE' ? 'Stable over 14 days' : 'Elevated duty load'}</span>
            </div>
            <span class="text-[11px] text-stone-400">${risk.signal_alignment}</span>
          </div>
          <div class="w-full h-10 relative flex items-center">
            <svg class="w-full h-10 overflow-visible" preserveAspectRatio="none" viewBox="0 0 320 48">
              <path d="M0,28 C40,26 65,30 100,24 C140,18 175,27 215,22 C255,18 285,25 320,${Math.round(48 - (score / 100) * 36)} L320,48 L0,48 Z" fill="${tierColor}" fill-opacity="0.12"></path>
              <path d="M0,28 C40,26 65,30 100,24 C140,18 175,27 215,22 C255,18 285,25 320,${Math.round(48 - (score / 100) * 36)}" fill="none" stroke="${tierColor}" stroke-linecap="round" stroke-width="2.5"></path>
              <circle cx="320" cy="${Math.round(48 - (score / 100) * 36)}" fill="${tierColor}" r="4.5"></circle>
            </svg>
          </div>
        </div>

        <!-- Contextual Pillar Badges -->
        <div class="w-full flex items-center justify-between gap-2 mt-4 flex-wrap">
          <div class="flex-1 min-w-[96px] bg-[#E4F3F3] rounded-full px-3 py-2 flex items-center justify-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-[#2E8B8B]"></span>
            <span class="text-xs text-[#2E8B8B] font-semibold truncate">Sleep · ${person.passiveHealth.sleep_hours > 6 ? 'Restful' : 'Deficit'}</span>
          </div>
          <div class="flex-1 min-w-[96px] bg-[#E7F6ED] rounded-full px-3 py-2 flex items-center justify-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-[#3FAE68]"></span>
            <span class="text-xs text-[#3FAE68] font-semibold truncate">Workload · ${person.consecutive_duty_days > 5 ? 'High' : 'Controlled'}</span>
          </div>
          <div class="flex-1 min-w-[96px] bg-[#E4F3F3] rounded-full px-3 py-2 flex items-center justify-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-[#2E8B8B]"></span>
            <span class="text-xs text-[#2E8B8B] font-semibold truncate">Recovery · ${risk.tier === 'STABLE' ? 'High' : 'Moderate'}</span>
          </div>
        </div>
      </div>

      <!-- Suggested Micro-Practice Card: Box Breathing -->
      <div class="w-full bg-white rounded-[20px] shadow-sm overflow-hidden flex flex-col">
        <div class="w-full bg-[#E4F3F3]/50 relative flex items-center justify-center overflow-hidden">
          <img alt="Box Breathing Wave Graphic" class="w-full h-auto max-h-[160px] object-cover object-center" src="https://lh3.googleusercontent.com/aida/AEtjO1VGPXRxlntZOVYylXxKmVj0pkMw-sYC_Jcfrj2maV-PXL0BdVuTdB5ZPx-8hjcTXLmYSi7V-F0sDuZ2uVrIitok7uEAVEa6EbclnX6fY_xgHh8_03TfTG4dGkgCz3b1saXz0cAGPpP7p83hoXhUY9zgoiYTKwm12p2cTRRS6EdFyBMq0hKKAqu39hLScURKM54qpRFtIT9aehRi6JziH_e1k74kDB6yjzbFGl3cgma_PyShigam2Bz-6w4_"/>
          <div class="absolute top-3 right-3 bg-white/90 backdrop-blur-md rounded-full px-2.5 py-1 flex items-center gap-1">
            <span class="material-symbols-outlined text-[14px] text-[#2E8B8B]">timer</span>
            <span class="text-[11px] text-[#2E8B8B] font-semibold">3 MIN</span>
          </div>
        </div>
        <div class="p-5 flex flex-col gap-3">
          <div>
            <span class="text-[11px] uppercase tracking-wider text-[#2E8B8B] font-bold">Suggested Micro-Practice</span>
            <h2 class="text-[17px] font-semibold text-stone-900">3-Minute Box Breathing</h2>
            <p class="text-xs text-stone-500 leading-relaxed mt-1">
              Inhale 4s · Hold 4s · Exhale 4s · Hold 4s to steady heart rate variability and ease sympathetic nervous tension.
            </p>
          </div>

          <button id="breathing-trigger-btn" onclick="window.app.toggleBreathingSession()" class="w-full h-11 bg-[#2E8B8B] active:bg-[#1F6666] text-white font-semibold text-sm rounded-[14px] flex items-center justify-center gap-2 shadow-sm transition-all">
            <span class="material-symbols-outlined text-[20px]">play_circle</span>
            <span>Begin session</span>
          </button>

          <!-- Interactive Active Breathing State -->
          <div id="breathing-panel" class="hidden flex-col items-center gap-3 py-4 bg-[#EEF3EC]/50 rounded-xl mt-1">
            <div class="relative w-24 h-24 flex items-center justify-center">
              <div id="breathing-orb" class="w-14 h-14 rounded-full bg-[#2E8B8B]/20 flex items-center justify-center transition-all duration-1000 ease-in-out">
                <div class="w-8 h-8 rounded-full bg-[#2E8B8B] text-white flex items-center justify-center shadow-md">
                  <span class="material-symbols-outlined text-[16px]">air</span>
                </div>
              </div>
            </div>
            <div class="flex flex-col items-center">
              <span id="breathing-phase-text" class="text-sm font-bold text-stone-900">Inhale slowly...</span>
              <span id="breathing-timer-text" class="text-xs text-stone-500">4 seconds</span>
            </div>
            <button onclick="window.app.toggleBreathingSession()" class="text-xs text-stone-500 hover:text-stone-800 underline">
              Pause practice
            </button>
          </div>
        </div>
      </div>

      <!-- Crisis Support Invitation: Soft Rose -->
      <div class="w-full bg-[#FCE9EC] rounded-[20px] shadow-sm overflow-hidden flex flex-col">
        <div class="w-full flex items-center justify-center overflow-hidden">
          <img alt="Crisis Support Warm Graphic" class="w-full h-auto max-h-[100px] object-cover object-center" src="https://lh3.googleusercontent.com/aida/AEtjO1Ui0WUWIdA9SkzMTj1oZ7TfxVpQMBuJZXpBmMAV6s_fNOCXQS8leGsWEN17QGjKyN7qRUTPlka8xjb1LQR-Cd-V9CrMrrQOaBPjOYnpACqbW1ktfAlljSSUSKaV73hxwXKJ6_2LTtvaTOYmGx2Ahu6FWmqViDQGUSGEPcXkh_WxCx-KHAECCFxjOaGWm4S8ERYmZUkwbirmITzWhXTs6NCK6Lc7nxAU9RjDMCftdvM4GOxQYFr8SK3fc-Cv"/>
        </div>
        <div class="p-5 flex flex-col gap-3">
          <div>
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 rounded-full bg-[#F2A6B4]"></div>
              <h2 class="text-[17px] font-semibold text-stone-900">Need someone to talk to?</h2>
            </div>
            <p class="text-xs text-stone-600 leading-relaxed mt-1">
              Confidential peer support and chaplains available 24/7. No disciplinary record is created.
            </p>
          </div>
          <button onclick="window.app.openCrisisModal()" class="w-full h-11 bg-white hover:bg-slate-50 text-[#894c59] font-semibold text-sm rounded-[14px] flex items-center justify-center gap-2 shadow-sm transition-transform active:scale-[0.98]">
            <span class="material-symbols-outlined text-[18px]">forum</span>
            <span>Connect Confidentially</span>
          </button>
        </div>
      </div>

      <!-- Footer Trust Reassurance -->
      <div class="flex items-center justify-center gap-2 py-4 px-3 text-center text-stone-500">
        <span class="material-symbols-outlined text-[16px]">lock</span>
        <p class="text-xs">Only you can see this page. Commanders only see anonymized unit-level aggregate totals.</p>
      </div>
    </div>
  `;
}

function bindPersonnelWellnessEvents() {}

// -------------------------------------------------------------
// SCREEN 3: Commander Unit Overview (Aggregate Only)
// -------------------------------------------------------------
function getCommanderUnitHTML() {
  const unit = store.unitData;
  const dist = unit.distribution;
  const total = dist.stable + dist.moderate + dist.elevated + dist.priority;
  const pStable = Math.round((dist.stable / total) * 100);
  const pMod = Math.round((dist.moderate / total) * 100);
  const pElev = Math.round((dist.elevated / total) * 100);
  const pPrio = Math.max(1, Math.round((dist.priority / total) * 100));

  return `
    <div class="flex flex-col w-full gap-4 pb-4 fade-in">
      <!-- Top Illustrated Banner & Unit Context Header -->
      <div class="relative w-full rounded-2xl overflow-hidden shadow-sm bg-[#F4F1EA]">
        <div class="w-full h-[115px] relative overflow-hidden">
          <img alt="Commander Banner Landscape" class="w-full h-full object-cover object-center" src="https://lh3.googleusercontent.com/aida/AEtjO1UardHHvCRWGLTy4NIJQSm5lQdgz8PAa-lywTgnu0T6y4JXe8gX_53F8H3oRnLuFcQQcll4aLSzY9jDeVq5vvMd8ADsegassHNxmMEX9r3G-UR54D0QWM2qmk3qM7ZU1K4yCY4CwICmkrdfs30mYEuxDa1vkHefvErLgzm3Jq6FjlCVhYveR670bi4rxqLNWewJsIE2OAf_buVYVaDX4EZ9sec75hUF5XyVJRKbva19o4SX1NiSJmLawPP5"/>
          <div class="absolute inset-0 bg-gradient-to-t from-[#F4F1EA] via-[#F4F1EA]/40 to-transparent"></div>
          <div class="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/85 backdrop-blur-md shadow-sm text-xs text-stone-600">
            <span class="w-2 h-2 rounded-full bg-[#3FAE68] animate-pulse"></span>
            <span class="text-[10px] font-bold uppercase tracking-wider">Live Aggregate</span>
          </div>
        </div>
        <div class="px-4 pb-4 pt-1 flex flex-col">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-[#2E8B8B] text-[22px]">shield</span>
            <h2 class="text-xl font-bold text-stone-900 tracking-tight">${unit.name} · ${unit.totalPersonnel} personnel</h2>
          </div>
          <p class="text-xs text-stone-500 mt-0.5">
            Active personnel roster · <span class="font-semibold text-[#2E8B8B]">${unit.checkInRate}% check-in rate today</span>
          </p>
        </div>
      </div>

      <!-- Unit Welfare Distribution Card -->
      <div class="w-full rounded-[20px] bg-white p-4 shadow-sm flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-full bg-[#E4F3F3] flex items-center justify-center text-[#2E8B8B]">
              <span class="material-symbols-outlined text-[18px]">pie_chart</span>
            </div>
            <h3 class="text-sm font-bold text-stone-900">Unit Welfare Distribution</h3>
          </div>
          <span class="text-[11px] text-stone-500 px-2 py-0.5 rounded-full bg-slate-100">Today</span>
        </div>

        <!-- Horizontal Stacked Bar -->
        <div class="flex flex-col gap-1.5 pt-1">
          <div class="w-full h-4 rounded-full overflow-hidden flex bg-slate-100 shadow-inner">
            <div class="h-full bg-[#3FAE68] transition-all duration-500" style="width: ${pStable}%;" title="Stable (${pStable}%)"></div>
            <div class="h-full bg-[#E8A63D] transition-all duration-500" style="width: ${pMod}%;" title="Moderate (${pMod}%)"></div>
            <div class="h-full bg-[#EF7A34] transition-all duration-500" style="width: ${pElev}%;" title="Elevated (${pElev}%)"></div>
            <div class="h-full bg-[#D64545] transition-all duration-500" style="width: ${pPrio}%;" title="Priority (${pPrio}%)"></div>
          </div>
          <div class="flex justify-between items-center text-[11px] text-stone-500 px-1">
            <span>${pStable}% Stable</span>
            <span>${pPrio}% Needs Support</span>
          </div>
        </div>

        <!-- Count Pills -->
        <div class="grid grid-cols-2 gap-2 pt-1">
          <div class="flex items-center justify-between px-3 py-2 rounded-full bg-[#E7F6ED]">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-[#3FAE68]"></span>
              <span class="text-xs text-stone-800 font-medium">Stable</span>
            </div>
            <span class="text-sm font-bold text-[#3FAE68]">${dist.stable}</span>
          </div>
          <div class="flex items-center justify-between px-3 py-2 rounded-full bg-[#FCF2DF]">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-[#E8A63D]"></span>
              <span class="text-xs text-stone-800 font-medium">Moderate</span>
            </div>
            <span class="text-sm font-bold text-[#E8A63D]">${dist.moderate}</span>
          </div>
          <div class="flex items-center justify-between px-3 py-2 rounded-full bg-[#FDEBDF]">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-[#EF7A34]"></span>
              <span class="text-xs text-stone-800 font-medium">Elevated</span>
            </div>
            <span class="text-sm font-bold text-[#EF7A34]">${dist.elevated}</span>
          </div>
          <div class="flex items-center justify-between px-3 py-2 rounded-full bg-[#FAE4E4]">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-[#D64545]"></span>
              <span class="text-xs text-stone-800 font-medium">Priority</span>
            </div>
            <span class="text-sm font-bold text-[#D64545]">${dist.priority}</span>
          </div>
        </div>

        <div class="flex items-center gap-2 pt-1 text-stone-500 text-[11px]">
          <span class="material-symbols-outlined text-[16px] text-[#2E8B8B]">verified_user</span>
          <span>Strict anonymization active: individual scores permanently hidden from commanders.</span>
        </div>
      </div>

      <!-- Organizational Stress Factors -->
      <div class="w-full rounded-[20px] bg-white p-4 shadow-sm flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-bold text-stone-900">Organizational Factors</h3>
          <span class="text-[11px] text-stone-500">Key Drivers</span>
        </div>
        <div class="flex flex-col gap-2">
          ${unit.factors.map(f => `
            <div class="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-full ${f.tier === 'priority' ? 'bg-[#FAE4E4] text-[#D64545]' : (f.tier === 'moderate' ? 'bg-[#FCF2DF] text-[#E8A63D]' : 'bg-[#E7F6ED] text-[#3FAE68]')} flex items-center justify-center">
                  <span class="material-symbols-outlined text-[18px]">${f.icon}</span>
                </div>
                <div class="flex flex-col">
                  <span class="text-xs font-semibold text-stone-900">${f.name}</span>
                  <span class="text-[10px] text-stone-400">${f.sub}</span>
                </div>
              </div>
              <span class="text-sm font-bold ${f.tier === 'priority' ? 'text-[#D64545]' : (f.tier === 'moderate' ? 'text-[#E8A63D]' : 'text-[#3FAE68]')}">${f.change}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Automated Operational Synthesis -->
      <div class="flex flex-col gap-3">
        <div class="flex items-center gap-2 px-1">
          <span class="material-symbols-outlined text-[#2E8B8B] text-[18px]">psychology</span>
          <h3 class="text-sm font-bold text-stone-900">Operational Synthesis</h3>
        </div>
        <div class="w-full rounded-[20px] bg-[#E4F3F3] p-4 flex flex-col gap-2 shadow-sm">
          <span class="text-[11px] font-bold text-[#2E8B8B] tracking-wider uppercase">WHAT'S DRIVING THIS</span>
          <p class="text-xs text-stone-800 leading-relaxed">
            Elevated fatigue markers correlate directly with prolonged nocturnal watch rotations in Section 3 and post-field exercise sleep deficit.
          </p>
        </div>
        <div class="w-full rounded-[20px] bg-[#FCF2DF] p-4 flex flex-col gap-2 shadow-sm">
          <span class="text-[11px] font-bold text-[#E8A63D] tracking-wider uppercase">RECOMMENDED ACTION</span>
          <p class="text-xs text-stone-800 leading-relaxed">
            Consider a 48-hour rotational rest pause for Bravo Platoons before next scheduled exercise. Stagger night watch allocations.
          </p>
        </div>
      </div>

      <!-- Interactive Commander Assistant Query -->
      <div class="w-full pt-1">
        <div class="w-full rounded-2xl bg-white shadow-sm p-2 flex items-center gap-2 border border-slate-100">
          <div class="w-8 h-8 rounded-full bg-[#E4F3F3] flex items-center justify-center text-[#2E8B8B] shrink-0">
            <span class="material-symbols-outlined text-[18px]">auto_awesome</span>
          </div>
          <input id="commander-query-input" class="w-full bg-transparent text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none px-2" placeholder="Ask about Unit Bravo readiness or fatigue drivers..." type="text"/>
          <button onclick="window.app.handleCommanderQuery()" class="w-9 h-9 rounded-xl bg-[#2E8B8B] hover:bg-[#1F6666] text-white flex items-center justify-center shrink-0 shadow-sm">
            <span class="material-symbols-outlined text-[18px]">send</span>
          </button>
        </div>
        <div id="commander-query-response" class="hidden mt-2 p-3 rounded-xl bg-white text-xs text-stone-700 border border-slate-100 leading-relaxed shadow-sm"></div>
      </div>

      <!-- Trust Notice -->
      <div class="flex items-center justify-center gap-2 py-2 px-3 text-center text-stone-500">
        <span class="material-symbols-outlined text-[16px]">lock</span>
        <p class="text-xs">Individual-level health and check-in data is strictly hidden by server-side schema boundaries.</p>
      </div>
    </div>
  `;
}

function bindCommanderUnitEvents() {}

// -------------------------------------------------------------
// SCREEN 4: Commander Personnel Data Entry
// -------------------------------------------------------------
function getCommanderDataEntryHTML() {
  const currentPerson = getCurrentPersonnel();

  return `
    <div class="flex flex-col w-full gap-4 pb-6 bg-[#F4F1EA] -mx-4 px-4 pt-1 rounded-2xl fade-in">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-bold text-stone-900 leading-tight">Duty & Shift Rotation Entry</h2>
          <span class="text-xs text-stone-500">Unit Bravo · 184 Active Personnel</span>
        </div>
        <span class="material-symbols-outlined text-stone-400">tune</span>
      </div>

      <!-- Quick Search Bar -->
      <div class="relative flex items-center w-full">
        <span class="material-symbols-outlined absolute left-3 text-stone-400 text-[18px]">search</span>
        <input class="w-full h-11 pl-9 pr-8 rounded-[14px] bg-white text-stone-900 text-xs placeholder:text-stone-400 shadow-sm focus:outline-none" placeholder="Search name, rank, or service ID..." type="text" value="${currentPerson.name.split(' ')[1] || ''}" oninput="window.app.searchPersonnel(this.value)"/>
      </div>

      <!-- Roster Manifest (No Wellness Tiers Visible) -->
      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between text-[11px] text-stone-500 uppercase tracking-wider font-semibold">
          <span>Roster Manifest (No Wellness Tiers Visible)</span>
          <span>Role-Gated</span>
        </div>

        ${store.personnelList.map(p => `
          <div onclick="window.app.selectPersonnel('${p.id}')" class="flex items-center justify-between p-3 rounded-[16px] ${p.id === currentPerson.id ? 'bg-[#E4F3F3] border border-[#2E8B8B]' : 'bg-white'} shadow-sm cursor-pointer hover:bg-slate-50 transition-all">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-[12px] ${p.id === currentPerson.id ? 'bg-[#2E8B8B] text-white' : 'bg-slate-100 text-stone-600'} flex items-center justify-center font-bold text-xs">
                ${p.shortName}
              </div>
              <div class="flex flex-col">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-bold text-stone-900">${p.name}</span>
                  ${p.id === currentPerson.id ? `<span class="text-[9px] px-1.5 py-0.5 rounded-full bg-[#2E8B8B] text-white font-semibold">EDITING</span>` : ''}
                </div>
                <span class="text-[11px] text-stone-400 font-mono">${p.id} · ${p.platoon}</span>
              </div>
            </div>
            <div class="flex flex-col items-end text-[11px] text-stone-500">
              <span class="font-medium text-[#2E8B8B]">${p.shift_type}</span>
              <span class="text-stone-400">${p.consecutive_duty_days}d straight</span>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Duty Entry Form for Active Selection -->
      <div class="bg-white rounded-[24px] p-5 shadow-sm flex flex-col gap-4 mt-2">
        <div class="flex items-start justify-between border-b pb-3 border-slate-100">
          <div>
            <span class="text-[10px] font-bold uppercase tracking-wider text-[#2E8B8B]">Duty Roster Adjustment</span>
            <h3 class="text-base font-bold text-stone-900">${currentPerson.name}</h3>
            <span class="text-xs text-stone-400 font-mono">${currentPerson.id} · ${currentPerson.platoon}</span>
          </div>
        </div>

        <!-- Shift Type Selector -->
        <div class="flex flex-col gap-2">
          <label class="text-xs font-semibold text-stone-700">Assigned Shift Type</label>
          <div class="grid grid-cols-2 gap-2">
            ${['Night Watch', 'QRF Ready', 'Base Ops', 'Patrol / Field'].map(sh => `
              <button onclick="window.app.setDutyField('shift_type', '${sh}')" class="h-10 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${currentPerson.shift_type === sh ? 'bg-[#2E8B8B] text-white shadow-sm' : 'bg-slate-50 text-stone-600 hover:bg-slate-100'}">
                <span>${sh}</span>
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Steppers -->
        <div class="grid grid-cols-2 gap-3 pt-1">
          <div class="p-3 bg-slate-50 rounded-xl flex flex-col gap-1">
            <span class="text-[11px] text-stone-500">Consecutive Shifts</span>
            <div class="flex items-center justify-between mt-1">
              <button onclick="window.app.adjustDutyStepper('consecutive_duty_days', -1)" class="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-stone-700 font-bold">-</button>
              <span class="text-lg font-bold text-stone-900">${currentPerson.consecutive_duty_days}</span>
              <button onclick="window.app.adjustDutyStepper('consecutive_duty_days', 1)" class="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-stone-700 font-bold">+</button>
            </div>
          </div>

          <div class="p-3 bg-slate-50 rounded-xl flex flex-col gap-1">
            <span class="text-[11px] text-stone-500">Shift Length</span>
            <div class="flex items-center justify-between mt-1">
              <button onclick="window.app.adjustDutyStepper('daily_duty_hours', -1)" class="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-stone-700 font-bold">-</button>
              <span class="text-lg font-bold text-stone-900">${currentPerson.daily_duty_hours}h</span>
              <button onclick="window.app.adjustDutyStepper('daily_duty_hours', 1)" class="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-stone-700 font-bold">+</button>
            </div>
          </div>
        </div>

        <button onclick="window.app.saveDutyEntry()" class="w-full h-11 bg-[#2E8B8B] hover:bg-[#1F6666] text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all mt-2">
          <span class="material-symbols-outlined text-[18px]">save</span>
          <span>Save Operational Duty Record</span>
        </button>
      </div>
    </div>
  `;
}

function bindCommanderEntryEvents() {}

// -------------------------------------------------------------
// SCREEN 5: Wellness Officer Overview & Triage (Full Detail Access)
// -------------------------------------------------------------
function getOfficerOverviewHTML() {
  const activeAlerts = store.crisisAlerts;

  return `
    <div class="flex flex-col w-full gap-4 pb-6 fade-in">
      <!-- Crisis Alert Top Banner (Crimson #B83232) -->
      ${activeAlerts.length > 0 ? `
        <div class="w-full rounded-2xl bg-[#B83232] text-white p-4 shadow-lg flex items-start justify-between crisis-top-banner">
          <div class="flex items-start gap-3">
            <span class="material-symbols-outlined text-[24px]">crisis_alert</span>
            <div>
              <div class="font-bold text-sm tracking-wide">ACTIVE CRISIS ESCALATION DETECTED</div>
              <div class="text-xs text-red-100 mt-0.5">
                ${activeAlerts[0].personnel_name} (${activeAlerts[0].personnel_id}) reported acute distress at ${activeAlerts[0].timestamp}.
              </div>
            </div>
          </div>
          <button onclick="window.app.resolveCrisis('${activeAlerts[0].id}')" class="px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-semibold">
            Acknowledge
          </button>
        </div>
      ` : ''}

      <!-- Triage Header -->
      <div class="flex items-center justify-between">
        <div>
          <span class="text-[11px] uppercase tracking-wider text-teal-700 font-semibold">Clinical Oversight</span>
          <h1 class="text-xl font-bold text-stone-900">Wellness Triage Queue</h1>
        </div>
        <button onclick="window.app.setScreen('wo-roster')" class="text-xs font-semibold text-[#2E8B8B] flex items-center gap-1">
          <span>View All (184)</span>
          <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
        </button>
      </div>

      <!-- Priority Action Queue -->
      <div class="flex flex-col gap-3">
        ${store.personnelList.map(p => {
          const r = p.riskResult || riskEngine.evaluate(p);
          let badgeClass = 'bg-[#E7F6ED] text-[#3FAE68]';
          if (r.tier === 'MODERATE') badgeClass = 'bg-[#FCF2DF] text-[#E8A63D]';
          else if (r.tier === 'ELEVATED') badgeClass = 'bg-[#FDEBDF] text-[#EF7A34]';
          else if (r.tier === 'PRIORITY') badgeClass = 'bg-[#FAE4E4] text-[#D64545]';

          return `
            <div onclick="window.app.selectOfficerPersonnel('${p.id}')" class="bg-white rounded-[20px] p-4 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col gap-3 border border-slate-100">
              <div class="flex items-start justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-[14px] bg-slate-100 text-stone-700 font-bold flex items-center justify-center text-xs">
                    ${p.shortName}
                  </div>
                  <div>
                    <h3 class="text-sm font-bold text-stone-900">${p.name}</h3>
                    <span class="text-[11px] text-stone-400 font-mono">${p.id} · ${p.platoon}</span>
                  </div>
                </div>
                <div class="flex flex-col items-end">
                  <span class="px-2.5 py-1 rounded-full text-xs font-bold ${badgeClass}">
                    ${r.tier} · ${r.score}
                  </span>
                  ${r.signal_alignment === 'CONFLICTING' ? `
                    <span class="mt-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">CONFLICTING SIGNAL</span>
                  ` : ''}
                </div>
              </div>

              <div class="p-2.5 bg-slate-50 rounded-xl text-xs text-stone-600 leading-snug">
                <strong>Primary Factor:</strong> ${r.ranked_factors[0]?.factor_name || 'Operational Shift Rotation'} (${r.ranked_factors[0]?.percentage || 35}% weight)
              </div>

              <div class="flex items-center justify-between text-[11px] text-stone-400 pt-1 border-t border-slate-100">
                <span>Duty: ${p.consecutive_duty_days}d consecutive (${p.shift_type})</span>
                <span class="text-[#2E8B8B] font-semibold flex items-center gap-1">
                  <span>Open File</span>
                  <span class="material-symbols-outlined text-[14px]">chevron_right</span>
                </span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function bindOfficerOverviewEvents() {}

// -------------------------------------------------------------
// SCREEN 6: Wellness Officer Unit Roster
// -------------------------------------------------------------
function getOfficerRosterHTML() {
  return `
    <div class="flex flex-col w-full gap-4 pb-6 fade-in">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-xl font-bold text-stone-900">Unit Bravo Clinical Roster</h2>
          <p class="text-xs text-stone-500">Unrestricted officer medical in-confidence roster</p>
        </div>
        <span class="px-2 py-1 rounded-full bg-red-100 text-red-700 text-[10px] font-bold tracking-wider">SEC-4B</span>
      </div>

      <div class="flex flex-col gap-2">
        ${store.personnelList.map(p => {
          const r = p.riskResult || riskEngine.evaluate(p);
          return `
            <div onclick="window.app.selectOfficerPersonnel('${p.id}')" class="p-3 bg-white rounded-xl shadow-sm hover:bg-slate-50 cursor-pointer flex items-center justify-between border border-slate-100 transition-colors">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-lg bg-teal-50 text-teal-800 flex items-center justify-center font-bold text-xs">
                  ${p.shortName}
                </div>
                <div class="flex flex-col">
                  <span class="text-xs font-bold text-stone-900">${p.name}</span>
                  <span class="text-[10px] text-stone-400 font-mono">${p.id} · ${p.platoon}</span>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded-full text-xs font-bold ${r.tier === 'STABLE' ? 'bg-[#E7F6ED] text-[#3FAE68]' : (r.tier === 'MODERATE' ? 'bg-[#FCF2DF] text-[#E8A63D]' : 'bg-[#FAE4E4] text-[#D64545]')}">
                  ${r.score}/100
                </span>
                <span class="material-symbols-outlined text-stone-300 text-[18px]">chevron_right</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function bindOfficerRosterEvents() {}

// -------------------------------------------------------------
// SCREEN 7: Wellness Officer Individual Detail (Clinical View)
// -------------------------------------------------------------
function getOfficerDetailHTML(person, risk, explanation) {
  const notes = store.clinicalNotes;

  return `
    <div class="flex flex-col w-full gap-4 pb-8 fade-in bg-[#FAFBFB] -mx-4 px-4 pt-1 rounded-2xl">
      <!-- Sub-header Navigation & Clearance Status -->
      <section class="w-full bg-white rounded-xl p-3 shadow-sm flex items-center justify-between border border-slate-100">
        <div class="flex items-center gap-2">
          <button onclick="window.app.setScreen('wo-overview')" class="flex items-center gap-1 text-[#2E8B8B] text-xs font-semibold">
            <span class="material-symbols-outlined text-[18px]">arrow_back</span>
            <span>Triage</span>
          </button>
          <span class="text-stone-300">/</span>
          <span class="text-xs text-stone-500 font-medium">${person.name}</span>
        </div>
        <span class="px-2.5 py-0.5 rounded-full bg-[#FAE4E4] text-[#D64545] text-[10px] font-bold tracking-wider">SEC-4B RESTRICTED</span>
      </section>

      <!-- Patient Header -->
      <section class="w-full bg-white rounded-xl p-4 shadow-sm flex flex-col gap-3 border border-slate-100">
        <div class="flex items-start justify-between">
          <div>
            <h2 class="text-xl font-bold text-stone-900 tracking-tight">${person.name}</h2>
            <div class="flex items-center gap-2 text-xs text-stone-400 font-mono mt-0.5">
              <span>${person.id}</span>
              <span>•</span>
              <span>${person.unit}</span>
            </div>
          </div>
          <div class="flex flex-col items-end">
            <div class="inline-flex items-center gap-1.5 bg-[#FAE4E4] px-3 py-1 rounded-full">
              <span class="w-2 h-2 rounded-full bg-[#D64545] animate-pulse"></span>
              <span class="text-sm font-bold text-[#D64545]">${risk.tier} · ${risk.score}/100</span>
            </div>
            <span class="text-[10px] text-[#D64545] font-semibold mt-1">+14 pts vs. Bravo avg</span>
          </div>
        </div>

        <div class="bg-slate-50 rounded-lg p-3 flex flex-col gap-1.5 border border-slate-100">
          <div class="flex items-center justify-between">
            <span class="px-2 py-0.5 rounded-full bg-[#E4F3F3] text-[#1F6666] text-[10px] font-bold">
              ${risk.signal_alignment === 'CONFLICTING' ? 'CONFLICTING SIGNAL (Human Review)' : 'Signal Agreement (94%)'}
            </span>
            <span class="text-[11px] text-stone-400">Autonomic + Self-Report</span>
          </div>
          <p class="text-xs text-stone-600 leading-relaxed">
            ${explanation.summary}
          </p>
        </div>
      </section>

      <!-- Pillar Breakdown -->
      <section class="w-full bg-white rounded-xl p-4 shadow-sm flex flex-col gap-3 border border-slate-100">
        <h3 class="text-xs uppercase text-stone-400 tracking-wider font-bold">Pillar Score Breakdown</h3>
        <div class="flex flex-col gap-3">
          <div class="flex flex-col gap-1">
            <div class="flex justify-between text-xs">
              <span class="font-medium text-stone-800">Duty Burden / Workload</span>
              <span class="font-bold text-[#EF7A34]">${risk.sub_signals.duty_burden}/100</span>
            </div>
            <div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div class="bg-[#EF7A34] h-full rounded-full" style="width: ${risk.sub_signals.duty_burden}%"></div>
            </div>
          </div>

          <div class="flex flex-col gap-1">
            <div class="flex justify-between text-xs">
              <span class="font-medium text-stone-800">Sleep & Recovery Deficit</span>
              <span class="font-bold text-[#D64545]">${risk.sub_signals.recovery_deficit}/100</span>
            </div>
            <div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div class="bg-[#D64545] h-full rounded-full" style="width: ${risk.sub_signals.recovery_deficit}%"></div>
            </div>
          </div>

          <div class="flex flex-col gap-1">
            <div class="flex justify-between text-xs">
              <span class="font-medium text-stone-800">Subjective Strain</span>
              <span class="font-bold text-[#E8A63D]">${risk.sub_signals.subjective_strain}/100</span>
            </div>
            <div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div class="bg-[#E8A63D] h-full rounded-full" style="width: ${risk.sub_signals.subjective_strain}%"></div>
            </div>
          </div>
        </div>
      </section>

      <!-- 10-Week Longitudinal Trend Chart with Tier Bands -->
      <section class="w-full bg-white rounded-xl p-4 shadow-sm flex flex-col gap-3 border border-slate-100">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-xs uppercase text-stone-400 tracking-wider font-bold">10-Week Longitudinal Trajectory</h3>
            <span class="text-xs text-stone-800 font-medium">Trajectory: +36 pts over 10 wks</span>
          </div>
          <span class="px-2 py-0.5 rounded-lg bg-slate-100 text-xs font-semibold text-[#EF7A34]">Climbing</span>
        </div>

        <div class="w-full h-44 relative flex pt-1">
          <!-- Y Labels -->
          <div class="w-7 flex flex-col justify-between items-end pr-2 text-[10px] text-stone-400 font-mono">
            <span>100</span><span>75</span><span>55</span><span>30</span><span>0</span>
          </div>
          <!-- Canvas Plot -->
          <div class="flex-1 relative h-full rounded-lg overflow-hidden bg-slate-50 border border-slate-200">
            <!-- Tier Bands Background -->
            <div class="absolute inset-0 flex flex-col pointer-events-none">
              <div class="h-[25%] w-full bg-[#FAE4E4]/40" title="Priority (76-100)"></div>
              <div class="h-[20%] w-full bg-[#FDEBDF]/40" title="Elevated (56-75)"></div>
              <div class="h-[25%] w-full bg-[#FCF2DF]/40" title="Moderate (31-55)"></div>
              <div class="h-[30%] w-full bg-[#E7F6ED]/50" title="Stable (0-30)"></div>
            </div>
            <!-- SVG Line -->
            <svg class="absolute inset-0 w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 300 176">
              <polygon fill="url(#detailGrad)" opacity="0.35" points="15,120 44,116 73,121 103,102 132,92 162,90 191,76 220,69 250,63 280,${Math.round(176 - risk.score * 1.76)} 280,176 15,176"></polygon>
              <defs>
                <linearGradient id="detailGrad" x1="0%" x2="0%" y1="0%" y2="100%">
                  <stop offset="0%" stop-color="#D64545"></stop>
                  <stop offset="100%" stop-color="#E7F6ED" stop-opacity="0"></stop>
                </linearGradient>
              </defs>
              <path d="M 15 120 L 44 116 L 73 121 L 103 102 L 132 92 L 162 90 L 191 76 L 220 69 L 250 63 L 280 ${Math.round(176 - risk.score * 1.76)}" fill="none" stroke="#2E8B8B" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"></path>
              <circle cx="280" cy="${Math.round(176 - risk.score * 1.76)}" fill="#D64545" r="4.5" stroke="#FFFFFF" stroke-width="2"></circle>
            </svg>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-between pt-2 text-[10px] text-stone-500">
          <span class="flex items-center gap-1"><span class="w-2 h-2 rounded bg-[#3FAE68]"></span>Stable 0-30</span>
          <span class="flex items-center gap-1"><span class="w-2 h-2 rounded bg-[#E8A63D]"></span>Mod 31-55</span>
          <span class="flex items-center gap-1"><span class="w-2 h-2 rounded bg-[#EF7A34]"></span>Elev 56-75</span>
          <span class="flex items-center gap-1"><span class="w-2 h-2 rounded bg-[#D64545]"></span>Priority 76+</span>
        </div>
      </section>

      <!-- Ranked Contributing Factors -->
      <section class="w-full bg-white rounded-xl p-4 shadow-sm flex flex-col gap-3 border border-slate-100">
        <h3 class="text-xs uppercase text-stone-400 tracking-wider font-bold">Ranked Contributing Stressors</h3>
        <div class="flex flex-col gap-2">
          ${risk.ranked_factors.map(f => `
            <div class="p-3 bg-slate-50 rounded-lg flex items-center justify-between border border-slate-100">
              <div class="flex flex-col">
                <span class="text-xs font-semibold text-stone-900">${f.factor_name}</span>
                <span class="text-[11px] text-stone-400">${f.detail}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold text-stone-700">${f.percentage}%</span>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${f.status === 'Active' ? 'bg-[#FAE4E4] text-[#D64545]' : 'bg-slate-200 text-stone-600'}">${f.status}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </section>

      <!-- Clinical Observation Notes Feed & Form -->
      <section class="w-full bg-white rounded-xl p-4 shadow-sm flex flex-col gap-3 border border-slate-100">
        <h3 class="text-xs uppercase text-stone-400 tracking-wider font-bold">Clinical Observation Log</h3>
        <div id="clinical-notes-container" class="flex flex-col gap-2">
          ${notes.map(n => `
            <div class="p-3 bg-slate-50 rounded-lg flex flex-col gap-1 border border-slate-100">
              <div class="flex items-center justify-between text-xs">
                <span class="font-semibold text-stone-900">${n.author}</span>
                <span class="text-stone-400 font-mono">${n.timeStr}</span>
              </div>
              <p class="text-xs text-stone-700 leading-relaxed">${n.text}</p>
            </div>
          `).join('')}
        </div>

        <div class="flex flex-col gap-2 pt-2 border-t border-slate-100">
          <textarea id="officer-note-input" class="w-full p-2.5 bg-slate-50 rounded-lg text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:bg-white border border-slate-200 resize-none" placeholder="Add clinical observation note..." rows="2"></textarea>
          <div class="flex items-center justify-between">
            <span class="text-[10px] text-stone-400 font-mono">Protocol Sec 4B Encryption</span>
            <button onclick="window.app.addClinicalNote()" class="h-8 px-3 rounded-lg bg-[#2E8B8B] hover:bg-[#1F6666] text-white text-xs font-semibold flex items-center gap-1">
              <span>Log Note</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  `;
}

function bindOfficerDetailEvents() {}

// -------------------------------------------------------------
// SCREEN 8: User Profile
// -------------------------------------------------------------
function getProfileHTML(person) {
  return `
    <div class="flex flex-col w-full gap-4 pb-6 fade-in">
      <div class="w-full bg-white rounded-[20px] p-5 shadow-sm flex flex-col items-center gap-3">
        <div class="w-16 h-16 rounded-full bg-teal-800 text-white flex items-center justify-center font-bold text-xl shadow-md">
          ${person.shortName}
        </div>
        <div class="flex flex-col items-center">
          <h2 class="text-lg font-bold text-stone-900">${person.name}</h2>
          <span class="text-xs text-stone-400 font-mono">${person.id} · ${person.unit}</span>
        </div>
        <span class="px-3 py-1 rounded-full bg-[#E4F3F3] text-[#2E8B8B] text-xs font-bold uppercase tracking-wider">
          ${store.activeRole.toUpperCase()} ROLE ACTIVE
        </span>
      </div>

      <div class="bg-white rounded-[20px] p-5 shadow-sm flex flex-col gap-3">
        <h3 class="text-xs uppercase text-stone-400 font-bold tracking-wider">Security & Compliance Safeguards</h3>
        <div class="flex items-center justify-between py-2 border-b border-slate-100 text-xs text-stone-700">
          <span>Server-Side RBAC Enforcement</span>
          <span class="font-bold text-[#3FAE68]">ACTIVE</span>
        </div>
        <div class="flex items-center justify-between py-2 border-b border-slate-100 text-xs text-stone-700">
          <span>Commander Individual Masking</span>
          <span class="font-bold text-[#3FAE68]">STRICT ENFORCED</span>
        </div>
        <div class="flex items-center justify-between py-2 text-xs text-stone-700">
          <span>Health Connect Consent Mode</span>
          <span class="font-bold text-[#2E8B8B]">LOCAL ONLY</span>
        </div>
      </div>
    </div>
  `;
}

// -------------------------------------------------------------
// Global Event Handlers
// -------------------------------------------------------------
export function selectCheckInVal(key, val) {
  const current = getCurrentPersonnel();
  if (!current.todayCheckIn) current.todayCheckIn = {};
  current.todayCheckIn[key] = val;

  const labelEl = document.getElementById(`${key === 'sleep_quality' ? 'sleep' : key}-label`);
  if (labelEl) {
    if (key === 'mood') {
      labelEl.textContent = ['Tough', 'Heavy', 'Neutral', 'Good', 'Great'][val - 1];
    } else if (key === 'sleep_quality') {
      labelEl.textContent = ['Restless', 'Poor', 'Fair', 'Restful', 'Deep'][val - 1];
    } else if (key === 'workload') {
      labelEl.textContent = ['Light', 'Manageable', 'Moderate', 'Heavy', 'Exhausting'][val - 1];
    }
  }

  // Re-highlight buttons in DOM
  const container = document.querySelector(`[data-question="${key === 'sleep_quality' ? 'sleep' : key}"]`);
  if (container) {
    const btns = container.querySelectorAll('button');
    btns.forEach((b, idx) => {
      if (idx + 1 === val) {
        b.className = 'w-11 h-11 rounded-full flex items-center justify-center transition-all bg-[#2E8B8B] text-white shadow-md scale-105';
        b.innerHTML = '<span class="text-xs font-bold">✓</span>';
      } else {
        b.className = 'w-11 h-11 rounded-full flex items-center justify-center transition-all bg-slate-50 text-stone-600 shadow-sm hover:scale-105';
        b.innerHTML = `<span class="text-xs font-bold">${idx + 1}</span>`;
      }
    });
  }
}

export function submitCheckIn() {
  const current = getCurrentPersonnel();
  const noteInput = document.getElementById('personal-note-input');
  if (noteInput && current.todayCheckIn) {
    current.todayCheckIn.note = noteInput.value.trim();
  }
  if (current.todayCheckIn) {
    current.todayCheckIn.completed = true;
  }

  recalculateAllScores();
  render();

  // Scroll completion card into view gently
  const card = document.getElementById('checkin-interactive-card');
  if (card) {
    card.scrollIntoView({ behavior: 'smooth' });
  }
}

export function toggleBreathingSession() {
  const panel = document.getElementById('breathing-panel');
  const triggerBtn = document.getElementById('breathing-trigger-btn');
  const orb = document.getElementById('breathing-orb');
  const phaseText = document.getElementById('breathing-phase-text');

  if (!panel) return;

  if (store.breathingInterval) {
    clearInterval(store.breathingInterval);
    store.breathingInterval = null;
    panel.classList.add('hidden');
    triggerBtn.classList.remove('hidden');
    return;
  }

  panel.classList.remove('hidden');
  panel.classList.add('flex');
  triggerBtn.classList.add('hidden');

  const steps = [
    { text: 'Inhale gently...', cls: 'breathing-pulse-inhale' },
    { text: 'Hold calmly...', cls: 'breathing-pulse-hold' },
    { text: 'Exhale softly...', cls: 'breathing-pulse-exhale' },
    { text: 'Rest and steady...', cls: 'breathing-pulse-rest' }
  ];

  let stepIdx = 0;
  const run = () => {
    const s = steps[stepIdx];
    if (phaseText) phaseText.textContent = s.text;
    if (orb) {
      orb.className = `w-14 h-14 rounded-full flex items-center justify-center ${s.cls}`;
    }
    stepIdx = (stepIdx + 1) % steps.length;
  };

  run();
  store.breathingInterval = setInterval(run, 4000);
}

export function selectPersonnel(id) {
  store.selectedPersonnelId = id;
  render();
}

export function selectOfficerPersonnel(id) {
  store.selectedPersonnelId = id;
  store.activeScreen = 'wo-detail';
  render();
}

export function setDutyField(field, val) {
  const current = getCurrentPersonnel();
  current[field] = val;
  render();
}

export function adjustDutyStepper(field, delta) {
  const current = getCurrentPersonnel();
  current[field] = Math.max(1, (current[field] || 1) + delta);
  render();
}

export function saveDutyEntry() {
  recalculateAllScores();
  render();
  alert('Operational duty log saved. Unit aggregates updated successfully.');
}

export function searchPersonnel(query) {
  const q = (query || '').toLowerCase();
  const match = store.personnelList.find(p => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
  if (match) {
    store.selectedPersonnelId = match.id;
  }
}

export function handleCommanderQuery() {
  const input = document.getElementById('commander-query-input');
  const respBox = document.getElementById('commander-query-response');
  if (!input || !respBox) return;

  const text = input.value.trim();
  if (!text) return;

  respBox.classList.remove('hidden');
  respBox.innerHTML = `
    <div class="flex items-center gap-2 text-[#2E8B8B] font-bold mb-1">
      <span class="material-symbols-outlined text-[16px]">insights</span>
      <span>Aggregate Synthesis (Scoping: Unit Bravo)</span>
    </div>
    <p>Operational indicators reflect a <strong>12% rise in sleep disruption</strong> following recent night-shift duty allocations. Rest intervals between consecutive night watches remain the primary lever to return unit welfare into the stable tier (currently at 72% resilience).</p>
  `;
  input.value = '';
}

export function addClinicalNote() {
  const input = document.getElementById('officer-note-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  const now = new Date();
  const timeStr = 'Today · ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

  store.clinicalNotes.unshift({
    id: 'cn-' + Date.now(),
    author: 'Duty Welfare Officer (You)',
    medId: '#9940',
    timeStr,
    text
  });

  input.value = '';
  render();
}

export function resolveCrisis(alertId) {
  store.crisisAlerts = store.crisisAlerts.filter(a => a.id !== alertId);
  render();
}

// Attach to window for DOM onclick hooks
if (typeof window !== 'undefined') {
  window.app = {
    store,
    setRole,
    setScreen,
    toggleViewportMode,
    selectCheckInVal,
    submitCheckIn,
    toggleBreathingSession,
    triggerEmergencyEscalation,
    openCrisisModal,
    loadScenario,
    selectPersonnel,
    selectOfficerPersonnel,
    setDutyField,
    adjustDutyStepper,
    saveDutyEntry,
    searchPersonnel,
    handleCommanderQuery,
    addClinicalNote,
    resolveCrisis
  };
}

// Initial calculation & boot
recalculateAllScores();
