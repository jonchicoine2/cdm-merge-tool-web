import React from 'react';
import dynamic from 'next/dynamic';
import { GridColDef, GridSortModel, GridRowSelectionModel } from "@mui/x-data-grid";

// Dynamically import DataGrid with no SSR
const DataGrid = dynamic(
  () => import('@mui/x-data-grid').then((mod) => ({ default: mod.DataGrid })),
  { ssr: false }
);

interface DynamicDataGridProps {
  rows: any[];
  columns: GridColDef[];
  sortModel?: GridSortModel;
  onSortModelChange?: (model: GridSortModel) => void;
  checkboxSelection?: boolean;
  rowSelectionModel?: any[];
  onRowSelectionModelChange?: (selection: GridRowSelectionModel) => void;
  onRowClick?: (params: any) => void;
  disableRowSelectionOnClick?: boolean;
  sx?: any;
  pageSizeOptions?: number[];
  initialState?: any;
  gridKey?: string;
}

export const DynamicDataGrid: React.FC<DynamicDataGridProps> = ({
  rows,
  columns,
  sortModel,
  onSortModelChange,
  checkboxSelection,
  rowSelectionModel,
  onRowSelectionModelChange,
  onRowClick,
  disableRowSelectionOnClick,
  sx,
  pageSizeOptions,
  initialState,
  gridKey
}) => {
  return (
    <DataGrid
      key={gridKey}
      rows={rows}
      columns={columns}
      sortModel={sortModel}
      onSortModelChange={onSortModelChange}
      checkboxSelection={checkboxSelection}
      rowSelectionModel={rowSelectionModel as unknown as GridRowSelectionModel}
      onRowSelectionModelChange={onRowSelectionModelChange}
      onRowClick={onRowClick}
      disableRowSelectionOnClick={disableRowSelectionOnClick}
      sx={sx}
      pageSizeOptions={pageSizeOptions}
      initialState={initialState}
    />
  );
}; 