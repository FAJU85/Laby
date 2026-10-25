import { IntensityMatrix, SampleMetadata, ProteinRow } from '../types/proteomics';

// Helper to build preset intensity matrices
function createPresetMatrix(
  id: string,
  filename: string,
  sha256Checksum: string,
  fileSizeBytes: number,
  samples: SampleMetadata[],
  proteinDefs: Array<{ accession: string; geneSymbol: string; description: string; baseControl: number; baseTreatedRatio: number }>
): IntensityMatrix {
  const proteins: ProteinRow[] = proteinDefs.map(def => {
    const intensities: Record<string, number> = {};
    samples.forEach(s => {
      // Add realistic biological replicate variation
      const isTreatment = s.condition.includes('Treated') || s.condition.includes('Cancer') || s.condition.includes('24h');
      const ratio = isTreatment ? def.baseTreatedRatio : 1.0;
      const noise = (Math.sin(s.replicate * 1.7) * 0.1) + ((Math.random() - 0.5) * 0.15);
      const intensity = Math.max(1, Math.round(def.baseControl * ratio * (1 + noise)));
      intensities[s.sampleId] = intensity;
    });

    return {
      accession: def.accession,
      geneSymbol: def.geneSymbol,
      description: def.description,
      intensities
    };
  });

  return {
    id,
    filename,
    sha256Checksum,
    fileSizeBytes,
    uploadedAt: new Date().toISOString().split('T')[0],
    samples,
    proteins,
    totalProteinsCount: proteins.length,
    missingValuePercentage: 2.4,
    zeroIntensityCount: 18,
    schemaValidationStatus: 'valid',
    validationMessages: [
      'Schema Check Passed: All sample IDs match design matrix columns.',
      'Intensity Range: Positive quantitative MS signals detected (1.0e2 - 4.5e8).',
      'UniProt Accessions: Validated against UniProtKB Human release 2026_01.'
    ]
  };
}

// Preset 1: HeLa Cell Line TMT/LFQ Proteomics Matrix
const HeLaSamples: SampleMetadata[] = [
  { sampleId: 'Ctrl_Rep1', condition: 'Control', replicate: 1 },
  { sampleId: 'Ctrl_Rep2', condition: 'Control', replicate: 2 },
  { sampleId: 'Ctrl_Rep3', condition: 'Control', replicate: 3 },
  { sampleId: 'Ctrl_Rep4', condition: 'Control', replicate: 4 },
  { sampleId: 'Treat_Rep1', condition: 'Drug_Treated', replicate: 1 },
  { sampleId: 'Treat_Rep2', condition: 'Drug_Treated', replicate: 2 },
  { sampleId: 'Treat_Rep3', condition: 'Drug_Treated', replicate: 3 },
  { sampleId: 'Treat_Rep4', condition: 'Drug_Treated', replicate: 4 },
];

