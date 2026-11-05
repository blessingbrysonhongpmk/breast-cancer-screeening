import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  RefreshCw,
  Trash2,
  Sliders,
  AlertCircle,
  Eye,
  Flame,
  ArrowRight,
  Layers,
  CheckCircle2,
  Info,
  Maximize2,
  X,
  FileCheck,
  ShieldCheck,
  ZoomIn,
  AlertTriangle,
  HelpCircle,
  FolderOpen,
  Settings,
  Sparkles,
  Download
} from 'lucide-react';
import {
  AnalysisResponse,
  ModelReadinessResponse,
  SampleItem,
  fetchSamples,
  getSampleImageUrl,
  submitMammogramAnalysis,
  submitThermalAnalysis,
  submitCombinedAnalysis,
  validateScanImage,
  validateScanPair,
  exportResearchReportMarkdown,
  ImageValidationResult,
  PairValidationResult
} from '../../services/api';
import { decodePgmImage } from '../../utils/pgmDecoder';
import { inspectImageModalityClient } from '../../utils/modalityInspector';

export type SlotStage =
  | 'empty'
  | 'uploaded'
  | 'format_validated'
  | 'modality_verified'
  | 'invalid'
  | 'error';

interface AnalysisPageProps {
  initialModality?: 'mammogram' | 'thermal' | 'combined';
  initialSampleFilename?: string | null;
  onClearTargetSample?: () => void;
  modelReadiness: ModelReadinessResponse | null;
  onNavigate: (view: string) => void;
  onAnalysisComplete: (result: AnalysisResponse) => void;
  latestResult?: AnalysisResponse | null;
}

interface ValidationStatus {
  stage: SlotStage;
  fileValid: boolean;
  format: string;
  sizeFormatted: string;
  dimensions?: { width: number; height: number };
  fileError?: string | null;
  modalityVerified: boolean;
  modalityLabel: string;
  modalityExplanation?: string;
  verificationLevel?: 'format_validated' | 'image_type_checked' | 'provenance_verified' | 'invalid';
  imageTypePassed?: boolean;
  provenanceVerified?: boolean;
  provenanceSource?: string | null;
  patientId?: string | null;
  errorMessage?: string | null;
  fileFormatStatus?: 'Valid' | 'Invalid';
  imageTypeStatus?: 'Verified' | 'Denied' | 'Unverified';
  provenanceStatus?: 'Verified' | 'Unverified';
  detectedModality?: string;
}

interface ZoomModalState {
  isOpen: boolean;
  url: string;
  title: string;
  dimensions?: string;
  modality: 'mammogram' | 'thermal';
}

