import {
  ProvenanceSource,
  DataProvenanceInput,
  ConfidenceLabel,
  TrackedField,
  DataProvenanceResult,
} from "./types";
import { RECENCY_FRESH_DAYS, RECENCY_STALE_DAYS } from "./utils/constants";

const SOURCE_SCORES: Record<ProvenanceSource, number> = {
  user_input: 50,
  market_data: 95,
  appraised: 100,
  estimated: 60,
  calculated: 75,
};

/** 100 at 30 days or fresher, decaying linearly to 0 at 365+ days. */
function recencyScore(ageInDays: number): number {
  if (ageInDays <= RECENCY_FRESH_DAYS) return 100;
  if (ageInDays >= RECENCY_STALE_DAYS) return 0;
  return 100 * (1 - (ageInDays - RECENCY_FRESH_DAYS) / (RECENCY_STALE_DAYS - RECENCY_FRESH_DAYS));
}

/**
 * Threshold bands aren't specified by the E22 spec beyond the four label
 * names — these are a reasonable default (roughly even quartiles biased
 * toward "High" requiring genuine confidence), not a documented industry
 * standard.
 */
function confidenceLabelFor(confidence: number): ConfidenceLabel {
  if (confidence >= 0.8) return "High";
  if (confidence >= 0.5) return "Moderate";
  if (confidence >= 0.25) return "Low";
  return "Uncertain";
}

function ageInDaysFor(lastUpdatedDate: string, now: Date): number {
  const updated = new Date(lastUpdatedDate);
  const diffMs = now.getTime() - updated.getTime();
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
}

interface FieldMeta {
  displayName: string;
  /**
   * The spec only orders three fields by importance (price > rent >
   * expenses); every other field gets expenses' weight (1) as a flat,
   * low-assumption baseline rather than an invented, unstated ranking.
   */
  weight: number;
}

const FIELD_META: Record<keyof DataProvenanceInput, FieldMeta> = {
  purchasePrice: { displayName: "Purchase price", weight: 3 },
  grossAnnualRent: { displayName: "Rent", weight: 2 },
  annualOperatingExpenses: { displayName: "Expenses", weight: 1 },
  annualInterestRate: { displayName: "Interest rate", weight: 1 },
  vacancyRatePercent: { displayName: "Vacancy rate", weight: 1 },
  downPaymentPercent: { displayName: "Down payment", weight: 1 },
  amortizationYears: { displayName: "Amortization years", weight: 1 },
  equityInvested: { displayName: "Equity invested", weight: 1 },
};

/**
 * Takes an optional `now` (defaulting to the real current time) purely so
 * ageInDays/recencyScore are deterministic and testable — "days since
 * lastUpdatedDate" is meaningless without a reference point, and the E22
 * spec doesn't otherwise provide one. Omit it in normal use; pass a fixed
 * Date in tests.
 */
export function calculateDataProvenance(input: DataProvenanceInput, now: Date = new Date()): DataProvenanceResult {
  const fieldsTracked: TrackedField[] = [];
  const recommendedActions: string[] = [];
  const confidenceSums: Partial<Record<ProvenanceSource, { sum: number; count: number }>> = {};

  let weightedScoreSum = 0;
  let weightSum = 0;

  for (const fieldName of Object.keys(FIELD_META) as (keyof DataProvenanceInput)[]) {
    const meta = FIELD_META[fieldName];
    const entry = input[fieldName];

    if (!entry) {
      recommendedActions.push(`${meta.displayName} has not yet been provided.`);
      continue;
    }

    const ageInDays = ageInDaysFor(entry.lastUpdatedDate, now);
    const sourceScoreValue = SOURCE_SCORES[entry.source];
    const confidenceScoreValue = entry.confidence * 100;
    const recencyScoreValue = recencyScore(ageInDays);
    const qualityScore = sourceScoreValue * 0.5 + confidenceScoreValue * 0.3 + recencyScoreValue * 0.2;
    const confidenceLabel = confidenceLabelFor(entry.confidence);

    fieldsTracked.push({
      fieldName,
      value: entry.value,
      source: entry.source,
      confidence: entry.confidence,
      confidenceLabel,
      qualityScore,
      ageInDays,
    });

    weightedScoreSum += qualityScore * meta.weight;
    weightSum += meta.weight;

    const sourceAgg = (confidenceSums[entry.source] ??= { sum: 0, count: 0 });
    sourceAgg.sum += entry.confidence;
    sourceAgg.count += 1;

    if (confidenceLabel === "Low" || confidenceLabel === "Uncertain") {
      recommendedActions.push(
        `${meta.displayName} has ${confidenceLabel.toLowerCase()} confidence (${entry.source}) — consider verifying.`,
      );
    }
    if (ageInDays >= RECENCY_STALE_DAYS) {
      recommendedActions.push(`${meta.displayName} has not been updated in over 1 year — verify current market.`);
    } else if (ageInDays > RECENCY_FRESH_DAYS) {
      recommendedActions.push(`${meta.displayName} is ${ageInDays} days old — verify current market data.`);
    }
  }

  const overallDataQualityScore = weightSum > 0 ? weightedScoreSum / weightSum : 0;

  const confidenceBySource: Partial<Record<ProvenanceSource, number>> = {};
  for (const [source, agg] of Object.entries(confidenceSums) as [ProvenanceSource, { sum: number; count: number }][]) {
    confidenceBySource[source] = agg.sum / agg.count;
  }

  const uncertainFieldDisplayNames = fieldsTracked
    .filter((f) => f.confidenceLabel === "Low" || f.confidenceLabel === "Uncertain")
    .map((f) => FIELD_META[f.fieldName as keyof DataProvenanceInput].displayName);

  const summary =
    fieldsTracked.length === 0
      ? "Data quality: no fields provided yet."
      : `Data quality: ${overallDataQualityScore.toFixed(0)}%. Key uncertainties: ${
          uncertainFieldDisplayNames.length > 0 ? uncertainFieldDisplayNames.join(", ") : "none"
        }.`;

  return { fieldsTracked, overallDataQualityScore, confidenceBySource, recommendedActions, summary };
}
