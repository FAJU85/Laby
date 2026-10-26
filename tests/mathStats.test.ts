import { describe, expect, it } from 'vitest';
import reference from './fixtures/scipy-reference.json';
import {
  fSurvival,
  incompleteBeta,
  normalSurvival,
  studentTTwoSidedP,
} from '../src/utils/distributions';
import {
  benjaminiHochberg,
  bonferroni,
  computePCA,
  computeReproducibilityHash,
  computeSampleCorrelation,
  describeStatTest,
  imputeValues,
  mannWhitneyU,
  normalizeValues,
  oneWayAnova,
  pairedTTest,
  preprocessMatrix,
  runDifferentialExpression,
  studentTTest,
  welchTTest,
  wilcoxonSignedRank,
} from '../src/utils/mathStats';
import { sha256Hex } from '../src/utils/sha256';
import { HeLaPresetMatrix, PRESET_DATASETS, serializeMatrixCSV } from '../src/data/presets';
import type { ExperimentDesignConfig, ProteinRow, SampleMetadata } from '../src/types/proteomics';

// Relative tolerance check that also handles values near zero
function expectClose(actual: number, expected: number, rel = 1e-9) {
  const tol = Math.max(Math.abs(expected) * rel, 1e-14);
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tol);
}

describe('distributions vs SciPy', () => {
  it('Student t two-sided p-values', () => {
    for (const c of reference.distributions.tTwoSided) expectClose(studentTTwoSidedP(c.t, c.df), c.p);
  });
  it('F distribution survival', () => {
    for (const c of reference.distributions.fSurvival) expectClose(fSurvival(c.f, c.df1, c.df2), c.p);
  });
  it('normal survival', () => {
    for (const c of reference.distributions.normalSurvival) expectClose(normalSurvival(c.z), c.p);
  });
  it('regularized incomplete beta', () => {
    for (const c of reference.distributions.incompleteBeta) expectClose(incompleteBeta(c.x, c.a, c.b), c.value);
  });
});

describe('hypothesis tests vs SciPy', () => {
  it("Welch's t-test", () => {
    for (const c of reference.tests.welch) {
      const r = welchTTest(c.a, c.b);
      expectClose(r.statistic, c.statistic);
      expectClose(r.pValue, c.p);
    }
  });
  it("Student's t-test", () => {
    for (const c of reference.tests.student) {
      const r = studentTTest(c.a, c.b);
      expectClose(r.statistic, c.statistic);
      expectClose(r.pValue, c.p);
    }
  });
  it('paired t-test', () => {
    for (const c of reference.tests.paired) {
      const r = pairedTTest(c.a, c.b);
      expectClose(r.statistic, c.statistic);
      expectClose(r.pValue, c.p);
    }
  });
  it('Mann-Whitney U (exact and asymptotic)', () => {
    for (const c of reference.tests.mannWhitney) {
      const r = mannWhitneyU(c.a, c.b);
      expectClose(r.statistic, c.statistic);
      expectClose(r.pValue, c.p, 1e-8);
    }
  });
  it('Wilcoxon signed-rank (exact and asymptotic)', () => {
    for (const c of reference.tests.wilcoxon) {
      const r = wilcoxonSignedRank(c.a, c.b);
      expectClose(r.statistic, c.statistic);
      expectClose(r.pValue, c.p, 1e-8);
    }
  });
  it('one-way ANOVA', () => {
    for (const c of reference.tests.anova) {
      const r = oneWayAnova(c.groups);
      expectClose(r.statistic, c.statistic);
      expectClose(r.pValue, c.p);
    }
  });
  it('returns NaN when a test is not possible', () => {
    expect(welchTTest([1], [2, 3]).pValue).toBeNaN();
    expect(welchTTest([1, 1], [1, 1]).pValue).toBeNaN();
    expect(welchTTest([NaN, 1, NaN], [2, 3]).pValue).toBeNaN();
    expect(pairedTTest([1, NaN], [2, 3]).pValue).toBeNaN();
    expect(oneWayAnova([[1, 2]]).pValue).toBeNaN();
  });
});

