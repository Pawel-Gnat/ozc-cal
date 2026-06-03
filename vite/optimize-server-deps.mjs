/** Pre-bundle React + island deps for workerd SSR (Astro 6 + Cloudflare). See EdgeKits Astro 6 migration notes. */
const SERVER_OPTIMIZE_DEPS = [
  "react",
  "react-dom",
  "react-dom/server.edge",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "lucide-react",
  "radix-ui",
  "@radix-ui/react-slot",
  "class-variance-authority",
];

/** @returns {import("vite").Plugin} */
export function optimizeServerDeps() {
  return {
    name: "ozc-optimize-server-deps",
    configEnvironment(name) {
      if (name === "client") {
        return {
          optimizeDeps: {
            include: SERVER_OPTIMIZE_DEPS,
          },
        };
      }
      return {
        optimizeDeps: {
          include: SERVER_OPTIMIZE_DEPS,
        },
      };
    },
  };
}
