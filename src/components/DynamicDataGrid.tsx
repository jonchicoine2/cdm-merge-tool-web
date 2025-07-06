import React from 'react';
import dynamic from 'next/dynamic';
import { GridColDef, GridSortModel, GridRowSelectionModel, GridRowParams, GridInitialState } from "@mui/x-data-grid";
import { SxProps, Theme } from "@mui/material";

// Dynamically import DataGrid with no SSR
const DataGrid = dynamic(
  () => import('@mui/x-data-grid').then((mod) => ({ default: mod.DataGrid })),
  { ssr: false }
);

interface DynamicDataGridProps {
  rows: Record<string, unknown>[];
  columns: GridColDef[];
  sortModel?: GridSortModel;
  onSortModelChange?: (model: GridSortModel) => void;
  checkboxSelection?: boolean;
  rowSelectionModel?: GridRowSelectionModel;
  onRowSelectionModelChange?: (selection: GridRowSelectionModel) => void;
  onRowClick?: (params: GridRowParams) => void;
  disableRowSelectionOnClick?: boolean;
  sx?: SxProps<Theme>;
  pageSizeOptions?: number[];
  initialState?: GridInitialState;
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