describe('multiple testing correction', () => {
  it('Benjamini-Hochberg matches SciPy', () => {
    const adj = benjaminiHochberg(reference.fdr.p);
    reference.fdr.bh.forEach((v, i) => expectClose(adj[i], v));
  });
  it('excludes NaN p-values from the family size', () => {
    expect(benjaminiHochberg([0.01, NaN, 0.04])).toEqual([0.02, NaN, 0.04]);
    expect(bonferroni([0.01, NaN, 0.6])).toEqual([0.02, NaN, 1]);
  });
});

describe('preprocessing', () => {
  it('median centering aligns sample medians on the log scale', () => {
    const values = [
      [10, 11, NaN],
      [12, 13, 14],
      [14, 15, 16],
    ];
    const out = normalizeValues(values, 'median', true);
    const medians = [0, 1, 2].map(j => {
      const col = out.map(r => r[j]).filter(Number.isFinite).sort((a, b) => a - b);
      return col.length % 2 ? col[(col.length - 1) / 2] : (col[col.length / 2 - 1] + col[col.length / 2]) / 2;
    });
    expect(new Set(medians.map(m => m.toFixed(9))).size).toBe(1);
    expect(out[0][2]).toBeNaN();
  });

  it('quantile normalization gives every complete sample the same distribution', () => {
    const values = [
      [5, 4, 3],
      [2, 1, 4],
      [3, 4, 6],
      [4, 2, 8],
    ];
    const out = normalizeValues(values, 'quantile', true);
    const sortedCols = [0, 1, 2].map(j => out.map(r => r[j]).sort((a, b) => a - b).join(','));
    // Column 1 has a tie (4, 4), so only the tie-free columns must match exactly
    expect(sortedCols[0]).toBe(sortedCols[2]);
  });

  it('MinDet imputation is deterministic and falls below observed values', () => {
    const proteins: ProteinRow[] = [0, 1, 2, 3].map(i => ({
      accession: `P${i}`, geneSymbol: `G${i}`, description: '', intensities: {},
    }));
    const samples: SampleMetadata[] = ['s1', 's2'].map((id, i) => ({ sampleId: id, condition: 'c', replicate: i + 1 }));
    const values = [
      [20, NaN],
      [22, 21],
      [24, 23],
      [26, 25],
    ];
    const first = imputeValues(values, proteins, samples, 'mindet_lod');
    const second = imputeValues(values, proteins, samples, 'mindet_lod');
    expect(first.values).toEqual(second.values);
    expect(first.imputed[0][1]).toBe(true);
    expect(first.values[0][1]).toBeLessThan(21);
  });

  it('KNN imputation uses the most similar proteins', () => {
    const values = [
      [10, 11, NaN],
      // Five close neighbours...
      [10.1, 11.1, 12],
      [9.9, 10.9, 12],
      [10.2, 11.2, 12],
      [9.8, 10.8, 12],
      [10.3, 11.3, 12],
      // ...and one distant protein that must be ignored
      [30, 31, 100],
    ];
    const proteins: ProteinRow[] = values.map((_, i) => ({
      accession: `P${i}`, geneSymbol: `G${i}`, description: '', intensities: {},
    }));
    const samples: SampleMetadata[] = ['s1', 's2', 's3'].map((id, i) => ({ sampleId: id, condition: 'c', replicate: i + 1 }));
    const out = imputeValues(values, proteins, samples, 'knn');
    expect(out.values[0][2]).toBeCloseTo(12, 9);
  });

  it('drop removes proteins with any missing value', () => {
    const samples: SampleMetadata[] = [{ sampleId: 'a', condition: 'x', replicate: 1 }, { sampleId: 'b', condition: 'y', replicate: 1 }];
    const proteins: ProteinRow[] = [
      { accession: 'P1', geneSymbol: 'G1', description: '', intensities: { a: 100, b: NaN } },
      { accession: 'P2', geneSymbol: 'G2', description: '', intensities: { a: 100, b: 200 } },
    ];
    const out = preprocessMatrix(proteins, samples, { log2Transform: true, normalization: 'none', imputation: 'drop' });
    expect(out.proteins.map(p => p.accession)).toEqual(['P2']);
  });

  it('treats non-positive intensities as missing before log2', () => {
    const samples: SampleMetadata[] = [{ sampleId: 'a', condition: 'x', replicate: 1 }];
    const proteins: ProteinRow[] = [{ accession: 'P1', geneSymbol: 'G1', description: '', intensities: { a: 0 } }];
    const out = preprocessMatrix(proteins, samples, { log2Transform: true, normalization: 'none', imputation: 'none' });
    expect(out.values[0][0]).toBeNaN();
  });
});

