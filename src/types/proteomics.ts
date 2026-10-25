/**
 * Core domain types for Proteomics Publication Pipeline (PROT-001)
 */

export type ExecutionMode = 'local' | 'cloud';

export type UserRole = 'Owner' | 'Analyst' | 'Viewer';

export interface Workspace {
  id: string;
  name: string;
  institution: string;
  ownerEmail: string;
  userRole: UserRole;
  membersCount: number;
  createdDate: string;
  isIsolated: boolean;
}

export interface SampleMetadata {
  sampleId: string;
  condition: string; // e.g., "Control", "Treated_10uM", "Healthy", "Cancer"
  replicate: number;
  batch?: string;
  pairedSubjectId?: string; // For paired t-tests
  covariateAge?: number;
}

export interface ProteinRow {
  accession: string; // e.g. "P04637"
  geneSymbol: string; // e.g. "TP53"
  description: string; // e.g. "Cellular tumor antigen p53"
  intensities: Record<string, number>; // sampleId -> raw / transformed intensity value
  isImputed?: Record<string, boolean>; // sampleId -> boolean
}

export interface IntensityMatrix {
  id: string;
  filename: string;
  sha256Checksum: string;
  fileSizeBytes: number;
  uploadedAt: string;
  samples: SampleMetadata[];
  proteins: ProteinRow[];
  totalProteinsCount: number;
  missingValuePercentage: number;
  zeroIntensityCount: number;
  schemaValidationStatus: 'valid' | 'warning' | 'invalid';
  validationMessages: string[];
}

export type NormalizationMethod = 'none' | 'median' | 'max' | 'quantile' | 'zscore';
export type ImputationMethod = 'none' | 'knn' | 'mindet_lod' | 'median' | 'zero' | 'drop';
export type StatTestType = 'welch_ttest' | 'student_ttest' | 'paired_ttest' | 'anova' | 'mann_whitney';
export type FDRCorrectionMethod = 'benjamini_hochberg' | 'bonferroni' | 'none';

export interface ExperimentDesignConfig {
  groupFactor: string; // Primary condition field
  groupA: string; // Treatment/Case group
  groupB: string; // Control/Reference group
  paired: boolean;
  referenceLevel: string;
  log2Transform: boolean;
  normalization: NormalizationMethod;
  imputation: ImputationMethod;
  statTest: StatTestType;
  fdrCorrection: FDRCorrectionMethod;
  pCutoff: number; // e.g. 0.05
  log2FCCutoff: number; // e.g. 1.0 (2-fold)
}

export interface StatResultRow {
  accession: string;
  geneSymbol: string;
  description: string;
  meanGroupA: number;
  meanGroupB: number;
  log2FC: number; // log2(GroupA) - log2(GroupB)
  foldChangeRatio: number; // 2^(log2FC)
  pValue: number;
  adjPValue: number;
  negLog10AdjPValue: number;
  statisticValue: number;
  isSignificant: boolean;
  regulation: 'up' | 'down' | 'neutral';
  intensitiesGroupA: number[];
  intensitiesGroupB: number[];
}

export interface PCAPoint {
  sampleId: string;
  condition: string;
  pc1: number;
  pc2: number;
}

export interface PCAResult {
  points: PCAPoint[];
  varExplainedPC1: number; // e.g. 48.2%
  varExplainedPC2: number; // e.g. 21.5%
}

export type ColorPaletteName = 'nature' | 'cell' | 'science' | 'viridis' | 'magma';

export type JournalPresetName = 'Nature' | 'Cell' | 'Science' | 'PNAS' | 'ACS' | 'Oxford';

export interface JournalPreset {
  name: JournalPresetName;
  columnWidthMm: number;
  fontFamily: string;
  recommendedDpi: number;
  maxFontSizePt: number;
  minFontSizePt: number;
}

export interface ProvenanceManifest {
  pipelineVersion: string;
  reproducibilityHash: string; // SHA-256 of parameters + matrix SHA256
  timestamp: string;
  datasetName: string;
  datasetChecksum: string;
  executionMode: ExecutionMode;
  parameters: ExperimentDesignConfig;
  summaryStats: {
    totalProteinsTested: number;
    significantUpCount: number;
    significantDownCount: number;
    fdrThreshold: number;
    log2FCThreshold: number;
  };
}

export interface JournalComplianceAudit {
  score: number; // 0 - 100
  status: 'Pass' | 'Action Required' | 'Critical Failure';
  checks: {
    id: string;
    category: 'MIAPE' | 'PRIDE / MassIVE' | 'Figures' | 'Manuscript';
    title: string;
    passed: boolean;
    severity: 'critical' | 'warning' | 'info';
    details: string;
    remediation: string;
  }[];
}

export interface ProofreadAnnotation {
  id: string;
  type: 'statistic_mismatch' | 'terminology' | 'grammar' | 'reference';
  originalText: string;
  suggestedText: string;
  explanation: string;
  confidence: 'high' | 'medium' | 'low';
  accepted?: boolean;
}

export interface PlatformAuditLog {
  id: string;
  timestamp: string;
  workspaceId: string;
  actor: string;
  action: string;
  status: 'SUCCESS' | 'DENIED' | 'RATE_LIMITED';
  details: string;
}
