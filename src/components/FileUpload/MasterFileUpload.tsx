"use client";

import React, { useRef } from 'react';
import { Box, Button, Typography, Tabs, Tab } from '@mui/material';
import { FileMetadata, formatFileSize } from '../../utils/fileProcessing';

interface FileInfoCardProps {
  metadata: FileMetadata | null;
  isClient: boolean;
}

const FileInfoCard: React.FC<FileInfoCardProps> = ({ metadata, isClient }) => {
  if (!isClient || !metadata) return null;

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
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Box sx={{ 
          backgroundColor: '#1976d2', 
          color: 'white',
          fontSize: '0.75rem',
          padding: '2px 8px',
          borderRadius: '12px'
        }}>
          {formatFileSize(metadata.size)}
        </Box>
        <Box sx={{ 
          backgroundColor: '#4caf50', 
          color: 'white',
          fontSize: '0.75rem',
          padding: '2px 8px',
          borderRadius: '12px'
        }}>
          {metadata.sheetCount} sheet{metadata.sheetCount !== 1 ? 's' : ''}
        </Box>
        <Box sx={{ 
          backgroundColor: '#ff9800', 
          color: 'white',
          fontSize: '0.75rem',
          padding: '2px 8px',
          borderRadius: '12px'
        }}>
          {metadata.recordCount.toLocaleString()} records
        </Box>
      </Box>
      <Typography variant="caption" sx={{ 
        color: '#666',
        ml: 'auto'
      }}>
        {metadata.uploadTime.toLocaleTimeString()}
      </Typography>
    </Box>
  );
};

interface MasterFileUploadProps {
  fileMetadata: FileMetadata | null;
  sheetNames: string[];
  activeTab: number;
  dragOver: boolean;
  lastFileName: string | null;
  isClient: boolean;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onTabChange: (event: React.SyntheticEvent, newValue: number) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onClearData: () => void;
  onLoadSample: () => void;
  onRestoreData: () => void;
  chatWidth?: number;
}

export const MasterFileUpload: React.FC<MasterFileUploadProps> = ({
  fileMetadata,
  sheetNames,
  activeTab,
  dragOver,
  lastFileName,
  isClient,
  onFileUpload,
  onTabChange,
  onDragOver,
  onDragLeave,
  onDrop,
  onClearData,
  onLoadSample,
  onRestoreData,
  chatWidth = 0
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const containerWidth = chatWidth > 0 ? `calc(50% - ${chatWidth / 2}px)` : '50%';

  return (
    <Box sx={{ 
      width: containerWidth,
      transition: 'width 0.3s ease',
      pr: 1
    }}>
      {/* File info card */}
      <FileInfoCard metadata={fileMetadata} isClient={isClient} />

      {/* Upload area */}
      <Box
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        sx={{
          border: dragOver ? '3px dashed #2196f3' : '2px dashed #ccc',
          borderRadius: 2,
          p: 3,
          textAlign: 'center',
          backgroundColor: dragOver ? '#f0f8ff' : '#fafafa',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          mb: 2,
          '&:hover': {
            borderColor: '#2196f3',
            backgroundColor: '#f8fbff'
          }
        }}
        onClick={handleUploadClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={onFileUpload}
          style={{ display: 'none' }}
        />
        
        <Typography variant="h6" sx={{ mb: 1, color: '#666' }}>
          📊 Master Data
        </Typography>
        
        <Typography variant="body2" sx={{ color: '#888', mb: 2 }}>
          Drop Excel file here or click to browse
        </Typography>
        
        <Button 
          variant="outlined" 
          color="primary"
          onClick={(e) => {
            e.stopPropagation();
            handleUploadClick();
          }}
        >
          Choose Master File
        </Button>
      </Box>

      {/* Action buttons */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <Button 
          size="small" 
          variant="outlined" 
          onClick={onLoadSample}
          sx={{ fontSize: '0.75rem', padding: '4px 8px' }}
        >
          Load Sample
        </Button>
        
        {lastFileName && (
          <Button 
            size="small" 
            variant="outlined" 
            onClick={onRestoreData}
            sx={{ fontSize: '0.75rem', padding: '4px 8px' }}
          >
            Restore: {lastFileName}
          </Button>
        )}
        
        {fileMetadata && (
          <Button 
            size="small" 
            variant="outlined" 
            color="error"
            onClick={onClearData}
            sx={{ fontSize: '0.75rem', padding: '4px 8px' }}
          >
            Clear Data
          </Button>
        )}
      </Box>

      {/* Sheet tabs */}
      {sheetNames.length > 1 && (
        <Box sx={{ mb: 2 }}>
          <Tabs 
            value={activeTab} 
            onChange={onTabChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              '& .MuiTab-root': {
                minWidth: 'auto',
                padding: '6px 12px',
                fontSize: '0.75rem',
              },
              '& .MuiTabs-scrollButtons': {
                width: '24px',
              }
            }}
          >
            {sheetNames.map((sheetName, index) => (
              <Tab 
                key={index} 
                label={sheetName}
                sx={{
                  textTransform: 'none',
                  fontWeight: activeTab === index ? 'bold' : 'normal'
                }}
              />
            ))}
          </Tabs>
        </Box>
      )}
    </Box>
  );
};