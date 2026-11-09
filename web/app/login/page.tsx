import { Suspense } from "react";
import LoginForm from "./login-form";

// The form reads ?deleted=1 from the address, so it renders inside a boundary.
export default function Login() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
