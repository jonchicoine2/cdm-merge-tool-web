import React, { useState } from 'react';
import { Box, Typography, Button, ButtonGroup, IconButton, Collapse, Tooltip, CircularProgress, Menu, MenuItem, ListItemText } from '@mui/material';
import { ExpandMore as ExpandMoreIcon, ExpandLess as ExpandLessIcon, ArrowDropDown as ArrowDropDownIcon } from '@mui/icons-material';
import { useGridApiRef } from '@mui/x-data-grid-pro';
import { ComparisonResultsProps, ExportMode } from './types';
import { colorPalette, statusColors } from '../../theme/designSystem';
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
  onCreateNewFromRow,
  onDeleteRow
}) => {
  const mergedApiRef = useGridApiRef();
  const [mergedDataExpanded, setMergedDataExpanded] = useState(true);
  const [exportMenuAnchor, setExportMenuAnchor] = useState<null | HTMLElement>(null);

  const exportOptions: { mode: ExportMode; label: string; description: string }[] = [
    { mode: 'all', label: 'All Worksheets', description: 'SourceMaster + Errors + Empty + Dups' },
    { mode: 'successesAndMaster', label: 'Successes and Master', description: 'Single sheet with all merged rows' },
    { mode: 'successesOnly', label: 'Successes Without Masters', description: 'Only rows with CDM/PhysicianCDM data' },
  ];

  const handleExportClick = () => {
    onExport('all');
  };

  const handleExportMenuSelect = (mode: ExportMode) => {
    setExportMenuAnchor(null);
    onExport(mode);
  };

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
          color: colorPalette.primary.main,
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          🔄 Comparison Results
        </Typography>

        <ButtonGroup
          variant="contained"
          size="small"
          disabled={mergedRows.length === 0 || isExporting}
          sx={{
            '& .MuiButton-root': {
              background: 'linear-gradient(45deg, #4caf50 30%, #66bb6a 90%)',
              color: 'white',
              fontWeight: 'bold',
              fontSize: '0.8rem',
              '&:disabled': {
                background: '#c8e6c9'
              }
            }
          }}
        >
          <Tooltip title="Export All Worksheets (Ctrl+E)" arrow>
            <span>
              <Button
                onClick={handleExportClick}
                disabled={mergedRows.length === 0 || isExporting}
                startIcon={isExporting ? <CircularProgress size={16} color="inherit" /> : undefined}
                sx={{ px: 2, py: 0.5 }}
              >
                {isExporting ? 'Exporting...' : 'Export'}
              </Button>
            </span>
          </Tooltip>
          <Button
            size="small"
            onClick={(e) => setExportMenuAnchor(e.currentTarget)}
            disabled={mergedRows.length === 0 || isExporting}
            sx={{ px: 0.5, minWidth: 'auto' }}
          >
            <ArrowDropDownIcon />
          </Button>
        </ButtonGroup>
        <Menu
          anchorEl={exportMenuAnchor}
          open={Boolean(exportMenuAnchor)}
          onClose={() => setExportMenuAnchor(null)}
        >
          {exportOptions.map(opt => (
            <MenuItem key={opt.mode} onClick={() => handleExportMenuSelect(opt.mode)}>
              <ListItemText primary={opt.label} secondary={opt.description} />
            </MenuItem>
          ))}
        </Menu>
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
            backgroundColor: statusColors.matched.light,
            borderRadius: 1,
            border: `1px solid ${statusColors.matched.main}`
          }}>
            <Typography variant="h6" sx={{
              color: statusColors.matched.main,
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
                    backgroundColor: statusColors.matched.main,
                    color: statusColors.matched.contrastText,
                    px: 1,
                    py: 0.25,
                    borderRadius: 1,
                    fontSize: '0.75rem',
                    fontWeight: 'bold'
                  }}>
                    {comparisonStats.matchedRecords} matched
                  </Box>
                  <Box sx={{
                    backgroundColor: statusColors.unmatched.main,
                    color: statusColors.unmatched.contrastText,
                    px: 1,
                    py: 0.25,
                    borderRadius: 1,
                    fontSize: '0.75rem',
                    fontWeight: 'bold'
                  }}>
                    {comparisonStats.unmatchedRecords} unmatched
                  </Box>
                  <Box sx={{
                    backgroundColor: statusColors.duplicates.main,
                    color: statusColors.duplicates.contrastText,
                    px: 1,
                    py: 0.25,
                    borderRadius: 1,
                    fontSize: '0.75rem',
                    fontWeight: 'bold'
                  }}>
                    {comparisonStats.duplicateRecords} duplicates
                  </Box>
                  <Box sx={{
                    backgroundColor: statusColors.processing.main,
                    color: statusColors.processing.contrastText,
                    px: 1,
                    py: 0.25,
                    borderRadius: 1,
                    fontSize: '0.75rem',
                    fontWeight: 'bold'
                  }}>
                    {comparisonStats.matchRate}% match rate
                  </Box>
                  <Box sx={{
                    backgroundColor: statusColors.neutral.main,
                    color: statusColors.neutral.contrastText,
                    px: 1,
                    py: 0.25,
                    borderRadius: 1,
                    fontSize: '0.75rem',
                    fontWeight: 'bold'
                  }}>
                    {comparisonStats.columnsMatched} columns mapped
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
              onCreateNewFromRow={onCreateNewFromRow}
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
              headerColor={statusColors.unmatched.main}
              backgroundColor={statusColors.unmatched.light}
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
                color: statusColors.unmatched.main,
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
              headerColor={statusColors.duplicates.main}
              backgroundColor={statusColors.duplicates.light}
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
                color: statusColors.duplicates.main,
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
