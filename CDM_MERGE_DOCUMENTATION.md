# CDM Merge Tool Documentation

## Overview

The **CDM Merge Tool** is a specialized Excel data comparison and merging application designed for healthcare data management. It processes Clinical Decision-Making (CDM) data by comparing master reference files with client data files to identify matches, duplicates, and discrepancies.

## Purpose & Problem Solved

### What Problem Does It Solve?

1. **Healthcare Data Reconciliation**: Compares client healthcare data against master reference datasets
2. **HCPCS Code Validation**: Ensures healthcare procedure codes (HCPCS) are properly matched and validated
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

The tool provides three critical settings that control how modifiers are handled during the matching process:

##### 1. **Ignore Blanks** (`ignoreBlanks: boolean`)

**What it does:** Controls whether blank/empty modifiers should be treated as equivalent to other blank modifiers.

**Options:**
- **TRUE (Recommended)**: Records with blank modifiers can match other records with blank modifiers
- **FALSE**: Blank modifiers are treated as distinct values and won't match

**Example Scenarios:**

| Master Record | Client Record | Ignore Blanks = TRUE | Ignore Blanks = FALSE |
|---------------|---------------|---------------------|----------------------|
| 99213 + "" (blank) | 99213 + "" (blank) | ✅ **MATCH** | ❌ **NO MATCH** |
| 99213 + "25" | 99213 + "" (blank) | ❌ **NO MATCH** | ❌ **NO MATCH** |
| 99213 + "" (blank) | 99213 + "25" | ❌ **NO MATCH** | ❌ **NO MATCH** |

**When to use TRUE:** Most healthcare scenarios where blank modifiers represent "no modifier applicable"
**When to use FALSE:** Strict environments where every modifier must be explicitly specified

##### 2. **Case Sensitive** (`caseSensitive: boolean`)

**What it does:** Controls whether modifier text case matters for matching.

**Options:**
- **FALSE (Recommended)**: "RT" matches "rt", "LT" matches "lt"
- **TRUE**: "RT" only matches "RT", case must be exact

**Example Scenarios:**

| Master Record | Client Record | Case Sensitive = FALSE | Case Sensitive = TRUE |
|---------------|---------------|----------------------|---------------------|
| 99213 + "RT" | 99213 + "rt" | ✅ **MATCH** | ❌ **NO MATCH** |
| 99213 + "LT" | 99213 + "LT" | ✅ **MATCH** | ✅ **MATCH** |
| 99213 + "25" | 99213 + "25" | ✅ **MATCH** | ✅ **MATCH** |

**When to use FALSE:** Most scenarios to handle data entry inconsistencies
**When to use TRUE:** Environments with strict data formatting standards

##### 3. **Require Exact** (`requireExact: boolean`)

**What it does:** Controls whether modifiers must match exactly or if partial/fuzzy matching is allowed.

**Options:**
- **FALSE (Recommended)**: Allows fuzzy matching for minor variations
- **TRUE**: Modifiers must match character-for-character

**Example Scenarios:**

| Master Record | Client Record | Require Exact = FALSE | Require Exact = TRUE |
|---------------|---------------|---------------------|---------------------|
| 99213 + "25" | 99213 + "25" | ✅ **MATCH** | ✅ **MATCH** |
| 99213 + "RT" | 99213 + "R T" | ✅ **MATCH** (fuzzy) | ❌ **NO MATCH** |
| 99213 + "59" | 99213 + "5 9" | ✅ **MATCH** (fuzzy) | ❌ **NO MATCH** |

**When to use FALSE:** Real-world data with potential formatting inconsistencies
**When to use TRUE:** Clean, standardized datasets where exact matching is required

#### Real-World Impact Examples

##### Scenario 1: Billing Validation
```
Master File: Approved procedures for insurance
Client File: Submitted claims

Settings: ignoreBlanks=true, caseSensitive=false, requireExact=false
Result: Flexible matching that catches most legitimate variations
```

##### Scenario 2: Compliance Audit
```
Master File: Regulatory standard procedures
Client File: Provider submissions

Settings: ignoreBlanks=false, caseSensitive=true, requireExact=true
Result: Strict matching that identifies any deviations from standards
```

##### Scenario 3: Data Migration
```
Master File: New system format
Client File: Legacy system export

Settings: ignoreBlanks=true, caseSensitive=false, requireExact=false
Result: Accommodates formatting differences between systems
```

#### Recommended Settings by Use Case

| Use Case | Ignore Blanks | Case Sensitive | Require Exact | Rationale |
|----------|---------------|----------------|---------------|-----------|
| **Insurance Validation** | ✅ TRUE | ❌ FALSE | ❌ FALSE | Flexible matching for real-world data variations |
| **Regulatory Compliance** | ❌ FALSE | ✅ TRUE | ✅ TRUE | Strict adherence to standards |
| **Data Migration** | ✅ TRUE | ❌ FALSE | ❌ FALSE | Accommodates system differences |
| **Quality Control** | ✅ TRUE | ❌ FALSE | ✅ TRUE | Balance of flexibility and precision |
| **Audit Preparation** | ❌ FALSE | ✅ TRUE | ✅ TRUE | Maximum precision for review |

#### Troubleshooting Low Match Rates

If you're getting unexpectedly low match rates, try adjusting modifier settings:

1. **Check for case differences**: Enable case-insensitive matching
2. **Look for spacing issues**: Disable exact matching requirement
3. **Review blank handling**: Enable ignore blanks if many records have empty modifiers
4. **Examine data samples**: Review unmatched records to identify patterns

#### Default Configuration

```typescript
// Recommended starting configuration
modifierCriteria: {
  ignoreBlanks: true,        // Handle missing modifiers gracefully
  caseSensitive: false,      // Ignore case differences
  requireExact: false        // Allow fuzzy matching for minor variations
}
```

This configuration works well for most healthcare data scenarios and can be adjusted based on your specific requirements and data quality.

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