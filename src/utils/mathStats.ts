import {
  ProteinRow,
  SampleMetadata,
  ExperimentDesignConfig,
  StatResultRow,
  PCAResult,
  PCAPoint,
  NormalizationMethod,
  ImputationMethod
} from '../types/proteomics';
import { studentTTwoSidedP, fSurvival, normalSurvival } from './distributions';
import { sha256Hex } from './sha256';
import { createRng, hashSeed, normalDraw } from './random';

// SHA-256 of large inputs (uploaded files) via WebCrypto
export async function computeSHA256(text: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// SHA-256 over the analysis parameters and dataset checksum, recorded in the provenance manifest
export function computeReproducibilityHash(config: ExperimentDesignConfig, datasetChecksum: string): string {
  return sha256Hex(JSON.stringify({ config, datasetChecksum }));
}

// Formats a p-value for display; untestable proteins carry NaN
export function formatPValue(p: number): string {
  if (!Number.isFinite(p)) return 'n/a';
  return p < 0.001 ? '< 0.001' : p.toFixed(4);
}

// ---------------------------------------------------------------------------
// Descriptive helpers (all ignore NaN / non-finite values)
// ---------------------------------------------------------------------------

const finite = (arr: number[]) => arr.filter(v => Number.isFinite(v));

export function mean(arr: number[]): number {
  const valid = finite(arr);
  if (!valid.length) return NaN;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

// Sample variance (n - 1 denominator)
export function variance(arr: number[]): number {
  const valid = finite(arr);
  if (valid.length < 2) return NaN;
  const m = mean(valid);
  return valid.reduce((sum, v) => sum + (v - m) ** 2, 0) / (valid.length - 1);
}

export function stdDev(arr: number[]): number {
  return Math.sqrt(variance(arr));
}

export function median(arr: number[]): number {
  const valid = finite(arr).sort((a, b) => a - b);
  if (!valid.length) return NaN;
  const mid = Math.floor(valid.length / 2);
  return valid.length % 2 !== 0 ? valid[mid] : (valid[mid - 1] + valid[mid]) / 2;
}

// Linear-interpolated value at fractional position `pos` (0..1) of a sorted array
function interpolateSorted(sorted: number[], pos: number): number {
  if (sorted.length === 1) return sorted[0];
  const idx = pos * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

// Average ranks (1-based) with tie-group sizes, as used by rank tests
export function rankWithTies(values: number[]): { ranks: number[]; tieSizes: number[] } {
  const order = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const ranks = new Array(values.length);
  const tieSizes: number[] = [];
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && order[j + 1].v === order[i].v) j++;
    const avgRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[order[k].i] = avgRank;
    tieSizes.push(j - i + 1);
    i = j + 1;
  }
  return { ranks, tieSizes };
}

// ---------------------------------------------------------------------------
// Hypothesis tests. Each returns NaN p-values when the data cannot support the test.
// Reference implementation for all tests: SciPy (see tests/mathStats.test.ts).
// ---------------------------------------------------------------------------

export interface TestResult {
  statistic: number;
  pValue: number;
}

const UNTESTABLE: TestResult = { statistic: NaN, pValue: NaN };

// Welch's unequal-variance t-test (scipy.stats.ttest_ind, equal_var=False)
export function welchTTest(a: number[], b: number[]): TestResult {
  const x = finite(a);
  const y = finite(b);
  if (x.length < 2 || y.length < 2) return UNTESTABLE;
  const vx = variance(x) / x.length;
  const vy = variance(y) / y.length;
  const se = Math.sqrt(vx + vy);
  if (!(se > 0)) return UNTESTABLE;
  const t = (mean(x) - mean(y)) / se;
  const df = (vx + vy) ** 2 / (vx ** 2 / (x.length - 1) + vy ** 2 / (y.length - 1));
  return { statistic: t, pValue: studentTTwoSidedP(t, df) };
}

// Student's pooled-variance t-test (scipy.stats.ttest_ind, equal_var=True)
export function studentTTest(a: number[], b: number[]): TestResult {
  const x = finite(a);
  const y = finite(b);
  if (x.length < 2 || y.length < 2) return UNTESTABLE;
  const df = x.length + y.length - 2;
  const pooled = ((x.length - 1) * variance(x) + (y.length - 1) * variance(y)) / df;
  const se = Math.sqrt(pooled * (1 / x.length + 1 / y.length));
  if (!(se > 0)) return UNTESTABLE;
  const t = (mean(x) - mean(y)) / se;
  return { statistic: t, pValue: studentTTwoSidedP(t, df) };
}

// Paired t-test on aligned arrays (scipy.stats.ttest_rel); incomplete pairs are dropped
export function pairedTTest(a: number[], b: number[]): TestResult {
  const diffs = pairedDifferences(a, b);
  if (diffs.length < 2) return UNTESTABLE;
  const se = stdDev(diffs) / Math.sqrt(diffs.length);
  if (!(se > 0)) return UNTESTABLE;
  const t = mean(diffs) / se;
  return { statistic: t, pValue: studentTTwoSidedP(t, diffs.length - 1) };
}

function pairedDifferences(a: number[], b: number[]): number[] {
  const diffs: number[] = [];
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (Number.isFinite(a[i]) && Number.isFinite(b[i])) diffs.push(a[i] - b[i]);
  }
  return diffs;
}