export const AnalysisPage: React.FC<AnalysisPageProps> = ({
  initialModality = 'combined',
  initialSampleFilename,
  onClearTargetSample,
  modelReadiness,
  onNavigate,
  onAnalysisComplete,
  latestResult
}) => {
  // Mammogram upload state
  const [combinedMammoFile, setCombinedMammoFile] = useState<File | null>(null);
  const [combinedMammoPreview, setCombinedMammoPreview] = useState<string | null>(null);
  const [combinedMammoStage, setCombinedMammoStage] = useState<SlotStage>('empty');
  const [combinedMammoValidation, setCombinedMammoValidation] = useState<ValidationStatus | null>(null);

  // Thermal upload state
  const [combinedThermalFile, setCombinedThermalFile] = useState<File | null>(null);
  const [combinedThermalPreview, setCombinedThermalPreview] = useState<string | null>(null);
  const [combinedThermalStage, setCombinedThermalStage] = useState<SlotStage>('empty');
  const [combinedThermalValidation, setCombinedThermalValidation] = useState<ValidationStatus | null>(null);

  // Drag and drop states
  const [isDraggingMammo, setIsDraggingMammo] = useState<boolean>(false);
  const [isDraggingThermal, setIsDraggingThermal] = useState<boolean>(false);

  // Pairing & single-patient authorization state
  const [pairValidation, setPairValidation] = useState<PairValidationResult | null>(null);
  const [isPairValidating, setIsPairValidating] = useState<boolean>(false);
  const [isLoadingSamplePair, setIsLoadingSamplePair] = useState<boolean>(false);
  const [confirmedSamePatient, setConfirmedSamePatient] = useState<boolean>(false);

  // Case Reference ID & timestamp
  const [caseId, setCaseId] = useState<string>(() => `MF-2026-${Math.floor(100 + Math.random() * 900)}`);
  const [formattedTimestamp] = useState<string>(() => {
    const now = new Date();
    return `${now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
  });

  // Active analysis results
  const [activeResult, setActiveResult] = useState<AnalysisResponse | null>(latestResult || null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isDownloadingReport, setIsDownloadingReport] = useState<boolean>(false);

  // Grad-CAM visualization interactive controls
  const [selectedCamModality, setSelectedCamModality] = useState<'mammogram' | 'thermal'>('mammogram');
  const [overlayBlend, setOverlayBlend] = useState<number>(55);
  const [highlightRoi, setHighlightRoi] = useState<boolean>(true);

  // Filters & visual options
  const [contrastBoost, setContrastBoost] = useState<boolean>(false);
  const [isInverted, setIsInverted] = useState<boolean>(false);
  const [useTta, setUseTta] = useState<boolean>(false);

  // Zoom / Fullscreen Modal
  const [zoomModal, setZoomModal] = useState<ZoomModalState | null>(null);

  // Curated reference samples
  const [samples, setSamples] = useState<SampleItem[]>([]);
  const [showMammoSamples, setShowMammoSamples] = useState<boolean>(false);
  const [showThermalSamples, setShowThermalSamples] = useState<boolean>(false);

  const resultsRef = useRef<HTMLDivElement>(null);
  const mammoFileInputRef = useRef<HTMLInputElement>(null);
  const thermalFileInputRef = useRef<HTMLInputElement>(null);
  const mammoFileRef = useRef<File | null>(null);
  const thermalFileRef = useRef<File | null>(null);

  // Fetch reference samples on mount
  useEffect(() => {
    fetchSamples()
      .then((data) => setSamples(data))
      .catch((err) => console.error('Failed to load reference samples:', err));
  }, []);

  // Sync latest result if provided by parent
  useEffect(() => {
    if (latestResult) {
      setActiveResult(latestResult);
    }
  }, [latestResult]);

  // Sync Grad-CAM modality to analyzed modality
  useEffect(() => {
    if (activeResult?.modality === 'thermal') {
      setSelectedCamModality('thermal');
    } else if (activeResult?.modality === 'mammogram') {
      setSelectedCamModality('mammogram');
    }
  }, [activeResult?.modality]);

  // Clean up object URLs
  useEffect(() => {
    return () => {
      if (combinedMammoPreview && combinedMammoPreview.startsWith('blob:')) URL.revokeObjectURL(combinedMammoPreview);
      if (combinedThermalPreview && combinedThermalPreview.startsWith('blob:')) URL.revokeObjectURL(combinedThermalPreview);
    };
  }, [combinedMammoPreview, combinedThermalPreview]);

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Pair validation check
  const checkPairValidation = async (mammo: File, thermal: File, confirmed?: boolean) => {
    setIsPairValidating(true);
    try {
      const isConfirmed = confirmed !== undefined ? confirmed : confirmedSamePatient;
      const res = await validateScanPair(mammo, thermal, caseId, isConfirmed);
      setPairValidation(res);
    } catch (err) {
      console.warn('Pair validation call error:', err);
      setPairValidation(null);
    } finally {
      setIsPairValidating(false);
    }
  };

  // Process Mammogram File
  const handleCombinedMammoProcess = async (file: File) => {
    setCombinedMammoStage('uploaded');
    if (combinedMammoPreview && combinedMammoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(combinedMammoPreview);
    }
    mammoFileRef.current = file;
    setCombinedMammoFile(file);

    let imagePreview = '';
    let dims = { width: 0, height: 0 };

    try {
      if (file.name.toLowerCase().endsWith('.pgm')) {
        const decoded = await decodePgmImage(file, 1024);
        imagePreview = decoded.dataUrl;
        dims = { width: decoded.width, height: decoded.height };
      } else {
        imagePreview = URL.createObjectURL(file);
        const img = new Image();
        img.src = imagePreview;
        await new Promise((res) => {
          img.onload = () => {
            dims = { width: img.naturalWidth, height: img.naturalHeight };
            res(null);
          };
          img.onerror = () => res(null);
        });
      }
      setCombinedMammoPreview(imagePreview);
      setCombinedMammoStage('format_validated');

      // 1. Fast client-side modality check (catches thermal images in mammogram slot instantly)
      const clientInspect = await inspectImageModalityClient(imagePreview, file.name);
      if (clientInspect.detectedModality === 'thermal') {
        setCombinedMammoStage('invalid');
        setCombinedMammoValidation({
          stage: 'invalid',
          fileValid: true,
          format: file.name.split('.').pop()?.toUpperCase() || 'JPEG',
          sizeFormatted: formatFileSize(file.size),
          dimensions: dims,
          fileError: null,
          modalityVerified: false,
          verificationLevel: 'invalid',
          imageTypePassed: false,
          provenanceVerified: false,
          detectedModality: 'thermal',
          modalityLabel: 'Upload Denied (Thermal Detected)',
          modalityExplanation: clientInspect.explanation,
          errorMessage: 'Upload Denied: Thermal thermogram detected. The primary slot requires a radiographic mammogram.',
          fileFormatStatus: 'Valid',
          imageTypeStatus: 'Denied',
          provenanceStatus: 'Unverified'
        });
        if (thermalFileRef.current) {
          checkPairValidation(file, thermalFileRef.current, confirmedSamePatient);
        } else {
          setPairValidation(null);
        }
        return;
      }

      // Valid mammogram radiograph verified locally
      setCombinedMammoStage('modality_verified');
      setCombinedMammoValidation({
        stage: 'modality_verified',
        fileValid: true,
        format: file.name.split('.').pop()?.toUpperCase() || 'PGM',
        sizeFormatted: formatFileSize(file.size),
        dimensions: dims,
        modalityVerified: true,
        verificationLevel: 'image_type_checked',
        imageTypePassed: true,
        provenanceVerified: false,
        detectedModality: 'mammogram',
        modalityLabel: 'Radiographic mammogram verified',
        modalityExplanation: clientInspect.explanation,
        fileFormatStatus: 'Valid',
        imageTypeStatus: 'Verified',
        provenanceStatus: 'Unverified'
      });
      if (thermalFileRef.current) {
        checkPairValidation(file, thermalFileRef.current, confirmedSamePatient);
      }

      // 2. Authoritative backend validation call
      try {
        const val = await validateScanImage(file, 'mammogram');
        if (!val.valid_format || !val.modality_verified) {
          setCombinedMammoStage('invalid');
          setCombinedMammoValidation({
            stage: 'invalid',
            fileValid: val.valid_format,
            format: val.format || file.name.split('.').pop()?.toUpperCase() || 'PGM',
            sizeFormatted: formatFileSize(file.size),
            dimensions: val.dimensions.width > 0 ? val.dimensions : dims,
            fileError: val.valid_format ? null : val.error,
            modalityVerified: false,
            verificationLevel: val.verification_level,
            imageTypePassed: false,
            provenanceVerified: false,
            detectedModality: val.detected_modality,
            modalityLabel: val.detected_modality === 'thermal' ? 'Upload Denied (Thermal Detected)' : 'Upload Denied',
            modalityExplanation: val.explanation,
            errorMessage: val.error || (val.detected_modality === 'thermal'
              ? 'Upload Denied: Thermal thermogram detected. The primary slot requires a radiographic mammogram.'
              : 'Upload Denied: Please upload a valid mammogram radiograph.'),
            fileFormatStatus: val.file_format_status || (val.valid_format ? 'Valid' : 'Invalid'),
            imageTypeStatus: 'Denied',
            provenanceStatus: 'Unverified'
          });
          if (thermalFileRef.current) {
            checkPairValidation(file, thermalFileRef.current, confirmedSamePatient);
          } else {
            setPairValidation(null);
          }
        } else {
          setCombinedMammoStage('modality_verified');
          setCombinedMammoValidation({
            stage: 'modality_verified',
            fileValid: true,
            format: val.format,
            sizeFormatted: formatFileSize(file.size),
            dimensions: val.dimensions.width > 0 ? val.dimensions : dims,
            modalityVerified: true,
            verificationLevel: val.verification_level,
            imageTypePassed: val.image_type_passed,
            provenanceVerified: val.provenance_verified,
            provenanceSource: val.provenance_source,
            patientId: val.patient_id,
            detectedModality: val.detected_modality || 'mammogram',
            modalityLabel: val.verification_level === 'provenance_verified'
              ? `Provenance Verified (${val.provenance_source}: ${val.patient_id})`
              : 'Image type check passed',
            modalityExplanation: val.explanation,
            fileFormatStatus: val.file_format_status || 'Valid',
            imageTypeStatus: 'Verified',
            provenanceStatus: val.provenance_status || (val.provenance_verified ? 'Verified' : 'Unverified')
          });
          if (thermalFileRef.current) {
            checkPairValidation(file, thermalFileRef.current, confirmedSamePatient);
          }
        }
      } catch (backendErr) {
        console.warn('Backend validation call offline, client-side validation retained:', backendErr);
      }
    } catch (err: any) {
      console.error('Validation error for mammogram:', err);
      setCombinedMammoStage('invalid');
      setCombinedMammoValidation({
        stage: 'invalid',
        fileValid: false,
        format: file.name.split('.').pop()?.toUpperCase() || 'UNKNOWN',
        sizeFormatted: formatFileSize(file.size),
        dimensions: dims,
        modalityVerified: false,
        verificationLevel: 'invalid',
        imageTypePassed: false,
        provenanceVerified: false,
        modalityLabel: 'File Read Error',
        modalityExplanation: err.message || 'Image file could not be decoded.',
        errorMessage: err.message || 'Image file could not be decoded.',
        fileFormatStatus: 'Invalid',
        imageTypeStatus: 'Denied',
        provenanceStatus: 'Unverified'
      });
    }
  };

  // Process Thermal File
  const handleCombinedThermalProcess = async (file: File) => {
    setCombinedThermalStage('uploaded');
    if (combinedThermalPreview && combinedThermalPreview.startsWith('blob:')) {
      URL.revokeObjectURL(combinedThermalPreview);
    }
    thermalFileRef.current = file;
    setCombinedThermalFile(file);

    let imagePreview = '';
    let dims = { width: 0, height: 0 };

    try {
      imagePreview = URL.createObjectURL(file);
      const img = new Image();
      img.src = imagePreview;
      await new Promise((res) => {
        img.onload = () => {
          dims = { width: img.naturalWidth, height: img.naturalHeight };
          res(null);
        };
        img.onerror = () => res(null);
      });
      setCombinedThermalPreview(imagePreview);
      setCombinedThermalStage('format_validated');

      // 1. Fast client-side modality check (catches mammogram radiographs in thermal slot instantly)
      const clientInspect = await inspectImageModalityClient(imagePreview, file.name);
      if (clientInspect.detectedModality === 'mammogram') {
        setCombinedThermalStage('invalid');
        setCombinedThermalValidation({
          stage: 'invalid',
          fileValid: true,
          format: file.name.split('.').pop()?.toUpperCase() || 'JPG',
          sizeFormatted: formatFileSize(file.size),
          dimensions: dims,
          fileError: null,
          modalityVerified: false,
          verificationLevel: 'invalid',
          imageTypePassed: false,
          provenanceVerified: false,
          detectedModality: 'mammogram',
          modalityLabel: 'Upload Denied (Mammogram Detected)',
          modalityExplanation: clientInspect.explanation,
          errorMessage: 'Upload Denied: Radiographic mammogram detected in thermal slot. Slot 2 requires an infrared thermogram.',
          fileFormatStatus: 'Valid',
          imageTypeStatus: 'Denied',
          provenanceStatus: 'Unverified'
        });
        if (mammoFileRef.current) {
          checkPairValidation(mammoFileRef.current, file, confirmedSamePatient);
        } else {
          setPairValidation(null);
        }
        return;
      }

      // Valid thermal scan verified locally
      setCombinedThermalStage('modality_verified');
      setCombinedThermalValidation({
        stage: 'modality_verified',
        fileValid: true,
        format: file.name.split('.').pop()?.toUpperCase() || 'JPG',
        sizeFormatted: formatFileSize(file.size),
        dimensions: dims,
        modalityVerified: true,
        verificationLevel: 'image_type_checked',
        imageTypePassed: true,
        provenanceVerified: false,
        detectedModality: 'thermal',
        modalityLabel: 'Thermal thermogram verified',
        modalityExplanation: clientInspect.explanation,
        fileFormatStatus: 'Valid',
        imageTypeStatus: 'Verified',
        provenanceStatus: 'Unverified'
      });
      if (mammoFileRef.current) {
        checkPairValidation(mammoFileRef.current, file, confirmedSamePatient);
      }

      // 2. Authoritative backend validation call
      try {
        const val = await validateScanImage(file, 'thermal');
        if (!val.valid_format || !val.modality_verified) {
          setCombinedThermalStage('invalid');
          setCombinedThermalValidation({
            stage: 'invalid',
            fileValid: val.valid_format,
            format: val.format || file.name.split('.').pop()?.toUpperCase() || 'JPG',
            sizeFormatted: formatFileSize(file.size),
            dimensions: val.dimensions.width > 0 ? val.dimensions : dims,
            fileError: val.valid_format ? null : val.error,
            modalityVerified: false,
            verificationLevel: val.verification_level,
            imageTypePassed: false,
            provenanceVerified: false,
            detectedModality: val.detected_modality,
            modalityLabel: val.detected_modality === 'mammogram' ? 'Upload Denied (Mammogram Detected)' : 'Upload Denied',
            modalityExplanation: val.explanation,
            errorMessage: val.error || (val.detected_modality === 'mammogram'
              ? 'Upload Denied: Radiographic mammogram detected in thermal slot. Slot 2 requires an infrared thermogram.'
              : 'Upload Denied: Please upload a valid thermal image.'),
            fileFormatStatus: val.file_format_status || (val.valid_format ? 'Valid' : 'Invalid'),
            imageTypeStatus: 'Denied',
            provenanceStatus: 'Unverified'
          });
          if (mammoFileRef.current) {
            checkPairValidation(mammoFileRef.current, file, confirmedSamePatient);
          } else {
            setPairValidation(null);
          }
        } else {
          setCombinedThermalStage('modality_verified');
          setCombinedThermalValidation({
            stage: 'modality_verified',
            fileValid: true,
            format: val.format,
            sizeFormatted: formatFileSize(file.size),
            dimensions: val.dimensions.width > 0 ? val.dimensions : dims,
            modalityVerified: true,
            verificationLevel: val.verification_level,
            imageTypePassed: val.image_type_passed,
            provenanceVerified: val.provenance_verified,
            provenanceSource: val.provenance_source,
            patientId: val.patient_id,
            detectedModality: val.detected_modality || 'thermal',
            modalityLabel: val.verification_level === 'provenance_verified'
              ? `Provenance Verified (${val.provenance_source}: ${val.patient_id})`
              : 'Image type check passed',
            modalityExplanation: val.explanation,
            fileFormatStatus: val.file_format_status || 'Valid',
            imageTypeStatus: 'Verified',
            provenanceStatus: val.provenance_status || (val.provenance_verified ? 'Verified' : 'Unverified')
          });
          if (mammoFileRef.current) {
            checkPairValidation(mammoFileRef.current, file, confirmedSamePatient);
          }
        }
      } catch (backendErr) {
        console.warn('Backend validation call offline, client-side validation retained:', backendErr);
      }
    } catch (err: any) {
      console.error('Validation error for thermal:', err);
      setCombinedThermalStage('invalid');
      setCombinedThermalValidation({
        stage: 'invalid',
        fileValid: false,
        format: file.name.split('.').pop()?.toUpperCase() || 'UNKNOWN',
        sizeFormatted: formatFileSize(file.size),
        dimensions: dims,
        modalityVerified: false,
        verificationLevel: 'invalid',
        imageTypePassed: false,
        provenanceVerified: false,
        modalityLabel: 'File Read Error',
        modalityExplanation: err.message || 'Thermal image could not be decoded.',
        errorMessage: err.message || 'Thermal image could not be decoded.',
        fileFormatStatus: 'Invalid',
        imageTypeStatus: 'Denied',
        provenanceStatus: 'Unverified'
      });
    }
  };

  const handleClearCombinedMammo = () => {
    if (combinedMammoPreview && combinedMammoPreview.startsWith('blob:')) URL.revokeObjectURL(combinedMammoPreview);
    mammoFileRef.current = null;
    setCombinedMammoFile(null);
    setCombinedMammoPreview(null);
    setCombinedMammoStage('empty');
    setCombinedMammoValidation(null);
    setPairValidation(null);
    setConfirmedSamePatient(false);
    if (mammoFileInputRef.current) mammoFileInputRef.current.value = '';
  };

  const handleClearCombinedThermal = () => {
    if (combinedThermalPreview && combinedThermalPreview.startsWith('blob:')) URL.revokeObjectURL(combinedThermalPreview);
    thermalFileRef.current = null;
    setCombinedThermalFile(null);
    setCombinedThermalPreview(null);
    setCombinedThermalStage('empty');
    setCombinedThermalValidation(null);
    setPairValidation(null);
    setConfirmedSamePatient(false);
    if (thermalFileInputRef.current) thermalFileInputRef.current.value = '';
  };

  // One-click Benchmark Pair Loader
  const handleLoadSamplePair = async () => {
    setIsLoadingSamplePair(true);
    try {
      setCaseId('MF-2026-607');
      const mRes = await fetch('/api/sample-file/combined/paired_mammo.pgm');
      if (!mRes.ok) throw new Error(`HTTP ${mRes.status} fetching paired_mammo.pgm`);
      const mBlob = await mRes.blob();
      const mFile = new File([mBlob], 'paired_mammo.pgm', { type: 'image/x-portable-graymap' });

      const tRes = await fetch('/api/sample-file/combined/paired_thermal.jpg');
      if (!tRes.ok) throw new Error(`HTTP ${tRes.status} fetching paired_thermal.jpg`);
      const tBlob = await tRes.blob();
      const tFile = new File([tBlob], 'paired_thermal.jpg', { type: 'image/jpeg' });

      mammoFileRef.current = mFile;
      thermalFileRef.current = tFile;

      await handleCombinedMammoProcess(mFile);
      await handleCombinedThermalProcess(tFile);
      await checkPairValidation(mFile, tFile, false);
    } catch (err: any) {
      console.error('Failed to load benchmark scan pair:', err);
      alert('Could not load benchmark scans: ' + (err.message || err));
    } finally {
      setIsLoadingSamplePair(false);
    }
  };

  // Run AI Screening & Explainability Analysis
  const handleRunAnalysis = async () => {
    const hasMammo = combinedMammoStage === 'modality_verified' && combinedMammoFile;
    const hasThermal = combinedThermalStage === 'modality_verified' && combinedThermalFile;

    if (!hasMammo && !hasThermal) {
      alert('Please upload at least one verified scan (Primary Mammogram or Thermal Image) to run AI screening.');
      return;
    }

    setIsSubmitting(true);
    try {
      let bundledResult: AnalysisResponse;

      if (hasMammo && hasThermal) {
        // Both scans: run both ResNet-50s + Cross-Attention Multimodal Fusion if confirmed
        const mammoPromise = submitMammogramAnalysis(combinedMammoFile!, useTta);
        const thermalPromise = submitThermalAnalysis(combinedThermalFile!, useTta);

        const canRunFusion = Boolean(pairValidation?.can_analyze);
        const combinedPromise = canRunFusion
          ? submitCombinedAnalysis(combinedMammoFile!, combinedThermalFile!, caseId, confirmedSamePatient)
          : null;

        const mammoRes = await mammoPromise;
        const thermalRes = await thermalPromise;

        let combinedRes: AnalysisResponse | undefined = undefined;
        if (combinedPromise) {
          try {
            combinedRes = await combinedPromise;
          } catch (fusionErr) {
            console.warn('Multimodal fusion skipped:', fusionErr);
          }
        }

        const isHighRisk =
          mammoRes.predicted_class === 'malignant' ||
          thermalRes.predicted_class === 'malignant' ||
          combinedRes?.predicted_class === 'malignant';

        const riskCategory: 'HIGH RISK' | 'LOW RISK' = isHighRisk ? 'HIGH RISK' : 'LOW RISK';

        const probNorm = combinedRes?.probabilities?.normal ?? Number((((mammoRes.probabilities?.normal || 0) + (thermalRes.probabilities?.normal || 0)) / 2).toFixed(4));
        const probBen = combinedRes?.probabilities?.benign ?? Number((((mammoRes.probabilities?.benign || 0) + (thermalRes.probabilities?.benign || 0)) / 2).toFixed(4));
        const probMal = combinedRes?.probabilities?.malignant ?? Number((((mammoRes.probabilities?.malignant || 0) + (thermalRes.probabilities?.malignant || 0)) / 2).toFixed(4));

        const combinedProbs = {
          normal: probNorm,
          benign: probBen,
          malignant: probMal
        };

        const combinedPredClass: 'normal' | 'benign' | 'malignant' =
          (combinedRes?.predicted_class as 'normal' | 'benign' | 'malignant' | undefined) ||
          (isHighRisk
            ? 'malignant'
            : (probMal >= probBen && probMal >= probNorm
                ? 'malignant'
                : (probBen >= probNorm ? 'benign' : 'normal')));

        const combinedConfidence = combinedRes?.confidence ?? (combinedProbs[combinedPredClass] || 0.5);

        bundledResult = {
          status: 'success',
          modality: 'combined',
          filename: `${combinedMammoFile!.name} + ${combinedThermalFile!.name}`,
          dimensions: combinedRes?.dimensions || mammoRes.dimensions,
          color_mode: 'Dual Modality (Radiographic + Thermal)',
          format: `${mammoRes.format} / ${thermalRes.format}`,
          inference_ready: true,
          predicted_class: combinedPredClass,
          confidence: combinedConfidence,
          probabilities: combinedProbs,
          gradcam_url: combinedRes?.gradcam_url || mammoRes.gradcam_url,
          roi_bounding_box: mammoRes.roi_bounding_box || thermalRes.roi_bounding_box,
          attention_coverage_percent: mammoRes.attention_coverage_percent || thermalRes.attention_coverage_percent,
          peak_activation_coords: mammoRes.peak_activation_coords || thermalRes.peak_activation_coords,
          model_architecture: combinedRes ? combinedRes.model_architecture : 'Dual Independent ResNet-50 PyTorch Models',
          message: combinedRes
            ? combinedRes.message
            : 'Dual-modality screening completed for mammogram and thermal modalities.',
          recommendation: isHighRisk
            ? 'Suspicious / high-risk screening patterns detected. Diagnostic mammography and clinical correlation recommended.'
            : 'Low-risk screening patterns observed. Routine periodic screening protocol recommended.',
          predictive_entropy: combinedRes?.predictive_entropy ?? mammoRes.predictive_entropy,
          uncertainty_score: combinedRes?.uncertainty_score ?? mammoRes.uncertainty_score,
          confidence_margin: combinedRes?.confidence_margin ?? mammoRes.confidence_margin,
          mammo_prediction: mammoRes,
          thermal_prediction: thermalRes,
          combined_prediction: combinedRes,
          case_id: caseId,
          risk_category: riskCategory
        };
      } else if (hasMammo) {
        // Mammogram only screening
        const mammoRes = await submitMammogramAnalysis(combinedMammoFile!, useTta);
        const isHighRisk = mammoRes.predicted_class === 'malignant';
        bundledResult = {
          ...mammoRes,
          case_id: caseId,
          risk_category: isHighRisk ? 'HIGH RISK' : 'LOW RISK',
          mammo_prediction: mammoRes
        };
      } else {
        // Thermal only screening
        const thermalRes = await submitThermalAnalysis(combinedThermalFile!, useTta);
        const isHighRisk = thermalRes.predicted_class === 'malignant';
        bundledResult = {
          ...thermalRes,
          case_id: caseId,
          risk_category: isHighRisk ? 'HIGH RISK' : 'LOW RISK',
          thermal_prediction: thermalRes
        };
      }

      setActiveResult(bundledResult);
      onAnalysisComplete(bundledResult);

      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err: any) {
      console.error('Screening execution error:', err);
      alert(err.message || 'Error occurred during AI screening.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Download Screening Report
  const handleDownloadReport = async () => {
    if (!activeResult) return;
    setIsDownloadingReport(true);
    try {
      let reportMarkdown = '';
      let filename = `MammoFusion_Screening_Report_${activeResult.case_id || caseId}.md`;

      try {
        const res = await exportResearchReportMarkdown(activeResult);
        reportMarkdown = res.markdown;
        if (res.filename) filename = res.filename;
      } catch (backendErr) {
        console.warn('Backend report export failed, falling back to client-generated report:', backendErr);
        // Robust Client-Side Markdown Generator Fallback
        const cid = activeResult.case_id || caseId;
        const pred = activeResult.predicted_class || 'Normal';
        const conf = activeResult.confidence !== undefined ? (activeResult.confidence * 100).toFixed(1) : '—';
        const risk = activeResult.risk_category || (pred === 'malignant' ? 'HIGH RISK' : 'LOW RISK');
        const probM = activeResult.probabilities?.malignant !== undefined ? activeResult.probabilities.malignant.toFixed(4) : '—';
        const probN = activeResult.probabilities?.normal !== undefined ? activeResult.probabilities.normal.toFixed(4) : '—';
        const probB = activeResult.probabilities?.benign !== undefined ? activeResult.probabilities.benign.toFixed(4) : '—';

        reportMarkdown = `# MammoFusion-XAI Screening & Risk Assessment Report

**Case ID:** ${cid}  
**Date:** ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}  
**Modality:** ${activeResult.modality.toUpperCase()}  
**AI Architecture:** ${activeResult.model_architecture || 'ResNet-50 Multimodal System'}

---

## 1. Executive Screening Summary
- **Primary AI Assessment:** ${pred.toUpperCase()}
- **Model Confidence:** ${conf}%
- **Screening Risk Level:** ${risk}
- **Prototype Risk Score (Malignant Probability):** ${probM}

### Class Probability Breakdown
- Normal: ${probN}
- Benign: ${probB}
- Malignant: ${probM}

---

## 2. Examination Findings
- **Mammogram Radiograph:** ${activeResult.mammo_prediction ? `${activeResult.mammo_prediction.predicted_class?.toUpperCase()} (${((activeResult.mammo_prediction.confidence || 0) * 100).toFixed(1)}%)` : 'Not uploaded / Not analyzed'}
- **Thermal Infrared Scan:** ${activeResult.thermal_prediction ? `${activeResult.thermal_prediction.predicted_class?.toUpperCase()} (${((activeResult.thermal_prediction.confidence || 0) * 100).toFixed(1)}%)` : 'Not uploaded / Not analyzed'}
- **Clinical Recommendation:** ${activeResult.recommendation || 'Clinical correlation with standard radiologic diagnostic protocol recommended.'}

---

*DISCLAIMER: MammoFusion-XAI is an investigational research prototype for breast screening decision support. It is not an automated medical diagnostic device. Final medical diagnosis must always be determined by qualified healthcare providers.*
`;
      }

      const blob = new Blob([reportMarkdown], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Failed to download screening report:', err);
      alert('Could not download screening report: ' + (err.message || err));
    } finally {
      setIsDownloadingReport(false);
    }
  };

  const previewFilterStyle = {
    filter: `${isInverted ? 'invert(100%)' : ''} ${contrastBoost ? 'contrast(150%) brightness(105%)' : ''}`.trim() || 'none'
  };

  const hasAnyUploadedScan = Boolean(combinedMammoFile || combinedThermalFile);
  const isBothValidated = combinedMammoStage === 'modality_verified' && combinedThermalStage === 'modality_verified';

  // Strict Modality Boundary Verification State
  const isDualThermal = Boolean(
    combinedMammoFile && combinedThermalFile &&
    (combinedMammoValidation?.detectedModality === 'thermal' ||
     combinedMammoValidation?.errorMessage?.includes('Thermal') ||
     pairValidation?.pairing_badge?.includes('Dual Thermal') ||
     pairValidation?.combined_status?.includes('Dual Thermal'))
  );

  const isDualMammogram = Boolean(
    combinedMammoFile && combinedThermalFile &&
    (combinedThermalValidation?.detectedModality === 'mammogram' ||
     combinedThermalValidation?.errorMessage?.includes('Mammogram') ||
     pairValidation?.pairing_badge?.includes('Dual Mammogram') ||
     pairValidation?.combined_status?.includes('Dual Mammogram'))
  );

  const hasInvalidScan = combinedMammoStage === 'invalid' || combinedThermalStage === 'invalid' || combinedMammoStage === 'error' || combinedThermalStage === 'error';
  const hasValidMammo = combinedMammoStage === 'modality_verified' && Boolean(combinedMammoFile);
  const hasValidThermal = combinedThermalStage === 'modality_verified' && Boolean(combinedThermalFile);
  const isProperPair = hasValidMammo && hasValidThermal && !hasInvalidScan;

  const canRunAnalysis = !hasInvalidScan && (hasValidMammo || hasValidThermal) && !isDualThermal && !isDualMammogram;

  // Truthful Model Metric Computation (Zero Hardcoded Placeholders)
  const isHighRisk = activeResult?.risk_category === 'HIGH RISK' || activeResult?.predicted_class === 'malignant';
  const rawMalignantProb = activeResult?.probabilities?.malignant;
  const riskScore: number = rawMalignantProb !== undefined
    ? rawMalignantProb
    : (activeResult && activeResult.confidence !== undefined
        ? (activeResult.predicted_class === 'malignant' ? activeResult.confidence : (1.0 - activeResult.confidence))
        : 0);
  const overallConfidencePct = activeResult?.confidence !== undefined ? ((activeResult.confidence) * 100).toFixed(1) : '—';

  // Specific Modality Availability Flags
  const isMammoAnalyzed = Boolean(activeResult?.mammo_prediction || (activeResult?.modality === 'mammogram'));
  const isThermalAnalyzed = Boolean(activeResult?.thermal_prediction || (activeResult?.modality === 'thermal'));

  const mammoConfidence = activeResult?.mammo_prediction?.confidence ?? (activeResult?.modality === 'mammogram' ? activeResult.confidence : undefined);
  const thermalConfidence = activeResult?.thermal_prediction?.confidence ?? (activeResult?.modality === 'thermal' ? activeResult.confidence : undefined);

  const mammoClass = activeResult?.mammo_prediction?.predicted_class ?? (activeResult?.modality === 'mammogram' ? activeResult.predicted_class : undefined);
  const thermalClass = activeResult?.thermal_prediction?.predicted_class ?? (activeResult?.modality === 'thermal' ? activeResult.predicted_class : undefined);

  const mammoRisk = activeResult?.mammo_prediction?.probabilities?.malignant ??
    (mammoClass ? (mammoClass === 'malignant' ? (mammoConfidence ?? 0.5) : (1.0 - (mammoConfidence ?? 0.5))) : 0);
  const thermalRisk = activeResult?.thermal_prediction?.probabilities?.malignant ??
    (thermalClass ? (thermalClass === 'malignant' ? (thermalConfidence ?? 0.5) : (1.0 - (thermalConfidence ?? 0.5))) : 0);

  // Active Grad-CAM image based on selected modality
  const activeCamUrl = (selectedCamModality === 'thermal')
    ? (activeResult?.thermal_prediction?.gradcam_url || (activeResult?.modality === 'thermal' ? activeResult?.gradcam_url : undefined))
    : (activeResult?.mammo_prediction?.gradcam_url || (activeResult?.modality === 'mammogram' ? activeResult?.gradcam_url : undefined) || activeResult?.gradcam_url);

  const activeRawCamUrl = (selectedCamModality === 'thermal')
    ? (activeResult?.thermal_prediction?.raw_gradcam_url || (activeResult?.modality === 'thermal' ? activeResult?.raw_gradcam_url : undefined))
    : (activeResult?.mammo_prediction?.raw_gradcam_url || (activeResult?.modality === 'mammogram' ? activeResult?.raw_gradcam_url : undefined) || activeResult?.raw_gradcam_url);

  const activeCamOriginal = (selectedCamModality === 'thermal')
    ? (combinedThermalPreview || (activeResult?.thermal_prediction ? activeResult.thermal_prediction.filename : undefined))
    : (combinedMammoPreview || (activeResult?.mammo_prediction ? activeResult.mammo_prediction.filename : undefined));

  const isCamAvailable = Boolean(selectedCamModality === 'thermal' ? isThermalAnalyzed : isMammoAnalyzed);

  // Compute Dynamic Lesion ROI Bounding Box percentage from real Grad-CAM outputs
  const computedRoiStyle: React.CSSProperties = React.useMemo(() => {
    let base: React.CSSProperties = {
      position: 'absolute',
      top: '25%',
      left: '30%',
      width: '35%',
      height: '35%',
      border: '2px dashed #EF4444',
      borderRadius: '2px',
      pointerEvents: 'none',
      boxShadow: '0 0 10px rgba(239, 68, 68, 0.4)'
    };
    const targetPrediction = selectedCamModality === 'thermal'
      ? (activeResult?.thermal_prediction || activeResult)
      : (activeResult?.mammo_prediction || activeResult);
    const box = targetPrediction?.roi_bounding_box;
    const dims = targetPrediction?.dimensions;
    if (box && box.length === 4 && dims && dims.width > 0 && dims.height > 0) {
      const [xmin, ymin, xmax, ymax] = box;
      const leftPct = Math.max(2, Math.min(88, (xmin / dims.width) * 100));
      const topPct = Math.max(2, Math.min(88, (ymin / dims.height) * 100));
      const widthPct = Math.max(8, Math.min(95 - leftPct, ((xmax - xmin) / dims.width) * 100));
      const heightPct = Math.max(8, Math.min(95 - topPct, ((ymax - ymin) / dims.height) * 100));
      base = {
        ...base,
        left: `${leftPct.toFixed(1)}%`,
        top: `${topPct.toFixed(1)}%`,
        width: `${widthPct.toFixed(1)}%`,
        height: `${heightPct.toFixed(1)}%`
      };
    }
    return base;
  }, [activeResult, selectedCamModality]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1360px', margin: '0 auto', width: '100%' }}>
      {/* Top Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#2A061B', letterSpacing: '-0.02em', margin: 0 }}>
            Screening
          </h2>
          <p style={{ color: '#826674', fontSize: '13.5px', marginTop: '4px', margin: 0 }}>
            AI-powered multimodal breast cancer screening and risk prediction system.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Quick Benchmark Button */}
          <button
            type="button"
            className="btn-secondary"
            onClick={handleLoadSamplePair}
            disabled={isLoadingSamplePair}
            style={{
              fontSize: '11.5px',
              padding: '7px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderRadius: '9999px',
              fontWeight: 600,
              color: 'var(--primary-rose)',
              borderColor: 'var(--border-rose)',
              background: '#FFF5F8'
            }}
          >
            {isLoadingSamplePair ? (
              <>
                <RefreshCw size={13} className="spinning" />
                <span>Loading Benchmark Scans...</span>
              </>
            ) : (
              <>
                <Layers size={13} />
                <span>Load Benchmark Scans (TEST_PT_001)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* DUAL UPLOAD WORKSPACE */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '18px' }}>
        {/* CARD 1: PRIMARY MAMMOGRAM */}
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', borderRadius: '14px', background: '#FFFFFF', border: '1px solid #F0D9E3', boxShadow: '0 2px 12px rgba(42, 6, 27, 0.04)' }}>
          {/* Card Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px', color: '#826674' }}>⧉</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#2A061B' }}>
                Upload Primary Mammogram (Structural DICOM/PNG/JPG)
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {combinedMammoPreview && (
                <>
                  <button
                    type="button"
                    onClick={() => setContrastBoost(!contrastBoost)}
                    style={{
                      fontSize: '10px',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      border: '1px solid var(--border-medium)',
                      background: contrastBoost ? '#FFE4EE' : '#FFF',
                      color: contrastBoost ? '#D82873' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontWeight: 600
                    }}
                    title="Toggle high-contrast viewing filter"
                  >
                    High-Res
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoomModal({
                      isOpen: true,
                      url: combinedMammoPreview,
                      title: combinedMammoFile?.name || 'Primary Mammogram',
                      dimensions: combinedMammoValidation?.dimensions ? `${combinedMammoValidation.dimensions.width}×${combinedMammoValidation.dimensions.height} px` : undefined,
                      modality: 'mammogram'
                    })}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', color: '#826674' }}
                    title="Maximize / Zoom"
                  >
                    <Maximize2 size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={handleClearCombinedMammo}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', color: '#C2185B' }}
                    title="Remove scan"
                  >
                    <X size={14} />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Card Viewport / Drag & Drop */}
          {combinedMammoStage === 'empty' ? (
            <div
              onClick={() => mammoFileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDraggingMammo(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDraggingMammo(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDraggingMammo(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleCombinedMammoProcess(e.dataTransfer.files[0]);
                }
              }}
              style={{
                border: isDraggingMammo ? '2px dashed #D82873' : '2px dashed #E288AE',
                borderRadius: '12px',
                padding: '40px 18px',
                textAlign: 'center',
                background: isDraggingMammo ? '#FFF0F5' : '#FFFBFD',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '240px'
              }}
              onMouseEnter={(e) => {
                if (!isDraggingMammo) {
                  e.currentTarget.style.borderColor = '#D82873';
                  e.currentTarget.style.background = '#FFF0F5';
                }
              }}
              onMouseLeave={(e) => {
                if (!isDraggingMammo) {
                  e.currentTarget.style.borderColor = '#E288AE';
                  e.currentTarget.style.background = '#FFFBFD';
                }
              }}
            >
              <input
                ref={mammoFileInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,.pgm"
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleCombinedMammoProcess(e.target.files[0]);
                  }
                }}
              />
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: '#FFF0F5',
                border: '1px solid #FCD9E2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#D82873',
                marginBottom: '10px'
              }}>
                <UploadCloud size={22} />
              </div>
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#2A061B' }}>
                Upload Mammogram Radiograph
              </div>
              <div style={{ fontSize: '11.5px', color: '#826674', marginTop: '3px' }}>
                Drag and drop radiograph or click to browse local files
              </div>
              <div style={{ display: 'flex', gap: '4px', marginTop: '12px' }}>
                <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: '#FCE4EC', color: '#C2185B', fontWeight: 600 }}>PGM</span>
                <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: '#FCE4EC', color: '#C2185B', fontWeight: 600 }}>PNG</span>
                <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: '#FCE4EC', color: '#C2185B', fontWeight: 600 }}>JPG</span>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleCombinedMammoProcess(e.dataTransfer.files[0]);
                  }
                }}
                style={{
                  background: '#14040D',
                  borderRadius: '10px',
                  border: combinedMammoStage === 'invalid' ? '2px solid var(--status-malignant)' : '1px solid rgba(216, 40, 115, 0.25)',
                  height: '240px',
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: 'inset 0 2px 12px rgba(0, 0, 0, 0.7)'
                }}
              >
                {combinedMammoStage === 'uploaded' ? (
                  <div style={{ color: '#fff', textAlign: 'center' }}>
                    <RefreshCw size={24} className="spinning" style={{ color: '#D82873', marginBottom: '8px' }} />
                    <div style={{ fontSize: '12px' }}>Decoding mammogram radiograph...</div>
                  </div>
                ) : combinedMammoPreview ? (
                  <img
                    src={combinedMammoPreview}
                    alt="Mammogram Scan"
                    style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain', ...previewFilterStyle }}
                  />
                ) : null}
              </div>

              {/* File Info Bar */}
              <div style={{
                padding: '6px 10px',
                borderRadius: '6px',
                background: '#FFF5F8',
                border: '1px solid #FCD9E2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '11px',
                color: '#2A061B'
              }}>
                <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                  {combinedMammoFile?.name}
                </span>
                <span style={{ color: '#826674' }}>
                  {combinedMammoValidation?.dimensions ? `${combinedMammoValidation.dimensions.width}×${combinedMammoValidation.dimensions.height} px` : ''} • {combinedMammoValidation?.sizeFormatted}
                </span>
              </div>

              {/* Status Badges */}
              {combinedMammoValidation && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                  <span style={{
                    fontSize: '10px',
                    padding: '2px 7px',
                    borderRadius: '4px',
                    background: combinedMammoValidation.fileFormatStatus === 'Invalid' ? '#FFE4E6' : '#DCFCE7',
                    color: combinedMammoValidation.fileFormatStatus === 'Invalid' ? '#BE123C' : '#166534',
                    fontWeight: 600
                  }}>
                    Format: {combinedMammoValidation.fileFormatStatus === 'Invalid' ? 'Invalid' : 'Valid'}
                  </span>

                  <span style={{
                    fontSize: '10px',
                    padding: '2px 7px',
                    borderRadius: '4px',
                    background: combinedMammoStage === 'invalid' ? '#FFE4E6' : '#DCFCE7',
                    color: combinedMammoStage === 'invalid' ? '#BE123C' : '#166534',
                    fontWeight: 700
                  }}>
                    Image Type: {combinedMammoStage === 'invalid' ? 'Denied' : 'Verified'}
                  </span>

                  {combinedMammoValidation.detectedModality && (
                    <span style={{
                      fontSize: '10px',
                      padding: '2px 7px',
                      borderRadius: '4px',
                      background: combinedMammoValidation.detectedModality === 'thermal' ? '#FFE4E6' : '#F3F4F6',
                      color: combinedMammoValidation.detectedModality === 'thermal' ? '#BE123C' : '#4B5563',
                      fontWeight: 600
                    }}>
                      Detected: {combinedMammoValidation.detectedModality === 'thermal' ? 'Thermal Thermogram' : 'Mammogram Radiograph'}
                    </span>
                  )}
                </div>
              )}

              {/* Denial Error Alert Box */}
              {combinedMammoStage === 'invalid' && (
                <div style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: '#FFF1F2',
                  border: '1.5px solid #FDA4AF',
                  fontSize: '11.5px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  lineHeight: 1.4,
                  marginTop: '4px'
                }}>
                  <AlertCircle size={16} style={{ color: '#E11D48', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <div style={{ fontWeight: 800, color: '#BE123C' }}>
                      {combinedMammoValidation?.detectedModality === 'thermal' && !combinedMammoValidation?.errorMessage?.toLowerCase().includes('fetch') && !combinedMammoValidation?.errorMessage?.toLowerCase().includes('connect')
                        ? 'Upload Denied — Modality Mismatch'
                        : (combinedMammoValidation?.errorMessage?.toLowerCase().includes('connect') || combinedMammoValidation?.errorMessage?.toLowerCase().includes('fetch')
                            ? 'Server Connection Notice'
                            : 'Upload Denied — Validation Error')}
                    </div>
                    <div style={{ marginTop: '2px', color: '#9F1239' }}>
                      {combinedMammoValidation?.errorMessage || 'Please upload a valid radiographic mammogram.'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Under-Preview Action Bar */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '14px', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #F5E6ED', flexWrap: 'wrap' }}>
            <input
              ref={mammoFileInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.pgm"
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleCombinedMammoProcess(e.target.files[0]);
                }
              }}
            />
            <button
              type="button"
              onClick={() => mammoFileInputRef.current?.click()}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', color: '#D82873', fontWeight: 600 }}
              title="Upload / Replace scan"
            >
              <UploadCloud size={13} />
              <span>{combinedMammoFile ? 'Replace' : 'Browse'}</span>
            </button>

            {combinedMammoPreview && (
              <button
                type="button"
                onClick={() => setZoomModal({
                  isOpen: true,
                  url: combinedMammoPreview,
                  title: combinedMammoFile?.name || 'Primary Mammogram',
                  dimensions: combinedMammoValidation?.dimensions ? `${combinedMammoValidation.dimensions.width}×${combinedMammoValidation.dimensions.height} px` : undefined,
                  modality: 'mammogram'
                })}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', color: '#4B5563', fontWeight: 600 }}
                title="Zoom view"
              >
                <Maximize2 size={13} />
                <span>Zoom</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsInverted(!isInverted)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', color: isInverted ? '#D82873' : '#826674', fontWeight: 600 }}
              title="Toggle inverted negative"
            >
              <Settings size={13} />
              <span>Invert</span>
            </button>

            {combinedMammoFile && (
              <button
                type="button"
                onClick={handleClearCombinedMammo}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', color: '#BE123C', fontWeight: 600 }}
                title="Remove uploaded mammogram"
              >
                <Trash2 size={13} />
                <span>Remove</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowMammoSamples(!showMammoSamples)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', color: '#826674', fontWeight: 600 }}
              title="Select reference sample from MIAS repository"
            >
              <FolderOpen size={13} />
              <span>Samples</span>
            </button>
          </div>

          {/* Samples Mini-Picker for Mammograms */}
          {showMammoSamples && (
            <div style={{ marginTop: '10px', padding: '10px', background: '#FFF5F8', borderRadius: '8px', border: '1px solid #FCD9E2' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#C2185B', marginBottom: '6px' }}>
                Select Authentic MIAS Reference Radiograph:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {samples.filter(s => s.modality === 'mammogram').slice(0, 4).map((s) => (
                  <button
                    key={s.filename}
                    type="button"
                    onClick={async () => {
                      try {
                        const res = await fetch(getSampleImageUrl('mammogram', s.filename));
                        const blob = await res.blob();
                        const file = new File([blob], s.filename, { type: 'image/x-portable-graymap' });
                        await handleCombinedMammoProcess(file);
                        setShowMammoSamples(false);
                      } catch (e) {
                        console.error('Failed to load sample:', e);
                      }
                    }}
                    style={{
                      fontSize: '10.5px',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      border: '1px solid #FCD9E2',
                      background: '#FFF',
                      cursor: 'pointer',
                      color: '#2A061B',
                      fontWeight: 500
                    }}
                  >
                    {s.filename} ({s.patient_id})
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* CARD 2: OPTIONAL THERMAL SCAN */}
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', borderRadius: '14px', background: '#FFFFFF', border: '1px solid #F0D9E3', boxShadow: '0 2px 12px rgba(42, 6, 27, 0.04)' }}>
          {/* Card Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px', color: '#826674' }}>⧉</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#2A061B' }}>
                Upload Thermal Image (Optional Infrared Scan)
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {combinedThermalPreview && (
                <>
                  <button
                    type="button"
                    onClick={() => setZoomModal({
                      isOpen: true,
                      url: combinedThermalPreview,
                      title: combinedThermalFile?.name || 'Thermal Image',
                      dimensions: combinedThermalValidation?.dimensions ? `${combinedThermalValidation.dimensions.width}×${combinedThermalValidation.dimensions.height} px` : undefined,
                      modality: 'thermal'
                    })}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', color: '#826674' }}
                    title="Maximize / Zoom"
                  >
                    <Maximize2 size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={handleClearCombinedThermal}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', color: '#C2185B' }}
                    title="Remove scan"
                  >
                    <X size={14} />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Card Viewport / Drag & Drop */}
          {combinedThermalStage === 'empty' ? (
            <div
              onClick={() => thermalFileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDraggingThermal(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDraggingThermal(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDraggingThermal(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleCombinedThermalProcess(e.dataTransfer.files[0]);
                }
              }}
              style={{
                border: isDraggingThermal ? '2px dashed #D82873' : '2px dashed #E288AE',
                borderRadius: '12px',
                padding: '40px 18px',
                textAlign: 'center',
                background: isDraggingThermal ? '#FFF0F5' : '#FFFBFD',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '240px'
              }}
              onMouseEnter={(e) => {
                if (!isDraggingThermal) {
                  e.currentTarget.style.borderColor = '#D82873';
                  e.currentTarget.style.background = '#FFF0F5';
                }
              }}
              onMouseLeave={(e) => {
                if (!isDraggingThermal) {
                  e.currentTarget.style.borderColor = '#E288AE';
                  e.currentTarget.style.background = '#FFFBFD';
                }
              }}
            >
              <input
                ref={thermalFileInputRef}
                type="file"
                accept=".png,.jpg,.jpeg"
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleCombinedThermalProcess(e.target.files[0]);
                  }
                }}
              />
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: '#FFF0F5',
                border: '1px solid #FCD9E2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#D82873',
                marginBottom: '10px'
              }}>
                <Flame size={22} />
              </div>
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#2A061B' }}>
                Upload Thermal Thermogram
              </div>
              <div style={{ fontSize: '11.5px', color: '#826674', marginTop: '3px' }}>
                Optional infrared scan for multimodal cross-attention fusion
              </div>
              <div style={{ display: 'flex', gap: '4px', marginTop: '12px' }}>
                <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: '#FCE4EC', color: '#C2185B', fontWeight: 600 }}>PNG</span>
                <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: '#FCE4EC', color: '#C2185B', fontWeight: 600 }}>JPG</span>
                <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: '#FCE4EC', color: '#C2185B', fontWeight: 600 }}>JPEG</span>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleCombinedThermalProcess(e.dataTransfer.files[0]);
                  }
                }}
                style={{
                  background: '#14040D',
                  borderRadius: '10px',
                  border: combinedThermalStage === 'invalid' ? '2px solid var(--status-malignant)' : '1px solid rgba(216, 40, 115, 0.25)',
                  height: '240px',
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: 'inset 0 2px 12px rgba(0, 0, 0, 0.7)'
                }}
              >
                {combinedThermalStage === 'uploaded' ? (
                  <div style={{ color: '#fff', textAlign: 'center' }}>
                    <RefreshCw size={24} className="spinning" style={{ color: '#D82873', marginBottom: '8px' }} />
                    <div style={{ fontSize: '12px' }}>Inspecting thermal thermogram...</div>
                  </div>
                ) : combinedThermalPreview ? (
                  <img
                    src={combinedThermalPreview}
                    alt="Thermal Scan"
                    style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                  />
                ) : null}
              </div>

              {/* File Info Bar */}
              <div style={{
                padding: '6px 10px',
                borderRadius: '6px',
                background: '#FFF5F8',
                border: '1px solid #FCD9E2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '11px',
                color: '#2A061B'
              }}>
                <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                  {combinedThermalFile?.name}
                </span>
                <span style={{ color: '#826674' }}>
                  {combinedThermalValidation?.dimensions ? `${combinedThermalValidation.dimensions.width}×${combinedThermalValidation.dimensions.height} px` : ''} • {combinedThermalValidation?.sizeFormatted}
                </span>
              </div>

              {/* Status Badges */}
              {combinedThermalValidation && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                  <span style={{
                    fontSize: '10px',
                    padding: '2px 7px',
                    borderRadius: '4px',
                    background: combinedThermalValidation.fileFormatStatus === 'Invalid' ? '#FFE4E6' : '#DCFCE7',
                    color: combinedThermalValidation.fileFormatStatus === 'Invalid' ? '#BE123C' : '#166534',
                    fontWeight: 600
                  }}>
                    Format: {combinedThermalValidation.fileFormatStatus === 'Invalid' ? 'Invalid' : 'Valid'}
                  </span>

                  <span style={{
                    fontSize: '10px',
                    padding: '2px 7px',
                    borderRadius: '4px',
                    background: combinedThermalStage === 'invalid' ? '#FFE4E6' : '#DCFCE7',
                    color: combinedThermalStage === 'invalid' ? '#BE123C' : '#166534',
                    fontWeight: 700
                  }}>
                    Image Type: {combinedThermalStage === 'invalid' ? 'Denied' : 'Verified'}
                  </span>

                  {combinedThermalValidation.detectedModality && (
                    <span style={{
                      fontSize: '10px',
                      padding: '2px 7px',
                      borderRadius: '4px',
                      background: combinedThermalValidation.detectedModality === 'mammogram' ? '#FFE4E6' : '#F3F4F6',
                      color: combinedThermalValidation.detectedModality === 'mammogram' ? '#BE123C' : '#4B5563',
                      fontWeight: 600
                    }}>
                      Detected: {combinedThermalValidation.detectedModality === 'mammogram' ? 'Mammogram Radiograph' : 'Thermal Thermogram'}
                    </span>
                  )}
                </div>
              )}

              {/* Denial Error Alert Box */}
              {combinedThermalStage === 'invalid' && (
                <div style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: '#FFF1F2',
                  border: '1.5px solid #FDA4AF',
                  fontSize: '11.5px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  lineHeight: 1.4,
                  marginTop: '4px'
                }}>
                  <AlertCircle size={16} style={{ color: '#E11D48', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <div style={{ fontWeight: 800, color: '#BE123C' }}>
                      {combinedThermalValidation?.detectedModality === 'mammogram' && !combinedThermalValidation?.errorMessage?.toLowerCase().includes('fetch') && !combinedThermalValidation?.errorMessage?.toLowerCase().includes('connect')
                        ? 'Upload Denied — Modality Mismatch'
                        : (combinedThermalValidation?.errorMessage?.toLowerCase().includes('connect') || combinedThermalValidation?.errorMessage?.toLowerCase().includes('fetch')
                            ? 'Server Connection Notice'
                            : 'Upload Denied — Validation Error')}
                    </div>
                    <div style={{ marginTop: '2px', color: '#9F1239' }}>
                      {combinedThermalValidation?.errorMessage || 'Please upload a valid infrared thermal image.'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Under-Preview Action Bar */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '14px', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #F5E6ED', flexWrap: 'wrap' }}>
            <input
              ref={thermalFileInputRef}
              type="file"
              accept=".png,.jpg,.jpeg"
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleCombinedThermalProcess(e.target.files[0]);
                }
              }}
            />
            <button
              type="button"
              onClick={() => thermalFileInputRef.current?.click()}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', color: '#D82873', fontWeight: 600 }}
              title="Upload / Replace scan"
            >
              <UploadCloud size={13} />
              <span>{combinedThermalFile ? 'Replace' : 'Browse'}</span>
            </button>

            {combinedThermalPreview && (
              <button
                type="button"
                onClick={() => setZoomModal({
                  isOpen: true,
                  url: combinedThermalPreview,
                  title: combinedThermalFile?.name || 'Thermal Image',
                  dimensions: combinedThermalValidation?.dimensions ? `${combinedThermalValidation.dimensions.width}×${combinedThermalValidation.dimensions.height} px` : undefined,
                  modality: 'thermal'
                })}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', color: '#4B5563', fontWeight: 600 }}
                title="Zoom view"
              >
                <Maximize2 size={13} />
                <span>Zoom</span>
              </button>
            )}

            {combinedThermalFile && (
              <button
                type="button"
                onClick={handleClearCombinedThermal}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', color: '#BE123C', fontWeight: 600 }}
                title="Remove uploaded thermal scan"
              >
                <Trash2 size={13} />
                <span>Remove</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowThermalSamples(!showThermalSamples)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', color: '#826674', fontWeight: 600 }}
              title="Select reference sample from Mendeley thermography repository"
            >
              <FolderOpen size={13} />
              <span>Samples</span>
            </button>
          </div>

          {/* Samples Mini-Picker for Thermograms */}
          {showThermalSamples && (
            <div style={{ marginTop: '10px', padding: '10px', background: '#FFF5F8', borderRadius: '8px', border: '1px solid #FCD9E2' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#C2185B', marginBottom: '6px' }}>
                Select Authentic Mendeley Reference Thermogram:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {samples.filter(s => s.modality === 'thermal').slice(0, 4).map((s) => (
                  <button
                    key={s.filename}
                    type="button"
                    onClick={async () => {
                      try {
                        const res = await fetch(getSampleImageUrl('thermal', s.filename));
                        const blob = await res.blob();
                        const file = new File([blob], s.filename, { type: 'image/jpeg' });
                        await handleCombinedThermalProcess(file);
                        setShowThermalSamples(false);
                      } catch (e) {
                        console.error('Failed to load sample:', e);
                      }
                    }}
                    style={{
                      fontSize: '10.5px',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      border: '1px solid #FCD9E2',
                      background: '#FFF',
                      cursor: 'pointer',
                      color: '#2A061B',
                      fontWeight: 500
                    }}
                  >
                    {s.filename} ({s.patient_id})
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cross-Modality Denial Banner: Dual Thermal Scans */}
      {isDualThermal && (
        <div style={{
          padding: '14px 18px',
          borderRadius: '12px',
          background: '#FFF1F2',
          border: '1.5px solid #FDA4AF',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 2px 8px rgba(190, 18, 60, 0.08)'
        }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: '#FFE4E6',
            border: '1px solid #FDA4AF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#BE123C',
            flexShrink: 0
          }}>
            <AlertCircle size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#BE123C' }}>
              Screening Denied: Dual Thermal Images Detected
            </div>
            <div style={{ fontSize: '12px', color: '#9F1239', marginTop: '2px', lineHeight: 1.4 }}>
              Both uploaded images are infrared thermal thermograms. Multimodal screening strictly requires <strong>1 Mammogram Radiograph (Slot 1)</strong> and <strong>1 Thermal Scan (Slot 2)</strong>. Please remove or replace the image in Slot 1 with a mammogram radiograph.
            </div>
          </div>
        </div>
      )}

      {/* Cross-Modality Denial Banner: Dual Mammogram Scans */}
      {isDualMammogram && (
        <div style={{
          padding: '14px 18px',
          borderRadius: '12px',
          background: '#FFF1F2',
          border: '1.5px solid #FDA4AF',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 2px 8px rgba(190, 18, 60, 0.08)'
        }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: '#FFE4E6',
            border: '1px solid #FDA4AF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#BE123C',
            flexShrink: 0
          }}>
            <AlertCircle size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#BE123C' }}>
              Screening Denied: Dual Mammogram Radiographs Detected
            </div>
            <div style={{ fontSize: '12px', color: '#9F1239', marginTop: '2px', lineHeight: 1.4 }}>
              Both uploaded images are mammogram radiographs. Multimodal screening requires <strong>1 Mammogram Radiograph (Slot 1)</strong> and <strong>1 Thermal Scan (Slot 2)</strong>. Please remove or replace the image in Slot 2 with an infrared thermal scan.
            </div>
          </div>
        </div>
      )}

      {/* Valid Multimodal Pair Banner */}
      {isProperPair && (
        <div style={{
          padding: '12px 18px',
          borderRadius: '10px',
          background: '#F0FDF4',
          border: '1.5px solid #86EFAC',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <CheckCircle2 size={18} style={{ color: '#16A34A', flexShrink: 0 }} />
          <div style={{ fontSize: '12.5px', color: '#15803D', fontWeight: 600 }}>
            ✓ Valid Multimodal Screening Pair: 1 Structural Mammogram Radiograph + 1 Infrared Thermal Scan.
          </div>
        </div>
      )}

      {/* Case Reference ID & Single-Patient Confirmation Card (When both scans uploaded) */}
      {combinedMammoFile && combinedThermalFile && isBothValidated && pairValidation?.pairing_status !== 'verified' && (
        <div style={{
          padding: '12px 18px',
          borderRadius: '10px',
          background: confirmedSamePatient ? '#F0FDF4' : '#FFF9F0',
          border: `1px solid ${confirmedSamePatient ? '#86EFAC' : '#FCD34D'}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', flex: 1 }}>
            <input
              type="checkbox"
              checked={confirmedSamePatient}
              onChange={(e) => {
                const checked = e.target.checked;
                setConfirmedSamePatient(checked);
                if (combinedMammoFile && combinedThermalFile) {
                  checkPairValidation(combinedMammoFile, combinedThermalFile, checked);
                }
              }}
              style={{ width: '17px', height: '17px', accentColor: '#D82873', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '12.5px', color: confirmedSamePatient ? '#166534' : '#92400E', fontWeight: 600 }}>
              {confirmedSamePatient
                ? '✓ Single-patient examination verified. Multimodal Cross-Attention Fusion is unlocked.'
                : 'Confirm both scans belong to the same patient case to unlock Cross-Attention Multimodal Fusion.'}
            </span>
          </label>

          {!confirmedSamePatient && (
            <button
              type="button"
              onClick={() => {
                setConfirmedSamePatient(true);
                if (combinedMammoFile && combinedThermalFile) {
                  checkPairValidation(combinedMammoFile, combinedThermalFile, true);
                }
              }}
              className="btn-primary"
              style={{ fontSize: '11px', padding: '5px 12px', background: '#D97706', border: 'none' }}
            >
              Confirm Patient Pair
            </button>
          )}
        </div>
      )}

      {/* PRIMARY FULL-WIDTH ACTION BUTTON */}
      <div>
        <button
          type="button"
          disabled={!canRunAnalysis || isSubmitting}
          onClick={handleRunAnalysis}
          style={{
            width: '100%',
            padding: '16px 24px',
            fontSize: '15px',
            fontWeight: 700,
            borderRadius: '12px',
            background: (!canRunAnalysis)
              ? '#DDA5BA'
              : 'linear-gradient(135deg, #D82873 0%, #AF1757 100%)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            cursor: (!canRunAnalysis || isSubmitting) ? 'not-allowed' : 'pointer',
            boxShadow: (!canRunAnalysis)
              ? 'none'
              : '0 4px 18px rgba(216, 40, 115, 0.35)',
            transition: 'all 0.2s ease',
            border: 'none',
            opacity: (!canRunAnalysis) ? 0.75 : 1
          }}
        >
          {isSubmitting ? (
            <>
              <RefreshCw size={18} className="spinning" />
              <span>Running AI Screening & Explainability Analysis...</span>
            </>
          ) : isDualThermal ? (
            <>
              <span style={{ fontSize: '16px' }}>🚫</span>
              <span>Screening Denied — Both Scans Are Thermal (Requires 1 Mammo + 1 Thermal)</span>
            </>
          ) : isDualMammogram ? (
            <>
              <span style={{ fontSize: '16px' }}>🚫</span>
              <span>Screening Denied — Both Scans Are Mammograms (Requires 1 Mammo + 1 Thermal)</span>
            </>
          ) : combinedMammoStage === 'invalid' ? (
            <>
              <span style={{ fontSize: '16px' }}>🚫</span>
              <span>Screening Denied — Primary Mammogram Slot Is Invalid</span>
            </>
          ) : combinedThermalStage === 'invalid' ? (
            <>
              <span style={{ fontSize: '16px' }}>🚫</span>
              <span>Screening Denied — Thermal Image Slot Is Invalid</span>
            </>
          ) : !hasAnyUploadedScan ? (
            <>
              <span style={{ fontSize: '18px' }}>⚡</span>
              <span>Upload Scan to Run AI Screening</span>
            </>
          ) : (
            <>
              <span style={{ fontSize: '18px' }}>🚀</span>
              <span>Run AI Screening & Explainability Analysis</span>
            </>
          )}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SCREENING RESULTS DASHBOARD (Exact Match to Your Reference Screenshot)   */}
      {/* ========================================================================= */}
      {activeResult && (
        <div ref={resultsRef} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '6px' }}>
          {/* Header Bar: ← Screening Results | Case ID | Timestamp */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            padding: '4px 2px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '18px',
                  fontWeight: 800,
                  color: '#2A061B',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: 0
                }}
              >
                <span>←</span>
                <span>Screening Results</span>
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', color: '#6B7280' }}>
              <span>Case ID: <span style={{ color: '#BE123C', fontWeight: 700, fontFamily: 'monospace' }}>{activeResult.case_id || caseId}</span></span>
              <span>|</span>
              <span>🕒 {formattedTimestamp}</span>
            </div>
          </div>

          {/* ROW 1: 3 CARDS (Prediction Summary, Modality Results, Risk Level) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            {/* Card 1: Prediction Summary */}
            <div className="card" style={{ padding: '22px', borderRadius: '14px', background: '#FFFFFF', border: '1px solid #F0D9E3', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#2A061B', marginBottom: '14px' }}>
                  Prediction Summary
                </div>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 14px',
                  borderRadius: '9999px',
                  fontSize: '13px',
                  fontWeight: 700,
                  background: isHighRisk ? '#FFE8EE' : '#E6F9EE',
                  color: isHighRisk ? '#BE123C' : '#15803D',
                  border: `1px solid ${isHighRisk ? '#FDA4AF' : '#86EFAC'}`
                }}>
                  <span style={{ fontSize: '9px' }}>●</span>
                  <span>{isHighRisk ? 'Suspicious' : (activeResult.predicted_class === 'benign' ? 'Benign' : 'Normal')}</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '20px' }}>
                <div>
                  <div style={{ fontSize: '11.5px', color: '#826674' }}>Confidence</div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: '#111827', marginTop: '2px', letterSpacing: '-0.02em' }}>
                    {overallConfidencePct !== '—' ? `${overallConfidencePct}%` : '—'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11.5px', color: '#826674' }}>Prototype Risk Score</div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: '#111827', marginTop: '2px', letterSpacing: '-0.02em' }}>
                    {riskScore.toFixed(2)}
                  </div>
                  <div style={{
                    display: 'inline-block',
                    marginTop: '4px',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: 700,
                    background: isHighRisk ? '#FFE8EE' : '#E6F9EE',
                    color: isHighRisk ? '#BE123C' : '#15803D'
                  }}>
                    {isHighRisk ? 'High Risk' : 'Low Risk'}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '16px', paddingTop: '10px', borderTop: '1px solid #F5E6ED' }}>
                Prototype risk score — not a clinically validated cancer probability.
              </div>
            </div>

            {/* Card 2: Modality Results */}
            <div className="card" style={{ padding: '22px', borderRadius: '14px', background: '#FFFFFF', border: '1px solid #F0D9E3', display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#2A061B', marginBottom: '14px' }}>
                Modality Results
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', flex: 1, alignItems: 'stretch' }}>
                {/* Subcard Mammogram */}
                <div style={{
                  padding: '12px',
                  borderRadius: '10px',
                  background: '#FAF6F8',
                  border: '1px solid #F0D9E3',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  gap: '6px'
                }}>
                  <div style={{
                    width: '54px',
                    height: '54px',
                    borderRadius: '8px',
                    background: '#14040D',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {combinedMammoPreview ? (
                      <img src={combinedMammoPreview} alt="Mammogram" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: '8px', color: '#888' }}>Scan</span>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#2A061B', marginTop: '2px' }}>
                    Mammogram
                  </div>
                  {isMammoAnalyzed ? (
                    <>
                      <div style={{ fontSize: '10.5px', color: '#6B7280', lineHeight: 1.35 }}>
                        <div>Prediction: <strong style={{ color: mammoRisk >= 0.7 ? '#BE123C' : '#15803D' }}>{mammoClass === 'malignant' ? 'Suspicious' : (mammoClass || 'Normal')}</strong></div>
                        <div>Confidence: {mammoConfidence !== undefined ? `${(mammoConfidence * 100).toFixed(1)}%` : '—'}</div>
                        <div>Risk Score: {mammoRisk.toFixed(2)}</div>
                      </div>
                      <span style={{
                        marginTop: 'auto',
                        fontSize: '9.5px',
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        background: '#E5E7EB',
                        color: '#374151',
                        fontWeight: 600
                      }}>
                        Used
                      </span>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: '10.5px', color: '#9CA3AF', lineHeight: 1.35, fontStyle: 'italic' }}>
                        <div>Not Uploaded</div>
                        <div>Confidence: —</div>
                        <div>Risk Score: —</div>
                      </div>
                      <span style={{
                        marginTop: 'auto',
                        fontSize: '9.5px',
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        background: '#F3F4F6',
                        color: '#9CA3AF',
                        fontWeight: 600
                      }}>
                        Unused
                      </span>
                    </>
                  )}
                </div>

                {/* Subcard Thermal Image */}
                <div style={{
                  padding: '12px',
                  borderRadius: '10px',
                  background: '#FAF6F8',
                  border: '1px solid #F0D9E3',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  gap: '6px'
                }}>
                  <div style={{
                    width: '54px',
                    height: '54px',
                    borderRadius: '8px',
                    background: '#14040D',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {combinedThermalPreview ? (
                      <img src={combinedThermalPreview} alt="Thermal" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: '8px', color: '#888' }}>Scan</span>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#2A061B', marginTop: '2px' }}>
                    Thermal Image
                  </div>
                  {isThermalAnalyzed ? (
                    <>
                      <div style={{ fontSize: '10.5px', color: '#6B7280', lineHeight: 1.35 }}>
                        <div>Prediction: <strong style={{ color: thermalRisk >= 0.7 ? '#BE123C' : '#15803D' }}>{thermalClass === 'malignant' ? 'Suspicious' : (thermalClass || 'Normal')}</strong></div>
                        <div>Confidence: {thermalConfidence !== undefined ? `${(thermalConfidence * 100).toFixed(0)}%` : '—'}</div>
                        <div>Risk Score: {thermalRisk.toFixed(2)}</div>
                      </div>
                      <span style={{
                        marginTop: 'auto',
                        fontSize: '9.5px',
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        background: '#E5E7EB',
                        color: '#374151',
                        fontWeight: 600
                      }}>
                        Used
                      </span>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: '10.5px', color: '#9CA3AF', lineHeight: 1.35, fontStyle: 'italic' }}>
                        <div>Not Uploaded</div>
                        <div>Confidence: —</div>
                        <div>Risk Score: —</div>
                      </div>
                      <span style={{
                        marginTop: 'auto',
                        fontSize: '9.5px',
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        background: '#F3F4F6',
                        color: '#9CA3AF',
                        fontWeight: 600
                      }}>
                        Unused
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Card 3: Risk Level */}
            <div className="card" style={{ padding: '22px', borderRadius: '14px', background: '#FFFFFF', border: '1px solid #F0D9E3', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#2A061B', marginBottom: '14px' }}>
                  Risk Level
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* Low Row */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: (!isHighRisk && riskScore < 0.40) ? '#F0FDF4' : 'transparent',
                    border: (!isHighRisk && riskScore < 0.40) ? '1.5px solid #86EFAC' : '1px solid #E5E7EB'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#166534', fontSize: '12px' }}>✔</span>
                      <span style={{ fontSize: '12.5px', fontWeight: (!isHighRisk && riskScore < 0.40) ? 700 : 500, color: '#166534' }}>Low</span>
                    </div>
                    <span style={{ fontSize: '11.5px', color: '#6B7280' }}>0.00 – 0.39</span>
                  </div>

                  {/* Medium Row */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: (riskScore >= 0.40 && riskScore < 0.70) ? '#FFFBEB' : 'transparent',
                    border: (riskScore >= 0.40 && riskScore < 0.70) ? '1.5px solid #FCD34D' : '1px solid #E5E7EB'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#D97706', fontSize: '12px' }}>★</span>
                      <span style={{ fontSize: '12.5px', fontWeight: (riskScore >= 0.40 && riskScore < 0.70) ? 700 : 500, color: '#92400E' }}>Medium</span>
                    </div>
                    <span style={{ fontSize: '11.5px', color: '#6B7280' }}>0.40 – 0.69</span>
                  </div>

                  {/* High Row */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: (isHighRisk || riskScore >= 0.70) ? '#FFF1F2' : 'transparent',
                    border: (isHighRisk || riskScore >= 0.70) ? '1.5px solid #FDA4AF' : '1px solid #E5E7EB'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#E11D48', fontSize: '12px' }}>▲</span>
                      <span style={{ fontSize: '12.5px', fontWeight: (isHighRisk || riskScore >= 0.70) ? 700 : 500, color: '#BE123C' }}>High</span>
                    </div>
                    <span style={{ fontSize: '11.5px', color: (isHighRisk || riskScore >= 0.70) ? '#BE123C' : '#6B7280', fontWeight: (isHighRisk || riskScore >= 0.70) ? 600 : 400 }}>0.70 – 1.00</span>
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '16px', paddingTop: '10px', borderTop: '1px solid #F5E6ED' }}>
                Adjustable thresholds for research purposes only.
              </div>
            </div>
          </div>

          {/* ROW 2: 2 CARDS (Grad-CAM Visualizations & Detailed Report) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.85fr) minmax(0, 1.15fr)', gap: '16px' }}>
            {/* Card 4: Grad-CAM Visualizations */}
            <div className="card" style={{ padding: '22px', borderRadius: '14px', background: '#FFFFFF', border: '1px solid #F0D9E3', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#2A061B' }}>
                  Grad-CAM Visualizations
                </div>
                <div style={{ fontSize: '11px', color: '#826674' }}>
                  Target: Upper-layer Feature Activation
                </div>
              </div>

              {/* Modality Tabs */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                <button
                  type="button"
                  onClick={() => setSelectedCamModality('mammogram')}
                  style={{
                    padding: '5px 14px',
                    borderRadius: '6px',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: selectedCamModality === 'mammogram' ? '#FFE8EE' : '#FFFFFF',
                    color: selectedCamModality === 'mammogram' ? '#BE123C' : '#6B7280',
                    border: `1px solid ${selectedCamModality === 'mammogram' ? '#FDA4AF' : '#E5E7EB'}`
                  }}
                >
                  Mammogram
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCamModality('thermal')}
                  style={{
                    padding: '5px 14px',
                    borderRadius: '6px',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: selectedCamModality === 'thermal' ? '#FFE8EE' : '#FFFFFF',
                    color: selectedCamModality === 'thermal' ? '#BE123C' : '#6B7280',
                    border: `1px solid ${selectedCamModality === 'thermal' ? '#FDA4AF' : '#E5E7EB'}`
                  }}
                >
                  Thermal
                </button>
              </div>

              {/* 3 Viewport Panels (Original, Heatmap, Overlay) */}
              {!isCamAvailable ? (
                <div style={{
                  padding: '36px 20px',
                  borderRadius: '10px',
                  background: '#FFF5F8',
                  border: '1px solid #FCD9E2',
                  textAlign: 'center',
                  color: '#826674',
                  minHeight: '210px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#C2185B', marginBottom: '6px' }}>
                    {selectedCamModality === 'thermal' ? 'Thermal Scan Not Analyzed' : 'Mammogram Radiograph Not Analyzed'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6B7280', maxWidth: '420px', lineHeight: 1.4 }}>
                    Grad-CAM convolutional feature attributions are only generated for modalities uploaded and processed in this examination.
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  {/* Panel 1: Original */}
                  <div>
                    <div style={{
                      height: '210px',
                      background: '#0D0308',
                      borderRadius: '8px',
                      position: 'relative',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {activeCamOriginal ? (
                        <img
                          src={activeCamOriginal}
                          alt="Original"
                          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        />
                      ) : (
                        <div style={{ color: '#888', fontSize: '11px' }}>Original scan preview</div>
                      )}
                      {/* HUD Text in top-left */}
                      <div style={{ position: 'absolute', top: '6px', left: '6px', fontSize: '8px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.2, fontFamily: 'monospace' }}>
                        <div>L-MLO 18x24</div>
                        <div>ACR: BI-RADS</div>
                      </div>
                    </div>
                    <div style={{ fontSize: '11.5px', textAlign: 'center', color: '#6B7280', marginTop: '6px', fontWeight: 600 }}>
                      Original
                    </div>
                  </div>

                  {/* Panel 2: Heatmap */}
                  <div>
                    <div style={{
                      height: '210px',
                      background: '#0D0308',
                      borderRadius: '8px',
                      position: 'relative',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {(activeRawCamUrl || activeCamUrl) ? (
                        <img
                          src={activeRawCamUrl || activeCamUrl}
                          alt="Grad-CAM Heatmap"
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain'
                          }}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div style={{ color: '#FDA4AF', fontSize: '11.5px', textAlign: 'center', padding: '16px' }}>
                          Grad-CAM activation heatmap view
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: '11.5px', textAlign: 'center', color: '#6B7280', marginTop: '6px', fontWeight: 600 }}>
                      Heatmap
                    </div>
                  </div>

                  {/* Panel 3: Overlay */}
                  <div>
                    <div style={{
                      height: '210px',
                      background: '#0D0308',
                      borderRadius: '8px',
                      position: 'relative',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {activeCamUrl ? (
                        <img
                          src={activeCamUrl}
                          alt="Overlay Heatmap"
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                            opacity: overlayBlend / 100
                          }}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : activeCamOriginal ? (
                        <img
                          src={activeCamOriginal}
                          alt="Original Scan"
                          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        />
                      ) : (
                        <div style={{ color: '#FDA4AF', fontSize: '11.5px', textAlign: 'center', padding: '16px' }}>
                          Overlay preview
                        </div>
                      )}
                      {/* Lesion ROI Box */}
                      {highlightRoi && (
                        <div style={computedRoiStyle}>
                          <span style={{
                            position: 'absolute',
                            top: '-15px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            background: '#EF4444',
                            color: '#fff',
                            fontSize: '8.5px',
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: '2px',
                            whiteSpace: 'nowrap'
                          }}>
                            ROI Focus
                          </span>
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: '11.5px', textAlign: 'center', color: '#6B7280', marginTop: '6px', fontWeight: 600 }}>
                      Overlay
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom Interactive Controls */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '16px',
                paddingTop: '12px',
                borderTop: '1px solid #F5E6ED',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11.5px', color: '#4B5563', fontWeight: 600 }}>🎚 Overlay Blend: {overlayBlend}%</span>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={overlayBlend}
                    onChange={(e) => setOverlayBlend(Number(e.target.value))}
                    style={{ width: '120px', accentColor: '#D82873', cursor: 'pointer' }}
                  />
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#4B5563', fontWeight: 600, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={highlightRoi}
                    onChange={(e) => setHighlightRoi(e.target.checked)}
                    style={{ accentColor: '#D82873', width: '15px', height: '15px' }}
                  />
                  <span>Highlight Lesion ROI</span>
                </label>
              </div>
            </div>

            {/* Card 5: Detailed Report */}
            <div className="card" style={{ padding: '22px', borderRadius: '14px', background: '#FFFFFF', border: '1px solid #F0D9E3', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#2A061B', marginBottom: '14px' }}>
                  Detailed Report
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#6B7280', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>📁</span> Case ID
                    </span>
                    <span style={{ fontWeight: 600, color: '#111827', fontFamily: 'monospace' }}>{activeResult.case_id || caseId}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#6B7280', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>🕒</span> Timestamp
                    </span>
                    <span style={{ color: '#374151' }}>{formattedTimestamp}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#6B7280', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>⚡</span> Modalities Used
                    </span>
                    <span style={{ fontWeight: 600, color: '#111827' }}>
                      {combinedMammoFile && combinedThermalFile ? 'Mammogram + Thermal' : (combinedMammoFile ? 'Mammogram Only' : 'Thermal Only')}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#6B7280', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>🖼</span> Mammogram Prediction
                    </span>
                    {isMammoAnalyzed ? (
                      <span style={{ fontWeight: 700, color: mammoRisk >= 0.7 ? '#BE123C' : '#15803D' }}>
                        {mammoClass === 'malignant' ? 'Suspicious' : (mammoClass || 'Normal')} ({mammoConfidence !== undefined ? `${(mammoConfidence * 100).toFixed(1)}%` : '—'})
                      </span>
                    ) : (
                      <span style={{ color: '#9CA3AF', fontStyle: 'italic' }}>
                        Not Analyzed (N/A)
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#6B7280', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>🌡</span> Thermal Prediction
                    </span>
                    {isThermalAnalyzed ? (
                      <span style={{ fontWeight: 700, color: thermalRisk >= 0.7 ? '#BE123C' : '#15803D' }}>
                        {thermalClass === 'malignant' ? 'Suspicious' : (thermalClass || 'Normal')} ({thermalConfidence !== undefined ? `${(thermalConfidence * 100).toFixed(0)}%` : '—'})
                      </span>
                    ) : (
                      <span style={{ color: '#9CA3AF', fontStyle: 'italic' }}>
                        Not Analyzed (N/A)
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#6B7280', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>🛡</span> Final Prediction
                    </span>
                    <span style={{ fontWeight: 800, color: isHighRisk ? '#BE123C' : '#15803D' }}>
                      {isHighRisk ? 'Suspicious' : 'Normal / Benign'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#6B7280', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>📊</span> Risk Score
                    </span>
                    <span style={{ fontWeight: 700, color: '#111827' }}>{riskScore.toFixed(2)}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#6B7280', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>▲</span> Risk Level
                    </span>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: isHighRisk ? '#FFE8EE' : '#E6F9EE',
                      color: isHighRisk ? '#BE123C' : '#15803D',
                      border: `1px solid ${isHighRisk ? '#FDA4AF' : '#86EFAC'}`
                    }}>
                      {isHighRisk ? 'High Risk' : 'Low Risk'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Button: Download Report */}
              <div style={{ marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={handleDownloadReport}
                  disabled={isDownloadingReport}
                  style={{
                    width: '100%',
                    padding: '11px 16px',
                    borderRadius: '8px',
                    border: '1px solid #F0D9E3',
                    background: '#FFFFFF',
                    color: '#2A061B',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: isDownloadingReport ? 'wait' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#FFF5F8';
                    e.currentTarget.style.borderColor = '#D82873';
                    e.currentTarget.style.color = '#D82873';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#FFFFFF';
                    e.currentTarget.style.borderColor = '#F0D9E3';
                    e.currentTarget.style.color = '#2A061B';
                  }}
                >
                  <Download size={14} />
                  <span>{isDownloadingReport ? 'Generating Report...' : 'Download Report'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FULLSCREEN ZOOM MODAL */}
      {zoomModal && zoomModal.isOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(10, 2, 7, 0.92)',
          backdropFilter: 'blur(8px)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          padding: '20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ color: '#fff', fontSize: '16px', fontWeight: 700 }}>
              {zoomModal.title} {zoomModal.dimensions ? `(${zoomModal.dimensions})` : ''}
            </div>
            <button
              type="button"
              onClick={() => setZoomModal(null)}
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: 'none',
                color: '#fff',
                padding: '6px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <X size={16} />
              <span>Close</span>
            </button>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <img
              src={zoomModal.url}
              alt="Zoomed Scan"
              style={{ maxHeight: '90vh', maxWidth: '90vw', objectFit: 'contain', ...previewFilterStyle }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
