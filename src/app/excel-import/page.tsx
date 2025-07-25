"use client";
import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Button, Box, Typography, Dialog, DialogTitle, DialogContent, DialogActions, FormGroup, FormControlLabel, Checkbox, TextField, InputAdornment, Tabs, Tab, Chip, Fab, Tooltip, IconButton } from "@mui/material";
import { DataGrid, GridColDef, GridSortModel, GridRenderCellParams, useGridApiRef } from "@mui/x-data-grid";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import EditIcon from "@mui/icons-material/Edit";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/Delete";
import * as XLSX from "xlsx";
import AIChat, { AIChatHandle } from "../../components/AIChat";
import dynamic from 'next/dynamic';
import { filterAndSearchRows } from "../../utils/excelOperations";
// Removed cptCacheService import - no longer used

// Create a NoSSR wrapper component to disable server-side rendering
const NoSSR = dynamic(() => Promise.resolve(({ children }: { children: React.ReactNode }) => <>{children}</>), {
  ssr: false,
  loading: () => (
    <Box sx={{ 
      p: 4, 
      background: 'linear-gradient(135deg, #f8fbff 0%, #e3f2fd 50%, #f0f8ff 100%)',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <Typography variant="h4" sx={{ color: '#1976d2' }}>
        Loading Excel Import Tool...
      </Typography>
    </Box>
  )
});

// Define a type for Excel rows with dynamic fields, plus id
interface ExcelRow {
  id: number;
  [key: string]: string | number | undefined;
}

interface FileMetadata {
  name: string;
  size: number;
  uploadTime: Date;
  sheetCount: number;
  recordCount: number;
  columnCount: number;
}

interface ComparisonStats {
  totalMasterRecords: number;
  totalClientRecords: number;
  matchedRecords: number;
  unmatchedRecords: number;
  duplicateRecords: number;
  matchRate: number;
  processingTime: number;
  columnsMatched: number;
  totalMasterColumns: number;
  totalClientColumns: number;
}

interface AIIntent {
  type: 'query' | 'action' | 'filter' | 'sort' | 'analysis' | 'documentation';
  action?: 'sort' | 'filter' | 'search' | 'summarize' | 'count' | 'show' | 'switch' | 'explain' | 'clear_filters' | 'export' | 'duplicate' | 'delete' | 'add';
  parameters?: {
    column?: string;
    value?: string;
    direction?: 'asc' | 'desc';
    condition?: string;
    view?: string;
    filename?: string;
    rowId?: number | string;
    rowData?: {[key: string]: string | number | undefined};
  };
  response?: string;
}


export default function ExcelImportPage() {
  const [rowsMaster, setRowsMaster] = useState<ExcelRow[]>([]);
  const [columnsMaster, setColumnsMaster] = useState<GridColDef[]>([]);
  const [rowsClient, setRowsClient] = useState<ExcelRow[]>([]);
  const [columnsClient, setColumnsClient] = useState<GridColDef[]>([]);
  const [mergedRows, setMergedRows] = useState<ExcelRow[]>([]);
  const [mergedColumns, setMergedColumns] = useState<GridColDef[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const fileMasterInputRef = useRef<HTMLInputElement>(null);
  const fileClientInputRef = useRef<HTMLInputElement>(null);
  const [dragOverMaster, setDragOverMaster] = useState(false);
  const [dragOverClient, setDragOverClient] = useState(false);
  const [lastMasterFile, setLastMasterFile] = useState<string | null>(null);
  const [lastClientFile, setLastClientFile] = useState<string | null>(null);
  const [lastMasterData, setLastMasterData] = useState<string | null>(null);
  const [lastClientData, setLastClientData] = useState<string | null>(null);
  
  // Sheet management state
  const [masterSheetData, setMasterSheetData] = useState<{[sheetName: string]: {rows: ExcelRow[], columns: GridColDef[]}}>({});
  const [clientSheetData, setClientSheetData] = useState<{[sheetName: string]: {rows: ExcelRow[], columns: GridColDef[]}}>({});
  const [activeMasterTab, setActiveMasterTab] = useState<number>(0);
  const [activeClientTab, setActiveClientTab] = useState<number>(0);
  const [masterSheetNames, setMasterSheetNames] = useState<string[]>([]);
  const [clientSheetNames, setClientSheetNames] = useState<string[]>([]);
  const [mergedSheetInfo, setMergedSheetInfo] = useState<{masterSheet: string, clientSheet: string} | null>(null);
  
  // File metadata state
  const [masterFileMetadata, setMasterFileMetadata] = useState<FileMetadata | null>(null);
  const [clientFileMetadata, setClientFileMetadata] = useState<FileMetadata | null>(null);
  
  // Comparison statistics state
  const [comparisonStats, setComparisonStats] = useState<ComparisonStats | null>(null);
  


  
  useEffect(() => {
    const lastMaster = localStorage.getItem("lastMasterFile");
    const lastMasterData = localStorage.getItem("lastMasterData");
    const lastMasterMetadata = localStorage.getItem("lastMasterMetadata");
    if (lastMaster) {
      setLastMasterFile(lastMaster);
    }
    if (lastMasterData) {
      setLastMasterData(lastMasterData);
    }
    if (lastMasterMetadata) {
      try {
        const metadata = JSON.parse(lastMasterMetadata);
        // Convert uploadTime back to Date object
        metadata.uploadTime = new Date(metadata.uploadTime);
        setMasterFileMetadata(metadata);
      } catch (e) {
        console.error('Failed to parse master metadata:', e);
      }
    }
    const lastClient = localStorage.getItem("lastClientFile");
    const lastClientData = localStorage.getItem("lastClientData");
    const lastClientMetadata = localStorage.getItem("lastClientMetadata");
    if (lastClient) {
      setLastClientFile(lastClient);
    }
    if (lastClientData) {
      setLastClientData(lastClientData);
    }
    if (lastClientMetadata) {
      try {
        const metadata = JSON.parse(lastClientMetadata);
        // Convert uploadTime back to Date object
        metadata.uploadTime = new Date(metadata.uploadTime);
        setClientFileMetadata(metadata);
      } catch (e) {
        console.error('Failed to parse client metadata:', e);
      }
    }
  }, []);
  
  // Debug tab state
  useEffect(() => {
    console.log('[DEBUG] Master sheets:', masterSheetNames, 'Active tab:', activeMasterTab);
    console.log('[DEBUG] Client sheets:', clientSheetNames, 'Active tab:', activeClientTab);
  }, [masterSheetNames, clientSheetNames, activeMasterTab, activeClientTab]);
  
  // Helper function to format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  // File information card component with consistent theming
  const FileInfoCard = ({ metadata, type }: { metadata: FileMetadata | null, type: 'Master' | 'Client' }) => {
    console.log(`[DEBUG] FileInfoCard render - ${type}:`, metadata);
    
    if (!metadata) {
      console.log(`[DEBUG] No metadata for ${type}, not rendering card`);
      return null;
    }
    
    console.log(`[DEBUG] Rendering ${type} FileInfoCard with metadata:`, metadata);
    
    return (
      <Box sx={{ 
        mb: 1, 
        p: 1.5,
        backgroundColor: '#f8fbff', 
        border: '2px solid #2196f3',
        borderRadius: 1,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        flexWrap: 'wrap'
      }}>
        <Typography variant="body2" sx={{ 
          fontWeight: 'bold', 
          color: '#1976d2',
          minWidth: '120px'
        }}>
          📄 {metadata.name}
        </Typography>
        <Chip 
          size="small" 
          label={formatFileSize(metadata.size)} 
          sx={{ 
            backgroundColor: '#1976d2', 
            color: 'white',
            fontSize: '0.75rem',
            height: '24px'
          }}
        />
        <Chip 
          size="small" 
          label={`${metadata.sheetCount} sheet${metadata.sheetCount !== 1 ? 's' : ''}`}
          sx={{ 
            backgroundColor: '#4caf50', 
            color: 'white',
            fontSize: '0.75rem',
            height: '24px'
          }}
        />
        <Chip 
          size="small" 
          label={`${metadata.recordCount.toLocaleString()} records`}
          sx={{ 
            backgroundColor: '#ff9800', 
            color: 'white',
            fontSize: '0.75rem',
            height: '24px'
          }}
        />
        <Typography variant="caption" sx={{ 
          color: '#666',
          ml: 'auto'
        }}>
          {metadata.uploadTime.toLocaleTimeString()}
        </Typography>
      </Box>
    );
  };
  
  // Comparison statistics panel component
  const ComparisonStatsPanel = ({ stats }: { stats: ComparisonStats | null }) => {
    if (!stats) return null;
    
    return (
      <Box sx={{
        mb: 2,
        p: 2,
        backgroundColor: '#f8fbff',
        border: '2px solid #4caf50',
        borderRadius: 1,
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        flexWrap: 'wrap'
      }}>
        <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#2e7d32' }}>
          📊 Results:
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <Chip size="small" label={`${stats.matchedRecords.toLocaleString()} matched`} 
                sx={{ backgroundColor: '#4caf50', color: 'white', fontSize: '0.75rem' }} />
          <Chip size="small" label={`${stats.unmatchedRecords.toLocaleString()} unmatched`} 
                sx={{ backgroundColor: '#f44336', color: 'white', fontSize: '0.75rem' }} />
          <Chip size="small" label={`${stats.duplicateRecords.toLocaleString()} duplicates`} 
                sx={{ backgroundColor: '#ff9800', color: 'white', fontSize: '0.75rem' }} />
          <Chip size="small" label={`${stats.matchRate}% match rate`} 
                sx={{ backgroundColor: '#2196f3', color: 'white', fontSize: '0.75rem' }} />
          <Chip size="small" label={`${stats.columnsMatched} columns mapped`} 
                sx={{ backgroundColor: '#9c27b0', color: 'white', fontSize: '0.75rem' }} />
        </Box>
        
        <Typography variant="caption" sx={{ color: '#666', ml: 'auto' }}>
          {stats.processingTime}ms
        </Typography>
      </Box>
    );
  };

  // Modifier criteria state
  const [modifierDialogOpen, setModifierDialogOpen] = useState(false);
  const [modifierCriteria, setModifierCriteria] = useState({
    root00: true,
    root25: true,
    ignoreTrauma: false,
    root50: false,
    root59: false,
    rootXU: false,
    root76: false,
  });

  // Unmatched and duplicate records state
  const [unmatchedClient, setUnmatchedClient] = useState<ExcelRow[]>([]);
  const [dupsClient, setDupsClient] = useState<ExcelRow[]>([]);
  const [mergedForExport, setMergedForExport] = useState<ExcelRow[]>([]);

  // Search state for each grid - input values (immediate UI updates)
  const [searchMasterInput, setSearchMasterInput] = useState("");
  const [searchClientInput, setSearchClientInput] = useState("");
  const [searchMergedInput, setSearchMergedInput] = useState("");

  // Search state for filtering (debounced)
  const [searchMaster, setSearchMaster] = useState("");
  const [searchClient, setSearchClient] = useState("");
  const [searchMerged, setSearchMerged] = useState("");
  
  // Tab state for errors and duplicates
  const [errorsTabValue, setErrorsTabValue] = useState(0);

  // Debounced search effects (500ms delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchMaster(searchMasterInput);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchMasterInput]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchClient(searchClientInput);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchClientInput]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchMerged(searchMergedInput);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchMergedInput]);

  // AI Chat state with localStorage persistence
  const [isChatOpen, setIsChatOpen] = useState(false);
  const aiChatRef = useRef<AIChatHandle>(null);
  
  // Function to ask AI about HCPCS code
  const askAIAboutCode = (hcpcsCode: string) => {
    setIsChatOpen(true);
    // Small delay to ensure chat is open before sending message
    setTimeout(() => {
      if (aiChatRef.current?.sendMessage) {
        aiChatRef.current.sendMessage(`What is HCPCS code ${hcpcsCode} for?`);
      }
    }, 100);
  };
  const [aiSelectedGrid, setAiSelectedGrid] = useState<'master' | 'client' | 'merged' | 'unmatched' | 'duplicates'>('merged');
  const [chatWidth, setChatWidth] = useState(320);

  // Optimized width change handler to prevent unnecessary re-renders
  const handleChatWidthChange = useCallback((newWidth: number) => {
    setChatWidth(newWidth);
  }, []);

  // Refs for scrolling to grids
  const masterGridRef = useRef<HTMLDivElement>(null);
  const clientGridRef = useRef<HTMLDivElement>(null);
  const mergedGridRef = useRef<HTMLDivElement>(null);
  const unmatchedGridRef = useRef<HTMLDivElement>(null);
  const duplicatesGridRef = useRef<HTMLDivElement>(null);
  
  // Sort models for each grid
  const [masterSortModel, setMasterSortModel] = useState<GridSortModel>([]);
  const [clientSortModel, setClientSortModel] = useState<GridSortModel>([]);
  const [mergedSortModel, setMergedSortModel] = useState<GridSortModel>([]);
  const [unmatchedSortModel, setUnmatchedSortModel] = useState<GridSortModel>([]);
  const [duplicatesSortModel, setDuplicatesSortModel] = useState<GridSortModel>([]);

  // API refs for programmatic control of each grid
  const masterApiRef = useGridApiRef();
  const clientApiRef = useGridApiRef();
  const mergedApiRef = useGridApiRef();


  // Filter states for each grid
  const [masterFilters, setMasterFilters] = useState<{column: string, condition: string, value: string}[]>([]);
  const [clientFilters, setClientFilters] = useState<{column: string, condition: string, value: string}[]>([]);
  const [mergedFilters, setMergedFilters] = useState<{column: string, condition: string, value: string}[]>([]);
  const [unmatchedFilters, setUnmatchedFilters] = useState<{column: string, condition: string, value: string}[]>([]);
  const [duplicatesFilters, setDuplicatesFilters] = useState<{column: string, condition: string, value: string}[]>([]);

  // Edit tracking states
  const [originalClientData, setOriginalClientData] = useState<ExcelRow[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [originalMasterData, setOriginalMasterData] = useState<ExcelRow[]>([]);
  const [hasUnsavedMasterChanges, setHasUnsavedMasterChanges] = useState(false);
  const [originalMergedData, setOriginalMergedData] = useState<ExcelRow[]>([]);
  const [hasUnsavedMergedChanges, setHasUnsavedMergedChanges] = useState(false);

  // Duplicate validation states
  const [duplicateValidationErrors, setDuplicateValidationErrors] = useState<{
    master: { duplicateKeys: string[], duplicateRows: ExcelRow[] },
    client: { duplicateKeys: string[], duplicateRows: ExcelRow[] },
    merged: { duplicateKeys: string[], duplicateRows: ExcelRow[] }
  }>({
    master: { duplicateKeys: [], duplicateRows: [] },
    client: { duplicateKeys: [], duplicateRows: [] },
    merged: { duplicateKeys: [], duplicateRows: [] }
  });

  // Row selection states for each grid
  const [selectedRowMaster, setSelectedRowMaster] = useState<number | string | null>(null);
  const [selectedRowClient, setSelectedRowClient] = useState<number | string | null>(null);
  const [selectedRowMerged, setSelectedRowMerged] = useState<number | string | null>(null);
  const [selectedRowUnmatched, setSelectedRowUnmatched] = useState<number | string | null>(null);
  const [selectedRowDuplicates, setSelectedRowDuplicates] = useState<number | string | null>(null);

  // Multi-row selection states for checkbox selections
  const [selectedRowsMaster, setSelectedRowsMaster] = useState<(number | string)[]>([]);
  const [selectedRowsClient, setSelectedRowsClient] = useState<(number | string)[]>([]);
  const [selectedRowsMerged, setSelectedRowsMerged] = useState<(number | string)[]>([]);
  const [selectedRowsUnmatched, setSelectedRowsUnmatched] = useState<(number | string)[]>([]);
  const [selectedRowsDuplicates, setSelectedRowsDuplicates] = useState<(number | string)[]>([]);


  // Advanced filter function that applies AI filters
  const applyFilters = (rows: ExcelRow[], filters: {column: string, condition: string, value: string}[]): ExcelRow[] => {
    if (filters.length === 0) return rows;
    
    return rows.filter(row => {
      return filters.every(filter => {
        const cellValue = String(row[filter.column] || '').toLowerCase();
        const filterValue = filter.value.toLowerCase();
        
        switch (filter.condition) {
          case 'equals':
            return cellValue === filterValue;
          case 'not_equals':
            return cellValue !== filterValue;
          case 'contains':
            return cellValue.includes(filterValue);
          case 'not_contains':
            return !cellValue.includes(filterValue);
          case 'starts_with':
            return cellValue.startsWith(filterValue);
          case 'ends_with':
            return cellValue.endsWith(filterValue);
          case 'is_empty':
            return cellValue === '' || cellValue === 'undefined' || cellValue === 'null';
          case 'is_not_empty':
            return cellValue !== '' && cellValue !== 'undefined' && cellValue !== 'null';
          case 'greater_than':
            const numValue = parseFloat(cellValue);
            const numFilter = parseFloat(filterValue);
            return !isNaN(numValue) && !isNaN(numFilter) && numValue > numFilter;
          case 'less_than':
            const numValue2 = parseFloat(cellValue);
            const numFilter2 = parseFloat(filterValue);
            return !isNaN(numValue2) && !isNaN(numFilter2) && numValue2 < numFilter2;

          default:
            return true;
        }
      });
    });
  };

  // Combined filter function that applies both search and AI filters
  const filterAndSearchRowsLocal = (rows: ExcelRow[], searchTerm: string, filters: {column: string, condition: string, value: string}[]): ExcelRow[] => {
    const filteredRows = applyFilters(rows, filters);
    // Note: The utility filterAndSearchRows expects a different filter format, but since we're only using search here, pass empty filters
    return filterAndSearchRows(filteredRows, {}, searchTerm);
  };

  // Function to scroll to the active grid
  const scrollToActiveGrid = (gridType: 'master' | 'client' | 'merged' | 'unmatched' | 'duplicates') => {
    const refs = {
      master: masterGridRef,
      client: clientGridRef,
      merged: mergedGridRef,
      unmatched: unmatchedGridRef,
      duplicates: duplicatesGridRef,
    };

    const targetRef = refs[gridType];
    if (targetRef.current) {
      targetRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  };

  // Effect to scroll when AI selected grid changes
  useEffect(() => {
    if (aiSelectedGrid) {
      setTimeout(() => scrollToActiveGrid(aiSelectedGrid), 300); // Small delay for UI updates
    }
  }, [aiSelectedGrid]);

  // Effect to scroll when merged data becomes available
  useEffect(() => {
    if (aiSelectedGrid === 'merged' && mergedRows.length > 0 && showCompare) {
      setTimeout(() => scrollToActiveGrid('merged'), 500); // Longer delay for merged grid to render
    }
  }, [mergedRows.length, showCompare, aiSelectedGrid]);

  // Effect to scroll to grid when it becomes visible (for unmatched/duplicates)
  useEffect(() => {
    if (aiSelectedGrid === 'unmatched' && errorsTabValue === 0 && unmatchedClient.length > 0) {
      setTimeout(() => scrollToActiveGrid('unmatched'), 300);
    }
  }, [aiSelectedGrid, errorsTabValue, unmatchedClient.length]);

  useEffect(() => {
    if (aiSelectedGrid === 'duplicates' && errorsTabValue === 1 && dupsClient.length > 0) {
      setTimeout(() => scrollToActiveGrid('duplicates'), 300);
    }
  }, [aiSelectedGrid, errorsTabValue, dupsClient.length]);

  // Function to get grid container styles with glowing border and scroll control
  const getGridContainerStyles = (gridType: 'master' | 'client' | 'merged' | 'unmatched' | 'duplicates') => {
    const isActive = aiSelectedGrid === gridType;
    return {
      border: isActive ? '3px solid #1976d2' : '1px solid #e0e0e0',
      borderRadius: '8px',
      padding: '16px',
      marginBottom: '24px',
      boxShadow: isActive 
        ? '0 0 20px rgba(25, 118, 210, 0.3), inset 0 0 20px rgba(25, 118, 210, 0.1)' 
        : '0 2px 4px rgba(0,0,0,0.1)',
      transition: 'all 0.3s ease',
      background: isActive ? 'rgba(25, 118, 210, 0.02)' : 'white',
      opacity: isActive ? 1 : 0.85,
      position: 'relative' as const,
      cursor: isActive ? 'default' : 'pointer',
      '&:hover': isActive ? {} : {
        opacity: 0.95,
        boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
        borderColor: '#90caf9',
      },
    };
  };

  // Function to handle grid container clicks
  const handleGridClick = (gridType: 'master' | 'client' | 'merged' | 'unmatched' | 'duplicates') => {
    if (aiSelectedGrid !== gridType) {
      console.log(`[GRID CLICK] Switching active grid from ${aiSelectedGrid} to ${gridType}`);
      setAiSelectedGrid(gridType);
    } else {
      console.log(`[GRID CLICK] Grid ${gridType} already active`);
    }
  };

  // Function to get DataGrid styles with conditional scroll handling
  const getDataGridStyles = (gridType: 'master' | 'client' | 'merged' | 'unmatched' | 'duplicates') => {
    const isActive = aiSelectedGrid === gridType;
    return {
      pointerEvents: isActive ? 'auto' : 'none',
      '& .MuiDataGrid-virtualScroller': {
        pointerEvents: isActive ? 'auto' : 'none',
      },
      '& .MuiDataGrid-scrollArea': {
        pointerEvents: isActive ? 'auto' : 'none',
      },
      '& .MuiDataGrid-cell': {
        pointerEvents: isActive ? 'auto' : 'none',
      },
      '& .MuiDataGrid-row': {
        pointerEvents: isActive ? 'auto' : 'none',
      },
      // Always allow checkbox selection regardless of active state
      '& .MuiDataGrid-checkboxInput': {
        pointerEvents: 'auto',
      },
      '& .MuiCheckbox-root': {
        pointerEvents: 'auto',
      },
    } as const;
  };

  // Helper function to start row edit mode and focus on HCPCS column
  const startRowEditModeWithHcpcsFocus = (gridType: 'master' | 'client' | 'merged', rowId: number | string) => {
    const apiRef = gridType === 'master' ? masterApiRef :
                  gridType === 'client' ? clientApiRef : mergedApiRef;

    // Get the appropriate HCPCS column
    let hcpcsColumn: string | null = null;

    if (gridType === 'master') {
      hcpcsColumn = getHCPCSColumnMaster();
    } else if (gridType === 'client') {
      hcpcsColumn = getHCPCSColumnClient();
    } else {
      // For merged grid, find HCPCS column using the same logic as validation
      const hcpcsCol = mergedColumns.find(col =>
        col.field.toLowerCase().includes('hcpcs') ||
        col.field.toLowerCase().includes('cpt') ||
        col.field.toLowerCase().includes('code')
      );
      hcpcsColumn = hcpcsCol?.field || null;
    }

    console.log(`[FOCUS DEBUG] Starting edit mode for ${gridType} row ${rowId}, HCPCS column: ${hcpcsColumn}`);

    if (apiRef.current) {
      // First, force stop edit mode on ALL rows to ensure clean state
      try {
        const editingRows = apiRef.current.getRowModels();
        editingRows.forEach((_, id) => {
          if (apiRef.current?.getRowMode(id) === 'edit' && id !== rowId) {
            console.log(`[FOCUS DEBUG] Stopping edit mode on row ${id}`);
            apiRef.current.stopRowEditMode({ id });
          }
        });
      } catch (error) {
        console.log('[FOCUS DEBUG] Error stopping other edit modes:', error);
      }

      // Start row edit mode
      apiRef.current.startRowEditMode({ id: rowId });

      // Immediately move focus away from actions column to HCPCS column
      if (hcpcsColumn) {
        // Very quick first attempt to grab focus away from actions column
        setTimeout(() => {
          try {
            if (apiRef.current) {
              console.log(`[FOCUS DEBUG] Immediate focus grab attempt on ${hcpcsColumn}`);
              // Blur any currently focused element first
              if (document.activeElement && document.activeElement instanceof HTMLElement) {
                document.activeElement.blur();
              }
              apiRef.current.setCellFocus(rowId, hcpcsColumn!);
            }
          } catch (error) {
            console.log('[FOCUS DEBUG] Immediate focus attempt failed:', error);
          }
        }, 10); // Very short delay

        // Second attempt after 100ms
        setTimeout(() => {
          try {
            if (apiRef.current) {
              console.log(`[FOCUS DEBUG] Second focus attempt on ${hcpcsColumn}`);
              apiRef.current.setCellFocus(rowId, hcpcsColumn!);
            }
          } catch (error) {
            console.log('[FOCUS DEBUG] Second focus attempt failed:', error);
          }
        }, 100);

        // Third attempt after 300ms
        setTimeout(() => {
          try {
            if (apiRef.current) {
              console.log(`[FOCUS DEBUG] Third focus attempt on ${hcpcsColumn}`);
              apiRef.current.setCellFocus(rowId, hcpcsColumn!);
            }
          } catch (error) {
            console.log('[FOCUS DEBUG] Third focus attempt failed:', error);
          }
        }, 300);

        // Final attempt after 500ms with scroll
        setTimeout(() => {
          try {
            if (apiRef.current) {
              console.log(`[FOCUS DEBUG] Final focus attempt on ${hcpcsColumn} with scroll`);

              // Try to scroll to the cell first
              const rowIndex = apiRef.current.getRowIndexRelativeToVisibleRows(rowId);
              const colIndex = apiRef.current.getColumnIndex(hcpcsColumn!);
              if (rowIndex !== undefined && colIndex !== undefined) {
                apiRef.current.scrollToIndexes({ rowIndex, colIndex });
              }

              // Then focus
              apiRef.current.setCellFocus(rowId, hcpcsColumn!);
            }
          } catch (error) {
            console.log('[FOCUS DEBUG] Final focus attempt failed:', error);
          }
        }, 500);
      } else {
        console.log('[FOCUS DEBUG] No HCPCS column found for focusing');
        // If no HCPCS column, at least blur the actions column
        setTimeout(() => {
          if (document.activeElement && document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
        }, 10);
      }
    }
  };

  // Function to create actions column for row operations
  const createActionsColumn = useCallback((gridType: 'master' | 'client' | 'merged'): GridColDef => {
    return {
      field: 'actions',
      headerName: 'Actions',
      width: 140,
      editable: false,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      renderCell: (params: GridRenderCellParams) => {
        // Check if this row is in edit mode
        const isInEditMode = params.api.getRowMode(params.id) === 'edit';

        // Debug logging
        console.log(`[ACTIONS DEBUG] Row ${params.id} - isInEditMode: ${isInEditMode}`);

        return (
          <Box sx={{
            display: 'flex',
            gap: 0.5,
            // Make the entire actions cell non-focusable when in edit mode
            pointerEvents: isInEditMode ? 'none' : 'auto',
            opacity: isInEditMode ? 0.5 : 1
          }}>
            <Tooltip title={isInEditMode ? "Exit edit mode to use actions" : "Edit Row"}>
              <span>
                <IconButton
                  size="small"
                  disabled={isInEditMode}
                  tabIndex={isInEditMode ? -1 : 0} // Remove from tab order when disabled
                  onClick={(e) => {
                    e.stopPropagation();
                    startRowEditModeWithHcpcsFocus(gridType, params.row.id);
                  }}
                  sx={{
                    color: isInEditMode ? '#ccc' : '#1976d2',
                    pointerEvents: isInEditMode ? 'none' : 'auto'
                  }}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={isInEditMode ? "Exit edit mode to use actions" : "Duplicate Row"}>
              <span>
                <IconButton
                  size="small"
                  disabled={isInEditMode}
                  tabIndex={isInEditMode ? -1 : 0} // Remove from tab order when disabled
                  onClick={(e) => {
                    e.stopPropagation();
                    const result = handleDuplicateRecord(params.row.id, gridType);
                    if (!result.success) {
                      // Show user-friendly error message
                      console.error(`Failed to duplicate record with ID ${params.row.id} in ${gridType} grid`);
                      // You could add a toast notification here if you have one available
                    }
                  }}
                  sx={{
                    color: isInEditMode ? '#ccc' : '#ed6c02',
                    pointerEvents: isInEditMode ? 'none' : 'auto'
                  }}
                >
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={isInEditMode ? "Exit edit mode to use actions" : "Delete Row"}>
              <span>
                <IconButton
                  size="small"
                  disabled={isInEditMode}
                  tabIndex={isInEditMode ? -1 : 0} // Remove from tab order when disabled
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteRecord(params.row.id, gridType);
                  }}
                  sx={{
                    color: isInEditMode ? '#ccc' : '#d32f2f',
                    pointerEvents: isInEditMode ? 'none' : 'auto'
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        );
      },
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filtered data for each grid
  const filteredRowsMaster = filterAndSearchRowsLocal(rowsMaster, searchMaster, masterFilters);
  const filteredRowsClient = filterAndSearchRowsLocal(rowsClient, searchClient, clientFilters);
  const filteredMergedRows = filterAndSearchRowsLocal(mergedRows, searchMerged, mergedFilters);
  const filteredUnmatchedClient = filterAndSearchRowsLocal(unmatchedClient, "", unmatchedFilters);
  const filteredDupsClient = filterAndSearchRowsLocal(dupsClient, "", duplicatesFilters);

  // Enhanced merged columns (without Ask AI button - it will be added at the end)
  const enhancedMergedColumns = useMemo(() => {
    return mergedColumns;
  }, [mergedColumns]);

  // Enhanced columns with actions for each grid
  const enhancedMasterColumns = useMemo(() => {
    return [...columnsMaster, createActionsColumn('master')];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnsMaster]);

  const enhancedClientColumns = useMemo(() => {
    return [...columnsClient, createActionsColumn('client')];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnsClient]);

  const enhancedMergedColumnsWithActions = useMemo(() => {
    const hcpcsColumn = mergedColumns.find(col =>
      col.field.toLowerCase().includes('hcpcs')
    );

    // Create Ask AI column
    const askAIColumn: GridColDef = {
      field: 'askAI',
      headerName: 'Ask AI',
      width: 80,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      renderCell: (params) => {
        if (!hcpcsColumn) return null;
        const hcpcsValue = params.row[hcpcsColumn.field];
        if (!hcpcsValue) return null;

        return (
          <Tooltip title={`Ask AI: What is ${hcpcsValue} for?`}>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                askAIAboutCode(String(hcpcsValue));
              }}
              sx={{ color: '#1976d2' }}
            >
              <HelpOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        );
      }
    };

    // Add Actions column first, then Ask AI column at the very end
    return [...enhancedMergedColumns, createActionsColumn('merged'), askAIColumn];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enhancedMergedColumns, mergedColumns]);

  // AI Chat functions
  const getCurrentGridContext = useCallback(() => {
    const getCurrentData = () => {
      switch (aiSelectedGrid) {
        case 'master':
          return { rows: rowsMaster, columns: columnsMaster };
        case 'client':
          return { rows: rowsClient, columns: columnsClient };
        case 'merged':
          return { rows: mergedRows, columns: mergedColumns };
        case 'unmatched':
          return { rows: unmatchedClient, columns: columnsClient };
        case 'duplicates':
          return { rows: dupsClient, columns: columnsClient };
        default:
          return { rows: mergedRows, columns: mergedColumns };
      }
    };

    const { rows, columns } = getCurrentData();
    
    // Get selected row information for current grid (use checkbox selections if available, fallback to single selection)
    const getSelectedRowInfo = () => {
      console.log('[ROW SELECTION DEBUG] Getting row info for grid:', aiSelectedGrid);
      console.log('[ROW SELECTION DEBUG] All selection states:', {
        master: { single: selectedRowMaster, multi: selectedRowsMaster },
        client: { single: selectedRowClient, multi: selectedRowsClient },
        merged: { single: selectedRowMerged, multi: selectedRowsMerged },
        unmatched: { single: selectedRowUnmatched, multi: selectedRowsUnmatched },
        duplicates: { single: selectedRowDuplicates, multi: selectedRowsDuplicates }
      });
      
      switch (aiSelectedGrid) {
        case 'master':
          const masterSelectedId = selectedRowsMaster.length > 0 ? selectedRowsMaster[0] : selectedRowMaster;
          console.log('[ROW SELECTION DEBUG] Master grid selected ID:', masterSelectedId);
          return { selectedRowId: masterSelectedId, selectedRowData: masterSelectedId ? (rows.find(row => row.id === masterSelectedId) || null) : null };
        case 'client':
          const clientSelectedId = selectedRowsClient.length > 0 ? selectedRowsClient[0] : selectedRowClient;
          console.log('[ROW SELECTION DEBUG] Client grid selected ID:', clientSelectedId);
          return { selectedRowId: clientSelectedId, selectedRowData: clientSelectedId ? (rows.find(row => row.id === clientSelectedId) || null) : null };
        case 'merged':
          const mergedSelectedId = selectedRowsMerged.length > 0 ? selectedRowsMerged[0] : selectedRowMerged;
          console.log('[ROW SELECTION DEBUG] Merged grid selected ID:', mergedSelectedId);
          console.log('[ROW SELECTION DEBUG] selectedRowsMerged:', selectedRowsMerged);
          console.log('[ROW SELECTION DEBUG] selectedRowMerged:', selectedRowMerged);
          console.log('[ROW SELECTION DEBUG] rows length:', rows.length);
          const foundRow = mergedSelectedId ? (rows.find(row => row.id === mergedSelectedId) || null) : null;
          console.log('[ROW SELECTION DEBUG] Found row data:', foundRow ? 'found' : 'not found');
          return { selectedRowId: mergedSelectedId, selectedRowData: foundRow };
        case 'unmatched':
          const unmatchedSelectedId = selectedRowsUnmatched.length > 0 ? selectedRowsUnmatched[0] : selectedRowUnmatched;
          console.log('[ROW SELECTION DEBUG] Unmatched grid selected ID:', unmatchedSelectedId);
          return { selectedRowId: unmatchedSelectedId, selectedRowData: unmatchedSelectedId ? (rows.find(row => row.id === unmatchedSelectedId) || null) : null };
        case 'duplicates':
          const duplicatesSelectedId = selectedRowsDuplicates.length > 0 ? selectedRowsDuplicates[0] : selectedRowDuplicates;
          console.log('[ROW SELECTION DEBUG] Duplicates grid selected ID:', duplicatesSelectedId);
          return { selectedRowId: duplicatesSelectedId, selectedRowData: duplicatesSelectedId ? (rows.find(row => row.id === duplicatesSelectedId) || null) : null };
        default:
          return { selectedRowId: null, selectedRowData: null };
      }
    };
    
    const { selectedRowId, selectedRowData } = getSelectedRowInfo();
    
    console.log('[DEBUG CONTEXT] Final selected row info:', { selectedRowId, selectedRowData: selectedRowData ? 'present' : 'null' });
    
    // Extract HCPCS information for user-friendly row identification
    const getHcpcsInfo = (rowData: Record<string, unknown> | null) => {
      if (!rowData) return null;
      
      // Find HCPCS column (case-insensitive search)
      const hcpcsKey = Object.keys(rowData).find(key => 
        key.toLowerCase().includes('hcpcs')
      );
      
      // Find modifier column (case-insensitive search)
      const modifierKey = Object.keys(rowData).find(key => 
        key.toLowerCase().includes('modifier') || key.toLowerCase().includes('mod')
      );
      
      const hcpcs = hcpcsKey ? String(rowData[hcpcsKey] || '').trim() : '';
      const modifier = modifierKey ? String(rowData[modifierKey] || '').trim() : '';
      
      if (hcpcs) {
        return modifier ? `${hcpcs}-${modifier}` : hcpcs;
      }
      
      return null;
    };
    
    const selectedHcpcs = getHcpcsInfo(selectedRowData);
    
    // Get count of selected rows for current grid
    const getSelectedRowCount = () => {
      let count = 0;
      switch (aiSelectedGrid) {
        case 'master':
          count = selectedRowsMaster.length || (selectedRowMaster ? 1 : 0);
          break;
        case 'client':
          count = selectedRowsClient.length || (selectedRowClient ? 1 : 0);
          break;
        case 'merged':
          count = selectedRowsMerged.length || (selectedRowMerged ? 1 : 0);
          break;
        case 'unmatched':
          count = selectedRowsUnmatched.length || (selectedRowUnmatched ? 1 : 0);
          break;
        case 'duplicates':
          count = selectedRowsDuplicates.length || (selectedRowDuplicates ? 1 : 0);
          break;
        default:
          count = 0;
      }
      console.log(`[GET SELECTED COUNT] Grid: ${aiSelectedGrid}, Count: ${count}, Arrays:`, {
        selectedRowsMaster, selectedRowsClient, selectedRowsMerged, selectedRowsUnmatched, selectedRowsDuplicates
      });
      return count;
    };
    
    const selectedRowCount = getSelectedRowCount();
    
    console.log('[CONTEXT CREATION] Grid context for AI:', {
      aiSelectedGrid,
      selectedRowId,
      selectedHcpcs,
      selectedRowCount,
      hasSelectedRowData: !!selectedRowData,
      allSelections: {
        master: { single: selectedRowMaster, multi: selectedRowsMaster },
        client: { single: selectedRowClient, multi: selectedRowsClient },
        merged: { single: selectedRowMerged, multi: selectedRowsMerged }
      }
    });
    
    console.log('[CONTEXT CREATION] Raw selection arrays:', {
      selectedRowsMaster,
      selectedRowsClient,
      selectedRowsMerged,
      selectedRowsUnmatched,
      selectedRowsDuplicates
    });
    
    return {
      columns: columns.map(col => col.field),
      rowCount: rows.length,
      sampleData: rows.slice(0, 5),
      currentView: aiSelectedGrid,
      availableGrids: {
        master: { hasData: rowsMaster.length > 0, rowCount: rowsMaster.length },
        client: { hasData: rowsClient.length > 0, rowCount: rowsClient.length },
        merged: { hasData: mergedRows.length > 0, rowCount: mergedRows.length },
        unmatched: { hasData: unmatchedClient.length > 0, rowCount: unmatchedClient.length },
        duplicates: { hasData: dupsClient.length > 0, rowCount: dupsClient.length },
      },
      isInCompareMode: showCompare,
      selectedGrid: aiSelectedGrid,
      selectedRowId: selectedRowId,
      selectedRowData: selectedRowData,
      selectedHcpcs: selectedHcpcs,
      selectedRowCount: selectedRowCount,
    };
  }, [
    aiSelectedGrid,
    selectedRowMaster,
    selectedRowClient,
    selectedRowMerged,
    selectedRowUnmatched,
    selectedRowDuplicates,
    selectedRowsMaster,
    selectedRowsClient,
    selectedRowsMerged,
    selectedRowsUnmatched,
    selectedRowsDuplicates,
    rowsMaster,
    rowsClient,
    mergedRows,
    unmatchedClient,
    dupsClient,
    columnsMaster,
    columnsClient,
    mergedColumns,
    showCompare
  ]);

  // Grid context that reflects current state without memoization for immediate updates
  const gridContext = getCurrentGridContext();
  
  // Only log when there's a selection to avoid spam
  if (gridContext.selectedRowId) {
    console.log('[GRID CONTEXT] Current context for AI:', {
      selectedGrid: gridContext.selectedGrid,
      selectedRowId: gridContext.selectedRowId,
      selectedRowData: gridContext.selectedRowData ? 'present' : 'null',
      rowCount: gridContext.rowCount,
      selectedRowCount: gridContext.selectedRowCount
    });
  }

  // Helper function to get currently selected row ID
  const getCurrentSelectedRowId = () => {
    let selectedId = null;
    switch (aiSelectedGrid) {
      case 'master':
        selectedId = selectedRowsMaster.length > 0 ? selectedRowsMaster[0] : selectedRowMaster;
        break;
      case 'client':
        selectedId = selectedRowsClient.length > 0 ? selectedRowsClient[0] : selectedRowClient;
        break;
      case 'merged':
        selectedId = selectedRowsMerged.length > 0 ? selectedRowsMerged[0] : selectedRowMerged;
        break;
      case 'unmatched':
        selectedId = selectedRowsUnmatched.length > 0 ? selectedRowsUnmatched[0] : selectedRowUnmatched;
        break;
      case 'duplicates':
        selectedId = selectedRowsDuplicates.length > 0 ? selectedRowsDuplicates[0] : selectedRowDuplicates;
        break;
      default:
        selectedId = null;
    }
    
    console.log(`[GET SELECTED ROW ID] Grid: ${aiSelectedGrid}, Selected ID: ${selectedId}`);
    return selectedId;
  };

  const handleAIAction = (intent: AIIntent) => {
    console.log('[AI ACTION DEBUG] Received intent:', intent);
    console.log('[AI ACTION DEBUG] Intent type:', intent.type, 'Action:', intent.action);
    console.log('[AI ACTION DEBUG] Parameters:', intent.parameters);
    console.log('[AI ACTION DEBUG] Current aiSelectedGrid:', aiSelectedGrid);
    
    // Handle documentation questions - no grid action needed
    if (intent.type === 'documentation' || intent.action === 'explain') {
      // Just log for now - the response is already displayed in chat
      console.log('Documentation question answered:', intent.response);
      return;
    }

    // FALLBACK: If AI returned a query but we can detect it should be an action
    if (intent.type === 'query' && intent.response) {
      const response = intent.response.toLowerCase();
      
      // Check for duplicate commands
      if ((response.includes('duplicat') && (response.includes('current') || response.includes('selected'))) ||
          response.includes('duplicating the currently selected row') ||
          response.includes('duplicating the selected row')) {
        
        const selectedRowId = getCurrentSelectedRowId();
        console.log('[AI FALLBACK] Duplicate command detected, current selection:', selectedRowId);
        if (selectedRowId !== null) {
          console.log('[AI FALLBACK] Converting query to duplicate action, rowId:', selectedRowId);
          const duplicateIntent: AIIntent = {
            type: 'action',
            action: 'duplicate',
            parameters: { rowId: selectedRowId },
            response: 'Duplicating the currently selected row'
          };
          // Recursively call handleAIAction with the corrected intent
          handleAIAction(duplicateIntent);
          return;
        } else {
          console.error('[AI FALLBACK] No row selected for duplicate command');
        }
      }
    }
    
    // Function to ensure grid is visible and scroll to it
    const ensureGridVisible = (targetView: string) => {
      switch (targetView) {
        case 'master':
          setShowCompare(false);
          setTimeout(() => scrollToActiveGrid('master'), 300);
          break;
        case 'client':
          setShowCompare(false);
          setTimeout(() => scrollToActiveGrid('client'), 300);
          break;
        case 'merged':
          setShowCompare(true);
          setErrorsTabValue(-1);
          setTimeout(() => scrollToActiveGrid('merged'), 500);
          break;
        case 'unmatched':
          setShowCompare(true);
          setErrorsTabValue(0);
          setTimeout(() => scrollToActiveGrid('unmatched'), 500);
          break;
        case 'duplicates':
          setShowCompare(true); 
          setErrorsTabValue(1);
          setTimeout(() => scrollToActiveGrid('duplicates'), 500);
          break;
      }
    };
    
    if (intent.action === 'switch' && intent.parameters?.view) {
      const view = intent.parameters.view as 'master' | 'client' | 'merged' | 'unmatched' | 'duplicates';
      
      // Update AI selected grid
      setAiSelectedGrid(view);
      
      // Ensure grid is visible and scroll to it
      ensureGridVisible(view);
    }
    
    if (intent.action === 'search' && intent.parameters?.value) {
      const searchValue = intent.parameters.value;
      const targetView = intent.parameters?.view || aiSelectedGrid;
      
      // Update AI selected grid if specified
      if (intent.parameters?.view) {
        setAiSelectedGrid(intent.parameters.view as typeof aiSelectedGrid);
        ensureGridVisible(intent.parameters.view);
      } else {
        // Scroll to current grid to show the search results
        ensureGridVisible(targetView);
      }
      
      switch (targetView) {
        case 'master':
          setSearchMasterInput(searchValue);
          setSearchMaster(searchValue);
          break;
        case 'client':
          setSearchClientInput(searchValue);
          setSearchClient(searchValue);
          break;
        case 'merged':
          setSearchMergedInput(searchValue);
          setSearchMerged(searchValue);
          break;
      }
    }

    if (intent.action === 'filter' && intent.parameters?.condition) {
      const column = intent.parameters.column || 'hcpcs'; // Default column for special conditions
      const condition = intent.parameters.condition;
      const value = intent.parameters.value || '';
      const targetView = intent.parameters?.view || aiSelectedGrid;
      
      // Update AI selected grid if specified
      if (intent.parameters?.view) {
        setAiSelectedGrid(intent.parameters.view as typeof aiSelectedGrid);
        ensureGridVisible(intent.parameters.view);
      } else {
        // Scroll to current grid to show the filter results
        ensureGridVisible(targetView);
      }
      
      const newFilter = { column, condition, value };
      
      console.log('[FILTER DEBUG] Applying filter:', newFilter, 'to grid:', targetView);
      
      // Add filter to the correct grid
      switch (targetView) {
        case 'master':
          setMasterFilters(prev => [...prev.filter(f => f.column !== column), newFilter]);
          break;
        case 'client':
          setClientFilters(prev => [...prev.filter(f => f.column !== column), newFilter]);
          break;
        case 'merged':
          setMergedFilters(prev => [...prev.filter(f => f.column !== column), newFilter]);
          break;
        case 'unmatched':
          setUnmatchedFilters(prev => [...prev.filter(f => f.column !== column), newFilter]);
          break;
        case 'duplicates':
          setDuplicatesFilters(prev => [...prev.filter(f => f.column !== column), newFilter]);
          break;
      }
      
      console.log(`Applied filter: ${column} ${condition} ${value} to ${targetView} grid`);
    }

    if (intent.action === 'clear_filters') {
      const targetView = intent.parameters?.view || aiSelectedGrid;
      
      // Update AI selected grid if specified
      if (intent.parameters?.view) {
        setAiSelectedGrid(intent.parameters.view as typeof aiSelectedGrid);
        ensureGridVisible(intent.parameters.view);
      } else {
        // Scroll to current grid to show the cleared filters
        ensureGridVisible(targetView);
      }
      
      switch (targetView) {
        case 'master':
          setMasterFilters([]);
          break;
        case 'client':
          setClientFilters([]);
          break;
        case 'merged':
          setMergedFilters([]);
          break;
        case 'unmatched':
          setUnmatchedFilters([]);
          break;
        case 'duplicates':
          setDuplicatesFilters([]);
          break;
      }
      
      console.log(`Cleared filters for ${targetView} grid`);
    }

    if (intent.action === 'sort' && intent.parameters?.column) {
      const column = intent.parameters.column;
      const direction = intent.parameters.direction || 'asc';
      const targetView = intent.parameters?.view || aiSelectedGrid;
      
      console.log('[AI SORT DEBUG] Processing sort command:', {
        column,
        direction,
        targetView,
        aiSelectedGrid,
        intentParameters: intent.parameters
      });
      
      // Get the available columns for the target grid
      let targetColumns: GridColDef[] = [];
      switch (targetView) {
        case 'master':
          targetColumns = columnsMaster;
          break;
        case 'client':
          targetColumns = columnsClient;
          break;
        case 'merged':
          targetColumns = mergedColumns;
          break;
        case 'unmatched':
          targetColumns = columnsClient;
          break;
        case 'duplicates':
          targetColumns = columnsClient;
          break;
      }
      
      console.log('[AI SORT DEBUG] Available columns for', targetView, ':', targetColumns.map(col => col.field));
      
      // Try to find the exact column match or a case-insensitive match
      let matchedColumn = targetColumns.find(col => col.field === column)?.field;
      if (!matchedColumn) {
        // Try case-insensitive match
        matchedColumn = targetColumns.find(col => 
          col.field.toLowerCase() === column.toLowerCase()
        )?.field;
      }
      if (!matchedColumn) {
        // Try partial match (column name contains the search term or vice versa)
        matchedColumn = targetColumns.find(col => 
          col.field.toLowerCase().includes(column.toLowerCase()) ||
          column.toLowerCase().includes(col.field.toLowerCase())
        )?.field;
      }
      
      console.log('[AI SORT DEBUG] Column matching result:', {
        requestedColumn: column,
        matchedColumn,
        matchFound: !!matchedColumn
      });
      
      if (!matchedColumn) {
        console.error('[AI SORT ERROR] Column not found:', column, 'Available columns:', targetColumns.map(col => col.field));
        
        // Create a user-friendly error message
        const availableColumnNames = targetColumns.map(col => col.field).join(', ');
        const errorMessage = `Sorry, I couldn't find a column named "${column}" in the ${targetView} grid. Available columns are: ${availableColumnNames}`;
        
        // You could add a callback here to show this error in the AI chat
        // For now, just log it prominently
        console.error('[AI SORT ERROR MESSAGE]', errorMessage);
        return;
      }
      
      // Update AI selected grid if specified
      if (intent.parameters?.view) {
        setAiSelectedGrid(intent.parameters.view as typeof aiSelectedGrid);
        ensureGridVisible(intent.parameters.view);
      } else {
        // Scroll to current grid to show the sort results
        ensureGridVisible(targetView);
      }
      
      const sortModel = [{ field: matchedColumn, sort: direction }];
      
      console.log('[AI SORT DEBUG] Applying sort model:', sortModel, 'to grid:', targetView);
      
      // Apply sorting to the correct grid
      switch (targetView) {
        case 'master':
          setMasterSortModel(sortModel);
          console.log('[AI SORT DEBUG] Master sort model set');
          break;
        case 'client':
          setClientSortModel(sortModel);
          console.log('[AI SORT DEBUG] Client sort model set');
          break;
        case 'merged':
          setMergedSortModel(sortModel);
          console.log('[AI SORT DEBUG] Merged sort model set');
          break;
        case 'unmatched':
          setUnmatchedSortModel(sortModel);
          console.log('[AI SORT DEBUG] Unmatched sort model set');
          break;
        case 'duplicates':
          setDuplicatesSortModel(sortModel);
          console.log('[AI SORT DEBUG] Duplicates sort model set');
          break;
      }
      
      console.log(`[AI SORT SUCCESS] Applied sorting: ${matchedColumn} ${direction} to ${targetView} grid`);
    }

    if (intent.action === 'export') {
      const targetView = intent.parameters?.view || aiSelectedGrid;
      const customFilename = intent.parameters?.filename;
      
      // For now, only support exporting merged data
      if (targetView === 'merged' || !intent.parameters?.view) {
        if (mergedForExport.length === 0) {
          console.log('No merged data available for export');
          return;
        }
        
        if (customFilename) {
          // Call export with custom filename
          handleExportWithFilename(customFilename);
        } else {
          // Call standard export
          handleExport();
        }
        
        // Scroll to merged grid to show the export happened
        ensureGridVisible('merged');
      } else {
        console.log(`Export not supported for ${targetView} grid yet`);
      }
    }

    if (intent.action === 'duplicate' && intent.parameters?.rowId) {
      const targetView = intent.parameters?.view || aiSelectedGrid;
      const rowId = intent.parameters.rowId;
      
      console.log('[DUPLICATE ACTION] Processing duplicate request:', {
        targetView,
        rowId,
        aiSelectedGrid,
        intentView: intent.parameters?.view
      });
      
      // Update AI selected grid if specified
      if (intent.parameters?.view) {
        setAiSelectedGrid(intent.parameters.view as typeof aiSelectedGrid);
        ensureGridVisible(intent.parameters.view);
      } else {
        // Scroll to current grid to show the duplication
        ensureGridVisible(targetView);
      }
      
      // Add a small delay to ensure state is synchronized
      setTimeout(() => {
        // Get HCPCS info for the row being duplicated
        const getRowHcpcs = (data: Record<string, unknown> | null | undefined) => {
          if (!data) return null;
          const hcpcsKey = Object.keys(data).find(key => key.toLowerCase().includes('hcpcs'));
          const modifierKey = Object.keys(data).find(key => key.toLowerCase().includes('modifier') || key.toLowerCase().includes('mod'));
          const hcpcs = hcpcsKey ? String(data[hcpcsKey] || '').trim() : '';
          const modifier = modifierKey ? String(data[modifierKey] || '').trim() : '';
          return hcpcs ? (modifier ? `${hcpcs}-${modifier}` : hcpcs) : null;
        };
        
        // Get the current row data for HCPCS identification
        const currentRows = targetView === 'master' ? rowsMaster : targetView === 'client' ? rowsClient : mergedRows;
        const rowToAnalyze = currentRows.find(row => row.id === rowId);
        const hcpcsCode = getRowHcpcs(rowToAnalyze);
        
        // Call the duplicate function
        const result = handleDuplicateRecord(rowId, targetView as 'master' | 'client' | 'merged');
        console.log('[DUPLICATE ACTION] Duplicate result:', result);
        
        if (result.success && result.newRowId) {
          const identifier = hcpcsCode ? `HCPCS code ${hcpcsCode}` : `row ID ${result.originalRowId}`;
          console.log(`✅ Successfully duplicated ${identifier} in ${targetView} grid. New record ID: ${result.newRowId}`);
        } else {
          const identifier = hcpcsCode ? `HCPCS code ${hcpcsCode}` : `row ID ${result.originalRowId}`;
          console.error(`❌ Failed to duplicate ${identifier} in ${targetView} grid`);
        }
      }, 100); // Small delay to ensure state synchronization
    }

    if (intent.action === 'delete') {
      const targetView = intent.parameters?.view || aiSelectedGrid;
      
      // Update AI selected grid if specified
      if (intent.parameters?.view) {
        setAiSelectedGrid(intent.parameters.view as typeof aiSelectedGrid);
        ensureGridVisible(intent.parameters.view);
      } else {
        // Scroll to current grid to show the deletion
        ensureGridVisible(targetView);
      }
      
      // Check if we have a specific rowId or should delete all selected rows
      if (intent.parameters?.rowId) {
        // Single row delete
        const rowId = intent.parameters.rowId;
        handleDeleteRecord(rowId, targetView as 'master' | 'client' | 'merged');
        console.log(`Deleted record ${rowId} from ${targetView} grid`);
      } else {
        // Bulk delete - get all selected rows for the current grid
        let selectedRowIds: (number | string)[] = [];
        
        switch (targetView) {
          case 'master':
            selectedRowIds = selectedRowsMaster.length > 0 ? selectedRowsMaster : (selectedRowMaster ? [selectedRowMaster] : []);
            break;
          case 'client':
            selectedRowIds = selectedRowsClient.length > 0 ? selectedRowsClient : (selectedRowClient ? [selectedRowClient] : []);
            break;
          case 'merged':
            selectedRowIds = selectedRowsMerged.length > 0 ? selectedRowsMerged : (selectedRowMerged ? [selectedRowMerged] : []);
            break;
          case 'unmatched':
            selectedRowIds = selectedRowsUnmatched.length > 0 ? selectedRowsUnmatched : (selectedRowUnmatched ? [selectedRowUnmatched] : []);
            break;
          case 'duplicates':
            selectedRowIds = selectedRowsDuplicates.length > 0 ? selectedRowsDuplicates : (selectedRowDuplicates ? [selectedRowDuplicates] : []);
            break;
        }
        
        console.log(`[DELETE ACTION] Bulk delete requested for ${targetView} grid. Selected rows:`, selectedRowIds);
        
        if (selectedRowIds.length > 0) {
          // Get HCPCS codes for the rows being deleted for better feedback
          const currentRows = targetView === 'master' ? rowsMaster : targetView === 'client' ? rowsClient : mergedRows;
          const rowsToDelete = currentRows.filter(row => selectedRowIds.includes(row.id));
          const hcpcsCodes = rowsToDelete.map(row => {
            const hcpcsKey = Object.keys(row).find(key => key.toLowerCase().includes('hcpcs'));
            const modifierKey = Object.keys(row).find(key => key.toLowerCase().includes('modifier') || key.toLowerCase().includes('mod'));
            const hcpcs = hcpcsKey ? String(row[hcpcsKey] || '').trim() : '';
            const modifier = modifierKey ? String(row[modifierKey] || '').trim() : '';
            return hcpcs ? (modifier ? `${hcpcs}-${modifier}` : hcpcs) : `ID ${row.id}`;
          });
          
          const result = handleDeleteMultipleRecords(selectedRowIds, targetView as 'master' | 'client' | 'merged');
          if (result.success) {
            console.log(`✅ Successfully deleted ${result.deletedCount} records: ${hcpcsCodes.join(', ')}`);
          }
        } else {
          console.log(`❌ No rows selected for deletion in ${targetView} grid`);
        }
      }
    }

    if (intent.action === 'add') {
      const targetView = intent.parameters?.view || aiSelectedGrid;
      const rowData = intent.parameters?.rowData;
      
      // Update AI selected grid if specified
      if (intent.parameters?.view) {
        setAiSelectedGrid(intent.parameters.view as typeof aiSelectedGrid);
        ensureGridVisible(intent.parameters.view);
      } else {
        // Scroll to current grid to show the addition
        ensureGridVisible(targetView);
      }
      
      // Call the add function
      handleAddRecord(targetView as 'master' | 'client' | 'merged', rowData);
      console.log(`Added new record to ${targetView} grid`);
    }
  };

  // Sample data loading function
  const handleLoadSampleData = async () => {
    try {
      console.log('[SAMPLE DATA] Starting to load sample data...');
      
      // Load the sample files
      const masterFileResponse = await fetch('/sample%20sheets/ED%20Master%20CDM%202025.xlsx');
      const clientFileResponse = await fetch('/sample%20sheets/Client%20ED%20w%20Hyphens.xlsx');
      
      if (!masterFileResponse.ok || !clientFileResponse.ok) {
        console.error('[SAMPLE DATA] Failed to fetch sample files');
        return;
      }
      
      const masterBlob = await masterFileResponse.blob();
      const clientBlob = await clientFileResponse.blob();
      
      // Create File objects
      const masterFile = new File([masterBlob], 'ED Master CDM 2025.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const clientFile = new File([clientBlob], 'Client ED w Hyphens.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      
      console.log('[SAMPLE DATA] Sample files loaded, processing master file...');
      
      // Load master file first
      await new Promise<void>((resolve) => {
        handleFileUpload(masterFile, "Master", false);
        // Wait a bit for the master file to process
        setTimeout(resolve, 1000);
      });
      
      console.log('[SAMPLE DATA] Master file processed, processing client file...');
      
      // Load client file second
      await new Promise<void>((resolve) => {
        handleFileUpload(clientFile, "Client", false);
        // Wait a bit for the client file to process
        setTimeout(resolve, 1000);
      });
      
      console.log('[SAMPLE DATA] Both files processed, will auto-compare when ready...');
      
    } catch (error) {
      console.error('[SAMPLE DATA] Error loading sample data:', error);
    }
  };

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement> | File,
    which: "Master" | "Client",
    isRestore = false
  ) => {
    let file: File | undefined;
    if (e instanceof File) {
      file = e;
    } else {
      file = e.target.files?.[0];
    }
    if (!file) return;

    // Save the file name to localStorage and update state
    if (which === "Master") {
      localStorage.setItem("lastMasterFile", file.name);
      setLastMasterFile(file.name);
    } else {
      localStorage.setItem("lastClientFile", file.name);
      setLastClientFile(file.name);
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      if (!data) return;
      const arrayBuffer = data as ArrayBuffer;
      const base64Data = btoa(new Uint8Array(arrayBuffer).reduce((acc, byte) => acc + String.fromCharCode(byte), ''));
      
      // Process all sheets
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheets = workbook.SheetNames;
      console.log(`[DEBUG] File ${which} has ${sheets.length} sheets:`, sheets);
      
      // Calculate total record count across all sheets
      let totalRecords = 0;
      let totalColumns = 0;
      sheets.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        if (json.length > 0) {
          totalRecords += Math.max(0, json.length - 1); // Subtract header row
          totalColumns = Math.max(totalColumns, (json[0] as string[]).length);
        }
      });
      
      // Create file metadata only for new uploads, not for restores
      if (!isRestore) {
        const metadata: FileMetadata = {
          name: file.name,
          size: file.size,
          uploadTime: new Date(),
          sheetCount: sheets.length,
          recordCount: totalRecords,
          columnCount: totalColumns
        };
        
        // Save file data and metadata
        if (which === "Master") {
          localStorage.setItem("lastMasterData", base64Data);
          setLastMasterData(base64Data);
          localStorage.setItem("lastMasterSheet", sheets[0]);
          localStorage.setItem("lastMasterMetadata", JSON.stringify(metadata));
          setMasterFileMetadata(metadata);
          console.log('[DEBUG] Master metadata set:', metadata);
        } else {
          localStorage.setItem("lastClientData", base64Data);
          setLastClientData(base64Data);
          localStorage.setItem("lastClientSheet", sheets[0]);
          localStorage.setItem("lastClientMetadata", JSON.stringify(metadata));
          setClientFileMetadata(metadata);
          console.log('[DEBUG] Client metadata set:', metadata);
        }
      } else {
        // For restore operations, only update the data and sheet info
        if (which === "Master") {
          setLastMasterData(base64Data);
        } else {
          setLastClientData(base64Data);
        }
      }
      
      // Process all sheets and store them
      processAllSheets(arrayBuffer, which, sheets);
    };
    reader.readAsArrayBuffer(file);
  };

  // Compare logic
  // Remove mergeSource state and related code

  // Find HCPCS and Modifier columns for each file independently
  const getHCPCSColumnMaster = useCallback(() => {
    const hcpcsColumn = columnsMaster.find(col => 
      findMatchingColumn("HCPCS", [col]) === col.field
    );
    return hcpcsColumn?.field || null;
  }, [columnsMaster]);
  
  const getHCPCSColumnClient = useCallback(() => {
    const hcpcsColumn = columnsClient.find(col => 
      findMatchingColumn("HCPCS", [col]) === col.field
    );
    return hcpcsColumn?.field || null;
  }, [columnsClient]);
  
  const getModifierColumnMaster = useCallback(() => {
    const modifierColumn = columnsMaster.find(col => 
      findMatchingColumn("MODIFIER", [col]) === col.field
    );
    return modifierColumn?.field || null;
  }, [columnsMaster]);
  
  const getModifierColumnClient = useCallback(() => {
    const modifierColumn = columnsClient.find(col => 
      findMatchingColumn("MODIFIER", [col]) === col.field
    );
    return modifierColumn?.field || null;
  }, [columnsClient]);

  // Improved HCPCS parsing: supports XXXXX-YY, XXXXXYY, and separate Modifier column
  function parseHCPCS(row: ExcelRow, hcpcsCol: string, modifierCol: string | null): { root: string, modifier: string } {
    let hcpcs = String(row[hcpcsCol] || "").toUpperCase().trim();
    let modifier = "";
    if (modifierCol && row[modifierCol]) {
      modifier = String(row[modifierCol]).toUpperCase().trim();
    } else if (hcpcs.length === 8 && hcpcs[5] === '-') {
      // Format: XXXXX-YY
      modifier = hcpcs.substring(6, 8);
      hcpcs = hcpcs.substring(0, 5);
    } else if (hcpcs.length === 7) {
      // Format: XXXXXYY (no dash)
      modifier = hcpcs.substring(5, 7);
      hcpcs = hcpcs.substring(0, 5);
    } else if (hcpcs.length > 5) {
      // Fallback: try to extract modifier
      modifier = hcpcs.substring(5);
      hcpcs = hcpcs.substring(0, 5);
    }
    return { root: hcpcs, modifier };
  }

  // Helper to get description column name (case-insensitive)
  const getDescriptionCol = useCallback((cols: GridColDef[]): string | null => {
    const descColumn = cols.find(col => 
      findMatchingColumn("DESCRIPTION", [col]) === col.field
    );
    return descColumn?.field || null;
  }, []);
  
  // Advanced column matching with multiple fallback strategies
  function findMatchingColumn(masterField: string, clientColumns: GridColDef[]): string | null {
    const clientFields = clientColumns.map(col => col.field);
    
    // Strategy 1: Exact match
    if (clientFields.includes(masterField)) {
      console.log(`[COLUMN MATCH] Exact match: ${masterField}`);
      return masterField;
    }
    
    // Strategy 2: Case-insensitive match
    const caseInsensitiveMatch = clientFields.find(field => 
      field.toLowerCase() === masterField.toLowerCase()
    );
    if (caseInsensitiveMatch) {
      console.log(`[COLUMN MATCH] Case-insensitive match: ${masterField} -> ${caseInsensitiveMatch}`);
      return caseInsensitiveMatch;
    }
    
    // Strategy 3: Normalized match (remove spaces, underscores, special chars)
    const normalizeField = (field: string) => field.toLowerCase().replace(/[\s_-]+/g, '');
    const normalizedMaster = normalizeField(masterField);
    const normalizedMatch = clientFields.find(field => 
      normalizeField(field) === normalizedMaster
    );
    if (normalizedMatch) {
      console.log(`[COLUMN MATCH] Normalized match: ${masterField} -> ${normalizedMatch}`);
      return normalizedMatch;
    }
    
    // Strategy 4: Partial match (master field contains client field or vice versa)
    const partialMatch = clientFields.find(field => {
      const masterLower = masterField.toLowerCase();
      const fieldLower = field.toLowerCase();
      return masterLower.includes(fieldLower) || fieldLower.includes(masterLower);
    });
    if (partialMatch) {
      console.log(`[COLUMN MATCH] Partial match: ${masterField} -> ${partialMatch}`);
      return partialMatch;
    }
    
    // Strategy 5: Fuzzy match for common variations
    const fuzzyMatches: {[key: string]: string[]} = {
      'hcpcs': ['hcpc', 'code', 'procedure_code', 'proc_code', 'cpt'],
      'modifier': ['mod', 'modif', 'modifier_code'],
      'description': ['desc', 'procedure_desc', 'proc_desc', 'name', 'procedure_name'],
      'quantity': ['qty', 'units', 'unit', 'count'],
      'price': ['amount', 'cost', 'charge', 'rate', 'fee'],
      'date': ['service_date', 'dos', 'date_of_service']
    };
    
    const masterLower = masterField.toLowerCase();
    for (const [standard, variations] of Object.entries(fuzzyMatches)) {
      if (masterLower.includes(standard) || variations.some(v => masterLower.includes(v))) {
        const fuzzyMatch = clientFields.find(field => {
          const fieldLower = field.toLowerCase();
          return fieldLower.includes(standard) || variations.some(v => fieldLower.includes(v));
        });
        if (fuzzyMatch) {
          console.log(`[COLUMN MATCH] Fuzzy match: ${masterField} -> ${fuzzyMatch} (via ${standard})`);
          return fuzzyMatch;
        }
      }
    }
    
    console.log(`[COLUMN MATCH] No match found for: ${masterField}`);
    return null;
  }
  
  // Create column mapping between master and client
  const createColumnMapping = useCallback((masterColumns: GridColDef[], clientColumns: GridColDef[]): {[masterField: string]: string} => {
    const mapping: {[masterField: string]: string} = {};
    
    masterColumns.forEach(masterCol => {
      const matchingClientField = findMatchingColumn(masterCol.field, clientColumns);
      if (matchingClientField) {
        mapping[masterCol.field] = matchingClientField;
      }
    });
    
    console.log('[COLUMN MAPPING] Final mapping:', mapping);
    return mapping;
  }, []);

  // Function to set default HCPCS sorting for all grids
  const setHcpcsDefaultSorting = useCallback(() => {
    // Get HCPCS columns for master and client
    const hcpcsColMaster = getHCPCSColumnMaster();
    const hcpcsColClient = getHCPCSColumnClient();
    
    // Find HCPCS column in merged columns (case-insensitive search)
    const hcpcsColMerged = mergedColumns.find(col =>
      col.field.toLowerCase().includes('hcpcs')
    )?.field;
    
    console.log('[HCPCS SORT] Applied default sorting - Master:', hcpcsColMaster, 'Client:', hcpcsColClient, 'Merged:', hcpcsColMerged);
    
    // Set default sort for master grid
    if (hcpcsColMaster && columnsMaster.length > 0) {
      const masterSort: GridSortModel = [{ field: hcpcsColMaster, sort: 'asc' }];
      setMasterSortModel(masterSort);
    }
    
    // Set default sort for client grid
    if (hcpcsColClient && columnsClient.length > 0) {
      const clientSort: GridSortModel = [{ field: hcpcsColClient, sort: 'asc' }];
      setClientSortModel(clientSort);
    }
    
    // Set default sort for merged grid (find HCPCS column directly)
    if (hcpcsColMerged && mergedColumns.length > 0) {
      const mergedSort: GridSortModel = [{ field: hcpcsColMerged, sort: 'asc' }];
      setMergedSortModel(mergedSort);
    }
    
    // Set default sort for unmatched grid (uses client column structure)
    if (hcpcsColClient && unmatchedClient.length > 0) {
      const unmatchedSort: GridSortModel = [{ field: hcpcsColClient, sort: 'asc' }];
      setUnmatchedSortModel(unmatchedSort);
    }
    
    // Set default sort for duplicates grid (uses client column structure)
    if (hcpcsColClient && dupsClient.length > 0) {
      const duplicatesSort: GridSortModel = [{ field: hcpcsColClient, sort: 'asc' }];
      setDuplicatesSortModel(duplicatesSort);
    }
  }, [getHCPCSColumnMaster, getHCPCSColumnClient, columnsMaster, columnsClient, mergedColumns, unmatchedClient.length, dupsClient.length]);

  const handleMerge = useCallback(() => {
    // Start timing the comparison
    const startTime = performance.now();
    
    // Save which sheets are being used for this merge
    const currentMasterSheet = masterSheetNames[activeMasterTab] || 'Unknown';
    const currentClientSheet = clientSheetNames[activeClientTab] || 'Unknown';
    setMergedSheetInfo({ masterSheet: currentMasterSheet, clientSheet: currentClientSheet });
    const hcpcsColMaster = getHCPCSColumnMaster();
    const hcpcsColClient = getHCPCSColumnClient();
    const modifierColMaster = getModifierColumnMaster();
    const modifierColClient = getModifierColumnClient();
    if (!hcpcsColMaster || !hcpcsColClient) {
      setShowCompare(false);
      console.error('Both files must have a "HCPCS" column to compare.');
      return;
    }
    const descColMaster = getDescriptionCol(columnsMaster);
    const descColClient = getDescriptionCol(columnsClient);

    // Diagnostics: log columns and sample rows
    console.log("[DIAG] columnsMaster:", columnsMaster.map(c => c.field));
    console.log("[DIAG] columnsClient:", columnsClient.map(c => c.field));
    console.log("[DIAG] hcpcsColMaster:", hcpcsColMaster, ", hcpcsColClient:", hcpcsColClient, ", modifierColMaster:", modifierColMaster, ", modifierColClient:", modifierColClient);
    if (rowsMaster.length > 0) console.log("[DIAG] Sample rowMaster:", rowsMaster[0]);
    if (rowsClient.length > 0) console.log("[DIAG] Sample rowClient:", rowsClient[0]);

    function getCompareKey(row: ExcelRow, hcpcsCol: string, modifierCol: string | null): string {
      const { root, modifier } = parseHCPCS(row, hcpcsCol, modifierCol);
      const modMap = [
        { flag: modifierCriteria.root00, mod: "00" },
        { flag: modifierCriteria.root25, mod: "25" },
        { flag: modifierCriteria.root50, mod: "50" },
        { flag: modifierCriteria.root59, mod: "59" },
        { flag: modifierCriteria.rootXU, mod: "XU" },
        { flag: modifierCriteria.root76, mod: "76" },
      ];
      const anyModifierChecked = modMap.some(({ flag }) => flag);
      const cleanModifier = (modifier || "").trim();
      const key = !anyModifierChecked
        ? (cleanModifier ? `${root}-${cleanModifier}` : root)
        : (modMap.some(({ flag, mod }) => flag && cleanModifier === mod) ? root : (cleanModifier ? `${root}-${cleanModifier}` : root));
      // Diagnostics: log key for first 5 rows
      if (row.id < 5) {
        console.log(`[DIAG] Row id=${row.id}, root='${root}', modifier='${modifier}', cleanModifier='${cleanModifier}', key='${key}', hcpcsCol='${hcpcsCol}'`);
      }
      return key;
    }

    function filterTrauma(rows: ExcelRow[], descCol: string | null, hcpcsCol: string): ExcelRow[] {
      if (!modifierCriteria.ignoreTrauma || !descCol) return rows;
      return rows.filter(row => {
        const code = String(row[hcpcsCol] || "");
        const desc = String(row[descCol] || "").toLowerCase();
        if (["99284", "99285", "99291"].includes(code) && desc.includes("trauma team")) {
          return false;
        }
        return true;
      });
    }

    const filteredMaster = filterTrauma(rowsMaster, descColMaster, hcpcsColMaster);
    const filteredClient = filterTrauma(rowsClient, descColClient, hcpcsColClient);
    // Diagnostics: log filtered counts
    console.log(`[DIAG] filteredMaster count: ${filteredMaster.length}, filteredClient count: ${filteredClient.length}`);
    const mapMaster = new Map(filteredMaster.map(row => [getCompareKey(row, hcpcsColMaster, modifierColMaster), row]));
    const mapClient = new Map(filteredClient.map(row => [getCompareKey(row, hcpcsColClient, modifierColClient), row]));
    // Diagnostics: log map keys
    console.log("[DIAG] mapMaster keys:", Array.from(mapMaster.keys()).slice(0, 10));
    console.log("[DIAG] mapClient keys:", Array.from(mapClient.keys()).slice(0, 10));
    // Only include records from Master that have a match in Client
    const matchedKeys = Array.from(mapClient.keys()).filter((key: string) => mapMaster.has(key));
    console.log(`[DIAG] matchedKeys count: ${matchedKeys.length}`);
    
    // Create column mapping and merged columns
    const columnMapping = createColumnMapping(columnsMaster, columnsClient);
    
    // The merged result should ALWAYS use ALL master columns as the structure
    // This ensures no duplicate columns and maintains master sheet structure
    const mergedColumns = columnsMaster.map(col => ({ ...col, editable: true }));
    setMergedColumns(mergedColumns);
    // Build merged rows: for each match, populate master columns with client data where possible
    const merged: ExcelRow[] = matchedKeys.map((key: string, idx: number) => {
      const rowMaster = mapMaster.get(key);
      const rowClient = mapClient.get(key);
      const mergedRow: ExcelRow = { id: rowMaster?.id ?? idx };
      
      // For each master column, populate with client data if mapping exists, otherwise use master data
      mergedColumns.forEach((col) => {
        if (columnMapping[col.field]) {
          // This master column has a mapped client column - use client data
          const clientField = columnMapping[col.field];
          mergedRow[col.field] = rowClient?.[clientField] ?? rowMaster?.[col.field] ?? "";
        } else {
          // No mapping found - use master data
          mergedRow[col.field] = rowMaster?.[col.field] ?? "";
        }
      });
      return mergedRow;
    });

    // Format HCPCS codes in merged data to ensure proper format (XXXXX-XX)
    const formattedMerged = merged.map(row => {
      const formattedRow = { ...row };
      Object.keys(formattedRow).forEach(key => {
        // Check if this column contains HCPCS codes (by column name)
        if (key.toLowerCase().includes('hcpcs') || key.toLowerCase().includes('cpt') || key.toLowerCase().includes('code')) {
          const value = formattedRow[key];
          if (typeof value === 'string' && value.length >= 7) {
            const sixthChar = value.charAt(5);
            // Don't insert hyphen if:
            // 1. There's already a hyphen in the 6th position, OR
            // 2. The 6th character is 'x' (quantity indicator like x1, x2, x01, x02)
            if (sixthChar !== '-' && sixthChar.toLowerCase() !== 'x') {
              // Insert hyphen between 5th and 6th characters
              formattedRow[key] = `${value.substring(0, 5)}-${value.substring(5)}`;
            }
            // Otherwise, leave the value unchanged
          }
        }
      });
      return formattedRow;
    });

    setMergedRows(formattedMerged);
    setMergedForExport(formattedMerged);
    // Save original merged data for cancel functionality
    setOriginalMergedData([...formattedMerged]);
    setHasUnsavedMergedChanges(false);

    // --- New: Collect errors (Client not matched) and dups (Client with duplicate CDM numbers) ---
    // 1. Errors: records from Client not matched with Master
    const unmatchedClient = filteredClient.filter(row => !mapMaster.has(getCompareKey(row, hcpcsColClient, modifierColClient)));
    setUnmatchedClient(unmatchedClient);
    // 2. Dups: records from Client with duplicate compare key (full field value, not parsed)
    // Use the raw value from the HCPCS column (and Modifier column if present) as the key
    const getRawKey = (row: ExcelRow, hcpcsCol: string, modifierCol: string | null): string => {
      const hcpcs = String(row[hcpcsCol] || "").toUpperCase().trim();
      const modifier = modifierCol ? String(row[modifierCol] || "").toUpperCase().trim() : "";
      // If there's a modifier column, use both; otherwise, use the full HCPCS field as-is
      return modifierCol ? `${hcpcs}-${modifier}` : hcpcs;
    };
    const rawKeyCount: Record<string, number> = {};
    filteredClient.forEach(row => {
      const key = getRawKey(row, hcpcsColClient, modifierColClient);
      if (key) rawKeyCount[key] = (rawKeyCount[key] || 0) + 1;
    });
    const duplicateKeys = Object.keys(rawKeyCount).filter(key => rawKeyCount[key] > 1);
    const dupsClient = filteredClient.filter(row => duplicateKeys.includes(getRawKey(row, hcpcsColClient, modifierColClient)));
    setDupsClient(dupsClient);
    
    // Calculate comparison statistics
    const endTime = performance.now();
    const processingTime = startTime ? endTime - startTime : 0;
    const matchRate = filteredMaster.length > 0 ? (merged.length / filteredMaster.length) * 100 : 0;
    
    const stats: ComparisonStats = {
      totalMasterRecords: filteredMaster.length,
      totalClientRecords: filteredClient.length,
      matchedRecords: merged.length,
      unmatchedRecords: unmatchedClient.length,
      duplicateRecords: dupsClient.length,
      matchRate: Math.round(matchRate * 100) / 100,
      processingTime: Math.round(processingTime),
      columnsMatched: Object.keys(columnMapping).length,
      totalMasterColumns: columnsMaster.length,
      totalClientColumns: columnsClient.length
    };
    
    setComparisonStats(stats);
    console.log('[STATS] Comparison statistics:', stats);
    
    setShowCompare(true);
    
    // Set HCPCS sorting for all grids after comparison - longer delay for merged grid
    setTimeout(() => setHcpcsDefaultSorting(), 300);
    
    // Diagnostics: log unmatched and duplicates
    console.log(`[DIAG] unmatchedClient count: ${unmatchedClient.length}`);
    console.log(`[DIAG] dupsClient count: ${dupsClient.length}`);
    if (unmatchedClient.length > 0) console.log("[DIAG] Sample unmatched Client record:", unmatchedClient[0]);
    if (dupsClient.length > 0) console.log("[DIAG] Sample duplicate Client record:", dupsClient[0]);
  }, [rowsMaster, rowsClient, columnsMaster, columnsClient, masterSheetNames, clientSheetNames, activeMasterTab, activeClientTab, modifierCriteria, createColumnMapping, getHCPCSColumnClient, getHCPCSColumnMaster, getModifierColumnClient, getModifierColumnMaster, getDescriptionCol, setHcpcsDefaultSorting]);

  // Auto-trigger comparison when both files are loaded
  useEffect(() => {
    if (rowsMaster.length > 0 && rowsClient.length > 0 && !showCompare) {
      console.log('[DEBUG] Auto-triggering comparison - rowsMaster:', rowsMaster.length, 'rowsClient:', rowsClient.length);
      handleMerge();
    }
  }, [rowsMaster.length, rowsClient.length, showCompare, handleMerge]);

  // Apply HCPCS sorting when merged data is available
  useEffect(() => {
    if (mergedRows.length > 0 && mergedColumns.length > 0) {
      console.log('[DEBUG] Merged data available, applying HCPCS sorting');
      setTimeout(() => setHcpcsDefaultSorting(), 500);
    }
  }, [mergedRows.length, mergedColumns.length, setHcpcsDefaultSorting]);

  const handleExport = () => {
    if (mergedForExport.length === 0) return;
    
    // Use client filename, add sheet name if multiple sheets, add datetime suffix
    const clientName = lastClientFile ? lastClientFile.replace('.xlsx', '').replace('.xls', '') : 'merged_data';
    const clientSheetCount = clientFileMetadata?.sheetCount || 1;
    const timestamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(/:/g, '');
    
    let filename = `${clientName}_${timestamp}.xlsx`;
    if (clientSheetCount > 1 && mergedSheetInfo?.clientSheet) {
      const sheetName = mergedSheetInfo.clientSheet.replace(/[^a-zA-Z0-9\s-_]/g, '').replace(/\s+/g, '_');
      filename = `${clientName}_${sheetName}_${timestamp}.xlsx`;
    }
    
    const wb = XLSX.utils.book_new();
    const clean = (rows: ExcelRow[]) => rows.map(row => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, ...rest } = row;
      return rest;
    });
    const ws = XLSX.utils.json_to_sheet(clean(mergedForExport));
    XLSX.utils.book_append_sheet(wb, ws, "Merged");
    
    // Always include Unmatched_Client sheet, even if empty
    const wsErrors = XLSX.utils.json_to_sheet(clean(unmatchedClient));
    XLSX.utils.book_append_sheet(wb, wsErrors, "Unmatched_Client");
    
    // Always include Duplicate_Client sheet, even if empty
    const wsDups = XLSX.utils.json_to_sheet(clean(dupsClient));
    XLSX.utils.book_append_sheet(wb, wsDups, "Duplicate_Client");
    XLSX.writeFile(wb, filename);
  };

  const handleExportWithFilename = (customFilename: string) => {
    if (mergedForExport.length === 0) return;
    
    // Clean the filename and ensure it has .xlsx extension
    let filename = customFilename.trim();
    if (!filename.toLowerCase().endsWith('.xlsx') && !filename.toLowerCase().endsWith('.xls')) {
      filename += '.xlsx';
    }
    
    // Remove any invalid characters for filename
    filename = filename.replace(/[<>:"/\\|?*]/g, '_');
    
    const wb = XLSX.utils.book_new();
    const clean = (rows: ExcelRow[]) => rows.map(row => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, ...rest } = row;
      return rest;
    });
    const ws = XLSX.utils.json_to_sheet(clean(mergedForExport));
    XLSX.utils.book_append_sheet(wb, ws, "Merged");
    
    // Always include Unmatched_Client sheet, even if empty
    const wsErrors = XLSX.utils.json_to_sheet(clean(unmatchedClient));
    XLSX.utils.book_append_sheet(wb, wsErrors, "Unmatched_Client");
    
    // Always include Duplicate_Client sheet, even if empty
    const wsDups = XLSX.utils.json_to_sheet(clean(dupsClient));
    XLSX.utils.book_append_sheet(wb, wsDups, "Duplicate_Client");
    XLSX.writeFile(wb, filename);
  };

  const handleDragEnter = (which: "Master" | "Client") => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (which === "Master") setDragOverMaster(true);
    else setDragOverClient(true);
  };
  const handleDragLeave = (which: "Master" | "Client") => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (which === "Master") setDragOverMaster(false);
    else setDragOverClient(false);
  };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>, which: "Master" | "Client") => {
    e.preventDefault();
    if (which === "Master") setDragOverMaster(false);
    else setDragOverClient(false);
    const files = e.dataTransfer.files;
    if (files.length) {
      handleFileUpload(files[0], which);
    }
  };
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, which: "Master" | "Client") => {
    e.preventDefault();
    if (which === "Master" && !dragOverMaster) setDragOverMaster(true);
    if (which === "Client" && !dragOverClient) setDragOverClient(true);
  };

  const processAllSheets = (data: string | ArrayBuffer, which: "Master" | "Client", sheetNames: string[]) => {
    const workbook = XLSX.read(data, { type: typeof data === 'string' ? 'base64' : 'array' });
    const sheetData: {[sheetName: string]: {rows: ExcelRow[], columns: GridColDef[]}} = {};
    
    // Make both client and master data editable
    const isEditable = true;
    
    sheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      const processed = processSheetData(worksheet, isEditable);
      sheetData[sheetName] = processed;
    });
    
    if (which === "Master") {
      setMasterSheetData(sheetData);
      setMasterSheetNames(sheetNames);
      setActiveMasterTab(0);
      // Update legacy state for first sheet for backward compatibility
      if (sheetNames.length > 0) {
        const firstSheet = sheetData[sheetNames[0]];
        setRowsMaster(firstSheet.rows);
        setColumnsMaster(firstSheet.columns);
        // Save original data for cancel functionality
        setOriginalMasterData([...firstSheet.rows]);
        setHasUnsavedMasterChanges(false);
        // Set HCPCS sorting after data is loaded
        setTimeout(() => setHcpcsDefaultSorting(), 100);
      }
    } else {
      setClientSheetData(sheetData);
      setClientSheetNames(sheetNames);
      setActiveClientTab(0);
      // Update legacy state for first sheet for backward compatibility
      if (sheetNames.length > 0) {
        const firstSheet = sheetData[sheetNames[0]];
        setRowsClient(firstSheet.rows);
        setColumnsClient(firstSheet.columns);
        // Save original data for cancel functionality
        setOriginalClientData([...firstSheet.rows]);
        setHasUnsavedChanges(false);
        // Set HCPCS sorting after data is loaded
        setTimeout(() => setHcpcsDefaultSorting(), 100);
      }
    }
  };
  
  const processSheetData = (worksheet: XLSX.WorkSheet, isEditable = false) => {
    const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    if (json.length === 0) return { rows: [], columns: [] };
    
    const headers = json[0] as string[];
    const columns: GridColDef[] = headers.map((header, idx) => {
      const field = header || `col${idx}`;
      const headerName = header || `Column ${idx + 1}`;

      // Set width based on column type - quantity columns are half width
      let width = 150; // default width
      const fieldLower = field.toLowerCase();
      if (['quantity', 'qty', 'units', 'unit', 'count'].some(term => fieldLower.includes(term))) {
        width = 75; // half width for quantity columns
      }

      return {
        field,
        headerName,
        width,
        editable: isEditable,
        type: 'string',
      };
    });
    
    const rows: ExcelRow[] = Array.from(json.slice(1)).map((row, idx) => {
      const rowArr = row as unknown[];
      const rowObj: ExcelRow = { id: idx };
      headers.forEach((header, colIdx) => {
        let value = rowArr[colIdx];
        if (typeof value === "object" && value !== null) {
          value = JSON.stringify(value) as string;
        }
        rowObj[header || `col${colIdx}`] = (value === undefined || value === null) ? "" : (value as string | number);
      });
      return rowObj;
    });
    
    return { rows: Array.from(rows), columns };
  };
  
  const restoreFileData = (data: string, which: "Master" | "Client", restoreMetadata = false) => {
    console.log(`[DEBUG] Starting restoreFileData for ${which}`);
    // For restore operations, process the data directly without creating a File object
    const workbook = XLSX.read(data, { type: 'base64' });
    const sheets = workbook.SheetNames;
    console.log(`[DEBUG] ${which} sheets found:`, sheets);
    processAllSheets(data, which, sheets);
    console.log(`[DEBUG] processAllSheets completed for ${which}`);
    
    // Restore metadata AFTER processing sheets if requested
    console.log(`[DEBUG] restoreMetadata flag for ${which}:`, restoreMetadata);
    if (restoreMetadata) {
      const metadataKey = which === "Master" ? "lastMasterMetadata" : "lastClientMetadata";
      const storedMetadata = localStorage.getItem(metadataKey);
      console.log(`[DEBUG] ${which} stored metadata from localStorage:`, storedMetadata ? 'FOUND' : 'NOT FOUND');
      if (storedMetadata) {
        try {
          const metadata = JSON.parse(storedMetadata);
          metadata.uploadTime = new Date(metadata.uploadTime);
          
          // Set metadata immediately
          if (which === "Master") {
            setMasterFileMetadata(metadata);
            console.log('[DEBUG] Master metadata restored AFTER processing:', metadata);
          } else {
            setClientFileMetadata(metadata);
            console.log('[DEBUG] Client metadata restored AFTER processing:', metadata);
          }
        } catch (e) {
          console.error(`Failed to restore ${which.toLowerCase()} metadata after processing:`, e);
        }
      } else {
        console.log(`[DEBUG] No stored metadata found for ${which} with key:`, metadataKey);
      }
    } else {
      console.log(`[DEBUG] restoreMetadata is false for ${which}, skipping metadata restore`);
    }
  };

  const handleMasterTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveMasterTab(newValue);
    const sheetName = masterSheetNames[newValue];
    const sheetData = masterSheetData[sheetName];
    if (sheetData) {
      setRowsMaster(sheetData.rows);
      setColumnsMaster(sheetData.columns);
      localStorage.setItem("lastMasterSheet", sheetName);
      // Save original data for cancel functionality
      setOriginalMasterData([...sheetData.rows]);
      setHasUnsavedMasterChanges(false);
      // Set HCPCS sorting after tab change
      setTimeout(() => setHcpcsDefaultSorting(), 100);
    }
  };
  
  const handleClientTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveClientTab(newValue);
    const sheetName = clientSheetNames[newValue];
    const sheetData = clientSheetData[sheetName];
    if (sheetData) {
      setRowsClient(sheetData.rows);
      setColumnsClient(sheetData.columns);
      localStorage.setItem("lastClientSheet", sheetName);
      // Save original data for cancel functionality
      setOriginalClientData([...sheetData.rows]);
      setHasUnsavedChanges(false);
      // Set HCPCS sorting after tab change
      setTimeout(() => setHcpcsDefaultSorting(), 100);
    }
  };
  
  const handleLoadLastFile = (which: "Master" | "Client") => {
    if (which === "Master" && lastMasterData && lastMasterFile) {
      console.log('[DEBUG] Loading last master file with metadata restore');
      restoreFileData(lastMasterData, "Master", true);
    } else if (which === "Client" && lastClientData && lastClientFile) {
      console.log('[DEBUG] Loading last client file with metadata restore');
      restoreFileData(lastClientData, "Client", true);
    }
  };
  
  const handleRestoreSession = () => {
    if (lastMasterData && lastClientData && lastMasterFile && lastClientFile) {
      console.log('[DEBUG] Starting restore session - processing sheets first, then metadata');
      
      // Clear all selection state before restoring to prevent DataGrid errors
      setSelectedRowMaster(null);
      setSelectedRowsMaster([]);
      setSelectedRowClient(null);
      setSelectedRowsClient([]);
      setSelectedRowMerged(null);
      setSelectedRowsMerged([]);
      setSelectedRowUnmatched(null);
      setSelectedRowsUnmatched([]);
      setSelectedRowDuplicates(null);
      setSelectedRowsDuplicates([]);
      
      // Process file data first, then restore metadata AFTER processing
      restoreFileData(lastMasterData, "Master", true);
      restoreFileData(lastClientData, "Client", true);
      
      console.log('[DEBUG] Restore session initiated');
    }
  };

  const handleModifierChange = (key: keyof typeof modifierCriteria) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setModifierCriteria({ ...modifierCriteria, [key]: e.target.checked });
  };

  const handleReset = () => {
    setRowsMaster([]);
    setColumnsMaster([]);
    setRowsClient([]);
    setColumnsClient([]);
    setMergedRows([]);
    setMergedColumns([]);
    setShowCompare(false);
    setMasterSheetData({});
    setClientSheetData({});
    setMasterSheetNames([]);
    setClientSheetNames([]);
    setActiveMasterTab(0);
    setActiveClientTab(0);
    setMergedSheetInfo(null);
    setMasterFileMetadata(null);
    setClientFileMetadata(null);
    setComparisonStats(null);
    
    // Clear all selection state
    setSelectedRowMaster(null);
    setSelectedRowsMaster([]);
    setSelectedRowClient(null);
    setSelectedRowsClient([]);
    setSelectedRowMerged(null);
    setSelectedRowsMerged([]);
    setSelectedRowUnmatched(null);
    setSelectedRowsUnmatched([]);
    setSelectedRowDuplicates(null);
    setSelectedRowsDuplicates([]);
    
    if (fileMasterInputRef.current) fileMasterInputRef.current.value = "";
    if (fileClientInputRef.current) fileClientInputRef.current.value = "";
  };

  const handleClearAllData = async () => {
    // First do a normal reset
    handleReset();
    
    // Then clear all localStorage data
    localStorage.removeItem("lastMasterFile");
    localStorage.removeItem("lastMasterData");
    localStorage.removeItem("lastMasterSheet");
    localStorage.removeItem("lastMasterMetadata");
    localStorage.removeItem("lastClientFile");
    localStorage.removeItem("lastClientData");
    localStorage.removeItem("lastClientSheet");
    localStorage.removeItem("lastClientMetadata");
    
    // Clear the state variables too
    setLastMasterFile(null);
    setLastMasterData(null);
    setLastClientFile(null);
    setLastClientData(null);
    
    // Clear server-side validation cache
    try {
      console.log('[Clear All Data] Clearing server-side validation cache...');
      const response = await fetch('/api/clear-cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearStaleOnly: false })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('[Clear All Data] Server cache cleared:', result.message);
      } else {
        console.warn('[Clear All Data] Failed to clear server cache:', response.status);
      }
    } catch (error) {
      console.error('[Clear All Data] Error clearing server cache:', error);
      // Don't throw - clearing cache failure shouldn't prevent the UI reset
    }
  };

  // Save and cancel functions for editing
  const handleSaveEdits = (gridType?: 'master' | 'client' | 'merged') => {
    if (!gridType || gridType === 'client') {
      // Validate for duplicates before saving
      const validation = validateForDuplicates(rowsClient, 'client');
      if (validation.hasDuplicates) {
        setDuplicateValidationErrors(prev => ({
          ...prev,
          client: { duplicateKeys: validation.duplicateKeys, duplicateRows: validation.duplicateRows }
        }));
        console.error('Cannot save: Duplicate records found in client grid', validation.duplicateKeys);
        return;
      }
      
      // Clear any previous validation errors and save
      setDuplicateValidationErrors(prev => ({
        ...prev,
        client: { duplicateKeys: [], duplicateRows: [] }
      }));
      setOriginalClientData([...rowsClient]);
      setHasUnsavedChanges(false);
      console.log('Client changes saved successfully');
    }
    
    if (gridType === 'master') {
      // Validate for duplicates before saving
      const validation = validateForDuplicates(rowsMaster, 'master');
      if (validation.hasDuplicates) {
        setDuplicateValidationErrors(prev => ({
          ...prev,
          master: { duplicateKeys: validation.duplicateKeys, duplicateRows: validation.duplicateRows }
        }));
        console.error('Cannot save: Duplicate records found in master grid', validation.duplicateKeys);
        return;
      }
      
      // Clear any previous validation errors and save
      setDuplicateValidationErrors(prev => ({
        ...prev,
        master: { duplicateKeys: [], duplicateRows: [] }
      }));
      setOriginalMasterData([...rowsMaster]);
      setHasUnsavedMasterChanges(false);
      console.log('Master changes saved successfully');
    }
    
    if (gridType === 'merged') {
      // Validate for duplicates before saving
      const validation = validateForDuplicates(mergedRows, 'merged');
      if (validation.hasDuplicates) {
        setDuplicateValidationErrors(prev => ({
          ...prev,
          merged: { duplicateKeys: validation.duplicateKeys, duplicateRows: validation.duplicateRows }
        }));
        console.error('Cannot save: Duplicate records found in merged grid', validation.duplicateKeys);
        return;
      }
      
      // Clear any previous validation errors and save
      setDuplicateValidationErrors(prev => ({
        ...prev,
        merged: { duplicateKeys: [], duplicateRows: [] }
      }));
      setOriginalMergedData([...mergedRows]);
      setHasUnsavedMergedChanges(false);
      console.log('Merged changes saved successfully');
    }
  };

  const handleCancelEdits = (gridType?: 'master' | 'client' | 'merged') => {
    if (!gridType || gridType === 'client') {
      // Revert to original data
      setRowsClient([...originalClientData]);
      
      // Update the sheet data as well
      const currentSheet = clientSheetNames[activeClientTab];
      if (currentSheet && clientSheetData[currentSheet]) {
        const updatedSheetData = {
          ...clientSheetData,
          [currentSheet]: {
            ...clientSheetData[currentSheet],
            rows: [...originalClientData]
          }
        };
        setClientSheetData(updatedSheetData);
      }
      
      // Clear validation errors
      setDuplicateValidationErrors(prev => ({
        ...prev,
        client: { duplicateKeys: [], duplicateRows: [] }
      }));
      
      setHasUnsavedChanges(false);
      console.log('Client changes cancelled successfully');
    }
    
    if (gridType === 'master') {
      // Revert to original master data
      setRowsMaster([...originalMasterData]);
      
      // Update the sheet data as well
      const currentSheet = masterSheetNames[activeMasterTab];
      if (currentSheet && masterSheetData[currentSheet]) {
        const updatedSheetData = {
          ...masterSheetData,
          [currentSheet]: {
            ...masterSheetData[currentSheet],
            rows: [...originalMasterData]
          }
        };
        setMasterSheetData(updatedSheetData);
      }
      
      // Clear validation errors
      setDuplicateValidationErrors(prev => ({
        ...prev,
        master: { duplicateKeys: [], duplicateRows: [] }
      }));
      
      setHasUnsavedMasterChanges(false);
      console.log('Master changes cancelled successfully');
    }
    
    if (gridType === 'merged') {
      // Revert to original merged data
      setMergedRows([...originalMergedData]);
      
      // Clear validation errors
      setDuplicateValidationErrors(prev => ({
        ...prev,
        merged: { duplicateKeys: [], duplicateRows: [] }
      }));
      
      setHasUnsavedMergedChanges(false);
      console.log('Merged changes cancelled successfully');
    }
  };

  // Duplicate validation function
  const validateForDuplicates = (rows: ExcelRow[], gridType: 'master' | 'client' | 'merged'): {hasDuplicates: boolean, duplicateRows: ExcelRow[], duplicateKeys: string[]} => {
    // Get the appropriate HCPCS and modifier columns based on grid type
    let hcpcsCol: string | null = null;
    let modifierCol: string | null = null;
    
    if (gridType === 'master') {
      hcpcsCol = getHCPCSColumnMaster();
      modifierCol = getModifierColumnMaster();
    } else if (gridType === 'client') {
      hcpcsCol = getHCPCSColumnClient();
      modifierCol = getModifierColumnClient();
    } else if (gridType === 'merged') {
      // For merged grid, use master column structure but check for duplicates
      hcpcsCol = getHCPCSColumnMaster();
      modifierCol = getModifierColumnMaster();
    }
    
    if (!hcpcsCol) {
      // If no HCPCS column found, no duplicates can be detected
      return { hasDuplicates: false, duplicateRows: [], duplicateKeys: [] };
    }
    
    // Create key function similar to the existing duplicate detection
    const getRawKey = (row: ExcelRow): string => {
      const hcpcs = String(row[hcpcsCol!] || "").toUpperCase().trim();
      const modifier = modifierCol ? String(row[modifierCol] || "").toUpperCase().trim() : "";
      // If there's a modifier column, use both; otherwise, use the full HCPCS field as-is
      return modifierCol ? `${hcpcs}-${modifier}` : hcpcs;
    };
    
    // Count occurrences of each key
    const keyCount: Record<string, number> = {};
    const keyToRows: Record<string, ExcelRow[]> = {};
    
    rows.forEach(row => {
      const key = getRawKey(row);
      if (key) {
        keyCount[key] = (keyCount[key] || 0) + 1;
        if (!keyToRows[key]) {
          keyToRows[key] = [];
        }
        keyToRows[key].push(row);
      }
    });
    
    // Find duplicate keys (keys that appear more than once)
    const duplicateKeys = Object.keys(keyCount).filter(key => keyCount[key] > 1);
    const duplicateRows = duplicateKeys.flatMap(key => keyToRows[key]);
    
    return {
      hasDuplicates: duplicateKeys.length > 0,
      duplicateRows,
      duplicateKeys
    };
  };

  // Create refs to store current state values to avoid closure issues
  const mergedRowsRef = useRef(mergedRows);
  const filteredMergedRowsRef = useRef(filteredMergedRows);
  const rowsMasterRef = useRef(rowsMaster);
  const filteredRowsMasterRef = useRef(filteredRowsMaster);
  const rowsClientRef = useRef(rowsClient);
  const filteredRowsClientRef = useRef(filteredRowsClient);

  // Update refs whenever state changes
  useEffect(() => {
    mergedRowsRef.current = mergedRows;
  }, [mergedRows]);

  useEffect(() => {
    filteredMergedRowsRef.current = filteredMergedRows;
  }, [filteredMergedRows]);

  useEffect(() => {
    rowsMasterRef.current = rowsMaster;
  }, [rowsMaster]);

  useEffect(() => {
    filteredRowsMasterRef.current = filteredRowsMaster;
  }, [filteredRowsMaster]);

  useEffect(() => {
    rowsClientRef.current = rowsClient;
  }, [rowsClient]);

  useEffect(() => {
    filteredRowsClientRef.current = filteredRowsClient;
  }, [filteredRowsClient]);

  // Record manipulation functions
  const handleDuplicateRecord = (rowId: number | string, gridType: 'master' | 'client' | 'merged'): { success: boolean; newRowId?: number | string; originalRowId: number | string } => {
    console.log(`[DUPLICATE] Starting duplication for ID ${rowId} in ${gridType} grid`);

    // Set up variables based on grid type
    if (gridType === 'master') {
      // Get current state values from refs to avoid closure issues
      const currentRowsMaster = rowsMasterRef.current;
      const currentFilteredRowsMaster = filteredRowsMasterRef.current;

      // Look in filteredRowsMaster first (what's visible), then fall back to rowsMaster
      const recordToDuplicate = currentFilteredRowsMaster.find(row => String(row.id) === String(rowId)) || currentRowsMaster.find(row => String(row.id) === String(rowId));
      if (!recordToDuplicate) {
        console.error(`Record with ID ${rowId} not found in master grid`);
        return { success: false, originalRowId: rowId };
      }

      const maxId = Math.max(...currentRowsMaster.map(row => typeof row.id === 'number' ? row.id : parseInt(String(row.id)) || 0));
      const newRecord = { ...recordToDuplicate, id: maxId + 1 };
      const updatedRows = [...currentRowsMaster, newRecord];
      setRowsMaster(updatedRows);

      // Update sheet data
      const currentSheet = masterSheetNames[activeMasterTab];
      if (currentSheet && masterSheetData[currentSheet]) {
        const updatedSheetData = {
          ...masterSheetData,
          [currentSheet]: {
            ...masterSheetData[currentSheet],
            rows: updatedRows
          }
        };
        setMasterSheetData(updatedSheetData);
      }

      setHasUnsavedMasterChanges(true);

      // Start edit mode on the ORIGINAL row (the one being duplicated) with HCPCS focus
      setTimeout(() => {
        startRowEditModeWithHcpcsFocus('master', rowId);
      }, 100);

      console.log(`Record duplicated in master grid. New record ID: ${newRecord.id}`);
      return { success: true, newRowId: newRecord.id, originalRowId: rowId };
    } else if (gridType === 'client') {
      // Get current state values from refs to avoid closure issues
      const currentRowsClient = rowsClientRef.current;
      const currentFilteredRowsClient = filteredRowsClientRef.current;

      // Look in filteredRowsClient first (what's visible), then fall back to rowsClient
      const recordToDuplicate = currentFilteredRowsClient.find(row => String(row.id) === String(rowId)) || currentRowsClient.find(row => String(row.id) === String(rowId));
      if (!recordToDuplicate) {
        console.error(`Record with ID ${rowId} not found in client grid`);
        return { success: false, originalRowId: rowId };
      }

      const maxId = Math.max(...currentRowsClient.map(row => typeof row.id === 'number' ? row.id : parseInt(String(row.id)) || 0));
      const newRecord = { ...recordToDuplicate, id: maxId + 1 };
      const updatedRows = [...currentRowsClient, newRecord];
      setRowsClient(updatedRows);

      // Update sheet data
      const currentSheet = clientSheetNames[activeClientTab];
      if (currentSheet && clientSheetData[currentSheet]) {
        const updatedSheetData = {
          ...clientSheetData,
          [currentSheet]: {
            ...clientSheetData[currentSheet],
            rows: updatedRows
          }
        };
        setClientSheetData(updatedSheetData);
      }

      setHasUnsavedChanges(true);

      // Start edit mode on the ORIGINAL row (the one being duplicated) with HCPCS focus
      setTimeout(() => {
        startRowEditModeWithHcpcsFocus('client', rowId);
      }, 100);

      console.log(`Record duplicated in client grid. New record ID: ${newRecord.id}`);
      return { success: true, newRowId: newRecord.id, originalRowId: rowId };
    } else if (gridType === 'merged') {
      // Get current state values from refs to avoid closure issues
      const currentMergedRows = mergedRowsRef.current;
      const currentFilteredMergedRows = filteredMergedRowsRef.current;

      // Add debugging information
      console.log(`[DUPLICATE DEBUG] Looking for record with ID: ${rowId} (type: ${typeof rowId})`);
      console.log(`[DUPLICATE DEBUG] filteredMergedRows count: ${currentFilteredMergedRows.length}`);
      console.log(`[DUPLICATE DEBUG] mergedRows count: ${currentMergedRows.length}`);
      console.log(`[DUPLICATE DEBUG] filteredMergedRows IDs:`, currentFilteredMergedRows.map(r => `${r.id} (${typeof r.id})`).slice(0, 10));
      console.log(`[DUPLICATE DEBUG] mergedRows IDs:`, currentMergedRows.map(r => `${r.id} (${typeof r.id})`).slice(0, 10));

      // Look in filteredMergedRows first (what's visible), then fall back to mergedRows
      let recordToDuplicate = currentFilteredMergedRows.find(row => String(row.id) === String(rowId));

      if (!recordToDuplicate) {
        console.log(`[DUPLICATE DEBUG] Record not found in filtered rows, checking unfiltered rows...`);
        recordToDuplicate = currentMergedRows.find(row => String(row.id) === String(rowId));
      }

      if (!recordToDuplicate) {
        console.error(`[DUPLICATE ERROR] Record with ID ${rowId} not found in merged grid`);
        console.error(`[DUPLICATE ERROR] Available merged row IDs:`, currentMergedRows.map(r => r.id));
        console.error(`[DUPLICATE ERROR] Available filtered row IDs:`, currentFilteredMergedRows.map(r => r.id));
        return { success: false, originalRowId: rowId };
      }

      const maxId = Math.max(...currentMergedRows.map(row => typeof row.id === 'number' ? row.id : parseInt(String(row.id)) || 0));
      const newRecord = { ...recordToDuplicate, id: maxId + 1 };
      const updatedRows = [...currentMergedRows, newRecord];
      setMergedRows(updatedRows);
      setMergedForExport(updatedRows);
      setHasUnsavedMergedChanges(true);

      // Start edit mode on the CURRENT row (the one being duplicated) with HCPCS focus
      setTimeout(() => {
        startRowEditModeWithHcpcsFocus('merged', rowId);
      }, 100);

      console.log(`Record duplicated in merged grid. New record ID: ${newRecord.id}`);
      return { success: true, newRowId: newRecord.id, originalRowId: rowId };
    }

    return { success: false, originalRowId: rowId };
  };

  const handleDeleteRecord = (rowId: number | string, gridType: 'master' | 'client' | 'merged') => {
    // Set up variables based on grid type
    if (gridType === 'master') {
      const updatedRows = rowsMaster.filter(row => row.id !== rowId);
      setRowsMaster(updatedRows);
      
      // Update sheet data
      const currentSheet = masterSheetNames[activeMasterTab];
      if (currentSheet && masterSheetData[currentSheet]) {
        const updatedSheetData = {
          ...masterSheetData,
          [currentSheet]: {
            ...masterSheetData[currentSheet],
            rows: updatedRows
          }
        };
        setMasterSheetData(updatedSheetData);
      }
      
      setHasUnsavedMasterChanges(true);
      
      // Re-validate for duplicates after delete to potentially re-enable save button
      const validation = validateForDuplicates(updatedRows, 'master');
      setDuplicateValidationErrors(prev => ({
        ...prev,
        master: { duplicateKeys: validation.duplicateKeys, duplicateRows: validation.duplicateRows }
      }));
    } else if (gridType === 'client') {
      const updatedRows = rowsClient.filter(row => row.id !== rowId);
      setRowsClient(updatedRows);
      
      // Update sheet data
      const currentSheet = clientSheetNames[activeClientTab];
      if (currentSheet && clientSheetData[currentSheet]) {
        const updatedSheetData = {
          ...clientSheetData,
          [currentSheet]: {
            ...clientSheetData[currentSheet],
            rows: updatedRows
          }
        };
        setClientSheetData(updatedSheetData);
      }
      
      setHasUnsavedChanges(true);
      
      // Re-validate for duplicates after delete to potentially re-enable save button
      const validation = validateForDuplicates(updatedRows, 'client');
      setDuplicateValidationErrors(prev => ({
        ...prev,
        client: { duplicateKeys: validation.duplicateKeys, duplicateRows: validation.duplicateRows }
      }));
    } else if (gridType === 'merged') {
      const updatedRows = mergedRows.filter(row => row.id !== rowId);
      setMergedRows(updatedRows);
      setMergedForExport(updatedRows);
      setHasUnsavedMergedChanges(true);
      
      // Re-validate for duplicates after delete to potentially re-enable save button
      const validation = validateForDuplicates(updatedRows, 'merged');
      setDuplicateValidationErrors(prev => ({
        ...prev,
        merged: { duplicateKeys: validation.duplicateKeys, duplicateRows: validation.duplicateRows }
      }));
    }

    console.log(`Record with ID ${rowId} deleted from ${gridType} grid`);
    console.log(`[SINGLE DELETE] Re-validated duplicates for ${gridType} grid after deletion`);
  };

  const handleDeleteMultipleRecords = (rowIds: (number | string)[], gridType: 'master' | 'client' | 'merged') => {
    if (!rowIds || rowIds.length === 0) return { success: false, deletedCount: 0 };
    
    console.log(`[BULK DELETE] Deleting ${rowIds.length} records from ${gridType} grid:`, rowIds);
    
    // Set up variables based on grid type
    if (gridType === 'master') {
      const updatedRows = rowsMaster.filter(row => !rowIds.includes(row.id));
      setRowsMaster(updatedRows);
      
      // Update sheet data
      const currentSheet = masterSheetNames[activeMasterTab];
      if (currentSheet && masterSheetData[currentSheet]) {
        const updatedSheetData = {
          ...masterSheetData,
          [currentSheet]: {
            ...masterSheetData[currentSheet],
            rows: updatedRows
          }
        };
        setMasterSheetData(updatedSheetData);
      }
      
      setHasUnsavedMasterChanges(true);
      
      // Re-validate for duplicates after bulk delete to potentially re-enable save button
      const validation = validateForDuplicates(updatedRows, 'master');
      setDuplicateValidationErrors(prev => ({
        ...prev,
        master: { duplicateKeys: validation.duplicateKeys, duplicateRows: validation.duplicateRows }
      }));
    } else if (gridType === 'client') {
      const updatedRows = rowsClient.filter(row => !rowIds.includes(row.id));
      setRowsClient(updatedRows);
      
      // Update sheet data
      const currentSheet = clientSheetNames[activeClientTab];
      if (currentSheet && clientSheetData[currentSheet]) {
        const updatedSheetData = {
          ...clientSheetData,
          [currentSheet]: {
            ...clientSheetData[currentSheet],
            rows: updatedRows
          }
        };
        setClientSheetData(updatedSheetData);
      }
      
      setHasUnsavedChanges(true);
      
      // Re-validate for duplicates after bulk delete to potentially re-enable save button
      const validation = validateForDuplicates(updatedRows, 'client');
      setDuplicateValidationErrors(prev => ({
        ...prev,
        client: { duplicateKeys: validation.duplicateKeys, duplicateRows: validation.duplicateRows }
      }));
    } else if (gridType === 'merged') {
      const updatedRows = mergedRows.filter(row => !rowIds.includes(row.id));
      setMergedRows(updatedRows);
      setMergedForExport(updatedRows);
      setHasUnsavedMergedChanges(true);
      
      // Re-validate for duplicates after bulk delete to potentially re-enable save button
      const validation = validateForDuplicates(updatedRows, 'merged');
      setDuplicateValidationErrors(prev => ({
        ...prev,
        merged: { duplicateKeys: validation.duplicateKeys, duplicateRows: validation.duplicateRows }
      }));
    }

    const deletedCount = rowIds.length;
    console.log(`✅ Successfully deleted ${deletedCount} records from ${gridType} grid`);
    console.log(`[BULK DELETE] Re-validated duplicates for ${gridType} grid after deletion`);
    return { success: true, deletedCount };
  };

  const handleAddRecord = (gridType: 'master' | 'client' | 'merged', rowData?: {[key: string]: string | number | undefined}) => {
    // Set up variables based on grid type
    if (gridType === 'master') {
      const maxId = rowsMaster.length > 0 ? Math.max(...rowsMaster.map(row => typeof row.id === 'number' ? row.id : parseInt(String(row.id)) || 0)) : 0;
      const newRecord: ExcelRow = { id: maxId + 1 };
      
      // Initialize all columns with empty values or provided data
      columnsMaster.forEach(col => {
        if (col.field !== 'id') {
          newRecord[col.field] = rowData?.[col.field] || '';
        }
      });
      
      const updatedRows = [...rowsMaster, newRecord];
      setRowsMaster(updatedRows);
      
      // Update sheet data
      const currentSheet = masterSheetNames[activeMasterTab];
      if (currentSheet && masterSheetData[currentSheet]) {
        const updatedSheetData = {
          ...masterSheetData,
          [currentSheet]: {
            ...masterSheetData[currentSheet],
            rows: updatedRows
          }
        };
        setMasterSheetData(updatedSheetData);
      }
      
      setHasUnsavedMasterChanges(true);

      // Start edit mode on the new row with HCPCS focus after a brief delay to ensure the grid has updated
      setTimeout(() => {
        startRowEditModeWithHcpcsFocus('master', newRecord.id);
      }, 100);

      console.log(`New record added to master grid. New record ID: ${newRecord.id}`);
    } else if (gridType === 'client') {
      const maxId = rowsClient.length > 0 ? Math.max(...rowsClient.map(row => typeof row.id === 'number' ? row.id : parseInt(String(row.id)) || 0)) : 0;
      const newRecord: ExcelRow = { id: maxId + 1 };
      
      // Initialize all columns with empty values or provided data
      columnsClient.forEach(col => {
        if (col.field !== 'id') {
          newRecord[col.field] = rowData?.[col.field] || '';
        }
      });
      
      const updatedRows = [...rowsClient, newRecord];
      setRowsClient(updatedRows);
      
      // Update sheet data
      const currentSheet = clientSheetNames[activeClientTab];
      if (currentSheet && clientSheetData[currentSheet]) {
        const updatedSheetData = {
          ...clientSheetData,
          [currentSheet]: {
            ...clientSheetData[currentSheet],
            rows: updatedRows
          }
        };
        setClientSheetData(updatedSheetData);
      }
      
      setHasUnsavedChanges(true);

      // Start edit mode on the new row with HCPCS focus after a brief delay to ensure the grid has updated
      setTimeout(() => {
        startRowEditModeWithHcpcsFocus('client', newRecord.id);
      }, 100);

      console.log(`New record added to client grid. New record ID: ${newRecord.id}`);
    } else if (gridType === 'merged') {
      const maxId = mergedRows.length > 0 ? Math.max(...mergedRows.map(row => typeof row.id === 'number' ? row.id : parseInt(String(row.id)) || 0)) : 0;
      const newRecord: ExcelRow = { id: maxId + 1 };
      
      // Initialize all columns with empty values or provided data
      mergedColumns.forEach(col => {
        if (col.field !== 'id') {
          newRecord[col.field] = rowData?.[col.field] || '';
        }
      });
      
      const updatedRows = [...mergedRows, newRecord];
      setMergedRows(updatedRows);
      setMergedForExport(updatedRows);
      setHasUnsavedMergedChanges(true);

      // Start edit mode on the new row with HCPCS focus after a brief delay to ensure the grid has updated
      setTimeout(() => {
        startRowEditModeWithHcpcsFocus('merged', newRecord.id);
      }, 100);

      console.log(`New record added to merged grid. New record ID: ${newRecord.id}`);
    }
  };









  // Removed handleValidateHcpcsLocal - only AI validation is supported

  return (
    <NoSSR>
    <Box sx={{ 
      p: 4, 
      background: 'linear-gradient(135deg, #f8fbff 0%, #e3f2fd 50%, #f0f8ff 100%)',
      minHeight: '100vh',
      marginRight: isChatOpen ? { xs: '90vw', sm: `${chatWidth}px` } : 0,
      transition: 'margin-right 0.3s ease',
    }}>
      <Typography variant="h3" gutterBottom sx={{ 
        color: '#1976d2', 
        fontWeight: 'bold', 
        textAlign: 'center',
        mb: 4,
        textShadow: '0 2px 4px rgba(25, 118, 210, 0.2)'
      }}> 
       🔧 VIC CDM MERGE TOOL
      </Typography>
      
      {/* Upload/Grid Areas */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ 
          display: "flex", 
          gap: 2,
          flexDirection: { xs: 'column', md: 'row' },
          width: '100%',
          mb: 4
        }}>
        {/* Master File Area */}
        <Box 
          ref={masterGridRef}
          onClick={() => handleGridClick('master')}
          sx={{ 
            flex: 1,
            minWidth: 0,
            ...getGridContainerStyles('master')
          }}
        >
          {masterSheetNames.length > 0 ? (
            // Show tabs and grid when data is loaded
            <>
              <FileInfoCard metadata={masterFileMetadata} type="Master" />
              
              {masterSheetNames.length > 0 && (
                <Tabs 
                  value={activeMasterTab} 
                  onChange={handleMasterTabChange}
                  variant="scrollable"
                  scrollButtons="auto"
                  sx={{ 
                    mb: 2, 
                    borderBottom: 2, 
                    borderColor: '#e0e0e0',
                    '& .MuiTab-root': {
                      color: '#424242',
                      backgroundColor: '#f5f5f5',
                      border: '2px solid #bdbdbd',
                      borderBottom: 'none',
                      marginRight: '4px',
                      minHeight: '40px',
                      fontWeight: 'bold',
                      fontSize: '0.875rem',
                      '&.Mui-selected': {
                        color: '#1976d2',
                        backgroundColor: 'white',
                        fontWeight: 'bold',
                        border: '2px solid #2196f3'
                      },
                      '&:hover': {
                        color: '#1976d2',
                        backgroundColor: '#e3f2fd',
                        border: '2px solid #64b5f6'
                      }
                    },
                    '& .MuiTabs-indicator': {
                      display: 'none'
                    }
                  }}
                >
                  {masterSheetNames.map((sheetName, index) => (
                    <Tab key={index} label={sheetName} />
                  ))}
                </Tabs>
              )}
              
              <TextField
                fullWidth
                variant="outlined"
                placeholder="Search master data..."
                value={searchMasterInput}
                onChange={(e) => setSearchMasterInput(e.target.value)}
                slotProps={{ input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      {searchMasterInput ? (
                        <IconButton
                          size="small"
                          onClick={() => {
                            setSearchMasterInput('');
                            setSearchMaster('');
                          }}
                          edge="start"
                        >
                          <ClearIcon />
                        </IconButton>
                      ) : (
                        <SearchIcon />
                      )}
                    </InputAdornment>
                  ),
                }}}
                sx={{ 
                  mb: 2,
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: 'white',
                    '& fieldset': {
                      borderColor: '#ccc',
                    },
                    '&:hover fieldset': {
                      borderColor: '#999',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#1976d2',
                    },
                  },
                  '& .MuiInputBase-input': {
                    color: 'black',
                  },
                  '& .MuiInputBase-input::placeholder': {
                    color: '#666',
                    opacity: 1,
                  }
                }}
              />
              
              {/* Save/Cancel buttons for master editing */}
              {hasUnsavedMasterChanges && (
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  gap: 1, 
                  mb: 2
                }}>
                  {duplicateValidationErrors.master.duplicateKeys.length > 0 && (
                    <Box sx={{ 
                      p: 1.5,
                      backgroundColor: '#ffebee',
                      border: '1px solid #f44336',
                      borderRadius: 1,
                      mb: 1
                    }}>
                      <Typography variant="body2" sx={{ 
                        color: '#d32f2f', 
                        fontWeight: 'bold',
                        mb: 0.5
                      }}>
                        🚫 Cannot save: Duplicate records found
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#d32f2f' }}>
                        Duplicate HCPCS codes: {duplicateValidationErrors.master.duplicateKeys.join(', ')}
                      </Typography>
                    </Box>
                  )}
                  
                  <Box sx={{ 
                    display: 'flex', 
                    gap: 1,
                    justifyContent: 'flex-end',
                    alignItems: 'center'
                  }}>
                    <Typography variant="body2" sx={{ 
                      color: '#f57c00', 
                      fontWeight: 'bold',
                      mr: 1
                    }}>
                      ⚠️ Unsaved changes
                    </Typography>
                    <Button 
                      variant="outlined" 
                      size="small"
                      onClick={() => handleCancelEdits('master')}
                      sx={{ 
                        color: '#d32f2f', 
                        borderColor: '#d32f2f',
                        '&:hover': {
                          backgroundColor: '#ffebee',
                          borderColor: '#c62828'
                        }
                      }}
                    >
                      Cancel
                    </Button>
                    <Button 
                      variant="contained" 
                      size="small"
                      onClick={() => handleSaveEdits('master')}
                      disabled={duplicateValidationErrors.master.duplicateKeys.length > 0}
                      sx={{ 
                        backgroundColor: '#4caf50',
                        '&:hover': {
                          backgroundColor: '#388e3c'
                        }
                      }}
                    >
                      Save
                    </Button>
                  </Box>
                </Box>
              )}
              
              <Box sx={{ height: 400, width: "100%" }}>
                <DataGrid
                  apiRef={masterApiRef}
                  rows={filteredRowsMaster}
                  columns={enhancedMasterColumns}
                  editMode="row"
                  density="compact"
                  disableVirtualization={aiSelectedGrid !== 'master'}
                  sortModel={masterSortModel}
                  onSortModelChange={setMasterSortModel}
                  checkboxSelection
                  disableRowSelectionOnClick
                  showToolbar
                  onRowSelectionModelChange={(newRowSelectionModel) => {
                    // Handle the DataGrid selection model format
                    let selectedId = null;
                    let selectedIds: (number | string)[] = [];
                    
                    if (Array.isArray(newRowSelectionModel)) {
                      // Legacy format: array of IDs
                      selectedIds = newRowSelectionModel as (number | string)[];
                      selectedId = selectedIds.length > 0 ? selectedIds[0] : null;
                    } else if (newRowSelectionModel && typeof newRowSelectionModel === 'object' && 'ids' in newRowSelectionModel) {
                      // New format: {type: 'include', ids: Set(...)}
                      const ids = newRowSelectionModel.ids as Set<number | string>;
                      selectedIds = Array.from(ids);
                      selectedId = selectedIds.length > 0 ? selectedIds[0] : null;
                    }
                    
                    console.log('[MASTER SELECTION] Raw newRowSelectionModel:', newRowSelectionModel);
                    console.log('[MASTER SELECTION] Processed selection:', { selectedId, selectedIds, aiSelectedGrid });
                    console.log('[MASTER SELECTION] Is array?', Array.isArray(newRowSelectionModel));
                    
                    // Update state with a small delay to ensure proper synchronization
                    setTimeout(() => {
                      setSelectedRowMaster(selectedId);
                      setSelectedRowsMaster(selectedIds);
                    }, 10);
                  }}
                  processRowUpdate={(newRow) => {
                    // Basic validation for edited cells
                    const validatedRow = { ...newRow };
                    
                    // Validate and clean each field
                    Object.keys(validatedRow).forEach(key => {
                      if (key !== 'id') {
                        const value = validatedRow[key];
                        
                        // Convert to string and trim whitespace
                        if (value !== null && value !== undefined) {
                          validatedRow[key] = String(value).trim();
                        } else {
                          validatedRow[key] = '';
                        }
                        
                        // Additional validation for HCPCS codes (if column contains "HCPCS")
                        if (key.toLowerCase().includes('hcpcs') && validatedRow[key]) {
                          const hcpcsValue = String(validatedRow[key]).trim();
                          // Basic HCPCS format validation (5 characters, alphanumeric) - case insensitive
                          if (hcpcsValue.length > 0 && !/^[A-Za-z0-9]{1,8}(-[A-Za-z0-9]{1,2})?$/i.test(hcpcsValue)) {
                            console.warn(`Invalid HCPCS format: ${hcpcsValue}. Expected format: XXXXX or XXXXX-XX`);
                          }
                          validatedRow[key] = hcpcsValue;
                        }
                        
                        // Validation for numeric fields (if column contains "price", "amount", "cost", "quantity")
                        if (['price', 'amount', 'cost', 'quantity', 'qty'].some(term => 
                            key.toLowerCase().includes(term)) && validatedRow[key]) {
                          const numericValue = String(validatedRow[key]).replace(/[^\d.-]/g, '');
                          if (numericValue && !isNaN(parseFloat(numericValue))) {
                            validatedRow[key] = numericValue;
                          }
                        }
                      }
                    });
                    
                    const updatedRows = rowsMaster.map((row) =>
                      row.id === validatedRow.id ? validatedRow : row
                    );
                    setRowsMaster(updatedRows);
                    
                    // Update the sheet data as well
                    const currentSheet = masterSheetNames[activeMasterTab];
                    if (currentSheet && masterSheetData[currentSheet]) {
                      const updatedSheetData = {
                        ...masterSheetData,
                        [currentSheet]: {
                          ...masterSheetData[currentSheet],
                          rows: updatedRows
                        }
                      };
                      setMasterSheetData(updatedSheetData);
                    }
                    
                    // Mark as having unsaved changes
                    setHasUnsavedMasterChanges(true);
                    
                    // Re-validate for duplicates after row update to potentially re-enable save button
                    const validation = validateForDuplicates(updatedRows, 'master');
                    setDuplicateValidationErrors(prev => ({
                      ...prev,
                      master: { duplicateKeys: validation.duplicateKeys, duplicateRows: validation.duplicateRows }
                    }));
                    
                    return validatedRow;
                  }}
                  onProcessRowUpdateError={(error) => {
                    console.error('Master row update error:', error);
                  }}
                  onRowEditStop={(params) => {
                    // Auto-exit edit mode when clicking outside or pressing Escape
                    console.log('[EDIT MODE] Master row edit stopped:', params.id);
                  }}
                  sx={getDataGridStyles('master')}
                />
              </Box>
            </>
          ) : (
            // Show upload area when no data
            <Box
              sx={{
                height: 480,
                border: dragOverMaster ? '2px dashed #007bff' : '2px dashed #aaa',
                padding: '20px',
                textAlign: 'center',
                backgroundColor: dragOverMaster ? '#f0f8ff' : '#fafafa',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center'
              }}
              onDragEnter={handleDragEnter("Master")}
              onDragLeave={handleDragLeave("Master")}
              onDragOver={(e) => handleDragOver(e, "Master")}
              onDrop={(e) => handleDrop(e, "Master")}
            >
              <Typography variant="h4" sx={{ 
                mb: 3, 
                color: '#1976d2', 
                fontWeight: 'bold',
                textAlign: 'center'
              }}>📄 Master File</Typography>
              <Button variant="contained" component="label" sx={{ mb: 2 }}>
                Upload Master File
                <input
                  type="file"
                  hidden
                  onChange={(e) => handleFileUpload(e, "Master")}
                  ref={fileMasterInputRef}
                  accept=".xlsx, .xls"
                />
              </Button>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Drag and drop your Excel file here or click to browse
              </Typography>
            </Box>
          )}
        </Box>

        {/* Client File Area */}
        <Box 
          ref={clientGridRef}
          onClick={() => handleGridClick('client')}
          sx={{ 
            flex: 1,
            minWidth: 0,
            ...getGridContainerStyles('client')
          }}
        >
          {clientSheetNames.length > 0 ? (
            // Show tabs and grid when data is loaded
            <>
              <FileInfoCard metadata={clientFileMetadata} type="Client" />
              
              {clientSheetNames.length > 0 && (
                <Tabs 
                  value={activeClientTab} 
                  onChange={handleClientTabChange}
                  variant="scrollable"
                  scrollButtons="auto"
                  sx={{ 
                    mb: 2, 
                    borderBottom: 2, 
                    borderColor: '#e0e0e0',
                    '& .MuiTab-root': {
                      color: '#424242',
                      backgroundColor: '#f5f5f5',
                      border: '2px solid #bdbdbd',
                      borderBottom: 'none',
                      marginRight: '4px',
                      minHeight: '40px',
                      fontWeight: 'bold',
                      fontSize: '0.875rem',
                      '&.Mui-selected': {
                        color: '#1976d2',
                        backgroundColor: 'white',
                        fontWeight: 'bold',
                        border: '2px solid #2196f3'
                      },
                      '&:hover': {
                        color: '#1976d2',
                        backgroundColor: '#e3f2fd',
                        border: '2px solid #64b5f6'
                      }
                    },
                    '& .MuiTabs-indicator': {
                      display: 'none'
                    }
                  }}
                >
                  {clientSheetNames.map((sheetName, index) => (
                    <Tab key={index} label={sheetName} />
                  ))}
                </Tabs>
              )}
              
              <TextField
                fullWidth
                variant="outlined"
                placeholder="Search client data..."
                value={searchClientInput}
                onChange={(e) => setSearchClientInput(e.target.value)}
                slotProps={{ input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      {searchClientInput ? (
                        <IconButton
                          size="small"
                          onClick={() => {
                            setSearchClientInput('');
                            setSearchClient('');
                          }}
                          edge="start"
                        >
                          <ClearIcon />
                        </IconButton>
                      ) : (
                        <SearchIcon />
                      )}
                    </InputAdornment>
                  ),
                }}}
                sx={{ 
                  mb: 2,
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: 'white',
                    '& fieldset': {
                      borderColor: '#ccc',
                    },
                    '&:hover fieldset': {
                      borderColor: '#999',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#1976d2',
                    },
                  },
                  '& .MuiInputBase-input': {
                    color: 'black',
                  },
                  '& .MuiInputBase-input::placeholder': {
                    color: '#666',
                    opacity: 1,
                  }
                }}
              />
              
              {/* Save/Cancel buttons for editing */}
              {hasUnsavedChanges && (
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  gap: 1, 
                  mb: 2
                }}>
                  {duplicateValidationErrors.client.duplicateKeys.length > 0 && (
                    <Box sx={{ 
                      p: 1.5,
                      backgroundColor: '#ffebee',
                      border: '1px solid #f44336',
                      borderRadius: 1,
                      mb: 1
                    }}>
                      <Typography variant="body2" sx={{ 
                        color: '#d32f2f', 
                        fontWeight: 'bold',
                        mb: 0.5
                      }}>
                        🚫 Cannot save: Duplicate records found
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#d32f2f' }}>
                        Duplicate HCPCS codes: {duplicateValidationErrors.client.duplicateKeys.join(', ')}
                      </Typography>
                    </Box>
                  )}
                  
                  <Box sx={{ 
                    display: 'flex', 
                    gap: 1,
                    justifyContent: 'flex-end',
                    alignItems: 'center'
                  }}>
                    <Typography variant="body2" sx={{ 
                      color: '#f57c00', 
                      fontWeight: 'bold',
                      mr: 1
                    }}>
                      ⚠️ Unsaved changes
                    </Typography>
                    <Button 
                      variant="outlined" 
                      size="small"
                      onClick={() => handleCancelEdits('client')}
                      sx={{ 
                        color: '#d32f2f', 
                        borderColor: '#d32f2f',
                        '&:hover': {
                          backgroundColor: '#ffebee',
                          borderColor: '#c62828'
                        }
                      }}
                    >
                      Cancel
                    </Button>
                    <Button 
                      variant="contained" 
                      size="small"
                      onClick={() => handleSaveEdits('client')}
                      disabled={duplicateValidationErrors.client.duplicateKeys.length > 0}
                      sx={{ 
                        backgroundColor: '#4caf50',
                        '&:hover': {
                          backgroundColor: '#388e3c'
                        }
                      }}
                    >
                      Save
                    </Button>
                  </Box>
                </Box>
              )}
              
              <Box sx={{ height: 400, width: "100%" }}>
                <DataGrid
                  apiRef={clientApiRef}
                  rows={filteredRowsClient}
                  columns={enhancedClientColumns}
                  editMode="row"
                  density="compact"
                  disableVirtualization={aiSelectedGrid !== 'client'}
                  sortModel={clientSortModel}
                  onSortModelChange={setClientSortModel}
                  checkboxSelection
                  disableRowSelectionOnClick
                  showToolbar
                  onRowSelectionModelChange={(newRowSelectionModel) => {
                    // Handle the DataGrid selection model format
                    let selectedId = null;
                    let selectedIds: (number | string)[] = [];
                    
                    if (Array.isArray(newRowSelectionModel)) {
                      // Legacy format: array of IDs
                      selectedIds = newRowSelectionModel as (number | string)[];
                      selectedId = selectedIds.length > 0 ? selectedIds[0] : null;
                    } else if (newRowSelectionModel && typeof newRowSelectionModel === 'object' && 'ids' in newRowSelectionModel) {
                      // New format: {type: 'include', ids: Set(...)}
                      const ids = newRowSelectionModel.ids as Set<number | string>;
                      selectedIds = Array.from(ids);
                      selectedId = selectedIds.length > 0 ? selectedIds[0] : null;
                    }
                    
                    console.log('[CLIENT SELECTION] Setting selection:', { selectedId, selectedIds, aiSelectedGrid });
                    
                    // Update state with a small delay to ensure proper synchronization
                    setTimeout(() => {
                      setSelectedRowClient(selectedId);
                      setSelectedRowsClient(selectedIds);
                    }, 10);
                  }}
                  processRowUpdate={(newRow) => {
                    // Basic validation for edited cells
                    const validatedRow = { ...newRow };
                    
                    // Validate and clean each field
                    Object.keys(validatedRow).forEach(key => {
                      if (key !== 'id') {
                        const value = validatedRow[key];
                        
                        // Convert to string and trim whitespace
                        if (value !== null && value !== undefined) {
                          validatedRow[key] = String(value).trim();
                        } else {
                          validatedRow[key] = '';
                        }
                        
                        // Additional validation for HCPCS codes (if column contains "HCPCS")
                        if (key.toLowerCase().includes('hcpcs') && validatedRow[key]) {
                          const hcpcsValue = String(validatedRow[key]).trim();
                          // Basic HCPCS format validation (5 characters, alphanumeric) - case insensitive
                          if (hcpcsValue.length > 0 && !/^[A-Za-z0-9]{1,8}(-[A-Za-z0-9]{1,2})?$/i.test(hcpcsValue)) {
                            console.warn(`Invalid HCPCS format: ${hcpcsValue}. Expected format: XXXXX or XXXXX-XX`);
                          }
                          validatedRow[key] = hcpcsValue;
                        }
                        
                        // Validation for numeric fields (if column contains "price", "amount", "cost", "quantity")
                        if (['price', 'amount', 'cost', 'quantity', 'qty'].some(term => 
                            key.toLowerCase().includes(term)) && validatedRow[key]) {
                          const numericValue = String(validatedRow[key]).replace(/[^\d.-]/g, '');
                          if (numericValue && !isNaN(parseFloat(numericValue))) {
                            validatedRow[key] = numericValue;
                          }
                        }
                      }
                    });
                    
                    const updatedRows = rowsClient.map((row) =>
                      row.id === validatedRow.id ? validatedRow : row
                    );
                    setRowsClient(updatedRows);
                    
                    // Update the sheet data as well
                    const currentSheet = clientSheetNames[activeClientTab];
                    if (currentSheet && clientSheetData[currentSheet]) {
                      const updatedSheetData = {
                        ...clientSheetData,
                        [currentSheet]: {
                          ...clientSheetData[currentSheet],
                          rows: updatedRows
                        }
                      };
                      setClientSheetData(updatedSheetData);
                    }
                    
                    // Mark as having unsaved changes
                    setHasUnsavedChanges(true);
                    
                    // Re-validate for duplicates after row update to potentially re-enable save button
                    const validation = validateForDuplicates(updatedRows, 'client');
                    setDuplicateValidationErrors(prev => ({
                      ...prev,
                      client: { duplicateKeys: validation.duplicateKeys, duplicateRows: validation.duplicateRows }
                    }));
                    
                    return validatedRow;
                  }}
                  onProcessRowUpdateError={(error) => {
                    console.error('Row update error:', error);
                  }}
                  onRowEditStop={(params) => {
                    // Auto-exit edit mode when clicking outside or pressing Escape
                    console.log('[EDIT MODE] Client row edit stopped:', params.id);
                  }}
                  sx={getDataGridStyles('client')}
                />
              </Box>
            </>
          ) : (
            // Show upload area when no data
            <Box
              sx={{
                height: 480,
                border: dragOverClient ? '2px dashed #007bff' : '2px dashed #aaa',
                padding: '20px',
                textAlign: 'center',
                backgroundColor: dragOverClient ? '#f0f8ff' : '#fafafa',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center'
              }}
              onDragEnter={handleDragEnter("Client")}
              onDragLeave={handleDragLeave("Client")}
              onDragOver={(e) => handleDragOver(e, "Client")}
              onDrop={(e) => handleDrop(e, "Client")}
            >
              <Typography variant="h4" sx={{ 
                mb: 3, 
                color: '#1976d2', 
                fontWeight: 'bold',
                textAlign: 'center'
              }}>📋 Client File</Typography>
              <Button variant="contained" component="label" sx={{ mb: 2 }}>
                Upload Client File
                <input
                  type="file"
                  hidden
                  onChange={(e) => handleFileUpload(e, "Client")}
                  ref={fileClientInputRef}
                  accept=".xlsx, .xls"
                />
              </Button>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Drag and drop your Excel file here or click to browse
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
      </Box>
      
      {/* Load Last File buttons */}
      {(lastMasterData || lastClientData) && (
        <Box sx={{ display: "flex", justifyContent: "center", gap: 2, mb: 2, flexWrap: "wrap" }}>
          {lastMasterData && lastClientData && lastMasterFile && lastClientFile && (
            <Button 
              variant="contained"
              color="success"
              onClick={handleRestoreSession}
            >
              Restore Last Session
            </Button>
          )}
          <Tooltip title={lastMasterFile ? `Load last master file: ${lastMasterFile}` : "No master file in memory"}>
            <span>
              <Button 
                variant="outlined" 
                onClick={() => handleLoadLastFile("Master")}
                disabled={!lastMasterData || !lastMasterFile}
              >
                Load Last Master
              </Button>
            </span>
          </Tooltip>
          <Tooltip title={lastClientFile ? `Load last client file: ${lastClientFile}` : "No client file in memory"}>
            <span>
              <Button 
                variant="outlined" 
                onClick={() => handleLoadLastFile("Client")}
                disabled={!lastClientData || !lastClientFile}
              >
                Load Last Client
              </Button>
            </span>
          </Tooltip>
          <Button variant="contained" onClick={handleReset} color="warning">
            Reset
          </Button>
          <Button variant="contained" onClick={handleClearAllData} color="error">
            Clear All Data
          </Button>
        </Box>
      )}
      
      <Box sx={{ display: "flex", justifyContent: "center", gap: 2, mb: 2, flexWrap: "wrap" }}>
        <Button
          variant="contained"
          onClick={handleLoadSampleData}
          sx={{
            fontWeight: 'bold',
            backgroundColor: '#ff9800',
            '&:hover': { backgroundColor: '#f57c00' }
          }}
        >
          📂 Load Sample Data
        </Button>
        <Button
          variant="outlined"
          onClick={() => setModifierDialogOpen(true)}
          sx={{
            fontWeight: 'bold',
            borderWidth: 2,
            color: '#9c27b0',
            borderColor: '#9c27b0',
            '&:hover': { backgroundColor: '#f3e5f5', borderColor: '#7b1fa2' }
          }}
        >
          ⚙️ Modifier Settings
        </Button>
        <Button 
          variant="contained" 
          onClick={handleMerge}
          disabled={rowsMaster.length === 0 || rowsClient.length === 0}
          sx={{ 
            fontWeight: 'bold', 
            backgroundColor: '#2196f3', 
            '&:hover': { backgroundColor: '#1976d2' },
            '&:disabled': { backgroundColor: '#e0e0e0', color: '#9e9e9e' }
          }}
        >
          🔍 Merge
        </Button>
        <Button 
          variant="contained" 
          onClick={handleExport} 
          disabled={mergedForExport.length === 0}
          sx={{ 
            fontWeight: 'bold', 
            backgroundColor: '#4caf50', 
            '&:hover': { backgroundColor: '#388e3c' },
            '&:disabled': { backgroundColor: '#e0e0e0', color: '#9e9e9e' }
          }}
        >
          📁 Export Merged Data
        </Button>
        {!(lastMasterData || lastClientData) && (
          <Button 
            variant="contained" 
            onClick={handleReset} 
            sx={{ 
              fontWeight: 'bold', 
              backgroundColor: '#ff9800', 
              '&:hover': { backgroundColor: '#f57c00' }
            }}
          >
            🔄 Reset
          </Button>
        )}
      </Box>
      
      {/* Modifier Criteria Dialog */}
      <Dialog open={modifierDialogOpen} onClose={() => setModifierDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Modifier Criteria</DialogTitle>
        <DialogContent>
          <FormGroup>
            <FormControlLabel
              control={<Checkbox checked={modifierCriteria.root00} onChange={handleModifierChange("root00")} />}
              label="Include Root 00"
            />
            <FormControlLabel
              control={<Checkbox checked={modifierCriteria.root25} onChange={handleModifierChange("root25")} />}
              label="Include Root 25"
            />
            <FormControlLabel
              control={<Checkbox checked={modifierCriteria.ignoreTrauma} onChange={handleModifierChange("ignoreTrauma")} />}
              label="Ignore Trauma Team Codes"
            />
            <FormControlLabel
              control={<Checkbox checked={modifierCriteria.root50} onChange={handleModifierChange("root50")} />}
              label="Include Root 50"
            />
            <FormControlLabel
              control={<Checkbox checked={modifierCriteria.root59} onChange={handleModifierChange("root59")} />}
              label="Include Root 59"
            />
            <FormControlLabel
              control={<Checkbox checked={modifierCriteria.rootXU} onChange={handleModifierChange("rootXU")} />}
              label="Include Root XU"
            />
            <FormControlLabel
              control={<Checkbox checked={modifierCriteria.root76} onChange={handleModifierChange("root76")} />}
              label="Include Root 76"
            />
          </FormGroup>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModifierDialogOpen(false)} color="primary">
            Close
          </Button>
        </DialogActions>
      </Dialog>
      
      
      {/* Compare Results Section */}
      {showCompare && (
        <Box sx={{ mt: 4 }}>
          {mergedSheetInfo && (
            <Box sx={{ 
              mb: 1, 
              p: 1.5,
              backgroundColor: '#f0f8ff', 
              border: '2px solid #2196f3', 
              borderRadius: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              flexWrap: 'wrap'
            }}>
              <Typography variant="body2" sx={{ color: '#1976d2', fontWeight: 'bold' }}>
                📊 Merged:
              </Typography>
              <Typography variant="body2" sx={{ color: '#424242' }}>
                &quot;{mergedSheetInfo.masterSheet}&quot; ↔ &quot;{mergedSheetInfo.clientSheet}&quot;
              </Typography>
            </Box>
          )}
          
          <ComparisonStatsPanel stats={comparisonStats} />
          
          {/* Merged Results */}
          <Box 
            ref={mergedGridRef}
            onClick={() => handleGridClick('merged')}
            sx={{ 
              mb: 4,
              ...getGridContainerStyles('merged')
            }}
          >
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
              <TextField
                fullWidth
                variant="outlined"
                placeholder="Search merged data..."
                value={searchMergedInput}
                onChange={(e) => setSearchMergedInput(e.target.value)}
                slotProps={{ input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      {searchMergedInput ? (
                        <IconButton
                          size="small"
                          onClick={() => {
                            setSearchMergedInput('');
                            setSearchMerged('');
                          }}
                          edge="start"
                        >
                          <ClearIcon />
                        </IconButton>
                      ) : (
                        <SearchIcon />
                      )}
                    </InputAdornment>
                  ),
                }}}
                sx={{ 
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: 'white',
                    '& fieldset': {
                      borderColor: '#ccc',
                    },
                    '&:hover fieldset': {
                      borderColor: '#999',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#1976d2',
                    },
                  },
                  '& .MuiInputBase-input': {
                    color: 'black',
                  },
                  '& .MuiInputBase-input::placeholder': {
                    color: '#666',
                    opacity: 1,
                  }
                }}
              />

            </Box>
            
            {/* Save/Cancel buttons for merged editing */}
            {hasUnsavedMergedChanges && (
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column',
                gap: 1, 
                mb: 2
              }}>
                {duplicateValidationErrors.merged.duplicateKeys.length > 0 && (
                  <Box sx={{ 
                    p: 1.5,
                    backgroundColor: '#ffebee',
                    border: '1px solid #f44336',
                    borderRadius: 1,
                    mb: 1
                  }}>
                    <Typography variant="body2" sx={{ 
                      color: '#d32f2f', 
                      fontWeight: 'bold',
                      mb: 0.5
                    }}>
                      🚫 Cannot save: Duplicate records found
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#d32f2f' }}>
                      Duplicate HCPCS codes: {duplicateValidationErrors.merged.duplicateKeys.join(', ')}
                    </Typography>
                  </Box>
                )}
                
                <Box sx={{ 
                  display: 'flex', 
                  gap: 1,
                  justifyContent: 'flex-end',
                  alignItems: 'center'
                }}>
                  <Typography variant="body2" sx={{ 
                    color: '#f57c00', 
                    fontWeight: 'bold',
                    mr: 1
                  }}>
                    ⚠️ Unsaved changes
                  </Typography>
                  <Button 
                    variant="outlined" 
                    size="small"
                    onClick={() => handleCancelEdits('merged')}
                    sx={{ 
                      color: '#d32f2f', 
                      borderColor: '#d32f2f',
                      '&:hover': {
                        backgroundColor: '#ffebee',
                        borderColor: '#c62828'
                      }
                    }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    variant="contained" 
                    size="small"
                    onClick={() => handleSaveEdits('merged')}
                    disabled={duplicateValidationErrors.merged.duplicateKeys.length > 0}
                    sx={{ 
                      backgroundColor: '#4caf50',
                      '&:hover': {
                        backgroundColor: '#388e3c'
                      }
                    }}
                  >
                    Save
                  </Button>
                </Box>
              </Box>
            )}
            
            <Box sx={{ height: 400, width: "100%" }}>
              <DataGrid
                apiRef={mergedApiRef}
                rows={filteredMergedRows}
                columns={enhancedMergedColumnsWithActions}
                editMode="row"
                density="compact"
                disableVirtualization={aiSelectedGrid !== 'merged'}
                sortModel={mergedSortModel}
                onSortModelChange={setMergedSortModel}
                checkboxSelection
                disableRowSelectionOnClick
                showToolbar

                onRowSelectionModelChange={(newRowSelectionModel) => {
                  console.log('[MERGED GRID] Selection change triggered! aiSelectedGrid:', aiSelectedGrid);
                  console.log('[MERGED GRID] Raw newRowSelectionModel:', newRowSelectionModel);
                  console.log('[MERGED GRID] Type of newRowSelectionModel:', typeof newRowSelectionModel);
                  console.log('[MERGED GRID] Is Array?', Array.isArray(newRowSelectionModel));
                  console.log('[MERGED GRID] Length:', Array.isArray(newRowSelectionModel) ? newRowSelectionModel.length : 'N/A');
                  
                  // Handle the DataGrid selection model format
                  let selectedId = null;
                  let selectedIds: (number | string)[] = [];
                  
                  if (Array.isArray(newRowSelectionModel)) {
                    // Legacy format: array of IDs
                    selectedIds = newRowSelectionModel as (number | string)[];
                    selectedId = selectedIds.length > 0 ? selectedIds[0] : null;
                  } else if (newRowSelectionModel && typeof newRowSelectionModel === 'object' && 'ids' in newRowSelectionModel) {
                    // New format: {type: 'include', ids: Set(...)}
                    const ids = newRowSelectionModel.ids as Set<number | string>;
                    selectedIds = Array.from(ids);
                    selectedId = selectedIds.length > 0 ? selectedIds[0] : null;
                  }
                  
                  console.log('[MERGED SELECTION] Setting selection:', { selectedId, selectedIds, aiSelectedGrid });
                  
                  // Update state with a small delay to ensure proper synchronization
                  setTimeout(() => {
                    setSelectedRowMerged(selectedId);
                    setSelectedRowsMerged(selectedIds);
                  }, 10);
                }}
                processRowUpdate={(newRow) => {
                  // Basic validation for edited cells
                  const validatedRow = { ...newRow };
                  
                  // Validate and clean each field
                  Object.keys(validatedRow).forEach(key => {
                    if (key !== 'id') {
                      const value = validatedRow[key];
                      
                      // Convert to string and trim whitespace
                      if (value !== null && value !== undefined) {
                        validatedRow[key] = String(value).trim();
                      } else {
                        validatedRow[key] = '';
                      }
                      
                      // Additional validation for HCPCS codes (if column contains "HCPCS")
                      if (key.toLowerCase().includes('hcpcs') && validatedRow[key]) {
                        const hcpcsValue = String(validatedRow[key]).trim();
                        // Basic HCPCS format validation (5 characters, alphanumeric) - case insensitive
                        if (hcpcsValue.length > 0 && !/^[A-Za-z0-9]{1,8}(-[A-Za-z0-9]{1,2})?$/i.test(hcpcsValue)) {
                          console.warn(`Invalid HCPCS format: ${hcpcsValue}. Expected format: XXXXX or XXXXX-XX`);
                        }
                        validatedRow[key] = hcpcsValue;
                      }
                      
                      // Validation for numeric fields (if column contains "price", "amount", "cost", "quantity")
                      if (['price', 'amount', 'cost', 'quantity', 'qty'].some(term => 
                          key.toLowerCase().includes(term)) && validatedRow[key]) {
                        const numericValue = String(validatedRow[key]).replace(/[^\d.-]/g, '');
                        if (numericValue && !isNaN(parseFloat(numericValue))) {
                          validatedRow[key] = numericValue;
                        }
                      }
                    }
                  });
                  
                  const updatedRows = mergedRows.map((row) =>
                    row.id === validatedRow.id ? validatedRow : row
                  );
                  setMergedRows(updatedRows);
                  setMergedForExport(updatedRows);
                  
                  // Mark as having unsaved changes
                  setHasUnsavedMergedChanges(true);
                  
                  // Re-validate for duplicates after row update to potentially re-enable save button
                  const validation = validateForDuplicates(updatedRows, 'merged');
                  setDuplicateValidationErrors(prev => ({
                    ...prev,
                    merged: { duplicateKeys: validation.duplicateKeys, duplicateRows: validation.duplicateRows }
                  }));
                  
                  return validatedRow;
                }}
                onProcessRowUpdateError={(error) => {
                  console.error('Merged row update error:', error);
                }}
                onRowEditStop={(params) => {
                  // Auto-exit edit mode when clicking outside or pressing Escape
                  console.log('[EDIT MODE] Merged row edit stopped:', params.id);
                }}
                sx={getDataGridStyles('merged')}
              />
            </Box>
          </Box>
          
          {/* Errors and Duplicates Tabs */}
          <Box sx={{ display: 'flex', gap: 2, borderBottom: 2, borderColor: '#e0e0e0', mb: 3 }}>
            <Button
              variant={errorsTabValue === 0 ? "contained" : "outlined"}
              onClick={() => setErrorsTabValue(0)}
              size="medium"
              sx={{
                fontWeight: 'bold',
                borderWidth: 2,
                color: errorsTabValue === 0 ? 'white' : '#d32f2f',
                backgroundColor: errorsTabValue === 0 ? '#d32f2f' : 'white',
                borderColor: '#d32f2f',
                '&:hover': {
                  backgroundColor: errorsTabValue === 0 ? '#c62828' : '#ffebee',
                  borderColor: '#c62828'
                }
              }}
            >
              Unmatched Records ({unmatchedClient.length})
            </Button>
            <Button
              variant={errorsTabValue === 1 ? "contained" : "outlined"}
              onClick={() => setErrorsTabValue(1)}
              size="medium"
              sx={{
                fontWeight: 'bold',
                borderWidth: 2,
                color: errorsTabValue === 1 ? 'white' : '#f57c00',
                backgroundColor: errorsTabValue === 1 ? '#f57c00' : 'white',
                borderColor: '#f57c00',
                '&:hover': {
                  backgroundColor: errorsTabValue === 1 ? '#ef6c00' : '#fff3e0',
                  borderColor: '#ef6c00'
                }
              }}
            >
              Duplicate Records ({dupsClient.length})
            </Button>
          </Box>
          
          {/* Unmatched Records Grid */}
          {errorsTabValue === 0 && (
            <Box 
              ref={unmatchedGridRef}
              onClick={() => handleGridClick('unmatched')}
              sx={{ 
                height: 400, 
                width: "100%", 
                mb: 4,
                ...getGridContainerStyles('unmatched')
              }}
            >
              {unmatchedClient.length > 0 ? (
                <DataGrid
                  rows={filteredUnmatchedClient}
                  columns={columnsClient}
                  density="compact"
                  disableVirtualization={aiSelectedGrid !== 'unmatched'}
                  sortModel={unmatchedSortModel}
                  onSortModelChange={setUnmatchedSortModel}
                  checkboxSelection
                  disableRowSelectionOnClick
                  showToolbar
                  onRowSelectionModelChange={(newRowSelectionModel) => {
                    // Handle the DataGrid selection model format
                    let selectedId = null;
                    let selectedIds: (number | string)[] = [];
                    
                    if (Array.isArray(newRowSelectionModel)) {
                      // Legacy format: array of IDs
                      selectedIds = newRowSelectionModel as (number | string)[];
                      selectedId = selectedIds.length > 0 ? selectedIds[0] : null;
                    } else if (newRowSelectionModel && typeof newRowSelectionModel === 'object' && 'ids' in newRowSelectionModel) {
                      // New format: {type: 'include', ids: Set(...)}
                      const ids = newRowSelectionModel.ids as Set<number | string>;
                      selectedIds = Array.from(ids);
                      selectedId = selectedIds.length > 0 ? selectedIds[0] : null;
                    }
                    
                    console.log('[UNMATCHED SELECTION] Setting selection:', { selectedId, selectedIds, aiSelectedGrid });
                    
                    // Update state with a small delay to ensure proper synchronization
                    setTimeout(() => {
                      setSelectedRowUnmatched(selectedId);
                      setSelectedRowsUnmatched(selectedIds);
                    }, 10);
                  }}
                  sx={getDataGridStyles('unmatched')}
                />
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <Typography variant="body1" color="text.secondary">
                    No unmatched records found.
                  </Typography>
                </Box>
              )}
            </Box>
          )}
          
          {/* Duplicate Records Grid */}
          {errorsTabValue === 1 && (
            <Box 
              ref={duplicatesGridRef}
              onClick={() => handleGridClick('duplicates')}
              sx={{ 
                height: 400, 
                width: "100%",
                ...getGridContainerStyles('duplicates')
              }}
            >
              {dupsClient.length > 0 ? (
                <DataGrid
                  rows={filteredDupsClient}
                  columns={columnsClient}
                  density="compact"
                  disableVirtualization={aiSelectedGrid !== 'duplicates'}
                  sortModel={duplicatesSortModel}
                  onSortModelChange={setDuplicatesSortModel}
                  checkboxSelection
                  disableRowSelectionOnClick
                  showToolbar
                  onRowSelectionModelChange={(newRowSelectionModel) => {
                    // Handle the DataGrid selection model format
                    let selectedId = null;
                    let selectedIds: (number | string)[] = [];
                    
                    if (Array.isArray(newRowSelectionModel)) {
                      // Legacy format: array of IDs
                      selectedIds = newRowSelectionModel as (number | string)[];
                      selectedId = selectedIds.length > 0 ? selectedIds[0] : null;
                    } else if (newRowSelectionModel && typeof newRowSelectionModel === 'object' && 'ids' in newRowSelectionModel) {
                      // New format: {type: 'include', ids: Set(...)}
                      const ids = newRowSelectionModel.ids as Set<number | string>;
                      selectedIds = Array.from(ids);
                      selectedId = selectedIds.length > 0 ? selectedIds[0] : null;
                    }
                    
                    console.log('[DUPLICATES SELECTION] Setting selection:', { selectedId, selectedIds, aiSelectedGrid });
                    
                    // Update state with a small delay to ensure proper synchronization
                    setTimeout(() => {
                      setSelectedRowDuplicates(selectedId);
                      setSelectedRowsDuplicates(selectedIds);
                    }, 10);
                  }}
                  sx={getDataGridStyles('duplicates')}
                />
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <Typography variant="body1" color="text.secondary">
                    No duplicate records found.
                  </Typography>
                </Box>
              )}
            </Box>
          )}
          
        </Box>
      )}

      {/* AI Chat Components */}
      {!isChatOpen && (
        <Fab
          color="primary"
          aria-label="AI Assistant"
          sx={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            zIndex: 1000,
          }}
          onClick={() => setIsChatOpen(true)}
        >
          <SmartToyIcon />
        </Fab>
      )}

      <AIChat
        ref={aiChatRef}
        gridContext={gridContext}
        onAction={handleAIAction}
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        selectedGrid={aiSelectedGrid}
        onGridChange={setAiSelectedGrid}
        onWidthChange={handleChatWidthChange}
      />
    </Box>
    </NoSSR>
  );
}
