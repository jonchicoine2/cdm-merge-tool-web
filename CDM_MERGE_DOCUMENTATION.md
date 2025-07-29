# CDM Merge Tool Documentation

## Overview

The **CDM Merge Tool** is a specialized Excel data comparison and merging application designed for healthcare data management. It processes Clinical Decision-Making (CDM) data by comparing master reference files with client data files to identify matches, duplicates, and discrepancies.

## Purpose & Problem Solved

### What Problem Does It Solve?

1. **Healthcare Data Reconciliation**: Compares client healthcare data against master reference datasets
2. **HCPCS Code Validation**: Ensures healthcare procedure codes (HCPCS) and modifiers are properly matched and validated
3. **Duplicate Detection**: Identifies duplicate records that could cause billing or compliance issues
4. **Data Quality Assurance**: Flags unmatched records that require manual review
5. **Streamlined Reporting**: Generates comprehensive Excel reports with categorized results

### Target Use Cases

- **Healthcare Billing**: Validating procedure codes against approved master lists
- **Compliance Auditing**: Ensuring client data matches regulatory standards
- **Data Migration**: Reconciling data during system transitions
- **Quality Control**: Identifying data anomalies and inconsistencies

## Core Functionality

### File Processing

1. **Master File**: Reference dataset (approved codes, procedures, etc.)
2. **Client File**: Data to be validated against the master
3. **Multi-Sheet Support**: Handles Excel files with multiple worksheets
4. **Automatic Detection**: Intelligently identifies relevant columns

### Matching Rules & Algorithm

#### Primary Matching Strategy
The tool uses **HCPCS codes** and **modifiers** as the primary matching criteria:

```
Match Key = HCPCS Code + Modifier (when present)
Example: "99213" + "25" = "9921325"
```

#### Column Mapping Strategies (In Order of Priority)

1. **Exact Match**: Column names match exactly
2. **Case-Insensitive**: Ignoring case differences
3. **Normalized**: Removing spaces, punctuation, special characters
4. **Partial Match**: Substring matching within column names
5. **Fuzzy Match**: Using similarity algorithms for close matches

#### Matching Process

1. **Column Detection**: Automatically identifies HCPCS and modifier columns
2. **Data Normalization**: Cleans and standardizes values
3. **Key Generation**: Creates composite keys for matching
4. **Comparison**: Matches client records against master records
5. **Categorization**: Sorts results into matched, unmatched, and duplicate groups

### Modifier Criteria & Filters

#### What Are Modifiers?

Healthcare procedure modifiers are two-digit codes that provide additional context about how a medical service or procedure was performed. They're essential for accurate billing and compliance.

**Common Examples:**
- **25**: Significant, separately identifiable evaluation and management service
- **59**: Distinct procedural service (different from other services on same day)
- **RT/LT**: Right side/Left side anatomical indicators
- **TC**: Technical component only
- **26**: Professional component only

#### How Modifier Matching Works

When comparing records, the tool creates a **composite matching key**:
```
Matching Key = HCPCS Code + Modifier
Example: "99213" + "25" = "9921325"
```

This means a procedure code with different modifiers will be treated as **different services** for matching purposes.

#### Modifier Settings Configuration

The tool provides specific modifier settings that control which modifier codes should be treated as "root codes" during the matching process:

##### Root Modifier Settings

**What it does:** Specifies which modifier codes should be stripped from HCPCS codes during matching, allowing modified codes to match their base procedure codes.

**Available Options:**
- **Root 00**: Strip "00" modifier from codes during matching
- **Root 25**: Strip "25" modifier from codes during matching  
- **Root 50**: Strip "50" modifier from codes during matching
- **Root 59**: Strip "59" modifier from codes during matching
- **Root XU**: Strip "XU" modifier from codes during matching
- **Root 76**: Strip "76" modifier from codes during matching
- **Ignore Trauma**: Exclude trauma team codes (99284, 99285, 99291) with "trauma team" descriptions

**Example Scenarios:**

