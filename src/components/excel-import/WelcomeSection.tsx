import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { WelcomeSectionProps } from './types';

const WelcomeSection: React.FC<WelcomeSectionProps> = ({ onLoadSampleData }) => {
  return (
    <Box sx={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      mb: 2,
      p: 1,
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
      borderRadius: 1,
      border: '1px solid #e0e0e0'
    }}>
      <Typography variant="h6" sx={{
        color: '#1976d2',
        fontWeight: 'bold',
        m: 0
      }}>
        🔧 VIC CDM MERGE TOOL
      </Typography>

      <Button
        variant="contained"
        onClick={onLoadSampleData}
        size="small"
        sx={{
          background: '#ff9800',
          '&:hover': {
            background: '#f57c00'
          }
        }}
      >
        📂 Load Sample Data
      </Button>
    </Box>
  );
};

export default WelcomeSection;
