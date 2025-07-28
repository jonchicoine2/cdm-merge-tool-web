import React from 'react';
import { Box, Typography } from '@mui/material';
import { useGridApiRef } from '@mui/x-data-grid-pro';
import { ComparisonResultsProps } from './types';
import ComparisonStatsPanel from './ComparisonStatsPanel';
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
      
      {/* Comparison Statistics */}
      <ComparisonStatsPanel stats={comparisonStats} />
      
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
          />
        </Box>
      )}
      
      {/* Unmatched and Duplicates */}
      {(unmatchedClient.length > 0 || dupsClient.length > 0) && (
        <Box sx={{ 
          display: 'flex', 
          flexDirection: { xs: 'column', lg: 'row' },
          gap: 3
        }}>
          {/* Unmatched Records */}
          {unmatchedClient.length > 0 && (
            <Box sx={{ flex: 1 }}>
              <DataGridSection
                title="❌ Unmatched Records"
                rows={unmatchedClient}
                columns={columnsClient}
                gridType="client"
                headerColor="#d32f2f"
                backgroundColor="#ffebee"
              />
            </Box>
          )}
          
          {/* Duplicate Records */}
          {dupsClient.length > 0 && (
            <Box sx={{ flex: 1 }}>
              <DataGridSection
                title="⚠️ Duplicate Records"
                rows={dupsClient}
                columns={columnsClient}
                gridType="client"
                headerColor="#f57c00"
                backgroundColor="#fff3e0"
              />
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

export default ComparisonResults;
