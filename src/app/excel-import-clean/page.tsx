"use client";
import React, { useState, useEffect } from "react";
import { Button, Box, Typography } from "@mui/material";
import { useRouter } from "next/navigation";

import dynamic from 'next/dynamic';
import { ModifierCriteria } from "../../utils/excelOperations";
import { useFileOperations } from "../../hooks/useFileOperations";
import { useComparison } from "../../hooks/useComparison";
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
  const [modifierCriteria, setModifierCriteria] = useState<ModifierCriteria>({
    root00: true,
    root25: true,
    ignoreTrauma: false,
    root50: false,
    root59: false,
    rootXU: false,
    root76: false,
  });

  // Hidden keyboard shortcut to toggle UI (Ctrl+Shift+U)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'U') {
        event.preventDefault();
        router.push('/excel-import');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [router]);

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

  // Comparison handler
  const handleStartComparison = () => {
    comparison.performComparison(
      fileOps.rowsMaster,
      fileOps.columnsMaster,
      fileOps.rowsClient,
      fileOps.columnsClient,
      modifierCriteria
    );
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
        p: 4,
        background: 'linear-gradient(135deg, #f8fbff 0%, #e3f2fd 50%, #f0f8ff 100%)',
        minHeight: '100vh'
      }}>


        {/* Welcome Section */}
        <WelcomeSection onLoadSampleData={fileOps.handleLoadSampleData} />
        
        {/* Master Section */}
        <Box sx={{ mb: 4 }}>
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
            />
          )}
        </Box>

        {/* Client Section */}
        <Box sx={{ mb: 4 }}>
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
            />
          )}
        </Box>

        {/* Compare Button */}
        {fileOps.rowsMaster.length > 0 && fileOps.rowsClient.length > 0 && (
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Button
              variant="contained"
              size="large"
              onClick={() => setModifierDialogOpen(true)}
              sx={{
                fontSize: '1.2rem',
                py: 2,
                px: 4,
                background: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)',
                boxShadow: '0 3px 5px 2px rgba(25, 118, 210, .3)',
              }}
            >
              🔄 Compare & Merge Data
            </Button>
          </Box>
        )}



        {/* Comparison Results */}
        {comparison.showCompare && (
          <ComparisonResults
            mergedRows={comparison.mergedRows}
            mergedColumns={comparison.mergedColumns}
            unmatchedClient={comparison.unmatchedClient}
            dupsClient={comparison.dupsClient}
            columnsClient={fileOps.columnsClient}
            comparisonStats={comparison.comparisonStats}
            onExport={handleExportData}
          />
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
          mt: 6,
          pt: 4,
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
            onClick={() => router.push('/excel-import')}
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
