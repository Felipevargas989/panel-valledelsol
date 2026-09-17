/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  // La vista «Dinero» pasó a llamarse «Conversiones» el 17-09-2026.
  async redirects() {
    return [{ source: "/dinero", destination: "/conversiones", permanent: false }];
  },
};
