import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
    return [
      { source: "/deepspace", destination: "/base", permanent: false },
      { source: "/spacestation", destination: "/base", permanent: false },
      {
        source: "/archive/deepspace",
        destination: "/archive/base",
        permanent: false,
      },
      {
        source: "/archive/spacestation",
        destination: "/archive/base",
        permanent: false,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
