"use client";

import React from "react";
import { Box, Typography, Chip } from "@mui/material";

interface FileMetadata {
  name: string;
  size: number;
  uploadTime: Date;
  sheetCount: number;
  recordCount: number;
  columnCount: number;
}

// Helper function to format file size
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// File information card component with consistent theming
export const FileInfoCard = ({ metadata, type, isClient }: { metadata: FileMetadata | null, type: 'Master' | 'Client', isClient: boolean }) => {
  console.log(`[DEBUG] FileInfoCard render - ${type}:`, metadata, 'isClient:', isClient);
  
  if (!isClient) {
    console.log(`[DEBUG] Not client-side yet, not rendering ${type} card`);
    return null;
  }
  
  if (!metadata) {
    console.log(`[DEBUG] No metadata for ${type}, not rendering card`);
    return null;
  }
  
  console.log(`[DEBUG] Rendering ${type} FileInfoCard with metadata:`, metadata);
  
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