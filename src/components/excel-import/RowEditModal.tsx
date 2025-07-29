import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
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
  Info as InfoIcon
} from '@mui/icons-material';
import { GridColDef } from '@mui/x-data-grid-pro';
import { ExcelRow } from '../../utils/excelOperations';

export interface RowEditModalProps {
  open: boolean;
  row: ExcelRow | null;
  columns: GridColDef[];
  title: string;
  onClose: () => void;
  onSave: (updatedRow: ExcelRow) => void;
}

const RowEditModal: React.FC<RowEditModalProps> = ({
  open,
  row,
  columns,
  title,
  onClose,
  onSave
}) => {
  const [formData, setFormData] = useState<ExcelRow>({} as ExcelRow);
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  // Initialize form data when row changes
  useEffect(() => {
    if (row) {
      setFormData({ ...row });
      setErrors({});
    }
  }, [row]);

  const handleFieldChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: {[key: string]: string} = {};
    
    // Get editable columns (exclude id and actions)
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

  return (
    <Dialog 
      open={open} 
      onClose={handleCancel} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: { minHeight: '400px' }
      }}
    >
      <DialogTitle>
        <Typography variant="h6" component="div">
          {title}
        </Typography>
        {row && (
          <Typography variant="body2" color="text.secondary">
            Row ID: {row.id}
          </Typography>
        )}
      </DialogTitle>
      
      <DialogContent dividers>
        <Box sx={{ mt: 1 }}>
          <Grid container spacing={2}>
            {editableColumns.map((column) => {
              const fieldValue = formData[column.field] || '';
              const hasError = !!errors[column.field];
              
              return (
                <Grid item xs={12} sm={6} key={column.field}>
                  <TextField
                    fullWidth
                    label={column.headerName || column.field}
                    value={fieldValue}
                    onChange={(e) => handleFieldChange(column.field, e.target.value)}
                    error={hasError}
                    helperText={errors[column.field]}
                    variant="outlined"
                    size="small"
                    type={column.type === 'number' ? 'number' : 'text'}
                    multiline={column.field.toLowerCase().includes('description') || 
                             column.field.toLowerCase().includes('note')}
                    rows={column.field.toLowerCase().includes('description') || 
                          column.field.toLowerCase().includes('note') ? 2 : 1}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        '&:hover fieldset': {
                          borderColor: hasError ? 'error.main' : 'primary.main',
                        },
                      },
                    }}
                  />
                </Grid>
              );
            })}
          </Grid>
          
          {Object.keys(errors).length > 0 && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'error.light', borderRadius: 1 }}>
              <Typography variant="body2" color="error.dark">
                Please fix the following errors:
              </Typography>
              <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                {Object.values(errors).map((error, index) => (
                  <li key={index}>
                    <Typography variant="body2" color="error.dark">
                      {error}
                    </Typography>
                  </li>
                ))}
              </ul>
            </Box>
          )}
        </Box>
      </DialogContent>
      
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={handleCancel} color="inherit">
          Cancel
        </Button>
        <Button 
          onClick={handleSave} 
          variant="contained" 
          color="primary"
          disabled={Object.keys(errors).length > 0}
        >
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RowEditModal;
