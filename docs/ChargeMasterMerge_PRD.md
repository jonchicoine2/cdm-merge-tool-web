# ChargeMasterMerge Application - Product Requirements Document

## 1. Executive Summary

### Product Overview
ChargeMasterMerge is a specialized healthcare data reconciliation tool designed to compare and merge Charge Description Master (CDM) data files. The application enables healthcare organizations to validate client billing data against master reference files, ensuring compliance with healthcare coding standards and identifying data quality issues.

### Business Value
- **Compliance Assurance**: Validates HCPCS/CPT codes against approved master datasets
- **Revenue Protection**: Identifies billing discrepancies that could impact revenue
- **Data Quality**: Flags duplicates and unmatched records requiring review
- **Operational Efficiency**: Automates manual data comparison processes
- **Audit Trail**: Provides comprehensive reporting for compliance documentation

### Key Differentiators
- Client-side processing ensuring data privacy and HIPAA compliance
- Advanced modifier handling with configurable matching rules
- Multi-sheet Excel support with intelligent column mapping
- AI-powered natural language interface for data operations
- Real-time validation with visual indicators

## 2. Product Overview

### Target Users
- **Healthcare Revenue Cycle Analysts**: Primary users validating billing data
- **Compliance Officers**: Ensuring adherence to coding standards
- **Data Migration Specialists**: Reconciling data during system transitions
- **Quality Assurance Teams**: Identifying and resolving data discrepancies

### Current Solution Limitations
The application addresses critical gaps in healthcare data management:
- Manual Excel comparison processes are time-intensive and error-prone
- Limited modifier handling in existing tools
- Lack of comprehensive duplicate detection
- No standardized reporting for audit purposes
- Insufficient validation of healthcare coding standards

### Technical Architecture
- **Frontend**: Next.js 15.3.4 with React 19, TypeScript, Material-UI
- **Data Processing**: Client-side Excel parsing with XLSX library
- **AI Integration**: OpenAI GPT-4 for natural language processing
- **Storage**: Browser localStorage for session persistence
- **Security**: No server-side data transmission, HIPAA-compliant

## 3. User Stories and Use Cases

### Primary Use Cases

#### UC-001: Healthcare Billing Validation
**As a** Revenue Cycle Analyst  
**I want to** validate client billing data against approved master CDM files  
**So that** I can ensure all procedures are properly coded and billable

**Acceptance Criteria:**
- Upload master CDM file and client billing file
- Automatically identify HCPCS and modifier columns
- Generate matched, unmatched, and duplicate reports
- Export results with audit trail

#### UC-002: System Migration Data Reconciliation
**As a** Data Migration Specialist  
**I want to** reconcile legacy system data with new system requirements  
**So that** no billing data is lost during migration

**Acceptance Criteria:**
- Compare multi-sheet Excel files
- Handle different column naming conventions
- Provide detailed mapping reports
- Support custom modifier matching rules

#### UC-003: Compliance Audit Preparation
**As a** Compliance Officer  
**I want to** generate comprehensive reports of data quality issues  
**So that** I can address compliance risks before audits

**Acceptance Criteria:**
- Identify all unmatched and duplicate records
- Provide statistical analysis of match rates
- Generate exportable audit reports
- Track processing timestamps for documentation

### Secondary Use Cases

#### UC-004: AI-Assisted Data Analysis
**As a** Healthcare Analyst  
**I want to** use natural language commands to analyze data  
**So that** I can quickly extract insights without complex UI navigation

#### UC-005: Real-time Data Validation
**As a** Quality Assurance Specialist  
**I want to** validate HCPCS codes against official code sets  
**So that** I can identify invalid codes before processing

## 4. Functional Requirements

### 4.1 File Processing Requirements

#### FR-001: Excel File Upload and Processing
- **Must** support .xlsx and .xls file formats
- **Must** handle multi-sheet workbooks with tab navigation
- **Must** preserve original data integrity during processing
- **Must** support drag-and-drop file upload
- **Must** display file metadata (size, sheet count, record count)

