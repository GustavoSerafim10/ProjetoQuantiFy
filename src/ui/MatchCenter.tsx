import React, { useState, useCallback } from "react";
import ComparisonPanel from "./ComparisonPanel";
import InputPanel from "./InputPanel";
import Dashboard from "./Dashboard";
import GameAnalysisPanel from "./GameAnalysisPanel";

const MemoComparisonPanel = React.memo(ComparisonPanel);
const MemoInputPanel = React.memo(InputPanel);

export default function MatchCenter({ runAnalysis }: any) {

  const [comparisonData, setComparisonData] = useState<any>(null);
  const [result, setResult] = useState<any>(null);

  const handleLoadData = useCallback((data: any) => {
    setComparisonData(data);
  }, []);

  const handleAnalyze = useCallback((data: any) => {
    const output = runAnalysis(data);
    setResult(output);
  }, [runAnalysis]);

  return (
    <div className="space-y-6">

      <MemoComparisonPanel onLoadData={handleLoadData} />

      <MemoInputPanel
        onAnalyze={handleAnalyze}
        externalData={comparisonData}
      />

      {result && (
        <>
          <Dashboard data={result} />
          <GameAnalysisPanel markets={result.markets} />
        </>
      )}

    </div>
  );
}