| Master Record | Client Record | Root 25 = TRUE | Root 25 = FALSE |
|---------------|---------------|-----------------|-----------------|
| 99213 | 99213-25 | ✅ **MATCH** | ❌ **NO MATCH** |
| 99213-25 | 99213 | ✅ **MATCH** | ❌ **NO MATCH** |
| 99213-25 | 99213-25 | ✅ **MATCH** | ✅ **MATCH** |
| 99213-50 | 99213-25 | ❌ **NO MATCH** | ❌ **NO MATCH** |

**How It Works:**
When a root modifier is enabled (e.g., Root 25), any code with that modifier will have the modifier stripped for matching purposes:
- "99213-25" becomes "99213" for matching
- "99285-25" becomes "99285" for matching
- This allows modified codes to match their base procedure codes

**When to use each option:**
- **Root 25**: When "Significant, separately identifiable E&M service" modifier should match base codes
- **Root 59**: When "Distinct procedural service" modifier should match base codes  
- **Root 00**: When "00" modifier should match base codes
- **Root 50**: When bilateral procedure modifier should match base codes
- **Root XU**: When "Unusual non-overlapping service" modifier should match base codes
- **Root 76**: When "Repeat procedure by same physician" modifier should match base codes
- **Ignore Trauma**: When trauma team codes should be excluded from processing

#### Real-World Usage Examples

##### Scenario 1: Insurance Claim Validation
```
Master File: Approved procedure codes for insurance coverage
Client File: Submitted claims with modifiers

Settings: Root 25 = TRUE, Root 59 = TRUE
Result: Claims with E&M modifiers (25) and distinct procedure modifiers (59) 
        will match against base procedure codes in the master file
```

##### Scenario 2: Billing System Migration
```
Master File: New system's base procedure codes
Client File: Legacy system export with various modifiers

Settings: Root 00 = TRUE, Root 25 = TRUE, Root 50 = TRUE
Result: Modified codes from legacy system match base codes in new system
```

##### Scenario 3: Trauma Code Filtering
```
Master File: Standard procedure codes
Client File: Emergency department data

Settings: Ignore Trauma = TRUE
Result: Trauma team codes (99284, 99285, 99291) are excluded from processing
```

#### Recommended Settings by Use Case

| Use Case | Root 00 | Root 25 | Root 50 | Root 59 | Root XU | Root 76 | Ignore Trauma |
|----------|---------|---------|---------|---------|---------|---------|---------------|
| **Insurance Validation** | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Billing System Migration** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Emergency Dept Processing** | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ |
| **Procedure Code Standardization** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |

#### Troubleshooting Low Match Rates

If you're getting unexpectedly low match rates:

1. **Check modifier usage**: Review if your data has modifiers that should be treated as root codes
2. **Enable relevant root modifiers**: Turn on Root 25, Root 59, etc. based on your data
3. **Review unmatched records**: Look for patterns in codes that aren't matching
4. **Consider trauma codes**: Enable "Ignore Trauma" if trauma team codes are affecting results

#### Default Configuration

Most healthcare scenarios benefit from enabling common modifiers:
- **Root 25**: TRUE (E&M services)
- **Root 59**: TRUE (Distinct procedures)  
- **Root 00**: FALSE (unless specific need)
- **Root 50**: FALSE (unless bilateral procedures common)
- **Root XU**: FALSE (unless unusual services common)
- **Root 76**: FALSE (unless repeat procedures common)
- **Ignore Trauma**: TRUE (if trauma codes should be excluded)

## Data Processing Rules

### Matching Logic

1. **Primary Key Generation**:
   ```
   For each record:
   - Extract HCPCS code (required)
   - Extract modifier (optional)
   - Create composite key: HCPCS + Modifier
   ```

2. **Comparison Process**:
   ```
   For each client record:
   - Generate comparison key
   - Look up in master data
   - If found: Mark as "Matched"
   - If not found: Mark as "Unmatched"
   - If duplicate key in client: Mark as "Duplicate"
   ```

3. **Data Merging**:
   - Combines master and client data
   - Preserves all columns from both files
   - Adds match status indicators

### Column Mapping Intelligence

The tool automatically maps columns using fuzzy matching:

