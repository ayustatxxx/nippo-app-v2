// src/components/MainFooterNav.tsx
// エラー修正完全版 - 正しいJSX構造

import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useFooterVisibility } from "../hooks/useFooterVisibility";
import FloatingActionButton from "./FloatingActionButton";
import { transitions, calculateStaggerDelay } from "../utils/animationUtils";

const MainFooterNav: React.FC = () => {
  const location = useLocation();
  
  // ページ判定
  const isHomePage = location.pathname === "/"; 
  const isGroupsPage = location.pathname === "/groups"; 
  const isProfilePage = location.pathname === "/profile"; 
  
  // フッター表示制御
  const { showFooter, showFAB, animationTrigger, toggleFooter } = useFooterVisibility();

  // ログアウト処理の関数
  const handleLogout = () => {
    localStorage.removeItem("daily-report-user-token");
    localStorage.removeItem("daily-report-user-email");
    localStorage.removeItem("daily-report-username");
    sessionStorage.removeItem("daily-report-user-token");
    sessionStorage.removeItem("daily-report-user-email");
    sessionStorage.removeItem("daily-report-username");
    
    window.location.href = "/login";
  };

  // メニューアイテムの設定
  const menuItems = [
    {
      to: "/",
      icon: (isActive: boolean) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" 
             stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
      isActive: isHomePage,
      label: "ホーム"
    },
    {
      to: "/groups",
      icon: (isActive: boolean) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" 
             stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="7" r="4" />
          <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          <path d="M21 21v-2a4 4 0 0 0-3-3.85" />
        </svg>
      ),
      isActive: isGroupsPage,
      label: "グループ"
    },
    {
      to: "/profile",
      icon: (isActive: boolean) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" 
             stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
      isActive: isProfilePage,
      label: "プロフィール"
    }
  ];

  return (
    <>
      {/* +ボタン（FAB） */}
      {showFAB && (
        <FloatingActionButton
          visible={showFAB}
          onClick={toggleFooter}
          animationTrigger={animationTrigger}
        />
      )}

      {/* メインフッター */}
      {showFooter && (
        <div 
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            width: "100%",
            backgroundColor: "#055A68",
            height: "64px",
            borderTopLeftRadius: "16px",
            borderTopRightRadius: "16px",
            boxShadow: "0 -2px 10px rgba(0,0,0,0.2)",
            zIndex: 100,
            transform: showFooter ? 'translateY(0)' : 'translateY(100%)',
            opacity: showFooter ? 1 : 0,
            transition: 'all 0.25s cubic-bezier(0.645, 0.045, 0.355, 1)'
          }}
        >
          {/* メインメニューエリア（4つのアイコンを均等配置） */}
          <div style={{
            position: "absolute",
            left: "0",
            top: "0",
            height: "100%",
            width: "calc(100% - 68px)",
            display: "flex",
            justifyContent: "space-evenly",
            alignItems: "center",
            paddingLeft: "20px",
            paddingRight: "10px"
          }}>
            {/* メニューアイテム（ホーム、グループ、プロフィール） */}
            {menuItems.map((item, index) => (
              <Link 
                key={item.to}
                to={item.to}
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  backgroundColor: item.isActive ? "#ffffff22" : "transparent",
                  transition: transitions.smooth,
                  animationDelay: calculateStaggerDelay(index, 30),
                  flexShrink: 0
                }}
                onTouchStart={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = 'scale(0.9)';
                  (e.currentTarget as HTMLElement).style.backgroundColor = item.isActive ? "#ffffff33" : "#ffffff11";
                }}
                onTouchEnd={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                  (e.currentTarget as HTMLElement).style.backgroundColor = item.isActive ? "#ffffff22" : "transparent";
                }}
                onMouseDown={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = 'scale(0.9)';
                }}
                onMouseUp={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                  (e.currentTarget as HTMLElement).style.backgroundColor = item.isActive ? "#ffffff22" : "transparent";
                }}
              >
                {item.icon(item.isActive)}
              </Link>
            ))}

            {/* ログアウトボタン（4番目のアイコンとして配置） */}
            <div
              onClick={handleLogout}
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                backgroundColor: "transparent",
                transition: transitions.smooth,
                cursor: "pointer",
                animationDelay: calculateStaggerDelay(3, 30),
                flexShrink: 0
              }}
              onTouchStart={(e) => {
                (e.currentTarget as HTMLElement).style.transform = 'scale(0.9)';
                (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
              }}
              onTouchEnd={(e) => {
                (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              }}
            >
              <svg 
                width="24" 
                height="24" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="#fff"
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </div>
          </div>

          {/* ×ボタンのみ右端固定 */}
          <div
            onClick={toggleFooter}
            style={{
              position: "absolute",
              right: "20px",
              top: "50%",
              transform: "translateY(-50%)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              backgroundColor: "transparent",
              transition: transitions.smooth,
              cursor: "pointer",
              animationDelay: calculateStaggerDelay(4, 30)
            }}
            onTouchStart={(e) => {
              (e.currentTarget as HTMLElement).style.transform = 'scale(0.9) translateY(-50%)';
              (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            }}
            onTouchEnd={(e) => {
              (e.currentTarget as HTMLElement).style.transform = 'scale(1) translateY(-50%)';
              (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
            }}
          >
            <svg 
              width="24" 
              height="24" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="#fff"
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
        </div>
      )}

      {/* グローバルアニメーションスタイル */}
      <style>
        {`
          /* タッチデバイス用の最適化 */
          @media (hover: none) and (pointer: coarse) {
            .menu-item:active {
              transform: scale(0.95) !important;
              background-color: rgba(255, 255, 255, 0.1) !important;
            }
          }
        `}
      </style>
    </>
  );
};

export default MainFooterNav;