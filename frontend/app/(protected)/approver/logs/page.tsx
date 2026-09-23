"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/src/lib/supabase/client";
import { cn } from "cn";
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
import {
  BadgeCheck,
  CircleX,
  FileClock,
  History,
  RefreshCw,
} from "lucide-react";
import { PageHeader } from "@/src/components/shared/page-header";
import { StatCard } from "@/src/components/shared/stat-card";
import { StatusBadge } from "@/src/components/shared/badges";
import { EmptyState, ErrorState, ListSkeleton } from "@/src/components/shared/state";
import { formatDateTime } from "@/src/lib/format";

type ApprovalLog = {
  id: string;
  request_id: string;
  approver_id: string;
  action: string;
  remarks: string | null;
  created_at: string;
};

type RequestInfo = {
  id: string;
  request_number: string;
  title: string;
};

type ProfileInfo = {
  id: string;
  full_name: string;
};

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<ApprovalLog[]>([]);
  const [requests, setRequests] = useState<RequestInfo[]>([]);
  const [profiles, setProfiles] = useState<ProfileInfo[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadLogs() {
    if (refreshing) {
      return;
    }

    try {
      setLoading(true);
      setRefreshing(true);
      setError("");

      const supabase = createClient();

      /*
       * 1. Get REAL approval history
       */
      const { data: logsData, error: logsError } = await supabase
        .from("approval_logs")
        .select(`
          id,
          request_id,
          approver_id,
          action,
          remarks,
          created_at
        `)
        .order("created_at", { ascending: false });

      if (logsError) {
        console.error("Load logs error:", logsError);
        setError(logsError.message);
        return;
      }

      /*
       * 2. Get the REAL purchase requests
       *    connected to the approval logs
       */
      const { data: requestData, error: requestError } = await supabase
        .from("purchase_requests")
        .select(`
          id,
          request_number,
          title
        `);

      if (requestError) {
        console.error("Load requests error:", requestError);
        setError(requestError.message);
        return;
      }

      /*
       * 3. Get the REAL profiles of the users
       *    who processed the requests
       */
      const approverIds = [
        ...new Set(
          (logsData ?? []).map((log) => log.approver_id)
        ),
      ];

      let profileData: ProfileInfo[] = [];

      if (approverIds.length > 0) {
        const { data, error: profileError } = await supabase
          .from("profiles")
          .select(`
            id,
            full_name
          `)
          .in("id", approverIds);

        if (profileError) {
          console.error("Load profiles error:", profileError);
          setError(profileError.message);
          return;
        }

        profileData = data ?? [];
      }

      setLogs(logsData ?? []);
      setRequests(requestData ?? []);
      setProfiles(profileData);
    } catch (err) {
      console.error("Unexpected logs error:", err);
      setError("Failed to load approval history.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function getRequest(requestId: string) {
    return requests.find(
      (request) => request.id === requestId
    );
  }

  function getProfile(profileId: string) {
    return profiles.find(
      (profile) => profile.id === profileId
    );
  }

  function formatAction(action: string) {
    return action.charAt(0).toUpperCase() + action.slice(1);
  }

  const filteredLogs = useMemo(() => {
    if (filter === "all") {
      return logs;
    }

    return logs.filter(
      (log) => log.action.toLowerCase() === filter
    );
  }, [logs, filter]);

  const approvedCount = logs.filter(
    (log) => log.action.toLowerCase() === "approved"
  ).length;

  const rejectedCount = logs.filter(
    (log) => log.action.toLowerCase() === "rejected"
  ).length;

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <PageHeader title="History Logs" />
        <ListSkeleton />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      {/* Header */}
      <PageHeader
        title="History Logs"
        description="Real approval and rejection activity from the system."
      />

      {/* Error */}
      {error && (
        <ErrorState message={error} onRetry={loadLogs} />
      )}

      {/* Statistics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Actions"
          value={logs.length}
          icon={FileClock}
          tone="primary"
        />

        <StatCard
          label="Approved"
          value={approvedCount}
          icon={BadgeCheck}
          tone="approved"
        />

        <StatCard
          label="Rejected"
          value={rejectedCount}
          icon={CircleX}
          tone="rejected"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "approved", "rejected"] as const).map((value) => (
          <Button
            key={value}
            type="button"
            variant={filter === value ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(value)}
          >
            {value === "all" ? "All" : formatAction(value)}
          </Button>
        ))}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={loadLogs}
          disabled={refreshing}
          className="ml-auto"
        >
          <RefreshCw className={cn(refreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Logs */}
      {filteredLogs.length === 0 ? (
        <EmptyState
          icon={History}
          title="No approval history found"
          description="There is no approval activity that matches this filter."
        />
      ) : (
        <Card>
          <CardContent className="pt-(--card-spacing)">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Processed By</TableHead>
                  <TableHead>Remarks</TableHead>
                  <TableHead>Date & Time</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredLogs.map((log) => {
                  const request = getRequest(log.request_id);
                  const profile = getProfile(log.approver_id);

                  return (
                    <TableRow key={log.id}>
                      {/* Request Number */}
                      <TableCell className="font-medium">
                        {request ? (
                          <Link
                            href={`/approver/requests/${request.id}`}
                            className="text-indigo-600 hover:underline dark:text-indigo-400"
                          >
                            {request.request_number}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">
                            Request unavailable
                          </span>
                        )}
                      </TableCell>

                      {/* Title */}
                      <TableCell>
                        <p className="max-w-220px truncate font-medium text-foreground">
                          {request?.title ?? "Unknown request"}
                        </p>
                      </TableCell>

                      {/* Action */}
                      <TableCell>
                        <StatusBadge status={log.action} />
                      </TableCell>

                      {/* Processor */}
                      <TableCell>
                        <p className="font-medium text-foreground">
                          {profile?.full_name ?? "Unknown user"}
                        </p>
                      </TableCell>

                      {/* Remarks */}
                      <TableCell>
                        <p className="max-w-260px text-sm text-muted-foreground">
                          {log.remarks || "No remarks"}
                        </p>
                      </TableCell>

                      {/* Date */}
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDateTime(log.created_at)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}