// Cache of exact null distributions, keyed by sample sizes
const mannWhitneyCdfCache = new Map<string, Float64Array>();
const signedRankCdfCache = new Map<number, Float64Array>();

// CDF of the Mann-Whitney U statistic under H0 (no ties), indexed by U
function mannWhitneyCdf(n1: number, n2: number): Float64Array {
  const k = Math.min(n1, n2);
  const n = n1 + n2;
  const key = `${k},${n}`;
  const cached = mannWhitneyCdfCache.get(key);
  if (cached) return cached;

  // counts[j][s] = number of j-subsets of {1..i} with rank sum s
  const maxSum = (k * (2 * n - k + 1)) / 2;
  const counts = Array.from({ length: k + 1 }, () => new Float64Array(maxSum + 1));
  counts[0][0] = 1;
  for (let i = 1; i <= n; i++) {
    for (let j = Math.min(i, k); j >= 1; j--) {
      const prev = counts[j - 1];
      const cur = counts[j];
      for (let s = maxSum; s >= i; s--) cur[s] += prev[s - i];
    }
  }

  const minSum = (k * (k + 1)) / 2;
  const maxU = k * (n - k);
  const cdf = new Float64Array(maxU + 1);
  let total = 0;
  for (let u = 0; u <= maxU; u++) total += counts[k][u + minSum];
  let running = 0;
  for (let u = 0; u <= maxU; u++) {
    running += counts[k][u + minSum];
    cdf[u] = running / total;
  }
  mannWhitneyCdfCache.set(key, cdf);
  return cdf;
}

// Mann-Whitney U test, two-sided (scipy.stats.mannwhitneyu, method='auto'):
// exact when a sample has <= 8 observations and there are no ties,
// otherwise normal approximation with tie and continuity correction.
export function mannWhitneyU(a: number[], b: number[]): TestResult {
  const x = finite(a);
  const y = finite(b);
  const n1 = x.length;
  const n2 = y.length;
  if (n1 < 1 || n2 < 1) return UNTESTABLE;

  const { ranks, tieSizes } = rankWithTies([...x, ...y]);
  const rankSumX = ranks.slice(0, n1).reduce((s, r) => s + r, 0);
  const u1 = rankSumX - (n1 * (n1 + 1)) / 2;
  const u2 = n1 * n2 - u1;
  const hasTies = tieSizes.some(t => t > 1);

  if (Math.min(n1, n2) <= 8 && !hasTies) {
    const cdf = mannWhitneyCdf(n1, n2);
    const p = 2 * cdf[Math.round(Math.min(u1, u2))];
    return { statistic: u1, pValue: Math.min(1, p) };
  }

  const n = n1 + n2;
  const tieTerm = tieSizes.reduce((s, t) => s + (t ** 3 - t), 0);
  const sigma = Math.sqrt(((n1 * n2) / 12) * (n + 1 - tieTerm / (n * (n - 1))));
  if (!(sigma > 0)) return UNTESTABLE;
  const z = (Math.max(u1, u2) - (n1 * n2) / 2 - 0.5) / sigma;
  return { statistic: u1, pValue: Math.min(1, 2 * normalSurvival(z)) };
}

