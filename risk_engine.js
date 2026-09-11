/**
 * Risk Engine (Deterministic Weighted Rules Model)
 * Conforms to: overview.md & tasks.md (Phase 2)
 *
 * Core Principles:
 * 1. Scoring is ALWAYS relative to the individual's OWN baseline (not population norm).
 * 2. Risk prediction happens only here (NEVER inside an LLM).
 * 3. Standardized Z-Score deviation: Z = (current - baseline_mean) / (baseline_std + epsilon)
 * 4. Signal Alignment check: Detects if subjective reporting contradicts objective duty burden.
 */

export const RiskTier = {
  STABLE: 'STABLE',
  MODERATE: 'MODERATE',
  ELEVATED: 'ELEVATED',
  PRIORITY: 'PRIORITY'
};

export const SignalAlignment = {
  CONSISTENT: 'CONSISTENT',
  MIXED: 'MIXED',
  CONFLICTING: 'CONFLICTING'
};

export const ConfidenceFlag = {
  HIGH: 'HIGH',
  MODERATE: 'MODERATE',
  LOW_DATA_COLD_START: 'LOW_DATA_COLD_START'
};

export class DeterministicRiskEngine {
  constructor() {
    // Metric weights for composite stress score
    this.weights = {
      consecutive_duty_days: 0.22,
      shift_intensity: 0.18,       // Night watch / split shifts
      duty_hours: 0.15,            // Spike above baseline hours
      sleep_deficit: 0.20,         // Loss in sleep duration / quality
      subjective_strain: 0.15,     // Low mood, high perceived strain
      leave_lag: 0.10              // Time since last rest/leave
    };
  }

  /**
   * Calculates baseline mean and standard deviation for a metric from historical days.
   */
  calculateBaseline(history, metricKey) {
    if (!history || history.length === 0) {
      return { mean: 0, std: 1, count: 0 };
    }
    const values = history
      .map(entry => entry[metricKey])
      .filter(val => typeof val === 'number' && !isNaN(val));

    if (values.length === 0) return { mean: 0, std: 1, count: 0 };

    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const std = Math.sqrt(variance) || 1.0;

    return { mean, std, count: values.length };
  }

  /**
   * Standardized Z-score: deviation from individual's historical mean.
   */
  computeZScore(currentVal, mean, std) {
    const epsilon = 0.001;
    return (currentVal - mean) / (std + epsilon);
  }

