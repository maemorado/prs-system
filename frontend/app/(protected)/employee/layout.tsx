import EmployeeSidebar from "@/src/components/employee/layout/Sidebar";

export default function EmployeeLayout({
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
      <EmployeeSidebar />

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