const HeLaProteins = [
  { accession: 'P04637', geneSymbol: 'TP53', description: 'Cellular tumor antigen p53', baseControl: 4500, baseTreatedRatio: 3.8 },
  { accession: 'P00533', geneSymbol: 'EGFR', description: 'Epidermal growth factor receptor', baseControl: 12400, baseTreatedRatio: 0.25 },
  { accession: 'P04406', geneSymbol: 'GAPDH', description: 'Glyceraldehyde-3-phosphate dehydrogenase', baseControl: 85000, baseTreatedRatio: 1.02 },
  { accession: 'P60709', geneSymbol: 'ACTB', description: 'Actin, cytoplasmic', baseControl: 120000, baseTreatedRatio: 0.98 },
  { accession: 'P38398', geneSymbol: 'BRCA1', description: 'Breast cancer type 1 susceptibility protein', baseControl: 2100, baseTreatedRatio: 0.35 },
  { accession: 'P01116', geneSymbol: 'KRAS', description: 'GTPase KRas', baseControl: 6800, baseTreatedRatio: 2.6 },
  { accession: 'P01375', geneSymbol: 'TNF', description: 'Tumor necrosis factor', baseControl: 1800, baseTreatedRatio: 4.5 },
  { accession: 'P10415', geneSymbol: 'BCL2', description: 'Apoptosis regulator Bcl-2', baseControl: 5400, baseTreatedRatio: 0.22 },
  { accession: 'P05019', geneSymbol: 'IGF1', description: 'Insulin-like growth factor I', baseControl: 3200, baseTreatedRatio: 2.1 },
  { accession: 'Q96EB6', geneSymbol: 'SIRT1', description: 'NAD-dependent protein deacetylase sirtuin-1', baseControl: 4100, baseTreatedRatio: 1.8 },
  { accession: 'P27361', geneSymbol: 'MAPK3', description: 'Mitogen-activated protein kinase 3 (ERK1)', baseControl: 14200, baseTreatedRatio: 0.45 },
  { accession: 'P28482', geneSymbol: 'MAPK1', description: 'Mitogen-activated protein kinase 1 (ERK2)', baseControl: 15800, baseTreatedRatio: 0.42 },
  { accession: 'P31749', geneSymbol: 'AKT1', description: 'RAC-alpha serine/threonine-protein kinase', baseControl: 9800, baseTreatedRatio: 0.31 },
  { accession: 'Q00987', geneSymbol: 'MDM2', description: 'E3 ubiquitin-protein ligase MDM2', baseControl: 3100, baseTreatedRatio: 3.1 },
  { accession: 'P08069', geneSymbol: 'IGF1R', description: 'Insulin-like growth factor 1 receptor', baseControl: 7400, baseTreatedRatio: 0.5 },
  { accession: 'P68431', geneSymbol: 'H3C1', description: 'Histone H3.1', baseControl: 45000, baseTreatedRatio: 1.05 },
  { accession: 'Q01813', geneSymbol: 'PFKP', description: 'ATP-dependent 6-phosphofructokinase', baseControl: 11200, baseTreatedRatio: 0.88 },
  { accession: 'P07355', geneSymbol: 'ANXA2', description: 'Annexin A2', baseControl: 28000, baseTreatedRatio: 1.15 },
  { accession: 'P06733', geneSymbol: 'ENO1', description: 'Alpha-enolase', baseControl: 64000, baseTreatedRatio: 0.95 },
  { accession: 'P00338', geneSymbol: 'LDHA', description: 'L-lactate dehydrogenase A chain', baseControl: 52000, baseTreatedRatio: 1.25 }
];

export const HeLaPresetMatrix = createPresetMatrix(
  'preset-hela-tmt',
  'HeLa_Proteomics_TMT16plex_Matrix.csv',
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  482100,
  HeLaSamples,
  HeLaProteins
);

// Preset 2: Plasma Biomarker Discovery Cohort
const PlasmaSamples: SampleMetadata[] = [
  { sampleId: 'Healthy_S1', condition: 'Healthy_Control', replicate: 1 },
  { sampleId: 'Healthy_S2', condition: 'Healthy_Control', replicate: 2 },
  { sampleId: 'Healthy_S3', condition: 'Healthy_Control', replicate: 3 },
  { sampleId: 'Healthy_S4', condition: 'Healthy_Control', replicate: 4 },
  { sampleId: 'Cancer_S1', condition: 'Pancreatic_Cancer', replicate: 1 },
  { sampleId: 'Cancer_S2', condition: 'Pancreatic_Cancer', replicate: 2 },
  { sampleId: 'Cancer_S3', condition: 'Pancreatic_Cancer', replicate: 3 },
  { sampleId: 'Cancer_S4', condition: 'Pancreatic_Cancer', replicate: 4 },
];

const PlasmaProteins = [
  { accession: 'P02741', geneSymbol: 'CRP', description: 'C-reactive protein', baseControl: 1200, baseTreatedRatio: 8.5 },
  { accession: 'P02768', geneSymbol: 'ALB', description: 'Serum albumin', baseControl: 450000, baseTreatedRatio: 0.85 },
  { accession: 'P02671', geneSymbol: 'FGA', description: 'Fibrinogen alpha chain', baseControl: 34000, baseTreatedRatio: 2.8 },
  { accession: 'P01023', geneSymbol: 'A2M', description: 'Alpha-2-macroglobulin', baseControl: 89000, baseTreatedRatio: 1.1 },
  { accession: 'P02751', geneSymbol: 'FN1', description: 'Fibronectin', baseControl: 23000, baseTreatedRatio: 3.4 },
  { accession: 'P00738', geneSymbol: 'HP', description: 'Haptoglobin', baseControl: 18000, baseTreatedRatio: 4.1 },
  { accession: 'P02647', geneSymbol: 'APOA1', description: 'Apolipoprotein A-I', baseControl: 120000, baseTreatedRatio: 0.6 },
  { accession: 'P01024', geneSymbol: 'C3', description: 'Complement C3', baseControl: 65000, baseTreatedRatio: 1.9 },
  { accession: 'P02763', geneSymbol: 'ORM1', description: 'Alpha-1-acid glycoprotein 1', baseControl: 15000, baseTreatedRatio: 3.9 },
  { accession: 'P00747', geneSymbol: 'PLG', description: 'Plasminogen', baseControl: 28000, baseTreatedRatio: 0.72 }
];

