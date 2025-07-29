# System Patterns

This document describes the system architecture, key technical decisions, and recurring patterns used in the codebase.

## Development Environment

### Windows 11 Setup
- Default Shell: PowerShell (C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe)
- Working Directory: c:/GitHubStuff/cdm-merge-tool-web
- Node.js and npm configured for Next.js development

### OS-Specific Commands
**Important**: Always use Windows-compatible commands for this environment:
- **Browser Opening**: Use `start http://localhost:3000` (NOT `open`)
- **File Operations**: Use Windows PowerShell syntax
- **Path Separators**: Use forward slashes or escaped backslashes

### Next.js Application Structure
- App Router architecture (/src/app/)
- TypeScript configuration with strict type checking
- Material-UI components for data grids and interface
- Server-side API routes for AI integration

## AI Integration Architecture

### Google Gemini API Integration
- Model: "gemini-2.0-flash-exp" for fast streaming responses
- Real-time streaming for chat interfaces
- Batch processing capabilities for large datasets
- HCPCS code validation and medical knowledge queries

### Command Processing Pipeline
1. **Simple Command Parser**: Direct pattern matching for basic operations
2. **AI Fallback**: Complex queries processed by Gemini
3. **Streaming Response**: Real-time user feedback during processing
4. **Action Execution**: Grid operations, data manipulation, export functions

## Data Processing Patterns

### Excel File Handling
- Multi-sheet support with automatic column detection
- HCPCS code matching with configurable modifier settings
- Three-tier output: Merged, Unmatched, Duplicates
- Client-side processing for HIPAA compliance

### Grid State Management
- Separate state tracking for each grid (master, client, merged, unmatched, duplicates)
- Real-time selection tracking for AI context
- Comprehensive filtering and sorting capabilities
- In-place editing with validation and change tracking

## Code Quality Patterns

### TypeScript Best Practices
- Strict type checking enabled
- Interface definitions for all data structures
- Proper error handling with typed exceptions
- React hook optimization with dependency arrays

### Performance Optimization
- Streaming responses for large dataset operations
- Incremental data loading and processing
- Client-side caching for frequent operations
- Optimized re-rendering through proper state management
