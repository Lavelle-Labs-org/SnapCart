import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SignupForm } from "./signup-form";
import { AuthHeader, AuthFooter } from "../../components/auth-header";

export const metadata = {
  title: "Launch Your Store | Snapcart — Order in a snap",
  description: "Start taking orders in a snap with your own branded storefront and SMS notifications.",
};

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-between transition-colors duration-200">
      <AuthHeader />

      {/* Main Signup Card */}
      <main className="flex-1 flex flex-col justify-center items-center p-4 py-8">
        <SignupForm />
      </main>

      <AuthFooter />
    </div>
  );
}