#### FR-002: Intelligent Column Detection
- **Must** automatically identify HCPCS/CPT code columns
- **Must** detect modifier columns using fuzzy matching
- **Must** map description and other relevant columns
- **Must** support manual column mapping override
- **Must** provide column mapping confidence scores

### 4.2 Data Comparison and Matching

#### FR-003: HCPCS Code Matching Algorithm
- **Must** parse HCPCS codes in formats: XXXXX, XXXXX-YY, XXXXXYY
- **Must** handle separate modifier columns
- **Must** support composite key generation (HCPCS + Modifier)
- **Must** perform case-insensitive matching
- **Must** normalize whitespace and special characters

#### FR-004: Modifier Processing Rules
- **Must** support configurable modifier criteria:
  - Root 00: Include/exclude "00" modifier
  - Root 25: Include/exclude "25" modifier (E&M services)
  - Root 50: Include/exclude "50" modifier (bilateral procedures)
  - Root 59: Include/exclude "59" modifier (distinct procedures)
  - Root XU: Include/exclude "XU" modifier (unusual services)
  - Root 76: Include/exclude "76" modifier (repeat procedures)
- **Must** support trauma code filtering (99284, 99285, 99291)
- **Must** apply modifier rules during key generation

### 4.3 Data Categorization and Analysis

#### FR-005: Result Categorization
- **Must** identify matched records (client records with master matches)
- **Must** identify unmatched records (client records without matches)
- **Must** identify duplicate records (multiple client records with same key)
- **Must** calculate match statistics and processing metrics
- **Must** preserve original row data for all categories

#### FR-006: Statistical Analysis
- **Must** calculate total record counts for master and client files
- **Must** compute match rate percentages
- **Must** track processing time and performance metrics
- **Must** count successfully mapped columns
- **Must** generate comparison statistics for reporting

### 4.4 Data Validation and Quality Assurance

#### FR-007: HCPCS Code Validation
- **Must** validate CPT codes (Level I HCPCS): 5-digit codes (10000-99999)
- **Must** validate HCPCS Level II codes: Letter + 4 digits (A-V + 4 digits)
- **Must** validate common healthcare modifiers (25, 26, 50, 51, 59, etc.)
- **Must** validate anatomical modifiers (F1-F9, T1-T9, FA, LT, RT)
- **Must** provide specific validation error types (base_invalid, modifier_invalid)

#### FR-008: Duplicate Detection
- **Must** identify exact duplicate HCPCS+Modifier combinations
- **Must** flag all instances of duplicated keys (not just subsequent ones)
- **Must** use raw field values for duplicate detection
- **Must** provide duplicate key lists for reporting

### 4.5 User Interface and Interaction

#### FR-009: Data Grid Management
- **Must** display data in sortable, filterable grids
- **Must** support checkbox selection for bulk operations
- **Must** provide row-level editing capabilities
- **Must** implement virtual scrolling for performance
- **Must** support HCPCS code hyphen formatting (XXXXX-YY)

#### FR-010: Search and Filtering
- **Must** provide real-time search across all columns
- **Must** support advanced filtering conditions (equals, contains, starts with, etc.)
- **Must** maintain separate filter states for each grid
- **Must** provide filter clearing functionality
- **Must** support numeric range filtering

#### FR-011: Record Management
- **Must** support adding new records to any grid
- **Must** support editing existing records with validation
- **Must** support creating new records from existing templates
- **Must** support deleting individual or multiple records
- **Must** provide unsaved changes tracking and rollback

### 4.6 AI Integration

#### FR-012: Natural Language Processing
- **Must** interpret user commands for data operations
- **Must** support grid navigation commands ("switch to duplicates")
- **Must** support data analysis queries ("how many matches?")
- **Must** support filtering and sorting commands
- **Must** support export commands with custom filenames

