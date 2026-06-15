import { AlertIcon, PlayIcon, CloseIcon } from "../lib/icons";

export default function ConfirmDialog({ isOpen, title, message, onConfirm, onCancel, confirmText = "YES", cancelText = "NO" }) {
  if (!isOpen) return null;

  return (
    <div className="dialog-overlay">
      <div className="glass-card dialog-box animate-scale-up">
        <h2 style={{ fontFamily: "var(--font-retro)", fontSize: "10px", color: "#EF4444", fontWeight: "bold", marginBottom: "12px", letterSpacing: "1px", textTransform: "uppercase", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
          <AlertIcon size={12} color="#EF4444" /> {title}
        </h2>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: "11px", color: "#CBD5E1", lineHeight: "1.5", marginBottom: "20px" }}>
          {message}
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: "16px" }}>
          <button 
            onClick={onConfirm} 
            className="btn-retro btn-retro-red"
          >
            <PlayIcon size={10} /> {confirmText}
          </button>
          {onCancel && (
            <button 
              onClick={onCancel} 
              className="btn-retro"
            >
              <CloseIcon size={10} /> {cancelText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
