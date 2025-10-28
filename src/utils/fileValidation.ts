// utils/fileValidation.ts
import { useState } from 'react';

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedFileName?: string;
}

export class FileValidator {
  private static readonly ALLOWED_TYPES = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp'
  ];
  
  private static readonly MAX_FILE_SIZE = 7 * 1024 * 1024; // 7MB
  private static readonly MAX_FILES = 10; // 最大ファイル数
  
  // ファイル名の危険な文字をサニタイズ
  private static sanitizeFileName(fileName: string): string {
    return fileName
      .replace(/[<>:"/\\|?*]/g, '') // 危険な文字を除去
      .replace(/\s+/g, '_') // スペースをアンダースコアに変換
      .replace(/[^\w\-._]/g, '') // 英数字、ハイフン、ドット、アンダースコアのみ許可
      .substring(0, 100); // 最大100文字に制限
  }
  
  // MIME type検証（ファイル内容も確認）
  private static async validateMimeType(file: File): Promise<boolean> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const arr = new Uint8Array(reader.result as ArrayBuffer);
        
        // ファイルシグネチャ（マジックナンバー）をチェック
        const signatures = {
          jpeg: [0xFF, 0xD8, 0xFF],
          png: [0x89, 0x50, 0x4E, 0x47],
          gif: [0x47, 0x49, 0x46],
          webp: [0x52, 0x49, 0x46, 0x46] // RIFF for WebP
        };
        
        for (const [type, sig] of Object.entries(signatures)) {
          if (sig.every((byte, i) => arr[i] === byte)) {
            // ファイル拡張子とMIME typeが一致するかチェック
            const expectedMimes = {
              jpeg: ['image/jpeg', 'image/jpg'],
              png: ['image/png'],
              gif: ['image/gif'],
              webp: ['image/webp']
            };
            
            resolve(expectedMimes[type as keyof typeof expectedMimes]?.includes(file.type) || false);
            return;
          }
        }
        
        resolve(false);
      };
      
      reader.onerror = () => resolve(false);
      reader.readAsArrayBuffer(file.slice(0, 10)); // 最初の10バイトのみ読み取り
    });
  }
  
  // 単一ファイルの検証
  public static async validateFile(file: File): Promise<FileValidationResult> {
    // ファイルが存在するかチェック
    if (!file) {
      return { isValid: false, error: 'ファイルが選択されていません。' };
    }
    
    // ファイルサイズチェック
    if (file.size > this.MAX_FILE_SIZE) {
      const sizeMB = Math.round(file.size / (1024 * 1024) * 10) / 10;
      return { 
        isValid: false, 
        error: `ファイルサイズが大きすぎます。${sizeMB}MB > 7MB制限`
      };
    }
    
    // 空ファイルチェック
    if (file.size === 0) {
      return { isValid: false, error: '空のファイルはアップロードできません。' };
    }
    
    // MIME type基本チェック
    if (!this.ALLOWED_TYPES.includes(file.type)) {
      return { 
        isValid: false, 
        error: `対応していないファイル形式です: ${file.type}\n対応形式: JPEG, PNG, GIF, WebP` 
      };
    }
    
    // ファイル名検証
    if (!file.name || file.name.length > 255) {
      return { isValid: false, error: 'ファイル名が無効です。' };
    }
    
    // 危険な拡張子チェック
    const dangerousExtensions = ['.exe', '.js', '.html', '.php', '.asp', '.jsp'];
    const fileName = file.name.toLowerCase();
    if (dangerousExtensions.some(ext => fileName.includes(ext))) {
      return { isValid: false, error: '危険なファイル形式が検出されました。' };
    }
    
    // ファイル内容の詳細検証
    const isMimeValid = await this.validateMimeType(file);
    if (!isMimeValid) {
      return { 
        isValid: false, 
        error: 'ファイル内容が不正です。画像ファイルを選択してください。' 
      };
    }
    
    return { 
      isValid: true, 
      sanitizedFileName: this.sanitizeFileName(file.name)
    };
  }
  
  // 複数ファイルの検証
  public static async validateFiles(files: FileList | File[]): Promise<{
    validFiles: File[];
    errors: string[];
    totalSize: number;
  }> {
    const validFiles: File[] = [];
    const errors: string[] = [];
    let totalSize = 0;
    
    const fileArray = Array.from(files);
    
    // ファイル数制限チェック
    if (fileArray.length > this.MAX_FILES) {
      errors.push(`ファイル数が上限を超えています。最大${this.MAX_FILES}ファイルまで。`);
      return { validFiles, errors, totalSize };
    }
    
    // 各ファイルを検証
    for (const file of fileArray) {
      const result = await this.validateFile(file);
      
      if (result.isValid) {
        validFiles.push(file);
        totalSize += file.size;
      } else {
        errors.push(`${file.name}: ${result.error}`);
      }
    }
    
   // 合計サイズチェック（20MB制限）← 圧縮前チェックは不要なため削除
    // 理由：圧縮後にPostPage/EditPageでチェックするため
    /*
    const maxTotalSize = 20 * 1024 * 1024;
    if (totalSize > maxTotalSize) {
      const sizeMB = Math.round(totalSize / (1024 * 1024) * 10) / 10;
      errors.push(`合計ファイルサイズが上限を超えています: ${sizeMB}MB > 20MB`);
      return { validFiles: [], errors, totalSize };
    }
    */
    
    return { validFiles, errors, totalSize };
  }


  /**
   * 圧縮後のBase64データの合計サイズをチェックする
   * @param base64Images Base64形式の画像配列
   * @returns チェック結果
   */
  public static checkCompressedTotalSize(base64Images: string[]): {
    isValid: boolean;
    totalSizeMB: number;
    error?: string;
  } {
    // Base64文字列のサイズを計算（バイト単位）
    const totalSize = base64Images.reduce((sum, base64) => {
      // Base64のdata:image/jpeg;base64, プレフィックスを除外
      const base64Data = base64.split(',')[1] || base64;
      // Base64は元のバイト数の約1.33倍なので、実際のサイズに変換
      const actualSize = (base64Data.length * 3) / 4;
      return sum + actualSize;
    }, 0);
    
    const maxTotalSize = 20 * 1024 * 1024; // 20MB
    const totalSizeMB = Math.round(totalSize / (1024 * 1024) * 10) / 10;
    
    if (totalSize > maxTotalSize) {
      return {
        isValid: false,
        totalSizeMB,
        error: `圧縮後の合計ファイルサイズが上限を超えています: ${totalSizeMB}MB > 20MB\n画像の枚数を減らすか、画質を下げて再度お試しください。`
      };
    }
    
    return {
      isValid: true,
      totalSizeMB
    };
  }
  


  // 画像のBase64変換（圧縮対応版に更新）
