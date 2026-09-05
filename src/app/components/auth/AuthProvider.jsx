// =========================================================================
// Component: AuthProvider (React Context Provider)
// หมวดหมู่: auth/
// หน้าที่: ควบคุมวงจรชีวิตของระบบยืนยันตัวตน SSO (Keycloak), จัดการ Token,
// Refresh Token อัตโนมัติ, Auto Logout, บันทึก Cookie และกระจาย State ให้ทั้งแอป
// =========================================================================

'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';
import { useRouter } from 'next/navigation';
import Keycloak from 'keycloak-js';
import Cookies from 'js-cookie';
import { keycloakConfig } from '@/lib/keycloak';

// สร้าง Context เริ่มต้นสำหรับระบบ Authentication
const AuthContext = createContext({
  keycloak: null,
  isAuthenticated: false,
  userInfo: null,
  logout: () => {},
});

export const AuthProvider = ({ children }) => {
  const router = useRouter();

  // สถานะการยืนยันตัวตน
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [keycloakInstance, setKeycloakInstance] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // การอ้างอิง Ref เพื่อป้องกัน Memory Leak และการเรียกซ้ำใน React Strict Mode
  const initRef = useRef(false);
  const keycloakRef = useRef(null);
  const logoutTimeoutRef = useRef(null);
  const tokenRefreshIntervalRef = useRef(null);

    // State สำหรับเก็บข้อมูลผู้ใช้ (User Info) ที่ได้จาก Keycloak Token หรือ API
    const [userInfo, setUserInfo] = useState(null);

  // ฟังก์ชันออกจากระบบ (Logout)
  const logout = useCallback(() => {
    const kc = keycloakRef.current;
    setUserInfo(null);
    setIsAuthenticated(false);
    Cookies.remove('security_token', { path: '/' });
    Cookies.remove('auth_username', { path: '/' });
    Cookies.remove('kc_token', { path: '/' });
    Cookies.remove('kc_refresh_token', { path: '/' });
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('istore_saved_path');
      sessionStorage.removeItem('easy_store_saved_path');
      localStorage.removeItem('easy-store-locale');
    }

    if (kc) {
      kc.logout({ redirectUri: window.location.origin });
    } else {
      window.location.href = window.location.origin;
    }
  }, []);

  useEffect(() => {
    // ป้องกัน React Strict Mode เรียก init() ซ้ำสองครั้งในโหมด Development
    if (initRef.current) return;
    initRef.current = true;

    // สร้าง Keycloak Instance เฉพาะใน Client
    const kc = new Keycloak(keycloakConfig);
    console.log('Keycloak instance created:', kc);

    // ฟังก์ชันเริ่มต้นการทำงานของ Keycloak
    const initializeKeycloak = async () => {
      try {
        let isOAuthCallback = false; // ตัวแปรตรวจสอบว่ากำลังอยู่ใน OAuth Callback หรือไม่

        // ล้างคีย์ตกค้างเก่าที่ไม่ใช้งานแล้วออกจาก Local Storage
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem('easy-store-locale');
          } catch {
            // ignore
          }
        }

        // 1. ตรวจสอบและบันทึกหน้าที่กำลังเปิดอยู่ลงใน sessionStorage ก่อนเริ่ม Auth
        if (typeof window !== 'undefined') {
          const currentPath = window.location.pathname + window.location.search;
          isOAuthCallback =
            window.location.hash.includes('state=') ||
            window.location.search.includes('code=') ||
            window.location.search.includes('session_state');

          if (!isOAuthCallback && currentPath && currentPath !== '/' && currentPath.length > 1) {
            sessionStorage.setItem('istore_saved_path', currentPath);
          }
        }

        // 2. กำหนด redirectUri ให้เป็น window.location.origin ที่ตรงกับ Valid Redirect URIs ใน Keycloak
        const authRedirectUri = typeof window !== 'undefined' ? window.location.origin : undefined;
        const savedToken = Cookies.get('kc_token');
        const savedRefreshToken = Cookies.get('kc_refresh_token');

        // เรียกใช้ฟังก์ชัน init ของ Keycloak
        const authenticated = await kc.init({
          onLoad: 'login-required',
          checkLoginIframe: false,
          redirectUri: authRedirectUri,
          token: savedToken,
          refreshToken: savedRefreshToken,
        });

        setKeycloakInstance(kc);
        keycloakRef.current = kc;
        setIsAuthenticated(authenticated);

        // 3. เคลียร์ค่า hash และ query parameters ของ Keycloak ออกจาก Address Bar
        if (typeof window !== 'undefined') {
          try {
            const currentUrl = new URL(window.location.href);
            let shouldClean = false;

            if (currentUrl.hash && (currentUrl.hash.includes('state=') || currentUrl.hash.includes('code='))) {
              currentUrl.hash = '';
              shouldClean = true;
            }

            if (
              currentUrl.searchParams.has('state') ||
              currentUrl.searchParams.has('code') ||
              currentUrl.searchParams.has('session_state') ||
              currentUrl.searchParams.has('iss')
            ) {
              currentUrl.searchParams.delete('state');
              currentUrl.searchParams.delete('code');
              currentUrl.searchParams.delete('session_state');
              currentUrl.searchParams.delete('iss');
              shouldClean = true;
            }

            if (shouldClean) {
              const cleanPath = currentUrl.pathname + (currentUrl.search || '') + (currentUrl.hash || '');
              window.history.replaceState(null, '', cleanPath);
            }
          } catch (urlErr) {
            console.warn('Failed to clean auth URL params:', urlErr);
          }
        }

        // 4. หากล็อกอินสำเร็จ และได้รับ Token กลับมา
        if (authenticated && kc.token && kc.tokenParsed) {
          Cookies.set('kc_token', kc.token, { expires: 1 / 24, path: '/' });
          if (kc.refreshToken) {
            Cookies.set('kc_refresh_token', kc.refreshToken, { expires: 1 / 24, path: '/' });
          }

          const username = (kc.tokenParsed.preferred_username || '').toUpperCase();
          const payload = {
            username,
            sessionTimeout: '60m',
            token: kc.token,
          };

          // ยิง API ตรวจสอบสิทธิ์ หรือตั้งค่าข้อมูลผู้ใช้จาก Token 
          // /api/oidc/authenticate
          try {
            const res = await fetch('/api/oidc/authenticate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });

            if (res.ok) {
              const data = await res.json();
              setUserInfo(data);
              if (data.securityToken) {
                Cookies.set('security_token', data.securityToken, {
                  expires: 1 / 24,
                  path: '/',
                  sameSite: 'lax',
                });
              }
              if (data.info?.username || username) {
                Cookies.set('auth_username', data.info?.username || username, {
                  expires: 1 / 24,
                  path: '/',
                  sameSite: 'lax',
                });
              }
            } else {
              throw new Error('Auth API not ok');
            }
          } catch {
            // กรณี API ยังไม่ได้สร้าง ให้ใช้ข้อมูลจาก Keycloak Token ไปก่อน
            setUserInfo({
              result: 'OK',
              info: {
                username,
                fullname: kc.tokenParsed.name || username,
                email: kc.tokenParsed.email || '',
              },
              securityToken: kc.token,
              expireAt: Date.now() + 3600000,
              accessLevel: 'User',
              ownedStores: [],
            });
            Cookies.set('security_token', kc.token, {
              expires: 1 / 24,
              path: '/',
              sameSite: 'lax',
            });
            Cookies.set('auth_username', username, {
              expires: 1 / 24,
              path: '/',
              sameSite: 'lax',
            });
          }

          // 5. ตรวจสอบว่ามีหน้าที่เคยเปิดค้างไว้ก่อน Refresh หรือไม่ (เฉพาะกรณีกลับมาจาก OAuth Callback)
          if (typeof window !== 'undefined') {
            const savedPath =
              sessionStorage.getItem('istore_saved_path')
            if (savedPath) {
              sessionStorage.removeItem('istore_saved_path');
              if (savedPath !== '/' && window.location.pathname === '/' && isOAuthCallback) {
                router.replace(savedPath);
              }
            }
          }

          // ตั้งตัวจับเวลานับถอยหลัง 60 นาทีสำหรับ Auto Logout เมื่อ Session หมดอายุ
          if (logoutTimeoutRef.current) clearTimeout(logoutTimeoutRef.current);
          logoutTimeoutRef.current = setTimeout(() => {
            logout();
          }, 60 * 60 * 1000);

          // ตั้งตัวจับเวลาตรวจสอบและต่ออายุ Token (Refresh Token) ทุก 1 นาที (60 วินาที)
          if (tokenRefreshIntervalRef.current)
            clearInterval(tokenRefreshIntervalRef.current);
          tokenRefreshIntervalRef.current = setInterval(async () => {
            try {
              if (keycloakRef.current?.token) {
                const refreshed = await keycloakRef.current.updateToken(30);
                if (refreshed && keycloakRef.current.token) {
                  Cookies.set('kc_token', keycloakRef.current.token, {
                    expires: 1 / 24,
                    path: '/',
                  });
                  if (keycloakRef.current.refreshToken) {
                    Cookies.set('kc_refresh_token', keycloakRef.current.refreshToken, {
                      expires: 1 / 24,
                      path: '/',
                    });
                  }
                }
              }
            } catch (err) {
              console.error('Token refresh failed, logging out...', err);
              logout();
            }
          }, 60 * 1000);
        }
      } catch (err) {
        console.error('Keycloak initialization failed:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initializeKeycloak();

    return () => {
      if (tokenRefreshIntervalRef.current)
        clearInterval(tokenRefreshIntervalRef.current);
      if (logoutTimeoutRef.current) clearTimeout(logoutTimeoutRef.current);
    };
  }, [logout, router]);

  // Loading SSO Login
  if (isLoading || !keycloakInstance || !isAuthenticated) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-20 h-20 animate-pulse">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/iStore.png"
              alt="Loading..."
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full bg-[#FFC125] animate-bounce"
              style={{ animationDelay: '0ms' }}
            />
            <div
              className="w-2.5 h-2.5 rounded-full bg-[#FFC125] animate-bounce"
              style={{ animationDelay: '150ms' }}
            />
            <div
              className="w-2.5 h-2.5 rounded-full bg-[#FFC125] animate-bounce"
              style={{ animationDelay: '300ms' }}
            />
          </div>
          <p className="text-xs font-bold text-[#363636]/70">
            กำลังเข้าสู่ระบบ SSO...
          </p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        keycloak: keycloakInstance,
        isAuthenticated,
        userInfo,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Custom Hook สำหรับเรียกใช้งานข้อมูล Auth
export const useAuth = () => useContext(AuthContext);
