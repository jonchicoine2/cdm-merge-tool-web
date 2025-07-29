import React from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import { GridColDef, GridRenderCellParams } from '@mui/x-data-grid-pro';
import EditIcon from '@mui/icons-material/Edit';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';

interface ActionsColumnProps {
  gridType: 'master' | 'client' | 'merged';
  onEditRow: (rowId: number | string, gridType: 'master' | 'client' | 'merged') => void;
  onDuplicateRow: (rowId: number | string, gridType: 'master' | 'client' | 'merged') => void;
  onDeleteRow: (rowId: number | string, gridType: 'master' | 'client' | 'merged') => void;
}

export const createActionsColumn = ({
  gridType,
  onEditRow,
  onDuplicateRow,
  onDeleteRow
}: ActionsColumnProps): GridColDef => {
  return {
    field: 'actions',
    headerName: 'Actions',
    width: 140,
    editable: false,
    sortable: false,
    filterable: false,
    disableColumnMenu: true,
    disableReorder: true,
    hideable: false,
    renderCell: (params: GridRenderCellParams) => {
      return (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Edit Row">
            <IconButton
              size="small"
              onClick={() => onEditRow(params.row.id, gridType)}
              sx={{ color: '#1976d2' }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Duplicate Row">
            <IconButton
              size="small"
              onClick={() => onDuplicateRow(params.row.id, gridType)}
              sx={{ color: '#ed6c02' }}
            >
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete Row">
            <IconButton
              size="small"
              onClick={() => onDeleteRow(params.row.id, gridType)}
              sx={{ color: '#d32f2f' }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      );
    },
  };
};
