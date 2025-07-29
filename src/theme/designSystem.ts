// Simple color palette without MUI theme functions to avoid client component issues

// Healthcare-focused professional color palette
export const colorPalette = {
  // Primary Colors
  primary: {
    main: '#1565C0',      // Professional blue
    light: '#5E92F3',     // Lighter blue
    dark: '#0D47A1',      // Darker blue
    contrastText: '#FFFFFF'
  },
  
  // Secondary Colors
  secondary: {
    main: '#00695C',      // Healthcare teal
    light: '#439889',     // Lighter teal
    dark: '#004D40',      // Darker teal
    contrastText: '#FFFFFF'
  },
  
  // Semantic Colors
  success: {
    main: '#2E7D32',      // Consistent green
    light: '#66BB6A',     // Lighter green
    dark: '#1B5E20',      // Darker green
    contrastText: '#FFFFFF'
  },
  
  warning: {
    main: '#F57C00',      // Professional amber
    light: '#FFB74D',     // Lighter amber
    dark: '#E65100',      // Darker amber
    contrastText: '#FFFFFF'
  },
  
  error: {
    main: '#C62828',      // Professional red
    light: '#EF5350',     // Lighter red
    dark: '#B71C1C',      // Darker red
    contrastText: '#FFFFFF'
  },
  
  info: {
    main: '#1565C0',      // Same as primary
    light: '#5E92F3',     // Lighter blue
    dark: '#0D47A1',      // Darker blue
    contrastText: '#FFFFFF'
  },
  
  // Neutral Colors
  grey: {
    50: '#FAFAFA',        // Background
    100: '#F5F5F5',       // Light background
    200: '#EEEEEE',       // Border light
    300: '#E0E0E0',       // Border
    400: '#BDBDBD',       // Border dark
    500: '#9E9E9E',       // Text disabled
    600: '#757575',       // Text secondary
    700: '#616161',       // Text primary light
    800: '#424242',       // Text primary
    900: '#212121'        // Text primary dark
  },
  
  // Background Colors
  background: {
    default: '#FAFAFA',   // Page background
    paper: '#FFFFFF',     // Card/surface background
    elevated: '#FFFFFF'   // Elevated surfaces
  },
  
  // Text Colors
  text: {
    primary: '#212121',   // Primary text
    secondary: '#757575', // Secondary text
    disabled: '#9E9E9E'   // Disabled text
  }
};

// Status-specific colors for data visualization
export const statusColors = {
  matched: {
    main: '#2E7D32',      // Success green
    light: '#C8E6C9',     // Light green background
    contrastText: '#FFFFFF'
  },
  
  unmatched: {
    main: '#F57C00',      // Warning amber
    light: '#FFE0B2',     // Light amber background
    contrastText: '#FFFFFF'
  },
  
  duplicates: {
    main: '#C62828',      // Error red
    light: '#FFCDD2',     // Light red background
    contrastText: '#FFFFFF'
  },
  
  processing: {
    main: '#1565C0',      // Primary blue
    light: '#E3F2FD',     // Light blue background
    contrastText: '#FFFFFF'
  },
  
  neutral: {
    main: '#757575',      // Grey
    light: '#F5F5F5',     // Light grey background
    contrastText: '#FFFFFF'
  }
};

// Component-specific styling
export const componentStyles = {
  // Button variants
  buttons: {
    primary: {
      backgroundColor: colorPalette.primary.main,
      color: colorPalette.primary.contrastText,
      '&:hover': {
        backgroundColor: colorPalette.primary.dark
      }
    },
    
    secondary: {
      backgroundColor: colorPalette.secondary.main,
      color: colorPalette.secondary.contrastText,
      '&:hover': {
        backgroundColor: colorPalette.secondary.dark
      }
    },
    
    success: {
      backgroundColor: colorPalette.success.main,
      color: colorPalette.success.contrastText,
      '&:hover': {
        backgroundColor: colorPalette.success.dark
      }
    },
    
    warning: {
      backgroundColor: colorPalette.warning.main,
      color: colorPalette.warning.contrastText,
      '&:hover': {
        backgroundColor: colorPalette.warning.dark
      }
    }
  },
  
  // Chip variants
  chips: {
    matched: {
      backgroundColor: statusColors.matched.light,
      color: statusColors.matched.main,
      fontWeight: 600
    },
    
    unmatched: {
      backgroundColor: statusColors.unmatched.light,
      color: statusColors.unmatched.main,
      fontWeight: 600
    },
    
    duplicates: {
      backgroundColor: statusColors.duplicates.light,
      color: statusColors.duplicates.main,
      fontWeight: 600
    },
    
    info: {
      backgroundColor: statusColors.processing.light,
      color: statusColors.processing.main,
      fontWeight: 600
    },
    
    neutral: {
      backgroundColor: statusColors.neutral.light,
      color: statusColors.neutral.main,
      fontWeight: 600
    }
  },
  
  // Grid styling
  dataGrid: {
    focusBorder: `2px solid ${colorPalette.primary.main}`,
    focusShadow: `0 2px 8px ${colorPalette.primary.main}25`,
    headerBackground: colorPalette.grey[50],
    rowHover: colorPalette.grey[50]
  }
};

export default {
  colorPalette,
  statusColors,
  componentStyles
};
