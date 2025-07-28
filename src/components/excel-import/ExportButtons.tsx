import React from 'react';
import { Box, Button } from '@mui/material';
import { ExportButtonsProps } from './types';

const ExportButtons: React.FC<ExportButtonsProps> = ({
  mergedRows,
  onExport
}) => {
  return (
    <Box sx={{
      display: 'flex',
      justifyContent: 'center',
      mb: 3
    }}>
      <Button
        variant="contained"
        onClick={onExport}
        disabled={mergedRows.length === 0}
        sx={{
          background: 'linear-gradient(45deg, #4caf50 30%, #66bb6a 90%)',
          color: 'white',
          fontWeight: 'bold',
          px: 3,
          py: 1
        }}
      >
        📁 Export Merged Data
      </Button>
    </Box>
  );
};

export default ExportButtons;
