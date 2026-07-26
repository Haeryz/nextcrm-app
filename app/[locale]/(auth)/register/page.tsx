import { RegisterComponent } from "./components/RegisterComponent";
import { APP_NAME } from "@/lib/brand";

const RegisterPage = async () => {
  return (
    <div className="flex flex-col w-full h-full overflow-auto p-10 space-y-5">
      <div className="">
        <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">
          Selamat datang di {APP_NAME}
        </h1>
      </div>
      <RegisterComponent />
    </div>
  );
};

export default RegisterPage;