#### FR-013: Context-Aware Responses
- **Must** understand current data state and grid selection
- **Must** provide actionable responses based on available data
- **Must** highlight relevant grid sections during operations
- **Must** maintain conversation history and context

### 4.7 Export and Reporting

#### FR-014: Comprehensive Export Functionality
- **Must** export merged results to Excel format
- **Must** include separate sheets for matched, unmatched, and duplicate data
- **Must** generate timestamped filenames automatically
- **Must** support custom filename specification
- **Must** remove internal ID fields from exports

#### FR-015: Report Generation
- **Must** include comparison statistics in reports
- **Must** provide processing metadata (timestamp, settings used)
- **Must** maintain data integrity in exported files
- **Must** support multi-sheet export format

## 5. Business Rules and Logic

### 5.1 Core Merge Rules (Based on Original Application Analysis)

#### BR-001: Record Processing Sequence
1. **HCPCS Formatting**: Insert hyphen in 7-character codes (e.g., `9928100` → `99281-00`)
2. **Duplicate Detection**: Identify client records with duplicate HCPCS codes
3. **Direct Exact Matches**: Process exact HCPCS matches first
4. **Modifier/Root Matching**: Apply configurable modifier rules
5. **Result Categorization**: Sort records into matched/unmatched/duplicate tables

#### BR-002: Field Population Rules
- **CDM Field Updates**: Only populate empty master fields from client data
- **PhysicianCDM Updates**: Only populate empty master fields from client data
- **Quantity Handling**: Copy client QTY to master if present
- **Multiplier Codes**: Special handling for codes with format `XXXXXx##`

#### BR-003: Multiplier Code Quantity Logic
For HCPCS codes with multipliers (e.g., `12345x04`):
- If client QTY ≥ multiplier value → Use client QTY
- If client QTY < multiplier value → Use multiplier value
- If client QTY is empty → Use multiplier value

### 5.2 Modifier-Based Matching Rules

#### BR-004: Root Modifier Configuration
When root modifier flags are enabled:
- `blRootFor00s`: Allow `99281` to match `99281-00`
- `blRootFor25s`: Allow `99213` to match `99213-25`
- `blRootFor50s`: Allow `12345` to match `12345-50`
- `blRootFor59s`: Allow `87070` to match `87070-59`
- `blRootForXUs`: Allow `99213` to match `99213-XU`
- `blRootFor76s`: Allow `73060` to match `73060-76`

#### BR-005: Trauma Code Special Handling
For codes `99284`, `99285`, `99291`:
- If `blIgnoreTrauma` is true: Exclude codes with "trauma team" descriptions
- Special matching rules apply based on modifier presence
- Exact matches with modifiers are always allowed

### 5.3 Update Conditions and Validation

#### BR-006: Record Update Criteria
A master record can be updated from client when:
1. Exact HCPCS match exists
2. Root modifier rule allows the match
3. Record is not in duplicate list
4. Client has valid CDM or PhysicianCDM data
5. Special trauma rules are satisfied

#### BR-007: Error Classification
- **dtErrors**: Client records with no master match found
- **dtEmpty**: Client records with empty CDM/PhysicianCDM fields
- **dtDups**: Client records with duplicate HCPCS keys
- **dtDescrips**: Records with description mismatches

### 5.4 Column Mapping Strategy

#### BR-008: Column Mapping Priority
1. **Exact Match**: Identical column names
2. **Case-Insensitive**: Same name, different case
3. **Normalized**: Removing spaces, underscores, hyphens
4. **Partial Match**: Substring matching
5. **Fuzzy Match**: Semantic similarity matching

#### BR-009: Field Detection Patterns
```
HCPCS Detection: ['hcpcs', 'hcpc', 'code', 'procedure_code', 'proc_code', 'cpt']
Modifier Detection: ['modifier', 'mod', 'modif', 'modifier_code']
Description Detection: ['description', 'desc', 'procedure_desc', 'proc_desc', 'name']
```

### 5.5 Data Processing Rules

