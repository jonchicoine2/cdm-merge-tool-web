'use client';

import { LicenseInfo } from '@mui/x-license';

if (process.env.NEXT_PUBLIC_MUI_X_LICENSE_KEY) {
  LicenseInfo.setLicenseKey(process.env.NEXT_PUBLIC_MUI_X_LICENSE_KEY);
}

export default function MuiLicenseProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}