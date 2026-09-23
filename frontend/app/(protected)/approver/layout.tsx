import ApproverSidebar from "@/src/components/approver/layout/ApproverSidebar";

export default function ApproverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ApproverSidebar>{children}</ApproverSidebar>;
}