// CDF of the Wilcoxon signed-rank statistic W+ under H0 (no ties/zeros), indexed by W+
function signedRankCdf(n: number): Float64Array {
  const cached = signedRankCdfCache.get(n);
  if (cached) return cached;
  const maxSum = (n * (n + 1)) / 2;
  const counts = new Float64Array(maxSum + 1);
  counts[0] = 1;
  for (let i = 1; i <= n; i++) {
    for (let s = maxSum; s >= i; s--) counts[s] += counts[s - i];
  }
  const total = 2 ** n;
  const cdf = new Float64Array(maxSum + 1);
  let running = 0;
  for (let s = 0; s <= maxSum; s++) {
    running += counts[s];
    cdf[s] = running / total;
  }
  signedRankCdfCache.set(n, cdf);
  return cdf;
}

// Wilcoxon signed-rank test on aligned arrays, two-sided (scipy.stats.wilcoxon,
// zero_method='wilcox'): exact for n <= 50 without ties or zero differences,
// otherwise normal approximation with tie correction.
export function wilcoxonSignedRank(a: number[], b: number[]): TestResult {
  const allDiffs = pairedDifferences(a, b);
  const diffs = allDiffs.filter(d => d !== 0);
  const n = diffs.length;
  if (n < 1) return UNTESTABLE;

  const { ranks, tieSizes } = rankWithTies(diffs.map(Math.abs));
  const rPlus = ranks.reduce((s, r, i) => s + (diffs[i] > 0 ? r : 0), 0);
  const rMinus = (n * (n + 1)) / 2 - rPlus;
  const statistic = Math.min(rPlus, rMinus);
  const hasTiesOrZeros = tieSizes.some(t => t > 1) || diffs.length !== allDiffs.length;

  if (n <= 50 && !hasTiesOrZeros) {
    const cdf = signedRankCdf(n);
    return { statistic, pValue: Math.min(1, 2 * cdf[Math.round(statistic)]) };
  }

  const tieTerm = tieSizes.reduce((s, t) => s + (t ** 3 - t), 0);
  const se = Math.sqrt((n * (n + 1) * (2 * n + 1)) / 24 - tieTerm / 48);
  if (!(se > 0)) return UNTESTABLE;
  const z = (rPlus - (n * (n + 1)) / 4) / se;
  return { statistic, pValue: Math.min(1, 2 * normalSurvival(Math.abs(z))) };
}

// One-way ANOVA across any number of groups (scipy.stats.f_oneway)
export function oneWayAnova(groups: number[][]): TestResult {
  const valid = groups.map(finite).filter(g => g.length > 0);
  const k = valid.length;
  const nTotal = valid.reduce((s, g) => s + g.length, 0);
  if (k < 2 || nTotal - k < 1) return UNTESTABLE;

  const grandMean = mean(valid.flat());
  let ssBetween = 0;
  let ssWithin = 0;
  for (const g of valid) {
    const m = mean(g);
    ssBetween += g.length * (m - grandMean) ** 2;
    ssWithin += g.reduce((s, v) => s + (v - m) ** 2, 0);
  }
  if (!(ssWithin > 0)) return UNTESTABLE;
  const f = ssBetween / (k - 1) / (ssWithin / (nTotal - k));
  return { statistic: f, pValue: fSurvival(f, k - 1, nTotal - k) };
}

