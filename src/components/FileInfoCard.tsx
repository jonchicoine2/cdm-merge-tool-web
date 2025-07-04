"use client";
import React from "react";
import { Box, Typography, Chip } from "@mui/material";

export interface FileMetadata {
  name: string;
  size: number;
  uploadTime: Date;
  sheetCount: number;
  recordCount: number;
  columnCount: number;
}

interface FileInfoCardProps {
  metadata: FileMetadata | null;
  type: "Master" | "Client";
}

// Helper function to format file sizes in a human-friendly way
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

/**
 * FileInfoCard
 * -------------
 * Displays basic statistics about an uploaded Excel file (name, size, sheets, records, etc.)
 * with consistent styling.  Extracted from the original ExcelImportPage to keep that file small.
 */
const FileInfoCard: React.FC<FileInfoCardProps> = ({ metadata, type }) => {
  // Avoid rendering on the server
  if (typeof window === "undefined") {
    return null;
  }

  if (!metadata) {
    return null;
  }

  return (
    <Box
      sx={{
        mb: 1,
        p: 1.5,
        backgroundColor: "#f8fbff",
        border: "2px solid #2196f3",
        borderRadius: 1,
        display: "flex",
        alignItems: "center",
        gap: 2,
        flexWrap: "wrap",
      }}
    >
      <Typography
        variant="body2"
        sx={{
          fontWeight: "bold",
          color: "#1976d2",
          minWidth: "120px",
        }}
      >
        📄 {metadata.name}
      </Typography>

      <Chip
        size="small"
        label={formatFileSize(metadata.size)}
        sx={{
          backgroundColor: "#1976d2",
          color: "white",
          fontSize: "0.75rem",
          height: "24px",
        }}
      />

      <Chip
        size="small"
        label={`${metadata.sheetCount} sheet${metadata.sheetCount !== 1 ? "s" : ""}`}
        sx={{
          backgroundColor: "#4caf50",
          color: "white",
          fontSize: "0.75rem",
          height: "24px",
        }}
      />

      <Chip
        size="small"
        label={`${metadata.recordCount.toLocaleString()} records`}
        sx={{
          backgroundColor: "#ff9800",
          color: "white",
          fontSize: "0.75rem",
          height: "24px",
        }}
      />

      <Typography
        variant="caption"
        sx={{
          color: "#666",
          ml: "auto",
        }}
      >
        {metadata.uploadTime.toLocaleTimeString()}
      </Typography>
    </Box>
  );
};

export default FileInfoCard;