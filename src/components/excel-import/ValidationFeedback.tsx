import React from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Chip,
  Collapse,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
  LinearProgress
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { ValidationResult } from '../../utils/fileValidation';

interface ValidationFeedbackProps {
  validationResult?: ValidationResult;
  isValidating?: boolean;
  fileType: 'master' | 'client';
  onRetry?: () => void;
}

export const ValidationFeedback: React.FC<ValidationFeedbackProps> = ({
  validationResult,
  isValidating = false,
  fileType
}) => {
  const [expanded, setExpanded] = React.useState(false);

  // Show loading state
  if (isValidating) {
    return (
      <Box sx={{ mb: 2 }}>
        <Alert severity="info" icon={<InfoIcon />}>
          <AlertTitle>Validating {fileType} file...</AlertTitle>
          <LinearProgress sx={{ mt: 1 }} />
          <Typography variant="body2" sx={{ mt: 1 }}>
            Checking file format, size, and content structure...
          </Typography>
        </Alert>
      </Box>
    );
  }

  // No validation result yet
  if (!validationResult) {
    return null;
  }

  // Determine alert severity and icon
  const getSeverityAndIcon = () => {
    if (!validationResult.isValid) {
      return { severity: 'error' as const, icon: <ErrorIcon /> };
    }
    if (validationResult.warnings.length > 0) {
      return { severity: 'warning' as const, icon: <WarningIcon /> };
    }
    return { severity: 'success' as const, icon: <CheckCircleIcon /> };
  };

  const { severity, icon } = getSeverityAndIcon();

  // Format file info for display
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getTitle = () => {
    if (!validationResult.isValid) {
      return `${fileType.charAt(0).toUpperCase() + fileType.slice(1)} file validation failed`;
    }
    if (validationResult.warnings.length > 0) {
      return `${fileType.charAt(0).toUpperCase() + fileType.slice(1)} file validated with warnings`;
    }
    return `${fileType.charAt(0).toUpperCase() + fileType.slice(1)} file validated successfully`;
  };

  return (
    <Box sx={{ mb: 2 }}>
      <Alert 
        severity={severity} 
        icon={icon}
        action={
          (validationResult.errors.length > 0 || validationResult.warnings.length > 0) && (
            <IconButton
              aria-label="expand"
              size="small"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          )
        }
      >
        <AlertTitle>{getTitle()}</AlertTitle>
        
        {/* File info summary */}
        {validationResult.fileInfo && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1, mb: 1 }}>
            <Chip 
              size="small" 
              label={`${formatFileSize(validationResult.fileInfo.size)}`}
              variant="outlined"
            />
            <Chip 
              size="small" 
              label={`${validationResult.fileInfo.totalRows.toLocaleString()} rows`}
              variant="outlined"
            />
            <Chip 
              size="small" 
              label={`${validationResult.fileInfo.sheets.length} sheet${validationResult.fileInfo.sheets.length !== 1 ? 's' : ''}`}
              variant="outlined"
            />
          </Box>
        )}

        {/* Quick summary */}
        {validationResult.isValid && validationResult.warnings.length === 0 && (
          <Typography variant="body2">
            File is ready for processing.
          </Typography>
        )}

        {/* Expandable details */}
        <Collapse in={expanded}>
          <Box sx={{ mt: 2 }}>
            {/* Errors */}
            {validationResult.errors.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="error" gutterBottom>
                  Issues that must be fixed:
                </Typography>
                <List dense>
                  {validationResult.errors.map((error, index) => (
                    <ListItem key={index} sx={{ py: 0.5 }}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <ErrorIcon color="error" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText 
                        primary={error}
                        primaryTypographyProps={{ variant: 'body2' }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}

            {/* Warnings */}
            {validationResult.warnings.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="warning.main" gutterBottom>
                  Warnings (file can still be processed):
                </Typography>
                <List dense>
                  {validationResult.warnings.map((warning, index) => (
                    <ListItem key={index} sx={{ py: 0.5 }}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <WarningIcon color="warning" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText 
                        primary={warning}
                        primaryTypographyProps={{ variant: 'body2' }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}

            {/* File details */}
            {validationResult.fileInfo && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  File Details:
                </Typography>
                <Typography variant="body2" component="div">
                  • Size: {formatFileSize(validationResult.fileInfo.size)}<br/>
                  • Type: {validationResult.fileInfo.type || 'Unknown'}<br/>
                  • Sheets: {validationResult.fileInfo.sheets.join(', ')}<br/>
                  • Total Rows: {validationResult.fileInfo.totalRows.toLocaleString()}<br/>
                  • Total Columns: {validationResult.fileInfo.totalColumns}
                </Typography>
              </Box>
            )}
          </Box>
        </Collapse>
      </Alert>
    </Box>
  );
};

export default ValidationFeedback;
