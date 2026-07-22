import Heading from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import React from "react";

interface ContainerProps {
  title: string;
  description: string;
  visibility?: string;
  children: React.ReactNode;
}

const Container = ({
  title,
  description,
  visibility,
  children,
}: ContainerProps) => {
  return (
    <div className="flex h-full min-w-0 w-full flex-1 flex-col">
      <Heading
        title={title}
        description={description}
        visibility={visibility}
      />
      <Separator className="my-4" />
      <div className="min-h-0 min-w-0 w-full flex-1">
        {children}
      </div>
    </div>
  );
};

export default Container;
