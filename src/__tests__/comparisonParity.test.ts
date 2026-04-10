import { GridColDef } from '@mui/x-data-grid-pro';
import { compareDatasets } from '../hooks/useComparison';
import { ExcelRow, ModifierCriteria } from '../utils/excelOperations';

const baseCriteria: ModifierCriteria = {
  root00: false,
  root25: false,
  ignoreTrauma: false,
  root50: false,
  root59: false,
  rootXU: false,
  root76: false,
};

const masterColumns: GridColDef[] = [
  { field: 'HCPCS', headerName: 'HCPCS' },
  { field: 'CDM', headerName: 'CDM' },
  { field: 'Description', headerName: 'Description' },
  { field: 'Qty', headerName: 'Qty' },
  { field: 'PhysicianCDM', headerName: 'Physician CDM' },
  { field: 'RevenueCode', headerName: 'Revenue Code' },
];

const clientColumns: GridColDef[] = [
  { field: 'HCPCS', headerName: 'HCPCS' },
  { field: 'CDM', headerName: 'CDM' },
  { field: 'Description', headerName: 'Description' },
  { field: 'Qty', headerName: 'Qty' },
  { field: 'PhysicianCDM', headerName: 'Physician CDM' },
  { field: 'RevenueCode', headerName: 'Revenue Code' },
];