```typescript
// Example column mappings
"HCPCS Code" → "hcpcs", "code", "procedure_code"
"Modifier" → "mod", "modifier_1", "mod1"
"Description" → "desc", "procedure_desc", "service_description"
```

### Data Validation Rules

1. **Required Fields**: HCPCS code must be present
2. **Format Validation**: Codes follow standard healthcare formats
3. **Duplicate Handling**: Multiple client records with same key are flagged
4. **Data Integrity**: Preserves original data while adding analysis columns

### Enhanced HCPCS Validation

The tool now includes comprehensive HCPCS code and modifier validation:

#### Validation Process
1. **Base Code Validation**: Verifies HCPCS/CPT codes exist in official code sets
   - CPT codes (Level I HCPCS): 5-digit codes (10000-99999)
   - HCPCS Level II codes: Letter + 4 digits (A-V + 4 digits)
   - **Early Termination**: If base code is invalid, modifier is not checked

2. **Modifier Validation**: Only validates modifiers when base code is valid
   - Common modifiers: 25, 26, 50, 51, 59, 76, 77, 78, 79, TC
   - Anatomical modifiers: F1-F9, T1-T9, FA, LT, RT
   - Flags obviously invalid modifiers (e.g., non-standard codes like "ZZ")

3. **Efficient Processing**: Returns only invalid codes with specific issue types
   - `base_invalid`: Base code does not exist in official code sets
   - `modifier_invalid`: Base code is valid but modifier is invalid

#### Validation Features
- **Batch Processing**: Validates up to 200 codes per batch for efficiency
- **Conservative Approach**: When uncertain, assumes validity to avoid false positives
- **Detailed Reporting**: Provides specific reasons for validation failures
- **Visual Indicators**: Invalid codes are highlighted with type-specific badges
  - **B**: Base code issue (red badge)
  - **M**: Modifier issue (orange badge)
  - **!**: General validation issue (red badge)

#### Validation Examples
```
Valid Codes:
- "99213-25" (valid base + valid modifier)
- "A1234RT" (valid HCPCS Level II + valid anatomical modifier)

Invalid Codes:
- "99999-ZZ" (base_invalid - invalid base code, modifier not checked)
- "INVALID-XX" (base_invalid - invalid base code, modifier not checked)
- "99213-ZZ" (modifier_invalid - valid base but invalid modifier)

Response Format:
{"invalidCodes": [{"code": "99999-ZZ", "issue": "base_invalid"}, {"code": "99213-ZZ", "issue": "modifier_invalid"}]}
```

## Output & Results

### Generated Reports

The tool produces Excel files with multiple sheets:

#### 1. **Merged Sheet**
- All matched records with combined master/client data
- Match status and confidence scores
- Merged column data from both sources

#### 2. **Unmatched_Client Sheet**
- Client records with no master match
- Requires manual review for validity
- May indicate new procedures or data entry errors

#### 3. **Duplicate_Client Sheet**
- Client records with duplicate HCPCS+Modifier combinations
- Potential billing or data entry issues
- Needs deduplication before processing

### Statistics & Metrics

The tool provides comprehensive analysis:

```typescript
ComparisonStats {
  totalMasterRecords: number;    // Total master file records
  totalClientRecords: number;    // Total client file records
  matchedRecords: number;        // Successfully matched
  unmatchedRecords: number;      // No master match found
  duplicateRecords: number;      // Duplicate keys in client
  matchRate: number;             // Percentage match rate
  processingTime: number;        // Analysis duration (ms)
  columnsMatched: number;        // Successfully mapped columns
}
```

## Technical Architecture

### Frontend Framework
- **Next.js 15.3.4** with React 19
- **TypeScript** for type safety
- **Material-UI** for interface components
- **@mui/x-data-grid** for data visualization

### File Processing
- **XLSX library** for Excel file parsing
- **Client-side processing** (no server required)
- **Multi-sheet support** with tab navigation
- **Real-time preview** of data during upload

### AI Integration
- **OpenAI GPT-4** for natural language processing
- **Smart command interpretation** for data operations
- **Context-aware responses** based on current data state
- **Export automation** with custom filename support

