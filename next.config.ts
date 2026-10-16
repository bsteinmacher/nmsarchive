import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
    return [
      { source: "/frigate", destination: "/freighter", permanent: false },
      { source: "/deepspace", destination: "/base", permanent: false },
      { source: "/spacestation", destination: "/base", permanent: false },
      {
        source: "/archive/frigate",
        destination: "/archive/freighter",
        permanent: false,
      },
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

export default nextConfig;
