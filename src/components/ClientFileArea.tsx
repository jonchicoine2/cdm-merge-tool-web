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

interface ClientFileAreaProps {
  // Data
  rowsClient: ExcelRow[];
  columnsClient: GridColDef[];
  clientSheetData: {[sheetName: string]: {rows: ExcelRow[], columns: GridColDef[]}};
  clientSheetNames: string[];
  activeClientTab: number;
  clientFileMetadata: FileMetadata | null;
  
  // Search and filters
  searchClient: string;
  filteredClientRows: ExcelRow[];
  clientSortModel: GridSortModel;
  
  // Selection
  selectedRowsClient: (number | string)[];
  selectedRowClient: number | string | null;
  
  // UI state
  isClient: boolean;
  dragOverClient: boolean;
  hasUnsavedChanges: boolean;
  
  // Handlers
  fileClientInputRef: React.RefObject<HTMLInputElement | null>;
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

export const ClientFileArea: React.FC<ClientFileAreaProps> = ({
  rowsClient,
  columnsClient,
  clientSheetData,
  clientSheetNames,
  activeClientTab,
  clientFileMetadata,
  searchClient,
  filteredClientRows,
  clientSortModel,
  selectedRowsClient,
  isClient,
  dragOverClient,
  hasUnsavedChanges,
  fileClientInputRef,
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
        📋 Client File
      </Typography>
      
      <FileInfoCard metadata={clientFileMetadata} type="Client" isClient={isClient} />
      
      <Box
        sx={{
          border: dragOverClient ? '3px dashed #2196f3' : '2px dashed #ccc',
          backgroundColor: dragOverClient ? '#e3f2fd' : '#f9f9f9',
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
        onClick={() => fileClientInputRef.current?.click()}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        <input
          type="file"
          accept=".xlsx,.xls"
          style={{ display: 'none' }}
          ref={fileClientInputRef}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFileUpload(file, 'Client');
          }}
        />
        <Typography variant="body1" sx={{ color: '#666' }}>
          📁 Drag & drop Client file here or click to browse
        </Typography>
        <Typography variant="body2" sx={{ color: '#999', mt: 1 }}>
          Accepts .xlsx and .xls files
        </Typography>
        <Button variant="outlined" sx={{ mt: 2 }}>
          Choose Client File
        </Button>
      </Box>

      {clientSheetNames.length > 1 && isClient && (
        <Box sx={{ mb: 2 }}>
          <Tabs
            value={activeClientTab}
            onChange={(event, newValue) => onTabChange(event, newValue)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              '& .MuiTab-root': { minWidth: 120, textTransform: 'none' },
              '& .Mui-selected': { color: '#1976d2', fontWeight: 'bold' }
            }}
          >
            {clientSheetNames.map((sheetName, index) => (
              <Tab
                key={index}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    📋 {sheetName}
                    {clientSheetData[sheetName] && (
                      <Typography variant="caption" sx={{ color: '#666' }}>
                        ({clientSheetData[sheetName].rows.length})
                      </Typography>
                    )}
                  </Box>
                }
              />
            ))}
          </Tabs>
        </Box>
      )}

      {rowsClient.length > 0 && columnsClient.length > 0 && isClient && (
        <>
          <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              size="small"
              placeholder="Search client data..."
              value={searchClient}
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
            {hasUnsavedChanges && (
              <Typography variant="caption" sx={{ color: 'orange', fontWeight: 'bold' }}>
                ⚠️ Unsaved changes
              </Typography>
            )}
          </Box>

          <Box sx={{ height: 600, width: '100%' }}>
            <DynamicDataGrid
              gridKey={`client-grid-${columnsClient.length}-${rowsClient.length}`}
              rows={filteredClientRows}
              columns={columnsClient}
              sortModel={clientSortModel}
              onSortModelChange={onSortModelChange}
              checkboxSelection
              rowSelectionModel={selectedRowsClient as unknown as GridRowSelectionModel}
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