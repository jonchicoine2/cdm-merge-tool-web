"use client";
import React, { useState, useEffect, useCallback } from "react";
import { Box, Typography, Snackbar, Alert, Button, Tooltip } from "@mui/material";
import { useRouter } from "next/navigation";

import dynamic from 'next/dynamic';
import { ModifierCriteria } from "../../utils/excelOperations";
import { useFileOperations } from "../../hooks/useFileOperations";
import { useComparison } from "../../hooks/useComparison";
// Note: Removed shared data imports - pages are now independent
// import { saveSharedData, loadSharedData, SharedAppData } from "../../utils/sharedDataPersistence";
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
  
  // Toggle for hyphen insertion algorithm (false = old algorithm, true = new algorithm)
  const [useNewHyphenAlgorithm, setUseNewHyphenAlgorithm] = useState(false);

  // Use custom hooks for data management
  const fileOps = useFileOperations(useNewHyphenAlgorithm);
  const comparison = useComparison();

  // UI state
  const [modifierDialogOpen, setModifierDialogOpen] = useState(false);
  // Note: Removed isLoadingSharedData state - pages are now independent

  // Restore session state
  const [lastMasterFile, setLastMasterFile] = useState<string | null>(null);
  const [lastClientFile, setLastClientFile] = useState<string | null>(null);
  const [lastMasterData, setLastMasterData] = useState<string | null>(null);
  const [lastClientData, setLastClientData] = useState<string | null>(null);

  // Loading states
  const [isLoadingSample, setIsLoadingSample] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

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
  const [editingGridType, setEditingGridType] = useState<'master' | 'client' | 'merged'>('master');
  const [editModalTitle, setEditModalTitle] = useState('');
  const [editModalMode, setEditModalMode] = useState<'edit' | 'create-new' | 'duplicate'>('edit');

  // Note: Removed shared data saving function - pages are now independent

  // Note: Removed shared data loading function - pages are now independent

  // Load localStorage items for restore session functionality
  useEffect(() => {
    const lastMaster = localStorage.getItem("lastMasterFile");
    const lastMasterData = localStorage.getItem("lastMasterData");
    const lastClient = localStorage.getItem("lastClientFile");
    const lastClientData = localStorage.getItem("lastClientData");

    if (lastMaster) {
      setLastMasterFile(lastMaster);
    }
    if (lastMasterData) {
      setLastMasterData(lastMasterData);
    }
    if (lastClient) {
      setLastClientFile(lastClient);
    }
    if (lastClientData) {
      setLastClientData(lastClientData);
    }
  }, []);





  // Simple row update handlers - useEffect will handle re-comparison
  const handleMasterRowUpdateWithRecompare = useCallback((updatedRow: ExcelRow) => {
    fileOps.handleMasterRowUpdate(updatedRow);
    // No manual re-comparison needed - useEffect will handle it
  }, [fileOps]);

  const handleClientRowUpdateWithRecompare = useCallback((updatedRow: ExcelRow) => {
    fileOps.handleClientRowUpdate(updatedRow);
    // No manual re-comparison needed - useEffect will handle it
  }, [fileOps]);

  // Auto-compare when both tables have data OR when data changes
  useEffect(() => {
    if (fileOps.rowsMaster.length > 0 && fileOps.rowsClient.length > 0) {
      console.log('[AUTO-RECOMPARE] Data changed, triggering merge recalculation');

      // Perform comparison automatically
      comparison.performComparison(
        fileOps.rowsMaster,
        fileOps.columnsMaster,
        fileOps.rowsClient,
        fileOps.columnsClient,
        modifierCriteria
      );

      // Only scroll on initial load (when lengths change, not content)
      // This prevents scrolling on every edit
      const isInitialLoad = !comparison.showCompare;
      if (isInitialLoad) {
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
    }
  }, [
    fileOps.rowsMaster, // Watch the actual data arrays, not just lengths
    fileOps.rowsClient,  // This will trigger when content changes
    fileOps.columnsMaster,
    fileOps.columnsClient,
    modifierCriteria,
    comparison.performComparison,
    comparison.showCompare
  ]);

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
      handleFileUploadWithStorage(files[0], fileType);
    }
  };

  // Notification helper
  const showNotification = useCallback((message: string, severity: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setNotification({
      open: true,
      message,
      severity
    });
  }, []);

  // Enhanced file upload that saves to localStorage for restore functionality
  const handleFileUploadWithStorage = useCallback(async (file: File, which: "Master" | "Client") => {
    try {
      // Save the file name to localStorage and update state
      if (which === "Master") {
        localStorage.setItem("lastMasterFile", file.name);
        setLastMasterFile(file.name);
      } else {
        localStorage.setItem("lastClientFile", file.name);
        setLastClientFile(file.name);
      }

      // Convert file to base64 for storage
      const reader = new FileReader();
      reader.onload = (evt) => {
        const arrayBuffer = evt.target?.result as ArrayBuffer;
        if (arrayBuffer) {
          // Convert to base64
          const bytes = new Uint8Array(arrayBuffer);
          let binary = '';
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64Data = btoa(binary);

          // Save to localStorage
          if (which === "Master") {
            localStorage.setItem("lastMasterData", base64Data);
            setLastMasterData(base64Data);
          } else {
            localStorage.setItem("lastClientData", base64Data);
            setLastClientData(base64Data);
          }
        }
      };
      reader.readAsArrayBuffer(file);

      // Use the original file upload handler
      await fileOps.handleFileUpload(file, which);

    } catch (error) {
      console.error(`Error uploading ${which} file:`, error);
      showNotification(`Failed to upload ${which} file. Please try again.`, 'error');
    }
  }, [fileOps, showNotification, setLastMasterFile, setLastMasterData, setLastClientFile, setLastClientData]);

  // Close dialog handler (comparison happens automatically)
  const handleStartComparison = () => {
    setModifierDialogOpen(false);
  };

  // Enhanced handlers with loading states and notifications
  const handleLoadSampleDataWithFeedback = useCallback(async (sampleSet: number = 1) => {
    setIsLoadingSample(true);
    try {
      // Load sample data and also save to localStorage for restore functionality
      console.log(`[SAMPLE DATA] Starting to load sample data set ${sampleSet}...`);

      // Define sample file paths for each set
      const sampleSets = {
        1: {
          master: '/sample%20sheets/ED%20Master%20CDM%202025.xlsx',
          client: '/sample%20sheets/Client%20ED%20w%20Hyphens.xlsx',
          masterName: 'ED Master CDM 2025.xlsx',
          clientName: 'Client ED w Hyphens.xlsx'
        },
        2: {
          master: '/sample%20sheets%202/ED%20Master%20CDM%202025.xlsx',
          client: '/sample%20sheets%202/Client%20ED%20-%20no%20Hyphens.xlsx',
          masterName: 'ED Master CDM 2025.xlsx',
          clientName: 'Client ED - no Hyphens.xlsx'
        }
      };

      const selectedSet = sampleSets[sampleSet as keyof typeof sampleSets];
      if (!selectedSet) {
        console.error(`[SAMPLE DATA] Invalid sample set: ${sampleSet}`);
        throw new Error(`Invalid sample set: ${sampleSet}`);
      }

      // Load the sample files in parallel
      const [masterFileResponse, clientFileResponse] = await Promise.all([
        fetch(selectedSet.master),
        fetch(selectedSet.client)
      ]);

      if (!masterFileResponse.ok || !clientFileResponse.ok) {
        console.error(`[SAMPLE DATA] Failed to fetch sample files for set ${sampleSet}`);
        throw new Error(`Failed to load sample files for set ${sampleSet}`);
      }

      const [masterBlob, clientBlob] = await Promise.all([
        masterFileResponse.blob(),
        clientFileResponse.blob()
      ]);

      // Create File objects
      const masterFile = new File([masterBlob], selectedSet.masterName, {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const clientFile = new File([clientBlob], selectedSet.clientName, {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      console.log(`[SAMPLE DATA] Sample files loaded from set ${sampleSet}, processing both files...`);

      // Process both files using our enhanced upload handler that saves to localStorage
      await handleFileUploadWithStorage(masterFile, "Master");
      await handleFileUploadWithStorage(clientFile, "Client");

      console.log('[SAMPLE DATA] File processing initiated...');

      showNotification(`Sample data set ${sampleSet} loaded successfully!`, 'success');
    } catch (error) {
      showNotification('Failed to load sample data. Please try again.', 'error');
      console.error('Load sample data error:', error);
    } finally {
      setIsLoadingSample(false);
    }
  }, [handleFileUploadWithStorage, showNotification]);

  const handleResetWithFeedback = useCallback((type: 'master' | 'client' | 'both') => {
    try {
      switch (type) {
        case 'master':
          fileOps.resetMaster();
          comparison.resetComparison(); // Reset comparison when master data is reset
          showNotification('Master data reset successfully!', 'info');
          break;
        case 'client':
          fileOps.resetClient();
          comparison.resetComparison(); // Reset comparison when client data is reset
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
  }, [fileOps, comparison, showNotification]);

  // Export handler (unified like original implementation)
  const handleExportData = useCallback(() => {
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
  }, [comparison.mergedRows, comparison.unmatchedClient, comparison.dupsClient, fileOps, showNotification]);

  // Restore session functionality
  const restoreFileData = (data: string, which: "Master" | "Client") => {
    console.log(`[DEBUG] Starting restoreFileData for ${which}`);

    try {
      // Convert base64 data back to a File object
      const binaryString = atob(data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Get the original filename from localStorage
      const filenameKey = which === "Master" ? "lastMasterFile" : "lastClientFile";
      const originalFilename = localStorage.getItem(filenameKey) || `${which.toLowerCase()}-file.xlsx`;

      // Create a File object
      const file = new File([bytes], originalFilename, {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      console.log(`[DEBUG] Created File object for ${which}:`, file.name, file.size);

      // Use the existing file upload handler
      fileOps.handleFileUpload(file, which);

      console.log(`[DEBUG] File upload initiated for ${which}`);

    } catch (error) {
      console.error(`[DEBUG] Error restoring ${which} file:`, error);
      throw error;
    }
  };

  const handleLoadLastFile = (which: "Master" | "Client") => {
    if (which === "Master" && lastMasterData && lastMasterFile) {
      console.log('[DEBUG] Loading last master file');
      restoreFileData(lastMasterData, "Master");
      showNotification(`Master file "${lastMasterFile}" restored successfully!`, 'success');
    } else if (which === "Client" && lastClientData && lastClientFile) {
      console.log('[DEBUG] Loading last client file');
      restoreFileData(lastClientData, "Client");
      showNotification(`Client file "${lastClientFile}" restored successfully!`, 'success');
    }
  };

  const handleRestoreSession = () => {
    if (lastMasterData && lastClientData && lastMasterFile && lastClientFile) {
      console.log('[DEBUG] Starting restore session');

      // Process file data
      restoreFileData(lastMasterData, "Master");
      restoreFileData(lastClientData, "Client");

      showNotification('Session restored successfully!', 'success');
      console.log('[DEBUG] Session restore completed');
    }
  };

  const handleClearAllData = () => {
    // First do a normal reset
    handleResetWithFeedback('both');

    // Then clear all localStorage data
    localStorage.removeItem("lastMasterFile");
    localStorage.removeItem("lastMasterData");
    localStorage.removeItem("lastMasterSheet");
    localStorage.removeItem("lastMasterMetadata");
    localStorage.removeItem("lastClientFile");
    localStorage.removeItem("lastClientData");
    localStorage.removeItem("lastClientSheet");
    localStorage.removeItem("lastClientMetadata");

    // Clear the state variables too
    setLastMasterFile(null);
    setLastMasterData(null);
    setLastClientFile(null);
    setLastClientData(null);

    showNotification('All data and session history cleared!', 'info');
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
  }, [fileOps, comparison, router, handleExportData, handleLoadSampleDataWithFeedback, handleResetWithFeedback]);

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

  const handleCreateNewFromRow = (rowId: number | string, gridType: 'master' | 'client' | 'merged') => {
    if (gridType !== 'merged') return; // Only allow creating new from merged rows

    const rowToDuplicate = comparison.mergedRows.find(row => row.id === rowId);
    if (rowToDuplicate) {
      // For create-new mode, we pass the original row and let the modal handle the creation
      setEditingRow(rowToDuplicate);
      setEditingGridType('master'); // Use master columns for editing
      setEditModalTitle('Create New Merged Row');
      setEditModalMode('create-new');
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

  // Row operation handlers for master and client grids
  const handleMasterClientEdit = (rowId: number | string, gridType: 'master' | 'client' | 'merged') => {
    if (gridType === 'merged') return;
    const isMaster = gridType === 'master';
    const rows = isMaster ? fileOps.rowsMaster : fileOps.rowsClient;
    const rowToEdit = rows.find(row => row.id === rowId);

    if (rowToEdit) {
      setEditingRow(rowToEdit);
      setEditingGridType(gridType);
      setEditModalTitle(`Edit ${isMaster ? 'Master' : 'Client'} Row`);
      setEditModalMode('edit');
      setEditModalOpen(true);
    }
  };

  const handleMasterClientCreate = (rowId: number | string, gridType: 'master' | 'client' | 'merged') => {
    if (gridType === 'merged') return;
    const isMaster = gridType === 'master';
    const rows = isMaster ? fileOps.rowsMaster : fileOps.rowsClient;
    const rowToDuplicate = rows.find(row => row.id === rowId);

    if (rowToDuplicate) {
      setEditingRow(rowToDuplicate);
      setEditingGridType(gridType);
      setEditModalTitle(`Create New ${isMaster ? 'Master' : 'Client'} Row`);
      setEditModalMode('create-new');
      setEditModalOpen(true);
    }
  };

  const handleMasterClientDelete = (rowId: number | string, gridType: 'master' | 'client' | 'merged') => {
    if (gridType === 'merged') return;

    if (gridType === 'master') {
      fileOps.setRowsMaster(fileOps.rowsMaster.filter(row => row.id !== rowId));
    } else {
      fileOps.setRowsClient(fileOps.rowsClient.filter(row => row.id !== rowId));
    }

    // No manual re-comparison needed - useEffect will handle it when state updates
  };

  const handleSaveEditedRow = (updatedRow: ExcelRow) => {
    const isMaster = editingGridType === 'master';
    const isClient = editingGridType === 'client';

    if (!isMaster && !isClient) { // Merged grid
      if (editModalMode === 'create-new') {
        const newRow = { ...updatedRow, id: Date.now() };
        comparison.setMergedRows([...comparison.mergedRows, newRow]);
      } else {
        const updatedMergedRows = comparison.mergedRows.map(row =>
          row.id === updatedRow.id ? updatedRow : row
        );
        comparison.setMergedRows(updatedMergedRows);
      }
      return;
    }

    const rows = isMaster ? fileOps.rowsMaster : fileOps.rowsClient;
    const setRows = isMaster ? fileOps.setRowsMaster : fileOps.setRowsClient;

    if (editModalMode === 'create-new') {
      const newRow = { ...updatedRow, id: Date.now() };
      setRows([...rows, newRow]);
    } else {
      const updatedRows = rows.map(row =>
        row.id === updatedRow.id ? updatedRow : row
      );
      setRows(updatedRows);
    }

    // No manual re-comparison needed - useEffect will handle it when state updates
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

        {/* Restore Session Buttons */}
        {(lastMasterData || lastClientData) && (
          <Box sx={{
            display: "flex",
            justifyContent: "center",
            gap: 2,
            mb: 2,
            flexWrap: "wrap",
            p: 1,
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            borderRadius: 1,
            border: '1px solid #e0e0e0'
          }}>
            {lastMasterData && lastClientData && lastMasterFile && lastClientFile && (
              <Button
                variant="contained"
                color="success"
                onClick={handleRestoreSession}
                size="small"
                sx={{ fontSize: '0.75rem' }}
              >
                Restore Last Session
              </Button>
            )}
            <Tooltip title={lastMasterFile ? `Load last master file: ${lastMasterFile}` : "No master file in memory"}>
              <span>
                <Button
                  variant="outlined"
                  onClick={() => handleLoadLastFile("Master")}
                  disabled={!lastMasterData || !lastMasterFile}
                  size="small"
                  sx={{ fontSize: '0.75rem' }}
                >
                  Load Last Master
                </Button>
              </span>
            </Tooltip>
            <Tooltip title={lastClientFile ? `Load last client file: ${lastClientFile}` : "No client file in memory"}>
              <span>
                <Button
                  variant="outlined"
                  onClick={() => handleLoadLastFile("Client")}
                  disabled={!lastClientData || !lastClientFile}
                  size="small"
                  sx={{ fontSize: '0.75rem' }}
                >
                  Load Last Client
                </Button>
              </span>
            </Tooltip>
            <Button
              variant="contained"
              onClick={handleClearAllData}
              color="error"
              size="small"
              sx={{ fontSize: '0.75rem' }}
            >
              Clear All Data
            </Button>
          </Box>
        )}

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
                onFileUpload={handleFileUploadWithStorage}
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
                onRowUpdate={handleMasterRowUpdateWithRecompare}
                enableRowActions={true}
                onEditRow={handleMasterClientEdit}
                onCreateNewFromRow={handleMasterClientCreate}
                onDeleteRow={handleMasterClientDelete}
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
                onFileUpload={handleFileUploadWithStorage}
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
                onRowUpdate={handleClientRowUpdateWithRecompare}
                enableRowActions={true}
                onEditRow={handleMasterClientEdit}
                onCreateNewFromRow={handleMasterClientCreate}
                onDeleteRow={handleMasterClientDelete}
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
              onCreateNewFromRow={handleCreateNewFromRow}
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
          useNewHyphenAlgorithm={useNewHyphenAlgorithm}
          onHyphenAlgorithmChange={setUseNewHyphenAlgorithm}
        />

        {/* Row Edit Modal */}
        <ImprovedRowEditModal
          open={editModalOpen}
          row={editingRow}
          columns={
            editingGridType === 'master' ? fileOps.columnsMaster :
            editingGridType === 'client' ? fileOps.columnsClient :
            comparison.mergedColumns
          }
          mode={editModalMode === 'duplicate' ? 'create-new' : editModalMode}
          title={editModalTitle}
          onClose={handleCloseEditModal}
          onSave={handleSaveEditedRow}
          existingRows={
            editingGridType === 'master' ? fileOps.rowsMaster :
            editingGridType === 'client' ? fileOps.rowsClient :
            comparison.mergedRows
          }
          hcpcsColumn={
            (editingGridType === 'master' ? fileOps.columnsMaster :
             editingGridType === 'client' ? fileOps.columnsClient :
             comparison.mergedColumns)
            .find(col => col.field.toLowerCase().includes('hcpcs'))?.field
          }
          modifierColumn={
            (editingGridType === 'master' ? fileOps.columnsMaster :
             editingGridType === 'client' ? fileOps.columnsClient :
             comparison.mergedColumns)
            .find(col => col.field.toLowerCase().includes('modifier'))?.field
          }
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

        </Box>
      </Box>
    </NoSSR>
  );
}
