import * as XLSX from "xlsx";

interface ExcelRow {
  id: number;
  [key: string]: string | number | undefined;
}

interface FileMetadata {
  name: string;
  size: number;
  uploadTime: Date;
  sheetCount: number;
  recordCount: number;
  columnCount: number;
}

interface MergedSheetInfo {
  masterSheet: string;
  clientSheet: string;
}

export const createExportHandlers = (
  mergedForExport: ExcelRow[],
  unmatchedClient: ExcelRow[],
  dupsClient: ExcelRow[],
  lastClientFile: string | null,
  clientFileMetadata: FileMetadata | null,
  mergedSheetInfo: MergedSheetInfo | null
) => {
  const handleExport = () => {
    if (mergedForExport.length === 0) return;
    
    // Use client filename, add sheet name if multiple sheets, add datetime suffix
    const clientName = lastClientFile ? lastClientFile.replace('.xlsx', '').replace('.xls', '') : 'merged_data';
    const clientSheetCount = clientFileMetadata?.sheetCount || 1;
    const timestamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(/:/g, '');
    
    let filename = `${clientName}_${timestamp}.xlsx`;
    if (clientSheetCount > 1 && mergedSheetInfo?.clientSheet) {
      const sheetName = mergedSheetInfo.clientSheet.replace(/[^a-zA-Z0-9\s-_]/g, '').replace(/\s+/g, '_');
      filename = `${clientName}_${sheetName}_${timestamp}.xlsx`;
    }
    
    const wb = XLSX.utils.book_new();
    const clean = (rows: ExcelRow[]) => rows.map(row => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, ...rest } = row;
      return rest;
    });
    const ws = XLSX.utils.json_to_sheet(clean(mergedForExport));
    XLSX.utils.book_append_sheet(wb, ws, "Merged");
    
    // Always include Unmatched_Client sheet, even if empty
    const wsErrors = XLSX.utils.json_to_sheet(clean(unmatchedClient));
    XLSX.utils.book_append_sheet(wb, wsErrors, "Unmatched_Client");
    
    // Always include Duplicate_Client sheet, even if empty
    const wsDups = XLSX.utils.json_to_sheet(clean(dupsClient));
    XLSX.utils.book_append_sheet(wb, wsDups, "Duplicate_Client");
    XLSX.writeFile(wb, filename);
  };

  const handleExportWithFilename = (customFilename: string) => {
    if (mergedForExport.length === 0) return;
    
    // Clean the filename and ensure it has .xlsx extension
    let filename = customFilename.trim();
    if (!filename.toLowerCase().endsWith('.xlsx') && !filename.toLowerCase().endsWith('.xls')) {
      filename += '.xlsx';
    }
    
    // Remove any invalid characters for filename
    filename = filename.replace(/[<>:"/\\|?*]/g, '_');
    
    const wb = XLSX.utils.book_new();
    const clean = (rows: ExcelRow[]) => rows.map(row => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, ...rest } = row;
      return rest;
    });
    const ws = XLSX.utils.json_to_sheet(clean(mergedForExport));
    XLSX.utils.book_append_sheet(wb, ws, "Merged");
    
    // Always include Unmatched_Client sheet, even if empty
    const wsErrors = XLSX.utils.json_to_sheet(clean(unmatchedClient));
    XLSX.utils.book_append_sheet(wb, wsErrors, "Unmatched_Client");
    
    // Always include Duplicate_Client sheet, even if empty
    const wsDups = XLSX.utils.json_to_sheet(clean(dupsClient));
    XLSX.utils.book_append_sheet(wb, wsDups, "Duplicate_Client");
    XLSX.writeFile(wb, filename);
  };

  return {
    handleExport,
    handleExportWithFilename
  };
};