### Data Management
- **Local state management** with React hooks
- **Session persistence** via localStorage
- **Real-time filtering** and search capabilities
- **Multiple sort/filter states** per grid

## AI Assistant Capabilities

### Natural Language Commands

The integrated AI can perform these operations:

1. **Data Navigation**:
   - "Switch to duplicates view"
   - "Show me unmatched records"
   - "Go to master data"

2. **Data Analysis**:
   - "How many rows are matched?"
   - "What's the match rate?"
   - "Count duplicates"

3. **Data Manipulation**:
   - "Sort by description"
   - "Hide rows with blank CDMS"
   - "Filter by status pending"
   - "Search for procedure code 99213"

4. **Export Operations**:
   - "Export the data"
   - "Export as monthly_report.xlsx"
   - "Save merged results"

### Grid Management

- **Visual highlighting** of active grids
- **Auto-scrolling** to relevant data sections
- **Smart context switching** between data views
- **Real-time filter/sort application**

## Configuration Options

### Modifier Settings

Users can configure how modifiers are processed:

```typescript
{
  ignoreBlanks: true,        // Treat blank modifiers as matches
  caseSensitive: false,      // Case-insensitive comparison
  requireExact: false        // Allow partial modifier matches
}
```

### Column Mapping

Advanced users can customize column detection:
- Manual column mapping override
- Custom fuzzy matching thresholds
- Field validation rules
- Data transformation options

## Best Practices

### Data Preparation

1. **Consistent Format**: Ensure HCPCS codes follow standard format
2. **Clean Headers**: Use clear, descriptive column names
3. **Complete Data**: Minimize blank cells in key fields
4. **Standardize Modifiers**: Use consistent modifier formatting

### Usage Workflow

1. **Upload Master File**: Load reference dataset first
2. **Upload Client File**: Load data to be validated
3. **Review Auto-Mapping**: Verify column mappings are correct
4. **Run Comparison**: Execute the merge process
5. **Analyze Results**: Review matched, unmatched, and duplicate data
6. **Export Reports**: Generate Excel files for further processing

### Troubleshooting

**Common Issues**:
- **Low Match Rate**: Check column mapping and data formats
- **Missing HCPCS**: Ensure HCPCS column is properly identified
- **Excessive Duplicates**: Review client data for entry errors
- **Performance Issues**: Large files may require chunked processing

## Security & Privacy

- **Client-Side Processing**: No data uploaded to external servers
- **Local Storage Only**: Data persists locally in browser
- **HIPAA Considerations**: Suitable for sensitive healthcare data
- **No External Dependencies**: Except AI features (optional)

## API Integration

### AI Service Endpoints

- **POST /api/ai/chat**: Natural language command processing
- **Context-aware**: Receives current data state
- **Structured responses**: Returns actionable commands
- **Error handling**: Graceful degradation when AI unavailable

### Data Export API

- **Local file generation**: Uses browser download API
- **Multiple formats**: Excel with multiple sheets
- **Custom naming**: Timestamp and user-defined filenames
- **Comprehensive output**: Includes all analysis results

## Performance Considerations

### Optimization Features

- **Efficient algorithms**: O(n log n) complexity for large datasets
- **Memory management**: Streaming for large file processing
- **Progressive loading**: Chunked data processing for responsiveness
- **Caching**: Intelligent memoization of expensive operations

### Scalability Limits

- **Browser memory**: Practical limit ~50,000 rows per file
- **Processing time**: Linear scaling with data size
- **UI responsiveness**: Virtual scrolling for large datasets
- **Export size**: Excel format limitations apply

## Compliance & Standards

### Healthcare Standards

- **HCPCS compatibility**: Supports standard procedure code formats
- **Modifier standards**: Follows CMS modifier guidelines
- **Data integrity**: Maintains audit trail of all operations
- **Validation rules**: Enforces healthcare data requirements

### Quality Assurance

- **Data validation**: Multi-level verification of results
- **Error reporting**: Detailed logging of issues and anomalies
- **Match confidence**: Scoring system for match quality
- **Manual review flags**: Highlights records requiring attention