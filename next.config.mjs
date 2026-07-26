/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The Railway game server lives in ./server and is not part of the Next build.
  outputFileTracingExcludes: {
    '*': ['./server/**/*'],
  },
};

export default nextConfig;