#### BR-010: Data Validation Rules
- HCPCS codes must be 4-8 characters alphanumeric
- Modifiers must be 1-2 characters alphanumeric
- Empty/null values are treated as empty strings
- All comparisons are case-insensitive
- Whitespace is normalized during processing

#### BR-011: Duplicate Detection Logic
- Uses raw field values (not parsed keys) for duplicate detection
- Considers HCPCS + Modifier combination for uniqueness
- All instances of duplicated combinations are flagged
- Duplicate detection occurs after trauma filtering

### 5.6 Export and Formatting Rules

#### BR-012: HCPCS Formatting Rules
- 7-character codes without hyphens are formatted as XXXXX-YY
- Existing hyphenated codes are preserved
- Formatting applies to merged data and exports
- Original data in individual grids remains unchanged

#### BR-013: Export File Structure
- **Merged Sheet**: All matched records with combined data
- **Unmatched_Client Sheet**: Client records without master matches
- **Duplicate_Client Sheet**: Client records with duplicate keys
- Internal ID fields are excluded from exports
- Column order follows master file structure

## 6. User Interface Requirements

### 6.1 Layout and Navigation

#### UI-001: Main Application Layout
- **Must** provide dual-pane upload interface for Master and Client files
- **Must** display file information cards with metadata
- **Must** show comparison statistics panel after merge
- **Must** organize results in tabbed interface (Merged, Unmatched, Duplicates)
- **Must** maintain consistent visual hierarchy

#### UI-002: Data Grid Interface
- **Must** implement Material-UI DataGridPro with professional styling
- **Must** support sorting by any column with visual indicators
- **Must** provide search bars with real-time filtering
- **Must** display row count and filter status
- **Must** implement checkbox selection for bulk operations

### 6.2 Visual Design Standards

