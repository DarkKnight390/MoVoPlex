import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ModuleShellPageProps {
  title: string;
  summary: string;
}

const ModuleShellPage = ({ title, summary }: ModuleShellPageProps) => {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.35em] text-red-500">
          MoVoPlex Admin Console
        </p>
        <h1 className="mt-3 text-4xl font-bold text-white">{title}</h1>
        <p className="mt-3 max-w-3xl text-sm text-gray-400 md:text-base">
          {summary}
        </p>
      </div>
      <Card className="border-gray-800 bg-gray-950 text-white">
        <CardHeader>
          <CardTitle className="text-white">Coming next</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-400">
          This module shell is live in the console and ready for its phase-two
          workflows, permissions, and backend actions.
        </CardContent>
      </Card>
    </div>
  );
};

export default ModuleShellPage;
