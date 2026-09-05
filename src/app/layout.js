// src/app/layout.js
import { AuthProvider } from '@/app/components/auth/AuthProvider';
import Navbar from '@/app/components/Navbar';
import { ToastModal } from '@/app/components/ui/ToastModal';

import './globals.css';

export const metadata = {
  title: 'i-Store Online',
  description: 'ระบบเบิกสินค้าออนไลน์',
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body className="min-h-screen flex flex-col bg-[#f8f9fa]">
        <AuthProvider>
          <Navbar />
          {children}
          <ToastModal />
        </AuthProvider>
      </body>
    </html>
  );
}