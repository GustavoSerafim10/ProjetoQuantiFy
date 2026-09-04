import { motion } from "framer-motion";

import type { CalibrationReport } from "../domain/tracking/calibrationReport";

/* ==========================================
   CALIBRATION PANEL
========================================== */

/*
 * Mostra se a probabilidade que o modelo diz bate com o que
 * realmente acontece — por mercado e por classificação, sobre
 * apostas já liquidadas. ROI isolado não conta essa história;
 * calibração conta. Puramente apresentacional: todo o cálculo
 * vem de calibrationReport.ts, este arquivo só desenha.
 */

const Card = ({
  children
}: {
  children: React.ReactNode;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="backdrop-blur-xl border border-zinc-800 rounded-2xl p-4 bg-white/5 shadow-lg"
  >
    {children}
  </motion.div>
);

function formatPercent(value: number, decimals = 0): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

function formatDecimal(value: number, decimals = 3): string {
  return value.toFixed(decimals);
}

function calibrationColor(error: number): string {
  if (error <= 0.05) return "text-green-400";
  if (error <= 0.10) return "text-yellow-400";
  return "text-red-400";
}

function BucketRow({
  label,
  bucket
}: {
  label: string;
  bucket: CalibrationReport["overall"];
}) {
  return (
    <div className="grid grid-cols-6 gap-2 text-xs py-1.5 border-b border-zinc-800 last:border-0">
      <div className="text-zinc-300 font-medium truncate">
        {label}
      </div>

      <div className="text-zinc-500 text-center">
        {bucket.bets}
      </div>

      <div className="text-center">
        {formatPercent(bucket.winRate)}
      </div>

      <div className="text-center text-zinc-400">
        {formatPercent(bucket.avgProbability)}
      </div>

      <div
        className={`text-center font-medium ${calibrationColor(bucket.calibrationError)}`}
      >
        {formatPercent(bucket.calibrationError, 1)}
      </div>

      <div className="text-center text-zinc-400">
        {formatDecimal(bucket.brierScore)}
      </div>
    </div>
  );
}

export default function CalibrationPanel({
  report
}: {
  report: CalibrationReport;
}) {
  const marketEntries =
    Object.entries(report.byMarket).sort(
      (a, b) => b[1].bets - a[1].bets
    );

  const classificationEntries =
    Object.entries(report.byClassification).sort(
      (a, b) => b[1].bets - a[1].bets
    );

  return (
    <Card>
      <h2 className="font-bold mb-1">
        🎯 Calibração do Modelo
      </h2>

      <div className="text-xs text-zinc-500 mb-3">
        Compara a probabilidade prevista com o resultado real —
        não é o mesmo que ROI. Erro de calibração perto de 0%
        significa que quando o modelo diz "60%", isso vence perto
        de 60% das vezes de verdade.
      </div>

      {report.sampleWarning && (
        <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 mb-3">
          ⚠️ {report.sampleWarning}
        </div>
      )}

      {report.overall.bets > 0 ? (
        <>
          <div className="grid grid-cols-6 gap-2 text-[10px] uppercase tracking-wide text-zinc-500 pb-1 border-b border-zinc-700">
            <div>Grupo</div>
            <div className="text-center">N</div>
            <div className="text-center">Win%</div>
            <div className="text-center">Prob. média</div>
            <div className="text-center">Erro calib.</div>
            <div className="text-center">Brier</div>
          </div>

          <BucketRow label="Geral" bucket={report.overall} />

          {report.recentVsAllTime && (
            <BucketRow
              label={`Últimas ${report.recentVsAllTime.windowSize}`}
              bucket={report.recentVsAllTime.recent}
            />
          )}

          {marketEntries.length > 0 && (
            <div className="mt-3 text-[10px] uppercase tracking-wide text-zinc-500">
              Por mercado
            </div>
          )}

          {marketEntries.map(([market, bucket]) => (
            <BucketRow key={market} label={market} bucket={bucket} />
          ))}

          {classificationEntries.length > 0 && (
            <div className="mt-3 text-[10px] uppercase tracking-wide text-zinc-500">
              Por classificação
            </div>
          )}

          {classificationEntries.map(([classification, bucket]) => (
            <BucketRow
              key={classification}
              label={classification}
              bucket={bucket}
            />
          ))}
        </>
      ) : (
        <div className="text-zinc-500 text-sm">
          Registre e liquide apostas para ver a calibração real do
          modelo aqui.
        </div>
      )}
    </Card>
  );
}
