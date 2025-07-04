"use client";

import React from "react";
import { Box, Typography, Button, Tabs, Tab, TextField, InputAdornment } from "@mui/material";
import { GridColDef, GridSortModel, GridRowSelectionModel } from "@mui/x-data-grid";
import { DynamicDataGrid } from "./DynamicDataGrid";
import SearchIcon from "@mui/icons-material/Search";
import { FileInfoCard } from "./FileInfoCard";

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

interface MasterFileAreaProps {
  // Data
  rowsMaster: ExcelRow[];
  columnsMaster: GridColDef[];
  masterSheetData: {[sheetName: string]: {rows: ExcelRow[], columns: GridColDef[]}};
  masterSheetNames: string[];
  activeMasterTab: number;
  masterFileMetadata: FileMetadata | null;
  
  // Search and filters
  searchMaster: string;
  filteredMasterRows: ExcelRow[];
  masterSortModel: GridSortModel;
  
  // Selection
  selectedRowsMaster: (number | string)[];
  selectedRowMaster: number | string | null;
  
  // UI state
  isClient: boolean;
  dragOverMaster: boolean;
  hasUnsavedMasterChanges: boolean;
  
  // Handlers
  fileMasterInputRef: React.RefObject<HTMLInputElement | null>;
  onFileUpload: (file: File, which: "Master" | "Client") => void;
  onTabChange: (event: React.SyntheticEvent, newValue: number) => void;
  onSearchChange: (search: string) => void;
  onSortModelChange: (model: GridSortModel) => void;
  onRowSelectionModelChange: (selection: GridRowSelectionModel) => void;
  onRowClick: (rowId: number | string) => void;
  onDragEnter: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
}

export const MasterFileArea: React.FC<MasterFileAreaProps> = ({
  rowsMaster,
  columnsMaster,
  masterSheetData,
  masterSheetNames,
  activeMasterTab,
  masterFileMetadata,
  searchMaster,
  filteredMasterRows,
  masterSortModel,
  selectedRowsMaster,
  selectedRowMaster,
  isClient,
  dragOverMaster,
  hasUnsavedMasterChanges,
  fileMasterInputRef,
  onFileUpload,
  onTabChange,
  onSearchChange,
  onSortModelChange,
  onRowSelectionModelChange,
  onRowClick,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop
}) => {
  return (
    <Box sx={{ flex: 1 }}>
      <Typography variant="h6" gutterBottom sx={{ color: '#1976d2', fontWeight: 'bold' }}>
        📊 Master CDM File
      </Typography>
      
      <FileInfoCard metadata={masterFileMetadata} type="Master" isClient={isClient} />
      
      <Box
        sx={{
          border: dragOverMaster ? '3px dashed #2196f3' : '2px dashed #ccc',
          backgroundColor: dragOverMaster ? '#e3f2fd' : '#f9f9f9',
          borderRadius: 2,
          p: 3,
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          mb: 2,
          '&:hover': {
            borderColor: '#2196f3',
            backgroundColor: '#f0f8ff'
          }
        }}
        onClick={() => fileMasterInputRef.current?.click()}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        <input
          type="file"
          accept=".xlsx,.xls"
          style={{ display: 'none' }}
          ref={fileMasterInputRef}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFileUpload(file, 'Master');
          }}
        />
        <Typography variant="body1" sx={{ color: '#666' }}>
          📁 Drag & drop Master CDM file here or click to browse
        </Typography>
        <Typography variant="body2" sx={{ color: '#999', mt: 1 }}>
          Accepts .xlsx and .xls files
        </Typography>
        <Button variant="outlined" sx={{ mt: 2 }}>
          Choose Master File
        </Button>
      </Box>

      {masterSheetNames.length > 1 && isClient && (
        <Box sx={{ mb: 2 }}>
          <Tabs
            value={activeMasterTab}
            onChange={(event, newValue) => onTabChange(event, newValue)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              '& .MuiTab-root': { minWidth: 120, textTransform: 'none' },
              '& .Mui-selected': { color: '#1976d2', fontWeight: 'bold' }
            }}
          >
            {masterSheetNames.map((sheetName, index) => (
              <Tab
                key={index}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    📋 {sheetName}
                    {masterSheetData[sheetName] && (
                      <Typography variant="caption" sx={{ color: '#666' }}>
                        ({masterSheetData[sheetName].rows.length})
                      </Typography>
                    )}
                  </Box>
                }
              />
            ))}
          </Tabs>
        </Box>
      )}

      {rowsMaster.length > 0 && columnsMaster.length > 0 && isClient && (
        <>
          <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              size="small"
              placeholder="Search master data..."
              value={searchMaster}
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
            {hasUnsavedMasterChanges && (
              <Typography variant="caption" sx={{ color: 'orange', fontWeight: 'bold' }}>
                ⚠️ Unsaved changes
              </Typography>
            )}
          </Box>

          <Box sx={{ height: 600, width: '100%' }}>
            <DynamicDataGrid
              gridKey={`master-grid-${columnsMaster.length}-${rowsMaster.length}`}
              rows={filteredMasterRows}
              columns={columnsMaster}
              sortModel={masterSortModel}
              onSortModelChange={onSortModelChange}
              checkboxSelection
              rowSelectionModel={selectedRowsMaster}
              onRowSelectionModelChange={onRowSelectionModelChange}
              onRowClick={(params: any) => onRowClick(params.id)}
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
                  backgroundColor: '#1976d2',
                  color: 'white',
                  fontWeight: 'bold',
                },
                '& .MuiCheckbox-root': {
                  color: '#1976d2',
                },
                '& .MuiDataGrid-row.Mui-selected': {
                  backgroundColor: '#e3f2fd',
                  '&:hover': {
                    backgroundColor: '#bbdefb',
                  },
                },
              }}
              pageSizeOptions={[25, 50, 100]}
              initialState={{
                pagination: { paginationModel: { pageSize: 25 } },
              }}
            />
          </Box>
        </>
      )}
    </Box>
  );
};