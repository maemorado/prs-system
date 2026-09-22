import ApproverSidebar from "@/src/components/approver/layout/ApproverSidebar";

export default function ApproverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
      }}
    >
      <ApproverSidebar />

      <main
        style={{
          flex: 1,
          padding: 30,
        }}
      >
        {children}
      </main>
    </div>
  );
}
