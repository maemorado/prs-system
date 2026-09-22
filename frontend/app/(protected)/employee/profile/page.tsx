"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/src/lib/supabase/client";

type Profile = {
  id: string;
  full_name: string;
  employee_id: string | null;
  role: string;
  department_id: string | null;
};

type Department = {
  id: string;
  name: string;
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [department, setDepartment] = useState<Department | null>(null);
  const [email, setEmail] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("You are not authenticated.");
        setLoading(false);
        return;
      }

      setEmail(user.email ?? "");

      const { data: profileData, error: profileError } =
        await supabase
          .from("profiles")
          .select(
            `
            id,
            full_name,
            employee_id,
            role,
            department_id
          `
          )
          .eq("id", user.id)
          .single();

      if (profileError) {
        console.error("Profile error:", profileError);
        setError(profileError.message);
        setLoading(false);
        return;
      }

      setProfile(profileData);

      if (profileData.department_id) {
        const { data: departmentData, error: departmentError } =
          await supabase
            .from("departments")
            .select("id, name")
            .eq("id", profileData.department_id)
            .single();

        if (departmentError) {
          console.error(
            "Department error:",
            departmentError
          );
        } else {
          setDepartment(departmentData);
        }
      }

      setLoading(false);
    }

    loadProfile();
  }, []);

  if (loading) {
    return <p>Loading profile...</p>;
  }

  if (error) {
    return (
      <div>
        <h1>My Profile</h1>
        <p>{error}</p>
      </div>
    );
  }

  if (!profile) {
    return <p>Profile not found.</p>;
  }

  return (
    <div style={{ padding: "24px" }}>
      <h1>My Profile</h1>

      <p>
        View your employee account information.
      </p>

      <div
        style={{
          marginTop: "30px",
          maxWidth: "600px",
          padding: "24px",
          border: "1px solid #ddd",
          borderRadius: "10px",
        }}
      >
        <div style={{ marginBottom: "20px" }}>
          <strong>Full Name</strong>
          <p>{profile.full_name}</p>
        </div>

        <div style={{ marginBottom: "20px" }}>
          <strong>Email</strong>
          <p>{email || "No email available"}</p>
        </div>

        <div style={{ marginBottom: "20px" }}>
          <strong>Employee ID</strong>
          <p>
            {profile.employee_id || "Not assigned"}
          </p>
        </div>

        <div style={{ marginBottom: "20px" }}>
          <strong>Role</strong>
          <p>{profile.role}</p>
        </div>

        <div>
          <strong>Department</strong>
          <p>
            {department?.name || "Not assigned"}
          </p>
        </div>
      </div>
    </div>
  );
}