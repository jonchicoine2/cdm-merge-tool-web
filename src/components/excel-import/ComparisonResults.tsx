import React, { useState } from 'react';
import { Box, Typography, Button, IconButton, Collapse, Tooltip, CircularProgress } from '@mui/material';
import { ExpandMore as ExpandMoreIcon, ExpandLess as ExpandLessIcon } from '@mui/icons-material';
import { useGridApiRef } from '@mui/x-data-grid-pro';
import { ComparisonResultsProps } from './types';
import DataGridSection from './DataGridSection';

const ComparisonResults: React.FC<ComparisonResultsProps> = ({
  mergedRows,
  mergedColumns,
  unmatchedClient,
  dupsClient,
  columnsClient,
  comparisonStats,
  onExport,
  isExporting = false,
  enableRowActions,
  onEditRow,
  onDuplicateRow,
  onDeleteRow
}) => {
  const mergedApiRef = useGridApiRef();
  const [mergedDataExpanded, setMergedDataExpanded] = useState(true);

  return (
    <Box sx={{ mb: 2 }}>
      {/* Compact Header with Export Button */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        mb: 1.5,
        flexWrap: 'wrap',
        gap: 2
      }}>
        <Typography variant="h6" sx={{
          color: '#1976d2',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          🔄 Comparison Results
        </Typography>

        <Tooltip title="Export Merged Data (Ctrl+E)" arrow>
          <span>
            <Button
              variant="contained"
              onClick={onExport}
              disabled={mergedRows.length === 0 || isExporting}
              size="small"
              sx={{
                background: 'linear-gradient(45deg, #4caf50 30%, #66bb6a 90%)',
                color: 'white',
                fontWeight: 'bold',
                fontSize: '0.8rem',
                px: 2,
                py: 0.5,
                '&:disabled': {
                  background: '#c8e6c9'
                }
              }}
              startIcon={isExporting ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {isExporting ? 'Exporting...' : '📁 Export Merged Data'}
            </Button>
          </span>
        </Tooltip>
      </Box>

      {/* Merged Data Grid - Collapsible */}
      {mergedRows.length > 0 && (
        <Box sx={{ mb: 2 }}>
          {/* Custom Header with Collapse Toggle */}
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            mb: 1,
            p: 1,
            backgroundColor: '#e8f5e8',
            borderRadius: 1,
            border: '1px solid #c8e6c9'
          }}>
            <Typography variant="h6" sx={{
              color: '#2e7d32',
              fontWeight: 'bold',
              flexGrow: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}>
              ✅ Merged Data
              {comparisonStats && (
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  <Box sx={{
                    backgroundColor: '#4caf50',
                    color: 'white',
                    px: 1,
                    py: 0.25,
                    borderRadius: 1,
                    fontSize: '0.75rem',
                    fontWeight: 'bold'
                  }}>
                    {comparisonStats.matched} matched
                  </Box>
                  <Box sx={{
                    backgroundColor: '#ff9800',
                    color: 'white',
                    px: 1,
                    py: 0.25,
                    borderRadius: 1,
                    fontSize: '0.75rem',
                    fontWeight: 'bold'
                  }}>
                    {comparisonStats.unmatched} unmatched
                  </Box>
                  <Box sx={{
                    backgroundColor: '#f44336',
                    color: 'white',
                    px: 1,
                    py: 0.25,
                    borderRadius: 1,
                    fontSize: '0.75rem',
                    fontWeight: 'bold'
                  }}>
                    {comparisonStats.duplicates} duplicates
                  </Box>
                  <Box sx={{
                    backgroundColor: '#2196f3',
                    color: 'white',
                    px: 1,
                    py: 0.25,
                    borderRadius: 1,
                    fontSize: '0.75rem',
                    fontWeight: 'bold'
                  }}>
                    {comparisonStats.matchRate}% match rate
                  </Box>
                  <Box sx={{
                    backgroundColor: '#9c27b0',
                    color: 'white',
                    px: 1,
                    py: 0.25,
                    borderRadius: 1,
                    fontSize: '0.75rem',
                    fontWeight: 'bold'
                  }}>
                    {comparisonStats.columnsMapped} columns mapped
                  </Box>
                </Box>
              )}
            </Typography>
            <IconButton
              onClick={() => setMergedDataExpanded(!mergedDataExpanded)}
              size="small"
              sx={{
                color: '#2e7d32',
                '&:hover': {
                  backgroundColor: 'rgba(46, 125, 50, 0.04)'
                }
              }}
            >
              {mergedDataExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>

          {/* Collapsible Grid Content */}
          <Collapse in={mergedDataExpanded}>
            <DataGridSection
              title="" // Empty title since we have custom header above
              rows={mergedRows}
              columns={mergedColumns}
              gridType="merged"
              apiRef={mergedApiRef}
              headerColor="#2e7d32"
              backgroundColor="#e8f5e8"
              enableRowActions={enableRowActions}
              onEditRow={onEditRow}
              onDuplicateRow={onDuplicateRow}
              onDeleteRow={onDeleteRow}
              hideHeader={true} // Add this prop to hide the default header
            />
          </Collapse>
        </Box>
      )}
      
      {/* Unmatched and Duplicates - Always show both sections side-by-side */}
      <Box sx={{
        display: 'flex',
        flexDirection: { xs: 'column', lg: 'row' },
        gap: 2,
        width: '100%'
      }}>
        {/* Unmatched Records */}
        <Box sx={{
          flex: '1 1 50%',
          minWidth: 0,
          width: { xs: '100%', lg: '50%' }
        }}>
          {unmatchedClient.length > 0 ? (
            <DataGridSection
              title="❌ Unmatched Records"
              rows={unmatchedClient}
              columns={columnsClient}
              gridType="client"
              headerColor="#d32f2f"
              backgroundColor="#ffebee"
            />
          ) : (
            <Box sx={{
              minHeight: 400,
              border: '2px solid #e0e0e0',
              borderRadius: '8px',
              padding: '16px',
              background: 'white',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              display: 'flex',
              flexDirection: 'column',
              width: '100%'
            }}>
              <Typography variant="h6" sx={{
                mb: 2,
                color: '#d32f2f',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}>
                ❌ Unmatched Records (0 records)
              </Typography>
              <Box sx={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Typography variant="body1" color="text.secondary">
                  No unmatched records found.
                </Typography>
              </Box>
            </Box>
          )}
        </Box>

        {/* Duplicate Records */}
        <Box sx={{
          flex: '1 1 50%',
          minWidth: 0,
          width: { xs: '100%', lg: '50%' }
        }}>
          {dupsClient.length > 0 ? (
            <DataGridSection
              title="⚠️ Duplicate Records"
              rows={dupsClient}
              columns={columnsClient}
              gridType="client"
              headerColor="#f57c00"
              backgroundColor="#fff3e0"
            />
          ) : (
            <Box sx={{
              minHeight: 400,
              border: '2px solid #e0e0e0',
              borderRadius: '8px',
              padding: '16px',
              background: 'white',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              display: 'flex',
              flexDirection: 'column',
              width: '100%'
            }}>
              <Typography variant="h6" sx={{
                mb: 2,
                color: '#f57c00',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}>
                ⚠️ Duplicate Records (0 records)
              </Typography>
              <Box sx={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Typography variant="body1" color="text.secondary">
                  No duplicate records found.
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default ComparisonResults;