// ---------------------------------------------------------------------------
// Multiple testing correction. NaN p-values are excluded from the family size,
// matching R's p.adjust with NA values.
// ---------------------------------------------------------------------------

export function benjaminiHochberg(pValues: number[]): number[] {
  const indexed = pValues
    .map((p, i) => ({ p, i }))
    .filter(e => Number.isFinite(e.p))
    .sort((a, b) => a.p - b.p);
  const m = indexed.length;
  const adj = pValues.map(() => NaN);

  let minAdj = 1;
  for (let rank = m; rank >= 1; rank--) {
    const { p, i } = indexed[rank - 1];
    minAdj = Math.min(minAdj, (p * m) / rank);
    adj[i] = minAdj;
  }
  return adj;
}

export function bonferroni(pValues: number[]): number[] {
  const m = pValues.filter(p => Number.isFinite(p)).length;
  return pValues.map(p => (Number.isFinite(p) ? Math.min(1, p * m) : NaN));
}

// ---------------------------------------------------------------------------
// Preprocessing: transform -> normalize -> impute, on a protein x sample matrix
// where missing values are NaN.
// ---------------------------------------------------------------------------

export interface ProcessedMatrix {
  proteins: ProteinRow[];
  samples: SampleMetadata[];
  values: number[][]; // [protein][sample], aligned with `samples`
  imputed: boolean[][];
}

// Builds the working matrix. With log2 transform, non-positive intensities are missing.
function buildWorkingMatrix(
  proteins: ProteinRow[],
  samples: SampleMetadata[],
  log2Transform: boolean
): number[][] {
  return proteins.map(p =>
    samples.map(s => {
      const raw = p.intensities[s.sampleId];
      if (!Number.isFinite(raw)) return NaN;
      if (log2Transform) return raw > 0 ? Math.log2(raw) : NaN;
      return raw;
    })
  );
}

const column = (values: number[][], j: number) => values.map(row => row[j]);

// Normalization on the working scale. On a log scale, sample-level adjustments are additive.
export function normalizeValues(values: number[][], method: NormalizationMethod, logScale: boolean): number[][] {
  if (method === 'none' || values.length === 0) return values;
  const nSamples = values[0].length;
  const out = values.map(row => [...row]);

  if (method === 'median') {
    // Median centering: shift each sample so its median equals the median of sample medians
    const medians = Array.from({ length: nSamples }, (_, j) => median(column(values, j)));
    const target = median(medians);
    out.forEach(row => {
      for (let j = 0; j < nSamples; j++) {
        if (!Number.isFinite(row[j])) continue;
        row[j] = logScale ? row[j] - medians[j] + target : (row[j] / medians[j]) * target;
      }
    });
  } else if (method === 'max') {
    // Max scaling: align each sample's maximum to the mean of sample maxima
    const maxima = Array.from({ length: nSamples }, (_, j) => Math.max(...finite(column(values, j))));
    const target = mean(maxima);
    out.forEach(row => {
      for (let j = 0; j < nSamples; j++) {
        if (!Number.isFinite(row[j])) continue;
        row[j] = logScale ? row[j] - maxima[j] + target : (row[j] / maxima[j]) * target;
      }
    });
  } else if (method === 'zscore') {
    // Per-protein standardization across samples (fold changes become SD units)
    out.forEach(row => {
      const m = mean(row);
      const sd = stdDev(row);
      for (let j = 0; j < nSamples; j++) {
        if (!Number.isFinite(row[j])) continue;
        row[j] = sd > 0 ? (row[j] - m) / sd : 0;
      }
    });
  } else if (method === 'quantile') {
    // Quantile normalization tolerant of missing values: each sample's observed values
    // are mapped onto a reference distribution built from interpolated sample quantiles.
    const sortedCols = Array.from({ length: nSamples }, (_, j) =>
      finite(column(values, j)).sort((a, b) => a - b)
    );
    const gridSize = Math.max(...sortedCols.map(c => c.length));
    if (gridSize === 0) return out;
    const reference = Array.from({ length: gridSize }, (_, r) => {
      const pos = gridSize === 1 ? 0 : r / (gridSize - 1);
      return mean(sortedCols.filter(c => c.length > 0).map(c => interpolateSorted(c, pos)));
    });

    for (let j = 0; j < nSamples; j++) {
      const observed: { i: number; v: number }[] = [];
      values.forEach((row, i) => {
        if (Number.isFinite(row[j])) observed.push({ i, v: row[j] });
      });
      if (!observed.length) continue;
      const { ranks } = rankWithTies(observed.map(o => o.v));
      observed.forEach((o, k) => {
        const pos = observed.length === 1 ? 0 : (ranks[k] - 1) / (observed.length - 1);
        out[o.i][j] = interpolateSorted(reference, pos);
      });
    }
  }

  return out;
}