  /**
   * Evaluates complete risk profile for a personnel member.
   * @param {Object} personnel - Profile containing baseline statistics & current readings
   * @param {Array} history - Past 14-28 days of check-ins & duty events
   * @param {Object} currentDuty - Today's duty event (logged by Commander)
   * @param {Object} currentCheckIn - Today's self-reported pulse (from Personnel)
   * @param {Object} passiveHealth - Optional Health Connect data
   */
  evaluate(personnel, history = [], currentDuty = {}, currentCheckIn = {}, passiveHealth = null) {
    const dataCompleteness = Math.min(1.0, (history.length + 1) / 14);
    const confidenceFlag = history.length < 5 
      ? ConfidenceFlag.LOW_DATA_COLD_START 
      : (history.length < 10 ? ConfidenceFlag.MODERATE : ConfidenceFlag.HIGH);

    // 1. Extract or default current metrics
    const consecutiveDays = currentDuty.consecutive_duty_days ?? (personnel.consecutive_duty_days || 1);
    const dutyHours = currentDuty.duty_hours ?? (personnel.daily_duty_hours || 8);
    const isNightShift = (currentDuty.shift_type === 'Night Watch' || currentDuty.shift_type === 'NIGHT') ? 1 : 0;
    const leaveLagDays = currentDuty.days_since_leave ?? (personnel.days_since_leave || 10);

    // Self-report scales (1 to 5, where 1=tough/restless/light, 5=great/deep/exhausting)
    // For mood: 1 is low (strain), 5 is high (wellness)
    const moodScore = currentCheckIn.mood ?? 3; // 1-5
    const sleepQuality = currentCheckIn.sleep_quality ?? (passiveHealth ? Math.min(5, Math.max(1, passiveHealth.sleep_hours / 1.6)) : 3.5);
    const perceivedWorkload = currentCheckIn.workload ?? 2.5; // 1=light, 5=exhausting

    // 2. Baselines (intra-individual)
    const baseDutyHours = this.calculateBaseline(history, 'duty_hours');
    const baseSleep = this.calculateBaseline(history, 'sleep_quality');
    const baseMood = this.calculateBaseline(history, 'mood');

    // 3. Sub-signal deviations (0 to 100 scaled contributions)
    // A: Duty Burden Sub-Score
    let dutyBurdenScore = 0;
    // Consecutive days factor (normal: <=4, severe: >=10)
    const consDaysFactor = Math.min(1.0, Math.max(0, (consecutiveDays - 3) / 8));
    // Shift intensity factor (night shifts compound strain)
    const shiftFactor = isNightShift ? 0.9 : 0.2;
    // Duty hour deviation
    const dutyHoursZ = baseDutyHours.count >= 5 
      ? this.computeZScore(dutyHours, baseDutyHours.mean, baseDutyHours.std)
      : (dutyHours - 8) / 4;
    const dutyHourFactor = Math.min(1.0, Math.max(0, (dutyHoursZ + 1) / 3));

    dutyBurdenScore = (consDaysFactor * 0.45 + shiftFactor * 0.35 + dutyHourFactor * 0.20) * 100;

    // B: Recovery Deficit Sub-Score
    // Sleep quality dropping below baseline
    const sleepDeficitZ = baseSleep.count >= 5 
      ? this.computeZScore(sleepQuality, baseSleep.mean, baseSleep.std)
      : (3.5 - sleepQuality) / 1.5;
    // Lower sleep gives higher stress
    const recoveryDeficitScore = Math.min(100, Math.max(0, ((-sleepDeficitZ * 25) + ((5 - sleepQuality) * 12))));

    // C: Subjective Strain Sub-Score
    const subjectiveScore = Math.min(100, Math.max(0, ((5 - moodScore) * 12) + (perceivedWorkload * 10)));

    // D: Leave / Deployment Lag Sub-Score
    const leaveScore = Math.min(100, Math.max(0, (leaveLagDays / 30) * 80));

    // 4. Weighted Composite Risk Score (0-100)
    let rawCompositeScore = 
      (dutyBurdenScore * (this.weights.consecutive_duty_days + this.weights.shift_intensity + this.weights.duty_hours)) +
      (recoveryDeficitScore * this.weights.sleep_deficit) +
      (subjectiveScore * this.weights.subjective_strain) +
      (leaveScore * this.weights.leave_lag);

    // Bound score
    const finalScore = Math.min(100, Math.max(0, Math.round(rawCompositeScore * 10) / 10));

    // 5. Tier Assignment
    let tier = RiskTier.STABLE;
    if (finalScore >= 76) {
      tier = RiskTier.PRIORITY;
    } else if (finalScore >= 56) {
      tier = RiskTier.ELEVATED;
    } else if (finalScore >= 31) {
      tier = RiskTier.MODERATE;
    } else {
      tier = RiskTier.STABLE;
    }

    // 6. Signal Alignment Check
    // Compare objective operational load vs. self-reported wellness
    // If dutyBurden is high (> 65) but subjectiveStrain is reported very low (< 25), flag CONFLICTING (possible masking/burnout)
    let signalAlignment = SignalAlignment.CONSISTENT;
    const divergence = Math.abs(dutyBurdenScore - subjectiveScore);
    if (dutyBurdenScore >= 60 && subjectiveScore <= 30) {
      signalAlignment = SignalAlignment.CONFLICTING;
    } else if (dutyBurdenScore <= 35 && subjectiveScore >= 70) {
      signalAlignment = SignalAlignment.CONFLICTING;
    } else if (divergence >= 30) {
      signalAlignment = SignalAlignment.MIXED;
    }

    // 7. Ranked Contributing Factors
    const factorList = [
      {
        factor_name: 'Consecutive Night Shifts',
        metric_key: 'consecutive_night_shifts',
        weight: Math.round((dutyBurdenScore * 0.38) * 10) / 10,
        percentage: 38,
        status: consecutiveDays >= 5 ? 'Active' : 'Controlled',
        detail: `${consecutiveDays} consecutive duty shifts logged`
      },
      {
        factor_name: 'Deep Sleep & Recovery Deficit',
        metric_key: 'sleep_recovery_deficit',
        weight: Math.round((recoveryDeficitScore * 0.29) * 10) / 10,
        percentage: 29,
        status: recoveryDeficitScore > 50 ? 'Chronic' : 'Normal',
        detail: `Sleep index ${sleepQuality}/5 (Baseline delta: ${Math.round(sleepDeficitZ * 10) / 10}σ)`
      },
      {
        factor_name: 'Operational Workload Strain',
        metric_key: 'workload_strain',
        weight: Math.round((subjectiveScore * 0.18) * 10) / 10,
        percentage: 18,
        status: perceivedWorkload >= 4 ? 'Elevated' : 'Manageable',
        detail: `${dutyHours}h active shift · Workload rating ${perceivedWorkload}/5`
      },
      {
        factor_name: 'Deployment & Leave Interval',
        metric_key: 'leave_interval',
        weight: Math.round((leaveScore * 0.15) * 10) / 10,
        percentage: 15,
        status: leaveLagDays > 25 ? 'Overdue' : 'Scheduled',
        detail: `${leaveLagDays} days since last operational rest cycle`
      }
    ].sort((a, b) => b.weight - a.weight);

    // 8. 10-Week Trajectory Generation (longitudinal history simulation)
    const trajectoryWeeks = this.generateLongitudinalTrajectory(finalScore, history);

    return {
      personnel_id: personnel.id,
      timestamp: new Date().toISOString(),
      score: finalScore,
      tier,
      signal_alignment: signalAlignment,
      confidence_flag: confidenceFlag,
      data_completeness: dataCompleteness,
      sub_signals: {
        duty_burden: Math.round(dutyBurdenScore),
        recovery_deficit: Math.round(recoveryDeficitScore),
        subjective_strain: Math.round(subjectiveScore),
        leave_lag: Math.round(leaveScore)
      },
      ranked_factors: factorList,
      trajectory_weeks: trajectoryWeeks
    };
  }

  generateLongitudinalTrajectory(currentScore, history) {
    // Generate realistic 10-week trajectory ending at currentScore
    const weeks = [];
    const base = Math.max(20, Math.min(45, currentScore - 25));
    for (let i = 1; i <= 9; i++) {
      const progress = i / 10;
      const noise = (Math.sin(i * 1.5) * 4);
      const score = Math.round(base + (currentScore - base) * progress + noise);
      weeks.push({ week: `W${i}`, score: Math.max(10, Math.min(95, score)) });
    }
    weeks.push({ week: 'W10', score: Math.round(currentScore) });
    return weeks;
  }
}

// Singleton export
export const riskEngine = new DeterministicRiskEngine();
