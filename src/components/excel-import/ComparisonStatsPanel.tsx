import React from 'react';
import { Box, Typography, Chip } from '@mui/material';
import { ComparisonStatsPanelProps } from './types';
import { statusColors } from '../../theme/designSystem';

const ComparisonStatsPanel: React.FC<ComparisonStatsPanelProps> = ({ stats }) => {
  if (!stats) return null;

  return (
    <Box sx={{
      mb: 2,
      p: 2,
      backgroundColor: statusColors.processing.light,
      border: `2px solid ${statusColors.matched.main}`,
      borderRadius: 1,
      display: 'flex',
      alignItems: 'center',
      gap: 3,
      flexWrap: 'wrap'
    }}>
      <Typography variant="body2" sx={{ fontWeight: 'bold', color: statusColors.matched.main }}>
        📊 Results:
      </Typography>
      
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <Chip size="small" label={`${stats.matchedRecords.toLocaleString()} matched`} 
              sx={{ backgroundColor: '#4caf50', color: 'white', fontSize: '0.75rem' }} />
        <Chip size="small" label={`${stats.unmatchedRecords.toLocaleString()} unmatched`} 
              sx={{ backgroundColor: '#f44336', color: 'white', fontSize: '0.75rem' }} />
        <Chip size="small" label={`${stats.duplicateRecords.toLocaleString()} duplicates`} 
              sx={{ backgroundColor: '#ff9800', color: 'white', fontSize: '0.75rem' }} />
        <Chip size="small" label={`${stats.matchRate}% match rate`} 
              sx={{ backgroundColor: '#2196f3', color: 'white', fontSize: '0.75rem' }} />
        <Chip size="small" label={`${stats.columnsMatched} columns mapped`} 
              sx={{ backgroundColor: '#9c27b0', color: 'white', fontSize: '0.75rem' }} />
      </Box>
      
      <Typography variant="caption" sx={{ color: '#666', ml: 'auto' }}>
        {stats.processingTime}ms
      </Typography>
    </Box>
  );
};

export default ComparisonStatsPanel;