#### UI-003: Color Coding and Visual Indicators
- **Master Data**: Blue theme (#1976d2)
- **Client Data**: Green theme (#4caf50)
- **Merged Results**: Blue theme with success indicators
- **Unmatched Records**: Red theme (#d32f2f)
- **Duplicate Records**: Orange theme (#f57c00)
- **Validation Errors**: Red badges with specific error types

#### UI-004: Interactive Elements
- **Must** provide hover states for all clickable elements
- **Must** display loading indicators during processing
- **Must** show progress feedback for long operations
- **Must** implement drag-and-drop visual feedback
- **Must** provide tooltips for complex features

### 6.3 Responsive Design

#### UI-005: Multi-Screen Support
- **Must** adapt layout for desktop, tablet, and mobile viewports
- **Must** maintain functionality across different screen sizes
- **Must** provide horizontal scrolling for wide data grids
- **Must** optimize touch interactions for mobile devices

### 6.4 Accessibility Requirements

#### UI-006: WCAG Compliance
- **Must** support keyboard navigation throughout application
- **Must** provide screen reader compatibility
- **Must** maintain adequate color contrast ratios
- **Must** include ARIA labels for complex interactions
- **Must** support browser zoom up to 200%

## 7. Data Requirements

### 7.1 Input Data Specifications

#### DR-001: Excel File Requirements
- **Supported Formats**: .xlsx, .xls
- **Maximum File Size**: 50MB per file
- **Maximum Records**: 50,000 rows per sheet
- **Sheet Support**: Multiple sheets with tab navigation
- **Character Encoding**: UTF-8 and standard Excel encodings

#### DR-002: Required Data Fields
- **Master File Must Have**: HCPCS/CPT code column
- **Client File Must Have**: HCPCS/CPT code column
- **Optional Fields**: Modifier, Description, CDM, PhysicianCDM, Quantity
- **Data Types**: Text, Number, Date formats supported
- **Empty Cells**: Treated as empty strings, not errors

### 7.2 Data Processing Specifications

#### DR-003: Internal Data Structures
```typescript
interface ExcelRow {
  id: number;                    // Auto-generated unique identifier
  [key: string]: string | number | undefined;  // Dynamic column data
}

interface ComparisonStats {
  totalMasterRecords: number;
  totalClientRecords: number;
  matchedRecords: number;
  unmatchedRecords: number;
  duplicateRecords: number;
  matchRate: number;            // Percentage
  processingTime: number;       // Milliseconds
  columnsMatched: number;
  totalMasterColumns: number;
  totalClientColumns: number;
}
```

#### DR-004: Data Validation Rules
- **HCPCS Validation**: Must match healthcare code patterns
- **Modifier Validation**: Must be recognized healthcare modifiers
- **Numeric Fields**: Auto-convert strings to numbers where appropriate
- **Date Fields**: Support multiple date formats with automatic parsing

### 7.3 Data Storage and Persistence

#### DR-005: Session Management
- **Local Storage**: File data, settings, and session state
- **Memory Management**: Efficient handling of large datasets
- **State Persistence**: Restore previous sessions on page reload
- **Data Cleanup**: Automatic cleanup of old session data

#### DR-006: Export Data Format
- **Excel Compatibility**: Full compatibility with Excel 2016+
- **Data Integrity**: Preserve all original data values
- **Metadata Inclusion**: Processing timestamps and settings
- **Multiple Sheets**: Organized by result category

## 8. Performance Requirements

### 8.1 Processing Performance

#### PF-001: Response Time Requirements
- **File Upload**: Process files up to 10MB within 5 seconds
- **Data Matching**: Complete comparison of 10,000 records within 3 seconds
- **Search Operations**: Real-time results with <200ms response
- **Export Generation**: Create Excel files within 10 seconds
- **UI Interactions**: Respond to user actions within 100ms

#### PF-002: Scalability Limits
- **Maximum Records**: 50,000 rows per file
- **Maximum Columns**: 100 columns per sheet
- **Concurrent Operations**: Support multiple simultaneous file processing
- **Memory Usage**: Optimize for browser memory constraints
- **Browser Support**: Chrome, Firefox, Safari, Edge (latest versions)

### 8.2 Reliability Requirements

#### PF-003: Error Handling
- **Must** gracefully handle corrupted Excel files
- **Must** provide informative error messages for processing failures
- **Must** implement automatic recovery from temporary failures
- **Must** maintain data integrity during unexpected interruptions
- **Must** validate data consistency before processing

#### PF-004: Resource Management
- **Must** implement efficient memory usage patterns
- **Must** provide progress indicators for long operations
- **Must** support background processing for large files
- **Must** implement garbage collection for temporary data
- **Must** optimize rendering for large data grids

## 9. Security and Compliance

### 9.1 Data Security

#### SC-001: Client-Side Processing
- **Must** process all data locally in browser
- **Must** never transmit healthcare data to external servers
- **Must** use HTTPS for application delivery
- **Must** implement secure session storage
- **Must** provide data cleanup on session end

#### SC-002: Privacy Protection
- **Must** comply with HIPAA requirements for healthcare data
- **Must** not store persistent identifiable information
- **Must** provide user control over data retention
- **Must** implement secure data disposal methods
- **Must** maintain audit logs of data operations

### 9.2 Compliance Requirements

#### SC-003: Healthcare Standards Compliance
- **Must** support standard HCPCS/CPT code formats
- **Must** follow CMS modifier guidelines
- **Must** maintain data provenance and audit trails
- **Must** support compliance reporting requirements
- **Must** validate against official healthcare code sets

#### SC-004: Data Integrity
- **Must** preserve original data throughout processing
- **Must** maintain referential integrity between related records
- **Must** provide verification checksums for exported data
- **Must** implement transaction-like processing for bulk operations
- **Must** support data rollback for erroneous operations

## 10. Success Metrics

### 10.1 User Experience Metrics

#### SM-001: Usability Metrics
- **User Task Completion Rate**: >95% for primary workflows
- **Average Time to Complete Comparison**: <10 minutes for standard files
- **User Error Rate**: <2% for data input operations
- **Feature Adoption Rate**: >80% for core features
- **User Satisfaction Score**: >4.5/5.0 rating

#### SM-002: Performance Metrics
- **Application Load Time**: <3 seconds for initial page load
- **File Processing Speed**: 1000+ records per second
- **Search Response Time**: <200ms for real-time search
- **Export Generation Time**: <30 seconds for full reports
- **Memory Usage**: <1GB for maximum data loads

### 10.2 Business Value Metrics

#### SM-003: Data Quality Improvements
- **Match Rate Accuracy**: >98% for properly formatted data
- **Duplicate Detection Rate**: 100% identification of exact duplicates
- **False Positive Rate**: <1% for matching operations
- **Data Validation Accuracy**: >95% for HCPCS code validation
- **Processing Error Rate**: <0.1% for valid input data

#### SM-004: Operational Efficiency
- **Time Savings**: 80% reduction compared to manual processes
- **Error Reduction**: 90% fewer data quality issues in downstream systems
- **Audit Compliance**: 100% of required audit documentation generated
- **User Productivity**: 5x improvement in data processing throughput
- **Cost Reduction**: 60% lower operational costs for data reconciliation

### 10.3 Technical Performance Metrics

#### SM-005: System Reliability
- **Application Uptime**: 99.9% availability
- **Data Processing Accuracy**: 99.99% for matched operations
- **Browser Compatibility**: 100% support for target browsers
- **Mobile Responsiveness**: Full functionality on tablet devices
- **Security Incidents**: Zero data breaches or security violations

## 11. Detailed Business Logic Examples

### 11.1 Multiplier Code Processing Examples

#### Example 1: Client QTY Greater Than Multiplier
```
Master: HCPCS = "J1234x10", CDM = "", QTY = ""
Client: HCPCS = "J1234", CDM = "MED001", QTY = "15"
Result: HCPCS = "J1234x10", CDM = "MED001", QTY = "15"
Logic: Client QTY (15) > multiplier (10), so use client QTY
```

#### Example 2: Client QTY Less Than Multiplier
```
Master: HCPCS = "J5678x05", CDM = "", QTY = ""
Client: HCPCS = "J5678", CDM = "MED002", QTY = "3"
Result: HCPCS = "J5678x05", CDM = "MED002", QTY = "5"
Logic: Client QTY (3) < multiplier (5), so use multiplier value
```

### 11.2 Modifier Matching Examples

#### Example 3: Root 25 Enabled
```
Configuration: blRootFor25s = true
Master: HCPCS = "99213-25", CDM = "", PhysicianCDM = ""
Client: HCPCS = "99213", CDM = "12345", PhysicianCDM = "PHY001"
Result: HCPCS = "99213-25", CDM = "12345", PhysicianCDM = "PHY001"
Logic: Root matching allowed, 99213 matches 99213-25
```

#### Example 4: Trauma Code Handling
```
Configuration: blIgnoreTrauma = true
Master: HCPCS = "99284", CDM = "", Description = "Emergency visit"
Client: HCPCS = "99284", CDM = "ER001", Description = "Trauma team activation"
Result: No update (record filtered out due to trauma team description)
```

### 11.3 Duplicate Handling Examples

#### Example 5: Client Duplicates
```
Master: HCPCS = "87070", CDM = "", Description = "Culture bacterial"
Client: 
- Record 1: HCPCS = "87070", CDM = "LAB001", Description = "Culture"
- Record 2: HCPCS = "87070", CDM = "LAB002", Description = "Culture aerobic"
Result: Master record remains unchanged, both client records moved to duplicates table
```

---

This comprehensive PRD captures all the nuanced business logic from the original ChargeMasterMerge application, including the complex modifier handling, multiplier code processing, trauma code special cases, and sophisticated matching algorithms. It provides a complete specification for rebuilding or modernizing the application while preserving all critical healthcare domain expertise.