import { RegisterComponent } from "./components/RegisterComponent";
import { isAuthDisabled } from "@/lib/session";
import { redirect } from "next/navigation";

const RegisterPage = async () => {
  if (isAuthDisabled()) {
    redirect("/");
  }

  return (
    <div className="flex flex-col w-full h-full overflow-auto p-10 space-y-5">
      <div className="">
        <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">
          Welcome to {process.env.NEXT_PUBLIC_APP_NAME}
        </h1>
      </div>
      <RegisterComponent />
    </div>
  );
};

export default RegisterPage;