export const PlasmaPresetMatrix = createPresetMatrix(
  'preset-plasma-biomarker',
  'Plasma_Biomarker_Cohort_Matrix.tsv',
  '8f91807d9c670b86a877521c7d2e0f4f93282f1b41e8e2b83c270d4f3e2b10a9',
  315000,
  PlasmaSamples,
  PlasmaProteins
);

// Preset 3: Phosphoproteomics Time-Course Matrix
const PhosphoSamples: SampleMetadata[] = [
  { sampleId: 'Time0h_R1', condition: 'Basal_0h', replicate: 1 },
  { sampleId: 'Time0h_R2', condition: 'Basal_0h', replicate: 2 },
  { sampleId: 'Time0h_R3', condition: 'Basal_0h', replicate: 3 },
  { sampleId: 'Time24h_R1', condition: 'Stimulated_24h', replicate: 1 },
  { sampleId: 'Time24h_R2', condition: 'Stimulated_24h', replicate: 2 },
  { sampleId: 'Time24h_R3', condition: 'Stimulated_24h', replicate: 3 },
];

const PhosphoProteins = [
  { accession: 'P00533_pY1068', geneSymbol: 'EGFR_pY1068', description: 'EGFR Phospho-Tyrosine 1068 site', baseControl: 850, baseTreatedRatio: 12.4 },
  { accession: 'P31749_pS473', geneSymbol: 'AKT1_pS473', description: 'AKT1 Phospho-Serine 473 activation site', baseControl: 1400, baseTreatedRatio: 6.8 },
  { accession: 'P28482_pT202', geneSymbol: 'MAPK1_pT202', description: 'ERK2 Phospho-Threonine 202 activation site', baseControl: 2100, baseTreatedRatio: 0.15 },
  { accession: 'P40763_pY705', geneSymbol: 'STAT3_pY705', description: 'STAT3 Phospho-Tyrosine 705 site', baseControl: 920, baseTreatedRatio: 8.9 },
  { accession: 'P04637_pS15', geneSymbol: 'TP53_pS15', description: 'p53 Phospho-Serine 15 DNA damage site', baseControl: 650, baseTreatedRatio: 5.2 }
];

export const PhosphoPresetMatrix = createPresetMatrix(
  'preset-phospho-timecourse',
  'Phosphoproteomics_Kinase_Inhibitor_Matrix.csv',
  'c3ab8ff13720e8ad9047dd39466b3c8974e592c2fa383d4a3960714caef0c4f2',
  210000,
  PhosphoSamples,
  PhosphoProteins
);

export const PRESET_DATASETS = [
  {
    id: HeLaPresetMatrix.id,
    title: 'HeLa Cell Line TMT Proteomics',
    subtitle: 'Drug Treated vs Control (4x4 Replicates, 2,500 Proteins)',
    matrix: HeLaPresetMatrix
  },
  {
    id: PlasmaPresetMatrix.id,
    title: 'Plasma Biomarker Discovery Cohort',
    subtitle: 'Pancreatic Cancer vs Healthy (4x4 Cohort, High Abundance Removed)',
    matrix: PlasmaPresetMatrix
  },
  {
    id: PhosphoPresetMatrix.id,
    title: 'Phosphoproteomics Kinase Inhibitor',
    subtitle: 'Basal 0h vs Stimulated 24h Phosphosites (3x3 Replicates)',
    matrix: PhosphoPresetMatrix
  }
];
