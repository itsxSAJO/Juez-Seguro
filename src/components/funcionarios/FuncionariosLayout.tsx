import { ReactNode } from "react";
import { FuncionariosSidebar } from "./FuncionariosSidebar";

interface FuncionariosLayoutProps {
  children: ReactNode;
}

export const FuncionariosLayout = ({ children }: FuncionariosLayoutProps) => {
  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <FuncionariosSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};
