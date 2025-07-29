import React from 'react';
import { GridColDef, GridRenderCellParams } from '@mui/x-data-grid-pro';
import { 
  Box, 
  IconButton, 
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

export interface RowActionsProps {
  gridType: 'master' | 'client' | 'merged';
  onEditRow: (rowId: number | string, gridType: 'master' | 'client' | 'merged') => void;
  onCreateNewFromRow: (rowId: number | string, gridType: 'master' | 'client' | 'merged') => void;
  onDeleteRow: (rowId: number | string, gridType: 'master' | 'client' | 'merged') => void;
}

export const createRowActionsColumn = ({
  gridType,
  onEditRow,
  onCreateNewFromRow,
  onDeleteRow
}: RowActionsProps): GridColDef => {
  return {
    field: 'actions',
    headerName: 'Actions',
    width: 100,
    editable: false,
    sortable: false,
    filterable: false,
    disableColumnMenu: true,
    disableReorder: true,
    hideable: false,
    renderCell: (params: GridRenderCellParams) => {
      const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);

      const handleDelete = () => {
        onDeleteRow(params.row.id, gridType);
        setDeleteDialogOpen(false);
      };

      return (
        <Box
          className="row-actions"
          sx={{
            display: 'flex',
            alignItems: 'center',
            height: '100%',
            opacity: 0,
            transition: 'opacity 0.2s ease',
            '.MuiDataGrid-row:hover &': {
              opacity: 1
            }
          }}
        >
          <Tooltip title="Edit Row">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onEditRow(params.row.id, gridType);
              }}
              sx={{
                color: '#1976d2',
                padding: '2px',
                '&:hover': {
                  backgroundColor: 'rgba(25, 118, 210, 0.04)'
                }
              }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Create New From This">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onCreateNewFromRow(params.row.id, gridType);
              }}
              sx={{
                color: '#4caf50',
                padding: '2px',
                '&:hover': {
                  backgroundColor: 'rgba(76, 175, 80, 0.04)'
                }
              }}
            >
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Delete Row">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteDialogOpen(true);
              }}
              sx={{
                color: '#d32f2f',
                padding: '2px',
                '&:hover': {
                  backgroundColor: 'rgba(211, 47, 47, 0.04)'
                }
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          {/* Delete Confirmation Dialog */}
          <Dialog
            open={deleteDialogOpen}
            onClose={() => setDeleteDialogOpen(false)}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle>
              Confirm Delete
            </DialogTitle>
            <DialogContent>
              <Typography>
                Are you sure you want to delete this row? This action cannot be undone.
              </Typography>
              <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Row ID: {params.row.id}
                </Typography>
                {/* Show some key fields to help identify the row */}
                {Object.entries(params.row)
                  .filter(([key, value]) =>
                    key !== 'id' &&
                    key !== 'actions' &&
                    value &&
                    String(value).trim() !== ''
                  )
                  .slice(0, 3) // Show first 3 non-empty fields
                  .map(([key, value]) => (
                    <Typography key={key} variant="body2" color="text.secondary">
                      {key}: {String(value)}
                    </Typography>
                  ))
                }
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDeleteDialogOpen(false)} color="inherit">
                Cancel
              </Button>
              <Button onClick={handleDelete} color="error" variant="contained">
                Delete
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      );
    }
  };
};

export default createRowActionsColumn;
