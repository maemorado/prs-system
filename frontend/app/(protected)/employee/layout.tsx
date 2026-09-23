import EmployeeSidebar from "@/src/components/employee/layout/Sidebar";

export default function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <EmployeeSidebar>{children}</EmployeeSidebar>;
}