import React, { useState, useRef } from 'react';
import { Box, Typography, Chip } from '@mui/material';
import { DataGridPro, GridToolbar } from '@mui/x-data-grid-pro';
import { DataGridSectionProps } from './types';

const DataGridSection: React.FC<DataGridSectionProps> = ({
  title,
  rows,
  columns,
  fileMetadata,
  apiRef,
  headerColor = '#1976d2',
  backgroundColor = '#f8fbff',
  onRowUpdate,
  comparisonStats
}) => {
  // State for hover-based activation
  const [isGridActive, setIsGridActive] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Only hide if both rows and columns are empty (no file loaded)
  if (rows.length === 0 && columns.length === 0) return null;

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Hover handlers for grid activation
  const handleMouseEnter = () => {
    // Clear any existing timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }

    // Set a delay before activating the grid
    hoverTimeoutRef.current = setTimeout(() => {
      setIsGridActive(true);
    }, 500); // 500ms delay
  };

  const handleMouseLeave = () => {
    // Clear the timeout if user leaves before activation
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }

    // Deactivate the grid
    setIsGridActive(false);
  };

  return (
    <Box
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      sx={{
        flex: 1,
        minHeight: 400,
        border: isGridActive ? '2px solid #1976d2' : '2px solid #e0e0e0',
        borderRadius: '8px',
        padding: '16px',
        background: 'white',
        boxShadow: isGridActive
          ? '0 4px 12px rgba(25, 118, 210, 0.15)'
          : '0 2px 4px rgba(0,0,0,0.1)',
        transition: 'all 0.2s ease',
        cursor: isGridActive ? 'default' : 'default'
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
        {title}
        {comparisonStats ? (
          // Show comparison stats chips for merged data
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            ml: 1
          }}>
            <Chip size="small" label={`${comparisonStats.matchedRecords.toLocaleString()} matched`}
                  sx={{ backgroundColor: '#4caf50', color: 'white', fontSize: '0.75rem' }} />
            <Chip size="small" label={`${comparisonStats.unmatchedRecords.toLocaleString()} unmatched`}
                  sx={{ backgroundColor: '#f44336', color: 'white', fontSize: '0.75rem' }} />
            <Chip size="small" label={`${comparisonStats.duplicateRecords.toLocaleString()} duplicates`}
                  sx={{ backgroundColor: '#ff9800', color: 'white', fontSize: '0.75rem' }} />
            <Chip size="small" label={`${comparisonStats.matchRate}% match rate`}
                  sx={{ backgroundColor: '#2196f3', color: 'white', fontSize: '0.75rem' }} />
            <Chip size="small" label={`${comparisonStats.columnsMatched} columns mapped`}
                  sx={{ backgroundColor: '#9c27b0', color: 'white', fontSize: '0.75rem' }} />
          </Box>
        ) : (
          // Show file metadata for other grids (no record count)
          fileMetadata && (
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
            </Box>
          )
        )}
      </Typography>
      
      <Box sx={{ height: 450, width: '100%' }}>
        <DataGridPro
          apiRef={apiRef}
          rows={rows}
          columns={columns}
          checkboxSelection
          disableRowSelectionOnClick
          editMode="row"
          density="compact"
          slots={{ toolbar: GridToolbar }}
          slotProps={{
            toolbar: {
              showQuickFilter: true,
              quickFilterProps: { debounceMs: 500 },
            },
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
              }
            });

            // Call the onRowUpdate callback if provided
            if (onRowUpdate) {
              onRowUpdate(validatedRow);
            }

            return validatedRow;
          }}
          onProcessRowUpdateError={(error: unknown) => {
            console.error('Row update error:', error);
          }}
          sx={{
            // Hover-based scroll control - completely disable interaction until active
            pointerEvents: isGridActive ? 'auto' : 'none',
            '& .MuiDataGrid-virtualScroller': {
              pointerEvents: isGridActive ? 'auto' : 'none',
            },
            '& .MuiDataGrid-scrollArea': {
              pointerEvents: isGridActive ? 'auto' : 'none',
            },
            '& .MuiDataGrid-scrollArea--left': {
              pointerEvents: isGridActive ? 'auto' : 'none',
            },
            '& .MuiDataGrid-scrollArea--right': {
              pointerEvents: isGridActive ? 'auto' : 'none',
            },
            '& .MuiDataGrid-main': {
              pointerEvents: isGridActive ? 'auto' : 'none',
            },
            '& .MuiDataGrid-viewport': {
              pointerEvents: isGridActive ? 'auto' : 'none',
            },
            '& .MuiDataGrid-window': {
              pointerEvents: isGridActive ? 'auto' : 'none',
            },
            // Only allow essential interactions when inactive
            '& .MuiDataGrid-cell': {
              borderBottom: '1px solid #f0f0f0',
              pointerEvents: isGridActive ? 'auto' : 'none',
            },
            '& .MuiDataGrid-row': {
              pointerEvents: isGridActive ? 'auto' : 'none',
            },
            '& .MuiCheckbox-root': {
              pointerEvents: isGridActive ? 'auto' : 'none', // Only when active
            },
            '& .MuiDataGrid-columnHeaders': {
              backgroundColor: backgroundColor,
              borderBottom: `2px solid ${headerColor}`,
              pointerEvents: isGridActive ? 'auto' : 'none', // Only when active
            },
            '& .MuiDataGrid-columnHeaderTitle': {
              fontWeight: 'bold',
              color: headerColor,
            },
            '& .MuiDataGrid-root': {
              border: 'none',
            },
            // Visual feedback for active state
            opacity: isGridActive ? 1 : 0.95,
            transition: 'opacity 0.2s ease',
          }}
        />
      </Box>
    </Box>
  );
};

export default DataGridSection;
