/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      /*
       * "Quantify Football" — paleta oficial (2026-09-09). Fundo
       * quase-preto/navy, verde como cor principal (ao invés do
       * roxo/rosa genérico de SaaS), ciano reservado pra elementos
       * quantitativos (lambda, Monte Carlo, motor). Roxo continua
       * disponível como secundária (ex: AiAnalystPanel), não removido.
       */
      colors: {
        quantify: {
          bg: "#070B14",
          card: "#101827",
          green: "#19E68C",
          neon: "#00FF85",
          cyan: "#34D8FF",
          yellow: "#FFC94D",
          red: "#FF4D5E",
          ice: "#E8ECF2",
          purple: "#6C5CFF"
        }
      }
    },
  },
  plugins: [],
}