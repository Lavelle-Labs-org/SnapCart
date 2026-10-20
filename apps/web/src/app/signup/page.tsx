import React from "react";
import { SignupForm } from "./signup-form";

export const metadata = {
  title: "Create Seller Account | Order-by-SMS",
  description: "Set up your storefront and handle customer orders by SMS.",
};

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <SignupForm />
    </div>
  );
}
