import { GridColDef } from "@mui/x-data-grid";

interface ExcelRow {
  id: number;
  [key: string]: string | number | undefined;
}

interface ComparisonStats {
  totalMasterRecords: number;
  totalClientRecords: number;
  matchedRecords: number;
  unmatchedRecords: number;
  duplicateRecords: number;
  matchRate: number;
  processingTime: number;
  columnsMatched: number;
  totalMasterColumns: number;
  totalClientColumns: number;
}

interface ModifierCriteria {
  root00: boolean;
  root25: boolean;
  ignoreTrauma: boolean;
  root50: boolean;
  root59: boolean;
  rootXU: boolean;
  root76: boolean;
}

interface DataComparisonCallbacks {
  setMergedSheetInfo: (info: {masterSheet: string, clientSheet: string}) => void;
  setShowCompare: (show: boolean) => void;
  setMergedRows: (rows: ExcelRow[]) => void;
  setMergedColumns: (columns: GridColDef[]) => void;
  setUnmatchedClient: (rows: ExcelRow[]) => void;
  setDupsClient: (rows: ExcelRow[]) => void;
  setMergedForExport: (rows: ExcelRow[]) => void;
  setComparisonStats: (stats: ComparisonStats) => void;
  getHCPCSColumnMaster: () => string | null;
  getHCPCSColumnClient: () => string | null;
  getModifierColumnMaster: () => string | null;
  getModifierColumnClient: () => string | null;
  getDescriptionCol: (columns: GridColDef[]) => string | null;
  parseHCPCS: (row: ExcelRow, hcpcsCol: string, modifierCol: string | null) => { root: string, modifier: string };
  setHcpcsDefaultSorting: () => void;
}

