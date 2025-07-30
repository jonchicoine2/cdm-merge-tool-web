import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Box, Typography, Chip } from '@mui/material';
import { componentStyles } from '../../theme/designSystem';
import { DataGridPro, GridToolbar } from '@mui/x-data-grid-pro';
import { DataGridSectionProps } from './types';
import { createRowActionsColumn } from './RowActionsColumn';


const DataGridSection: React.FC<DataGridSectionProps> = ({
  title,
  rows,
  columns,
  gridType,
  fileMetadata,
  apiRef,
  headerColor = '#1976d2',
  backgroundColor = '#f8fbff',
  onRowUpdate,
  comparisonStats,
  // Row operations props
  onEditRow,
  onCreateNewFromRow,
  onDeleteRow,
  enableRowActions = false,
  // UI options
  hideHeader = false
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

  // Enhanced scroll management
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [hasScrollFocus, setHasScrollFocus] = useState(false);

  // Handle mouse enter - activate grid scroll
  const handleGridMouseEnter = () => {
    setHasScrollFocus(true);
    // Optional: Disable page scroll when grid has focus
    // document.body.style.overflow = 'hidden';
  };

  // Handle mouse leave - deactivate grid scroll
  const handleGridMouseLeave = () => {
    setHasScrollFocus(false);
    // Re-enable page scroll
    document.body.style.overflow = 'auto';
  };

  // Escape key override to release scroll focus
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && hasScrollFocus) {
        setHasScrollFocus(false);
        document.body.style.overflow = 'auto';
        // Remove focus from grid
        if (gridContainerRef.current) {
          gridContainerRef.current.blur();
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
      // Ensure page scroll is restored on unmount
      document.body.style.overflow = 'auto';
    };
  }, [hasScrollFocus]);

  // Create columns with actions column if enabled
  const displayColumns = useMemo(() => {
    if (!enableRowActions || !onEditRow || !onCreateNewFromRow || !onDeleteRow) {
      return columns;
    }

    const actionsColumn = createRowActionsColumn({
      gridType,
      onEditRow,
      onCreateNewFromRow,
      onDeleteRow
    });

    return [actionsColumn, ...columns];
  }, [columns, enableRowActions, gridType, onEditRow, onCreateNewFromRow, onDeleteRow]);

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
      {!hideHeader && (
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
      )}
      
      <Box
        ref={gridContainerRef}
        onMouseEnter={handleGridMouseEnter}
        onMouseLeave={handleGridMouseLeave}
        sx={{
          height: 450,
          width: '100%',
          // Visual indicator when grid has scroll focus
          border: hasScrollFocus ? componentStyles.dataGrid.focusBorder : '2px solid transparent',
          borderRadius: 1,
          transition: 'border-color 0.2s ease-in-out',
          // Subtle shadow when active
          boxShadow: hasScrollFocus ? componentStyles.dataGrid.focusShadow : 'none'
        }}
      >
        <DataGridPro
          apiRef={apiRef}
          rows={rows}
          columns={displayColumns}
          density="compact"
          disableColumnResize={false}
          showToolbar
          isCellEditable={() => false}
          onCellDoubleClick={(params) => {
            // Trigger edit dialog for any grid type when onEditRow is provided
            if (onEditRow) {
              onEditRow(params.row.id, gridType);
            }
          }}
          onRowClick={() => {
            // Row selection happens automatically, this is just for any additional logic
          }}
          slots={{ toolbar: GridToolbar }}
          slotProps={{
            root: {
              'data-testid': `${gridType}-grid`
            },
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
            // Hide cell focus outline - we want row selection only
            '& .MuiDataGrid-cell:focus': {
              outline: 'none',
            },
            '& .MuiDataGrid-cell:focus-within': {
              outline: 'none',
            },
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