const KNN_NEIGHBORS = 5;
// Perseus-style down-shifted normal distribution parameters
const MINDET_DOWNSHIFT_SD = 1.8;
const MINDET_WIDTH_SD = 0.3;

// Missing value imputation. Draws are seeded per protein/sample, so results are reproducible.
export function imputeValues(
  values: number[][],
  proteins: ProteinRow[],
  samples: SampleMetadata[],
  method: ImputationMethod
): { values: number[][]; imputed: boolean[][]; keep: boolean[] } {
  const out = values.map(row => [...row]);
  const imputed = values.map(row => row.map(() => false));
  const keep = values.map(row => (method === 'drop' ? row.every(v => Number.isFinite(v)) : true));
  if (method === 'none' || method === 'drop') return { values: out, imputed, keep };

  const nSamples = samples.length;
  const sampleStats = Array.from({ length: nSamples }, (_, j) => {
    const col = column(values, j);
    return { mean: mean(col), sd: stdDev(col) };
  });

  values.forEach((row, i) => {
    const rowMedian = median(row);
    for (let j = 0; j < nSamples; j++) {
      if (Number.isFinite(row[j])) continue;
      let fill = NaN;

      if (method === 'zero') {
        fill = 0;
      } else if (method === 'median') {
        fill = rowMedian;
      } else if (method === 'mindet_lod') {
        const { mean: m, sd } = sampleStats[j];
        if (Number.isFinite(m)) {
          const width = Number.isFinite(sd) ? sd : 0;
          const rng = createRng(hashSeed(`${proteins[i].accession}|${samples[j].sampleId}`));
          fill = m - MINDET_DOWNSHIFT_SD * width + MINDET_WIDTH_SD * width * normalDraw(rng);
        }
      } else if (method === 'knn') {
        fill = knnImpute(values, i, j);
        if (!Number.isFinite(fill)) fill = rowMedian;
      }

      if (Number.isFinite(fill)) {
        out[i][j] = fill;
        imputed[i][j] = true;
      }
    }
  });

  return { values: out, imputed, keep };
}

// Mean of the target sample's value across the k nearest proteins (RMS distance over
// samples observed in both rows) that have that sample observed.
function knnImpute(values: number[][], target: number, sampleIdx: number): number {
  const row = values[target];
  const candidates: { dist: number; value: number }[] = [];
  values.forEach((other, i) => {
    if (i === target || !Number.isFinite(other[sampleIdx])) return;
    let sumSq = 0;
    let shared = 0;
    for (let j = 0; j < row.length; j++) {
      if (Number.isFinite(row[j]) && Number.isFinite(other[j])) {
        sumSq += (row[j] - other[j]) ** 2;
        shared++;
      }
    }
    if (shared > 0) candidates.push({ dist: Math.sqrt(sumSq / shared), value: other[sampleIdx] });
  });
  if (!candidates.length) return NaN;
  candidates.sort((a, b) => a.dist - b.dist);
  return mean(candidates.slice(0, KNN_NEIGHBORS).map(c => c.value));
}

