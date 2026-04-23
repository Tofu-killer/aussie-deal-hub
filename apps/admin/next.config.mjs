function getAdminApiBaseUrl() {
  return (process.env.ADMIN_API_BASE_URL ?? "http://127.0.0.1:3001").replace(/\/+$/, "");
}

const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/v1/:path*",
        destination: `${getAdminApiBaseUrl()}/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
