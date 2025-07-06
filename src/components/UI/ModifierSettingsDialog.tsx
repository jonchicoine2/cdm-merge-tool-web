"use client";

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Typography,
  Box,
  Divider
} from '@mui/material';
import { ModifierCriteria } from '../../utils/excelOperations';

interface ModifierSettingsDialogProps {
  open: boolean;
  modifierCriteria: ModifierCriteria;
  onClose: () => void;
  onSave: (criteria: ModifierCriteria) => void;
  onChange: (criteria: ModifierCriteria) => void;
}

export const ModifierSettingsDialog: React.FC<ModifierSettingsDialogProps> = ({
  open,
  modifierCriteria,
  onClose,
  onSave,
  onChange
}) => {
  const handleCheckboxChange = (field: keyof ModifierCriteria) => {
    onChange({
      ...modifierCriteria,
      [field]: !modifierCriteria[field]
    });
  };

  const handleSave = () => {
    onSave(modifierCriteria);
    onClose();
  };

  const handleReset = () => {
    onChange({
      root00: true,
      root25: true,
      ignoreTrauma: false,
      root50: false,
      root59: false,
      rootXU: false,
      root76: false,
    });
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          maxHeight: '80vh'
        }
      }}
    >
      <DialogTitle sx={{ 
        backgroundColor: '#f5f5f5', 
        borderBottom: '1px solid #e0e0e0',
        display: 'flex',
        alignItems: 'center',
        gap: 1
      }}>
        ⚙️ Modifier Matching Settings
      </DialogTitle>
      
      <DialogContent sx={{ p: 3 }}>
        <Typography variant="body2" sx={{ mb: 3, color: '#666' }}>
          Configure which HCPCS modifiers should be treated as equivalent during comparison.
          When enabled, these modifiers will be ignored when matching records.
        </Typography>

        <FormGroup>
          {/* Common Modifiers Section */}
          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold', color: '#333' }}>
            Common Modifiers
          </Typography>
          
          <FormControlLabel
            control={
              <Checkbox
                checked={modifierCriteria.root00}
                onChange={() => handleCheckboxChange('root00')}
                color="primary"
              />
            }
            label={
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                  Modifier 00 (No Modifier)
                </Typography>
                <Typography variant="caption" sx={{ color: '#666' }}>
                  Treat records with modifier &quot;00&quot; or no modifier as equivalent
                </Typography>
              </Box>
            }
            sx={{ mb: 1 }}
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={modifierCriteria.root25}
                onChange={() => handleCheckboxChange('root25')}
                color="primary"
              />
            }
            label={
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                  Modifier 25 (Significant E/M Service)
                </Typography>
                <Typography variant="caption" sx={{ color: '#666' }}>
                  Ignore modifier 25 when matching procedures
                </Typography>
              </Box>
            }
            sx={{ mb: 2 }}
          />

          <Divider sx={{ my: 2 }} />

          {/* Advanced Modifiers Section */}
          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold', color: '#333' }}>
            Advanced Modifiers
          </Typography>

          <FormControlLabel
            control={
              <Checkbox
                checked={modifierCriteria.root50}
                onChange={() => handleCheckboxChange('root50')}
                color="primary"
              />
            }
            label={
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                  Modifier 50 (Bilateral Procedure)
                </Typography>
                <Typography variant="caption" sx={{ color: '#666' }}>
                  Ignore bilateral procedure modifier
                </Typography>
              </Box>
            }
            sx={{ mb: 1 }}
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={modifierCriteria.root59}
                onChange={() => handleCheckboxChange('root59')}
                color="primary"
              />
            }
            label={
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                  Modifier 59 (Distinct Procedure)
                </Typography>
                <Typography variant="caption" sx={{ color: '#666' }}>
                  Ignore distinct procedural service modifier
                </Typography>
              </Box>
            }
            sx={{ mb: 1 }}
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={modifierCriteria.rootXU}
                onChange={() => handleCheckboxChange('rootXU')}
                color="primary"
              />
            }
            label={
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                  Modifier XU (Unusual Service)
                </Typography>
                <Typography variant="caption" sx={{ color: '#666' }}>
                  Ignore unusual non-overlapping service modifier
                </Typography>
              </Box>
            }
            sx={{ mb: 1 }}
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={modifierCriteria.root76}
                onChange={() => handleCheckboxChange('root76')}
                color="primary"
              />
            }
            label={
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                  Modifier 76 (Repeat Procedure)
                </Typography>
                <Typography variant="caption" sx={{ color: '#666' }}>
                  Ignore repeat procedure modifier
                </Typography>
              </Box>
            }
            sx={{ mb: 2 }}
          />

          <Divider sx={{ my: 2 }} />

          {/* Special Options Section */}
          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold', color: '#333' }}>
            Special Options
          </Typography>

          <FormControlLabel
            control={
              <Checkbox
                checked={modifierCriteria.ignoreTrauma}
                onChange={() => handleCheckboxChange('ignoreTrauma')}
                color="warning"
              />
            }
            label={
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                  Exclude Trauma Cases
                </Typography>
                <Typography variant="caption" sx={{ color: '#666' }}>
                  Filter out procedures with trauma-related keywords
                </Typography>
              </Box>
            }
            sx={{ mb: 1 }}
          />
        </FormGroup>

        {/* Current Selection Summary */}
        <Box sx={{ 
          mt: 3, 
          p: 2, 
          backgroundColor: '#f0f8ff', 
          borderRadius: 1,
          border: '1px solid #e3f2fd'
        }}>
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
            Current Selection:
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {modifierCriteria.root00 && (
              <Box sx={{ 
                backgroundColor: '#2196f3', 
                color: 'white', 
                padding: '2px 8px', 
                borderRadius: '12px',
                fontSize: '0.75rem'
              }}>
                00
              </Box>
            )}
            {modifierCriteria.root25 && (
              <Box sx={{ 
                backgroundColor: '#4caf50', 
                color: 'white', 
                padding: '2px 8px', 
                borderRadius: '12px',
                fontSize: '0.75rem'
              }}>
                25
              </Box>
            )}
            {modifierCriteria.root50 && (
              <Box sx={{ 
                backgroundColor: '#ff9800', 
                color: 'white', 
                padding: '2px 8px', 
                borderRadius: '12px',
                fontSize: '0.75rem'
              }}>
                50
              </Box>
            )}
            {modifierCriteria.root59 && (
              <Box sx={{ 
                backgroundColor: '#9c27b0', 
                color: 'white', 
                padding: '2px 8px', 
                borderRadius: '12px',
                fontSize: '0.75rem'
              }}>
                59
              </Box>
            )}
            {modifierCriteria.rootXU && (
              <Box sx={{ 
                backgroundColor: '#f44336', 
                color: 'white', 
                padding: '2px 8px', 
                borderRadius: '12px',
                fontSize: '0.75rem'
              }}>
                XU
              </Box>
            )}
            {modifierCriteria.root76 && (
              <Box sx={{ 
                backgroundColor: '#607d8b', 
                color: 'white', 
                padding: '2px 8px', 
                borderRadius: '12px',
                fontSize: '0.75rem'
              }}>
                76
              </Box>
            )}
            {modifierCriteria.ignoreTrauma && (
              <Box sx={{ 
                backgroundColor: '#795548', 
                color: 'white', 
                padding: '2px 8px', 
                borderRadius: '12px',
                fontSize: '0.75rem'
              }}>
                No Trauma
              </Box>
            )}
            {!Object.values(modifierCriteria).some(v => v) && (
              <Typography variant="caption" sx={{ color: '#666', fontStyle: 'italic' }}>
                No modifiers selected
              </Typography>
            )}
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ 
        p: 3, 
        backgroundColor: '#f5f5f5', 
        borderTop: '1px solid #e0e0e0',
        gap: 1
      }}>
        <Button 
          onClick={handleReset}
          variant="outlined"
          size="small"
        >
          Reset to Default
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button 
          onClick={onClose}
          variant="outlined"
        >
          Cancel
        </Button>
        <Button 
          onClick={handleSave}
          variant="contained"
          color="primary"
        >
          Save Settings
        </Button>
      </DialogActions>
    </Dialog>
  );
};