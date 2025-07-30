import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  Button,
  TextField,
  Box,
  Typography,
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
  Cancel as CancelIcon
} from '@mui/icons-material';
import { GridColDef } from '@mui/x-data-grid-pro';
import { ExcelRow } from '../../utils/excelOperations';

interface ImprovedRowEditModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: ExcelRow) => void;
  row: ExcelRow | null;
  columns: GridColDef[];
  mode: 'edit' | 'create-new';
  title?: string;
  existingRows?: ExcelRow[]; // For duplicate validation
  hcpcsColumn?: string; // HCPCS column name
  modifierColumn?: string | null; // Modifier column name
}

const ImprovedRowEditModal: React.FC<ImprovedRowEditModalProps> = ({
  open,
  onClose,
  onSave,
  row,
  columns,
  mode,
  existingRows = [],
  hcpcsColumn,
  modifierColumn
}) => {
  console.log('[MODAL PROPS] Received props:', {
    open,
    mode,
    hcpcsColumn,
    existingRowsCount: existingRows?.length || 0,
    columnsCount: columns?.length || 0
  });

  const [formData, setFormData] = useState<ExcelRow>({} as ExcelRow);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (row && open) {
      if (mode === 'create-new') {
        // For create-new, copy data but remove ID to create new record
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id: _id, ...newRecordData } = row;
        setFormData(newRecordData as ExcelRow);
      } else {
        setFormData({ ...row });
      }
      setErrors({});
    }
  }, [row, open, mode]);

  // Auto-focus and cursor positioning for HCPCS field in create-new mode
  useEffect(() => {
    if (open && mode === 'create-new' && hcpcsColumn) {
      // Small delay to ensure the modal and fields are fully rendered
      const timer = setTimeout(() => {
        // Find the HCPCS field by looking for input with the HCPCS column name
        const hcpcsInput = document.querySelector(`input[name="${hcpcsColumn}"]`) as HTMLInputElement;
        if (hcpcsInput) {
          hcpcsInput.focus();
          // Position cursor at the end of the text
          const textLength = hcpcsInput.value.length;
          hcpcsInput.setSelectionRange(textLength, textLength);
        } else {
          // Fallback: try to find by label text or other attributes
          const allInputs = document.querySelectorAll('input[type="text"]');
          for (const input of allInputs) {
            const inputElement = input as HTMLInputElement;
            // Check if this input is in a container with HCPCS-related text
            const container = inputElement.closest('.MuiFormControl-root');
            if (container && container.textContent?.toLowerCase().includes('hcpcs')) {
              inputElement.focus();
              const textLength = inputElement.value.length;
              inputElement.setSelectionRange(textLength, textLength);
              break;
            }
          }
        }
      }, 150); // Slightly longer delay to ensure modal animation is complete

      return () => clearTimeout(timer);
    }
  }, [open, mode, hcpcsColumn]);

  // Function to generate HCPCS key for duplicate checking
  const generateHCPCSKey = useCallback((row: ExcelRow): string => {
    if (!hcpcsColumn) return '';

    const hcpcs = String(row[hcpcsColumn] || "").toUpperCase().trim();
    const modifier = modifierColumn ? String(row[modifierColumn] || "").toUpperCase().trim() : "";
    return modifierColumn ? `${hcpcs}-${modifier}` : hcpcs;
  }, [hcpcsColumn, modifierColumn]);

  // Function to check for HCPCS duplicates
  const validateHCPCSUniqueness = useCallback((): string | null => {
    console.log('[HCPCS VALIDATION] Starting validation...');
    console.log('[HCPCS VALIDATION] Mode:', mode);
    console.log('[HCPCS VALIDATION] HCPCS column:', hcpcsColumn);

    if (mode !== 'create-new' || !hcpcsColumn) {
      console.log('[HCPCS VALIDATION] Skipping validation - not create-new mode or no HCPCS column');
      return null;
    }

    const currentKey = generateHCPCSKey(formData);
    console.log('[HCPCS VALIDATION] Current HCPCS key:', currentKey);

    if (!currentKey) {
      console.log('[HCPCS VALIDATION] No HCPCS key generated, skipping');
      return null;
    }

    // Check if this HCPCS key already exists in existing rows
    const existingKeys = existingRows.map(row => generateHCPCSKey(row));
    console.log('[HCPCS VALIDATION] Existing HCPCS keys:', existingKeys);

    const isDuplicate = existingRows.some(existingRow => {
      const existingKey = generateHCPCSKey(existingRow);
      return existingKey === currentKey;
    });

    console.log('[HCPCS VALIDATION] Is duplicate?', isDuplicate);

    const errorMessage = isDuplicate ? `This HCPCS code already exists. Please use a different code.` : null;
    console.log('[HCPCS VALIDATION] Error message:', errorMessage);

    return errorMessage;
  }, [mode, hcpcsColumn, formData, existingRows, generateHCPCSKey]);

  const validateForm = useCallback((): boolean => {
    console.log('[FORM VALIDATION] Starting form validation...');
    const newErrors: Record<string, string> = {};

    // Get editable columns for validation
    const editableColumns = columns.filter(col =>
      col.field !== 'id' &&
      col.field !== 'actions' &&
      col.editable !== false
    );

    // Basic validation - check for required fields
    editableColumns.forEach(col => {
      const value = formData[col.field];
      if (col.headerName?.includes('*') && (!value || value === '')) {
        newErrors[col.field] = `${col.headerName} is required`;
      }
    });

    console.log('[FORM VALIDATION] Basic validation errors:', newErrors);

    // HCPCS uniqueness validation for create-new mode
    if (hcpcsColumn) {
      console.log('[FORM VALIDATION] Running HCPCS validation...');
      const hcpcsError = validateHCPCSUniqueness();
      if (hcpcsError) {
        console.log('[FORM VALIDATION] HCPCS error found:', hcpcsError);
        newErrors[hcpcsColumn] = hcpcsError;
      } else {
        console.log('[FORM VALIDATION] No HCPCS error');
      }
    } else {
      console.log('[FORM VALIDATION] No HCPCS column, skipping HCPCS validation');
    }

    console.log('[FORM VALIDATION] Final errors:', newErrors);
    setErrors(newErrors);
    const isValid = Object.keys(newErrors).length === 0;
    console.log('[FORM VALIDATION] Form is valid:', isValid);
    return isValid;
  }, [columns, formData, hcpcsColumn, validateHCPCSUniqueness]);

  // Validate form when modal opens in create-new mode to check for immediate duplicates
  useEffect(() => {
    if (open && mode === 'create-new' && formData && Object.keys(formData).length > 0) {
      console.log('[MODAL OPEN] Running initial validation for create-new mode');
      console.log('[MODAL OPEN] HCPCS column received:', hcpcsColumn);
      console.log('[MODAL OPEN] Existing rows count:', existingRows?.length || 0);
      console.log('[MODAL OPEN] Form data:', formData);
      // Small delay to ensure form data is fully set
      const timer = setTimeout(() => {
        validateForm();
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [open, mode, formData, hcpcsColumn, existingRows?.length]);

  const handleFieldChange = (field: string, value: string) => {
    const updatedFormData = {
      ...formData,
      [field]: value
    };
    setFormData(updatedFormData);

    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }

    // Real-time HCPCS validation for create-new mode
    if (field === hcpcsColumn && mode === 'create-new' && hcpcsColumn) {
      const currentKey = generateHCPCSKey(updatedFormData);
      if (currentKey) {
        const isDuplicate = existingRows.some(existingRow => {
          return generateHCPCSKey(existingRow) === currentKey;
        });

        if (isDuplicate) {
          setErrors(prev => ({
            ...prev,
            [hcpcsColumn]: 'This HCPCS code already exists. Please use a different code.'
          }));
        }
      }
    }
  };

  const handleSave = () => {
    console.log('[MODAL SAVE] Starting save validation...');
    console.log('[MODAL SAVE] Current mode:', mode);
    console.log('[MODAL SAVE] Form data:', formData);
    console.log('[MODAL SAVE] Existing rows count:', existingRows.length);
    console.log('[MODAL SAVE] HCPCS column:', hcpcsColumn);

    const isValid = validateForm();
    console.log('[MODAL SAVE] Validation result:', isValid);
    console.log('[MODAL SAVE] Current errors:', errors);

    if (isValid) {
      console.log('[MODAL SAVE] Validation passed, saving...');
      onSave(formData);
      onClose();
    } else {
      console.log('[MODAL SAVE] Validation failed, preventing save');
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
      maxWidth="md"
      fullWidth
      sx={{
        '& .MuiDialog-paper': {
          width: '75%',
          maxWidth: 'none'
        }
      }}
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
          : 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)',
        color: 'white',
        p: 3,
        position: 'relative',
        borderRadius: '12px 12px 0 0'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {mode === 'edit' ? <EditIcon sx={{ fontSize: 28 }} /> : <SaveIcon sx={{ fontSize: 28 }} />}
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                {mode === 'edit' ? 'Edit Healthcare Record' : 'Create New Healthcare Record'}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                {mode === 'edit' ? 'Modify existing record details' : 'Create a new record based on this one'}
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
              
              <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {primaryFields.map((column) => (
                  <Box key={column.field} sx={{ flex: '1 1 300px', minWidth: '300px' }}>
                    <TextField
                      fullWidth
                      name={column.field}
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
                  </Box>
                ))}
              </Box>
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
              
              <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>
                {/* Description field - takes up most of the width */}
                {descriptionFields.filter(col => col.field === 'Description').map((column) => (
                  <Box key={column.field} sx={{ flex: '3', minWidth: '400px' }}>
                    <TextField
                      fullWidth
                      name={column.field}
                      label={column.headerName || column.field}
                      value={formData[column.field] || ''}
                      onChange={(e) => handleFieldChange(column.field, e.target.value)}
                      error={!!errors[column.field]}
                      helperText={errors[column.field]}
                      variant="outlined"
                      multiline
                      minRows={4}
                      maxRows={8}
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
                        },
                        '& .MuiInputBase-input': {
                          fontSize: '16px',
                          lineHeight: 1.6
                        }
                      }}
                    />
                  </Box>
                ))}

                {/* QTY field - takes up smaller width */}
                {descriptionFields.filter(col => col.field !== 'Description').map((column) => (
                  <Box key={column.field} sx={{ flex: '1', minWidth: '120px', maxWidth: '200px' }}>
                    <TextField
                      fullWidth
                      name={column.field}
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
                  </Box>
                ))}
              </Box>
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
                
                <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  {additionalFields.map((column) => (
                    <Box key={column.field} sx={{ flex: '1 1 300px', minWidth: '300px' }}>
                      <TextField
                        fullWidth
                        name={column.field}
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
                    </Box>
                  ))}
                </Box>
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
          {mode === 'edit' ? 'Save Changes' : 'Create New Record'}
        </Button>
      </Box>
    </Dialog>
  );
};

export default ImprovedRowEditModal;
