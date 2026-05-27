import { useRef, useState } from "react";
import type { RequestFile } from "../../lib/types";
import {
  uploadFileWithMetadata,
  deleteFileWithMetadata,
  isAcceptedFileType,
  ACCEPTED_EXTENSIONS,
} from "../../lib/requests";

interface Props {
  userId: string;
  requestId: string | null;
  files: RequestFile[];
  onFilesChange: (files: RequestFile[]) => void;
}

const SIZE_LIMIT = 10 * 1024 * 1024; // 10 MB

function formatSize(bytes: number | null): string {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileUpload({ userId, requestId, files, onFilesChange }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    setUploading(true);
    const newFiles: RequestFile[] = [];
    try {
      for (const file of Array.from(fileList)) {
        if (!isAcceptedFileType(file)) {
          setError(`סוג הקובץ ${file.name} אינו נתמך`);
          continue;
        }
        if (file.size > SIZE_LIMIT) {
          setError(`הקובץ ${file.name} גדול מדי (מקסימום 10MB)`);
          continue;
        }
        const uploaded = await uploadFileWithMetadata({
          userId,
          requestId,
          file,
        });
        newFiles.push(uploaded);
      }
      if (newFiles.length > 0) {
        onFilesChange([...files, ...newFiles]);
      }
    } catch (e: any) {
      setError(e?.message ?? "שגיאה בהעלאת הקובץ");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDelete(file: RequestFile) {
    try {
      await deleteFileWithMetadata(file);
      onFilesChange(files.filter((f) => f.id !== file.id));
    } catch (e: any) {
      setError(e?.message ?? "שגיאה במחיקת הקובץ");
    }
  }

  return (
    <div dir="rtl" className="text-right">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          className="btn-secondary text-xs px-3 py-1.5"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? "מעלה..." : "צרף מסמכים"}
        </button>
        <span className="text-xs text-slate-400">
          PDF, Word, Excel, תמונות (עד 10MB)
        </span>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {error && (
        <div className="text-xs text-red-600 mt-1">{error}</div>
      )}

      {files.length > 0 && (
        <ul className="mt-2 space-y-1">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-2 text-xs text-slate-700 bg-slate-50 rounded-lg px-2 py-1.5"
            >
              <span className="truncate flex-1">{f.file_name}</span>
              <span className="text-slate-400 shrink-0">{formatSize(f.file_size)}</span>
              <button
                type="button"
                className="text-red-400 hover:text-red-600 transition shrink-0"
                onClick={() => handleDelete(f)}
                title="הסר קובץ"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
