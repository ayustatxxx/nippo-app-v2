// src/hooks/useDeviceCapability.ts
// このファイルは：スマホの性能を判定して、高性能なら扇形UI、そうでなければ通常UIを表示

import { useState, useEffect } from 'react';

// スマホの性能情報を入れる型
interface DeviceCapability {
  supportsAdvancedAnimations: boolean;  // 高度なアニメーションが使えるか
  modernMobile: boolean;                // 新しいスマホかどうか
  gpuAcceleration: boolean;             // 画面描画が早いか
  connectionSpeed: 'fast' | 'medium' | 'slow';  // ネット回線の速度
  deviceType: 'desktop' | 'tablet' | 'mobile';  // デバイスの種類
}

export const useDeviceCapability = (): DeviceCapability => {
  // 初期値を設定（最初は性能が低いと仮定）
  const [capability, setCapability] = useState<DeviceCapability>({
    supportsAdvancedAnimations: false,
    modernMobile: false,
    gpuAcceleration: false,
    connectionSpeed: 'medium',
    deviceType: 'mobile'
  });

  useEffect(() => {
    // スマホの性能をチェックする関数
    const detectCapability = (): DeviceCapability => {
      
      // 1. 画面描画の性能をチェック
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      const gpuAcceleration = !!gl;  // WebGLが使えるかどうか

      // 2. CPUの性能をチェック（コア数）
      const hardwareConcurrency = navigator.hardwareConcurrency || 2;
      
      // 3. メモリの量をチェック
      const deviceMemory = (navigator as any).deviceMemory || 2;

      // 4. ネット回線の速度をチェック
      const connection = (navigator as any).connection;
      let connectionSpeed: 'fast' | 'medium' | 'slow' = 'medium';
      
      if (connection) {
        const effectiveType = connection.effectiveType;
        if (effectiveType === '4g' || effectiveType === '5g') {
          connectionSpeed = 'fast';
        } else if (effectiveType === 'slow-2g' || effectiveType === '2g') {
          connectionSpeed = 'slow';
        }
      }

      // 5. デバイスの種類を判定（画面サイズから）
      let deviceType: 'desktop' | 'tablet' | 'mobile' = 'mobile';
      if (window.innerWidth >= 1024) {
        deviceType = 'desktop';
      } else if (window.innerWidth >= 768) {
        deviceType = 'tablet';
      }

      // 6. iPhoneかAndroidの新しいバージョンかチェック
      const userAgent = navigator.userAgent;
      let modernMobile = false;
      
      if (/iPhone|iPad|iPod/.test(userAgent)) {
        // iOSのバージョンを取得
        const iosVersion = parseInt(userAgent.match(/OS (\d+)/)?.[1] || '0');
        modernMobile = iosVersion >= 14;  // iOS 14以上なら新しい
      } else if (/Android/.test(userAgent)) {
        // Androidのバージョンを取得
        const androidVersion = parseInt(userAgent.match(/Android (\d+)/)?.[1] || '0');
        modernMobile = androidVersion >= 10;  // Android 10以上なら新しい
      } else if (deviceType === 'desktop') {
        modernMobile = true;  // パソコンは高性能とみなす
      }

      // 7. 総合判定：すべての条件を満たせば高性能
      const supportsAdvancedAnimations = 
        hardwareConcurrency >= 4 &&     // CPUが4コア以上
        gpuAcceleration &&              // WebGLが使える
        deviceMemory >= 4 &&            // メモリが4GB以上
        connectionSpeed !== 'slow' &&   // 回線が遅くない
        modernMobile;                   // 新しいスマホ

      return {
        supportsAdvancedAnimations,
        modernMobile,
        gpuAcceleration,
        connectionSpeed,
        deviceType
      };
    };

    // 性能チェックを実行して結果を保存
    setCapability(detectCapability());
  }, []);

  return capability;
};