describe('comparison parity behavior', () => {
  test('only fills legacy writable fields from client data', () => {
    const rowsMaster: ExcelRow[] = [
      {
        id: 1,
        HCPCS: '99283',
        CDM: '',
        Description: 'Master description',
        Qty: '',
        PhysicianCDM: '',
        RevenueCode: '0450',
      },
    ];

    const rowsClient: ExcelRow[] = [
      {
        id: 10,
        HCPCS: '99283',
        CDM: 'CLIENT-CDM',
        Description: 'Client description',
        Qty: '3',
        PhysicianCDM: 'CLIENT-PHYS',
        RevenueCode: '0999',
      },
    ];

    const result = compareDatasets(
      rowsMaster,
      masterColumns,
      rowsClient,
      clientColumns,
      baseCriteria
    );

    expect(result.mergedRows).toHaveLength(1);
    expect(result.mergedRows[0].CDM).toBe('CLIENT-CDM');
    expect(result.mergedRows[0].PhysicianCDM).toBe('CLIENT-PHYS');
    expect(result.mergedRows[0].Qty).toBe('3');
    expect(result.mergedRows[0].Description).toBe('Master description');
    expect(result.mergedRows[0].RevenueCode).toBe('0450');
  });

  test('does not overwrite existing master CDM values', () => {
    const rowsMaster: ExcelRow[] = [
      {
        id: 1,
        HCPCS: '99283',
        CDM: 'MASTER-CDM',
        Description: 'Master description',
        Qty: '',
        PhysicianCDM: 'MASTER-PHYS',
      },
    ];

    const rowsClient: ExcelRow[] = [
      {
        id: 10,
        HCPCS: '99283',
        CDM: 'CLIENT-CDM',
        Description: 'Client description',
        Qty: '4',
        PhysicianCDM: 'CLIENT-PHYS',
      },
    ];

    const result = compareDatasets(
      rowsMaster,
      masterColumns,
      rowsClient,
      clientColumns,
      baseCriteria
    );

    expect(result.mergedRows[0].CDM).toBe('MASTER-CDM');
    expect(result.mergedRows[0].PhysicianCDM).toBe('MASTER-PHYS');
    expect(result.mergedRows[0].Qty).toBe('4');
  });

  test('root25 still allows modifier-to-root matching when enabled', () => {
    const rowsMaster: ExcelRow[] = [
      {
        id: 1,
        HCPCS: '99283',
        CDM: '',
        Description: 'Master description',
        Qty: '',
        PhysicianCDM: '',
      },
    ];

    const rowsClient: ExcelRow[] = [
      {
        id: 10,
        HCPCS: '99283-25',
        CDM: 'CLIENT-CDM',
        Description: 'Client description',
        Qty: '2',
        PhysicianCDM: '',
      },
    ];

    const result = compareDatasets(
      rowsMaster,
      masterColumns,
      rowsClient,
      clientColumns,
      { ...baseCriteria, root25: true }
    );

    expect(result.comparisonStats.matchedRecords).toBe(1);
    expect(result.mergedRows[0].CDM).toBe('CLIENT-CDM');
    expect(result.unmatchedClient).toHaveLength(0);
  });

  test('duplicate client rows are reported and do not update the master row', () => {
    const rowsMaster: ExcelRow[] = [
      {
        id: 1,
        HCPCS: '99283',
        CDM: '',
        Description: 'Master description',
        Qty: '',
        PhysicianCDM: '',
      },
    ];

    const rowsClient: ExcelRow[] = [
      {
        id: 10,
        HCPCS: '99283',
        CDM: 'CLIENT-CDM-1',
        Description: 'Client description 1',
        Qty: '2',
        PhysicianCDM: '',
      },
      {
        id: 11,
        HCPCS: '99283',
        CDM: 'CLIENT-CDM-2',
        Description: 'Client description 2',
        Qty: '3',
        PhysicianCDM: '',
      },
    ];

    const result = compareDatasets(
      rowsMaster,
      masterColumns,
      rowsClient,
      clientColumns,
      baseCriteria
    );

    expect(result.mergedRows[0].CDM).toBe('');
    expect(result.dupsClient).toHaveLength(2);
    expect(result.unmatchedClient).toHaveLength(0);
    expect(result.comparisonStats.matchedRecords).toBe(0);
    expect(result.comparisonStats.duplicateRecords).toBe(2);
  });

  test('duplicate root rows suppress an exact modifier match', () => {
    const rowsMaster: ExcelRow[] = [
      {
        id: 1,
        HCPCS: '99281-00',
        CDM: '',
        Description: 'Master description',
        Qty: '',
        PhysicianCDM: '',
      },
    ];

    const rowsClient: ExcelRow[] = [
      {
        id: 10,
        HCPCS: '99281',
        CDM: 'ROOT-CDM-1',
        Description: 'Root row 1',
        Qty: '1',
        PhysicianCDM: '',
      },
      {
        id: 11,
        HCPCS: '99281',
        CDM: 'ROOT-CDM-2',
        Description: 'Root row 2',
        Qty: '1',
        PhysicianCDM: '',
      },
      {
        id: 12,
        HCPCS: '99281-00',
        CDM: 'EXACT-CDM',
        Description: 'Exact modifier row',
        Qty: '1',
        PhysicianCDM: '',
      },
    ];

    const result = compareDatasets(
      rowsMaster,
      masterColumns,
      rowsClient,
      clientColumns,
      baseCriteria
    );

    expect(result.mergedRows[0].CDM).toBe('');
    expect(result.dupsClient).toHaveLength(2);
    expect(result.dupsClient.map(row => row.HCPCS)).toEqual(['99281', '99281']);
    expect(result.comparisonStats.matchedRecords).toBe(0);
  });

  test('duplicate rows without a master match stay unmatched instead of duplicate-reviewed', () => {
    const rowsMaster: ExcelRow[] = [
      {
        id: 1,
        HCPCS: '99283',
        CDM: '',
        Description: 'Master description',
        Qty: '',
        PhysicianCDM: '',
      },
    ];

    const rowsClient: ExcelRow[] = [
      {
        id: 10,
        HCPCS: '77777',
        CDM: 'CLIENT-CDM-1',
        Description: 'Client description 1',
        Qty: '2',
        PhysicianCDM: '',
      },
      {
        id: 11,
        HCPCS: '77777',
        CDM: 'CLIENT-CDM-2',
        Description: 'Client description 2',
        Qty: '3',
        PhysicianCDM: '',
      },
    ];

    const result = compareDatasets(
      rowsMaster,
      masterColumns,
      rowsClient,
      clientColumns,
      baseCriteria
    );

    expect(result.dupsClient).toHaveLength(0);
    expect(result.unmatchedClient).toHaveLength(2);
    expect(result.comparisonStats.duplicateRecords).toBe(0);
  });

  test('ignoreTrauma blocks exact trauma-root updates without modifiers', () => {
    const rowsMaster: ExcelRow[] = [
      {
        id: 1,
        HCPCS: '99284',
        CDM: '',
        Description: 'Master trauma description',
        Qty: '',
        PhysicianCDM: '',
      },
    ];

    const rowsClient: ExcelRow[] = [
      {
        id: 10,
        HCPCS: '99284',
        CDM: 'TRAUMA-CDM',
        Description: 'Client trauma description',
        Qty: '1',
        PhysicianCDM: '',
      },
    ];

    const result = compareDatasets(
      rowsMaster,
      masterColumns,
      rowsClient,
      clientColumns,
      { ...baseCriteria, ignoreTrauma: true }
    );

    expect(result.mergedRows[0].CDM).toBe('');
    expect(result.comparisonStats.matchedRecords).toBe(0);
    expect(result.unmatchedClient).toHaveLength(0);
  });

  test('ignoreTrauma still allows root-to-modifier trauma updates when the modifier option is enabled', () => {
    const rowsMaster: ExcelRow[] = [
      {
        id: 1,
        HCPCS: '99284-25',
        CDM: '',
        Description: 'Master trauma modifier description',
        Qty: '',
        PhysicianCDM: '',
      },
    ];

    const rowsClient: ExcelRow[] = [
      {
        id: 10,
        HCPCS: '99284',
        CDM: 'TRAUMA-CDM',
        Description: 'Client trauma description',
        Qty: '2',
        PhysicianCDM: '',
      },
    ];

    const result = compareDatasets(
      rowsMaster,
      masterColumns,
      rowsClient,
      clientColumns,
      { ...baseCriteria, ignoreTrauma: true, root25: true }
    );

    expect(result.mergedRows[0].CDM).toBe('TRAUMA-CDM');
    expect(result.mergedRows[0].Qty).toBe('2');
    expect(result.comparisonStats.matchedRecords).toBe(1);
  });

  test('uppercase multiplier codes use the multiplier when client quantity is blank or too small', () => {
    const rowsMaster: ExcelRow[] = [
      {
        id: 1,
        HCPCS: 'J1234X10',
        CDM: '',
        Description: 'Master multiplier description',
        Qty: '',
        PhysicianCDM: '',
      },
      {
        id: 2,
        HCPCS: 'J1234X10',
        CDM: '',
        Description: 'Master multiplier description',
        Qty: '',
        PhysicianCDM: '',
      },
    ];

    const rowsClient: ExcelRow[] = [
      {
        id: 10,
        HCPCS: 'J1234',
        CDM: 'CLIENT-CDM-A',
        Description: 'Client multiplier description',
        Qty: '',
        PhysicianCDM: '',
      },
      {
        id: 11,
        HCPCS: 'J1234',
        CDM: 'CLIENT-CDM-B',
        Description: 'Client multiplier description',
        Qty: '7',
        PhysicianCDM: '',
      },
    ];

    const firstResult = compareDatasets(
      [rowsMaster[0]],
      masterColumns,
      [rowsClient[0]],
      clientColumns,
      baseCriteria
    );

    const secondResult = compareDatasets(
      [rowsMaster[1]],
      masterColumns,
      [rowsClient[1]],
      clientColumns,
      baseCriteria
    );

    expect(firstResult.mergedRows[0].CDM).toBe('CLIENT-CDM-A');
    expect(firstResult.mergedRows[0].Qty).toBe(10);
    expect(secondResult.mergedRows[0].CDM).toBe('CLIENT-CDM-B');
    expect(secondResult.mergedRows[0].Qty).toBe(10);
  });

  test('multiplier codes keep the client quantity when it is higher than the multiplier', () => {
    const rowsMaster: ExcelRow[] = [
      {
        id: 1,
        HCPCS: 'J1234X10',
        CDM: '',
        Description: 'Master multiplier description',
        Qty: '',
        PhysicianCDM: '',
      },
    ];

    const rowsClient: ExcelRow[] = [
      {
        id: 10,
        HCPCS: 'J1234',
        CDM: 'CLIENT-CDM',
        Description: 'Client multiplier description',
        Qty: '12',
        PhysicianCDM: '',
      },
    ];

    const result = compareDatasets(
      rowsMaster,
      masterColumns,
      rowsClient,
      clientColumns,
      baseCriteria
    );

    expect(result.mergedRows[0].CDM).toBe('CLIENT-CDM');
    expect(result.mergedRows[0].Qty).toBe(12);
    expect(result.comparisonStats.matchedRecords).toBe(1);
  });

  // Phase 4: Modifier matching parity — non-configured modifiers fall through
  // to root matching (mirrors WinForms default case returning true)

  test('LT modifier on master matches plain root client row (non-configured modifier default-true)', () => {
    const rowsMaster: ExcelRow[] = [
      { id: 1, HCPCS: '12345-LT', CDM: '', Description: 'Left side', Qty: '', PhysicianCDM: '' },
    ];
    const rowsClient: ExcelRow[] = [
      { id: 10, HCPCS: '12345', CDM: 'CLIENT-CDM', Description: 'Client', Qty: '1', PhysicianCDM: '' },
    ];

    const result = compareDatasets(rowsMaster, masterColumns, rowsClient, clientColumns, baseCriteria);

    expect(result.mergedRows[0].CDM).toBe('CLIENT-CDM');
    expect(result.comparisonStats.matchedRecords).toBe(1);
    expect(result.unmatchedClient).toHaveLength(0);
  });

  test('RT modifier on master matches plain root client row', () => {
    const rowsMaster: ExcelRow[] = [
      { id: 1, HCPCS: '12345-RT', CDM: '', Description: 'Right side', Qty: '', PhysicianCDM: '' },
    ];
    const rowsClient: ExcelRow[] = [
      { id: 10, HCPCS: '12345', CDM: 'CLIENT-CDM', Description: 'Client', Qty: '2', PhysicianCDM: '' },
    ];

    const result = compareDatasets(rowsMaster, masterColumns, rowsClient, clientColumns, baseCriteria);

    expect(result.mergedRows[0].CDM).toBe('CLIENT-CDM');
    expect(result.comparisonStats.matchedRecords).toBe(1);
    expect(result.unmatchedClient).toHaveLength(0);
  });

  test('FA modifier on master matches plain root client row', () => {
    const rowsMaster: ExcelRow[] = [
      { id: 1, HCPCS: '26010-FA', CDM: '', Description: 'Finger', Qty: '', PhysicianCDM: '' },
    ];
    const rowsClient: ExcelRow[] = [
      { id: 10, HCPCS: '26010', CDM: 'CLIENT-CDM', Description: 'Client', Qty: '1', PhysicianCDM: '' },
    ];

    const result = compareDatasets(rowsMaster, masterColumns, rowsClient, clientColumns, baseCriteria);

    expect(result.mergedRows[0].CDM).toBe('CLIENT-CDM');
    expect(result.comparisonStats.matchedRecords).toBe(1);
    expect(result.unmatchedClient).toHaveLength(0);
  });

  test('F5 digit modifier on master matches plain root client row', () => {
    const rowsMaster: ExcelRow[] = [
      { id: 1, HCPCS: '26010-F5', CDM: '', Description: 'Finger 5', Qty: '', PhysicianCDM: '' },
    ];
    const rowsClient: ExcelRow[] = [
      { id: 10, HCPCS: '26010', CDM: 'CLIENT-CDM', Description: 'Client', Qty: '1', PhysicianCDM: '' },
    ];

    const result = compareDatasets(rowsMaster, masterColumns, rowsClient, clientColumns, baseCriteria);

    expect(result.mergedRows[0].CDM).toBe('CLIENT-CDM');
    expect(result.comparisonStats.matchedRecords).toBe(1);
    expect(result.unmatchedClient).toHaveLength(0);
  });

  test('TA modifier on master matches plain root client row', () => {
    const rowsMaster: ExcelRow[] = [
      { id: 1, HCPCS: '28001-TA', CDM: '', Description: 'Great toe', Qty: '', PhysicianCDM: '' },
    ];
    const rowsClient: ExcelRow[] = [
      { id: 10, HCPCS: '28001', CDM: 'CLIENT-CDM', Description: 'Client', Qty: '1', PhysicianCDM: '' },
    ];

    const result = compareDatasets(rowsMaster, masterColumns, rowsClient, clientColumns, baseCriteria);

    expect(result.mergedRows[0].CDM).toBe('CLIENT-CDM');
    expect(result.comparisonStats.matchedRecords).toBe(1);
    expect(result.unmatchedClient).toHaveLength(0);
  });

  test('T5 digit modifier on master matches plain root client row', () => {
    const rowsMaster: ExcelRow[] = [
      { id: 1, HCPCS: '28001-T5', CDM: '', Description: 'Toe 5', Qty: '', PhysicianCDM: '' },
    ];
    const rowsClient: ExcelRow[] = [
      { id: 10, HCPCS: '28001', CDM: 'CLIENT-CDM', Description: 'Client', Qty: '1', PhysicianCDM: '' },
    ];

    const result = compareDatasets(rowsMaster, masterColumns, rowsClient, clientColumns, baseCriteria);

    expect(result.mergedRows[0].CDM).toBe('CLIENT-CDM');
    expect(result.comparisonStats.matchedRecords).toBe(1);
    expect(result.unmatchedClient).toHaveLength(0);
  });

  test('unknown modifier on master matches plain root client row (default-true)', () => {
    const rowsMaster: ExcelRow[] = [
      { id: 1, HCPCS: '99999-QW', CDM: '', Description: 'Lab test', Qty: '', PhysicianCDM: '' },
    ];
    const rowsClient: ExcelRow[] = [
      { id: 10, HCPCS: '99999', CDM: 'CLIENT-CDM', Description: 'Client', Qty: '1', PhysicianCDM: '' },
    ];

    const result = compareDatasets(rowsMaster, masterColumns, rowsClient, clientColumns, baseCriteria);

    expect(result.mergedRows[0].CDM).toBe('CLIENT-CDM');
    expect(result.comparisonStats.matchedRecords).toBe(1);
    expect(result.unmatchedClient).toHaveLength(0);
  });

  test('configured modifier -25 on master does NOT root-match when root25 is disabled', () => {
    const rowsMaster: ExcelRow[] = [
      { id: 1, HCPCS: '99283-25', CDM: '', Description: 'Master', Qty: '', PhysicianCDM: '' },
    ];
    const rowsClient: ExcelRow[] = [
      { id: 10, HCPCS: '99283', CDM: 'CLIENT-CDM', Description: 'Client', Qty: '1', PhysicianCDM: '' },
    ];

    const result = compareDatasets(rowsMaster, masterColumns, rowsClient, clientColumns, { ...baseCriteria, root25: false });

    expect(result.mergedRows[0].CDM).toBe('');
    expect(result.comparisonStats.matchedRecords).toBe(0);
  });

  test('configured modifier -59 on master does NOT root-match when root59 is disabled', () => {
    const rowsMaster: ExcelRow[] = [
      { id: 1, HCPCS: '99283-59', CDM: '', Description: 'Master', Qty: '', PhysicianCDM: '' },
    ];
    const rowsClient: ExcelRow[] = [
      { id: 10, HCPCS: '99283', CDM: 'CLIENT-CDM', Description: 'Client', Qty: '1', PhysicianCDM: '' },
    ];

    const result = compareDatasets(rowsMaster, masterColumns, rowsClient, clientColumns, { ...baseCriteria, root59: false });

    expect(result.mergedRows[0].CDM).toBe('');
    expect(result.comparisonStats.matchedRecords).toBe(0);
  });

  test('configured modifier -76 on master does NOT root-match when root76 is disabled', () => {
    const rowsMaster: ExcelRow[] = [
      { id: 1, HCPCS: '99283-76', CDM: '', Description: 'Master', Qty: '', PhysicianCDM: '' },
    ];
    const rowsClient: ExcelRow[] = [
      { id: 10, HCPCS: '99283', CDM: 'CLIENT-CDM', Description: 'Client', Qty: '1', PhysicianCDM: '' },
    ];

    const result = compareDatasets(rowsMaster, masterColumns, rowsClient, clientColumns, { ...baseCriteria, root76: false });

    expect(result.mergedRows[0].CDM).toBe('');
    expect(result.comparisonStats.matchedRecords).toBe(0);
  });

  test('multiple masters with different non-configured modifiers all match the same root client row', () => {
    const rowsMaster: ExcelRow[] = [
      { id: 1, HCPCS: '12345-LT', CDM: '', Description: 'Left', Qty: '', PhysicianCDM: '' },
      { id: 2, HCPCS: '12345-RT', CDM: '', Description: 'Right', Qty: '', PhysicianCDM: '' },
    ];
    const rowsClient: ExcelRow[] = [
      { id: 10, HCPCS: '12345', CDM: 'CLIENT-CDM', Description: 'Client', Qty: '1', PhysicianCDM: '' },
    ];

    const result = compareDatasets(rowsMaster, masterColumns, rowsClient, clientColumns, baseCriteria);

    // Both master rows should match the single client root row
    expect(result.mergedRows[0].CDM).toBe('CLIENT-CDM');
    expect(result.mergedRows[1].CDM).toBe('CLIENT-CDM');
    expect(result.comparisonStats.matchedRecords).toBe(2);
    expect(result.unmatchedClient).toHaveLength(0);
  });

  test('modifier plus multiplier 59 codes can update from the root-modifier row even without root59 enabled', () => {
    const rowsMaster: ExcelRow[] = [
      {
        id: 1,
        HCPCS: '12345-59X10',
        CDM: '',
        Description: 'Master modifier multiplier description',
        Qty: '',
        PhysicianCDM: '',
      },
    ];

    const rowsClient: ExcelRow[] = [
      {
        id: 10,
        HCPCS: '12345-59',
        CDM: 'CLIENT-CDM',
        Description: 'Client modifier multiplier description',
        Qty: '5',
        PhysicianCDM: '',
      },
    ];

    const result = compareDatasets(
      rowsMaster,
      masterColumns,
      rowsClient,
      clientColumns,
      baseCriteria
    );

    expect(result.mergedRows[0].CDM).toBe('CLIENT-CDM');
    expect(result.mergedRows[0].Qty).toBe(10);
    expect(result.comparisonStats.matchedRecords).toBe(1);
  });
});
