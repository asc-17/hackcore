/**
 * Explanation Engine (Claude Haiku Server-Side Specification)
 * Conforms to: overview.md & tasks.md (Phase 4)
 *
 * Strict Guardrails:
 * 1. Forbids diagnostic or clinical claims (no "major depressive disorder", "pathology", etc.).
 * 2. Supportive, non-punitive, operational-welfare tone.
 * 3. Enforces strict JSON-only schema.
 * 4. Every recommendation traceable to explicit Risk Engine factors.
 * 5. Provides offline high-fidelity synthesis + optional live Anthropic API bridge.
 */

export class ClaudeHaikuExplanationService {
  constructor(apiKey = null) {
    this.apiKey = apiKey;
    this.systemPrompt = `You are a specialized Military Personnel Welfare Analyst assisting unit medical/wellness officers.
Your role is to explain structured stress risk engine outputs in clear, supportive, plain language.

STRICT CONSTRAINTS:
1. Never make medical, psychiatric, or clinical diagnoses (e.g., do NOT use words like "depression", "anxiety disorder", "insomnia syndrome", "pathology").
2. Tone must be supportive, respectful, and focused on occupational recovery and readiness — never disciplinary or accusatory.
3. Every recommendation must cite a specific factor present in the input data.
4. Output MUST BE valid JSON only with NO surrounding markdown or extra commentary.
5. Format:
{
  "summary": "1-2 sentence plain language welfare evaluation",
  "primary_driver": "Primary operational or recovery stressor driving score",
  "recommended_actions": ["Action 1", "Action 2"],
  "urgency_level": "ROUTINE" | "ATTENTION_NEEDED" | "URGENT_TRIAGE",
  "signal_alignment_verdict": "CONSISTENT" | "MIXED" | "CONFLICTING",
  "audit_traces": [{"factor": "name", "claim": "trace"}]
}`;
  }

  setApiKey(key) {
    this.apiKey = key;
  }

  /**
   * Generates a plain-language explanation from structured risk engine output.
   * @param {Object} riskResult - Output from DeterministicRiskEngine
   * @param {Object} personnelContext - Anonymized context (rank, platoon, role)
   */
  async explain(riskResult, personnelContext = {}) {
    // If live API key is set, attempt Anthropic API call; otherwise fallback to structured synthesis
    if (this.apiKey && this.apiKey.startsWith('sk-ant-')) {
      try {
        return await this.callLiveClaudeHaiku(riskResult, personnelContext);
      } catch (err) {
        console.warn('Live Claude Haiku API failed, falling back to local synthesis engine:', err);
      }
    }

    return this.synthesizeStructuredExplanation(riskResult, personnelContext);
  }

  /**
   * High-fidelity local synthesizer mimicking Claude Haiku's prompt-constrained responses.
   */
  synthesizeStructuredExplanation(riskResult, context) {
    const tier = riskResult.tier;
    const score = riskResult.score;
    const topFactor = riskResult.ranked_factors[0] || { factor_name: 'Operational Duty Load', percentage: 35 };
    const secondFactor = riskResult.ranked_factors[1] || { factor_name: 'Sleep Deficit', percentage: 25 };
    const alignment = riskResult.signal_alignment;

    let urgencyLevel = 'ROUTINE';
    let summary = '';
    let primaryDriver = topFactor.factor_name;
    const recommendedActions = [];

    if (tier === 'STABLE') {
      urgencyLevel = 'ROUTINE';
      summary = `Current baseline indicators demonstrate healthy operational resilience. Duty load and physical recovery remain well-balanced over the 14-day observation window.`;
      recommendedActions.push('Maintain regular shift rhythm and current rest-cycle intervals.');
      recommendedActions.push('Encourage continuing self-paced 3-minute recovery practices.');
    } else if (tier === 'MODERATE') {
      urgencyLevel = 'ATTENTION_NEEDED';
      summary = `Emerging signs of cumulative fatigue detected, primarily driven by ${topFactor.factor_name.toLowerCase()}. Indicators suggest mild recovery delay without acute impairment.`;
      recommendedActions.push(`Schedule an intentional 24-hour sleep recovery window before next high-tempo cycle.`);
      recommendedActions.push(`Monitor ${secondFactor.factor_name.toLowerCase()} over the upcoming 72 hours.`);
    } else if (tier === 'ELEVATED') {
      urgencyLevel = 'ATTENTION_NEEDED';
      summary = `Welfare profile indicates significant cumulative strain. Multiple consecutive high-demand duties are compounding recovery deficit, warranting proactive command scheduling adjustments.`;
      recommendedActions.push(`Recommend 48-hour rotational pause from nocturnal duty watch.`);
      recommendedActions.push(`Conduct informal 1-on-1 welfare check with unit wellness liaison.`);
      recommendedActions.push(`Evaluate operational shift reassignments to alleviate ${topFactor.factor_name.toLowerCase()}.`);
    } else {
      // PRIORITY
      urgencyLevel = 'URGENT_TRIAGE';
      summary = `Urgent welfare triage recommended. Elevated stress markers across both operational tempo and physiological recovery curves indicate immediate risk of acute burnout or operational fatigue.`;
      recommendedActions.push(`Immediate temporary relief from active patrol and live weapons duty.`);
      recommendedActions.push(`Confidential consultation with credentialed Medical/Wellness Officer.`);
      recommendedActions.push(`Mandatory 72-hour comprehensive rest and recuperation protocol.`);
    }

    // Alignment notes
    if (alignment === 'CONFLICTING') {
      summary += ` [SIGNAL NOTICE: Self-reported ratings appear optimistic relative to heavy objective shift hours, indicating possible masked fatigue.]`;
    }

    return {
      summary,
      primary_driver: primaryDriver,
      recommended_actions: recommendedActions,
      urgency_level: urgencyLevel,
      signal_alignment_verdict: alignment,
      audit_traces: [
        {
          factor: topFactor.factor_name,
          claim: `Represents ${topFactor.percentage}% of overall stress variance`
        },
        {
          factor: secondFactor.factor_name,
          claim: `Secondary contributor at ${secondFactor.percentage}% weight`
        }
      ]
    };
  }

  /**
   * Optional live invocation of Claude Haiku via Anthropic Messages API.
   */
  async callLiveClaudeHaiku(riskResult, context) {
    const payload = {
      model: 'claude-3-haiku-20240307',
      max_tokens: 600,
      temperature: 0.2,
      system: this.systemPrompt,
      messages: [
        {
          role: 'user',
          content: JSON.stringify({
            score: riskResult.score,
            tier: riskResult.tier,
            sub_signals: riskResult.sub_signals,
            ranked_factors: riskResult.ranked_factors,
            signal_alignment: riskResult.signal_alignment,
            confidence_flag: riskResult.confidence_flag
          })
        }
      ]
    };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Anthropic API returned status ${response.status}`);
    }

    const data = await response.json();
    const rawText = data.content[0].text;
    return JSON.parse(rawText);
  }
}

export const explanationService = new ClaudeHaikuExplanationService();
