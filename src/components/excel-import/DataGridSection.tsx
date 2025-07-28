import React from 'react';
import { Box, Typography, Chip } from '@mui/material';
import { DataGridPro, GridToolbar } from '@mui/x-data-grid-pro';
import { DataGridSectionProps } from './types';

const DataGridSection: React.FC<DataGridSectionProps> = ({
  title,
  rows,
  columns,
  gridType,
  fileMetadata,
  apiRef,
  headerColor = '#1976d2',
  backgroundColor = '#f8fbff'
}) => {
  // Only hide if both rows and columns are empty (no file loaded)
  if (rows.length === 0 && columns.length === 0) return null;

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Box sx={{ 
      flex: 1,
      minHeight: 400,
      border: '2px solid #e0e0e0',
      borderRadius: '8px',
      padding: '16px',
      background: 'white',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      <Typography variant="h6" sx={{
        mb: 2,
        color: headerColor,
        fontWeight: 'bold',
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        flexWrap: 'wrap'
      }}>
        {title} ({rows.length.toLocaleString()} records)
        {fileMetadata && (
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            ml: 1
          }}>
            <Chip
              size="small"
              label={fileMetadata.name}
              variant="outlined"
              sx={{
                fontSize: '0.7rem',
                height: '20px',
                '& .MuiChip-label': { px: 1 }
              }}
            />
            <Chip
              size="small"
              label={formatFileSize(fileMetadata.size)}
              sx={{
                backgroundColor: '#e3f2fd',
                color: '#1976d2',
                fontSize: '0.7rem',
                height: '20px',
                '& .MuiChip-label': { px: 1 }
              }}
            />
            <Chip
              size="small"
              label={`${fileMetadata.sheetCount} sheet${fileMetadata.sheetCount !== 1 ? 's' : ''}`}
              sx={{
                backgroundColor: '#e8f5e8',
                color: '#2e7d32',
                fontSize: '0.7rem',
                height: '20px',
                '& .MuiChip-label': { px: 1 }
              }}
            />
            <Chip
              size="small"
              label={`${fileMetadata.recordCount.toLocaleString()} records`}
              sx={{
                backgroundColor: '#fff3e0',
                color: '#f57c00',
                fontSize: '0.7rem',
                height: '20px',
                '& .MuiChip-label': { px: 1 }
              }}
            />
          </Box>
        )}
      </Typography>
      
      <Box sx={{ height: 350, width: '100%' }}>
        <DataGridPro
          apiRef={apiRef}
          rows={rows}
          columns={columns}
          checkboxSelection
          disableRowSelectionOnClick
          slots={{ toolbar: GridToolbar }}
          slotProps={{
            toolbar: {
              showQuickFilter: true,
              quickFilterProps: { debounceMs: 500 },
            },
          }}
          sx={{
            '& .MuiDataGrid-root': {
              border: 'none',
            },
            '& .MuiDataGrid-cell': {
              borderBottom: '1px solid #f0f0f0',
            },
            '& .MuiDataGrid-columnHeaders': {
              backgroundColor: backgroundColor,
              borderBottom: `2px solid ${headerColor}`,
            },
            '& .MuiDataGrid-columnHeaderTitle': {
              fontWeight: 'bold',
              color: headerColor,
            },
          }}
        />
      </Box>
    </Box>
  );
};

export default DataGridSection;