public static async convertToBase64(file: File): Promise<string> {
  try {
    // 画像ファイルの場合は圧縮を実行
    if (file.type.startsWith('image/')) {
      return await this.compressImage(file, 960, 0.4);
    }
    
    // 画像以外はそのまま変換（将来的な拡張対応）
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        if (result.startsWith('data:image/')) {
          resolve(result);
        } else {
          reject(new Error('不正な画像データです'));
        }
      };
      reader.onerror = () => reject(new Error('ファイル読み込みエラー'));
      reader.readAsDataURL(file);
    });
  } catch (error) {
    console.error('Base64変換エラー:', error);
    throw error;
  }
}
  
  // セキュリティログ機能
  public static logSecurityEvent(event: string, details: any) {
    const logEntry = {
      timestamp: Date.now(),
      event: 'file_security_event',
      type: event,
      details,
      userAgent: navigator.userAgent,
      url: window.location.href
    };
    
    console.warn('[FILE_SECURITY]', logEntry);
    
    // 将来的にはサーバーに送信
    // analytics.track('security_event', logEntry);
  }

  // 画像圧縮機能（PostPageから移植）
  public static async compressImage(file: File, maxWidth: number = 960, quality: number = 0.4): Promise<string> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        try {
          // アスペクト比を保持してリサイズ計算
          const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
          const newWidth = Math.floor(img.width * ratio);
          const newHeight = Math.floor(img.height * ratio);
          
          canvas.width = newWidth;
          canvas.height = newHeight;
          
          // 高品質な描画設定
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          
          // 背景を白に設定（透過PNG対応）
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, newWidth, newHeight);
          
          // 画像を描画
          ctx.drawImage(img, 0, 0, newWidth, newHeight);
          
          // JPEG圧縮で出力
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          
          // メモリクリーンアップ
          URL.revokeObjectURL(img.src);
          
          console.log(`画像圧縮完了: ${file.name}`);
          resolve(compressedDataUrl);
        } catch (error) {
          console.error('画像圧縮エラー:', error);
          reject(new Error('画像の圧縮に失敗しました'));
        }
      };
      
      img.onerror = () => {
        console.error('画像読み込みエラー:', file.name);
        reject(new Error('画像の読み込みに失敗しました'));
      };
      
      // 画像データを読み込み
      img.src = URL.createObjectURL(file);
    });
  }

  // バッチ処理機能（PostPageから移植）
  public static async processFilesInBatches(files: File[], batchSize: number = 2): Promise<string[]> {
    const results: string[] = [];
    
    console.log(`画像処理開始: ${files.length}枚を${batchSize}枚ずつ処理`);
    
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      console.log(`バッチ ${Math.floor(i/batchSize) + 1}/${Math.ceil(files.length/batchSize)}: ${batch.length}枚処理中`);
      
      try {
        const batchResults = await Promise.all(
          batch.map(file => this.compressImage(file))
        );
        results.push(...batchResults);
        
        // バッチ間で短時間待機してメモリ解放を促進
        if (i + batchSize < files.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error(`バッチ処理エラー (バッチ ${Math.floor(i/batchSize) + 1}):`, error);
        throw error;
      }
    }
    
    console.log(`画像処理完了: ${results.length}枚すべて完了`);
    return results;
  }


}

// React Hook for file validation
export const useFileValidation = () => {
  const [isValidating, setIsValidating] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  
  const validateAndProcess = async (files: FileList | File[]) => {
    setIsValidating(true);
    setValidationErrors([]);
    
    try {
      const result = await FileValidator.validateFiles(files);
      
      if (result.errors.length > 0) {
        setValidationErrors(result.errors);
        
        // セキュリティイベントをログ
        FileValidator.logSecurityEvent('validation_failed', {
          fileCount: Array.from(files).length,
          errors: result.errors,
          fileNames: Array.from(files).map(f => f.name)
        });
      }
      
      return result;
    } catch (error) {
      const errorMsg = 'ファイル検証中にエラーが発生しました';
      setValidationErrors([errorMsg]);
      
      FileValidator.logSecurityEvent('validation_error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return { validFiles: [], errors: [errorMsg], totalSize: 0 };
    } finally {
      setIsValidating(false);
    }
  };
  
  const clearErrors = () => setValidationErrors([]);
  
  return {
    validateAndProcess,
    isValidating,
    validationErrors,
    clearErrors
  };
  
};