export const createDataComparisonHandler = (
  rowsMaster: ExcelRow[],
  rowsClient: ExcelRow[],
  columnsMaster: GridColDef[],
  columnsClient: GridColDef[],
  masterSheetNames: string[],
  clientSheetNames: string[],
  activeMasterTab: number,
  activeClientTab: number,
  modifierCriteria: ModifierCriteria,
  callbacks: DataComparisonCallbacks
) => {
  return () => {
    // Start timing the comparison
    const startTime = performance.now();
    
    // Save which sheets are being used for this merge
    const currentMasterSheet = masterSheetNames[activeMasterTab] || 'Unknown';
    const currentClientSheet = clientSheetNames[activeClientTab] || 'Unknown';
    callbacks.setMergedSheetInfo({ masterSheet: currentMasterSheet, clientSheet: currentClientSheet });
    const hcpcsColMaster = callbacks.getHCPCSColumnMaster();
    const hcpcsColClient = callbacks.getHCPCSColumnClient();
    const modifierColMaster = callbacks.getModifierColumnMaster();
    const modifierColClient = callbacks.getModifierColumnClient();
    if (!hcpcsColMaster || !hcpcsColClient) {
      callbacks.setShowCompare(false);
      console.error('Both files must have a "HCPCS" column to compare.');
      return;
    }
    const descColMaster = callbacks.getDescriptionCol(columnsMaster);
    const descColClient = callbacks.getDescriptionCol(columnsClient);

    // Diagnostics: log columns and sample rows
    console.log("[DIAG] columnsMaster:", columnsMaster.map(c => c.field));
    console.log("[DIAG] columnsClient:", columnsClient.map(c => c.field));
    console.log("[DIAG] hcpcsColMaster:", hcpcsColMaster, ", hcpcsColClient:", hcpcsColClient, ", modifierColMaster:", modifierColMaster, ", modifierColClient:", modifierColClient);
    if (rowsMaster.length > 0) console.log("[DIAG] Sample rowMaster:", rowsMaster[0]);
    if (rowsClient.length > 0) console.log("[DIAG] Sample rowClient:", rowsClient[0]);

    function getCompareKey(row: ExcelRow, hcpcsCol: string, modifierCol: string | null): string {
      const { root, modifier } = callbacks.parseHCPCS(row, hcpcsCol, modifierCol);
      const modMap = [
        { flag: modifierCriteria.root00, mod: "00" },
        { flag: modifierCriteria.root25, mod: "25" },
        { flag: modifierCriteria.root50, mod: "50" },
        { flag: modifierCriteria.root59, mod: "59" },
        { flag: modifierCriteria.rootXU, mod: "XU" },
        { flag: modifierCriteria.root76, mod: "76" },
      ];
      const anyModifierChecked = modMap.some(({ flag }) => flag);
      const cleanModifier = (modifier || "").trim();
      const key = !anyModifierChecked
        ? (cleanModifier ? `${root}-${cleanModifier}` : root)
        : (modMap.some(({ flag, mod }) => flag && cleanModifier === mod) ? root : (cleanModifier ? `${root}-${cleanModifier}` : root));
      // Diagnostics: log key for first 5 rows
      if (row.id < 5) {
        console.log(`[DIAG] Row id=${row.id}, root='${root}', modifier='${modifier}', cleanModifier='${cleanModifier}', key='${key}', hcpcsCol='${hcpcsCol}'`);
      }
      return key;
    }

    function filterTrauma(rows: ExcelRow[], descCol: string | null): ExcelRow[] {
      if (!modifierCriteria.ignoreTrauma || !descCol) return rows;
      return rows.filter(row => {
        const desc = String(row[descCol] || "").toLowerCase();
        return !desc.includes("trauma");
      });
    }

    const filteredMaster = filterTrauma(rowsMaster, descColMaster);
    const filteredClient = filterTrauma(rowsClient, descColClient);

    console.log(`[DIAG] Before filtering: Master=${rowsMaster.length}, Client=${rowsClient.length}`);
    console.log(`[DIAG] After filtering: Master=${filteredMaster.length}, Client=${filteredClient.length}`);

    const clientMap = new Map<string, ExcelRow>();
    filteredClient.forEach(row => {
      const key = getCompareKey(row, hcpcsColClient, modifierColClient);
      if (clientMap.has(key)) {
        console.log(`[DIAG] Duplicate key in client: ${key}`);
      }
      clientMap.set(key, row);
    });

    console.log(`[DIAG] clientMap size: ${clientMap.size}`);

    const mergedRows: ExcelRow[] = [];
    const unmatchedMasterRows: ExcelRow[] = [];

    filteredMaster.forEach(masterRow => {
      const masterKey = getCompareKey(masterRow, hcpcsColMaster, modifierColMaster);
      const clientRow = clientMap.get(masterKey);
      if (clientRow) {
        const mergedRow: ExcelRow = { ...masterRow };
        for (const [masterField, clientField] of Object.entries(columnMapping)) {
          if (clientRow[clientField] !== undefined) {
            mergedRow[`client_${masterField}`] = clientRow[clientField];
          }
        }
        mergedRows.push(mergedRow);
      } else {
        unmatchedMasterRows.push(masterRow);
      }
    });

    const unmatchedClientRows: ExcelRow[] = [];
    const duplicateClientRows: ExcelRow[] = [];
    const seenClientKeys = new Set<string>();

    filteredClient.forEach(clientRow => {
      const clientKey = getCompareKey(clientRow, hcpcsColClient, modifierColClient);
      if (seenClientKeys.has(clientKey)) {
        duplicateClientRows.push(clientRow);
      } else {
        seenClientKeys.add(clientKey);
        const hasMatch = filteredMaster.some(masterRow => {
          const masterKey = getCompareKey(masterRow, hcpcsColMaster, modifierColMaster);
          return masterKey === clientKey;
        });
        if (!hasMatch) {
          unmatchedClientRows.push(clientRow);
        }
      }
    });

    console.log(`[DIAG] Final counts: Merged=${mergedRows.length}, UnmatchedMaster=${unmatchedMasterRows.length}, UnmatchedClient=${unmatchedClientRows.length}, Duplicates=${duplicateClientRows.length}`);

    const columnMapping: { [masterField: string]: string } = {};
    columnsMaster.forEach(masterCol => {
      const masterField = masterCol.field;
      const clientCol = columnsClient.find(clientCol => {
        const clientField = clientCol.field;
        return clientField === masterField ||
               clientField.toLowerCase() === masterField.toLowerCase() ||
               clientField.toLowerCase().replace(/[\s_]/g, '') === masterField.toLowerCase().replace(/[\s_]/g, '');
      });
      if (clientCol) {
        columnMapping[masterField] = clientCol.field;
      }
    });

    const mergedColumns: GridColDef[] = [
      ...columnsMaster.map(col => ({ ...col, editable: true })),
      ...columnsMaster.map(col => ({
        field: `client_${col.field}`,
        headerName: `Client ${col.headerName || col.field}`,
        width: 150,
        editable: true,
      })).filter(col => columnMapping[col.field.replace('client_', '')]),
    ];

    callbacks.setMergedRows(mergedRows);
    callbacks.setMergedColumns(mergedColumns);
    callbacks.setUnmatchedClient(unmatchedClientRows);
    callbacks.setDupsClient(duplicateClientRows);
    callbacks.setMergedForExport(mergedRows);

    const endTime = performance.now();
    const processingTime = Math.round(endTime - startTime);

    const stats: ComparisonStats = {
      totalMasterRecords: filteredMaster.length,
      totalClientRecords: filteredClient.length,
      matchedRecords: mergedRows.length,
      unmatchedRecords: unmatchedMasterRows.length + unmatchedClientRows.length,
      duplicateRecords: duplicateClientRows.length,
      matchRate: Math.round((mergedRows.length / filteredMaster.length) * 100) || 0,
      processingTime,
      columnsMatched: Object.keys(columnMapping).length,
      totalMasterColumns: columnsMaster.length,
      totalClientColumns: columnsClient.length,
    };

    callbacks.setComparisonStats(stats);
    callbacks.setShowCompare(true);

    setTimeout(() => {
      callbacks.setHcpcsDefaultSorting();
    }, 100);
  };
};