export function preprocessMatrix(
  proteins: ProteinRow[],
  samples: SampleMetadata[],
  config: Pick<ExperimentDesignConfig, 'log2Transform' | 'normalization' | 'imputation'>
): ProcessedMatrix {
  const working = buildWorkingMatrix(proteins, samples, config.log2Transform);
  const normalized = normalizeValues(working, config.normalization, config.log2Transform);
  const { values, imputed, keep } = imputeValues(normalized, proteins, samples, config.imputation);
  return {
    proteins: proteins.filter((_, i) => keep[i]),
    samples,
    values: values.filter((_, i) => keep[i]),
    imputed: imputed.filter((_, i) => keep[i]),
  };
}

// ---------------------------------------------------------------------------
// Differential expression
// ---------------------------------------------------------------------------

export type ResolvedTest = 'welch' | 'student' | 'paired_t' | 'mann_whitney' | 'wilcoxon_signed_rank' | 'anova';

// Resolves the test actually run. The paired-design toggle turns t-tests into a paired
// t-test and Mann-Whitney into the Wilcoxon signed-rank test; ANOVA ignores pairing.
export function resolveStatTest(config: Pick<ExperimentDesignConfig, 'statTest' | 'paired'>): ResolvedTest {
  switch (config.statTest) {
    case 'paired_ttest':
      return 'paired_t';
    case 'mann_whitney':
      return config.paired ? 'wilcoxon_signed_rank' : 'mann_whitney';
    case 'anova':
      return 'anova';
    case 'student_ttest':
      return config.paired ? 'paired_t' : 'student';
    default:
      return config.paired ? 'paired_t' : 'welch';
  }
}

export const STAT_TEST_LABELS: Record<ResolvedTest, string> = {
  welch: "two-sided Welch's t-test",
  student: "two-sided Student's t-test (pooled variance)",
  paired_t: 'two-sided paired t-test',
  mann_whitney: 'two-sided Mann-Whitney U test',
  wilcoxon_signed_rank: 'two-sided Wilcoxon signed-rank test',
  anova: 'one-way ANOVA across all experimental conditions',
};

export function describeStatTest(config: Pick<ExperimentDesignConfig, 'statTest' | 'paired'>): string {
  return STAT_TEST_LABELS[resolveStatTest(config)];
}

// Aligns group A and B sample indices into pairs, by pairedSubjectId when every sample
// has one, otherwise by replicate number.
export function pairSamples(
  samples: SampleMetadata[],
  groupA: number[],
  groupB: number[]
): Array<[number, number]> {
  const useSubject = [...groupA, ...groupB].every(i => samples[i].pairedSubjectId);
  const key = (i: number) => (useSubject ? samples[i].pairedSubjectId! : String(samples[i].replicate));
  const bByKey = new Map(groupB.map(i => [key(i), i]));
  const pairs: Array<[number, number]> = [];
  for (const a of groupA) {
    const b = bByKey.get(key(a));
    if (b !== undefined) pairs.push([a, b]);
  }
  return pairs;
}

