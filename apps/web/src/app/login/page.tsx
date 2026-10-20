import React from "react";
import { LoginForm } from "./login-form";

export const metadata = {
  title: "Seller Sign In | Order-by-SMS",
  description: "Access your orders, message audit logs, and settings.",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <LoginForm />
    </div>
  );
}
