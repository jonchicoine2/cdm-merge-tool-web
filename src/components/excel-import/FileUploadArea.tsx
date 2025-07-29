import React, { useRef } from 'react';
import { Box, Typography, Button, Tabs, Tab } from '@mui/material';
import { FileUploadProps } from './types';

const FileUploadArea: React.FC<FileUploadProps> = ({
  fileType,
  rows,
  sheetNames,
  activeTab,
  dragOver,
  onFileUpload,
  onTabChange,
  onDragEnter,
  onDragLeave,
  onDrop
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file, fileType);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const icon = fileType === "Master" ? "📄" : "📋";
  const title = `${icon} ${fileType} ${fileType === "Master" ? "File" : "File"}`;

  return (
    <Box sx={{ 
      flex: 1,
      minWidth: 0,
      border: '2px solid #e0e0e0',
      borderRadius: '8px',
      padding: '16px',
      marginBottom: '24px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      transition: 'all 0.3s ease',
      background: 'white'
    }}>

      
      {rows.length === 0 ? (
        <Box
          sx={{
            border: `2px dashed ${dragOver ? '#1976d2' : '#ccc'}`,
            borderRadius: 2,
            p: 4,
            textAlign: 'center',
            backgroundColor: dragOver ? '#f0f8ff' : '#fafafa',
            transition: 'all 0.3s ease',
            cursor: 'pointer',
            '&:hover': {
              borderColor: '#1976d2',
              backgroundColor: '#f8fbff',
              transform: 'translateY(-2px)',
              boxShadow: '0 4px 12px rgba(25, 118, 210, 0.15)'
            }
          }}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDragOver={handleDragOver}
          onDrop={onDrop}
        >
          <Typography variant="h4" sx={{ 
            mb: 3, 
            color: '#1976d2', 
            fontWeight: 'bold',
            textAlign: 'center'
          }}>
            {title}
          </Typography>
          <Button variant="contained" component="label" sx={{ mb: 2 }}>
            Upload {fileType} File
            <input
              type="file"
              hidden
              onChange={handleFileInputChange}
              ref={fileInputRef}
              accept=".xlsx, .xls"
            />
          </Button>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Drag and drop your Excel file here or click to browse
          </Typography>
        </Box>
      ) : (
        <Box>
          <Typography variant="h5" sx={{ mb: 2, color: '#1976d2', fontWeight: 'bold' }}>
            {title}
          </Typography>
          {sheetNames.length > 1 && (
            <Tabs 
              value={activeTab} 
              onChange={(_, newValue) => onTabChange(newValue)}
              sx={{ mb: 2 }}
            >
              {sheetNames.map((sheetName, index) => (
                <Tab key={index} label={sheetName} />
              ))}
            </Tabs>
          )}
          <Typography variant="body2" sx={{ mb: 2 }}>
            {rows.length.toLocaleString()} records loaded
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default FileUploadArea;
