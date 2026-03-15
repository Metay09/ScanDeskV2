import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center",
          background: "#0d0f12", color: "#f1f3f7", fontFamily: "'Inter', sans-serif", padding: 24,
        }}>
          <div style={{
            maxWidth: 420, width: "100%", background: "#161920", border: "1.5px solid #2e3440",
            borderRadius: 14, padding: "36px 28px", textAlign: "center",
            boxShadow: "0 4px 32px rgba(0,0,0,.5)",
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Bir hata oluştu</h2>
            <p style={{ fontSize: 13, color: "#8a93a8", marginBottom: 24, lineHeight: 1.6 }}>
              Uygulama beklenmeyen bir hatayla karşılaştı. Lütfen sayfayı yenileyerek tekrar deneyin.
            </p>
            {this.state.error && (
              <pre style={{
                fontSize: 11, color: "#ef4444", background: "rgba(239,68,68,.14)",
                border: "1.5px solid rgba(239,68,68,.35)", borderRadius: 10,
                padding: 12, marginBottom: 20, textAlign: "left",
                overflow: "auto", maxHeight: 120, whiteSpace: "pre-wrap", wordBreak: "break-word",
              }}>
                {this.state.error.toString()}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
                padding: "0 24px", height: 48, borderRadius: 10, fontWeight: 700, fontSize: 14,
                cursor: "pointer", border: "none", background: "#f59e0b", color: "#000",
                fontFamily: "'Inter', sans-serif",
              }}
            >
              Sayfayı Yenile
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
