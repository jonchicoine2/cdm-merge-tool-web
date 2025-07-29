"use client";
import React, { useState, useEffect, useCallback } from "react";
import { Button, Box, Typography } from "@mui/material";
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
  const [modifierCriteria, setModifierCriteria] = useState<ModifierCriteria>({
    root00: false,
    root25: false,
    ignoreTrauma: false,
    root50: false,
    root59: false,
    rootXU: false,
    root76: false,
  });

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
  }, [loadSharedDataToState]); // Include loadSharedDataToState in dependencies

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
  }, [isLoadingSharedData, fileOps.rowsMaster, fileOps.rowsClient, fileOps.columnsMaster, fileOps.columnsClient, modifierCriteria, comparison]);

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

  // Export handler (unified like original implementation)
  const handleExportData = () => {
    fileOps.handleExport(
      comparison.mergedRows,
      comparison.unmatchedClient,
      comparison.dupsClient
    );
  };

  return (
    <NoSSR>
      <Box sx={{
        p: 2,
        background: 'linear-gradient(135deg, #f8fbff 0%, #e3f2fd 50%, #f0f8ff 100%)',
        minHeight: '100vh'
      }}>


        {/* Welcome Section */}
        <WelcomeSection onLoadSampleData={fileOps.handleLoadSampleData} />

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

        {/* Reset and Compare Buttons - Compact Layout */}
        {(fileOps.rowsMaster.length > 0 || fileOps.rowsClient.length > 0) && (
          <Box sx={{
            display: 'flex',
            gap: 1,
            justifyContent: 'center',
            flexWrap: 'wrap',
            mb: 1.5,
            alignItems: 'center'
          }}>
            {fileOps.rowsMaster.length > 0 && (
              <Button
                variant="outlined"
                color="error"
                size="small"
                onClick={() => {
                  fileOps.resetMaster();
                  comparison.resetComparison();
                }}
                sx={{ fontSize: '0.8rem', py: 0.5, px: 1.5 }}
              >
                🗑️ Reset Master
              </Button>
            )}
            {fileOps.rowsClient.length > 0 && (
              <Button
                variant="outlined"
                color="error"
                size="small"
                onClick={() => {
                  fileOps.resetClient();
                  comparison.resetComparison();
                }}
                sx={{ fontSize: '0.8rem', py: 0.5, px: 1.5 }}
              >
                🗑️ Reset Client
              </Button>
            )}
            <Button
              variant="outlined"
              color="secondary"
              size="small"
              onClick={() => {
                fileOps.resetBoth();
                comparison.resetComparison();
              }}
              sx={{ fontSize: '0.8rem', py: 0.5, px: 1.5 }}
            >
              🔄 Reset Both
            </Button>
            {fileOps.rowsMaster.length > 0 && fileOps.rowsClient.length > 0 && (
              <Button
                variant="outlined"
                size="small"
                onClick={() => setModifierDialogOpen(true)}
                sx={{ fontSize: '0.8rem', py: 0.5, px: 1.5 }}
              >
                ⚙️ Adjust Modifier Criteria
              </Button>
            )}
          </Box>
        )}



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
