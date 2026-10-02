"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/src/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Inbox } from "lucide-react";
import { PageHeader } from "@/src/components/shared/page-header";
import { PriorityBadge, StatusBadge } from "@/src/components/shared/badges";
import { EmptyState, ErrorState, ListSkeleton } from "@/src/components/shared/state";
import { formatAmount, formatDateTime } from "@/src/lib/format";

type PurchaseRequest = {
  id: string;
  request_number: string;
  title: string;
  purpose: string;
  priority: string;
  status: string;
  total_amount: number;
  submitted_at: string;
  requested_by: string;
};

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadRequests() {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("purchase_requests")
        .select(`
          id,
          request_number,
          title,
          purpose,
          priority,
          status,
          total_amount,
          submitted_at,
          requested_by
        `)
        .order("submitted_at", { ascending: false });

      if (error) {
        console.error("Admin requests error:", error);
        setError(error.message);
        setLoading(false);
        return;
      }

      setRequests(data ?? []);
      setLoading(false);
    }

    loadRequests();
  }, []);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        <PageHeader title="Purchase Requests" />
        <ListSkeleton />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <PageHeader
        title="Purchase Requests"
        description="View and manage all purchase requests."
      >
        <Button
          variant="ghost"
          render={<Link href="/approver/dashboard" />}
        >
          <ArrowLeft />
          Back to Dashboard
        </Button>
      </PageHeader>

      {error && (
        <ErrorState
          message={error}
          onRetry={() => window.location.reload()}
        />
      )}

      {requests.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No Purchase Requests"
          description="There are currently no purchase requests in the system."
        />
      ) : (
        <Card>
          <CardContent className="pt-(--card-spacing)">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request No.</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium text-foreground">
                      {request.request_number}
                    </TableCell>

                    <TableCell>{request.title}</TableCell>

                    <TableCell className="max-w-[220px] truncate">
                      {request.purpose}
                    </TableCell>

                    <TableCell>
                      <PriorityBadge priority={request.priority} />
                    </TableCell>

                    <TableCell>
                      <StatusBadge status={request.status} />
                    </TableCell>

                    <TableCell className="text-right font-medium tabular-nums text-foreground">
                      {formatAmount(request.total_amount)}
                    </TableCell>

                    <TableCell className="text-muted-foreground">
                      {formatDateTime(request.submitted_at)}
                    </TableCell>

                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        render={
                          <Link href={`/approver/requests/${request.id}`} />
                        }
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}