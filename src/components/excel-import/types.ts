import { GridColDef } from "@mui/x-data-grid-pro";
import { ExcelRow, FileMetadata, ComparisonStats, ModifierCriteria } from "../../utils/excelOperations";

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
  apiRef?: any;
  headerColor?: string;
  backgroundColor?: string;
  onRowUpdate?: (updatedRow: ExcelRow) => void;
  comparisonStats?: ComparisonStats | null;
}

export interface ComparisonResultsProps {
  mergedRows: ExcelRow[];
  mergedColumns: GridColDef[];
  unmatchedClient: ExcelRow[];
  dupsClient: ExcelRow[];
  columnsClient: GridColDef[];
  comparisonStats: ComparisonStats | null;
  onExport: () => void;
}

export interface ModifierCriteriaDialogProps {
  open: boolean;
  criteria: ModifierCriteria;
  onClose: () => void;
  onCriteriaChange: (criteria: ModifierCriteria) => void;
  onStartComparison: () => void;
}

export interface WelcomeSectionProps {
  onLoadSampleData: () => void;
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