export function runDifferentialExpression(
  proteins: ProteinRow[],
  samples: SampleMetadata[],
  config: ExperimentDesignConfig
): StatResultRow[] {
  const processed = preprocessMatrix(proteins, samples, config);
  const test = resolveStatTest(config);

  const idxA = samples.flatMap((s, i) => (s.condition === config.groupA ? [i] : []));
  const idxB = samples.flatMap((s, i) => (s.condition === config.groupB ? [i] : []));
  const pairs = test === 'paired_t' || test === 'wilcoxon_signed_rank' ? pairSamples(samples, idxA, idxB) : [];
  const conditionGroups = Array.from(new Set(samples.map(s => s.condition))).map(c =>
    samples.flatMap((s, i) => (s.condition === c ? [i] : []))
  );

  const rows = processed.proteins.map((p, pIdx) => {
    const row = processed.values[pIdx];
    const valsA = idxA.map(i => row[i]);
    const valsB = idxB.map(i => row[i]);

    let result: TestResult;
    switch (test) {
      case 'student':
        result = studentTTest(valsA, valsB);
        break;
      case 'paired_t':
        result = pairedTTest(pairs.map(([a]) => row[a]), pairs.map(([, b]) => row[b]));
        break;
      case 'mann_whitney':
        result = mannWhitneyU(valsA, valsB);
        break;
      case 'wilcoxon_signed_rank':
        result = wilcoxonSignedRank(pairs.map(([a]) => row[a]), pairs.map(([, b]) => row[b]));
        break;
      case 'anova':
        result = oneWayAnova(conditionGroups.map(g => g.map(i => row[i])));
        break;
      default:
        result = welchTTest(valsA, valsB);
    }

    const meanA = mean(valsA);
    const meanB = mean(valsB);
    const log2FC = meanA - meanB;

    return {
      accession: p.accession,
      geneSymbol: p.geneSymbol,
      description: p.description,
      meanGroupA: meanA,
      meanGroupB: meanB,
      log2FC,
      foldChangeRatio: Math.pow(2, log2FC),
      pValue: result.pValue,
      statisticValue: result.statistic,
      intensitiesGroupA: valsA,
      intensitiesGroupB: valsB,
    };
  });

  const rawPValues = rows.map(r => r.pValue);
  const adjustedPValues =
    config.fdrCorrection === 'benjamini_hochberg'
      ? benjaminiHochberg(rawPValues)
      : config.fdrCorrection === 'bonferroni'
        ? bonferroni(rawPValues)
        : [...rawPValues];

  return rows.map((row, idx) => {
    const adjPValue = adjustedPValues[idx];
    const testable = Number.isFinite(adjPValue) && Number.isFinite(row.log2FC);
    const isSignificant =
      testable && adjPValue <= config.pCutoff && Math.abs(row.log2FC) >= config.log2FCCutoff;
    const regulation: StatResultRow['regulation'] = !isSignificant ? 'neutral' : row.log2FC > 0 ? 'up' : 'down';

    return {
      ...row,
      adjPValue,
      negLog10AdjPValue: Number.isFinite(adjPValue) ? -Math.log10(Math.max(1e-300, adjPValue)) : 0,
      isSignificant,
      regulation,
    };
  });
}

// ---------------------------------------------------------------------------
// Sample-level exploratory analysis
// ---------------------------------------------------------------------------

// Eigen-decomposition of a symmetric matrix (cyclic Jacobi); eigenvalues sorted descending
export function symmetricEigen(input: number[][]): { values: number[]; vectors: number[][] } {
  const n = input.length;
  const a = input.map(row => [...row]);
  const v: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));

  for (let sweep = 0; sweep < 100; sweep++) {
    let offDiag = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) offDiag += a[p][q] ** 2;
    if (offDiag < 1e-22) break;

    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(a[p][q]) < 1e-300) continue;
        const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = a[k][p];
          const akq = a[k][q];
          a[k][p] = c * akp - s * akq;
          a[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = a[p][k];
          const aqk = a[q][k];
          a[p][k] = c * apk - s * aqk;
          a[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = v[k][p];
          const vkq = v[k][q];
          v[k][p] = c * vkp - s * vkq;
          v[k][q] = s * vkp + c * vkq;
        }
      }
    }
  }

  const order = Array.from({ length: n }, (_, i) => i).sort((i, j) => a[j][j] - a[i][i]);
  return {
    values: order.map(i => a[i][i]),
    vectors: order.map(i => v.map(row => row[i])), // vectors[k] is the k-th eigenvector
  };
}

