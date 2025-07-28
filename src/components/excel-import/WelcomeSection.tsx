import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { WelcomeSectionProps } from './types';

const WelcomeSection: React.FC<WelcomeSectionProps> = ({ onLoadSampleData }) => {
  return (
    <>
      <Typography variant="h3" gutterBottom sx={{ 
        color: '#1976d2', 
        fontWeight: 'bold', 
        textAlign: 'center',
        mb: 4,
        textShadow: '0 2px 4px rgba(25, 118, 210, 0.2)',
        background: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text'
      }}> 
       🔧 VIC CDM MERGE TOOL
      </Typography>
      
      {/* Welcome Message */}
      <Box sx={{ 
        textAlign: 'center', 
        mb: 4, 
        p: 3,
        backgroundColor: 'rgba(25, 118, 210, 0.05)',
        borderRadius: 2,
        border: '1px solid rgba(25, 118, 210, 0.2)'
      }}>
        <Typography variant="h6" sx={{ color: '#1976d2', mb: 1 }}>
          Welcome to the Clean CDM Merge Tool
        </Typography>
        <Typography variant="body1" sx={{ color: '#666', mb: 3 }}>
          Upload your Master and Client Excel files to compare, merge, and analyze healthcare data with HCPCS code matching.
        </Typography>
        
        {/* Load Sample Data Button */}
        <Button
          variant="contained"
          onClick={onLoadSampleData}
          sx={{
            fontWeight: 'bold',
            fontSize: '1.1rem',
            px: 4,
            py: 1.5,
            background: 'linear-gradient(45deg, #ff9800 30%, #ffb74d 90%)',
            boxShadow: '0 3px 5px 2px rgba(255, 152, 0, .3)',
            '&:hover': { 
              background: 'linear-gradient(45deg, #f57c00 30%, #ff9800 90%)',
              transform: 'translateY(-1px)',
              boxShadow: '0 4px 8px 2px rgba(255, 152, 0, .4)'
            },
            transition: 'all 0.3s ease'
          }}
        >
          📂 Load Sample Data
        </Button>
        <Typography variant="caption" sx={{ display: 'block', mt: 1, color: '#888' }}>
          Try the tool with sample Master and Client Excel files
        </Typography>
      </Box>
    </>
  );
};

export default WelcomeSection;
