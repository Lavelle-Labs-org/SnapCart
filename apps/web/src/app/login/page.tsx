import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LoginForm } from "./login-form";
import { AuthHeader, AuthFooter } from "../../components/auth-header";

export const metadata = {
  title: "Seller Sign In | Snapcart — Order in a snap",
  description: "Access your dashboard, manage orders, and check SMS notifications in a snap.",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-between transition-colors duration-200">
      <AuthHeader />

      {/* Main Login Card */}
      <main className="flex-1 flex flex-col justify-center items-center p-4 py-8">
        <LoginForm />
      </main>

      <AuthFooter />
    </div>
  );
}