// PCA of samples on the preprocessed matrix (proteins centered, not scaled; equivalent to
// R prcomp(t(x))). Only proteins observed in every sample after preprocessing are used.
export function computePCA(
  proteins: ProteinRow[],
  samples: SampleMetadata[],
  config: Pick<ExperimentDesignConfig, 'log2Transform' | 'normalization' | 'imputation'>
): PCAResult {
  const empty: PCAResult = { points: [], varExplainedPC1: 0, varExplainedPC2: 0, proteinsUsed: 0 };
  if (samples.length < 2 || !proteins.length) return empty;

  const { values } = preprocessMatrix(proteins, samples, config);
  const complete = values.filter(row => row.every(v => Number.isFinite(v)));
  if (!complete.length) return empty;

  const n = samples.length;
  const centered = complete.map(row => {
    const m = mean(row);
    return row.map(v => v - m);
  });

  // Gram matrix between samples: G = X X^T, with X = samples x proteins
  const gram = Array.from({ length: n }, () => new Array(n).fill(0));
  for (const row of centered) {
    for (let i = 0; i < n; i++) {
      for (let j = i; j < n; j++) gram[i][j] += row[i] * row[j];
    }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < i; j++) gram[i][j] = gram[j][i];

  const { values: eigenvalues, vectors } = symmetricEigen(gram);
  const positive = eigenvalues.map(l => Math.max(0, l));
  const totalVar = positive.reduce((s, l) => s + l, 0);

  // Scores = U * sqrt(lambda); sign fixed so the largest-magnitude score is positive
  const scores = [0, 1].map(k => {
    const vec = vectors[k] ?? new Array(n).fill(0);
    const scale = Math.sqrt(positive[k] ?? 0);
    const pivot = vec.reduce((best, x) => (Math.abs(x) > Math.abs(best) ? x : best), 0);
    const sign = pivot < 0 ? -1 : 1;
    return vec.map(x => sign * x * scale);
  });

  const points: PCAPoint[] = samples.map((s, i) => ({
    sampleId: s.sampleId,
    condition: s.condition,
    pc1: scores[0][i],
    pc2: scores[1][i],
  }));

  const pct = (l: number) => (totalVar > 0 ? Number(((l / totalVar) * 100).toFixed(1)) : 0);
  return {
    points,
    varExplainedPC1: pct(positive[0] ?? 0),
    varExplainedPC2: pct(positive[1] ?? 0),
    proteinsUsed: complete.length,
  };
}

// Pearson correlation between samples on the preprocessed matrix, using pairwise-complete
// observations. Pairs with fewer than 3 shared proteins are NaN.
export function computeSampleCorrelation(
  proteins: ProteinRow[],
  samples: SampleMetadata[],
  config: Pick<ExperimentDesignConfig, 'log2Transform' | 'normalization' | 'imputation'>
): { labels: string[]; matrix: number[][] } {
  const labels = samples.map(s => s.sampleId);
  const n = samples.length;
  const { values } = preprocessMatrix(proteins, samples, config);
  const corrMatrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(1));

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const xs: number[] = [];
      const ys: number[] = [];
      for (const row of values) {
        if (Number.isFinite(row[i]) && Number.isFinite(row[j])) {
          xs.push(row[i]);
          ys.push(row[j]);
        }
      }
      let r = NaN;
      if (xs.length >= 3) {
        const mx = mean(xs);
        const my = mean(ys);
        let num = 0;
        let dx = 0;
        let dy = 0;
        for (let k = 0; k < xs.length; k++) {
          num += (xs[k] - mx) * (ys[k] - my);
          dx += (xs[k] - mx) ** 2;
          dy += (ys[k] - my) ** 2;
        }
        if (dx > 0 && dy > 0) r = Math.max(-1, Math.min(1, num / Math.sqrt(dx * dy)));
      }
      corrMatrix[i][j] = r;
      corrMatrix[j][i] = r;
    }
  }

  return { labels, matrix: corrMatrix };
}
