"use client";

import React from "react";
import { Box, Typography, Button, TextField, InputAdornment } from "@mui/material";
import { GridColDef, GridSortModel, GridRowSelectionModel } from "@mui/x-data-grid";
import { DynamicDataGrid } from "./DynamicDataGrid";
import SearchIcon from "@mui/icons-material/Search";
import { ComparisonStatsPanel } from "./ComparisonStatsPanel";

interface ExcelRow {
  id: number;
  [key: string]: string | number | undefined;
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

interface MergedResultsAreaProps {
  // Data
  mergedRows: ExcelRow[];
  mergedColumns: GridColDef[];
  filteredMergedRows: ExcelRow[];
  comparisonStats: ComparisonStats | null;
  
  // Search and filters
  searchMerged: string;
  mergedSortModel: GridSortModel;
  
  // Selection
  selectedRowsMerged: (number | string)[];
  selectedRowMerged: number | string | null;
  
  // UI state
  isClient: boolean;
  hasUnsavedMergedChanges: boolean;
  
  // Handlers
  onSearchChange: (search: string) => void;
  onSortModelChange: (model: GridSortModel) => void;
  onRowSelectionModelChange: (selection: GridRowSelectionModel) => void;
  onRowClick: (rowId: number | string) => void;
  onExport: () => void;
}

export const MergedResultsArea: React.FC<MergedResultsAreaProps> = ({
  mergedRows,
  mergedColumns,
  filteredMergedRows,
  comparisonStats,
  searchMerged,
  mergedSortModel,
  selectedRowsMerged,
  isClient,
  hasUnsavedMergedChanges,
  onSearchChange,
  onSortModelChange,
  onRowSelectionModelChange,
  onRowClick,
  onExport
}) => {
  if (mergedRows.length === 0 || mergedColumns.length === 0 || !isClient) return null;

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h6" gutterBottom sx={{ color: '#1976d2', fontWeight: 'bold' }}>
        🔗 Merged Results
      </Typography>
      
      <ComparisonStatsPanel stats={comparisonStats} />
      
      <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Search merged data..."
            value={searchMerged}
            onChange={(e) => onSearchChange(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: 250 }}
          />
          {hasUnsavedMergedChanges && (
            <Typography variant="caption" sx={{ color: 'orange', fontWeight: 'bold' }}>
              ⚠️ Unsaved changes
            </Typography>
          )}
        </Box>
        
        <Button
          variant="contained"
          onClick={onExport}
          disabled={mergedRows.length === 0}
          sx={{
            backgroundColor: '#4caf50',
            '&:hover': { backgroundColor: '#45a049' },
            fontWeight: 'bold'
          }}
        >
          📥 Export Results
        </Button>
      </Box>

      <Box sx={{ height: 600, width: '100%' }}>
        <DynamicDataGrid
          gridKey={`merged-grid-${mergedColumns.length}`}
          rows={filteredMergedRows}
          columns={mergedColumns}
          sortModel={mergedSortModel}
          onSortModelChange={onSortModelChange}
          checkboxSelection
          rowSelectionModel={selectedRowsMerged as unknown as GridRowSelectionModel}
          onRowSelectionModelChange={onRowSelectionModelChange}
          onRowClick={(params: { id: number | string }) => onRowClick(params.id)}
          disableRowSelectionOnClick={false}
          sx={{
            border: 'none',
            '& .MuiDataGrid-root': {
              backgroundColor: 'white',
            },
            '& .MuiDataGrid-cell:focus': {
              outline: 'none',
            },
            '& .MuiDataGrid-row:hover': {
              backgroundColor: '#f5f5f5',
            },
            '& .MuiDataGrid-columnHeaders': {
              backgroundColor: '#4caf50',
              color: 'white',
              fontWeight: 'bold',
            },
            '& .MuiCheckbox-root': {
              color: '#4caf50',
            },
            '& .MuiDataGrid-row.Mui-selected': {
              backgroundColor: '#e8f5e8',
              '&:hover': {
                backgroundColor: '#c8e6c9',
              },
            },
          }}
          pageSizeOptions={[25, 50, 100]}
          initialState={{
            pagination: { paginationModel: { pageSize: 25 } },
          }}
        />
      </Box>
    </Box>
  );
};