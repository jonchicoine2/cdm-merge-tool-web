import React from 'react';
import { Box, Typography } from '@mui/material';
import { useGridApiRef } from '@mui/x-data-grid-pro';
import { ComparisonResultsProps } from './types';
import ExportButtons from './ExportButtons';
import DataGridSection from './DataGridSection';

const ComparisonResults: React.FC<ComparisonResultsProps> = ({
  mergedRows,
  mergedColumns,
  unmatchedClient,
  dupsClient,
  columnsClient,
  comparisonStats,
  onExport
}) => {
  const mergedApiRef = useGridApiRef();

  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h4" sx={{ 
        mb: 3, 
        color: '#1976d2', 
        fontWeight: 'bold',
        textAlign: 'center'
      }}>
        🔄 Comparison Results
      </Typography>
      
      {/* Export Button */}
      <ExportButtons
        mergedRows={mergedRows}
        onExport={onExport}
      />

      {/* Merged Data Grid */}
      {mergedRows.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <DataGridSection
            title="✅ Merged Data"
            rows={mergedRows}
            columns={mergedColumns}
            gridType="merged"
            apiRef={mergedApiRef}
            headerColor="#2e7d32"
            backgroundColor="#e8f5e8"
            comparisonStats={comparisonStats}
          />
        </Box>
      )}
      
      {/* Unmatched and Duplicates - Always show both sections side-by-side */}
      <Box sx={{
        display: 'flex',
        flexDirection: { xs: 'column', lg: 'row' },
        gap: 3,
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
