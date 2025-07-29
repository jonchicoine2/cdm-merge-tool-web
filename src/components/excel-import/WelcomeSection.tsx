import React from 'react';
import { Box, Typography, Button, Tooltip, CircularProgress, ButtonGroup, Menu, MenuItem, Divider } from '@mui/material';
import { ArrowDropDown as ArrowDropDownIcon } from '@mui/icons-material';
import { WelcomeSectionProps } from './types';

const WelcomeSection: React.FC<WelcomeSectionProps> = ({
  onLoadSampleData,
  isLoading = false,
  // Action button props
  showActionButtons = false,
  resetMenuAnchor,
  settingsMenuAnchor,
  onResetMenuClick,
  onResetMenuClose,
  onSettingsMenuClick,
  onSettingsMenuClose,
  onResetAction,
  onModifierSettings,
  hasMasterData = false,
  hasClientData = false
}) => {
  const [sampleMenuAnchor, setSampleMenuAnchor] = React.useState<null | HTMLElement>(null);
  const sampleMenuOpen = Boolean(sampleMenuAnchor);
  
  const handleSampleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setSampleMenuAnchor(event.currentTarget);
  };
  
  const handleSampleMenuClose = () => {
    setSampleMenuAnchor(null);
  };
  
  const handleSampleSelection = (sampleSet: number) => {
    onLoadSampleData(sampleSet);
    handleSampleMenuClose();
  };

  return (
    <Box sx={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      mb: 1,
      p: 0.5,
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
      borderRadius: 1,
      border: '1px solid #e0e0e0',
      minHeight: '40px'
    }}>
      <Typography variant="subtitle1" sx={{
        color: '#1976d2',
        fontWeight: 'bold',
        m: 0,
        fontSize: '1rem'
      }}>
        🔧 VIC CDM MERGE TOOL
      </Typography>

      {/* Action Toolbar */}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        {/* Load Sample Data Dropdown */}
        <ButtonGroup variant="contained" size="small">
          <Tooltip title="Load Sample Data (Ctrl+L)" arrow>
            <Button
              onClick={() => onLoadSampleData(1)}
              disabled={isLoading}
              sx={{
                background: '#ff9800',
                fontSize: '0.75rem',
                py: 0.25,
                px: 1,
                '&:hover': {
                  background: '#f57c00'
                },
                '&:disabled': {
                  background: '#ffcc80'
                }
              }}
              startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {isLoading ? 'Loading...' : '📂 Load Sample'}
            </Button>
          </Tooltip>
          <Button
            onClick={handleSampleMenuClick}
            disabled={isLoading}
            size="small"
            sx={{
              background: '#ff9800',
              fontSize: '0.75rem',
              py: 0.25,
              px: 0.5,
              minWidth: 'auto',
              '&:hover': {
                background: '#f57c00'
              },
              '&:disabled': {
                background: '#ffcc80'
              }
            }}
          >
            <ArrowDropDownIcon />
          </Button>
        </ButtonGroup>
        <Menu
          anchorEl={sampleMenuAnchor}
          open={sampleMenuOpen}
          onClose={handleSampleMenuClose}
          PaperProps={{
            sx: { minWidth: '200px' }
          }}
        >
          <MenuItem onClick={() => handleSampleSelection(1)}>
            📁 Sample Set 1 (Emergency Dept)
          </MenuItem>
          <MenuItem onClick={() => handleSampleSelection(2)}>
            📁 Sample Set 2
          </MenuItem>
        </Menu>

        {/* Action Buttons - Only show when data is loaded */}
        {showActionButtons && (hasMasterData || hasClientData) && (
          <>
            {/* Reset Data Dropdown */}
            <ButtonGroup variant="outlined" size="small">
              <Tooltip title="Reset Data (Ctrl+R for Reset Both)" arrow>
                <Button
                  onClick={onResetMenuClick}
                  endIcon={<ArrowDropDownIcon />}
                  sx={{ fontSize: '0.75rem', py: 0.25, px: 1 }}
                  color="error"
                >
                  🗑️ Reset
                </Button>
              </Tooltip>
            </ButtonGroup>
            <Menu
              anchorEl={resetMenuAnchor}
              open={Boolean(resetMenuAnchor)}
              onClose={onResetMenuClose}
            >
              {hasMasterData && (
                <MenuItem onClick={() => onResetAction?.('master')}>
                  📄 Reset Master Data
                </MenuItem>
              )}
              {hasClientData && (
                <MenuItem onClick={() => onResetAction?.('client')}>
                  📋 Reset Client Data
                </MenuItem>
              )}
              <Divider />
              <MenuItem onClick={() => onResetAction?.('both')}>
                🔄 Reset Both
              </MenuItem>
            </Menu>

            {/* Settings Dropdown - Only show when both files are loaded */}
            {hasMasterData && hasClientData && (
              <>
                <ButtonGroup variant="outlined" size="small">
                  <Tooltip title="Application settings and preferences" arrow>
                    <Button
                      onClick={onSettingsMenuClick}
                      endIcon={<ArrowDropDownIcon />}
                      sx={{ fontSize: '0.75rem', py: 0.25, px: 1 }}
                    >
                      ⚙️ Settings
                    </Button>
                  </Tooltip>
                </ButtonGroup>
                <Menu
                  anchorEl={settingsMenuAnchor}
                  open={Boolean(settingsMenuAnchor)}
                  onClose={onSettingsMenuClose}
                >
                  <MenuItem onClick={onModifierSettings}>
                    🔧 Adjust Modifier Criteria
                  </MenuItem>
                </Menu>
              </>
            )}
          </>
        )}
      </Box>
    </Box>
  );
};

export default WelcomeSection;
