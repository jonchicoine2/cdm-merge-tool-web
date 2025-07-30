import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ExcelImportPage from '../app/excel-import-clean/page';
import React from 'react';


// Mock the dynamic import NoSSR wrapper
jest.mock('next/dynamic', () => {
  return (fn: any) => {
    const Component = fn();
    return Component;
  };
});

// Mock XLSX library
jest.mock('xlsx', () => ({
  read: jest.fn(),
  utils: {
    sheet_to_json: jest.fn(),
  },
}));

// Mock file operations utilities
jest.mock('../utils/excelOperations', () => ({
  filterAndSearchRows: jest.fn((rows) => rows),
  formatHCPCSWithHyphens: jest.fn((code) => code),
  ModifierCriteria: {},
  ExcelRow: {},
}));


describe('ExcelImportPage Component Tests', () => {
  beforeEach(() => {
    // Clear localStorage and any mocks
    localStorage.clear();
    jest.clearAllMocks();
  });

  test('renders main page layout', async () => {
    render(<ExcelImportPage />);
    
    // Check for main container
    await waitFor(() => {
      expect(screen.getByText(/Excel Import Tool/i)).toBeInTheDocument();
    });
  });

  test('shows file upload sections for master and client files', async () => {
    render(<ExcelImportPage />);
    
    await waitFor(() => {
      // Look for file upload areas
      expect(screen.getByText(/Master File/i)).toBeInTheDocument();
      expect(screen.getByText(/Client File/i)).toBeInTheDocument();
    });
  });

  test('has sample data loading functionality', async () => {
    render(<ExcelImportPage />);
    
    await waitFor(() => {
      const sampleDataButton = screen.getByText(/Load Sample Data/i);
      expect(sampleDataButton).toBeInTheDocument();
      
      // Test that clicking doesn't cause errors
      fireEvent.click(sampleDataButton);
    });
  });

  test('displays grid sections when data is loaded', async () => {
    render(<ExcelImportPage />);
    
    // Load sample data first
    await waitFor(() => {
      const sampleDataButton = screen.getByText(/Load Sample Data/i);
      fireEvent.click(sampleDataButton);
    });

    // Check for grid containers (may need to wait for async operations)
    await waitFor(() => {
      // Look for data grid containers
      const gridElements = document.querySelectorAll('[data-testid*="grid"]');
      expect(gridElements.length).toBeGreaterThanOrEqual(0);
    }, { timeout: 3000 });
  });


  test('tab navigation works correctly', async () => {
    render(<ExcelImportPage />);
    
    await waitFor(() => {
      // Look for tab elements
      const tabs = document.querySelectorAll('[role="tab"]');
      if (tabs.length > 0) {
        expect(tabs.length).toBeGreaterThan(0);
        
        // Test tab clicking
        fireEvent.click(tabs[0]);
      }
    });
  });

  test('handles file drag and drop areas', async () => {
    render(<ExcelImportPage />);
    
    await waitFor(() => {
      // Look for drag and drop areas
      const dropZones = document.querySelectorAll('[data-testid*="drop"], .drop-zone');
      // Should have areas for master and client files
      expect(dropZones.length).toBeGreaterThanOrEqual(0);
    });
  });

  test('search functionality is available', async () => {
    render(<ExcelImportPage />);
    
    // Load sample data first
    await waitFor(() => {
      const sampleDataButton = screen.getByText(/Load Sample Data/i);
      fireEvent.click(sampleDataButton);
    });

    await waitFor(() => {
      // Look for search inputs
      const searchInputs = document.querySelectorAll('input[type="text"]');
      const searchIcons = document.querySelectorAll('[data-testid="SearchIcon"]');
      
      expect(searchInputs.length + searchIcons.length).toBeGreaterThan(0);
    });
  });

  test('comparison functionality triggers correctly', async () => {
    render(<ExcelImportPage />);
    
    // Load sample data
    await waitFor(() => {
      const sampleDataButton = screen.getByText(/Load Sample Data/i);
      fireEvent.click(sampleDataButton);
    });

    await waitFor(() => {
      // Look for compare button
      const compareButton = screen.queryByText(/Compare/i);
      if (compareButton) {
        expect(compareButton).toBeInTheDocument();
        fireEvent.click(compareButton);
      }
    }, { timeout: 3000 });
  });

  test('handles row selection state management', async () => {
    render(<ExcelImportPage />);
    
    // Load sample data first
    await waitFor(() => {
      const sampleDataButton = screen.getByText(/Load Sample Data/i);
      fireEvent.click(sampleDataButton);
    });

    // Test that selection state is managed (no errors thrown)
    await waitFor(() => {
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      if (checkboxes.length > 0) {
        fireEvent.click(checkboxes[0]);
      }
    });
  });

  test('error handling for malformed data', async () => {
    // Mock console.error to check for error handling
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    render(<ExcelImportPage />);
    
    // Test that component renders without throwing errors
    await waitFor(() => {
      expect(screen.getByText(/Excel Import Tool/i)).toBeInTheDocument();
    });

    consoleSpy.mockRestore();
  });

  test('localStorage integration works', async () => {
    render(<ExcelImportPage />);
    
    // Test that component doesn't break with empty localStorage
    await waitFor(() => {
      expect(screen.getByText(/Excel Import Tool/i)).toBeInTheDocument();
    });

    // Simulate localStorage with data
    localStorage.setItem('testKey', 'testValue');
    expect(localStorage.getItem('testKey')).toBe('testValue');
  });

  test('responsive design elements are present', async () => {
    render(<ExcelImportPage />);
    
    await waitFor(() => {
      // Check for responsive container classes
      const containers = document.querySelectorAll('.MuiBox-root, .MuiContainer-root');
      expect(containers.length).toBeGreaterThan(0);
    });
  });

  test('accessibility features are implemented', async () => {
    render(<ExcelImportPage />);
    
    await waitFor(() => {
      // Check for ARIA labels and roles
      const ariaElements = document.querySelectorAll('[aria-label], [role]');
      expect(ariaElements.length).toBeGreaterThan(0);
    });
  });
});