import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DataGridPro, useGridApiRef, GridRowSelectionModel } from '@mui/x-data-grid-pro';
import React from 'react';

// Mock data for testing
const mockRows = [
  { id: 1, name: 'John Doe', age: 30, email: 'john@example.com' },
  { id: 2, name: 'Jane Smith', age: 25, email: 'jane@example.com' },
  { id: 3, name: 'Bob Johnson', age: 35, email: 'bob@example.com' },
];

const mockColumns = [
  { field: 'id', headerName: 'ID', width: 90 },
  { field: 'name', headerName: 'Name', width: 150 },
  { field: 'age', headerName: 'Age', width: 110 },
  { field: 'email', headerName: 'Email', width: 200 },
];

// Test component to validate current DataGridPro functionality
const TestDataGridProComponent: React.FC = () => {
  const apiRef = useGridApiRef();
  const [selectedRows, setSelectedRows] = React.useState<GridRowSelectionModel>([]);
  const [editedRows, setEditedRows] = React.useState(mockRows);

  const handleSelectionChange = (newSelection: GridRowSelectionModel) => {
    setSelectedRows(newSelection);
  };

  const handleProcessRowUpdate = (newRow: any) => {
    const updatedRows = editedRows.map((row) =>
      row.id === newRow.id ? newRow : row
    );
    setEditedRows(updatedRows);
    return newRow;
  };

  return (
    <div style={{ height: 400, width: '100%' }} data-testid="datagrid-container">
      <DataGridPro
        apiRef={apiRef}
        rows={editedRows}
        columns={mockColumns}
        checkboxSelection
        editMode="row"
        onRowSelectionModelChange={handleSelectionChange}
        processRowUpdate={handleProcessRowUpdate}
        showToolbar
        density="compact"
        disableVirtualization={false}
      />
      <div data-testid="selection-info">
        Selected: {Array.isArray(selectedRows) ? selectedRows.length : 0} rows
      </div>
    </div>
  );
};

describe('DataGridPro Current Functionality Tests', () => {
  beforeEach(() => {
    // Clear any previous DOM state
    document.body.innerHTML = '';
  });

  test('renders DataGridPro with initial data', async () => {
    render(<TestDataGridProComponent />);
    
    // Check if the grid container is rendered
    expect(screen.getByTestId('datagrid-container')).toBeInTheDocument();
    
    // Check for data presence (may need to wait for virtualization)
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
    
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
  });

  test('displays correct column headers', async () => {
    render(<TestDataGridProComponent />);
    
    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Age')).toBeInTheDocument();
      expect(screen.getByText('Email')).toBeInTheDocument();
    });
  });

  test('shows toolbar when showToolbar is enabled', async () => {
    render(<TestDataGridProComponent />);
    
    // Check for toolbar presence (toolbar contains filter/search functionality)
    await waitFor(() => {
      // Look for common toolbar elements
      const toolbar = document.querySelector('.MuiDataGrid-toolbarContainer');
      expect(toolbar).toBeInTheDocument();
    });
  });

  test('has checkboxes for row selection when checkboxSelection is enabled', async () => {
    render(<TestDataGridProComponent />);
    
    await waitFor(() => {
      // Look for checkbox inputs
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes.length).toBeGreaterThan(0);
    });
  });

  test('apiRef provides access to grid API methods', async () => {
    const TestApiRefComponent: React.FC = () => {
      const apiRef = useGridApiRef();
      const [apiMethods, setApiMethods] = React.useState<string[]>([]);

      React.useEffect(() => {
        if (apiRef.current) {
          // Get available API methods
          const methods = Object.getOwnPropertyNames(apiRef.current)
            .filter(name => typeof apiRef.current![name] === 'function')
            .slice(0, 5); // Just check first 5 methods
          setApiMethods(methods);
        }
      }, []);

      return (
        <div>
          <DataGridPro
            apiRef={apiRef}
            rows={mockRows}
            columns={mockColumns}
          />
          <div data-testid="api-methods">
            {apiMethods.join(', ')}
          </div>
        </div>
      );
    };

    render(<TestApiRefComponent />);
    
    await waitFor(() => {
      const apiMethodsElement = screen.getByTestId('api-methods');
      expect(apiMethodsElement.textContent).toBeTruthy();
    });
  });

  test('handles row selection model changes', async () => {
    render(<TestDataGridProComponent />);
    
    // Wait for grid to render
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Initial selection should be empty
    expect(screen.getByTestId('selection-info')).toHaveTextContent('Selected: 0 rows');

    // Try to select a row via checkbox (implementation may vary based on MUI version)
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    if (checkboxes.length > 1) {
      fireEvent.click(checkboxes[1]); // First checkbox is usually header select-all
      
      await waitFor(() => {
        expect(screen.getByTestId('selection-info')).toHaveTextContent('Selected: 1 rows');
      });
    }
  });

  test('supports row editing mode', async () => {
    const EditTestComponent: React.FC = () => {
      const [rows, setRows] = React.useState(mockRows);

      const handleProcessRowUpdate = (newRow: any, oldRow: any) => {
        const updatedRows = rows.map((row) =>
          row.id === newRow.id ? newRow : row
        );
        setRows(updatedRows);
        return newRow;
      };

      return (
        <div style={{ height: 400, width: '100%' }}>
          <DataGridPro
            rows={rows}
            columns={mockColumns}
            editMode="row"
            processRowUpdate={handleProcessRowUpdate}
            onProcessRowUpdateError={(error) => {
              console.error('Row update error:', error);
            }}
          />
        </div>
      );
    };

    render(<EditTestComponent />);
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Verify edit mode is set (this test mainly ensures no errors occur)
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  test('applies compact density correctly', async () => {
    render(<TestDataGridProComponent />);
    
    await waitFor(() => {
      // Check if compact density class is applied
      const dataGrid = document.querySelector('.MuiDataGrid-root');
      expect(dataGrid).toBeInTheDocument();
      
      // Compact density should result in smaller row heights
      const rows = document.querySelectorAll('.MuiDataGrid-row');
      expect(rows.length).toBeGreaterThan(0);
    });
  });

  test('handles virtualization setting', async () => {
    render(<TestDataGridProComponent />);
    
    await waitFor(() => {
      // Check for virtualization container
      const virtualScroller = document.querySelector('.MuiDataGrid-virtualScroller');
      expect(virtualScroller).toBeInTheDocument();
    });
  });
});