import type { Metadata } from "next";
import { ForgotForm } from "../forms";

export const metadata: Metadata = { title: "Paroles atjaunošana" };

export default function ForgotPasswordPage() {
  return <ForgotForm />;
}
