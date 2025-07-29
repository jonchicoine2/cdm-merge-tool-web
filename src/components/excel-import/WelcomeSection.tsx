import React from 'react';
import { Box, Typography, Button, Tooltip, CircularProgress } from '@mui/material';
import { WelcomeSectionProps } from './types';

const WelcomeSection: React.FC<WelcomeSectionProps> = ({ onLoadSampleData, isLoading = false }) => {
  return (
    <Box sx={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      mb: 1,
      p: 0.5,
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
      borderRadius: 1,
      border: '1px solid #e0e0e0',
      minHeight: '40px'
    }}>
      <Typography variant="subtitle1" sx={{
        color: '#1976d2',
        fontWeight: 'bold',
        m: 0,
        fontSize: '1rem'
      }}>
        🔧 VIC CDM MERGE TOOL
      </Typography>

      <Tooltip title="Load Sample Data (Ctrl+L)" arrow>
        <Button
          variant="contained"
          onClick={onLoadSampleData}
          disabled={isLoading}
          size="small"
          sx={{
            background: '#ff9800',
            fontSize: '0.75rem',
            py: 0.25,
            px: 1,
            '&:hover': {
              background: '#f57c00'
            },
            '&:disabled': {
              background: '#ffcc80'
            }
          }}
          startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {isLoading ? 'Loading...' : '📂 Load Sample Data'}
        </Button>
      </Tooltip>
    </Box>
  );
};

export default WelcomeSection;
