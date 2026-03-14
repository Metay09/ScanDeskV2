import { Ic, I } from "./Icon";

export default function ReportPage() {
  return (
    <div className="page">
      <div className="empty-state">
        <Ic d={I.report} s={40} />
        <p style={{ marginTop: 10, fontSize: 14 }}>Rapor ekranı yakında kullanıma açılacak</p>
      </div>
    </div>
  );
}
