"use client";

import React from 'react';
import { Box, Button } from '@mui/material';
import { ModifierCriteria } from '../../utils/excelOperations';

interface ActionButtonsPanelProps {
  hasAnyData: boolean;
  hasBothFiles: boolean;
  hasComparison: boolean;
  onLoadSampleData: () => void;
  onOpenModifierSettings: () => void;
  onCompareData: () => void;
  onExportMerged: () => void;
  onExportUnmatched: () => void;
  onExportDuplicates: () => void;
  onResetAll: () => void;
  chatWidth?: number;
  modifierCriteria?: ModifierCriteria;
}

export const ActionButtonsPanel: React.FC<ActionButtonsPanelProps> = ({
  hasAnyData,
  hasBothFiles,
  hasComparison,
  onLoadSampleData,
  onOpenModifierSettings,
  onCompareData,
  onExportMerged,
  onExportUnmatched,
  onExportDuplicates,
  onResetAll,
  chatWidth = 0,
  modifierCriteria
}) => {
  const containerWidth = chatWidth > 0 ? `calc(100% - ${chatWidth}px)` : '100%';

  return (
    <Box sx={{ 
      width: containerWidth,
      transition: 'width 0.3s ease',
      mt: 2,
      mb: 2
    }}>
      <Box sx={{ 
        display: 'flex', 
        gap: 2, 
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        {/* Load Sample Data */}
        <Button 
          variant="outlined" 
          onClick={onLoadSampleData}
          sx={{ 
            minWidth: '120px',
            fontSize: '0.875rem'
          }}
        >
          📋 Load Sample Data
        </Button>

        {/* Modifier Settings */}
        <Button 
          variant="outlined" 
          onClick={onOpenModifierSettings}
          disabled={!hasAnyData}
          sx={{ 
            minWidth: '120px',
            fontSize: '0.875rem'
          }}
        >
          ⚙️ Modifier Settings
        </Button>

        {/* Compare Data */}
        <Button 
          variant="contained" 
          color="primary"
          onClick={onCompareData}
          disabled={!hasBothFiles}
          sx={{ 
            minWidth: '120px',
            fontSize: '0.875rem',
            fontWeight: 'bold'
          }}
        >
          🔄 Compare Data
        </Button>

        {/* Export Options */}
        {hasComparison && (
          <>
            <Button 
              variant="outlined" 
              color="success"
              onClick={onExportMerged}
              sx={{ 
                minWidth: '120px',
                fontSize: '0.875rem'
              }}
            >
              📥 Export Merged
            </Button>

            <Button 
              variant="outlined" 
              color="warning"
              onClick={onExportUnmatched}
              sx={{ 
                minWidth: '120px',
                fontSize: '0.875rem'
              }}
            >
              📤 Export Unmatched
            </Button>

            <Button 
              variant="outlined" 
              color="error"
              onClick={onExportDuplicates}
              sx={{ 
                minWidth: '120px',
                fontSize: '0.875rem'
              }}
            >
              🔄 Export Duplicates
            </Button>
          </>
        )}

        {/* Reset All */}
        {hasAnyData && (
          <Button 
            variant="outlined" 
            color="error"
            onClick={onResetAll}
            sx={{ 
              minWidth: '120px',
              fontSize: '0.875rem'
            }}
          >
            🗑️ Reset All
          </Button>
        )}
      </Box>

      {/* Modifier Criteria Display */}
      {modifierCriteria && hasAnyData && (
        <Box sx={{ 
          mt: 2, 
          p: 2, 
          backgroundColor: '#f5f5f5', 
          borderRadius: 1,
          textAlign: 'center'
        }}>
          <Box sx={{ 
            display: 'flex', 
            gap: 1, 
            justifyContent: 'center', 
            flexWrap: 'wrap',
            fontSize: '0.75rem'
          }}>
            <span>Modifier Settings:</span>
            {modifierCriteria.root00 && <span style={{ backgroundColor: '#2196f3', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>00</span>}
            {modifierCriteria.root25 && <span style={{ backgroundColor: '#4caf50', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>25</span>}
            {modifierCriteria.root50 && <span style={{ backgroundColor: '#ff9800', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>50</span>}
            {modifierCriteria.root59 && <span style={{ backgroundColor: '#9c27b0', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>59</span>}
            {modifierCriteria.rootXU && <span style={{ backgroundColor: '#f44336', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>XU</span>}
            {modifierCriteria.root76 && <span style={{ backgroundColor: '#607d8b', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>76</span>}
            {modifierCriteria.ignoreTrauma && <span style={{ backgroundColor: '#795548', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>No Trauma</span>}
          </Box>
        </Box>
      )}
    </Box>
  );
};