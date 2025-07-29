import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  Button,
  TextField,
  Box,
  Typography,
  Grid,
  Paper,
  Chip,
  Divider,
  IconButton,
  Fade,
  Alert
} from '@mui/material';
import {
  Close as CloseIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  ContentCopy as ContentCopyIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { GridColDef } from '@mui/x-data-grid-pro';
import { ExcelRow } from '../../utils/excelOperations';

interface ImprovedRowEditModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: ExcelRow) => void;
  row: ExcelRow | null;
  columns: GridColDef[];
  mode: 'edit' | 'duplicate';
  title?: string;
}

const ImprovedRowEditModal: React.FC<ImprovedRowEditModalProps> = ({
  open,
  onClose,
  onSave,
  row,
  columns,
  mode,
  title
}) => {
  const [formData, setFormData] = useState<ExcelRow>({} as ExcelRow);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (row && open) {
      if (mode === 'duplicate') {
        // For duplicate, copy data but remove ID to create new record
        const { id, ...duplicateData } = row;
        setFormData(duplicateData as ExcelRow);
      } else {
        setFormData({ ...row });
      }
      setErrors({});
    }
  }, [row, open, mode]);

  const handleFieldChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Basic validation - check for required fields
    editableColumns.forEach(col => {
      const value = formData[col.field];
      if (col.headerName?.includes('*') && (!value || value === '')) {
        newErrors[col.field] = `${col.headerName} is required`;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validateForm()) {
      onSave(formData);
      onClose();
    }
  };

  const handleCancel = () => {
    setFormData({} as ExcelRow);
    setErrors({});
    onClose();
  };

  // Get editable columns for form rendering
  const editableColumns = columns.filter(col => 
    col.field !== 'id' && 
    col.field !== 'actions' && 
    col.editable !== false
  );

  // Group columns by importance
  const primaryFields = editableColumns.filter(col => 
    ['HCPCs', 'HCPCS', 'CDM', 'PhysicianCDM'].includes(col.field)
  );
  
  const descriptionFields = editableColumns.filter(col => 
    ['Description', 'QTY', 'Qty'].includes(col.field)
  );
  
  const additionalFields = editableColumns.filter(col => 
    !['HCPCs', 'HCPCS', 'CDM', 'PhysicianCDM', 'Description', 'QTY', 'Qty'].includes(col.field)
  );

  return (
    <Dialog 
      open={open} 
      onClose={handleCancel}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          boxShadow: '0 24px 38px 3px rgba(0,0,0,0.14), 0 9px 46px 8px rgba(0,0,0,0.12), 0 11px 15px -7px rgba(0,0,0,0.20)',
          background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
          overflow: 'visible'
        }
      }}
      TransitionComponent={Fade}
      TransitionProps={{ timeout: 300 }}
    >
      {/* Custom Header */}
      <Box sx={{
        background: mode === 'edit' 
          ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
          : 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        color: 'white',
        p: 3,
        position: 'relative',
        borderRadius: '12px 12px 0 0'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {mode === 'edit' ? <EditIcon sx={{ fontSize: 28 }} /> : <ContentCopyIcon sx={{ fontSize: 28 }} />}
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                {mode === 'edit' ? 'Edit Healthcare Record' : 'Duplicate Healthcare Record'}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                {mode === 'edit' ? 'Modify existing record details' : 'Create a copy with new details'}
              </Typography>
            </Box>
          </Box>
          
          <IconButton 
            onClick={handleCancel}
            sx={{ 
              color: 'white',
              '&:hover': { 
                backgroundColor: 'rgba(255,255,255,0.1)',
                transform: 'scale(1.1)'
              },
              transition: 'all 0.2s ease'
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Record Info Chip */}
        <Box sx={{ mt: 2 }}>
          <Chip
            label={`Record ID: ${formData.id || 'New'}`}
            sx={{
              backgroundColor: 'rgba(255,255,255,0.2)',
              color: 'white',
              fontWeight: 'bold'
            }}
          />
        </Box>
      </Box>
      
      <DialogContent sx={{ p: 0, backgroundColor: 'transparent' }}>
        {/* Main Content Area */}
        <Paper sx={{
          m: 3,
          p: 3,
          borderRadius: 2,
          backgroundColor: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.2)'
        }}>
          {/* Primary Fields Section */}
          {primaryFields.length > 0 && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" sx={{ 
                mb: 2, 
                color: '#2c3e50',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}>
                🏥 Primary Healthcare Codes
              </Typography>
              
              <Grid container spacing={3}>
                {primaryFields.map((column) => (
                  <Grid item xs={12} sm={6} key={column.field}>
                    <TextField
                      fullWidth
                      label={column.headerName || column.field}
                      value={formData[column.field] || ''}
                      onChange={(e) => handleFieldChange(column.field, e.target.value)}
                      error={!!errors[column.field]}
                      helperText={errors[column.field]}
                      variant="outlined"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          backgroundColor: 'rgba(255,255,255,0.8)',
                          '&:hover': {
                            backgroundColor: 'rgba(255,255,255,0.9)',
                          },
                          '&.Mui-focused': {
                            backgroundColor: 'white',
                            boxShadow: '0 0 0 3px rgba(102, 126, 234, 0.1)'
                          }
                        }
                      }}
                    />
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          {primaryFields.length > 0 && descriptionFields.length > 0 && (
            <Divider sx={{ my: 3, borderColor: 'rgba(0,0,0,0.1)' }} />
          )}

          {/* Description & Details Section */}
          {descriptionFields.length > 0 && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" sx={{ 
                mb: 2, 
                color: '#2c3e50',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}>
                📝 Description & Details
              </Typography>
              
              <Grid container spacing={3}>
                {descriptionFields.map((column) => (
                  <Grid item xs={12} sm={
                    column.field === 'Description' ? 12 :
                    (column.field.includes('QTY') || column.field.includes('Qty')) ? 8 : 6
                  } key={column.field}>
                    <TextField
                      fullWidth
                      label={column.headerName || column.field}
                      value={formData[column.field] || ''}
                      onChange={(e) => handleFieldChange(column.field, e.target.value)}
                      error={!!errors[column.field]}
                      helperText={errors[column.field]}
                      variant="outlined"
                      multiline={column.field === 'Description'}
                      rows={column.field === 'Description' ? 6 : 1}
                      minRows={column.field === 'Description' ? 6 : 1}
                      maxRows={column.field === 'Description' ? 12 : 1}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          backgroundColor: 'rgba(255,255,255,0.8)',
                          '&:hover': {
                            backgroundColor: 'rgba(255,255,255,0.9)',
                          },
                          '&.Mui-focused': {
                            backgroundColor: 'white',
                            boxShadow: '0 0 0 3px rgba(102, 126, 234, 0.1)'
                          }
                        }
                      }}
                    />
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          {/* Additional Fields Section */}
          {additionalFields.length > 0 && (
            <>
              <Divider sx={{ my: 3, borderColor: 'rgba(0,0,0,0.1)' }} />
              <Box>
                <Typography variant="h6" sx={{ 
                  mb: 2, 
                  color: '#2c3e50',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}>
                  ⚙️ Additional Fields
                </Typography>
                
                <Grid container spacing={3}>
                  {additionalFields.map((column) => (
                    <Grid item xs={12} sm={6} key={column.field}>
                      <TextField
                        fullWidth
                        label={column.headerName || column.field}
                        value={formData[column.field] || ''}
                        onChange={(e) => handleFieldChange(column.field, e.target.value)}
                        error={!!errors[column.field]}
                        helperText={errors[column.field]}
                        variant="outlined"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            backgroundColor: 'rgba(255,255,255,0.8)',
                            '&:hover': {
                              backgroundColor: 'rgba(255,255,255,0.9)',
                            },
                            '&.Mui-focused': {
                              backgroundColor: 'white',
                              boxShadow: '0 0 0 3px rgba(102, 126, 234, 0.1)'
                            }
                          }
                        }}
                      />
                    </Grid>
                  ))}
                </Grid>
              </Box>
            </>
          )}

          {/* Validation Errors */}
          {Object.keys(errors).length > 0 && (
            <Alert 
              severity="error" 
              sx={{ 
                mt: 3,
                borderRadius: 2,
                '& .MuiAlert-message': {
                  fontWeight: 'medium'
                }
              }}
            >
              Please fix the validation errors before saving.
            </Alert>
          )}
        </Paper>
      </DialogContent>
      
      {/* Custom Footer */}
      <Box sx={{
        p: 3,
        backgroundColor: 'transparent',
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 2
      }}>
        <Button 
          onClick={handleCancel}
          variant="outlined"
          startIcon={<CancelIcon />}
          sx={{
            borderRadius: 2,
            px: 3,
            py: 1,
            borderColor: '#95a5a6',
            color: '#7f8c8d',
            '&:hover': {
              borderColor: '#7f8c8d',
              backgroundColor: 'rgba(127, 140, 141, 0.1)'
            }
          }}
        >
          Cancel
        </Button>
        <Button 
          onClick={handleSave} 
          variant="contained"
          startIcon={<SaveIcon />}
          disabled={Object.keys(errors).length > 0}
          sx={{
            borderRadius: 2,
            px: 3,
            py: 1,
            background: mode === 'edit' 
              ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
              : 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            '&:hover': {
              background: mode === 'edit' 
                ? 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)'
                : 'linear-gradient(135deg, #e084e9 0%, #e3455a 100%)',
              transform: 'translateY(-1px)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
            },
            '&:disabled': {
              background: '#bdc3c7',
              color: 'white'
            },
            transition: 'all 0.2s ease'
          }}
        >
          {mode === 'edit' ? 'Save Changes' : 'Create Duplicate'}
        </Button>
      </Box>
    </Dialog>
  );
};

export default ImprovedRowEditModal;