describe('PCA', () => {
  it('matches NumPy SVD scores and explained variance', () => {
    const matrix: number[][] = reference.pca.matrix;
    const samples: SampleMetadata[] = matrix[0].map((_, j) => ({ sampleId: `S${j}`, condition: j < 3 ? 'A' : 'B', replicate: j }));
    const proteins: ProteinRow[] = matrix.map((row, i) => ({
      accession: `P${i}`, geneSymbol: `G${i}`, description: '',
      intensities: Object.fromEntries(row.map((v, j) => [`S${j}`, v])),
    }));
    const result = computePCA(proteins, samples, { log2Transform: false, normalization: 'none', imputation: 'none' });

    expect(result.proteinsUsed).toBe(matrix.length);
    expect(result.varExplainedPC1).toBeCloseTo(reference.pca.varExplained[0], 1);
    expect(result.varExplainedPC2).toBeCloseTo(reference.pca.varExplained[1], 1);
    // Component signs are arbitrary; compare up to a global sign flip
    for (const [key, ref] of [['pc1', reference.pca.pc1], ['pc2', reference.pca.pc2]] as const) {
      const ours = result.points.map(p => p[key]);
      const sign = Math.sign(ours[0]) === Math.sign(ref[0]) ? 1 : -1;
      ours.forEach((v, i) => expect(v * sign).toBeCloseTo(ref[i], 6));
    }
  });
});

