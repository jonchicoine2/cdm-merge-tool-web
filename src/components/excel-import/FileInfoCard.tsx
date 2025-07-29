import React from 'react';
import { Box, Typography, Chip } from '@mui/material';
import { FileInfoCardProps } from './types';

const FileInfoCard: React.FC<FileInfoCardProps> = ({ metadata }) => {
  if (!metadata) return null;

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Box sx={{ 
      mb: 1, 
      p: 1.5,
      backgroundColor: '#f8fbff', 
      border: '2px solid #2196f3',
      borderRadius: 1,
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      flexWrap: 'wrap'
    }}>
      <Typography variant="body2" sx={{ 
        fontWeight: 'bold', 
        color: '#1976d2',
        minWidth: '120px'
      }}>
        📄 {metadata.name}
      </Typography>
      <Chip 
        size="small" 
        label={formatFileSize(metadata.size)} 
        sx={{ 
          backgroundColor: '#1976d2', 
          color: 'white',
          fontSize: '0.75rem',
          height: '24px'
        }}
      />
      <Chip 
        size="small" 
        label={`${metadata.sheetCount} sheet${metadata.sheetCount !== 1 ? 's' : ''}`}
        sx={{ 
          backgroundColor: '#4caf50', 
          color: 'white',
          fontSize: '0.75rem',
          height: '24px'
        }}
      />
      <Chip 
        size="small" 
        label={`${metadata.recordCount.toLocaleString()} records`}
        sx={{ 
          backgroundColor: '#ff9800', 
          color: 'white',
          fontSize: '0.75rem',
          height: '24px'
        }}
      />
      <Typography variant="caption" sx={{ 
        color: '#666',
        ml: 'auto'
      }}>
        {metadata.uploadTime.toLocaleTimeString()}
      </Typography>
    </Box>
  );
};

export default FileInfoCard;
