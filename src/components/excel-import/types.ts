import { GridColDef, GridApiPro } from "@mui/x-data-grid-pro";
import { ExcelRow, FileMetadata, ComparisonStats, ModifierCriteria } from "../../utils/excelOperations";
import { ValidationResult } from "../../utils/fileValidation";
import { RefObject } from "react";

export interface SheetData {
  rows: ExcelRow[];
  columns: GridColDef[];
}

export interface FileUploadProps {
  fileType: "Master" | "Client";
  rows: ExcelRow[];
  columns: GridColDef[];
  fileMetadata: FileMetadata | null;
  sheetNames: string[];
  activeTab: number;
  sheetData: { [sheetName: string]: SheetData };
  dragOver: boolean;
  // Validation props
  validationResult?: ValidationResult;
  isValidating?: boolean;
  onFileUpload: (file: File, fileType: "Master" | "Client") => void;
  onTabChange: (newValue: number) => void;
  onDragEnter: () => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
}

export interface DataGridSectionProps {
  title: string;
  rows: ExcelRow[];
  columns: GridColDef[];
  gridType: 'master' | 'client' | 'merged';
  fileMetadata?: FileMetadata | null;
  apiRef?: RefObject<GridApiPro | null>;
  headerColor?: string;
  backgroundColor?: string;
  onRowUpdate?: (updatedRow: ExcelRow) => void;
  comparisonStats?: ComparisonStats | null;
  // Row operations
  enableRowActions?: boolean;
  onEditRow?: (rowId: number | string, gridType: 'master' | 'client' | 'merged') => void;
  onCreateNewFromRow?: (rowId: number | string, gridType: 'master' | 'client' | 'merged') => void;
  onDeleteRow?: (rowId: number | string, gridType: 'master' | 'client' | 'merged') => void;
  // UI options
  hideHeader?: boolean;
}

export interface ComparisonResultsProps {
  mergedRows: ExcelRow[];
  mergedColumns: GridColDef[];
  unmatchedClient: ExcelRow[];
  dupsClient: ExcelRow[];
  columnsClient: GridColDef[];
  comparisonStats: ComparisonStats | null;
  onExport: () => void;
  isExporting?: boolean;
  // Row operations for merged grid
  enableRowActions?: boolean;
  onEditRow?: (rowId: number | string, gridType: 'master' | 'client' | 'merged') => void;
  onCreateNewFromRow?: (rowId: number | string, gridType: 'master' | 'client' | 'merged') => void;
  onDeleteRow?: (rowId: number | string, gridType: 'master' | 'client' | 'merged') => void;
}

export interface ModifierCriteriaDialogProps {
  open: boolean;
  criteria: ModifierCriteria;
  onClose: () => void;
  onCriteriaChange: (criteria: ModifierCriteria) => void;
  onStartComparison: () => void;
  useNewHyphenAlgorithm?: boolean;
  onHyphenAlgorithmChange?: (useNew: boolean) => void;
}

export interface WelcomeSectionProps {
  onLoadSampleData: (sampleSet?: number) => void;
  isLoading?: boolean;
  // Action button props
  showActionButtons?: boolean;
  resetMenuAnchor?: HTMLElement | null;
  settingsMenuAnchor?: HTMLElement | null;
  onResetMenuClick?: (event: React.MouseEvent<HTMLElement>) => void;
  onResetMenuClose?: () => void;
  onSettingsMenuClick?: (event: React.MouseEvent<HTMLElement>) => void;
  onSettingsMenuClose?: () => void;
  onResetAction?: (type: 'master' | 'client' | 'both') => void;
  onModifierSettings?: () => void;
  hasMasterData?: boolean;
  hasClientData?: boolean;
}

export interface FileInfoCardProps {
  metadata: FileMetadata | null;
}

export interface ComparisonStatsPanelProps {
  stats: ComparisonStats | null;
}

export interface ExportButtonsProps {
  mergedRows: ExcelRow[];
  onExport: () => void;
}
