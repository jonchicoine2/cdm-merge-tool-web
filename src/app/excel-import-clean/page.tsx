"use client";
import React, { useState, useEffect, useCallback } from "react";
import { Box, Typography, Tooltip, CircularProgress, Snackbar, Alert } from "@mui/material";
import { useRouter } from "next/navigation";

import dynamic from 'next/dynamic';
import { ModifierCriteria } from "../../utils/excelOperations";
import { useFileOperations } from "../../hooks/useFileOperations";
import { useComparison } from "../../hooks/useComparison";
import { saveSharedData, loadSharedData, SharedAppData } from "../../utils/sharedDataPersistence";
import {
  WelcomeSection,
  FileUploadArea,
  DataGridSection,
  ComparisonResults,
  ModifierCriteriaDialog
} from "../../components/excel-import";
import ImprovedRowEditModal from "../../components/excel-import/ImprovedRowEditModal";
import { ExcelRow } from "../../utils/excelOperations";

// Create a NoSSR wrapper component to disable server-side rendering
const NoSSR = dynamic(() => Promise.resolve(({ children }: { children: React.ReactNode }) => <>{children}</>), {
  ssr: false,
  loading: () => (
    <Box sx={{ 
      p: 4, 
      background: 'linear-gradient(135deg, #f8fbff 0%, #e3f2fd 50%, #f0f8ff 100%)',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <Typography variant="h4" sx={{ color: '#1976d2' }}>
        Loading Excel Import Tool...
      </Typography>
    </Box>
  )
});

export default function ExcelImportCleanPage() {
  const router = useRouter();

  // Use custom hooks for data management
  const fileOps = useFileOperations();
  const comparison = useComparison();

  // UI state
  const [modifierDialogOpen, setModifierDialogOpen] = useState(false);
  const [isLoadingSharedData, setIsLoadingSharedData] = useState(false);

  // Loading states
  const [isLoadingSample, setIsLoadingSample] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isComparing, setIsComparing] = useState(false);

  // Notification state
  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'info'
  });
  const [resetMenuAnchor, setResetMenuAnchor] = useState<null | HTMLElement>(null);
  const [settingsMenuAnchor, setSettingsMenuAnchor] = useState<null | HTMLElement>(null);
  const [modifierCriteria, setModifierCriteria] = useState<ModifierCriteria>({
    root00: false,
    root25: false,
    ignoreTrauma: false,
    root50: false,
    root59: false,
    rootXU: false,
    root76: false,
  });

  // Row edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<ExcelRow | null>(null);
  const [editingGridType, setEditingGridType] = useState<'master' | 'client'>('master');
  const [editModalTitle, setEditModalTitle] = useState('');
  const [editModalMode, setEditModalMode] = useState<'edit' | 'duplicate'>('edit');

  // Function to save current state to shared data
  const saveCurrentStateToShared = useCallback(() => {
    const sharedData: SharedAppData = {
      // Master data
      rowsMaster: fileOps.rowsMaster,
      columnsMaster: fileOps.columnsMaster,
      masterSheetData: fileOps.masterSheetData,
      masterSheetNames: fileOps.masterSheetNames,
      activeMasterTab: fileOps.activeMasterTab,
      masterFileMetadata: fileOps.masterFileMetadata,

      // Client data
      rowsClient: fileOps.rowsClient,
      columnsClient: fileOps.columnsClient,
      clientSheetData: fileOps.clientSheetData,
      clientSheetNames: fileOps.clientSheetNames,
      activeClientTab: fileOps.activeClientTab,
      clientFileMetadata: fileOps.clientFileMetadata,

      // Comparison results
      mergedRows: comparison.mergedRows,
      mergedColumns: comparison.mergedColumns,
      unmatchedClient: comparison.unmatchedClient,
      dupsClient: comparison.dupsClient,
      showCompare: comparison.showCompare,
      comparisonStats: comparison.comparisonStats,

      // Settings
      modifierCriteria,

      // Metadata
      lastSaved: new Date().toISOString(),
      sourceUI: 'clean'
    };

    saveSharedData(sharedData);
  }, [fileOps, comparison, modifierCriteria]);

  // Function to load shared data from main UI
  const loadSharedDataToState = useCallback(() => {
    const sharedData = loadSharedData();
    if (sharedData && sharedData.sourceUI === 'main') {
      console.log('[SHARED DATA] Loading data from main UI...');
      setIsLoadingSharedData(true);

      // Load file operations data (master/client data)
      fileOps.loadSharedData(sharedData);

      // Load comparison results
      comparison.loadSharedData(sharedData);

      // Load settings
      setModifierCriteria(sharedData.modifierCriteria);

      console.log('[SHARED DATA] Successfully loaded shared data');
      setIsLoadingSharedData(false);
      return true;
    }
    return false;
  }, [fileOps, comparison]);

  // Load shared data on component mount (only once)
  useEffect(() => {
    loadSharedDataToState();
  }, []); // Empty dependency array to run only once on mount

  // Hidden keyboard shortcut to toggle UI (Ctrl+Shift+U)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'U') {
        event.preventDefault();
        saveCurrentStateToShared();
        router.push('/excel-import');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [router, saveCurrentStateToShared]);

  // Auto-compare when both tables have data (but not during shared data loading)
  useEffect(() => {
    if (!isLoadingSharedData && fileOps.rowsMaster.length > 0 && fileOps.rowsClient.length > 0) {
      // Perform comparison automatically
      comparison.performComparison(
        fileOps.rowsMaster,
        fileOps.columnsMaster,
        fileOps.rowsClient,
        fileOps.columnsClient,
        modifierCriteria
      );

      // Scroll to comparison results after a short delay to allow rendering
      setTimeout(() => {
        const comparisonElement = document.getElementById('comparison-results');
        if (comparisonElement) {
          comparisonElement.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        }
      }, 300);
    }
  }, [isLoadingSharedData, fileOps.rowsMaster.length, fileOps.rowsClient.length, fileOps.columnsMaster.length, fileOps.columnsClient.length, modifierCriteria, comparison.performComparison]);

  // Drag and drop handlers
  const handleDragEnter = (fileType: "Master" | "Client") => () => {
    if (fileType === "Master") fileOps.setDragOverMaster(true);
    else fileOps.setDragOverClient(true);
  };

  const handleDragLeave = (fileType: "Master" | "Client") => () => {
    if (fileType === "Master") fileOps.setDragOverMaster(false);
    else fileOps.setDragOverClient(false);
  };

  const handleDrop = (fileType: "Master" | "Client") => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (fileType === "Master") fileOps.setDragOverMaster(false);
    else fileOps.setDragOverClient(false);
    const files = e.dataTransfer.files;
    if (files.length) {
      fileOps.handleFileUpload(files[0], fileType);
    }
  };

  // Close dialog handler (comparison happens automatically)
  const handleStartComparison = () => {
    setModifierDialogOpen(false);
  };

  // Notification helper
  const showNotification = (message: string, severity: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setNotification({
      open: true,
      message,
      severity
    });
  };

  // Enhanced handlers with loading states and notifications
  const handleLoadSampleDataWithFeedback = async () => {
    setIsLoadingSample(true);
    try {
      await fileOps.handleLoadSampleData();
      showNotification('Sample data loaded successfully!', 'success');
    } catch (error) {
      showNotification('Failed to load sample data. Please try again.', 'error');
      console.error('Load sample data error:', error);
    } finally {
      setIsLoadingSample(false);
    }
  };

  const handleResetWithFeedback = (type: 'master' | 'client' | 'both') => {
    try {
      switch (type) {
        case 'master':
          fileOps.resetMaster();
          showNotification('Master data reset successfully!', 'info');
          break;
        case 'client':
          fileOps.resetClient();
          showNotification('Client data reset successfully!', 'info');
          break;
        case 'both':
          fileOps.resetBoth();
          comparison.resetComparison();
          showNotification('All data reset successfully!', 'info');
          break;
      }
    } catch (error) {
      showNotification('Failed to reset data. Please try again.', 'error');
      console.error('Reset error:', error);
    }
  };

  // Export handler (unified like original implementation)
  const handleExportData = () => {
    setIsExporting(true);
    try {
      fileOps.handleExport(
        comparison.mergedRows,
        comparison.unmatchedClient,
        comparison.dupsClient
      );
      showNotification('Data exported successfully!', 'success');
    } catch (error) {
      showNotification('Failed to export data. Please try again.', 'error');
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  // Keyboard shortcuts handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for modifier keys
      const isCtrl = event.ctrlKey || event.metaKey; // Support both Ctrl and Cmd
      const isShift = event.shiftKey;

      // Prevent default browser shortcuts when our shortcuts are triggered
      if (isCtrl) {
        switch (event.key.toLowerCase()) {
          case 'l':
            event.preventDefault();
            // Load Sample Data
            handleLoadSampleDataWithFeedback();
            break;
          case 'r':
            if (!isShift) {
              event.preventDefault();
              // Reset Both
              handleResetWithFeedback('both');
            }
            break;
          case 'e':
            event.preventDefault();
            // Export Data (only if there's merged data)
            if (comparison.mergedRows.length > 0) {
              handleExportData();
            }
            break;
          case '1':
            event.preventDefault();
            // Focus Master Grid
            const masterGrid = document.querySelector('[data-testid="master-grid"]') as HTMLElement;
            if (masterGrid) {
              masterGrid.focus();
              masterGrid.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            break;
          case '2':
            event.preventDefault();
            // Focus Client Grid
            const clientGrid = document.querySelector('[data-testid="client-grid"]') as HTMLElement;
            if (clientGrid) {
              clientGrid.focus();
              clientGrid.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            break;
          case '3':
            event.preventDefault();
            // Focus Merged Grid
            const mergedGrid = document.querySelector('[data-testid="merged-grid"]') as HTMLElement;
            if (mergedGrid) {
              mergedGrid.focus();
              mergedGrid.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            break;
        }
      }

      // Handle Ctrl+Shift+U (Switch UI) - this is already implemented
      if (isCtrl && isShift && event.key.toLowerCase() === 'u') {
        event.preventDefault();
        router.push('/');
      }
    };

    // Add event listener
    document.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [fileOps, comparison, router, handleExportData]);

  // Row operation handlers for merged grid
  const handleEditRow = (rowId: number | string, gridType: 'master' | 'client' | 'merged') => {
    if (gridType !== 'merged') return; // Only allow editing merged rows

    const rowToEdit = comparison.mergedRows.find(row => row.id === rowId);

    if (rowToEdit) {
      setEditingRow(rowToEdit);
      setEditingGridType('master'); // Use master columns for editing merged data
      setEditModalTitle('Edit Merged Row');
      setEditModalMode('edit');
      setEditModalOpen(true);
    }
  };

  const handleDuplicateRow = (rowId: number | string, gridType: 'master' | 'client' | 'merged') => {
    if (gridType !== 'merged') return; // Only allow duplicating merged rows

    const rowToDuplicate = comparison.mergedRows.find(row => row.id === rowId);
    if (rowToDuplicate) {
      // For duplicate mode, we pass the original row and let the modal handle the duplication
      setEditingRow(rowToDuplicate);
      setEditingGridType('master'); // Use master columns for editing
      setEditModalTitle('Duplicate Merged Row');
      setEditModalMode('duplicate');
      setEditModalOpen(true);
    }
  };

  const handleDeleteRow = (rowId: number | string, gridType: 'master' | 'client' | 'merged') => {
    if (gridType !== 'merged') return; // Only allow deleting merged rows

    // Remove the row from merged data
    const updatedMergedRows = comparison.mergedRows.filter(row => row.id !== rowId);

    // Update the comparison state (we'll need to add this method to useComparison)
    // For now, we can manually update the merged rows
    comparison.setMergedRows(updatedMergedRows);
  };

  const handleSaveEditedRow = (updatedRow: ExcelRow) => {
    if (editingGridType === 'master') {
      if (editModalMode === 'duplicate') {
        // For duplicate mode, create a new row with a new ID
        const newRow = {
          ...updatedRow,
          id: Date.now() // Generate new ID for duplicate
        };
        comparison.setMergedRows([...comparison.mergedRows, newRow]);
      } else {
        // For edit mode, update the existing row
        const updatedMergedRows = comparison.mergedRows.map(row =>
          row.id === updatedRow.id ? updatedRow : row
        );
        comparison.setMergedRows(updatedMergedRows);
      }
    }
  };

  const handleCloseEditModal = () => {
    setEditModalOpen(false);
    setEditingRow(null);
    setEditModalTitle('');
  };

  return (
    <NoSSR>
      <Box sx={{
        p: 2,
        background: 'linear-gradient(135deg, #f8fbff 0%, #e3f2fd 50%, #f0f8ff 100%)',
        minHeight: '100vh'
      }}>


        {/* Welcome Section */}
        <WelcomeSection
          onLoadSampleData={handleLoadSampleDataWithFeedback}
          isLoading={isLoadingSample}
          showActionButtons={true}
          resetMenuAnchor={resetMenuAnchor}
          settingsMenuAnchor={settingsMenuAnchor}
          onResetMenuClick={(event) => setResetMenuAnchor(event.currentTarget)}
          onResetMenuClose={() => setResetMenuAnchor(null)}
          onSettingsMenuClick={(event) => setSettingsMenuAnchor(event.currentTarget)}
          onSettingsMenuClose={() => setSettingsMenuAnchor(null)}
          onResetAction={(type) => {
            handleResetWithFeedback(type);
            setResetMenuAnchor(null);
          }}
          onModifierSettings={() => {
            setModifierDialogOpen(true);
            setSettingsMenuAnchor(null);
          }}
          hasMasterData={fileOps.rowsMaster.length > 0}
          hasClientData={fileOps.rowsClient.length > 0}
        />

        {/* Master and Client Sections - Horizontal Layout */}
        <Box sx={{
          display: "flex",
          gap: 2,
          flexDirection: { xs: 'column', md: 'row' },
          width: '100%',
          mb: 2
        }}>
          {/* Master Section */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {fileOps.rowsMaster.length === 0 ? (
              <FileUploadArea
                fileType="Master"
                rows={fileOps.rowsMaster}
                columns={fileOps.columnsMaster}
                fileMetadata={fileOps.masterFileMetadata}
                sheetNames={fileOps.masterSheetNames}
                activeTab={fileOps.activeMasterTab}
                sheetData={fileOps.masterSheetData}
                dragOver={fileOps.dragOverMaster}
                validationResult={fileOps.validationResults.master}
                isValidating={fileOps.isValidating.master}
                onFileUpload={fileOps.handleFileUpload}
                onTabChange={fileOps.handleMasterTabChange}
                onDragEnter={handleDragEnter("Master")}
                onDragLeave={handleDragLeave("Master")}
                onDrop={handleDrop("Master")}
              />
            ) : (
              <DataGridSection
                title="📄 Master Data"
                rows={fileOps.rowsMaster}
                columns={fileOps.columnsMaster}
                gridType="master"
                fileMetadata={fileOps.masterFileMetadata}
                onRowUpdate={fileOps.handleMasterRowUpdate}
              />
            )}
          </Box>

          {/* Client Section */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {fileOps.rowsClient.length === 0 ? (
              <FileUploadArea
                fileType="Client"
                rows={fileOps.rowsClient}
                columns={fileOps.columnsClient}
                fileMetadata={fileOps.clientFileMetadata}
                sheetNames={fileOps.clientSheetNames}
                activeTab={fileOps.activeClientTab}
                sheetData={fileOps.clientSheetData}
                dragOver={fileOps.dragOverClient}
                validationResult={fileOps.validationResults.client}
                isValidating={fileOps.isValidating.client}
                onFileUpload={fileOps.handleFileUpload}
                onTabChange={fileOps.handleClientTabChange}
                onDragEnter={handleDragEnter("Client")}
                onDragLeave={handleDragLeave("Client")}
                onDrop={handleDrop("Client")}
              />
            ) : (
              <DataGridSection
                title="📋 Client Data"
                rows={fileOps.rowsClient}
                columns={fileOps.columnsClient}
                gridType="client"
                fileMetadata={fileOps.clientFileMetadata}
                onRowUpdate={fileOps.handleClientRowUpdate}
              />
            )}
          </Box>
        </Box>





        {/* Comparison Results */}
        {comparison.showCompare && (
          <Box id="comparison-results">
            <ComparisonResults
              mergedRows={comparison.mergedRows}
              mergedColumns={comparison.mergedColumns}
              unmatchedClient={comparison.unmatchedClient}
              dupsClient={comparison.dupsClient}
              columnsClient={fileOps.columnsClient}
              comparisonStats={comparison.comparisonStats}
              onExport={handleExportData}
              isExporting={isExporting}
              enableRowActions={true}
              onEditRow={handleEditRow}
              onDuplicateRow={handleDuplicateRow}
              onDeleteRow={handleDeleteRow}
            />
          </Box>
        )}

        {/* Modifier Criteria Dialog */}
        <ModifierCriteriaDialog
          open={modifierDialogOpen}
          criteria={modifierCriteria}
          onClose={() => setModifierDialogOpen(false)}
          onCriteriaChange={setModifierCriteria}
          onStartComparison={handleStartComparison}
        />

        {/* Row Edit Modal */}
        <ImprovedRowEditModal
          open={editModalOpen}
          row={editingRow}
          columns={comparison.mergedColumns.length > 0 ? comparison.mergedColumns : fileOps.columnsMaster}
          mode={editModalMode}
          title={editModalTitle}
          onClose={handleCloseEditModal}
          onSave={handleSaveEditedRow}
        />

        {/* Notification Snackbar */}
        <Snackbar
          open={notification.open}
          autoHideDuration={4000}
          onClose={() => setNotification(prev => ({ ...prev, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert
            onClose={() => setNotification(prev => ({ ...prev, open: false }))}
            severity={notification.severity}
            variant="filled"
            sx={{ width: '100%' }}
          >
            {notification.message}
          </Alert>
        </Snackbar>

        {/* Footer */}
        <Box sx={{
          mt: 3,
          pt: 2,
          borderTop: '1px solid #e0e0e0',
          textAlign: 'center',
          color: '#666'
        }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            🏥 VIC CDM Merge Tool - Healthcare Data Processing & Analysis
          </Typography>
          <Typography variant="caption" sx={{ display: 'block', mb: 2 }}>
            Streamlined Excel import, HCPCS code matching, and data merging without AI complexity
          </Typography>
          <Typography
            variant="caption"
            onClick={() => {
              saveCurrentStateToShared();
              router.push('/excel-import');
            }}
            sx={{
              color: 'rgba(0,0,0,0.4)',
              fontSize: '0.7rem',
              cursor: 'pointer',
              '&:hover': {
                color: 'rgba(0,0,0,0.6)',
                textDecoration: 'underline'
              }
            }}
          >
            Press Ctrl+Shift+U to switch UI versions
          </Typography>
        </Box>
      </Box>
    </NoSSR>
  );
}
