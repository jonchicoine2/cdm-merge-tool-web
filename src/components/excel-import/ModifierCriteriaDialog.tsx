import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Box
} from '@mui/material';
import { ModifierCriteriaDialogProps } from './types';

const ModifierCriteriaDialog: React.FC<ModifierCriteriaDialogProps> = ({
  open,
  criteria,
  onClose,
  onCriteriaChange,
  onStartComparison,
  useNewHyphenAlgorithm = false,
  onHyphenAlgorithmChange
}) => {
  const handleCriteriaChange = (field: keyof typeof criteria) => (event: React.ChangeEvent<HTMLInputElement>) => {
    onCriteriaChange({
      ...criteria,
      [field]: event.target.checked
    });
  };

  const handleStartComparison = () => {
    onClose();
    onStartComparison();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Configure Modifier Criteria</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2 }}>
          Select which modifiers should be treated as root codes (without modifiers) during comparison:
        </Typography>
        <FormGroup>
          <FormControlLabel
            control={
              <Checkbox
                checked={criteria.root00}
                onChange={handleCriteriaChange('root00')}
              />
            }
            label="Treat empty/00 modifiers as root codes"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={criteria.root25}
                onChange={handleCriteriaChange('root25')}
              />
            }
            label="Treat 25 modifier as root code"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={criteria.root50}
                onChange={handleCriteriaChange('root50')}
              />
            }
            label="Treat 50 modifier as root code"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={criteria.root59}
                onChange={handleCriteriaChange('root59')}
              />
            }
            label="Treat 59 modifier as root code"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={criteria.rootXU}
                onChange={handleCriteriaChange('rootXU')}
              />
            }
            label="Treat XU modifier as root code"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={criteria.root76}
                onChange={handleCriteriaChange('root76')}
              />
            }
            label="Treat 76 modifier as root code"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={criteria.ignoreTrauma}
                onChange={handleCriteriaChange('ignoreTrauma')}
              />
            }
            label="Ignore trauma codes in comparison"
          />
          {onHyphenAlgorithmChange && (
            <>
              {/* Divider for visual separation */}
              <Box sx={{ my: 2, borderTop: '1px solid #e0e0e0' }} />
              <FormControlLabel
                control={
                  <Checkbox 
                    checked={useNewHyphenAlgorithm} 
                    onChange={(e) => onHyphenAlgorithmChange(e.target.checked)} 
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2">Use New Hyphen Algorithm</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {useNewHyphenAlgorithm 
                        ? "Pattern validation (XXXXX-YY format required)" 
                        : "Length-based only (legacy behavior)"}
                    </Typography>
                  </Box>
                }
              />
            </>
          )}
        </FormGroup>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleStartComparison} variant="contained">
          Start Comparison
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ModifierCriteriaDialog;
