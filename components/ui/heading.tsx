import { Lock } from "lucide-react";

interface HeadingProps {
  title: string;
  description: string;
  visibility?: string;
}

const Heading = ({ title, description, visibility }: HeadingProps) => {
  return (
    <div className="min-w-0">
      <h2 className="flex flex-wrap items-center gap-2 break-words text-2xl font-bold tracking-tight sm:text-3xl">
        {title}
        {visibility === "private" ? <Lock className="shrink-0" /> : ""}
      </h2>
      <p className="break-words py-1 text-sm text-muted-foreground">
        {description}
      </p>
    </div>
  );
};

export default Heading;
