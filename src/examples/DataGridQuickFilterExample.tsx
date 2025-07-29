import React from 'react';
import { Box } from '@mui/material';
import { 
  DataGrid, 
  GridColDef, 
  GridToolbar,
  GridToolbarContainer,
  GridToolbarQuickFilter,
  GridToolbarExport,
  GridToolbarColumnsButton,
  GridToolbarFilterButton,
  GridToolbarDensitySelector
} from '@mui/x-data-grid';

// Sample data
const rows = [
  { id: 1, name: 'John Doe', age: 25, city: 'New York' },
  { id: 2, name: 'Jane Smith', age: 30, city: 'Los Angeles' },
  { id: 3, name: 'Bob Johnson', age: 35, city: 'Chicago' },
  { id: 4, name: 'Alice Brown', age: 28, city: 'Houston' },
  { id: 5, name: 'Charlie Wilson', age: 32, city: 'Phoenix' },
];

const columns: GridColDef[] = [
  { field: 'id', headerName: 'ID', width: 70 },
  { field: 'name', headerName: 'Name', width: 150 },
  { field: 'age', headerName: 'Age', width: 100 },
  { field: 'city', headerName: 'City', width: 150 },
];

// Option 1: Using the built-in GridToolbar (includes quick filter with clear button)
export function DataGridWithBuiltInToolbar() {
  return (
    <Box sx={{ height: 400, width: '100%' }}>
      <DataGrid
        rows={rows}
        columns={columns}
        slots={{
          toolbar: GridToolbar,
        }}
        slotProps={{
          toolbar: {
            showQuickFilter: true,
            quickFilterProps: { debounceMs: 500 },
          },
        }}
      />
    </Box>
  );
}

// Option 2: Custom toolbar with quick filter
function CustomToolbar() {
  return (
    <GridToolbarContainer>
      <GridToolbarColumnsButton />
      <GridToolbarFilterButton />
      <GridToolbarDensitySelector />
      <GridToolbarExport />
      <Box sx={{ flexGrow: 1 }} />
      <GridToolbarQuickFilter 
        quickFilterParser={(searchInput: string) =>
          searchInput
            .split(',')
            .map((value) => value.trim())
            .filter((value) => value !== '')
        }
      />
    </GridToolbarContainer>
  );
}

export function DataGridWithCustomToolbar() {
  return (
    <Box sx={{ height: 400, width: '100%' }}>
      <DataGrid
        rows={rows}
        columns={columns}
        slots={{
          toolbar: CustomToolbar,
        }}
      />
    </Box>
  );
}

// Option 3: Minimal toolbar with just quick filter
function MinimalToolbar() {
  return (
    <GridToolbarContainer>
      <Box sx={{ flexGrow: 1 }} />
      <GridToolbarQuickFilter />
    </GridToolbarContainer>
  );
}

export function DataGridWithMinimalToolbar() {
  return (
    <Box sx={{ height: 400, width: '100%' }}>
      <DataGrid
        rows={rows}
        columns={columns}
        slots={{
          toolbar: MinimalToolbar,
        }}
      />
    </Box>
  );
}

// Main example component
export default function DataGridQuickFilterExample() {
  return (
    <Box sx={{ p: 4 }}>
      <h2>DataGrid Quick Filter Examples</h2>
      
      <h3>1. Built-in Toolbar with Quick Filter</h3>
      <DataGridWithBuiltInToolbar />
      
      <h3 style={{ marginTop: '2rem' }}>2. Custom Toolbar with Quick Filter</h3>
      <DataGridWithCustomToolbar />
      
      <h3 style={{ marginTop: '2rem' }}>3. Minimal Toolbar (Quick Filter Only)</h3>
      <DataGridWithMinimalToolbar />
    </Box>
  );
}
