/** 白画面の切り分け用。このページが表示されればレイアウトは動いている。 */
export default function TestPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        padding: 24,
        backgroundColor: "#f8fafc",
        color: "#0f172a",
        fontFamily: "sans-serif",
      }}
    >
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>表示確認</h1>
      <p>この文字が見えていれば、レイアウトとルートは正常です。</p>
    </div>
  );
}