describe('differential expression pipeline', () => {
  const baseConfig: ExperimentDesignConfig = {
    groupFactor: 'Condition',
    groupA: 'Drug_Treated',
    groupB: 'Control',
    paired: false,
    referenceLevel: 'Control',
    log2Transform: true,
    normalization: 'median',
    imputation: 'mindet_lod',
    statTest: 'welch_ttest',
    fdrCorrection: 'benjamini_hochberg',
    pCutoff: 0.05,
    log2FCCutoff: 1.0,
  };

  it('is deterministic for the same input', () => {
    const a = runDifferentialExpression(HeLaPresetMatrix.proteins, HeLaPresetMatrix.samples, baseConfig);
    const b = runDifferentialExpression(HeLaPresetMatrix.proteins, HeLaPresetMatrix.samples, baseConfig);
    expect(a).toEqual(b);
  });

  it('recovers the simulated fold changes of the HeLa preset', () => {
    const results = runDifferentialExpression(HeLaPresetMatrix.proteins, HeLaPresetMatrix.samples, {
      ...baseConfig,
      normalization: 'none',
    });
    const tp53 = results.find(r => r.geneSymbol === 'TP53')!;
    const egfr = results.find(r => r.geneSymbol === 'EGFR')!;
    expect(tp53.log2FC).toBeCloseTo(Math.log2(3.8), 0);
    expect(egfr.log2FC).toBeCloseTo(Math.log2(0.25), 0);
    expect(tp53.regulation).toBe('up');
    expect(egfr.regulation).toBe('down');
  });

  it('uses the selected statistical test', () => {
    const run = (cfg: Partial<ExperimentDesignConfig>) =>
      runDifferentialExpression(HeLaPresetMatrix.proteins, HeLaPresetMatrix.samples, { ...baseConfig, ...cfg })
        .find(r => r.geneSymbol === 'GAPDH')!.pValue;
    const pValues = new Set([
      run({ statTest: 'welch_ttest' }),
      run({ statTest: 'student_ttest' }),
      run({ statTest: 'mann_whitney' }),
      run({ statTest: 'welch_ttest', paired: true }),
    ]);
    expect(pValues.size).toBe(4);
  });

  it('runs ANOVA across all conditions, which equals Student t for two groups', () => {
    const anova = runDifferentialExpression(HeLaPresetMatrix.proteins, HeLaPresetMatrix.samples, { ...baseConfig, statTest: 'anova' });
    const student = runDifferentialExpression(HeLaPresetMatrix.proteins, HeLaPresetMatrix.samples, { ...baseConfig, statTest: 'student_ttest' });
    anova.forEach((row, i) => expectClose(row.pValue, student[i].pValue, 1e-8));
  });

  it('marks untestable proteins as non-significant with NaN p-values', () => {
    const samples: SampleMetadata[] = [
      { sampleId: 'a1', condition: 'A', replicate: 1 },
      { sampleId: 'a2', condition: 'A', replicate: 2 },
      { sampleId: 'b1', condition: 'B', replicate: 1 },
      { sampleId: 'b2', condition: 'B', replicate: 2 },
    ];
    const proteins: ProteinRow[] = [
      { accession: 'P1', geneSymbol: 'G1', description: '', intensities: { a1: 100, a2: NaN, b1: 10, b2: 12 } },
      { accession: 'P2', geneSymbol: 'G2', description: '', intensities: { a1: 100, a2: 110, b1: 10, b2: 12 } },
    ];
    const results = runDifferentialExpression(proteins, samples, {
      ...baseConfig, groupA: 'A', groupB: 'B', normalization: 'none', imputation: 'none',
    });
    expect(results[0].pValue).toBeNaN();
    expect(results[0].isSignificant).toBe(false);
    expect(results[0].negLog10AdjPValue).toBe(0);
    expect(Number.isFinite(results[1].adjPValue)).toBe(true);
  });

  it('describes the test that is actually run', () => {
    expect(describeStatTest({ statTest: 'welch_ttest', paired: false })).toMatch(/Welch/);
    expect(describeStatTest({ statTest: 'welch_ttest', paired: true })).toMatch(/paired t-test/);
    expect(describeStatTest({ statTest: 'mann_whitney', paired: true })).toMatch(/Wilcoxon/);
  });
});

describe('sample correlation', () => {
  it('is symmetric with unit diagonal', () => {
    const { matrix } = computeSampleCorrelation(HeLaPresetMatrix.proteins, HeLaPresetMatrix.samples, {
      log2Transform: true, normalization: 'median', imputation: 'none',
    });
    matrix.forEach((row, i) => {
      expect(row[i]).toBe(1);
      row.forEach((v, j) => expect(v).toBe(matrix[j][i]));
    });
  });
});

describe('hashing and provenance', () => {
  it('SHA-256 matches hashlib', () => {
    for (const c of reference.sha256) expect(sha256Hex(c.text)).toBe(c.hex);
  });

  it('reproducibility hash is a real SHA-256 that changes with parameters', () => {
    const h1 = computeReproducibilityHash({ pCutoff: 0.05 } as ExperimentDesignConfig, 'abc');
    const h2 = computeReproducibilityHash({ pCutoff: 0.01 } as ExperimentDesignConfig, 'abc');
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    expect(h1).not.toBe(h2);
  });

  it('preset checksums are the SHA-256 of their CSV serialization', () => {
    for (const { matrix } of PRESET_DATASETS) {
      expect(matrix.sha256Checksum).toBe(sha256Hex(serializeMatrixCSV(matrix.proteins, matrix.samples)));
    }
  });
});
